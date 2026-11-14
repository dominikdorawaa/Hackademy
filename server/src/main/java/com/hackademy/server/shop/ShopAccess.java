package com.hackademy.server.shop;

import com.hackademy.server.user.dto.UserAvatarDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

@Component
@RequiredArgsConstructor
public class ShopAccess {

    private final WalletService wallet;

    public void requireAvatarItems(long userId, UserAvatarDto avatar) {
        if (locked(userId, avatar.victoryDance() == null ? Optional.empty() : ShopItem.find(ShopCategory.DANCE, avatar.victoryDance()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ten taniec kupisz w Sklepie.");
        }
        if (locked(userId, avatar.outfit() == null ? Optional.empty() : ShopItem.find(ShopCategory.OUTFIT, avatar.outfit()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ten strój kupisz w Sklepie.");
        }
    }

    public boolean reactionLocked(long userId, String reaction) {
        return reaction != null && locked(userId, ShopItem.forReaction(reaction));
    }

    private boolean locked(long userId, Optional<ShopItem> item) {
        return item.isPresent() && !wallet.owns(userId, item.get());
    }
}
