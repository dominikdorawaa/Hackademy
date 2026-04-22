package com.hackademy.server.repository;

import com.hackademy.server.model.UserWeeklyActiveTime;
import com.hackademy.server.model.UserWeeklyActiveTimeId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserWeeklyActiveTimeRepository extends JpaRepository<UserWeeklyActiveTime, UserWeeklyActiveTimeId> {
}

