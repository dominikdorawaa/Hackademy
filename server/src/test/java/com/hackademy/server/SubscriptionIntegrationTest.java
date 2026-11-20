package com.hackademy.server;

import com.hackademy.server.subscription.SubscriptionAccess;
import com.hackademy.server.user.Role;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@TestPropertySource(properties = "application.shop.test-payments=true")
class SubscriptionIntegrationTest extends PostgresIntegrationTest {

    private long order(Account account) throws Exception {
        var body = postJson(account, "/api/subscription/orders", "{\"planId\":\"monthly\"}").andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING")).andExpect(jsonPath("$.test").value(true))
                .andExpect(jsonPath("$.coins").value(1000)).andExpect(jsonPath("$.priceMinor").value(2999))
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    private void subscribe(Account account) throws Exception {
        postJson(account, "/api/subscription/orders/" + order(account) + "/test-payment", "{}").andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
    }

    private void played(Account account, int games, LocalDateTime when) {
        for (int game = 0; game < games; game++) {
            jdbcTemplate.update("INSERT INTO arena_matches (user_id, game_id, opponent_name, result, elo_change, finished_at) VALUES (?, ?, 'Rywal', 'WIN', 0, ?)",
                    account.id(), UUID.randomUUID().toString(), when);
        }
    }

    private LocalDateTime yesterday() {
        return ZonedDateTime.now(SubscriptionAccess.DAY_ZONE).toLocalDate().atStartOfDay(SubscriptionAccess.DAY_ZONE)
                .withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime().minusMinutes(1);
    }

    private long balance(Account account) {
        Long balance = jdbcTemplate.query("SELECT balance FROM wallets WHERE user_id = ?", rs -> rs.next() ? rs.getLong(1) : 0L, account.id());
        return balance == null ? 0 : balance;
    }

    @Test
    void newPlayerHasNoSubscriptionAndFiveArenaGames() throws Exception {
        var player = account(Role.USER);
        getAs(player, "/api/subscription").andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false))
                .andExpect(jsonPath("$.staff").value(false))
                .andExpect(jsonPath("$.activeUntil").value(nullValue()))
                .andExpect(jsonPath("$.payments").value("test"))
                .andExpect(jsonPath("$.plan.id").value("monthly"))
                .andExpect(jsonPath("$.plan.days").value(30))
                .andExpect(jsonPath("$.plan.coins").value(1000))
                .andExpect(jsonPath("$.plan.currency").value("PLN"))
                .andExpect(jsonPath("$.arena.dailyLimit").value(5))
                .andExpect(jsonPath("$.arena.playedToday").value(0))
                .andExpect(jsonPath("$.arena.remaining").value(5));
        assertEquals(0, balance(player));
    }

    @Test
    void buyingTheSubscriptionUnlocksItForThirtyDaysAndGivesBytes() throws Exception {
        var player = account(Role.USER);
        long id = order(player);
        postJson(player, "/api/subscription/orders/" + id + "/test-payment", "{}").andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.arena.remaining").value(nullValue()));
        postJson(player, "/api/subscription/orders/" + id + "/test-payment", "{}").andExpect(status().isConflict());
        assertEquals(1000, balance(player));
        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM wallet_transactions WHERE user_id = ? AND kind = 'SUBSCRIPTION' AND amount = 1000", Integer.class, player.id()));

        LocalDateTime first = jdbcTemplate.queryForObject("SELECT active_until FROM subscriptions WHERE user_id = ?", LocalDateTime.class, player.id());
        assertTrue(first.isAfter(LocalDateTime.now().plusDays(29)) && first.isBefore(LocalDateTime.now().plusDays(31)));

        subscribe(player);
        LocalDateTime second = jdbcTemplate.queryForObject("SELECT active_until FROM subscriptions WHERE user_id = ?", LocalDateTime.class, player.id());
        assertEquals(first.plusDays(30), second);
        assertEquals(2000, balance(player));
    }

    @Test
    void subscribersShowTheirCrownOnTheirOwnAccountAndProfile() throws Exception {
        var player = account(Role.USER);
        var admin = account(Role.ADMIN);
        var viewer = account(Role.USER);
        getAs(player, "/api/user/me").andExpect(jsonPath("$.premium").value(false));
        getAs(viewer, "/api/user/" + player.username()).andExpect(jsonPath("$.premium").value(false));
        getAs(admin, "/api/user/me").andExpect(jsonPath("$.premium").value(false));

        subscribe(player);

        getAs(player, "/api/user/me").andExpect(jsonPath("$.premium").value(true));
        getAs(viewer, "/api/user/" + player.username()).andExpect(jsonPath("$.premium").value(true));
        getAs(player, "/api/ranking/me").andExpect(jsonPath("$.premium").value(true));
        getAs(viewer, "/api/ranking/me").andExpect(jsonPath("$.premium").value(false));
    }

    @Test
    void aFullWalletStillGetsPremiumAndOnlyTheBytesThatFit() throws Exception {
        var player = account(Role.USER);
        long cap = com.hackademy.server.shop.WalletService.MAX_BALANCE;
        jdbcTemplate.update("INSERT INTO wallets (user_id, balance) VALUES (?, ?)", player.id(), cap - 300);

        subscribe(player);

        assertEquals(cap, balance(player));
        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM wallet_transactions WHERE user_id = ? AND kind = 'SUBSCRIPTION' AND amount = 300", Integer.class, player.id()));

        subscribe(player);

        assertEquals(cap, balance(player));
        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM wallet_transactions WHERE user_id = ? AND kind = 'SUBSCRIPTION'", Integer.class, player.id()));
        LocalDateTime until = jdbcTemplate.queryForObject("SELECT active_until FROM subscriptions WHERE user_id = ?", LocalDateTime.class, player.id());
        assertTrue(until.isAfter(LocalDateTime.now().plusDays(59)));
    }

    @Test
    void expiredSubscriptionRestartsFromToday() throws Exception {
        var player = account(Role.USER);
        jdbcTemplate.update("INSERT INTO subscriptions (user_id, active_until) VALUES (?, ?)", player.id(), LocalDateTime.now().minusDays(3));
        getAs(player, "/api/subscription").andExpect(jsonPath("$.active").value(false)).andExpect(jsonPath("$.activeUntil").value(nullValue()));

        subscribe(player);

        LocalDateTime until = jdbcTemplate.queryForObject("SELECT active_until FROM subscriptions WHERE user_id = ?", LocalDateTime.class, player.id());
        assertTrue(until.isAfter(LocalDateTime.now().plusDays(29)));
    }

    @Test
    void ordersCanBeCancelledOnlyByTheirOwnerAndOnlyOnce() throws Exception {
        var player = account(Role.USER);
        var other = account(Role.USER);
        long id = order(player);
        postJson(other, "/api/subscription/orders/" + id + "/cancel", "{}").andExpect(status().isNotFound());
        postJson(other, "/api/subscription/orders/" + id + "/test-payment", "{}").andExpect(status().isNotFound());
        postJson(player, "/api/subscription/orders/" + id + "/cancel", "{}").andExpect(status().isNoContent());
        postJson(player, "/api/subscription/orders/" + id + "/cancel", "{}").andExpect(status().isNotFound());
        postJson(player, "/api/subscription/orders/" + id + "/test-payment", "{}").andExpect(status().isConflict());
        postJson(player, "/api/subscription/orders", "{\"planId\":\"yearly\"}").andExpect(status().isBadRequest());
        getAs(player, "/api/subscription").andExpect(jsonPath("$.active").value(false));
    }

    @Test
    void freePlayersPlayFiveArenaGamesPerDay() throws Exception {
        var player = account(Role.USER);
        played(player, 7, yesterday());
        played(player, 4, LocalDateTime.now());
        getAs(player, "/api/subscription").andExpect(jsonPath("$.arena.playedToday").value(4)).andExpect(jsonPath("$.arena.remaining").value(1));
        postJson(player, "/api/arena/join", "{}").andExpect(status().isOk());
        postJson(player, "/api/arena/leave", "{}").andExpect(status().isOk());

        played(player, 1, LocalDateTime.now());

        getAs(player, "/api/subscription").andExpect(jsonPath("$.arena.remaining").value(0));
        postJson(player, "/api/arena/join", "{}").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("SUBSCRIPTION_REQUIRED"))
                .andExpect(jsonPath("$.message").value(containsString("limit 5 walk")));

        subscribe(player);
        postJson(player, "/api/arena/join", "{}").andExpect(status().isOk());
        postJson(player, "/api/arena/leave", "{}").andExpect(status().isOk());
    }

    @Test
    void staffHasNoArenaLimit() throws Exception {
        var admin = account(Role.ADMIN);
        played(admin, 5, LocalDateTime.now());
        getAs(admin, "/api/subscription").andExpect(jsonPath("$.staff").value(true)).andExpect(jsonPath("$.arena.remaining").value(nullValue()));
        postJson(admin, "/api/arena/join", "{}").andExpect(status().isOk());
        postJson(admin, "/api/arena/leave", "{}").andExpect(status().isOk());
    }


    @Test
    void aBlockedChallengeLeavesTheTargetANoteThatTheyCanClose() throws Exception {
        var challenger = account(Role.USER);
        var target = account(Role.USER);
        played(target, 5, LocalDateTime.now());

        postJson(challenger, "/api/arena/challenge/create", "{\"targetUsername\":\"" + target.username() + "\"}").andExpect(status().isForbidden());
        postJson(challenger, "/api/arena/challenge/create", "{\"targetUsername\":\"" + target.username() + "\"}").andExpect(status().isForbidden());

        String state = getAs(target, "/api/realtime/state").andExpect(status().isOk())
                .andExpect(jsonPath("$.missedChallenges.length()").value(1))
                .andExpect(jsonPath("$.missedChallenges[0].challengerUsername").value(challenger.username()))
                .andExpect(jsonPath("$.missedChallenges[0].status").value("MISSED"))
                .andReturn().getResponse().getContentAsString();
        getAs(challenger, "/api/realtime/state").andExpect(jsonPath("$.missedChallenges.length()").value(0))
                .andExpect(jsonPath("$.rejectedChallenges.length()").value(0));
        String id = JsonPath.read(state, "$.missedChallenges[0].id");

        postJson(challenger, "/api/arena/challenge/" + id + "/dismiss", "{}").andExpect(status().isOk());
        getAs(target, "/api/realtime/state").andExpect(jsonPath("$.missedChallenges.length()").value(1));
        postJson(target, "/api/arena/challenge/" + id + "/dismiss", "{}").andExpect(status().isOk());
        getAs(target, "/api/realtime/state").andExpect(jsonPath("$.missedChallenges.length()").value(0));
    }

    @Test
    void friendsWithoutGamesLeftAreListedForTheArena() throws Exception {
        var player = account(Role.USER);
        var tired = account(Role.USER);
        var fresh = account(Role.USER);
        var premium = account(Role.USER);
        var stranger = account(Role.USER);
        for (var friend : java.util.List.of(tired, fresh, premium)) {
            jdbcTemplate.update("INSERT INTO friendships (requester_id, receiver_id, status, requester_wins, receiver_wins, created_at) VALUES (?, ?, 'ACCEPTED', 0, 0, now())",
                    player.id(), friend.id());
        }
        played(tired, 5, LocalDateTime.now());
        played(fresh, 4, LocalDateTime.now());
        played(premium, 6, LocalDateTime.now());
        played(stranger, 5, LocalDateTime.now());
        jdbcTemplate.update("INSERT INTO subscriptions (user_id, active_until) VALUES (?, now() + interval '5 days')", premium.id());

        getAs(player, "/api/subscription/friends/out-of-games").andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0]").value(tired.id()));
    }
    @Test
    void challengesRespectTheLimitOfBothPlayers() throws Exception {
        var challenger = account(Role.USER);
        var target = account(Role.USER);
        played(target, 5, LocalDateTime.now());
        postJson(challenger, "/api/arena/challenge/create", "{\"targetUsername\":\"" + target.username() + "\"}").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("SUBSCRIPTION_REQUIRED"))
                .andExpect(jsonPath("$.message").value(target.username() + " nie ma już dziś wolnych walk."));
        postJson(target, "/api/arena/challenge/create", "{\"targetUsername\":\"" + challenger.username() + "\"}").andExpect(status().isForbidden());

        jdbcTemplate.update("DELETE FROM arena_matches WHERE user_id = ?", target.id());
        postJson(challenger, "/api/arena/challenge/create", "{\"targetUsername\":\"" + target.username() + "\"}").andExpect(status().isOk());
        String challenges = getAs(target, "/api/arena/challenges").andReturn().getResponse().getContentAsString();
        String challengeId = JsonPath.read(challenges, "$[0].id");

        played(challenger, 5, LocalDateTime.now());
        postJson(target, "/api/arena/challenge/" + challengeId + "/accept", "{}").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(challenger.username() + " nie ma już dziś wolnych walk."));

        played(target, 5, LocalDateTime.now());
        postJson(target, "/api/arena/challenge/" + challengeId + "/accept", "{}").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(containsString("limit 5 walk")));
        postJson(challenger, "/api/arena/challenge/" + challengeId + "/cancel", "{}").andExpect(status().isOk());
    }

    @Test
    void freePlayersOpenOnlyTheFirstChapterOfAPath() throws Exception {
        var admin = account(Role.ADMIN);
        var player = account(Role.USER);
        long first = createRoom(admin, uniqueTitle("Pierwszy"), "PATH");
        long second = createRoom(admin, uniqueTitle("Drugi"), "PATH");
        addFlagTask(first, "flag");
        addFlagTask(second, "flag");
        long path = publishInPath(first);
        long chapter = jdbcTemplate.queryForObject("""
                INSERT INTO path_chapters (path_id, title, sort_order, created_at, updated_at) VALUES (?, 'Dalej', 1, now(), now()) RETURNING id
                """, Long.class, path);
        jdbcTemplate.update("INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) VALUES (?, ?, 0)", second, chapter);
        joinPathsOf(player, first);

        getAs(player, "/api/paths/" + path).andExpect(status().isOk())
                .andExpect(jsonPath("$.chapters[0].premium").value(false))
                .andExpect(jsonPath("$.chapters[0].rooms[0].locked").value(false))
                .andExpect(jsonPath("$.chapters[1].premium").value(true))
                .andExpect(jsonPath("$.chapters[1].locked").value(true))
                .andExpect(jsonPath("$.chapters[1].rooms[0].premium").value(true))
                .andExpect(jsonPath("$.chapters[1].rooms[0].locked").value(true));
        getAs(player, "/api/rooms/" + first).andExpect(status().isOk());
        getAs(player, "/api/rooms/" + second).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("SUBSCRIPTION_REQUIRED"));
        solveRoom(player, second, "flag").andExpect(status().isForbidden());

        subscribe(player);

        getAs(player, "/api/paths/" + path).andExpect(jsonPath("$.chapters[1].premium").value(false))
                .andExpect(jsonPath("$.chapters[1].rooms[0].locked").value(false));
        getAs(player, "/api/rooms/" + second).andExpect(status().isOk());
        solveRoom(player, second, "flag").andExpect(status().isOk());

        jdbcTemplate.update("UPDATE subscriptions SET active_until = now() - interval '1 day' WHERE user_id = ?", player.id());

        getAs(player, "/api/rooms/" + second).andExpect(status().isOk());
        getAs(player, "/api/paths/" + path).andExpect(jsonPath("$.chapters[1].premium").value(false))
                .andExpect(jsonPath("$.chapters[1].rooms[0].locked").value(false));
        getAs(player, "/api/paths/" + path + "/rooms-mini?limit=0").andExpect(status().isOk())
                .andExpect(jsonPath("$.rooms[1].locked").value(false));
    }

    @Test
    void aRoomInTheFirstChapterOfAnotherJoinedPathIsFreeEverywhere() throws Exception {
        var admin = account(Role.ADMIN);
        var player = account(Role.USER);
        long intro = createRoom(admin, uniqueTitle("Wstęp"), "PATH");
        long shared = createRoom(admin, uniqueTitle("Wspólny"), "PATH");
        long locked = createRoom(admin, uniqueTitle("Zamknięty"), "PATH");
        publishInPath(shared);
        long second = publishInPath(intro);
        long chapter = jdbcTemplate.queryForObject("""
                INSERT INTO path_chapters (path_id, title, sort_order, created_at, updated_at) VALUES (?, 'Dalej', 1, now(), now()) RETURNING id
                """, Long.class, second);
        jdbcTemplate.update("INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) VALUES (?, ?, 0), (?, ?, 1)", shared, chapter, locked, chapter);
        joinPathsOf(player, shared, intro);

        getAs(player, "/api/paths/" + second).andExpect(jsonPath("$.chapters[1].premium").value(true))
                .andExpect(jsonPath("$.chapters[1].locked").value(false))
                .andExpect(jsonPath("$.chapters[1].rooms[0].locked").value(false))
                .andExpect(jsonPath("$.chapters[1].rooms[1].premium").value(true));
        getAs(player, "/api/rooms/" + shared).andExpect(status().isOk());
        getAs(player, "/api/rooms/" + locked).andExpect(status().isForbidden());
    }
}
