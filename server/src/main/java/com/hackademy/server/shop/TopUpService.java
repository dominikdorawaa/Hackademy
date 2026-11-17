package com.hackademy.server.shop;

import com.hackademy.server.shop.dto.TopUpDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class TopUpService {

    private final PaymentOrders orders;
    private final WalletService wallet;

    public String mode() {
        return orders.mode();
    }

    @Transactional
    public TopUpDto create(long userId, String packageId) {
        CoinPackage pack = CoinPackage.fromId(packageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Wybierz pakiet Bajtów z listy."));
        PaymentOrders.Started started = orders.start(PaymentOrders.Table.TOP_UP, userId, pack.priceMinor(), CoinPackage.CURRENCY,
                "Doładowania Bajtów będą dostępne wkrótce.", """
                INSERT INTO top_up_orders (user_id, package_id, coins, price_minor, currency, provider)
                VALUES (?, ?, ?, ?, ?, ?) RETURNING id
                """, userId, pack.id(), pack.coins(), pack.priceMinor(), CoinPackage.CURRENCY);
        return new TopUpDto(started.id(), pack.id(), pack.coins(), pack.priceMinor(), CoinPackage.CURRENCY, "PENDING", started.redirectUrl(), started.test());
    }

    @Transactional
    public boolean markPaid(String providerName, String reference) {
        Paid paid = orders.markPaid(PaymentOrders.Table.TOP_UP, providerName, reference, "id, user_id, coins",
                rs -> rs.next() ? new Paid(rs.getLong("id"), rs.getLong("user_id"), rs.getInt("coins")) : null);
        if (paid == null) return false;
        wallet.credit(paid.userId(), paid.coins(), WalletTransactionKind.TOP_UP, paid.orderId(), null, null);
        return true;
    }

    @Transactional
    public void payTest(long userId, long orderId) {
        orders.payTest(PaymentOrders.Table.TOP_UP, userId, orderId, this::markPaid);
    }

    @Transactional
    public void cancel(long userId, long orderId) {
        orders.cancel(PaymentOrders.Table.TOP_UP, userId, orderId);
    }

    private record Paid(long orderId, long userId, int coins) {}
}
