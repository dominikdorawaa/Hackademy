package com.hackademy.server.service;

import com.hackademy.server.dto.CreatePathRequest;
import com.hackademy.server.dto.PathAdminDetailDto;
import com.hackademy.server.dto.PathDetailDto;
import com.hackademy.server.dto.PathSummaryDto;
import com.hackademy.server.dto.UpdatePathMetaRequest;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface PathService {
    List<PathSummaryDto> listPaths();
    PathDetailDto getPathDetail(Long id, String username);
    PathSummaryDto createPath(CreatePathRequest request);
    void deletePath(Long id);
    PathAdminDetailDto getAdminDetail(Long id);
    void updatePathMeta(Long id, UpdatePathMetaRequest request);
    void updatePathRooms(Long id, List<Long> roomIds);

    void uploadBanner(Long id, MultipartFile file);
    byte[] getBannerData(Long id);
    String getBannerMime(Long id);
}

