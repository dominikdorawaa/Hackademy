package com.hackademy.server.bugreport;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BugReportRepository extends JpaRepository<BugReport, Long> {

    String VIEW = """
            SELECT new com.hackademy.server.bugreport.BugReportView(b.id, u.username, b.source, b.roomId, r.title,
                b.taskId, t.title, b.gameId, b.lessonId, b.pagePath, b.description, b.status, b.createdAt, b.resolvedAt)
            FROM BugReport b JOIN b.reporter u
            LEFT JOIN Room r ON r.id = b.roomId
            LEFT JOIN RoomTask t ON t.id = b.taskId
            """;

    @Query(VIEW + "ORDER BY b.createdAt DESC, b.id DESC")
    Slice<BugReportView> findViews(Pageable pageable);

    @Query(VIEW + "WHERE b.status = :status ORDER BY b.createdAt DESC, b.id DESC")
    Slice<BugReportView> findViewsByStatus(@Param("status") BugReportStatus status, Pageable pageable);

    @Query(VIEW + "WHERE b.id = :id")
    Optional<BugReportView> findView(@Param("id") Long id);

    @Query(value = "SELECT id FROM users WHERE id = :id FOR UPDATE", nativeQuery = true)
    Optional<Long> lockReporter(@Param("id") Long id);

    @Query("SELECT b.createdAt FROM BugReport b WHERE b.reporter.id = :reporterId ORDER BY b.createdAt DESC")
    List<LocalDateTime> findRecentTimes(@Param("reporterId") Long reporterId, Pageable pageable);

    boolean existsByReporterIdAndDescriptionAndCreatedAtAfter(Long reporterId, String description, LocalDateTime after);

    @Query("SELECT count(t) > 0 FROM RoomTask t WHERE t.id = :taskId AND t.room.id = :roomId")
    boolean taskBelongsToRoom(@Param("taskId") Long taskId, @Param("roomId") Long roomId);
}
