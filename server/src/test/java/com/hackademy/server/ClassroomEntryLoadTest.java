package com.hackademy.server;

import tools.jackson.databind.ObjectMapper;
import com.hackademy.server.dashboard.DashboardSummaryCache;
import com.hackademy.server.room.*;
import com.hackademy.server.user.User;
import com.hackademy.server.user.Role;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import javax.sql.DataSource;
import java.lang.management.ManagementFactory;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.IntFunction;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {"spring.jpa.properties.hibernate.generate_statistics=true", "logging.level.org.hibernate.stat=ERROR", "logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener=ERROR"})
class ClassroomEntryLoadTest extends PostgresIntegrationTest {
    @Autowired DataSource dataSource;
    @Autowired EntityManagerFactory entityManagerFactory;
    @Autowired DashboardSummaryCache cache;
    @Autowired RoomService rooms;
    @Autowired RoomRepository roomRepository;
    @Autowired RoomTaskRepository taskRepository;

    @Test
    void coldDashboardsAndSharedTaskRoomsFitTheProductionPool() throws Exception {
        boolean baseline = Boolean.getBoolean("classroom.baseline");
        var measurements = new ArrayList<Map<String, Object>>();
        for (int count : baseline ? new int[]{30} : new int[]{30, 300}) {
            var accounts = new ArrayList<Account>();
            for (int index = 0; index < count; index++) accounts.add(account(Role.USER));
            cache.invalidateAll();
            var statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
            statistics.clear();
            Map<String, Object> result = measure(count, index -> {
                try { return getAs(accounts.get(index), "/api/dashboard/summary").andReturn().getResponse().getStatus(); }
                catch (Exception failure) { return 500; }
            });
            result.put("users", count);
            result.put("scenario", "cold-dashboard");
            result.put("sqlPerRequest", (statistics.getPrepareStatementCount() + (baseline ? 0 : count)) / (double) count);
            measurements.add(result);
        }
        if (!baseline) {
            var users = new ArrayList<User>();
            for (int index = 0; index < 30; index++) users.add(userRepository.findById(account(Role.USER).id()).orElseThrow());
            var room = roomRepository.save(Room.builder().title("Classroom " + UUID.randomUUID()).description("Concurrent exercise")
                    .difficulty(DifficultyLevel.EASY).category("Test").flag("").points(100).published(true).roomType(RoomType.PATH).build());
            var task = taskRepository.save(RoomTask.builder().room(room).title("Task").content("Question").answer("correct").sortOrder(0).build());
            var awarded = new AtomicInteger();
            var taskResult = measure(90, index -> {
                var result = rooms.solveTask(room.getId(), task.getId(), index % 3 == 2 ? "wrong" : "correct", users.get(index / 3).getUsername());
                awarded.addAndGet(result.pointsEarned());
                return result.success() == (index % 3 != 2) ? 200 : 500;
            });
            taskResult.put("scenario", "shared-room-correct-wrong-duplicate");
            measurements.add(taskResult);
            assertEquals(3000, awarded.get());
            assertEquals(30, roomRepository.findById(room.getId()).orElseThrow().getSolutionsCount());
            assertEquals(30, jdbcTemplate.queryForObject("SELECT count(*) FROM user_solved_rooms WHERE room_id = ?", Integer.class, room.getId()));
            for (var user : users) assertEquals(100, userRepository.findById(user.getId()).orElseThrow().getPoints());
        }
        Path report = Path.of("target/classroom-stage-one.json");
        Files.writeString(report, new ObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(measurements));
        if (!baseline) for (var result : measurements) assertEquals(0, result.get("errors"), result.toString());
    }

    private Map<String, Object> measure(int count, IntFunction<Integer> request) throws Exception {
        var pool = dataSource.unwrap(HikariDataSource.class).getHikariPoolMXBean();
        var peakActive = new AtomicInteger();
        var peakWaiting = new AtomicInteger();
        var peakHeap = new java.util.concurrent.atomic.AtomicLong();
        var sampler = Executors.newSingleThreadScheduledExecutor();
        sampler.scheduleAtFixedRate(() -> {
            peakActive.accumulateAndGet(pool.getActiveConnections(), Math::max);
            peakWaiting.accumulateAndGet(pool.getThreadsAwaitingConnection(), Math::max);
            peakHeap.accumulateAndGet(ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed(), Math::max);
        }, 0, 5, TimeUnit.MILLISECONDS);
        var executor = Executors.newFixedThreadPool(12);
        var start = new CountDownLatch(1);
        var durations = new ConcurrentLinkedQueue<Long>();
        var failures = new AtomicInteger();
        long beginning = System.nanoTime();
        try {
            var futures = new ArrayList<Future<?>>();
            for (int index = 0; index < count; index++) {
                int target = index;
                futures.add(executor.submit(() -> {
                    try {
                        start.await();
                        if (request.apply(target) != 200) failures.incrementAndGet();
                    } catch (Exception failure) { failures.incrementAndGet(); }
                    finally { durations.add(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - beginning)); }
                }));
            }
            start.countDown();
            for (var future : futures) future.get(180, TimeUnit.SECONDS);
        } finally {
            executor.shutdownNow();
            sampler.shutdownNow();
        }
        var latency = durations.stream().sorted().toList();
        var result = new LinkedHashMap<String, Object>();
        result.put("requests", count);
        result.put("errors", failures.get());
        result.put("p95Millis", latency.get(Math.max(0, (int) Math.ceil(count * .95) - 1)));
        result.put("durationMillis", TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - beginning));
        result.put("peakPoolActive", peakActive.get());
        result.put("peakPoolWaiting", peakWaiting.get());
        result.put("peakHeapMiB", peakHeap.get() / 1048576.0);
        result.put("maxHeapMiB", Runtime.getRuntime().maxMemory() / 1048576.0);
        return result;
    }
}
