package com.hackademy.server.arena;

import com.hackademy.server.arena.dto.ArenaMatchDetail;
import com.hackademy.server.arena.dto.ArenaMatchPage;
import com.hackademy.server.arena.dto.ArenaMatchRoundView;
import com.hackademy.server.arena.dto.ArenaMatchSummary;
import com.hackademy.server.user.UserAvatarRepository;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.user.UserServiceImpl;
import com.hackademy.server.user.dto.UserAvatarDto;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Random;

@Component
@RequiredArgsConstructor
public class ArenaHistory {
    static final int MAX_PAGE_SIZE = 50;

    private final ArenaMatchRepository matches;
    private final UserRepository users;
    private final UserServiceImpl userService;
    private final UserAvatarRepository avatars;

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

    @Transactional
    void record(GameSession session) {
        if ("CANCELLED".equals(session.getFinishReason()) || "ABANDONED".equals(session.getFinishReason())) return;
        LocalDateTime now = LocalDateTime.now();
        Integer duration = session.getStartTime() == null ? null
                : (int) Math.max(0, Duration.between(session.getStartTime(), now).toSeconds());
        List<ArenaMatch> results = new ArrayList<>();
        for (Long person : session.people()) {
            Long opponent = session.opponentOf(person);
            ArenaMatch match = new ArenaMatch();
            match.setUserId(person);
            match.setGameId(session.getId());
            match.setOpponentName(session.usernameOf(opponent));
            match.setResult(session.getWinnerId() == null ? "DRAW" : session.getWinnerId().equals(person) ? "WIN" : "LOSS");
            match.setEloChange(session.eloChangeOf(person));
            match.setFinishedAt(now);
            match.setOpponentBot(session.isBot(opponent));
            match.setOpponentId(session.isBot(opponent) ? null : opponent);
            match.setOpponentAvatar(session.avatarOf(opponent));
            match.setFinishReason(session.getFinishReason());
            match.setEloBefore(session.startingEloOf(person));
            match.setOpponentElo(session.startingEloOf(opponent));
            match.setHp(session.getHp().get(person));
            match.setOpponentHp(session.getHp().get(opponent));
            match.setDurationSeconds(duration);
            for (PlayedRound played : session.getPlayed()) match.getRounds().add(ArenaMatchRound.of(match, played, person, opponent));
            results.add(match);
        }
        matches.saveAll(results);
    }

    @Transactional(readOnly = true)
    public ArenaMatchPage page(Long userId, int page, int size) {
        int limit = Math.max(1, Math.min(MAX_PAGE_SIZE, size));
        List<ArenaMatch> found = matches.findByUserIdOrderByFinishedAtDescIdDesc(userId, PageRequest.of(Math.max(0, page), limit + 1));
        boolean hasMore = found.size() > limit;
        List<ArenaMatch> shown = hasMore ? found.subList(0, limit) : found;
        Map<Long, UserAvatarDto> live = avatars.findDtosByUserIds(shown.stream().map(ArenaMatch::getOpponentId).filter(Objects::nonNull).distinct().toList());
        return new ArenaMatchPage(shown.stream().map(match -> summary(match, live)).toList(), hasMore);
    }

    @Transactional(readOnly = true)
    public Optional<ArenaMatchDetail> detail(Long userId, Long matchId) {
        return matches.findByIdAndUserId(matchId, userId).map(this::detail);
    }

    @Transactional(readOnly = true)
    public Optional<ArenaMatchDetail> detailOfGame(Long userId, String gameId) {
        return matches.findByGameIdAndUserId(gameId, userId).map(this::detail);
    }

    private ArenaMatchDetail detail(ArenaMatch match) {
        Map<Long, UserAvatarDto> live = match.getOpponentId() == null ? Map.of() : avatars.findDtosByUserIds(List.of(match.getOpponentId()));
        List<ArenaMatchRoundView> rounds = match.getRounds().stream().map(ArenaMatchRound::view).toList();
        return new ArenaMatchDetail(summary(match, live), match.getFinishReason(), match.getEloBefore(), match.getOpponentElo(),
                match.getHp(), match.getOpponentHp(), match.getDurationSeconds(), rounds);
    }

    private static ArenaMatchSummary summary(ArenaMatch match, Map<Long, UserAvatarDto> live) {
        UserAvatarDto avatar = match.getOpponentId() == null ? match.getOpponentAvatar()
                : live.getOrDefault(match.getOpponentId(), match.getOpponentAvatar());
        return new ArenaMatchSummary(match.getId(), match.getOpponentName(), avatar, match.getResult(),
                match.getEloChange(), match.getFinishedAt());
    }
}
