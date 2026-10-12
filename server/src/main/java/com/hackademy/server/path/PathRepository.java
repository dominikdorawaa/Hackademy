package com.hackademy.server.path;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PathRepository extends JpaRepository<Path, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Path p WHERE p.id = :id")
    Optional<Path> findByIdForUpdate(@Param("id") Long id);

    interface PathListView {
        Long getId();
        String getTitle();
        String getDescription();
        String getBannerUrl();
        Boolean getHasBanner();
        Boolean getPublished();
        Integer getRoomsCount();
    }

    @Query(value = """
            SELECT
              p.id AS id,
              p.title AS title,
              p.published AS published,
              p.description AS description,
              p.banner_url AS bannerUrl,
              (p.banner_data IS NOT NULL) AS hasBanner,
              COUNT(r.id) AS roomsCount
            FROM paths p
            LEFT JOIN path_chapters pc ON pc.path_id = p.id
            LEFT JOIN chapter_rooms pr ON pr.chapter_id = pc.id
            LEFT JOIN rooms r ON r.id = pr.room_id AND r.published = true
            WHERE p.published = true
            GROUP BY p.id
            ORDER BY p.id
            """, nativeQuery = true)
    List<PathListView> findAllListViews();

    @Query(value = "SELECT p.id AS id, p.title AS title, p.description AS description, p.banner_url AS bannerUrl, (p.banner_data IS NOT NULL) AS hasBanner, p.published AS published, COUNT(cr.room_id) AS roomsCount FROM paths p LEFT JOIN path_chapters c ON c.path_id = p.id LEFT JOIN chapter_rooms cr ON cr.chapter_id = c.id GROUP BY p.id ORDER BY p.id", nativeQuery = true)
    List<PathListView> findAdminListViews();

    interface PathProgressView {
        Long getId();
        String getTitle();
        String getDescription();
        String getBannerUrl();
        Boolean getHasBanner();
        Boolean getPublished();
        Integer getTotalRooms();
        Integer getSolvedRooms();
    }

    @Query(value = """
            SELECT
              p.id AS id,
              p.title AS title,
              p.published AS published,
              p.description AS description,
              p.banner_url AS bannerUrl,
              (p.banner_data IS NOT NULL) AS hasBanner,
              COUNT(r.id) AS totalRooms,
              COUNT(CASE WHEN r.id IS NOT NULL THEN usr.room_id END) AS solvedRooms
            FROM paths p
            LEFT JOIN path_chapters pc ON pc.path_id = p.id
            LEFT JOIN chapter_rooms pr ON pr.chapter_id = pc.id
            LEFT JOIN rooms r ON r.id = pr.room_id AND r.published = true
            LEFT JOIN users u ON u.username = :username
            LEFT JOIN user_solved_rooms usr ON usr.user_id = u.id AND usr.room_id = pr.room_id
            WHERE p.published = true
            GROUP BY p.id
            ORDER BY p.id
            """, nativeQuery = true)
    List<PathProgressView> findProgressForUsername(@Param("username") String username);

    @Query(value = """
            SELECT COUNT(*) FROM paths p
            WHERE p.published = true AND EXISTS (
                SELECT 1 FROM path_chapters pc JOIN chapter_rooms pr ON pr.chapter_id = pc.id
                JOIN rooms r ON r.id = pr.room_id AND r.published = true
                WHERE pc.path_id = p.id
            )
              AND NOT EXISTS (
                SELECT 1 FROM path_chapters pc JOIN chapter_rooms pr ON pr.chapter_id = pc.id
                JOIN rooms r ON r.id = pr.room_id AND r.published = true
                WHERE pc.path_id = p.id
                  AND NOT EXISTS (
                    SELECT 1 FROM user_solved_rooms usr
                    WHERE usr.user_id = :userId AND usr.room_id = pr.room_id
                  )
              )
            """, nativeQuery = true)
    long countCompletedByUserId(@Param("userId") Long userId);
}

