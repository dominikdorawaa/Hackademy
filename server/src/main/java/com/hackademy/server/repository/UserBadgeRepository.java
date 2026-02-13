package com.hackademy.server.repository;

import com.hackademy.server.model.UserBadge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface UserBadgeRepository extends JpaRepository<UserBadge, Long> {
    List<UserBadge> findByUser_Id(Long userId);
    boolean existsByUser_IdAndBadge_Id(Long userId, Long badgeId);
    long countByBadge_Id(Long badgeId);

    // Optimized query to get counts for all badges at once
    @Query("SELECT ub.badge.id, COUNT(ub) FROM UserBadge ub GROUP BY ub.badge.id")
    List<Object[]> countAllBadges();

    @Modifying
    @Transactional
    @Query("DELETE FROM UserBadge ub WHERE ub.user.id = :userId")
    void deleteByUserId(Long userId);
}
