package com.hackademy.server.dashboard;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserWeeklyActiveTimeRepository extends JpaRepository<UserWeeklyActiveTime, UserWeeklyActiveTimeId> {
    @org.springframework.data.jpa.repository.Query(value = """
            WITH changed AS (
                INSERT INTO user_weekly_active_time(user_id, week_key, seconds, updated_at, active)
                VALUES (:userId, :week, 0, LOCALTIMESTAMP, :active)
                ON CONFLICT (user_id, week_key) DO UPDATE SET
                    seconds = user_weekly_active_time.seconds + CASE WHEN user_weekly_active_time.active
                        THEN LEAST(60, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM
                            (LOCALTIMESTAMP - user_weekly_active_time.updated_at)))::integer)) ELSE 0 END,
                    updated_at = LOCALTIMESTAMP,
                    active = :active
                RETURNING seconds
            ) SELECT seconds FROM changed
            """, nativeQuery = true)
    int recordActivity(@org.springframework.data.repository.query.Param("userId") Long userId,
            @org.springframework.data.repository.query.Param("week") String week,
            @org.springframework.data.repository.query.Param("active") boolean active);
}

