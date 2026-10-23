package com.hackademy.server.friendship;

import com.hackademy.server.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

    @Query("SELECT f FROM Friendship f JOIN FETCH f.requester JOIN FETCH f.receiver WHERE (f.requester = :user OR f.receiver = :user) AND f.status = :status")
    List<Friendship> findByUserAndStatus(@Param("user") User user, @Param("status") FriendshipStatus status);

    @Query("SELECT COUNT(f) FROM Friendship f WHERE (f.requester.id = :userId OR f.receiver.id = :userId) AND f.status = :status")
    long countByUserIdAndStatus(@Param("userId") Long userId, @Param("status") FriendshipStatus status);

    @Query("SELECT f FROM Friendship f JOIN FETCH f.requester WHERE f.receiver = :user AND f.status = 'PENDING'")
    List<Friendship> findPendingRequestsForUser(@Param("user") User user);

    @Query(value = "SELECT f.* FROM friendships f WHERE LEAST(f.requester_id, f.receiver_id) = LEAST(CAST(:#{#user1.id} AS bigint), CAST(:#{#user2.id} AS bigint)) AND GREATEST(f.requester_id, f.receiver_id) = GREATEST(CAST(:#{#user1.id} AS bigint), CAST(:#{#user2.id} AS bigint))", nativeQuery = true)
    Optional<Friendship> findFriendshipBetween(@Param("user1") User user1, @Param("user2") User user2);

    @Query("SELECT f FROM Friendship f WHERE (f.requester.id = :userId AND f.receiver.id IN :ids) OR (f.receiver.id = :userId AND f.requester.id IN :ids)")
    List<Friendship> findForSearch(@Param("userId") Long userId, @Param("ids") List<Long> ids);

    @Query("SELECT CASE WHEN f.requester.id = :userId THEN f.receiver.id ELSE f.requester.id END FROM Friendship f WHERE f.requester.id = :userId OR f.receiver.id = :userId")
    List<Long> findRelatedUserIds(@Param("userId") Long userId);

    @Query("SELECT CASE WHEN f.requester.id = :userId THEN f.receiver.id ELSE f.requester.id END FROM Friendship f "
            + "WHERE (f.requester.id = :userId OR f.receiver.id = :userId) AND f.status = 'ACCEPTED'")
    List<Long> findAcceptedFriendIds(@Param("userId") Long userId);
}
