package com.hackademy.server.arena;

import com.hackademy.server.realtime.RealtimeNotifier;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;

@Service
@RequiredArgsConstructor
public class MatchmakingServiceImpl implements MatchmakingService {

    private final UserRepository userRepository;
    private final RealtimeNotifier realtime;

    private final java.util.Set<Long> matching = new java.util.HashSet<>();
    private final Queue<PlayerInfo> queue = new ConcurrentLinkedQueue<>();

    @Override
    public void releaseMatch(GameSession session) {
        synchronized (queue) { matching.remove(session.getPlayer1Id()); matching.remove(session.getPlayer2Id()); }
    }

    private record PlayerInfo(Long id, String username) {}

    @Override
    public void joinQueue(Long userId, String username) {
        synchronized (queue) {
        if (queue.stream().noneMatch(player -> player.id().equals(userId))) {
            queue.add(new PlayerInfo(userId, username));
            realtime.arenaChanged(userId);
        }
        }
    }

    @Override
    public void leaveQueue(Long userId) {
        var leaving = queue.stream().filter(player -> player.id().equals(userId)).findFirst();
        queue.removeIf(player -> player.id().equals(userId));
        leaving.ifPresent(player -> realtime.arenaChanged(player.id()));
    }

    @Override
    public boolean isQueued(Long userId) {
        return queue.stream().anyMatch(player -> player.id().equals(userId));
    }

    @Override
    public List<GameSession> checkForMatches() {
        List<GameSession> sessions = new ArrayList<>();
        List<PlayerInfo> waiting;
        synchronized (queue) {
            var candidates = queue.stream().filter(player -> !matching.contains(player.id())).toList();
            waiting = candidates.subList(0, candidates.size() - candidates.size() % 2);
            waiting.forEach(player -> matching.add(player.id()));
        }
        try {
        for (int index = 0; index + 1 < waiting.size(); index += 2) {
            PlayerInfo first = waiting.get(index);
            PlayerInfo second = waiting.get(index + 1);
            User firstUser = userRepository.findById(first.id()).orElse(null);
            User secondUser = userRepository.findById(second.id()).orElse(null);
            if (firstUser == null || secondUser == null) {
                synchronized (queue) { matching.remove(first.id()); matching.remove(second.id()); }
                continue;
            }
            sessions.add(createGameSession(first, firstUser, second, secondUser));
        }
        return sessions;
        } catch (RuntimeException failure) {
            synchronized (queue) { waiting.forEach(player -> matching.remove(player.id())); }
            throw failure;
        }
    }

    private GameSession createGameSession(PlayerInfo first, User firstUser, PlayerInfo second, User secondUser) {
        GameSession session = new GameSession();
        session.setId(UUID.randomUUID().toString());
        session.setPlayer1Id(first.id());
        session.setPlayer1Username(first.username());
        session.setPlayer1Elo(firstUser.getElo());
        session.setPlayer2Id(second.id());
        session.setPlayer2Username(second.username());
        session.setPlayer2Elo(secondUser.getElo());
        return session;
    }
}
