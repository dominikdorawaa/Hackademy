package com.hackademy.server.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomTaskDto {
    private Long id;
    private String title;
    private String content;
    private String question;
    private boolean completed;
}
