package com.hackademy.server;

import com.hackademy.server.arena.ArenaService;
import com.hackademy.server.shop.TestPaymentProvider;
import com.hackademy.server.shop.TopUpService;
import com.hackademy.server.user.Role;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

import java.util.concurrent.Callable;
import java.util.concurrent.Executors;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@TestPropertySource(properties = "application.shop.test-payments=true")
class ShopIntegrationTest extends PostgresIntegrationTest {

    @Autowired
    private TopUpService topUps;

    @Autowired
    private ArenaService arena;

    private long balance(Account account) {
        Long balance = jdbcTemplate.query("SELECT balance FROM wallets WHERE user_id = ?", rs -> rs.next() ? rs.getLong(1) : 0L, account.id());
        return balance == null ? 0 : balance;
    }

    private long topUp(Account account, String pack) throws Exception {
        var body = postJson(account, "/api/shop/top-ups", "{\"packageId\":\"" + pack + "\"}").andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING")).andExpect(jsonPath("$.test").value(true))
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    private void give(Account admin, Account player, long amount) throws Exception {
        postJson(admin, "/api/admin/users/" + player.id() + "/wallet", "{\"amount\":" + amount + ",\"reason\":\"Test\"}").andExpect(status().isOk());
    }

    @Test
    void listsTheCatalogWithAnEmptyWalletForNewPlayers() throws Exception {
        var player = account(Role.USER);
        getAs(player, "/api/shop").andExpect(status().isOk())
                .andExpect(jsonPath("$.balance").value(0))
                .andExpect(jsonPath("$.topUps").value("test"))
                .andExpect(jsonPath("$.items[?(@.id == 'dance-scuba')].price").value(400))
                .andExpect(jsonPath("$.items[?(@.id == 'dance-scuba')].category").value("DANCE"))
                .andExpect(jsonPath("$.items[?(@.id == 'chat-wp')].reference").value("wp"))
                .andExpect(jsonPath("$.items[?(@.owned == true)]", hasSize(0)))
                .andExpect(jsonPath("$.packages", hasSize(3)))
                .andExpect(jsonPath("$.packages[0].currency").value("PLN"));
    }

    @Test
    void buysAnItemOnceAndOnlyWithEnoughBytes() throws Exception {
        var player = account(Role.USER);
        var admin = account(Role.ADMIN);
        postJson(player, "/api/shop/items/dance-scuba/purchase", "{}").andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Masz za mało Bajtów na ten przedmiot."));
        give(admin, player, 399);
        postJson(player, "/api/shop/items/dance-scuba/purchase", "{}").andExpect(status().isConflict());
        give(admin, player, 1);
        postJson(player, "/api/shop/items/dance-scuba/purchase", "{}").andExpect(status().isOk())
                .andExpect(jsonPath("$.balance").value(0))
                .andExpect(jsonPath("$.items[?(@.id == 'dance-scuba')].owned").value(true));
        give(admin, player, 1000);
        postJson(player, "/api/shop/items/dance-scuba/purchase", "{}").andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Masz już ten przedmiot."));
        postJson(player, "/api/shop/items/hat-crown/purchase", "{}").andExpect(status().isNotFound());
        assertEquals(1000, balance(player));
        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM wallet_transactions WHERE user_id = ? AND kind = 'PURCHASE' AND amount = -400 AND item_id = 'dance-scuba'", Integer.class, player.id()));
    }

    @Test
    void spendsTheLastBytesOnlyOnceWhenPurchasesRace() throws Exception {
        var player = account(Role.USER);
        var admin = account(Role.ADMIN);
        give(admin, player, 150);
        Callable<Integer> wp = () -> postJson(player, "/api/shop/items/chat-wp/purchase", "{}").andReturn().getResponse().getStatus();
        Callable<Integer> nt = () -> postJson(player, "/api/shop/items/chat-nt/purchase", "{}").andReturn().getResponse().getStatus();
        var pool = Executors.newFixedThreadPool(2);
        try {
            var first = pool.submit(wp);
            var second = pool.submit(nt);
            assertEquals(1, (first.get() == 200 ? 1 : 0) + (second.get() == 200 ? 1 : 0));
        } finally {
            pool.shutdownNow();
        }
        assertEquals(0, balance(player));
        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM owned_items WHERE user_id = ?", Integer.class, player.id()));
    }

    @Test
    void creditsATestTopUpOnceAndLetsPlayersCancelPendingOnes() throws Exception {
        var player = account(Role.USER);
        var stranger = account(Role.USER);
        postJson(player, "/api/shop/top-ups", "{\"packageId\":\"huge\"}").andExpect(status().isBadRequest());
        postJson(player, "/api/shop/top-ups", "{}").andExpect(status().isBadRequest());

        long order = topUp(player, "medium");
        postJson(stranger, "/api/shop/top-ups/" + order + "/test-payment", "{}").andExpect(status().isNotFound());
        postJson(player, "/api/shop/top-ups/" + order + "/test-payment", "{}").andExpect(status().isOk())
                .andExpect(jsonPath("$.balance").value(1200));
        postJson(player, "/api/shop/top-ups/" + order + "/test-payment", "{}").andExpect(status().isConflict());
        String reference = jdbcTemplate.queryForObject("SELECT provider_reference FROM top_up_orders WHERE id = ?", String.class, order);
        assertFalse(topUps.markPaid(TestPaymentProvider.NAME, reference));
        assertEquals(1200, balance(player));
        assertEquals("PAID", jdbcTemplate.queryForObject("SELECT status FROM top_up_orders WHERE id = ?", String.class, order));
        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM wallet_transactions WHERE order_id = ? AND kind = 'TOP_UP' AND amount = 1200", Integer.class, order));

        long cancelled = topUp(player, "small");
        postJson(stranger, "/api/shop/top-ups/" + cancelled + "/cancel", "{}").andExpect(status().isNotFound());
        postJson(player, "/api/shop/top-ups/" + cancelled + "/cancel", "{}").andExpect(status().isNoContent());
        postJson(player, "/api/shop/top-ups/" + cancelled + "/cancel", "{}").andExpect(status().isNotFound());
        postJson(player, "/api/shop/top-ups/" + cancelled + "/test-payment", "{}").andExpect(status().isConflict());
        assertEquals(1200, balance(player));
    }

    @Test
    void adminsAdjustWalletsWithAReasonAndSeeTheHistory() throws Exception {
        var player = account(Role.USER);
        var admin = account(Role.ADMIN);
        var expert = account(Role.EXPERT);
        String url = "/api/admin/users/" + player.id() + "/wallet";

        getAs(player, url).andExpect(status().isForbidden());
        getAs(expert, url).andExpect(status().isForbidden());
        postJson(expert, url, "{\"amount\":100,\"reason\":\"Nagroda\"}").andExpect(status().isForbidden());
        postJson(admin, url, "{\"amount\":100}").andExpect(status().isBadRequest());
        postJson(admin, url, "{\"amount\":100,\"reason\":\"   \"}").andExpect(status().isBadRequest());
        postJson(admin, url, "{\"amount\":0,\"reason\":\"Nic\"}").andExpect(status().isBadRequest());
        postJson(admin, url, "{\"amount\":1000001,\"reason\":\"Za dużo\"}").andExpect(status().isBadRequest());
        postJson(admin, "/api/admin/users/999999999/wallet", "{\"amount\":5,\"reason\":\"Nikt\"}").andExpect(status().isNotFound());
        getAs(admin, "/api/admin/users/999999999/wallet").andExpect(status().isNotFound());

        postJson(admin, url, "{\"amount\":250,\"reason\":\" Nagroda za turniej \"}").andExpect(status().isOk())
                .andExpect(jsonPath("$.balance").value(250))
                .andExpect(jsonPath("$.username").value(player.username()))
                .andExpect(jsonPath("$.transactions[0].reason").value("Nagroda za turniej"))
                .andExpect(jsonPath("$.transactions[0].adminUsername").value(admin.username()))
                .andExpect(jsonPath("$.transactions[0].kind").value("ADMIN"));
        postJson(admin, url, "{\"amount\":-300,\"reason\":\"Korekta\"}").andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Saldo nie może spaść poniżej zera. Obecne saldo: 250."));
        postJson(admin, url, "{\"amount\":-50,\"reason\":\"Korekta\"}").andExpect(status().isOk())
                .andExpect(jsonPath("$.balance").value(200))
                .andExpect(jsonPath("$.transactions", hasSize(2)))
                .andExpect(jsonPath("$.transactions[0].amount").value(-50))
                .andExpect(jsonPath("$.transactions[0].balanceAfter").value(200));
        getAs(admin, url).andExpect(status().isOk()).andExpect(jsonPath("$.balance").value(200));
        getAs(player, "/api/shop").andExpect(jsonPath("$.balance").value(200));
    }

    @Test
    void lockedReactionsNeedTheItemFromTheShop() throws Exception {
        var first = account(Role.USER);
        var second = account(Role.USER);
        var admin = account(Role.ADMIN);
        var challenge = arena.createChallenge(first.id(), first.username(), second.id(), second.username());
        String url = "/api/arena/game/" + arena.acceptChallenge(challenge.getId(), second.id()).getId() + "/reaction";

        postJson(first, url, "{\"reaction\":\"scuba\"}").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Tę reakcję kupisz w sklepie."));
        postJson(first, url, "{\"reaction\":\"wp\"}").andExpect(status().isForbidden());
        give(admin, first, 150);
        postJson(first, "/api/shop/items/chat-wp/purchase", "{}").andExpect(status().isOk());
        postJson(first, url, "{\"reaction\":\"wp\"}").andExpect(status().isOk());
    }
}
