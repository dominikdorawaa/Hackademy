package com.hackademy.server;

import com.hackademy.server.config.WebSocketAuthInterceptor;
import com.hackademy.server.user.AccountAccess;
import com.hackademy.server.user.Role;
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
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AccountDeletionIntegrationTest extends PostgresIntegrationTest {

    private static final List<String> deletedIds = new CopyOnWriteArrayList<>();
    private static volatile int clerkStatus;
    private static final HttpServer clerk = startClerk();

    @Autowired AccountAccess access;
    @Autowired WebSocketAuthInterceptor websocket;

    @DynamicPropertySource
    static void clerkProperties(DynamicPropertyRegistry registry) {
        registry.add("application.clerk.secret-key", () -> "sk_test_deletion");
        registry.add("application.clerk.api-url", () -> "http://localhost:" + clerk.getAddress().getPort());
    }

    @BeforeEach
    void resetClerk() {
        deletedIds.clear();
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
                if (!"DELETE".equals(exchange.getRequestMethod())
                        || !"Bearer sk_test_deletion".equals(exchange.getRequestHeaders().getFirst("Authorization"))) {
                    exchange.sendResponseHeaders(401, -1);
                } else {
                    deletedIds.add(exchange.getRequestURI().getPath().substring("/users/".length()));
                    exchange.sendResponseHeaders(clerkStatus, -1);
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
