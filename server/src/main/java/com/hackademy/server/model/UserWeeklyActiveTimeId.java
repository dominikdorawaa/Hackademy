package com.hackademy.server.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserWeeklyActiveTimeId implements Serializable {
    private Long userId;
    private String weekKey;
}

