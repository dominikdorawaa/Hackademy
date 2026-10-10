package com.hackademy.server.room;

import com.hackademy.server.dashboard.ActivityDto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface UserSolvedRoomRepository extends JpaRepository<UserSolvedRoom, Long> {
    interface PracticeAreaView {
        String getCategory();
        Long getSolvedRooms();
    }

    @Query(value = """
            SELECT TRIM(r.category) AS category, COUNT(DISTINCT usr.room_id) AS solvedRooms
            FROM user_solved_rooms usr JOIN rooms r ON r.id = usr.room_id
            WHERE usr.user_id = :userId AND TRIM(r.category) <> ''
            GROUP BY TRIM(r.category)
            ORDER BY COUNT(DISTINCT usr.room_id) DESC, TRIM(r.category)
            """, nativeQuery = true)
    List<PracticeAreaView> findPracticeAreas(@Param("userId") Long userId);

    boolean existsByUser_IdAndRoom_Id(Long userId, Long roomId);
    boolean existsByUser_UsernameAndRoom_Title(String username, String roomTitle);
    boolean existsByUser_IdAndRoom_Title(Long userId, String roomTitle);
    long countByUser_Id(Long userId);
    List<UserSolvedRoom> findByUser_Id(Long userId);
    List<UserSolvedRoom> findTop10ByUser_IdOrderBySolvedAtDesc(Long userId);

    @Query("SELECT usr.room.id FROM UserSolvedRoom usr WHERE usr.user.id = :userId")
    List<Long> findSolvedRoomIdsByUserId(@Param("userId") Long userId);

    @Query("SELECT usr.room.title FROM UserSolvedRoom usr WHERE usr.user.id = :userId AND usr.room.title IN :titles")
    List<String> findSolvedRoomTitlesByUserId(@Param("userId") Long userId, @Param("titles") List<String> titles);
    
    @Query(value = """
            SELECT 
              usr.room_id AS roomId,
              r.title AS title,
              r.difficulty AS difficulty,
              r.points AS points,
              usr.solved_at AS solvedAt
            FROM user_solved_rooms usr
            JOIN rooms r ON r.id = usr.room_id
            WHERE usr.user_id = :userId
            ORDER BY usr.solved_at DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<RecentSolvedRoomView> findRecentSolvedRooms(@Param("userId") Long userId, @Param("limit") int limit);

    interface ActivityRow {
        LocalDate getDate();
        Long getCount();
    }

    @Query(value = "SELECT CAST(solved_at AS date) as date, COUNT(*) as count " +
                   "FROM user_solved_rooms " +
                   "WHERE user_id = :userId AND solved_at >= :startDate " +
                   "GROUP BY CAST(solved_at AS date)", nativeQuery = true)
    List<ActivityRow> findUserActivityRaw(@Param("userId") Long userId, @Param("startDate") LocalDateTime startDate);

    default List<ActivityDto> findUserActivity(Long userId, LocalDateTime startDate) {
        List<ActivityRow> results = findUserActivityRaw(userId, startDate);
        return results.stream()
                .map(row -> new ActivityDto(
                        row.getDate(),
                        row.getCount()
                ))
                .collect(java.util.stream.Collectors.toList());
    }
}
