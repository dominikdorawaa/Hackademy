package com.hackademy.server;

import com.hackademy.server.auth.JwtService;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.net.http.WebSocketHandshakeException;
import java.time.Duration;
import java.util.Date;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "DB_URL=jdbc:h2:mem:websocket_auth_test",
        "DB_USERNAME=sa",
        "DB_PASSWORD=",
        "JWT_SECRET=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
        "FRONTEND_URL=https://frontend.example.com",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
class WebSocketAuthenticationIntegrationTest {
    private static final String ORIGIN = "https://frontend.example.com";
    private static final String SECRET = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

    @Value("${local.server.port}")
    private int port;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MockMvc mockMvc;


    @Test
    void connectsWithValidJwtAndCanSubscribeToItsOwnState() throws Exception {
        String username = "socket" + UUID.randomUUID().toString().substring(0, 8);
        var user = userRepository.saveAndFlush(User.builder()
                .username(username).email(username + "@example.com").password("unused").build());
        try (var socket = connect(ORIGIN)) {
            socket.send(connectFrame("Authorization:Bearer " + jwtService.generateToken(user) + "\n"));
            String reply = socket.receive();
            assertTrue(reply.startsWith("CONNECTED\n"), reply);
            assertTrue(reply.contains("user-name:" + user.getId() + "\n"), reply);

            String destination = "/user/queue/realtime";
            socket.send("SUBSCRIBE\nid:authenticated-test\ndestination:" + destination + "\n\n\0");
            String received = socket.receive();
            assertTrue(received.startsWith("MESSAGE\n"), received);
            assertTrue(received.contains("subscription:authenticated-test\n"), received);
            assertTrue(received.contains("\"type\":\"READY\""), received);
        }
    }

    @ParameterizedTest
    @MethodSource("invalidAuthorizationHeaders")
    void rejectsConnectWithMissingOrInvalidCredentials(String authorization) throws Exception {
        try (var socket = connect(ORIGIN)) {
            socket.send(connectFrame(authorization));
            String reply = socket.receive();
            assertTrue(reply.startsWith("ERROR\n"), reply);
            assertFalse(reply.contains("CONNECTED"));
            if (authorization.contains("Bearer ")) {
                String token = authorization.substring(authorization.indexOf("Bearer ") + 7).strip();
                if (!token.isEmpty()) assertFalse(reply.contains(token));
            }
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"SUBSCRIBE\nid:test\ndestination:/topic/test\n\n\0", "SEND\ndestination:/topic/test\n\ninvalid\0"})
    void rejectsMessagesBeforeAuthentication(String frame) throws Exception {
        try (var socket = connect(ORIGIN)) {
            socket.send(frame);
            assertTrue(socket.receive().startsWith("ERROR\n"));
        }
    }

    @Test
    void rejectsWebSocketHandshakeFromUntrustedOrigin() {
        var exception = assertThrows(ExecutionException.class, () -> connect("https://untrusted.example.com"));
        var handshake = assertInstanceOf(WebSocketHandshakeException.class, exception.getCause());
        assertEquals(403, handshake.getResponse().statusCode());
    }

    @Test
    void allowsSockJsDiscoveryOnlyFromConfiguredOriginWithoutHttpToken() throws Exception {
        mockMvc.perform(get("/ws/info").header("Origin", ORIGIN))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", ORIGIN));
        mockMvc.perform(get("/ws/info").header("Origin", "https://untrusted.example.com"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/user/me"))
                .andExpect(status().isForbidden());
    }

    private static Stream<String> invalidAuthorizationHeaders() {
        var key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(SECRET));
        String expired = Jwts.builder().subject("tester")
                .expiration(new Date(System.currentTimeMillis() - 60000)).signWith(key).compact();
        String missingSubject = Jwts.builder()
                .expiration(new Date(System.currentTimeMillis() + 60000)).signWith(key).compact();
        String unknownUser = Jwts.builder().subject("nonexistent-socket-user")
                .expiration(new Date(System.currentTimeMillis() + 60000)).signWith(key).compact();
        String wrongSignature = Jwts.builder().subject("tester")
                .expiration(new Date(System.currentTimeMillis() + 60000))
                .signWith(Keys.hmacShaKeyFor(new byte[32])).compact();
        return Stream.of("", "Authorization:Basic invalid\n", "Authorization:Bearer \n",
                "Authorization:Bearer invalid\n", "Authorization:Bearer " + expired + "\n",
                "Authorization:Bearer " + missingSubject + "\n",
                "Authorization:Bearer " + unknownUser + "\n",
                "Authorization:Bearer " + wrongSignature + "\n",
                "Authorization:Bearer invalid\nAuthorization:Bearer other\n");
    }

    private static String connectFrame(String authorization) {
        return "CONNECT\naccept-version:1.2\nhost:localhost\nheart-beat:0,0\n" + authorization + "\n\0";
    }

    private TestSocket connect(String origin) throws Exception {
        var listener = new TestSocket();
        listener.socket = HttpClient.newHttpClient().newWebSocketBuilder()
                .connectTimeout(Duration.ofSeconds(5)).header("Origin", origin)
                .subprotocols("v12.stomp")
                .buildAsync(URI.create("ws://localhost:" + port + "/ws/websocket"), listener)
                .get(5, TimeUnit.SECONDS);
        return listener;
    }

    private static final class TestSocket implements WebSocket.Listener, AutoCloseable {
        private final BlockingQueue<String> messages = new LinkedBlockingQueue<>();
        private final StringBuilder fragments = new StringBuilder();
        private WebSocket socket;

        @Override
        public void onOpen(WebSocket webSocket) {
            webSocket.request(1);
        }

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            fragments.append(data);
            if (last) {
                messages.add(fragments.toString());
                fragments.setLength(0);
            }
            webSocket.request(1);
            return null;
        }

        private void send(String frame) throws Exception {
            socket.sendText(frame, true).get(5, TimeUnit.SECONDS);
        }

        private String receive() throws Exception {
            String message = messages.poll(5, TimeUnit.SECONDS);
            assertNotNull(message, "Expected a STOMP response before timeout");
            return message;
        }

        @Override
        public void close() {
            socket.abort();
        }
    }
}
