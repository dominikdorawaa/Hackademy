package com.hackademy.server.ratelimit;

public enum RateLimitGroup {
    API_READ(true),
    API_WRITE(true),
    BUG_REPORT(true),
    ANONYMOUS(false),
    PUBLIC_BANNER(false),
    WEBSOCKET_HANDSHAKE(false),
    WEBSOCKET_TRANSPORT(false);

    private final boolean perAccount;

    RateLimitGroup(boolean perAccount) {
        this.perAccount = perAccount;
    }

    public boolean perAccount() {
        return perAccount;
    }
}
