package com.hackademy.server.path;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PathChapterRepository extends JpaRepository<PathChapter, Long> {
    List<PathChapter> findByPathIdOrderBySortOrderAscIdAsc(Long pathId);
}
