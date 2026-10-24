package com.hackademy.server.bugreport;

public class BugReportLimitException extends RuntimeException {

    private final long retryAfterSeconds;

    public BugReportLimitException(long retryAfterSeconds) {
        super("Wysłano już dużo zgłoszeń. Kolejne możesz wysłać za " + Math.max(1, (retryAfterSeconds + 59) / 60) + " min.");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long retryAfterSeconds() {
        return retryAfterSeconds;
    }
}
