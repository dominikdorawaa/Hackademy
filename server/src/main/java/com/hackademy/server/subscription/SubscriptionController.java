package com.hackademy.server.subscription;

import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.subscription.dto.SubscriptionDto;
import com.hackademy.server.subscription.dto.SubscriptionOrderDto;
import com.hackademy.server.subscription.dto.SubscriptionOrderRequest;
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

import java.util.List;

@RestController
@RequestMapping("/api/subscription")
@RequiredArgsConstructor
public class SubscriptionController {

    private final SubscriptionService subscriptions;
    private final SubscriptionAccess access;
    private final FriendshipRepository friendships;

    private static User currentUser() {
        return (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    @GetMapping
    public SubscriptionDto status() {
        return subscriptions.status(currentUser());
    }

    @GetMapping("/friends/out-of-games")
    public List<Long> friendsOutOfGames() {
        return access.outOfGames(friendships.findAcceptedFriendIds(currentUser().getId())).stream().sorted().toList();
    }

    @PostMapping("/orders")
    @ResponseStatus(HttpStatus.CREATED)
    public SubscriptionOrderDto order(@Valid @RequestBody SubscriptionOrderRequest request) {
        return subscriptions.order(currentUser().getId(), request.planId());
    }

    @PostMapping("/orders/{orderId}/test-payment")
    public SubscriptionDto payTest(@PathVariable long orderId) {
        User user = currentUser();
        subscriptions.payTest(user.getId(), orderId);
        return subscriptions.status(user);
    }

    @PostMapping("/orders/{orderId}/cancel")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@PathVariable long orderId) {
        subscriptions.cancel(currentUser().getId(), orderId);
    }
}
