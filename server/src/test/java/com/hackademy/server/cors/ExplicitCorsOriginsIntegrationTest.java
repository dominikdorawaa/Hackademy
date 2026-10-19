package com.hackademy.server.cors;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
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
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.http.HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN;
import static org.springframework.http.HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD;
import static org.springframework.http.HttpHeaders.ORIGIN;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "DB_URL=jdbc:h2:mem:explicit_cors_test",
        "DB_USERNAME=sa",
        "DB_PASSWORD=",
        "JWT_SECRET=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
        "FRONTEND_URL=https://hackademy.app",
        "CORS_ALLOWED_ORIGINS=http://localhost:5173, https://preview.hackademy.pages.dev/",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
class ExplicitCorsOriginsIntegrationTest {

    @Value("${local.server.port}")
    private int port;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private CorsProperties corsProperties;

    @Test
    void explicitListReplacesTheFrontendUrlFallback() {
        assertEquals(List.of("http://localhost:5173", "https://preview.hackademy.pages.dev"),
                corsProperties.allowedOrigins());
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://localhost:5173", "https://preview.hackademy.pages.dev"})
    void allowsEveryExplicitlyListedOrigin(String origin) throws Exception {
        mockMvc.perform(options("/api/friends").header(ORIGIN, origin).header(ACCESS_CONTROL_REQUEST_METHOD, "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string(ACCESS_CONTROL_ALLOW_ORIGIN, origin));
        mockMvc.perform(get("/ws/info").header(ORIGIN, origin))
                .andExpect(status().isOk())
                .andExpect(header().string(ACCESS_CONTROL_ALLOW_ORIGIN, origin));
    }

    @Test
    void rejectsTheFrontendUrlWhenItIsNotListed() throws Exception {
        mockMvc.perform(options("/api/friends").header(ORIGIN, "https://hackademy.app")
                        .header(ACCESS_CONTROL_REQUEST_METHOD, "POST"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    void acceptsWebSocketHandshakeFromAListedOrigin() throws Exception {
        WebSocket socket = connect("https://preview.hackademy.pages.dev");

        socket.sendClose(WebSocket.NORMAL_CLOSURE, "").get(5, TimeUnit.SECONDS);
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://hackademy.app", "https://other.hackademy.pages.dev"})
    void rejectsWebSocketHandshakeFromAnOriginThatIsNotListed(String origin) {
        var exception = assertThrows(ExecutionException.class, () -> connect(origin));
        var handshake = assertInstanceOf(WebSocketHandshakeException.class, exception.getCause());

        assertEquals(403, handshake.getResponse().statusCode());
    }

    private WebSocket connect(String origin) throws Exception {
        return HttpClient.newHttpClient().newWebSocketBuilder()
                .connectTimeout(Duration.ofSeconds(5)).header("Origin", origin)
                .subprotocols("v12.stomp")
                .buildAsync(URI.create("ws://localhost:" + port + "/ws/websocket"), new WebSocket.Listener() { })
                .get(5, TimeUnit.SECONDS);
    }
}
