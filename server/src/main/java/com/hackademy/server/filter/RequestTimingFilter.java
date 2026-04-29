package com.hackademy.server.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class RequestTimingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RequestTimingFilter.class);

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        long startNs = System.nanoTime();
        try {
            filterChain.doFilter(request, response);
        } finally {
            long ms = (System.nanoTime() - startNs) / 1_000_000;
            String method = request.getMethod();
            String path = request.getRequestURI();
            int status = response.getStatus();

            // Log only API calls (and optionally only slow ones).
            if (path != null && path.startsWith("/api")) {
                if (ms >= 200) {
                    log.warn("SLOW {} {} -> {} ({} ms)", method, path, status, ms);
                } else {
                    log.info("{} {} -> {} ({} ms)", method, path, status, ms);
                }
            }
        }
    }
}

