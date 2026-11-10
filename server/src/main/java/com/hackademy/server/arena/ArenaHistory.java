package com.hackademy.server.arena;

import com.hackademy.server.user.UserRepository;
import com.hackademy.server.user.UserServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

@Component
@RequiredArgsConstructor
public class ArenaHistory {
    private final ArenaMatchRepository matches;
    private final UserRepository users;
    private final UserServiceImpl userService;

    ArenaIntroCard card(Long userId) {
        Map<String, Integer> totals = new HashMap<>();
        for (Object[] row : matches.countResults(userId)) totals.put((String) row[0], ((Number) row[1]).intValue());
        int games = totals.values().stream().mapToInt(Integer::intValue).sum();
        List<String> recent = matches.findTop5ByUserIdOrderByIdDesc(userId).stream().map(ArenaMatch::getResult).toList();
        Integer rank = userService.getUserRank(userId).rankElo();
        return new ArenaIntroCard(games, totals.getOrDefault("WIN", 0), totals.getOrDefault("LOSS", 0),
                (int) matches.currentStreak(userId), recent, rank == null ? 0 : rank);
    }

    ArenaIntroCard botCard(String username, int elo) {
        Random random = new Random(username.hashCode() * 31L);
        int games = 12 + random.nextInt(260);
        double rate = 0.35 + random.nextDouble() * 0.3;
        int wins = (int) Math.round(games * rate);
        List<String> recent = new ArrayList<>();
        for (int index = 0; index < Math.min(ArenaIntroCard.RECENT, games); index++) recent.add(random.nextDouble() < rate ? "WIN" : "LOSS");
        return new ArenaIntroCard(games, wins, games - wins, ArenaIntroCard.streakOf(recent), List.copyOf(recent), users.countByEloGreaterThan(elo) + 1);
    }

    void record(GameSession session) {
        if ("CANCELLED".equals(session.getFinishReason()) || "ABANDONED".equals(session.getFinishReason())) return;
        LocalDateTime now = LocalDateTime.now();
        List<ArenaMatch> results = new ArrayList<>();
        for (Long person : session.people()) {
            ArenaMatch match = new ArenaMatch();
            match.setUserId(person);
            match.setGameId(session.getId());
            match.setOpponentName(person.equals(session.getPlayer1Id()) ? session.getPlayer2Username() : session.getPlayer1Username());
            match.setResult(session.getWinnerId() == null ? "DRAW" : session.getWinnerId().equals(person) ? "WIN" : "LOSS");
            Integer change = person.equals(session.getPlayer1Id()) ? session.getPlayer1EloChange() : session.getPlayer2EloChange();
            match.setEloChange(change == null ? 0 : change);
            match.setFinishedAt(now);
            results.add(match);
        }
        matches.saveAll(results);
    }
}
