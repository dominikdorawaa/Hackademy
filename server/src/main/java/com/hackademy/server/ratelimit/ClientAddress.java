package com.hackademy.server.ratelimit;

import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.HexFormat;
import java.util.regex.Pattern;

final class ClientAddress {

    static final int IPV6_PREFIX_BYTES = 8;
    private static final Pattern IPV6_LITERAL = Pattern.compile("[0-9A-Fa-f:.]{2,45}");

    private ClientAddress() {
    }

    static String key(String remoteAddress) {
        if (remoteAddress == null || remoteAddress.isBlank()) {
            return "unknown";
        }
        String address = remoteAddress.trim();
        if (!address.contains(":") || !IPV6_LITERAL.matcher(address).matches()) {
            return address;
        }
        try {
            InetAddress parsed = InetAddress.getByName(address);
            if (parsed instanceof Inet6Address) {
                byte[] prefix = new byte[IPV6_PREFIX_BYTES];
                System.arraycopy(parsed.getAddress(), 0, prefix, 0, IPV6_PREFIX_BYTES);
                return HexFormat.of().formatHex(prefix) + "::/64";
            }
            return parsed.getHostAddress();
        } catch (UnknownHostException exception) {
            return address;
        }
    }
}
