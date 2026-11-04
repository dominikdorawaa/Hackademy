package com.hackademy.server;

import com.hackademy.server.arena.ArenaService;
import com.hackademy.server.arena.MatchmakingService;
import com.hackademy.server.config.WebSocketAuthInterceptor;
import com.hackademy.server.user.AccountAccess;
import com.hackademy.server.user.Role;
import com.hackademy.server.user.User;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AccountDeletionIntegrationTest extends PostgresIntegrationTest {

    private static final String PASSWORD = "Sekretne-haslo-1";
    private static final List<String> deletedIds = new CopyOnWriteArrayList<>();
    private static final Set<String> passwordless = ConcurrentHashMap.newKeySet();
    private static volatile int clerkStatus;
    private static final HttpServer clerk = startClerk();

    @Autowired AccountAccess access;
    @Autowired WebSocketAuthInterceptor websocket;
    @Autowired ArenaService arena;
    @Autowired MatchmakingService matchmaking;

    @DynamicPropertySource
    static void clerkProperties(DynamicPropertyRegistry registry) {
        registry.add("application.clerk.secret-key", () -> "sk_test_deletion");
        registry.add("application.clerk.api-url", () -> "http://localhost:" + clerk.getAddress().getPort());
    }

    @BeforeEach
    void resetClerk() {
        deletedIds.clear();
        passwordless.clear();
        clerkStatus = 200;
    }

    @AfterAll
    static void stopClerk() {
        clerk.stop(0);
    }

    @Test
    void deletesOnlyTheLinkedIdentityAndBlocksOldTokensAndSessionsAfterRetry() throws Exception {
        var admin = account(Role.ADMIN);
        var target = account(Role.USER);
        var other = account(Role.USER);
        var identity = userRepository.findById(target.id()).orElseThrow().getClerkUserId();
        jdbcTemplate.update("INSERT INTO user_badges (user_id, badge_id, earned_at) SELECT ?, id, now() FROM badges LIMIT 1", target.id());
        jdbcTemplate.update("INSERT INTO user_weekly_active_time (user_id, week_key, seconds, updated_at) VALUES (?, '2026-W40', 10, now())", target.id());

        deleteAs(admin, target.id(), 204);
        assertFalse(userRepository.existsById(target.id()));
        assertFalse(access.isActive(target.id()));
        assertEquals(0, jdbcTemplate.queryForObject("SELECT count(*) FROM user_badges WHERE user_id = ?", Integer.class, target.id()));
        assertEquals(0, jdbcTemplate.queryForObject("SELECT count(*) FROM user_weekly_active_time WHERE user_id = ?", Integer.class, target.id()));
        assertOldAccessDenied(target);
        clerkStatus = 404;
        deleteAs(admin, target.id(), 204);
        assertEquals(List.of(identity, identity), deletedIds);
        assertTrue(userRepository.existsById(other.id()));
        getAs(other, "/api/user/me").andExpect(status().isOk());
        assertOldAccessDenied(target);
    }

    @Test
    void clerkFailureBlocksAccessWithoutClaimingSuccessAndCanBeRetried() throws Exception {
        var admin = account(Role.ADMIN);
        var target = account(Role.USER);
        clerkStatus = 503;

        deleteAs(admin, target.id(), 502);
        assertTrue(userRepository.existsById(target.id()));
        assertOldAccessDenied(target);

        clerkStatus = 200;
        deleteAs(admin, target.id(), 204);
        assertFalse(userRepository.existsById(target.id()));
        assertEquals(2, deletedIds.size());
        assertEquals(deletedIds.get(0), deletedIds.get(1));
    }

    @Test
    void databaseFailureAfterClerkDeletionKeepsTheBlockAndRollsBackLocalChanges() throws Exception {
        var admin = account(Role.ADMIN);
        var target = account(Role.USER);
        jdbcTemplate.update("INSERT INTO user_badges (user_id, badge_id, earned_at) SELECT ?, id, now() FROM badges LIMIT 1", target.id());
        jdbcTemplate.execute("CREATE FUNCTION fail_account_deletion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated deletion failure'; END $$");
        jdbcTemplate.execute("CREATE TRIGGER fail_account_deletion BEFORE DELETE ON users FOR EACH ROW WHEN (OLD.id = " + target.id() + ") EXECUTE FUNCTION fail_account_deletion()");
        try {
            deleteAs(admin, target.id(), 500);
            assertTrue(userRepository.existsById(target.id()));
            assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM user_badges WHERE user_id = ?", Integer.class, target.id()));
            assertOldAccessDenied(target);
        } finally {
            jdbcTemplate.execute("DROP TRIGGER fail_account_deletion ON users");
            jdbcTemplate.execute("DROP FUNCTION fail_account_deletion()");
        }
        clerkStatus = 404;
        deleteAs(admin, target.id(), 204);
        assertFalse(userRepository.existsById(target.id()));
        assertOldAccessDenied(target);
    }

    @Test
    void failedBlockPersistenceDoesNotCallClerkOrDeleteTheUser() throws Exception {
        var admin = account(Role.ADMIN);
        var target = account(Role.USER);
        jdbcTemplate.execute("ALTER TABLE account_deletions ADD CONSTRAINT simulated_block_failure CHECK (user_id <> " + target.id() + ")");
        try {
            deleteAs(admin, target.id(), 500);
            assertTrue(deletedIds.isEmpty());
            assertTrue(access.isActive(target.id()));
            getAs(target, "/api/user/me").andExpect(status().isOk());
        } finally {
            jdbcTemplate.execute("ALTER TABLE account_deletions DROP CONSTRAINT simulated_block_failure");
        }
    }

    @Test
    void normalUsersCannotDeleteAccountsAndMissingIdsCannotTargetClerk() throws Exception {
        var member = account(Role.USER);
        var admin = account(Role.ADMIN);
        deleteAs(member, admin.id(), 403);
        mockMvc.perform(delete("/api/admin/users/" + member.id())).andExpect(status().isUnauthorized());
        deleteAs(admin, Long.MAX_VALUE, 404);
        assertTrue(deletedIds.isEmpty());
    }

    @Test
    void deletingALegacyAccountDoesNotGuessAClerkIdentity() throws Exception {
        var admin = account(Role.ADMIN);
        var legacy = account(Role.USER);
        jdbcTemplate.update("UPDATE users SET clerk_user_id = NULL WHERE id = ?", legacy.id());
        deleteAs(admin, legacy.id(), 204);
        assertTrue(deletedIds.isEmpty());
        assertFalse(userRepository.existsById(legacy.id()));
    }

    @Test
    void selfDeletionRemovesOrAnonymizesEveryRowLinkedToTheAccount() throws Exception {
        var admin = account(Role.ADMIN);
        var target = account(Role.USER);
        var friend = account(Role.USER);
        var invited = account(Role.USER);
        var identity = userRepository.findById(target.id()).orElseThrow().getClerkUserId();
        seed(admin, target, friend, invited);
        seed(admin, friend, invited, admin);
        var linked = linkedColumns();
        for (var column : linked) assertTrue(rows(column, target.id()) > 0, "no seeded row in " + column);
        var friendRows = linked.stream().collect(java.util.stream.Collectors.toMap(column -> column, column -> rows(column, friend.id())));

        deleteSelf(target, "{\"password\":\"" + PASSWORD + "\"}").andExpect(status().isNoContent());

        assertFalse(userRepository.existsById(target.id()));
        assertEquals(List.of(identity), deletedIds);
        for (var column : linked) assertEquals(0, rows(column, target.id()), "row left in " + column);
        assertEquals(1, jdbcTemplate.queryForObject(
                "SELECT count(*) FROM bug_reports WHERE reporter_id IS NULL AND description = ?", Integer.class, report(target)));
        for (var column : linked) {
            long expected = friendRows.get(column) - (column.equals("friendships.requester_id") ? 1 : 0);
            assertEquals(expected, rows(column, friend.id()), "friend data changed in " + column);
        }
        getAs(friend, "/api/friends").andExpect(status().isOk());
        assertOldAccessDenied(target);
        deleteSelf(target, "{\"password\":\"" + PASSWORD + "\"}").andExpect(status().isUnauthorized());

        var again = ClerkTestTokens.createUser(userRepository, target.username(), Role.USER);
        assertEquals(target.username().toLowerCase() + "@example.com", again.getEmail());
        mockMvc.perform(get("/api/user/me").header("Authorization", ClerkTestTokens.bearer(again)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.username").value(target.username()));
    }

    @Test
    void wrongPasswordDeletesNothingAndRepeatedGuessesAreStopped() throws Exception {
        var target = account(Role.USER);
        deleteSelf(target, "{\"password\":\"zgadywanie\"}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Hasło jest nieprawidłowe."));
        deleteSelf(target, "{}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Wpisz obecne hasło."));
        assertTrue(access.isActive(target.id()));
        getAs(target, "/api/user/me").andExpect(status().isOk());
        for (int attempt = 1; attempt < 5; attempt++) deleteSelf(target, "{\"password\":\"zgadywanie\"}").andExpect(status().isBadRequest());
        deleteSelf(target, "{\"password\":\"" + PASSWORD + "\"}").andExpect(status().isTooManyRequests());
        assertTrue(userRepository.existsById(target.id()));
        assertTrue(deletedIds.isEmpty());
    }

    @Test
    void accountWithoutPasswordConfirmsThroughAFreshEmailCode() throws Exception {
        var target = account(Role.USER);
        var user = userRepository.findById(target.id()).orElseThrow();
        passwordless.add(user.getClerkUserId());
        deleteSelf(target, "{}").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.clerk_error.reason").value("reverification-error"))
                .andExpect(jsonPath("$.clerk_error.metadata.reverification.level").value("first_factor"))
                .andExpect(jsonPath("$.clerk_error.metadata.reverification.afterMinutes").value(10));
        var stale = new Account(target.id(), target.username(), verifiedToken(user, 45));
        deleteSelf(stale, "{}").andExpect(status().isForbidden());
        assertTrue(userRepository.existsById(target.id()));
        var fresh = new Account(target.id(), target.username(), verifiedToken(user, 2));
        deleteSelf(fresh, "{}").andExpect(status().isNoContent());
        assertFalse(userRepository.existsById(target.id()));
    }

    private static String verifiedToken(User user, int minutesAgo) {
        return ClerkTestTokens.token(user.getClerkUserId(), ClerkTestTokens.DEFAULT_ORIGIN,
                Map.of("email", user.getEmail(), "email_verified", true, "fva", List.of(minutesAgo, -1)));
    }

    @Test
    void deletionEndsTheDuelForTheRivalAndDropsQueueAndChallenges() throws Exception {
        var target = account(Role.USER);
        var rival = account(Role.USER);
        var challenged = account(Role.USER);
        var challenge = arena.createChallenge(target.id(), target.username(), rival.id(), rival.username());
        var game = arena.acceptChallenge(challenge.getId(), rival.id()).getId();
        int rivalElo = jdbcTemplate.queryForObject("SELECT elo FROM users WHERE id = ?", Integer.class, rival.id());

        deleteSelf(target, "{\"password\":\"" + PASSWORD + "\"}").andExpect(status().isNoContent());

        getAs(rival, "/api/arena/game/" + game).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FINISHED"))
                .andExpect(jsonPath("$.winnerId").value(rival.id()))
                .andExpect(jsonPath("$.player1Username").value("Usunięte konto"));
        assertTrue(jdbcTemplate.queryForObject("SELECT elo FROM users WHERE id = ?", Integer.class, rival.id()) > rivalElo);

        var queued = account(Role.USER);
        arena.joinQueue(queued.id(), queued.username());
        arena.createChallenge(queued.id(), queued.username(), challenged.id(), challenged.username());
        deleteSelf(queued, "{\"password\":\"" + PASSWORD + "\"}").andExpect(status().isNoContent());
        assertFalse(matchmaking.isQueued(queued.id()));
        assertTrue(arena.getPendingChallenges(challenged.id()).isEmpty());
    }

    private void seed(Account admin, Account owner, Account friend, Account invited) throws Exception {
        long id = owner.id();
        long room = createRoom(admin, uniqueTitle("Pokój"), "CTF");
        long task = jdbcTemplate.queryForObject("INSERT INTO room_tasks (title, content, room_id, sort_order) VALUES ('Zadanie', 'Treść', ?, 0) RETURNING id", Long.class, room);
        long hint = jdbcTemplate.queryForObject("INSERT INTO hints (description, room_id) VALUES ('Podpowiedź', ?) RETURNING id", Long.class, room);
        long path = jdbcTemplate.queryForObject("INSERT INTO paths (title, created_at, updated_at) VALUES (?, now(), now()) RETURNING id", Long.class, uniqueTitle("Ścieżka"));
        long badge = jdbcTemplate.queryForObject("SELECT id FROM badges ORDER BY id LIMIT 1", Long.class);
        jdbcTemplate.update("INSERT INTO user_badges (user_id, badge_id, earned_at) VALUES (?, ?, now())", id, badge);
        jdbcTemplate.update("INSERT INTO user_featured_badges (user_id, position, badge_id) VALUES (?, 0, ?)", id, badge);
        jdbcTemplate.update("INSERT INTO user_profile_interests (user_id, position, interest) VALUES (?, 0, 'WEB')", id);
        jdbcTemplate.update("INSERT INTO path_enrollments (user_id, path_id, enrolled_at) VALUES (?, ?, now())", id, path);
        jdbcTemplate.update("INSERT INTO user_solved_rooms (user_id, room_id, solved_at) VALUES (?, ?, now())", id, room);
        jdbcTemplate.update("INSERT INTO user_completed_tasks (user_id, task_id, completed_at) VALUES (?, ?, now())", id, task);
        jdbcTemplate.update("INSERT INTO user_unlocked_hints (user_id, hint_id) VALUES (?, ?)", id, hint);
        jdbcTemplate.update("INSERT INTO user_weekly_active_time (user_id, week_key, seconds, updated_at) VALUES (?, '2026-W43', 60, now())", id);
        jdbcTemplate.update("INSERT INTO user_notification_preferences (user_id) VALUES (?) ON CONFLICT DO NOTHING", id);
        jdbcTemplate.update("INSERT INTO ukos_lab_progress (user_id, completed_steps) VALUES (?, 3)", id);
        jdbcTemplate.update("""
                INSERT INTO user_avatars (user_id, outfit, hair, hat, skin, hair_color, top_color, bottom_color, shoes_color, hat_color)
                VALUES (?, 'dres', 'krotkie', 'brak', 'jasna', 'czarne', 'bordowy', 'grafitowy', 'bialy', 'granatowy') ON CONFLICT DO NOTHING
                """, id);
        jdbcTemplate.update("""
                INSERT INTO friendships (requester_id, receiver_id, status, requester_wins, receiver_wins, created_at)
                VALUES (?, ?, 'ACCEPTED', 2, 1, now()), (?, ?, 'PENDING', 0, 0, now())
                """, friend.id(), id, id, invited.id());
        jdbcTemplate.update("INSERT INTO bug_reports (reporter_id, source, description, created_at) VALUES (?, 'ARENA', ?, now())", id, report(owner));
    }

    private static String report(Account owner) {
        return "Pytanie w Arenie ma złą odpowiedź " + owner.username();
    }

    private List<String> linkedColumns() {
        return jdbcTemplate.queryForList("""
                SELECT c.conrelid::regclass::text || '.' || a.attname FROM pg_constraint c
                JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
                WHERE c.contype = 'f' AND c.confrelid = 'users'::regclass ORDER BY 1
                """, String.class);
    }

    private long rows(String column, long userId) {
        var parts = column.split("\\.");
        return jdbcTemplate.queryForObject("SELECT count(*) FROM " + parts[0] + " WHERE " + parts[1] + " = ?", Long.class, userId);
    }

    private org.springframework.test.web.servlet.ResultActions deleteSelf(Account account, String body) throws Exception {
        return mockMvc.perform(delete("/api/user/me").header("Authorization", "Bearer " + account.token())
                .contentType("application/json").content(body));
    }

    private static void respond(com.sun.net.httpserver.HttpExchange exchange, int status, String body) throws IOException {
        var bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
    }

    private void assertOldAccessDenied(Account target) throws Exception {
        long profileCount = userRepository.count();
        getAs(target, "/api/user/me").andExpect(status().isUnauthorized());
        getAs(target, "/api/admin/users").andExpect(status().isUnauthorized());
        var connect = StompHeaderAccessor.create(StompCommand.CONNECT);
        connect.setNativeHeader("Authorization", "Bearer " + target.token());
        assertThrows(BadCredentialsException.class,
                () -> websocket.preSend(MessageBuilder.createMessage(new byte[0], connect.getMessageHeaders()), null));
        var subscribe = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        subscribe.setDestination("/user/queue/realtime");
        subscribe.setUser(UsernamePasswordAuthenticationToken.authenticated(Long.toString(target.id()), null, List.of()));
        assertThrows(BadCredentialsException.class,
                () -> websocket.preSend(MessageBuilder.createMessage(new byte[0], subscribe.getMessageHeaders()), null));
        assertEquals(profileCount, userRepository.count());
    }

    private void deleteAs(Account admin, long target, int expectedStatus) throws Exception {
        mockMvc.perform(delete("/api/admin/users/" + target).header("Authorization", "Bearer " + admin.token()))
                .andExpect(status().is(expectedStatus));
    }

    private static HttpServer startClerk() {
        try {
            var server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
            server.createContext("/users/", exchange -> {
                var path = exchange.getRequestURI().getPath().substring("/users/".length());
                var method = exchange.getRequestMethod();
                if (!"Bearer sk_test_deletion".equals(exchange.getRequestHeaders().getFirst("Authorization"))) {
                    exchange.sendResponseHeaders(401, -1);
                } else if ("DELETE".equals(method)) {
                    deletedIds.add(path);
                    exchange.sendResponseHeaders(clerkStatus, -1);
                } else if ("GET".equals(method)) {
                    respond(exchange, 200, "{\"id\":\"" + path + "\",\"password_enabled\":" + !passwordless.contains(path) + "}");
                } else if ("POST".equals(method) && path.endsWith("/verify_password")) {
                    var body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                    if (body.equals("{\"password\":\"" + PASSWORD + "\"}")) respond(exchange, 200, "{\"verified\":true}");
                    else respond(exchange, 422, "{\"errors\":[{\"code\":\"incorrect_password\"}]}");
                } else {
                    exchange.sendResponseHeaders(405, -1);
                }
                exchange.close();
            });
            server.start();
            return server;
        } catch (IOException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
