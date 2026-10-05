package com.hackademy.server.dashboard;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserWeeklyActiveTimeRepository extends JpaRepository<UserWeeklyActiveTime, UserWeeklyActiveTimeId> {
}

