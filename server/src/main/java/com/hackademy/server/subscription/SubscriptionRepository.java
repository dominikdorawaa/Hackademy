package com.hackademy.server.subscription;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface SubscriptionRepository extends JpaRepository<Subscription, Long> {

    @Query("""
            select count(u) > 0 from User u
            where u.id = :userId and (u.role <> com.hackademy.server.user.Role.USER
                or exists (select s from Subscription s where s.userId = u.id and s.activeUntil > :now))
            """)
    boolean unlimited(@Param("userId") Long userId, @Param("now") LocalDateTime now);

    boolean existsByUserIdAndActiveUntilAfter(Long userId, LocalDateTime now);

    @Query("""
            select u.id from User u
            where u.id in :userIds and (u.role <> com.hackademy.server.user.Role.USER
                or exists (select s from Subscription s where s.userId = u.id and s.activeUntil > :now))
            """)
    java.util.List<Long> findUnlimitedAmong(@Param("userIds") java.util.Collection<Long> userIds, @Param("now") LocalDateTime now);

    @Query("select s.userId from Subscription s where s.userId in :userIds and s.activeUntil > :now")
    java.util.List<Long> findActiveUserIds(@Param("userIds") java.util.Collection<Long> userIds, @Param("now") LocalDateTime now);
}
