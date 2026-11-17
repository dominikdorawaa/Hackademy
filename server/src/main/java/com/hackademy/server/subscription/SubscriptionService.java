package com.hackademy.server.subscription;

import com.hackademy.server.shop.PaymentOrders;
import com.hackademy.server.shop.WalletService;
import com.hackademy.server.shop.WalletTransactionKind;
import com.hackademy.server.subscription.dto.SubscriptionDto;
import com.hackademy.server.subscription.dto.SubscriptionOrderDto;
import com.hackademy.server.user.Role;
import com.hackademy.server.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Arrays;

@Service
@RequiredArgsConstructor
public class SubscriptionService {

    static final String REASON = "Subskrypcja Premium";

    private final JdbcTemplate jdbc;
    private final SubscriptionRepository subscriptions;
    private final SubscriptionAccess access;
    private final WalletService wallet;
    private final PaymentOrders orders;
    private final Clock clock;

    @Transactional(readOnly = true)
    public SubscriptionDto status(User user) {
        long userId = user.getId();
        LocalDateTime until = subscriptions.findById(userId).map(Subscription::getActiveUntil)
                .filter(value -> value.isAfter(LocalDateTime.now(clock))).orElse(null);
        boolean staff = user.getRole() != Role.USER;
        int played = access.arenaGamesToday(userId);
        SubscriptionPlan plan = SubscriptionPlan.MONTHLY;
        return new SubscriptionDto(until != null, staff, until,
                new SubscriptionDto.Plan(plan.id(), plan.days(), plan.coins(), plan.priceMinor(), SubscriptionPlan.CURRENCY),
                orders.mode(),
                new SubscriptionDto.Arena(SubscriptionAccess.FREE_ARENA_GAMES, played,
                        staff || until != null ? null : Math.max(0, SubscriptionAccess.FREE_ARENA_GAMES - played)));
    }

    @Transactional
    public SubscriptionOrderDto order(long userId, String planId) {
        SubscriptionPlan plan = Arrays.stream(SubscriptionPlan.values()).filter(candidate -> candidate.id().equals(planId)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Wybierz plan subskrypcji z listy."));
        PaymentOrders.Started started = orders.start(PaymentOrders.Table.SUBSCRIPTION, userId, plan.priceMinor(), SubscriptionPlan.CURRENCY,
                "Subskrypcję będzie można kupić wkrótce.", """
                INSERT INTO subscription_orders (user_id, plan_id, days, coins, price_minor, currency, provider)
                VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id
                """, userId, plan.id(), plan.days(), plan.coins(), plan.priceMinor(), SubscriptionPlan.CURRENCY);
        return new SubscriptionOrderDto(started.id(), plan.id(), plan.days(), plan.coins(), plan.priceMinor(), SubscriptionPlan.CURRENCY,
                "PENDING", started.redirectUrl(), started.test());
    }

    @Transactional
    public boolean markPaid(String providerName, String reference) {
        Paid paid = orders.markPaid(PaymentOrders.Table.SUBSCRIPTION, providerName, reference, "user_id, days, coins",
                rs -> rs.next() ? new Paid(rs.getLong("user_id"), rs.getInt("days"), rs.getInt("coins")) : null);
        if (paid == null) return false;
        LocalDateTime now = LocalDateTime.now(clock);
        jdbc.update("""
                INSERT INTO subscriptions (user_id, active_until, updated_at) VALUES (?, ?, ?)
                ON CONFLICT (user_id) DO UPDATE
                SET active_until = GREATEST(subscriptions.active_until, EXCLUDED.updated_at) + make_interval(days => ?),
                    updated_at = EXCLUDED.updated_at
                """, paid.userId(), now.plusDays(paid.days()), now, paid.days());
        if (paid.coins() > 0) wallet.creditUpTo(paid.userId(), paid.coins(), WalletTransactionKind.SUBSCRIPTION, REASON);
        return true;
    }

    @Transactional
    public void payTest(long userId, long orderId) {
        orders.payTest(PaymentOrders.Table.SUBSCRIPTION, userId, orderId, this::markPaid);
    }

    @Transactional
    public void cancel(long userId, long orderId) {
        orders.cancel(PaymentOrders.Table.SUBSCRIPTION, userId, orderId);
    }

    private record Paid(long userId, int days, int coins) {}
}
