package com.hackademy.server.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PathAdminDetailDto {
    private Long id;
    private String title;
    private String description;
    private String bannerUrl;
    private boolean hasBanner;
    private List<Long> roomIds;
}

