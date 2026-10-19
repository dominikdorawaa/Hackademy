package com.hackademy.server.user;

import com.hackademy.server.exception.UserNotFoundException;
import com.hackademy.server.user.dto.OnboardingDto;
import com.hackademy.server.user.dto.UserAvatarDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class OnboardingService {
    private final UserRepository userRepository;
    private final UserService userService;

    private User user(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new UserNotFoundException("User not found"));
    }

    private static OnboardingDto state(User user) {
        return new OnboardingDto(user.getAvatarConfirmedAt() != null, user.getTourStatus());
    }

    @Transactional(readOnly = true)
    public OnboardingDto get(Long userId) {
        return state(user(userId));
    }

    @Transactional
    public OnboardingDto confirmAvatar(Long userId, UserAvatarDto avatar) {
        userService.saveAvatar(userId, avatar);
        User user = user(userId);
        if (user.getAvatarConfirmedAt() == null) user.setAvatarConfirmedAt(LocalDateTime.now());
        return state(userRepository.saveAndFlush(user));
    }

    @Transactional
    public OnboardingDto finishTour(Long userId, TourStatus status) {
        if (status == TourStatus.PENDING) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Wybierz zakończenie albo pominięcie przewodnika.");
        User user = user(userId);
        if (user.getAvatarConfirmedAt() == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Najpierw zatwierdź swojego awatara.");
        if (user.getTourStatus() == TourStatus.PENDING) user.setTourStatus(status);
        return state(userRepository.saveAndFlush(user));
    }
}
