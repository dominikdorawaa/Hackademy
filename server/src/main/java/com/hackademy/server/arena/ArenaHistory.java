package com.hackademy.server.arena;

import com.hackademy.server.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@Component
@RequiredArgsConstructor
public class ArenaHistory {
    private final ArenaMatchRepository matches;
    private final UserRepository users;

    ArenaIntroCard card(Long userId, int elo) {
        List<String> latest = matches.findTop10ByUserIdOrderByFinishedAtDescIdDesc(userId).stream().map(ArenaMatch::getResult).toList();
        int games = (int) matches.countByUserId(userId);
        int wins = (int) matches.countByUserIdAndResult(userId, "WIN");
        int losses = (int) matches.countByUserIdAndResult(userId, "LOSS");
        return new ArenaIntroCard(games, wins, losses, ArenaIntroCard.streakOf(latest),
                latest.subList(0, Math.min(ArenaIntroCard.RECENT, latest.size())), rank(elo));
    }

    ArenaIntroCard botCard(String username, int elo) {
        Random random = new Random(username.hashCode() * 31L + elo);
        int games = 12 + random.nextInt(260);
        double rate = Math.max(0.25, Math.min(0.75, 0.3 + elo / 2_800.0 + (random.nextDouble() - 0.5) * 0.1));
        int wins = (int) Math.round(games * rate);
        List<String> recent = new ArrayList<>();
        for (int index = 0; index < Math.min(ArenaIntroCard.RECENT, games); index++) recent.add(random.nextDouble() < rate ? "WIN" : "LOSS");
        return new ArenaIntroCard(games, wins, games - wins, ArenaIntroCard.streakOf(recent), List.copyOf(recent), rank(elo));
    }

    void record(GameSession session) {
        if ("CANCELLED".equals(session.getFinishReason()) || "ABANDONED".equals(session.getFinishReason())) return;
        LocalDateTime now = LocalDateTime.now();
        for (Long person : session.people()) {
            ArenaMatch match = new ArenaMatch();
            match.setUserId(person);
            match.setGameId(session.getId());
            match.setOpponentName(person.equals(session.getPlayer1Id()) ? session.getPlayer2Username() : session.getPlayer1Username());
            match.setResult(session.getWinnerId() == null ? "DRAW" : session.getWinnerId().equals(person) ? "WIN" : "LOSS");
            Integer change = person.equals(session.getPlayer1Id()) ? session.getPlayer1EloChange() : session.getPlayer2EloChange();
            match.setEloChange(change == null ? 0 : change);
            match.setFinishedAt(now);
            matches.save(match);
        }
    }

    private long rank(int elo) {
        return users.countByEloGreaterThan(elo) + 1;
    }
}
