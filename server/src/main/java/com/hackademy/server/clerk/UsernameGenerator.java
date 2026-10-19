package com.hackademy.server.clerk;

import com.hackademy.server.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.random.RandomGenerator;

@Component
public class UsernameGenerator {

    static final String PREFIX = "gracz";
    static final int ATTEMPTS = 50;

    private final UserRepository userRepository;
    private final RandomGenerator random;

    @Autowired
    public UsernameGenerator(UserRepository userRepository) {
        this(userRepository, new SecureRandom());
    }

    UsernameGenerator(UserRepository userRepository, RandomGenerator random) {
        this.userRepository = userRepository;
        this.random = random;
    }

    public String generate() {
        for (int attempt = 0; attempt < ATTEMPTS; attempt++) {
            String candidate = PREFIX + (100000 + random.nextInt(900000));
            if (userRepository.findByUsernameIgnoringCase(candidate).isEmpty()) {
                return candidate;
            }
        }
        throw new IllegalStateException("Could not find a free username");
    }
}
