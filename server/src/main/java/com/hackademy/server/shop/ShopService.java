package com.hackademy.server.shop;

import com.hackademy.server.shop.dto.ShopDto;
import com.hackademy.server.shop.dto.WalletAdminDto;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.exception.UserNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ShopService {

    static final int ADMIN_HISTORY = 30;

    private final WalletService wallet;
    private final TopUpService topUps;
    private final UserRepository users;

    @Transactional(readOnly = true)
    public ShopDto shop(long userId) {
        Set<String> owned = wallet.ownedItemIds(userId);
        return new ShopDto(wallet.balance(userId),
                Arrays.stream(ShopItem.values()).map(item -> new ShopDto.Item(item.id(), item.category(), item.reference(), item.price(), owned.contains(item.id()))).toList(),
                Arrays.stream(CoinPackage.values()).map(pack -> new ShopDto.Pack(pack.id(), pack.coins(), pack.priceMinor(), CoinPackage.CURRENCY)).toList(),
                topUps.mode());
    }

    @Transactional
    public ShopDto buy(long userId, String itemId) {
        ShopItem item = ShopItem.fromId(itemId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie ma takiego przedmiotu w sklepie."));
        wallet.purchase(userId, item);
        return shop(userId);
    }

    @Transactional(readOnly = true)
    public WalletAdminDto adminWallet(long userId) {
        var user = users.findById(userId).orElseThrow(() -> new UserNotFoundException("Nie znaleziono użytkownika."));
        return new WalletAdminDto(userId, user.getUsername(), wallet.balance(userId), wallet.history(userId, ADMIN_HISTORY));
    }

    @Transactional
    public WalletAdminDto adjust(long userId, long amount, String reason, long adminId) {
        if (!users.existsById(userId)) throw new UserNotFoundException("Nie znaleziono użytkownika.");
        if (amount == 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Podaj liczbę Bajtów różną od zera.");
        wallet.credit(userId, amount, WalletTransactionKind.ADMIN, null, adminId, reason.trim());
        return adminWallet(userId);
    }
}
