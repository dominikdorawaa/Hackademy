package com.hackademy.server.proxy;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OriginGuardFilterTest {

    private static final String OLD = "old-secret-0123456789abcdef0123456789";
    private static final String NEW = "new-secret-0123456789abcdef0123456789";

    private final OriginGuardFilter filter = new OriginGuardFilter(new OriginGuardProperties(List.of(OLD, NEW)));

    @Test
    void rejectsRequestsWithoutTheSecretBeforeTheApplication() throws Exception {
        var response = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilter(request(), response, chain);

        assertRejected(response, chain);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "wrong", "old-secret-0123456789abcdef012345678", "old-secret-0123456789abcdef0123456789x"})
    void rejectsWrongSecrets(String secret) throws Exception {
        var request = request();
        request.addHeader(OriginGuardFilter.SECRET_HEADER, secret);
        var response = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertRejected(response, chain);
    }

    @Test
    void rejectsARepeatedSecretHeader() throws Exception {
        var request = request();
        request.addHeader(OriginGuardFilter.SECRET_HEADER, "forged");
        request.addHeader(OriginGuardFilter.SECRET_HEADER, NEW);
        var response = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertRejected(response, chain);
    }

    @ParameterizedTest
    @ValueSource(strings = {OLD, NEW})
    void acceptsEveryConfiguredSecretDuringRotation(String secret) throws Exception {
        var request = request();
        request.addHeader(OriginGuardFilter.SECRET_HEADER, secret);
        var chain = new MockFilterChain();

        filter.doFilter(request, new MockHttpServletResponse(), chain);

        assertInstanceOf(VerifiedProxyRequestWrapper.class, chain.getRequest());
    }

    @Test
    void hidesTheSecretFromTheApplication() throws Exception {
        var request = request();
        request.addHeader(OriginGuardFilter.SECRET_HEADER, NEW);
        request.addHeader("Authorization", "Bearer token");
        var chain = new MockFilterChain();

        filter.doFilter(request, new MockHttpServletResponse(), chain);

        var forwarded = (HttpServletRequest) chain.getRequest();
        assertNull(forwarded.getHeader(OriginGuardFilter.SECRET_HEADER));
        assertNull(forwarded.getHeader("x-origin-verify"));
        assertFalse(forwarded.getHeaders(OriginGuardFilter.SECRET_HEADER).hasMoreElements());
        assertEquals(List.of("Authorization"), Collections.list(forwarded.getHeaderNames()));
        assertEquals("Bearer token", forwarded.getHeader("Authorization"));
        assertTrue(forwarded.getHeaders("Authorization").hasMoreElements());
    }

    @Test
    void trustsTheCloudflareClientAddressOnlyAfterVerification() throws Exception {
        var request = request();
        request.setRemoteAddr("10.1.2.3");
        request.setRemoteHost("router.heroku");
        request.addHeader(OriginGuardFilter.SECRET_HEADER, OLD);
        request.addHeader(VerifiedProxyRequestWrapper.CLIENT_IP_HEADER, "203.0.113.7");
        var chain = new MockFilterChain();

        filter.doFilter(request, new MockHttpServletResponse(), chain);

        var forwarded = (HttpServletRequest) chain.getRequest();
        assertEquals("203.0.113.7", forwarded.getRemoteAddr());
        assertEquals("203.0.113.7", forwarded.getRemoteHost());
    }

    @Test
    void keepsTheConnectionAddressWhenCloudflareSentNoUsableClientAddress() throws Exception {
        var request = request();
        request.setRemoteAddr("10.1.2.3");
        request.setRemoteHost("router.heroku");
        request.addHeader(OriginGuardFilter.SECRET_HEADER, OLD);
        request.addHeader(VerifiedProxyRequestWrapper.CLIENT_IP_HEADER, "evil.example");
        var chain = new MockFilterChain();

        filter.doFilter(request, new MockHttpServletResponse(), chain);

        var forwarded = (HttpServletRequest) chain.getRequest();
        assertEquals("10.1.2.3", forwarded.getRemoteAddr());
        assertEquals("router.heroku", forwarded.getRemoteHost());
    }

    @ParameterizedTest
    @CsvSource(nullValues = "null", value = {
            "203.0.113.7, 203.0.113.7",
            "' 198.51.100.1 ', 198.51.100.1",
            "2001:db8::1, 2001:db8:0:0:0:0:0:1",
            "::ffff:192.0.2.1, 192.0.2.1",
            "null, null",
            "'', null",
            "256.1.1.1, null",
            "1.2.3, null",
            "localhost, null",
            "2001:db8::zz, null",
            "2001:db8:::1:2:3:4:5, null",
            "'203.0.113.7, 198.51.100.1', null"
    })
    void acceptsOnlyLiteralClientAddresses(String header, String expected) {
        assertEquals(expected, VerifiedProxyRequestWrapper.clientIp(header));
    }

    private static MockHttpServletRequest request() {
        return new MockHttpServletRequest("GET", "/api/user/me");
    }

    private static void assertRejected(MockHttpServletResponse response, MockFilterChain chain) {
        assertEquals(403, response.getStatus());
        assertEquals("no-store", response.getHeader("Cache-Control"));
        assertEquals(0, response.getContentAsByteArray().length);
        assertNull(chain.getRequest());
    }
}
