package com.hackademy.server.proxy;

import com.hackademy.server.ClerkTestTokens;
import com.hackademy.server.user.Role;
import com.hackademy.server.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.net.http.WebSocketHandshakeException;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "DB_URL=jdbc:h2:mem:origin_guard_test",
        "DB_USERNAME=sa",
        "DB_PASSWORD=",
        "ORIGIN_GUARD_SECRETS=" + OriginGuardIntegrationTest.OLD + "," + OriginGuardIntegrationTest.CURRENT,
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class OriginGuardIntegrationTest {

    static final String OLD = "integration-old-secret-0123456789abcdef";
    static final String CURRENT = "integration-current-secret-0123456789abcdef";
    private static final String ORIGIN = ClerkTestTokens.DEFAULT_ORIGIN;

    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    @Value("${local.server.port}")
    private int port;

    @Autowired
    private UserRepository userRepository;

    @ParameterizedTest
    @ValueSource(strings = {"/health", "/api/rooms/top3", "/api/user/me", "/ws/info", "/missing"})
    void rejectsRequestsThatBypassCloudflare(String path) throws Exception {
        var response = send(get(path).header("CF-Connecting-IP", "203.0.113.7").header("X-Forwarded-For", "203.0.113.7"));

        assertEquals(403, response.statusCode());
        assertEquals("", response.body());
        assertEquals("no-store", response.headers().firstValue("Cache-Control").orElseThrow());
    }

    @Test
    void rejectsAWrongSecret() throws Exception {
        assertEquals(403, send(get("/health").header(OriginGuardFilter.SECRET_HEADER, "x".repeat(40))).statusCode());
    }

    @ParameterizedTest
    @ValueSource(strings = {OLD, CURRENT})
    void servesRequestsThatCameThroughCloudflare(String secret) throws Exception {
        var response = send(get("/health").header(OriginGuardFilter.SECRET_HEADER, secret));

        assertEquals(200, response.statusCode());
        assertTrue(response.body().contains("ok"));
    }

    @Test
    void doesNotReachAuthenticationOrTheDatabaseWithoutTheSecret() throws Exception {
        String clerkUserId = "user_" + UUID.randomUUID().toString().replace("-", "");
        String email = clerkUserId + "@example.com";
        String token = ClerkTestTokens.token(clerkUserId, ORIGIN, Map.of("email", email, "email_verified", true));

        var response = send(get("/api/user/me").header("Authorization", "Bearer " + token));

        assertEquals(403, response.statusCode());
        assertTrue(userRepository.findByEmail(email).isEmpty());
    }

    @Test
    void keepsEachAccountsDataOutOfSharedCaches() throws Exception {
        var first = ClerkTestTokens.createUser(userRepository, name("first"), Role.USER);
        var second = ClerkTestTokens.createUser(userRepository, name("second"), Role.USER);

        var firstResponse = send(get("/api/user/me").header(OriginGuardFilter.SECRET_HEADER, CURRENT)
                .header("Authorization", ClerkTestTokens.bearer(first)));
        var secondResponse = send(get("/api/user/me").header(OriginGuardFilter.SECRET_HEADER, CURRENT)
                .header("Authorization", ClerkTestTokens.bearer(second)));

        assertAll(
                () -> assertEquals(200, firstResponse.statusCode()),
                () -> assertEquals(200, secondResponse.statusCode()),
                () -> assertTrue(firstResponse.body().contains(first.getUsername())),
                () -> assertFalse(firstResponse.body().contains(second.getUsername())),
                () -> assertTrue(secondResponse.body().contains(second.getUsername())),
                () -> assertFalse(secondResponse.body().contains(first.getUsername())),
                () -> assertNotEquals(firstResponse.body(), secondResponse.body()));
        for (var response : new HttpResponse<?>[] {firstResponse, secondResponse}) {
            String cacheControl = response.headers().firstValue("Cache-Control").orElseThrow();
            assertTrue(cacheControl.contains("no-store"), cacheControl);
            assertFalse(cacheControl.contains("public"), cacheControl);
        }
    }

    @Test
    void servesSockJsInformationThroughCloudflare() throws Exception {
        var response = send(get("/ws/info").header(OriginGuardFilter.SECRET_HEADER, CURRENT).header("Origin", ORIGIN));

        assertEquals(200, response.statusCode());
        assertTrue(response.body().contains("websocket"));
    }

    @Test
    void acceptsWebSocketHandshakeOnlyThroughCloudflare() throws Exception {
        WebSocket socket = connect(CURRENT);
        socket.sendClose(WebSocket.NORMAL_CLOSURE, "").get(5, TimeUnit.SECONDS);

        var exception = assertThrows(ExecutionException.class, () -> connect(null));
        var handshake = assertInstanceOf(WebSocketHandshakeException.class, exception.getCause());
        assertEquals(403, handshake.getResponse().statusCode());
    }

    private WebSocket connect(String secret) throws Exception {
        var builder = client.newWebSocketBuilder().connectTimeout(Duration.ofSeconds(5)).header("Origin", ORIGIN)
                .subprotocols("v12.stomp");
        if (secret != null) {
            builder.header(OriginGuardFilter.SECRET_HEADER, secret);
        }
        return builder.buildAsync(URI.create("ws://localhost:" + port + "/ws/websocket"), new WebSocket.Listener() { })
                .get(5, TimeUnit.SECONDS);
    }

    private HttpRequest.Builder get(String path) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).timeout(Duration.ofSeconds(5)).GET();
    }

    private HttpResponse<String> send(HttpRequest.Builder request) throws Exception {
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static String name(String prefix) {
        return prefix + UUID.randomUUID().toString().substring(0, 8);
    }
}
