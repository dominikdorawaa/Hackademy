package com.hackademy.server.shop;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.function.BiPredicate;

@Component
@RequiredArgsConstructor
public class PaymentOrders {

    public static final String OFF = "off";
    public static final String TEST = "test";
    public static final String LIVE = "live";

    public enum Table {
        TOP_UP("top_up_orders", "top-up"),
        SUBSCRIPTION("subscription_orders", "subscription");

        private final String name;
        private final String kind;

        Table(String name, String kind) {
            this.name = name;
            this.kind = kind;
        }
    }

    public record Started(long id, String redirectUrl, boolean test) {}

    private final JdbcTemplate jdbc;
    private final ObjectProvider<PaymentProvider> providers;

    public String mode() {
        PaymentProvider provider = providers.getIfAvailable();
        return provider == null ? OFF : provider.test() ? TEST : LIVE;
    }

    public Started start(Table table, long userId, int priceMinor, String currency, String unavailable, String insertReturningId, Object... values) {
        PaymentProvider provider = providers.getIfAvailable();
        if (provider == null) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, unavailable);
        Object[] withProvider = new Object[values.length + 1];
        System.arraycopy(values, 0, withProvider, 0, values.length);
        withProvider[values.length] = provider.name();
        Long id = jdbc.queryForObject(insertReturningId, Long.class, withProvider);
        PaymentProvider.PaymentCheckout checkout = provider.start(new PaymentProvider.PaymentRequest(table.kind, id, userId, priceMinor, currency));
        jdbc.update("UPDATE " + table.name + " SET provider_reference = ? WHERE id = ?", checkout.reference(), id);
        return new Started(id, checkout.redirectUrl(), provider.test());
    }

    public <T> T markPaid(Table table, String provider, String reference, String returning, ResultSetExtractor<T> paid) {
        return jdbc.query("UPDATE " + table.name + " SET status = 'PAID', paid_at = now()"
                + " WHERE provider = ? AND provider_reference = ? AND status = 'PENDING' AND user_id IS NOT NULL"
                + " RETURNING " + returning, paid, provider, reference);
    }

    public void payTest(Table table, long userId, long orderId, BiPredicate<String, String> markPaid) {
        PaymentProvider provider = providers.getIfAvailable();
        if (provider == null || !provider.test()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Płatność testowa jest wyłączona.");
        String reference = jdbc.query("SELECT provider_reference FROM " + table.name + " WHERE id = ? AND user_id = ? AND provider = ?",
                rs -> rs.next() ? rs.getString(1) : null, orderId, userId, provider.name());
        if (reference == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono zamówienia.");
        if (!markPaid.test(provider.name(), reference)) throw new ResponseStatusException(HttpStatus.CONFLICT, "To zamówienie nie czeka już na płatność.");
    }

    public void cancel(Table table, long userId, long orderId) {
        int changed = jdbc.update("UPDATE " + table.name + " SET status = 'CANCELLED' WHERE id = ? AND user_id = ? AND status = 'PENDING'", orderId, userId);
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono zamówienia, które czeka na płatność.");
    }
}
