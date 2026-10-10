package com.hackademy.server.dashboard;

import java.time.LocalDate;
import java.time.temporal.WeekFields;
import java.util.Locale;

public final class ActivityWeek {

    private ActivityWeek() {
    }

    public static String keyFor(LocalDate date) {
        WeekFields weekFields = WeekFields.of(Locale.getDefault());
        return String.format("%d-W%02d", date.get(weekFields.weekBasedYear()), date.get(weekFields.weekOfWeekBasedYear()));
    }

    public static String currentKey() {
        return keyFor(LocalDate.now());
    }
}
