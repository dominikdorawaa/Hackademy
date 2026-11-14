package com.hackademy.server.shop;

import com.hackademy.server.shop.dto.WalletTransactionDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class WalletService {

    public static final long MAX_BALANCE = 100_000_000L;
    private static final ResultSetExtractor<Long> FIRST_LONG = rs -> rs.next() ? rs.getLong(1) : null;

    private final JdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public long balance(long userId) {
        Long balance = jdbc.query("SELECT balance FROM wallets WHERE user_id = ?", FIRST_LONG, userId);
        return balance == null ? 0L : balance;
    }

    @Transactional(readOnly = true)
    public Set<String> ownedItemIds(long userId) {
        return new HashSet<>(jdbc.queryForList("SELECT item_id FROM owned_items WHERE user_id = ?", String.class, userId));
    }

    @Transactional(readOnly = true)
    public boolean owns(long userId, ShopItem item) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM owned_items WHERE user_id = ? AND item_id = ?)", Boolean.class, userId, item.id()));
    }

    @Transactional
    public long purchase(long userId, ShopItem item) {
        int added = jdbc.update("INSERT INTO owned_items (user_id, item_id) VALUES (?, ?) ON CONFLICT DO NOTHING", userId, item.id());
        if (added == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Masz już ten przedmiot.");
        Long after = jdbc.query("UPDATE wallets SET balance = balance - ?, updated_at = now() WHERE user_id = ? AND balance >= ? RETURNING balance",
                FIRST_LONG, item.price(), userId, item.price());
        if (after == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Masz za mało Bajtów na ten przedmiot.");
        record(userId, -item.price(), after, WalletTransactionKind.PURCHASE, item.id(), null, null, null);
        return after;
    }

    @Transactional
    public long credit(long userId, long amount, WalletTransactionKind kind, Long orderId, Long adminId, String reason) {
        if (amount == 0) throw new IllegalArgumentException("Kwota nie może być zerowa.");
        Long after = amount > 0
                ? jdbc.query("""
                        INSERT INTO wallets (user_id, balance) VALUES (?, ?)
                        ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + EXCLUDED.balance, updated_at = now()
                        WHERE wallets.balance + EXCLUDED.balance <= ?
                        RETURNING balance
                        """, FIRST_LONG, userId, amount, MAX_BALANCE)
                : jdbc.query("UPDATE wallets SET balance = balance + ?, updated_at = now() WHERE user_id = ? AND balance + ? >= 0 RETURNING balance",
                        FIRST_LONG, amount, userId, amount);
        if (after == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, amount > 0
                    ? "Saldo przekroczyłoby limit " + MAX_BALANCE + " Bajtów."
                    : "Saldo nie może spaść poniżej zera. Obecne saldo: " + balance(userId) + ".");
        }
        record(userId, amount, after, kind, null, orderId, adminId, reason);
        return after;
    }

    @Transactional(readOnly = true)
    public List<WalletTransactionDto> history(long userId, int limit) {
        return jdbc.query("""
                SELECT t.id, t.amount, t.balance_after, t.kind, t.item_id, t.order_id, t.reason, a.username AS admin_name, t.created_at
                FROM wallet_transactions t LEFT JOIN users a ON a.id = t.admin_id
                WHERE t.user_id = ? ORDER BY t.created_at DESC, t.id DESC LIMIT ?
                """, (rs, row) -> new WalletTransactionDto(rs.getLong("id"), rs.getLong("amount"), rs.getLong("balance_after"),
                WalletTransactionKind.valueOf(rs.getString("kind")), rs.getString("item_id"), (Long) rs.getObject("order_id"),
                rs.getString("reason"), rs.getString("admin_name"), rs.getTimestamp("created_at").toLocalDateTime()), userId, limit);
    }

    private void record(long userId, long amount, long after, WalletTransactionKind kind, String itemId, Long orderId, Long adminId, String reason) {
        jdbc.update("""
                INSERT INTO wallet_transactions (user_id, amount, balance_after, kind, item_id, order_id, admin_id, reason)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, userId, amount, after, kind.name(), itemId, orderId, adminId, reason);
    }
}
