package com.hackademy.server;

import com.hackademy.server.dashboard.DashboardSummaryCache;
import com.hackademy.server.user.Role;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.ObjectMapper;

import java.lang.management.ManagementFactory;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
@EnabledIfSystemProperty(named = "classroom.http", matches = "true")
class ClassroomHttpLoadTest {
    @Container static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17.11-alpine");
    private record Learner(String token) {}
    private final List<Map<String, Object>> report = new ArrayList<>();
    private final List<RealtimeSocket> sockets = new CopyOnWriteArrayList<>();
    private final AtomicLong peakHeap = new AtomicLong();
    private final AtomicInteger peakActive = new AtomicInteger();
    private final AtomicInteger peakWaiting = new AtomicInteger();
    private final ExecutorService clientThreads = Executors.newFixedThreadPool(16);
    private final HttpClient client = HttpClient.newBuilder().executor(clientThreads)
            .connectTimeout(Duration.ofSeconds(10)).version(HttpClient.Version.HTTP_1_1).build();
    private ConfigurableApplicationContext app;
    private int port;

    @Test
    void realHttpBurstsIdleClassAndBackendRestart() throws Exception {
        var sampler = Executors.newSingleThreadScheduledExecutor();
        var heartbeat = Executors.newSingleThreadScheduledExecutor();
        try {
            start(0);
            sampler.scheduleAtFixedRate(this::sample, 0, 20, TimeUnit.MILLISECONDS);
            List<Learner> classroom = List.of();
            for (int count : new int[]{30, 300}) {
                var learners = learners(count);
                if (count == 30) classroom = learners;
                app.getBean(DashboardSummaryCache.class).invalidateAll();
                burst("cold-dashboard", learners, "/api/dashboard/summary", false, count);
            }
            for (var learner : classroom) {
                var socket = RealtimeSocket.open(client, port, learner.token(), true);
                socket.subscribe();
                sockets.add(socket);
            }
            heartbeat.scheduleAtFixedRate(() -> sockets.forEach(socket -> {
                try { socket.send("\n"); } catch (RuntimeException ignored) { }
            }), 10, 10, TimeUnit.SECONDS);
            assertEquals(30, app.getBean(SimpUserRegistry.class).getUserCount());
            burst("activity-start", classroom, "/api/user/me/active-time", true, 0);
            int minutes = Integer.getInteger("classroom.minutes", 3);
            for (int minute = 1; minute <= minutes; minute++) {
                Thread.sleep(60_000);
                burst("idle-minute-" + minute, classroom, "/api/user/me/active-time", true, 0);
                assertEquals(30, app.getBean(SimpUserRegistry.class).getUserCount());
            }
            heartbeat.shutdownNow();
            app.close();
            org.awaitility.Awaitility.await().atMost(Duration.ofSeconds(5)).until(() -> sockets.stream().allMatch(RealtimeSocket::closedByServer));
            sockets.forEach(RealtimeSocket::close);
            sockets.clear();
            start(port);
            var reconnectors = Executors.newFixedThreadPool(8);
            long started = System.nanoTime();
            try {
                var attempts = new ArrayList<Future<?>>();
                var random = new Random(206);
                for (var learner : classroom) {
                    int delay = 1000 + random.nextInt(4000);
                    attempts.add(reconnectors.submit(() -> {
                        try {
                            Thread.sleep(delay);
                            var socket = RealtimeSocket.open(client, port, learner.token(), true);
                            socket.subscribe();
                            sockets.add(socket);
                        } catch (Exception failure) { throw new CompletionException(failure); }
                    }));
                }
                for (var attempt : attempts) attempt.get(45, TimeUnit.SECONDS);
            } finally { reconnectors.shutdownNow(); }
            assertEquals(30, app.getBean(SimpUserRegistry.class).getUserCount());
            report.add(Map.of("scenario", "restart-reconnect", "connections", sockets.size(),
                    "durationMillis", (System.nanoTime() - started) / 1_000_000, "idleMinutes", minutes,
                    "steadyRequestsPerUserMinute", 1));
        } finally {
            sampler.shutdownNow();
            heartbeat.shutdownNow();
            sockets.forEach(RealtimeSocket::close);
            if (app != null) app.close();
            clientThreads.shutdownNow();
            report.add(Map.of("scenario", "whole-run-resources", "peakHeapMiB", peakHeap.get() / 1048576.0,
                    "peakPoolActive", peakActive.get(), "peakPoolWaiting", peakWaiting.get(),
                    "maxHeapMiB", Runtime.getRuntime().maxMemory() / 1048576.0));
            Files.writeString(Path.of("target/classroom-http.json"), new ObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(report));
        }
    }

    private void start(int requestedPort) {
        app = new SpringApplicationBuilder(ServerApplication.class).run(
                "--server.port=" + requestedPort, "--DB_URL=" + postgres.getJdbcUrl(),
                "--DB_USERNAME=" + postgres.getUsername(), "--DB_PASSWORD=" + postgres.getPassword(),
                "--FRONTEND_URL=https://frontend.example.com", "--logging.level.root=WARN",
                "--spring.jpa.properties.hibernate.generate_statistics=true",
                "--logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener=ERROR");
        port = ((WebServerApplicationContext) app).getWebServer().getPort();
    }

    private List<Learner> learners(int count) {
        var users = app.getBean(UserRepository.class);
        var result = new ArrayList<Learner>();
        for (int i = 0; i < count; i++) {
            User user = ClerkTestTokens.createUser(users, "load" + UUID.randomUUID().toString().substring(0, 8), Role.USER);
            Instant now = Instant.now();
            String token = ClerkTestTokens.sign(ClerkTestTokens.keys(), ClerkTestTokens.builder(user.getClerkUserId(),
                    "https://frontend.example.com", now.minusSeconds(5), now.plusSeconds(3600),
                    Map.of("email", user.getEmail(), "email_verified", true)).build());
            result.add(new Learner(token));
        }
        return result;
    }

    private void burst(String name, List<Learner> learners, String path, boolean post, int jdbcReads) throws Exception {
        var statistics = app.getBean(EntityManagerFactory.class).unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        var errors = new AtomicInteger();
        var times = new ConcurrentLinkedQueue<Long>();
        var requests = new ArrayList<CompletableFuture<Void>>();
        long started = System.nanoTime();
        for (var learner : learners) {
            var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                    .timeout(Duration.ofSeconds(20)).header("Authorization", "Bearer " + learner.token());
            if (post) builder.header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString("{\"active\":true}"));
            requests.add(client.sendAsync(builder.build(), HttpResponse.BodyHandlers.discarding()).handle((response, failure) -> {
                if (failure != null || response.statusCode() != 200) errors.incrementAndGet();
                times.add((System.nanoTime() - started) / 1_000_000);
                return null;
            }));
        }
        CompletableFuture.allOf(requests.toArray(CompletableFuture[]::new)).get(30, TimeUnit.SECONDS);
        var sorted = times.stream().sorted().toList();
        report.add(Map.of("scenario", name, "requests", learners.size(), "errors", errors.get(),
                "p95Millis", sorted.get((int) Math.ceil(sorted.size() * .95) - 1),
                "sqlPerRequest", (statistics.getPrepareStatementCount() + jdbcReads) / (double) learners.size()));
        assertEquals(0, errors.get(), name);
    }

    private void sample() {
        if (app == null || !app.isActive()) return;
        try {
            var pool = app.getBean(HikariDataSource.class).getHikariPoolMXBean();
            peakActive.accumulateAndGet(pool.getActiveConnections(), Math::max);
            peakWaiting.accumulateAndGet(pool.getThreadsAwaitingConnection(), Math::max);
            peakHeap.accumulateAndGet(ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed(), Math::max);
        } catch (RuntimeException ignored) { }
    }
}
