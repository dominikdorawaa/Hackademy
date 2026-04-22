package com.hackademy.server.service;

import com.hackademy.server.dto.CreatePathRequest;
import com.hackademy.server.dto.PathAdminDetailDto;
import com.hackademy.server.dto.PathDetailDto;
import com.hackademy.server.dto.PathSummaryDto;

import java.util.List;

public interface PathService {
    List<PathSummaryDto> listPaths();
    PathDetailDto getPathDetail(Long id, String username);
    PathSummaryDto createPath(CreatePathRequest request);
    void deletePath(Long id);
    PathAdminDetailDto getAdminDetail(Long id);
    void updatePathRooms(Long id, List<Long> roomIds);
}

