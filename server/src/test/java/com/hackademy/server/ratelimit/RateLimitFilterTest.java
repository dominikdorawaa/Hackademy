package com.hackademy.server.ratelimit;

import com.hackademy.server.ClerkTestTokens;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

import java.time.Duration;
import java.time.Instant;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RateLimitFilterTest {

    private static final RateLimitProperties.Rule ONE = new RateLimitProperties.Rule(1, 1, Duration.ofMinutes(1));
    private static final RateLimitProperties.Rule TWO = new RateLimitProperties.Rule(2, 2, Duration.ofMinutes(1));

    private final MutableClock clock = new MutableClock();
    private final JwtDecoder decoder = token -> switch (token) {
        case "alice" -> jwt("user_alice");
        case "bob" -> jwt("user_bob");
        default -> throw new BadJwtException("invalid");
    };

    private RateLimitFilter filter(boolean enabled) {
        var rules = new RateLimitProperties.Rules(ONE, ONE, TWO, TWO, ONE, TWO, ONE);
        return new RateLimitFilter(new RateLimitProperties(enabled, 100, rules), new RateLimiter(clock, 100), decoder);
    }

    private final RateLimitFilter filter = filter(true);

    @ParameterizedTest
    @CsvSource({
            "GET, /api/rooms, true, API_READ",
            "HEAD, /api/rooms, true, API_READ",
            "POST, /api/rooms/1/solve, true, API_WRITE",
            "PUT, /api/user/me, true, API_WRITE",
            "PATCH, /api/user/me, true, API_WRITE",
            "DELETE, /api/friends/2, true, API_WRITE",
            "POST, /api/bug-reports, true, BUG_REPORT",
            "POST, /api/bug-reports, false, ANONYMOUS",
            "GET, /api/bug-reports, true, API_READ",
            "POST, /api/bug-reports/1, true, API_WRITE",
            "POST, /api/admin/bug-reports, true, API_WRITE",
            "GET, /api/rooms/top3, false, ANONYMOUS",
            "POST, /api/rooms/1/solve, false, ANONYMOUS",
            "GET, /missing, false, ANONYMOUS",
            "GET, /api/paths/7/banner, false, PUBLIC_BANNER",
            "HEAD, /api/paths/7/banner, false, PUBLIC_BANNER",
            "POST, /api/paths/7/banner, false, ANONYMOUS",
            "GET, /api/paths/7/banner/x, false, ANONYMOUS",
            "GET, /api/paths/7/banner, true, API_READ",
            "GET, /ws/info, false, WEBSOCKET_HANDSHAKE",
            "GET, /ws/websocket, false, WEBSOCKET_HANDSHAKE",
            "GET, /ws/123/abcdef/websocket, false, WEBSOCKET_HANDSHAKE",
            "POST, /ws/123/abcdef/xhr_send, false, WEBSOCKET_TRANSPORT",
            "POST, /ws/123/abcdef/xhr, false, WEBSOCKET_TRANSPORT",
            "POST, /ws/123/abcdef/xhr_streaming, false, WEBSOCKET_TRANSPORT",
            "GET, /ws/iframe.html, false, WEBSOCKET_TRANSPORT",
            "GET, /ws, false, WEBSOCKET_TRANSPORT"
    })
    void sortsRequestsIntoGroups(String method, String path, boolean authenticated, RateLimitGroup expected) {
        assertEquals(expected, RateLimitFilter.group(method, path, authenticated));
    }

    @Test
    void rejectsTheRequestBeforeTheApplicationWithARetryTime() throws Exception {
        assertNotNull(send(get("/api/rooms", "alice")).chain.getRequest());
        clock.advance(Duration.ofMillis(400));

        var rejected = send(get("/api/rooms", "alice"));

        assertNull(rejected.chain.getRequest());
        assertEquals(429, rejected.response.getStatus());
        assertEquals("60", rejected.response.getHeader("Retry-After"));
        assertEquals("no-store", rejected.response.getHeader("Cache-Control"));
        assertTrue(rejected.response.getContentType().startsWith("application/json"));
        assertEquals("{\"message\":\"Zbyt wiele żądań. Spróbuj ponownie za 60 s.\",\"retryAfter\":60}",
                rejected.response.getContentAsString());
    }

    @Test
    void countsSignedInRequestsPerAccountWhateverTheAddress() throws Exception {
        var first = get("/api/rooms", "alice");
        first.setRemoteAddr("198.51.100.1");
        var second = get("/api/rooms", "alice");
        second.setRemoteAddr("198.51.100.2");
        var otherAccountSameAddress = get("/api/rooms", "bob");
        otherAccountSameAddress.setRemoteAddr("198.51.100.1");

        assertEquals(200, send(first).response.getStatus());
        assertEquals(429, send(second).response.getStatus());
        assertEquals(200, send(otherAccountSameAddress).response.getStatus());
    }

    @Test
    void keepsReadsAndWritesOfOneAccountApart() throws Exception {
        assertEquals(200, send(get("/api/rooms", "alice")).response.getStatus());
        var write = get("/api/rooms/1/solve", "alice");
        write.setMethod("POST");

        assertEquals(200, send(write).response.getStatus());
        assertEquals(429, send(get("/api/rooms", "alice")).response.getStatus());
    }

    @Test
    void limitsBugReportsSeparatelyFromOtherWritesOfTheAccount() throws Exception {
        assertEquals(200, send(post("/api/bug-reports", "alice")).response.getStatus());
        var again = send(post("/api/bug-reports", "alice"));

        assertNull(again.chain.getRequest());
        assertEquals(429, again.response.getStatus());
        assertEquals("60", again.response.getHeader("Retry-After"));
        assertEquals(200, send(post("/api/rooms/1/solve", "alice")).response.getStatus());
        assertEquals(200, send(post("/api/bug-reports", "bob")).response.getStatus());
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/%62ug-reports", "/api/bug%2Dreports", "/api/bug-reports;x=1"})
    void decodesTheAddressBeforeChoosingTheGroup(String path) throws Exception {
        assertEquals(200, send(post("/api/bug-reports", "alice")).response.getStatus());

        assertEquals(429, send(post(path, "alice")).response.getStatus());
    }

    @ParameterizedTest
    @ValueSource(strings = {"Bearer forged", "Bearer ", "Basic YWxpY2U6c2VjcmV0", "alice"})
    void countsRequestsWithoutAValidTokenPerAddress(String authorization) throws Exception {
        var request = get("/api/rooms/top3", null);
        request.addHeader("Authorization", authorization);
        send(request);
        var again = get("/api/rooms/top3", null);
        again.addHeader("Authorization", authorization);
        send(again);
        var third = get("/api/rooms/top3", null);
        third.addHeader("Authorization", authorization);

        assertEquals(429, send(third).response.getStatus());
        var otherAddress = get("/api/rooms/top3", null);
        otherAddress.setRemoteAddr("198.51.100.9");
        assertEquals(200, send(otherAddress).response.getStatus());
    }

    @Test
    void ignoresForwardingHeadersAndUsesTheVerifiedAddress() throws Exception {
        for (int i = 0; i < 3; i++) {
            var request = get("/api/rooms/top3", null);
            request.addHeader("X-Forwarded-For", "203.0.113." + i);
            request.addHeader("Forwarded", "for=203.0.113." + i);
            request.addHeader("CF-Connecting-IP", "203.0.113." + i);
            var result = send(request);
            assertEquals(i < 2 ? 200 : 429, result.response.getStatus());
        }
    }

    @Test
    void doesNotDecodeTokensOutsideTheApi() throws Exception {
        var handshake = get("/ws/info", "alice");
        var next = get("/ws/info", "bob");

        assertEquals(200, send(handshake).response.getStatus());
        assertEquals(429, send(next).response.getStatus());
    }

    @ParameterizedTest
    @CsvSource({"GET, /health", "GET, /", "OPTIONS, /api/rooms"})
    void neverLimitsHealthChecksAndPreflight(String method, String path) throws Exception {
        for (int i = 0; i < 5; i++) {
            var request = get(path, null);
            request.setMethod(method);
            assertNotNull(send(request).chain.getRequest());
        }
    }

    @ParameterizedTest
    @CsvSource({"GET, /health", "GET, /", "OPTIONS, /api/user/me", "GET, /ws/info", "POST, /ws/1/abc/xhr_send", "GET, /missing"})
    void hidesTheBearerTokenFromRequestsThatAreNotLimitedPerAccount(String method, String path) throws Exception {
        var request = get(path, "alice");
        request.setMethod(method);

        var forwarded = (HttpServletRequest) send(request).chain.getRequest();

        assertNull(forwarded.getHeader("Authorization"));
        assertFalse(forwarded.getHeaders("authorization").hasMoreElements());
        assertFalse(Collections.list(forwarded.getHeaderNames()).stream().anyMatch("Authorization"::equalsIgnoreCase));
        assertEquals(request.getRemoteAddr(), forwarded.getRemoteAddr());
    }

    @Test
    void keepsTheBearerTokenAndOtherHeadersForLimitedApiRequests() throws Exception {
        var request = get("/api/rooms", "alice");
        request.addHeader("X-Trace", "1");

        var forwarded = (HttpServletRequest) send(request).chain.getRequest();

        assertEquals("Bearer alice", forwarded.getHeader("Authorization"));
        var hidden = (HttpServletRequest) send(withTrace(get("/health", "alice"))).chain.getRequest();
        assertEquals("1", hidden.getHeader("X-Trace"));
        assertTrue(hidden.getHeaders("X-Trace").hasMoreElements());
    }

    @Test
    void stripsTheContextPath() throws Exception {
        for (int i = 0; i < 5; i++) {
            var request = get("/app/health", null);
            request.setContextPath("/app");
            assertNotNull(send(request).chain.getRequest());
        }
    }

    @Test
    void passesEverythingThroughWhenDisabled() throws Exception {
        var disabled = filter(false);
        for (int i = 0; i < 5; i++) {
            var response = new MockHttpServletResponse();
            var chain = new MockFilterChain();
            disabled.doFilter(get("/api/rooms", "alice"), response, chain);
            assertNotNull(chain.getRequest());
        }
    }

    private Result send(MockHttpServletRequest request) throws Exception {
        var response = new MockHttpServletResponse();
        var chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        return new Result(response, chain);
    }

    private static MockHttpServletRequest post(String path, String token) {
        var request = get(path, token);
        request.setMethod("POST");
        return request;
    }

    private static MockHttpServletRequest get(String path, String token) {
        var request = new MockHttpServletRequest("GET", path);
        request.setRemoteAddr("198.51.100.1");
        if (token != null) request.addHeader("Authorization", "Bearer " + token);
        return request;
    }

    private static MockHttpServletRequest withTrace(MockHttpServletRequest request) {
        request.addHeader("X-Trace", "1");
        return request;
    }

    private static Jwt jwt(String subject) {
        return Jwt.withTokenValue("token").header("alg", "RS256").subject(subject)
                .issuer(ClerkTestTokens.ISSUER).issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();
    }

    private record Result(MockHttpServletResponse response, MockFilterChain chain) {
    }
}
