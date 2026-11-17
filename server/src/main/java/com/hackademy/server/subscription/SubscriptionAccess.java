package com.hackademy.server.subscription;

import com.hackademy.server.arena.ArenaMatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class SubscriptionAccess {

    public static final int FREE_ARENA_GAMES = 5;
    public static final ZoneId DAY_ZONE = ZoneId.of("Europe/Warsaw");

    private final SubscriptionRepository subscriptions;
    private final ArenaMatchRepository matches;
    private final Clock clock;

    @Transactional(readOnly = true)
    public boolean unlimited(Long userId) {
        return userId != null && subscriptions.unlimited(userId, LocalDateTime.now(clock));
    }

    @Transactional(readOnly = true)
    public boolean subscribed(Long userId) {
        return userId != null && subscriptions.existsByUserIdAndActiveUntilAfter(userId, LocalDateTime.now(clock));
    }

    @Transactional(readOnly = true)
    public Set<Long> subscribedAmong(Collection<Long> userIds) {
        if (userIds.isEmpty()) return Set.of();
        return new HashSet<>(subscriptions.findActiveUserIds(userIds, LocalDateTime.now(clock)));
    }

    @Transactional(readOnly = true)
    public int arenaGamesToday(long userId) {
        return (int) matches.countByUserIdAndFinishedAtGreaterThanEqual(userId, startOfDay());
    }

    public void requireArenaGame(long userId) {
        if (!canPlay(userId)) {
            throw new SubscriptionRequiredException("Dzisiejszy limit " + FREE_ARENA_GAMES
                    + " walk jest wykorzystany. Kolejne walki będą dostępne po północy, a z Premium walczysz bez limitu.");
        }
    }

    public void requireOpponentArenaGame(Long opponentId, String opponentName) {
        if (opponentId != null && opponentId > 0 && !canPlay(opponentId)) {
            throw new SubscriptionRequiredException(opponentLimit(opponentName));
        }
    }

    public static String opponentLimit(String opponentName) {
        return opponentName + " nie ma już dziś wolnych walk.";
    }

    @Transactional(readOnly = true)
    public Set<Long> outOfGames(Collection<Long> userIds) {
        if (userIds.isEmpty()) return Set.of();
        Set<Long> out = new HashSet<>(matches.findUsersWithGamesSince(userIds, startOfDay(), FREE_ARENA_GAMES));
        if (!out.isEmpty()) subscriptions.findUnlimitedAmong(out, LocalDateTime.now(clock)).forEach(out::remove);
        return out;
    }

    private LocalDateTime startOfDay() {
        return ZonedDateTime.now(clock.withZone(DAY_ZONE)).truncatedTo(ChronoUnit.DAYS)
                .withZoneSameInstant(clock.getZone()).toLocalDateTime();
    }

    private boolean canPlay(long userId) {
        return unlimited(userId) || arenaGamesToday(userId) < FREE_ARENA_GAMES;
    }
}
