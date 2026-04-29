package com.hackademy.server.repository;

import com.hackademy.server.model.Friendship;
import com.hackademy.server.model.FriendshipStatus;
import com.hackademy.server.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

    @Query("SELECT f FROM Friendship f WHERE (f.requester = :user OR f.receiver = :user) AND f.status = :status")
    List<Friendship> findByUserAndStatus(@Param("user") User user, @Param("status") FriendshipStatus status);

    @Query("SELECT COUNT(f) FROM Friendship f WHERE (f.requester.id = :userId OR f.receiver.id = :userId) AND f.status = :status")
    long countByUserIdAndStatus(@Param("userId") Long userId, @Param("status") FriendshipStatus status);

    @Query("SELECT f FROM Friendship f WHERE f.receiver = :user AND f.status = 'PENDING'")
    List<Friendship> findPendingRequestsForUser(@Param("user") User user);

    @Query("SELECT f FROM Friendship f WHERE (f.requester = :user1 AND f.receiver = :user2) OR (f.requester = :user2 AND f.receiver = :user1)")
    Optional<Friendship> findFriendshipBetween(@Param("user1") User user1, @Param("user2") User user2);
}
