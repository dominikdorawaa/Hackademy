package com.hackademy.server.bugreport;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class BugReportPropertiesTest {

    @Test
    void needsAPositiveHourlyLimitAndADailyLimitNotBelowIt() {
        assertThrows(IllegalArgumentException.class, () -> new BugReportProperties(0, 20));
        assertThrows(IllegalArgumentException.class, () -> new BugReportProperties(5, 4));
        assertEquals(5, new BugReportProperties(5, 5).dailyLimit());
    }

    @Test
    void roundsTheWaitUpToWholeMinutes() {
        assertEquals("Wysłano już dużo zgłoszeń. Kolejne możesz wysłać za 1 min.", new BugReportLimitException(1).getMessage());
        assertEquals("Wysłano już dużo zgłoszeń. Kolejne możesz wysłać za 2 min.", new BugReportLimitException(61).getMessage());
        assertEquals(61, new BugReportLimitException(61).retryAfterSeconds());
    }
}
