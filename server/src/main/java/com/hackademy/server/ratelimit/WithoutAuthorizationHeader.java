package com.hackademy.server.ratelimit;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import org.springframework.http.HttpHeaders;

import java.util.Collections;
import java.util.Enumeration;

class WithoutAuthorizationHeader extends HttpServletRequestWrapper {

    WithoutAuthorizationHeader(HttpServletRequest request) {
        super(request);
    }

    @Override
    public String getHeader(String name) {
        return isAuthorization(name) ? null : super.getHeader(name);
    }

    @Override
    public Enumeration<String> getHeaders(String name) {
        return isAuthorization(name) ? Collections.emptyEnumeration() : super.getHeaders(name);
    }

    @Override
    public Enumeration<String> getHeaderNames() {
        return Collections.enumeration(Collections.list(super.getHeaderNames()).stream()
                .filter(name -> !isAuthorization(name)).toList());
    }

    private static boolean isAuthorization(String name) {
        return HttpHeaders.AUTHORIZATION.equalsIgnoreCase(name);
    }
}
