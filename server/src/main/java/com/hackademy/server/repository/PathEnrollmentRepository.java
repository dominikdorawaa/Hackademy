package com.hackademy.server.repository;

import com.hackademy.server.model.PathEnrollment;
import com.hackademy.server.model.PathEnrollmentId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Set;

public interface PathEnrollmentRepository extends JpaRepository<PathEnrollment, PathEnrollmentId> {

    boolean existsByUserIdAndPathId(Long userId, Long pathId);

    void deleteByUserIdAndPathId(Long userId, Long pathId);

    @Query("SELECT pe.pathId FROM PathEnrollment pe WHERE pe.userId = :userId")
    Set<Long> findPathIdsByUserId(@Param("userId") Long userId);

    List<PathEnrollment> findByUserId(Long userId);
}
