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
        Integer getRoomsCount();
    }

    @Query(value = """
            SELECT
              p.id AS id,
              p.title AS title,
              p.description AS description,
              p.banner_url AS bannerUrl,
              (p.banner_data IS NOT NULL) AS hasBanner,
              COUNT(pr.room_id) AS roomsCount
            FROM paths p
            LEFT JOIN path_chapters pc ON pc.path_id = p.id
            LEFT JOIN chapter_rooms pr ON pr.chapter_id = pc.id
            GROUP BY p.id
            ORDER BY p.id
            """, nativeQuery = true)
    List<PathListView> findAllListViews();

    interface PathProgressView {
        Long getId();
        String getTitle();
        String getDescription();
        String getBannerUrl();
        Boolean getHasBanner();
        Integer getTotalRooms();
        Integer getSolvedRooms();
    }

    @Query(value = """
            SELECT
              p.id AS id,
              p.title AS title,
              p.description AS description,
              p.banner_url AS bannerUrl,
              (p.banner_data IS NOT NULL) AS hasBanner,
              COUNT(pr.room_id) AS totalRooms,
              COUNT(usr.room_id) AS solvedRooms
            FROM paths p
            LEFT JOIN path_chapters pc ON pc.path_id = p.id
            LEFT JOIN chapter_rooms pr ON pr.chapter_id = pc.id
            LEFT JOIN users u ON u.username = :username
            LEFT JOIN user_solved_rooms usr ON usr.user_id = u.id AND usr.room_id = pr.room_id
            GROUP BY p.id
            ORDER BY p.id
            """, nativeQuery = true)
    List<PathProgressView> findProgressForUsername(@Param("username") String username);
}

