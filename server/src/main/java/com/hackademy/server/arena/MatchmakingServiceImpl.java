package com.hackademy.server.arena;

import com.hackademy.server.realtime.RealtimeNotifier;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;
import java.util.random.RandomGenerator;

@Service
@RequiredArgsConstructor
public class MatchmakingServiceImpl implements MatchmakingService {

    static final long BOT_WAIT_MIN_MILLIS = 15_000;
    static final long BOT_WAIT_MAX_MILLIS = 20_000;

    private final UserRepository userRepository;
    private final RealtimeNotifier realtime;

    private final java.util.Set<Long> matching = new java.util.HashSet<>();
    private final Queue<PlayerInfo> queue = new ConcurrentLinkedQueue<>();
    private final AtomicLong tickets = new AtomicLong();
    private final AtomicLong botIds = new AtomicLong();
    private LongSupplier clock = System::currentTimeMillis;
    private RandomGenerator random = new SecureRandom();

    void useClock(LongSupplier clock) {
        this.clock = clock;
    }

    void useRandom(RandomGenerator random) {
        this.random = random;
    }

    @Override
    public void releaseMatch(GameSession session) {
        synchronized (queue) { matching.remove(session.getPlayer1Id()); matching.remove(session.getPlayer2Id()); }
    }

    private record PlayerInfo(Long id, String username, long ticket, long botAt) {}

    @Override
    public void joinQueue(Long userId, String username) {
        synchronized (queue) {
        if (queue.stream().noneMatch(player -> player.id().equals(userId))) {
            long wait = random.nextLong(BOT_WAIT_MIN_MILLIS, BOT_WAIT_MAX_MILLIS + 1);
            queue.add(new PlayerInfo(userId, username, tickets.incrementAndGet(), clock.getAsLong() + wait));
            realtime.arenaChanged(userId);
            realtime.activityChanged(userId);
        }
        }
    }

    @Override
    public void leaveQueue(Long userId) {
        boolean left;
        synchronized (queue) { left = queue.removeIf(player -> player.id().equals(userId)); }
        if (left) {
            realtime.arenaChanged(userId);
            realtime.activityChanged(userId);
        }
    }

    @Override
    public boolean takeFromQueue(Map<Long, Long> players) {
        synchronized (queue) {
            boolean waiting = players.entrySet().stream().allMatch(player -> queue.stream()
                    .anyMatch(info -> info.id().equals(player.getKey()) && info.ticket() == player.getValue()));
            if (waiting) queue.removeIf(info -> players.containsKey(info.id()));
            return waiting;
        }
    }

    @Override
    public boolean isQueued(Long userId) {
        return queue.stream().anyMatch(player -> player.id().equals(userId));
    }

    @Override
    public List<GameSession> checkForMatches() {
        List<GameSession> sessions = new ArrayList<>();
        List<PlayerInfo> waiting;
        PlayerInfo alone = null;
        synchronized (queue) {
            var candidates = queue.stream().filter(player -> !matching.contains(player.id())).toList();
            waiting = candidates.subList(0, candidates.size() - candidates.size() % 2);
            waiting.forEach(player -> matching.add(player.id()));
            if (candidates.size() % 2 == 1 && clock.getAsLong() >= candidates.get(candidates.size() - 1).botAt()) {
                alone = candidates.get(candidates.size() - 1);
                matching.add(alone.id());
            }
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
        if (alone != null) {
            User user = userRepository.findById(alone.id()).orElse(null);
            if (user == null) {
                synchronized (queue) { matching.remove(alone.id()); }
            } else {
                sessions.add(createBotSession(alone, user));
            }
        }
        return sessions;
        } catch (RuntimeException failure) {
            PlayerInfo unmatched = alone;
            synchronized (queue) {
                waiting.forEach(player -> matching.remove(player.id()));
                if (unmatched != null) matching.remove(unmatched.id());
            }
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
        session.getQueueTickets().put(first.id(), first.ticket());
        session.getQueueTickets().put(second.id(), second.ticket());
        return session;
    }

    private GameSession createBotSession(PlayerInfo player, User user) {
        String name = BotIdentity.username(random, candidate -> userRepository.findByUsernameIgnoringCase(candidate).isPresent());
        Long bot = -botIds.incrementAndGet();
        GameSession session = new GameSession();
        session.setId(UUID.randomUUID().toString());
        session.setPlayer1Id(player.id());
        session.setPlayer1Username(player.username());
        session.setPlayer1Elo(user.getElo());
        session.setPlayer2Id(bot);
        session.setPlayer2Username(name);
        session.setPlayer2Elo(BotPlayer.drawElo(session.eloOf(player.id()), random));
        session.setPlayer2Avatar(BotIdentity.avatar(random));
        session.setBotId(bot);
        session.getQueueTickets().put(player.id(), player.ticket());
        return session;
    }
}
