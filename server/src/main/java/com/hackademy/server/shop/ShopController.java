package com.hackademy.server.shop;

import com.hackademy.server.shop.dto.ShopDto;
import com.hackademy.server.shop.dto.TopUpDto;
import com.hackademy.server.shop.dto.TopUpRequest;
import com.hackademy.server.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/shop")
@RequiredArgsConstructor
public class ShopController {

    private final ShopService shop;
    private final TopUpService topUps;

    private static long currentUserId() {
        return ((User) SecurityContextHolder.getContext().getAuthentication().getPrincipal()).getId();
    }

    @GetMapping
    public ShopDto shop() {
        return shop.shop(currentUserId());
    }

    @PostMapping("/items/{itemId}/purchase")
    public ShopDto buy(@PathVariable String itemId) {
        return shop.buy(currentUserId(), itemId);
    }

    @PostMapping("/top-ups")
    @ResponseStatus(HttpStatus.CREATED)
    public TopUpDto topUp(@Valid @RequestBody TopUpRequest request) {
        return topUps.create(currentUserId(), request.packageId());
    }

    @PostMapping("/top-ups/{orderId}/test-payment")
    public ShopDto payTest(@PathVariable long orderId) {
        long userId = currentUserId();
        topUps.payTest(userId, orderId);
        return shop.shop(userId);
    }

    @PostMapping("/top-ups/{orderId}/cancel")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@PathVariable long orderId) {
        topUps.cancel(currentUserId(), orderId);
    }
}
