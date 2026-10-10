package com.hackademy.server.path;

import com.hackademy.server.path.dto.CreatePathRequest;
import com.hackademy.server.path.dto.PathAdminDetailDto;
import com.hackademy.server.path.dto.PathDetailDto;
import com.hackademy.server.path.dto.PathProgressDto;
import com.hackademy.server.path.dto.PathRoomsMiniResponse;
import com.hackademy.server.path.dto.PathSummaryDto;
import com.hackademy.server.path.dto.UpdatePathChaptersRequest;
import com.hackademy.server.path.dto.UpdatePathMetaRequest;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface PathService {
    List<PathSummaryDto> listPaths(String username);
    PathDetailDto getPathDetail(Long id, String username);
    List<PathProgressDto> getMyPathsProgress(String username);
    PathRoomsMiniResponse getPathRoomsMini(Long id, String username, int limit);
    PathSummaryDto createPath(CreatePathRequest request);
    void deletePath(Long id);
    PathAdminDetailDto getAdminDetail(Long id);
    void updatePathMeta(Long id, UpdatePathMetaRequest request);
    PathAdminDetailDto updatePathChapters(Long id, UpdatePathChaptersRequest request, boolean canDeleteChapters);

    void uploadBanner(Long id, MultipartFile file);
    byte[] getBannerData(Long id);
    String getBannerMime(Long id);

    void enrollUser(Long pathId, String username);
    void unenrollUser(Long pathId, String username);
    boolean isEnrolled(Long pathId, String username);
}

