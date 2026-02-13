package com.hackademy.server.repository;

import com.hackademy.server.dto.ActivityDto;
import com.hackademy.server.model.UserSolvedRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface UserSolvedRoomRepository extends JpaRepository<UserSolvedRoom, Long> {
    boolean existsByUser_IdAndRoom_Id(Long userId, Long roomId);
    boolean existsByUser_UsernameAndRoom_Title(String username, String roomTitle);
    long countByUser_Id(Long userId);
    List<UserSolvedRoom> findByUser_Id(Long userId);

    // Use native query for date casting to be safe with Postgres
    @Query(value = "SELECT CAST(solved_at AS date) as date, COUNT(*) as count " +
                   "FROM user_solved_rooms " +
                   "WHERE user_id = :userId AND solved_at >= :startDate " +
                   "GROUP BY CAST(solved_at AS date)", nativeQuery = true)
    List<Object[]> findUserActivityRaw(@Param("userId") Long userId, @Param("startDate") LocalDateTime startDate);

    // Default method to map Object[] to ActivityDto
    default List<ActivityDto> findUserActivity(Long userId, LocalDateTime startDate) {
        List<Object[]> results = findUserActivityRaw(userId, startDate);
        return results.stream()
                .map(row -> new ActivityDto(
                        ((java.sql.Date) row[0]).toLocalDate(),
                        ((Number) row[1]).longValue()
                ))
                .collect(java.util.stream.Collectors.toList());
    }
}
