package com.hackademy.server.ratelimit;

import com.hackademy.server.ClerkTestTokens;
import com.hackademy.server.proxy.OriginGuardFilter;
import com.hackademy.server.user.Role;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "DB_URL=jdbc:h2:mem:rate_limit_test",
        "DB_USERNAME=sa",
        "DB_PASSWORD=",
        "ORIGIN_GUARD_SECRETS=" + RateLimitIntegrationTest.SECRET,
        "RATE_LIMIT_ENABLED=true",
        "application.rate-limit.rules.api-read.burst=2",
        "application.rate-limit.rules.api-read.limit=1",
        "application.rate-limit.rules.api-read.window=1h",
        "application.rate-limit.rules.api-write.burst=1",
        "application.rate-limit.rules.api-write.limit=1",
        "application.rate-limit.rules.api-write.window=1h",
        "application.rate-limit.rules.anonymous.burst=2",
        "application.rate-limit.rules.anonymous.limit=1",
        "application.rate-limit.rules.anonymous.window=1h",
        "application.rate-limit.rules.websocket-handshake.burst=1",
        "application.rate-limit.rules.websocket-handshake.limit=1",
        "application.rate-limit.rules.websocket-handshake.window=1h",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class RateLimitIntegrationTest {

    static final String SECRET = "rate-limit-secret-0123456789abcdef0123";
    private static final String ORIGIN = ClerkTestTokens.DEFAULT_ORIGIN;

    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    @Value("${local.server.port}")
    private int port;

    @Autowired
    private UserRepository userRepository;

    @Test
    void limitsAnonymousRequestsPerVerifiedClientAddressWithAReadableAnswer() throws Exception {
        assertEquals(200, send(get("/api/rooms/top3", "203.0.113.10")).statusCode());
        assertEquals(200, send(get("/api/rooms/top3", "203.0.113.10")).statusCode());

        var rejected = send(get("/api/rooms/top3", "203.0.113.10").header("Origin", ORIGIN));

        assertEquals(429, rejected.statusCode());
        assertEquals("3600", rejected.headers().firstValue("Retry-After").orElseThrow());
        assertEquals("no-store", rejected.headers().firstValue("Cache-Control").orElseThrow());
        assertEquals(ORIGIN, rejected.headers().firstValue("Access-Control-Allow-Origin").orElseThrow());
        assertEquals("Retry-After", rejected.headers().firstValue("Access-Control-Expose-Headers").orElseThrow());
        assertEquals("{\"message\":\"Zbyt wiele żądań. Spróbuj ponownie za 3600 s.\",\"retryAfter\":3600}", rejected.body());
        assertEquals(200, send(get("/api/rooms/top3", "203.0.113.11")).statusCode());
    }

    @Test
    void forwardingHeadersFromTheClientDoNotOpenANewBudget() throws Exception {
        send(get("/api/rooms/top3", "203.0.113.20"));
        send(get("/api/rooms/top3", "203.0.113.20"));

        var spoofed = send(get("/api/rooms/top3", "203.0.113.20")
                .header("X-Forwarded-For", "198.51.100.77")
                .header("Forwarded", "for=198.51.100.77")
                .header("X-Real-IP", "198.51.100.77"));

        assertEquals(429, spoofed.statusCode());
    }

    @Test
    void rejectedWritesDoNotChangeStoredData() throws Exception {
        User user = ClerkTestTokens.createUser(userRepository, name("writer"), Role.USER);
        String bearer = ClerkTestTokens.bearer(user);

        assertEquals(200, send(bio(bearer, "203.0.113.30", "pierwsze")).statusCode());
        var rejected = send(bio(bearer, "203.0.113.31", "drugie"));

        assertEquals(429, rejected.statusCode());
        assertEquals("pierwsze", userRepository.findById(user.getId()).orElseThrow().getBio());
    }

    @Test
    void anEncodedAddressSharesTheBugReportBudget() throws Exception {
        User user = ClerkTestTokens.createUser(userRepository, name("reporter"), Role.USER);
        String bearer = ClerkTestTokens.bearer(user);

        assertEquals(201, send(bugReport("/api/bug-reports", bearer, "Pierwsze zgłoszenie z areny")).statusCode());
        var encoded = send(bugReport("/api/%62ug-reports", bearer, "Drugie zgłoszenie z areny"));

        assertEquals(429, encoded.statusCode());
        assertEquals("30", encoded.headers().firstValue("Retry-After").orElseThrow());
    }

    @Test
    void givesEverySignedInPersonBehindOneAddressTheirOwnBudget() throws Exception {
        for (int person = 0; person < 4; person++) {
            User user = ClerkTestTokens.createUser(userRepository, name("student"), Role.USER);
            String bearer = ClerkTestTokens.bearer(user);
            for (int i = 0; i < 2; i++) {
                assertEquals(200, send(get("/api/user/me", "203.0.113.40").header("Authorization", bearer)).statusCode());
            }
            assertEquals(429, send(get("/api/user/me", "203.0.113.40").header("Authorization", bearer)).statusCode());
        }
    }

    @Test
    void doesNotCreateAccountsForRejectedRequestsWithAnInvalidToken() throws Exception {
        String clerkUserId = "user_" + UUID.randomUUID().toString().replace("-", "");
        String email = clerkUserId + "@example.com";
        String forged = ClerkTestTokens.token(clerkUserId, "https://evil.example", Map.of("email", email, "email_verified", true));
        send(get("/api/rooms/top3", "203.0.113.50"));
        send(get("/api/rooms/top3", "203.0.113.50"));

        var rejected = send(get("/api/user/me", "203.0.113.50").header("Authorization", "Bearer " + forged));

        assertEquals(429, rejected.statusCode());
        assertTrue(userRepository.findByEmail(email).isEmpty());
    }

    @Test
    void requestsOutsideTheLimitedApiNeverResolveOrCreateAccounts() throws Exception {
        String clerkUserId = "user_" + UUID.randomUUID().toString().replace("-", "");
        String bearer = "Bearer " + ClerkTestTokens.token(clerkUserId, ORIGIN,
                Map.of("email", clerkUserId + "@example.com", "email_verified", true));

        for (int i = 0; i < 3; i++) {
            assertEquals(200, send(get("/health", "203.0.113.80").header("Authorization", bearer)).statusCode());
            send(get("/", "203.0.113.80").header("Authorization", bearer));
            send(get("/missing", "203.0.113.81").header("Authorization", bearer));
            send(get("/ws/info", "203.0.113.82").header("Authorization", bearer).header("Origin", ORIGIN));
            send(get("/api/user/me", "203.0.113.83").header("Authorization", bearer)
                    .method("OPTIONS", HttpRequest.BodyPublishers.noBody()));
        }

        assertTrue(userRepository.findByClerkUserId(clerkUserId).isEmpty());
        assertEquals(200, send(get("/api/user/me", "203.0.113.84").header("Authorization", bearer)).statusCode());
        assertTrue(userRepository.findByClerkUserId(clerkUserId).isPresent());
    }

    @Test
    void neverLimitsHealthChecks() throws Exception {
        for (int i = 0; i < 10; i++) {
            assertEquals(200, send(get("/health", "203.0.113.60")).statusCode());
        }
    }

    @Test
    void limitsSockJsHandshakesPerAddress() throws Exception {
        assertEquals(200, send(get("/ws/info", "203.0.113.70").header("Origin", ORIGIN)).statusCode());

        assertEquals(429, send(get("/ws/info", "203.0.113.70").header("Origin", ORIGIN)).statusCode());
        assertEquals(200, send(get("/ws/info", "203.0.113.71").header("Origin", ORIGIN)).statusCode());
    }

    @Test
    void upgradesWebSocketsThroughTheLimiter() throws Exception {
        WebSocket socket = client.newWebSocketBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .header("Origin", ORIGIN)
                .header(OriginGuardFilter.SECRET_HEADER, SECRET)
                .header("CF-Connecting-IP", "203.0.113.90")
                .subprotocols("v12.stomp")
                .buildAsync(URI.create("ws://localhost:" + port + "/ws/websocket"), new WebSocket.Listener() { })
                .get(5, TimeUnit.SECONDS);

        socket.sendClose(WebSocket.NORMAL_CLOSURE, "").get(5, TimeUnit.SECONDS);
    }

    private HttpRequest.Builder bio(String bearer, String address, String bio) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/user/me/bio"))
                .timeout(Duration.ofSeconds(5))
                .header(OriginGuardFilter.SECRET_HEADER, SECRET)
                .header("CF-Connecting-IP", address)
                .header("Authorization", bearer)
                .header("Content-Type", "application/json")
                .method("PATCH", HttpRequest.BodyPublishers.ofString("{\"bio\":\"" + bio + "\"}"));
    }

    private HttpRequest.Builder bugReport(String path, String bearer, String description) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .timeout(Duration.ofSeconds(5))
                .header(OriginGuardFilter.SECRET_HEADER, SECRET)
                .header("CF-Connecting-IP", "203.0.113.35")
                .header("Authorization", bearer)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"source\":\"ARENA\",\"description\":\"" + description + "\"}"));
    }

    private HttpRequest.Builder get(String path, String address) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .timeout(Duration.ofSeconds(5))
                .header(OriginGuardFilter.SECRET_HEADER, SECRET)
                .header("CF-Connecting-IP", address)
                .GET();
    }

    private HttpResponse<String> send(HttpRequest.Builder request) throws Exception {
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static String name(String prefix) {
        return prefix + UUID.randomUUID().toString().substring(0, 8);
    }
}
