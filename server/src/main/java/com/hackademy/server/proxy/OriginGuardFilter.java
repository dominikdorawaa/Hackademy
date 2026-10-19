package com.hackademy.server.proxy;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Enumeration;
import java.util.List;

public class OriginGuardFilter extends OncePerRequestFilter {

    public static final String SECRET_HEADER = "X-Origin-Verify";

    private final List<byte[]> secretDigests;

    public OriginGuardFilter(OriginGuardProperties properties) {
        this.secretDigests = properties.secrets().stream().map(OriginGuardFilter::digest).toList();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!verified(request.getHeaders(SECRET_HEADER))) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setHeader(HttpHeaders.CACHE_CONTROL, CacheControl.noStore().getHeaderValue());
            response.setContentLength(0);
            return;
        }
        chain.doFilter(new VerifiedProxyRequestWrapper(request), response);
    }

    private boolean verified(Enumeration<String> values) {
        if (values == null || !values.hasMoreElements()) {
            return false;
        }
        String value = values.nextElement();
        if (value == null || values.hasMoreElements()) {
            return false;
        }
        byte[] candidate = digest(value);
        boolean matched = false;
        for (byte[] secret : secretDigests) {
            matched |= MessageDigest.isEqual(secret, candidate);
        }
        return matched;
    }

    private static byte[] digest(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
