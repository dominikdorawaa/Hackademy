package com.hackademy.server.proxy;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Collections;
import java.util.Enumeration;
import java.util.regex.Pattern;

class VerifiedProxyRequestWrapper extends HttpServletRequestWrapper {

    static final String CLIENT_IP_HEADER = "CF-Connecting-IP";
    private static final Pattern IPV4 = Pattern.compile("((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)");
    private static final Pattern IPV6 = Pattern.compile("[0-9A-Fa-f:.]{2,45}");

    private final String clientIp;

    VerifiedProxyRequestWrapper(HttpServletRequest request) {
        super(request);
        this.clientIp = clientIp(request.getHeader(CLIENT_IP_HEADER));
    }

    @Override
    public String getRemoteAddr() {
        return clientIp == null ? super.getRemoteAddr() : clientIp;
    }

    @Override
    public String getRemoteHost() {
        return clientIp == null ? super.getRemoteHost() : clientIp;
    }

    @Override
    public String getHeader(String name) {
        return isSecret(name) ? null : super.getHeader(name);
    }

    @Override
    public Enumeration<String> getHeaders(String name) {
        return isSecret(name) ? Collections.emptyEnumeration() : super.getHeaders(name);
    }

    @Override
    public Enumeration<String> getHeaderNames() {
        return Collections.enumeration(Collections.list(super.getHeaderNames()).stream()
                .filter(name -> !isSecret(name)).toList());
    }

    private static boolean isSecret(String name) {
        return OriginGuardFilter.SECRET_HEADER.equalsIgnoreCase(name);
    }

    static String clientIp(String value) {
        if (value == null) {
            return null;
        }
        String candidate = value.trim();
        if (IPV4.matcher(candidate).matches()) {
            return candidate;
        }
        if (!candidate.contains(":") || !IPV6.matcher(candidate).matches()) {
            return null;
        }
        try {
            return InetAddress.getByName(candidate).getHostAddress();
        } catch (UnknownHostException exception) {
            return null;
        }
    }
}
