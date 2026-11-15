package com.hackademy.server.shop;

import com.hackademy.server.shop.dto.TopUpDto;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class TopUpService {

    public static final String OFF = "off";
    public static final String TEST = "test";
    public static final String LIVE = "live";

    private final JdbcTemplate jdbc;
    private final WalletService wallet;
    private final ObjectProvider<PaymentProvider> providers;

    public String mode() {
        PaymentProvider provider = providers.getIfAvailable();
        return provider == null ? OFF : provider.test() ? TEST : LIVE;
    }

    @Transactional
    public TopUpDto create(long userId, String packageId) {
        CoinPackage pack = CoinPackage.fromId(packageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Wybierz pakiet Bajtów z listy."));
        PaymentProvider provider = provider();
        Long id = jdbc.queryForObject("""
                INSERT INTO top_up_orders (user_id, package_id, coins, price_minor, currency, provider)
                VALUES (?, ?, ?, ?, ?, ?) RETURNING id
                """, Long.class, userId, pack.id(), pack.coins(), pack.priceMinor(), CoinPackage.CURRENCY, provider.name());
        PaymentProvider.PaymentCheckout checkout = provider.start(id, userId, pack);
        jdbc.update("UPDATE top_up_orders SET provider_reference = ? WHERE id = ?", checkout.reference(), id);
        return new TopUpDto(id, pack.id(), pack.coins(), pack.priceMinor(), CoinPackage.CURRENCY, "PENDING", checkout.redirectUrl(), provider.test());
    }

    @Transactional
    public boolean markPaid(String providerName, String reference) {
        Paid paid = jdbc.query("""
                UPDATE top_up_orders SET status = 'PAID', paid_at = now()
                WHERE provider = ? AND provider_reference = ? AND status = 'PENDING' AND user_id IS NOT NULL
                RETURNING id, user_id, coins
                """, rs -> rs.next() ? new Paid(rs.getLong("id"), (Long) rs.getObject("user_id"), rs.getInt("coins")) : null, providerName, reference);
        if (paid == null || paid.userId() == null) return false;
        wallet.credit(paid.userId(), paid.coins(), WalletTransactionKind.TOP_UP, paid.orderId(), null, null);
        return true;
    }

    @Transactional
    public void payTest(long userId, long orderId) {
        PaymentProvider provider = providers.getIfAvailable();
        if (provider == null || !provider.test()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Płatność testowa jest wyłączona.");
        String reference = jdbc.query("SELECT provider_reference FROM top_up_orders WHERE id = ? AND user_id = ? AND provider = ?",
                rs -> rs.next() ? rs.getString(1) : null, orderId, userId, provider.name());
        if (reference == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono zamówienia.");
        if (!markPaid(provider.name(), reference)) throw new ResponseStatusException(HttpStatus.CONFLICT, "To zamówienie nie czeka już na płatność.");
    }

    @Transactional
    public void cancel(long userId, long orderId) {
        int changed = jdbc.update("UPDATE top_up_orders SET status = 'CANCELLED' WHERE id = ? AND user_id = ? AND status = 'PENDING'", orderId, userId);
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono zamówienia, które czeka na płatność.");
    }

    private PaymentProvider provider() {
        PaymentProvider provider = providers.getIfAvailable();
        if (provider == null) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Doładowania Bajtów będą dostępne wkrótce.");
        return provider;
    }

    private record Paid(long orderId, Long userId, int coins) {}
}
