package com.hackademy.server.user;

import com.hackademy.server.user.dto.OnboardingDto;
import com.hackademy.server.user.dto.TourRequest;
import com.hackademy.server.user.dto.UserAvatarDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/user/me/onboarding")
@RequiredArgsConstructor
public class OnboardingController {
    private final OnboardingService onboarding;

    @GetMapping
    public OnboardingDto get(@AuthenticationPrincipal User user) {
        return onboarding.get(user.getId());
    }

    @PostMapping("/avatar")
    public OnboardingDto confirmAvatar(@AuthenticationPrincipal User user, @Valid @RequestBody UserAvatarDto avatar) {
        return onboarding.confirmAvatar(user.getId(), avatar);
    }

    @PostMapping("/tour")
    public OnboardingDto finishTour(@AuthenticationPrincipal User user, @Valid @RequestBody TourRequest request) {
        return onboarding.finishTour(user.getId(), request.status());
    }
}
