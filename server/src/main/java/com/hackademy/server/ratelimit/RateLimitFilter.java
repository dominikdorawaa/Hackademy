package com.hackademy.server.ratelimit;

import com.hackademy.server.bugreport.BugReportController;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.UrlPathHelper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.regex.Pattern;

@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

    static final String BEARER_PREFIX = "Bearer ";
    private static final Set<String> UNLIMITED_PATHS = Set.of("/", "/health");
    private static final Set<String> READ_METHODS = Set.of(HttpMethod.GET.name(), HttpMethod.HEAD.name());
    private static final Pattern BANNER = Pattern.compile("/api/paths/[^/]+/banner");

    private final RateLimitProperties properties;
    private final RateLimiter limiter;
    private final JwtDecoder jwtDecoder;

    public RateLimitFilter(RateLimitProperties properties, RateLimiter limiter, JwtDecoder jwtDecoder) {
        this.properties = properties;
        this.limiter = limiter;
        this.jwtDecoder = jwtDecoder;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        return !properties.enabled();
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String path = path(request);
        boolean exempt = HttpMethod.OPTIONS.matches(request.getMethod()) || UNLIMITED_PATHS.contains(path);
        boolean api = path.startsWith("/api/");
        HttpServletRequest forwarded = api && !exempt ? request : new WithoutAuthorizationHeader(request);
        if (exempt) {
            filterChain.doFilter(forwarded, response);
            return;
        }
        String account = api ? account(request) : null;
        RateLimitGroup group = group(request.getMethod(), path, account != null);
        String id = group.perAccount() ? "account:" + account : "ip:" + ClientAddress.key(request.getRemoteAddr());
        RateLimitDecision decision = limiter.acquire(group.name(), id, properties.rule(group));
        if (decision.allowed()) {
            filterChain.doFilter(forwarded, response);
            return;
        }
        log.debug("Rate limited {} request to {}", group, path);
        reject(response, decision.retryAfterSeconds());
    }

    static RateLimitGroup group(String method, String path, boolean authenticated) {
        if (path.equals("/ws") || path.startsWith("/ws/")) {
            return path.equals("/ws/info") || path.endsWith("/websocket")
                    ? RateLimitGroup.WEBSOCKET_HANDSHAKE
                    : RateLimitGroup.WEBSOCKET_TRANSPORT;
        }
        if (!authenticated) {
            return READ_METHODS.contains(method) && BANNER.matcher(path).matches()
                    ? RateLimitGroup.PUBLIC_BANNER
                    : RateLimitGroup.ANONYMOUS;
        }
        if (HttpMethod.POST.matches(method) && path.equals(BugReportController.PATH)) {
            return RateLimitGroup.BUG_REPORT;
        }
        return READ_METHODS.contains(method) ? RateLimitGroup.API_READ : RateLimitGroup.API_WRITE;
    }

    private String account(HttpServletRequest request) {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
            return null;
        }
        String token = authorization.substring(BEARER_PREFIX.length()).trim();
        if (token.isEmpty()) {
            return null;
        }
        try {
            return jwtDecoder.decode(token).getSubject();
        } catch (JwtException exception) {
            return null;
        }
    }

    private static void reject(HttpServletResponse response, long retryAfterSeconds) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(retryAfterSeconds));
        response.setHeader(HttpHeaders.CACHE_CONTROL, CacheControl.noStore().getHeaderValue());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"message\":\"Zbyt wiele żądań. Spróbuj ponownie za " + retryAfterSeconds
                + " s.\",\"retryAfter\":" + retryAfterSeconds + "}");
    }

    private static String path(HttpServletRequest request) {
        return UrlPathHelper.defaultInstance.getPathWithinApplication(request);
    }
}
