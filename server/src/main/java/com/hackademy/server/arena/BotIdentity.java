package com.hackademy.server.arena;

import com.hackademy.server.user.dto.UserAvatarDto;

import java.util.List;
import java.util.function.Predicate;
import java.util.random.RandomGenerator;
import java.util.stream.Stream;

public final class BotIdentity {
    static final int NAME_ATTEMPTS = 20;
    static final List<String> ADJECTIVES = List.of("Cichy", "Szybki", "Nocny", "Sprytny", "Bystry", "Dziki", "Ukryty",
            "Cyfrowy", "Binarny", "Zwinny", "Senny", "Lodowy", "Szary", "Zielony", "Czarny", "Mglisty");
    static final List<String> NOUNS = List.of("Lis", "Kod", "Bajt", "Wilk", "Kruk", "Haker", "Pingwin", "Szyfr", "Root",
            "Pakiet", "Sokol", "Serwer", "Skaner", "Token", "Bit", "Port");
    static final String DEFAULT_PREFIX = "gracz";

    private BotIdentity() {}

    static String username(RandomGenerator random, Predicate<String> taken) {
        for (int attempt = 0; attempt < NAME_ATTEMPTS; attempt++) {
            String candidate = candidate(random);
            if (!taken.test(candidate)) return candidate;
        }
        throw new IllegalStateException("Could not find a free bot name");
    }

    private static String candidate(RandomGenerator random) {
        String adjective = pick(ADJECTIVES, random);
        String noun = pick(NOUNS, random);
        return switch (random.nextInt(3)) {
            case 0 -> adjective + noun + random.nextInt(10, 100);
            case 1 -> adjective.toLowerCase() + "_" + noun.toLowerCase();
            default -> DEFAULT_PREFIX + random.nextInt(100000, 1000000);
        };
    }

    static UserAvatarDto avatar(RandomGenerator random) {
        return new UserAvatarDto(choice(UserAvatarDto.OUTFITS, random), choice(UserAvatarDto.HAIR_STYLES, random),
                choice(UserAvatarDto.HAT_STYLES, random), choice(UserAvatarDto.SKIN_TONES, random),
                choice(UserAvatarDto.HAIR_COLORS, random), choice(UserAvatarDto.CLOTH_COLORS, random),
                choice(UserAvatarDto.CLOTH_COLORS, random), choice(UserAvatarDto.CLOTH_COLORS, random),
                choice(UserAvatarDto.CLOTH_COLORS, random), UserAvatarDto.DEFAULT_POSE,
                choice(UserAvatarDto.FINISHERS, random), choice(UserAvatarDto.VICTORY_DANCES, random));
    }

    private static String choice(String pattern, RandomGenerator random) {
        return pick(Stream.of(pattern.split("\\|")).filter(option -> !option.equals(UserAvatarDto.CUSTOM_COLOR)).toList(), random);
    }

    private static String pick(List<String> options, RandomGenerator random) {
        return options.get(random.nextInt(options.size()));
    }
}
