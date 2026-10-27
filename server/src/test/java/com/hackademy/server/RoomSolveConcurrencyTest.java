package com.hackademy.server;

import com.hackademy.server.room.DifficultyLevel;
import com.hackademy.server.room.Room;
import com.hackademy.server.room.RoomRepository;
import com.hackademy.server.room.RoomService;
import com.hackademy.server.room.RoomTask;
import com.hackademy.server.room.RoomTaskRepository;
import com.hackademy.server.room.UserSolvedRoomRepository;
import com.hackademy.server.room.dto.SolveRoomResponse;
import com.hackademy.server.user.Role;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Testcontainers
class RoomSolveConcurrencyTest {
    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17.11-alpine");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("DB_URL", postgres::getJdbcUrl);
        registry.add("DB_USERNAME", postgres::getUsername);
        registry.add("DB_PASSWORD", postgres::getPassword);
    }

    @Autowired
    private RoomService roomService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private RoomTaskRepository roomTaskRepository;

    @Autowired
    private UserSolvedRoomRepository userSolvedRoomRepository;

    @Test
    void sameRoomFlagSolvesAwardPointsOnce() throws Exception {
        User user = user();
        Room room = room(DifficultyLevel.MEDIUM);

        List<SolveRoomResponse> results = race(
                () -> roomService.solveRoom(room.getId(), "CTF{race}", user.getUsername()),
                () -> roomService.solveRoom(room.getId(), "CTF{race}", user.getUsername()));

        assertTrue(results.stream().allMatch(SolveRoomResponse::success));
        assertEquals(100, results.stream().mapToInt(SolveRoomResponse::pointsEarned).sum());
        assertEquals(1, userSolvedRoomRepository.countByUser_Id(user.getId()));
        assertEquals(100, userRepository.findById(user.getId()).orElseThrow().getPoints());
        assertEquals(1, roomRepository.findById(room.getId()).orElseThrow().getSolutionsCount());
    }

    @Test
    void differentRoomFlagSolvesKeepEveryPoint() throws Exception {
        User user = user();
        Room first = room(DifficultyLevel.MEDIUM);
        Room second = room(DifficultyLevel.EASY);

        List<SolveRoomResponse> results = race(
                () -> roomService.solveRoom(first.getId(), "CTF{race}", user.getUsername()),
                () -> roomService.solveRoom(second.getId(), "CTF{race}", user.getUsername()));

        assertTrue(results.stream().allMatch(SolveRoomResponse::success));
        assertEquals(2, userSolvedRoomRepository.countByUser_Id(user.getId()));
        assertEquals(150, userRepository.findById(user.getId()).orElseThrow().getPoints());
    }

    @Test
    void flagAndLastTaskInSameRoomAwardPointsOnce() throws Exception {
        User user = user();
        Room room = room(DifficultyLevel.MEDIUM);
        RoomTask task = roomTaskRepository.save(RoomTask.builder()
                .room(room)
                .title("Task")
                .content("Only task")
                .answer("answer")
                .sortOrder(0)
                .build());

        List<SolveRoomResponse> results = race(
                () -> roomService.solveRoom(room.getId(), "CTF{race}", user.getUsername()),
                () -> roomService.solveTask(room.getId(), task.getId(), "answer", user.getUsername()));

        assertTrue(results.stream().allMatch(SolveRoomResponse::success));
        assertEquals(100, results.stream().mapToInt(SolveRoomResponse::pointsEarned).sum());
        assertEquals(1, userSolvedRoomRepository.countByUser_Id(user.getId()));
        assertEquals(100, userRepository.findById(user.getId()).orElseThrow().getPoints());
        assertEquals(1, roomRepository.findById(room.getId()).orElseThrow().getSolutionsCount());
    }

    private User user() {
        return ClerkTestTokens.createUser(userRepository, "race" + UUID.randomUUID().toString().substring(0, 8), Role.USER);
    }

    private Room room(DifficultyLevel difficulty) {
        return roomRepository.save(Room.builder()
                .title("Race " + UUID.randomUUID())
                .description("Concurrency test")
                .difficulty(difficulty)
                .category("Test")
                .points(difficulty.ctfPoints())
                .flag("CTF{race}")
                .build());
    }

    @SafeVarargs
    private static List<SolveRoomResponse> race(Callable<SolveRoomResponse>... solves) throws Exception {
        var start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(solves.length);
        try {
            var futures = new ArrayList<java.util.concurrent.Future<SolveRoomResponse>>();
            for (var solve : solves) {
                futures.add(pool.submit(() -> {
                    start.await();
                    return solve.call();
                }));
            }
            start.countDown();
            var results = new ArrayList<SolveRoomResponse>();
            for (var future : futures) {
                results.add(future.get(10, TimeUnit.SECONDS));
            }
            return results;
        } finally {
            pool.shutdownNow();
        }
    }
}
