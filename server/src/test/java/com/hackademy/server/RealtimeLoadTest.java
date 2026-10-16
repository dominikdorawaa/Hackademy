package com.hackademy.server;

import com.hackademy.server.arena.MatchmakingService;
import com.hackademy.server.auth.JwtService;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import com.sun.management.OperatingSystemMXBean;

import java.lang.management.ManagementFactory;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "DB_URL=jdbc:h2:mem:realtime_load", "DB_USERNAME=sa", "DB_PASSWORD=",
        "JWT_SECRET=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
        "FRONTEND_URL=https://frontend.example.com", "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop", "logging.level.root=WARN"
})
@EnabledIfSystemProperty(named = "realtime.load", matches = "true")
class RealtimeLoadTest {
    @Value("${local.server.port}") private int port;
    @Autowired private UserRepository users;
    @Autowired private JwtService jwt;
    @Autowired private MatchmakingService matchmaking;

    @Test
    void serveOneThousandQueuedUsersForFrontendBenchmark() throws Exception {
        var fixtures = new ArrayList<Map<String, Object>>();
        for (int index = 0; index < 1000; index++) {
            String username = "load" + index;
            var user = users.saveAndFlush(User.builder().username(username).email(username + "@example.com")
                    .password("unused").points(500).build());
            matchmaking.joinQueue(user.getId(), username);
            fixtures.add(Map.of("username", username, "token", jwt.generateToken(user), "id", user.getId()));
        }
        Path done = Path.of("target/realtime-load-done.json");
        Files.deleteIfExists(done);
        var mapper = new ObjectMapper();
        mapper.writeValue(Path.of("target/realtime-load-fixtures.json").toFile(), Map.of("port", port, "users", fixtures));
        var operatingSystem = (OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();
        long cpuStart = operatingSystem.getProcessCpuTime();
        long start = System.nanoTime();
        long peakHeap = 0;
        int peakThreads = 0;
        while (!Files.exists(done) && System.nanoTime() - start < 360_000_000_000L) {
            peakHeap = Math.max(peakHeap, ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed());
            peakThreads = Math.max(peakThreads, ManagementFactory.getThreadMXBean().getThreadCount());
            Thread.sleep(250);
        }
        mapper.writeValue(Path.of("target/realtime-load-server.json").toFile(), Map.of(
                "cpuCoreEquivalent", (double) (operatingSystem.getProcessCpuTime() - cpuStart) / (System.nanoTime() - start),
                "peakHeapMiB", peakHeap / 1048576, "peakThreads", peakThreads,
                "availableProcessors", operatingSystem.getAvailableProcessors(), "javaVersion", System.getProperty("java.version")));
        assertTrue(Files.exists(done), "Frontend benchmark did not finish within six minutes");
    }
}
