package com.hackademy.server.dashboard;

import java.time.LocalDate;

public record ActivityDto(
    LocalDate date,
    long count
) {}
