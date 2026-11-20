package com.hackademy.server.path;

import com.hackademy.server.room.UserSolvedRoomRepository;
import com.hackademy.server.subscription.SubscriptionAccess;
import com.hackademy.server.subscription.SubscriptionRequiredException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class PathUnlockPolicy {

    public record Locks(Set<Long> chapterIds, Set<Long> roomIds) {
        public static final Locks NONE = new Locks(Set.of(), Set.of());
    }

    public static final String PREMIUM_ROOM = "Ten pokój jest w Premium. Bez subskrypcji otwarty jest pierwszy rozdział każdej ścieżki.";

    private final ChapterRoomRepository chapterRoomRepository;
    private final PathEnrollmentRepository pathEnrollmentRepository;
    private final SubscriptionAccess subscriptionAccess;
    private final UserSolvedRoomRepository userSolvedRoomRepository;

    private record Progress(Locks locks, Map<Long, Long> chapterOfLockedRoom) {}

    public Locks locks(Long pathId, PathUnlockMode mode, Long userId) {
        return progress(pathId, mode, userId).locks();
    }

    private Progress progress(Long pathId, PathUnlockMode mode, Long userId) {
        if (mode == null || mode == PathUnlockMode.OPEN) return new Progress(Locks.NONE, Map.of());
        Set<Long> lockedChapters = new HashSet<>();
        Map<Long, Long> lockedRooms = new HashMap<>();
        Long currentChapter = null;
        Long frontierChapter = null;
        boolean pastFrontierChapter = false;
        for (var row : chapterRoomRepository.findProgression(pathId, userId == null ? -1L : userId)) {
            if (!Objects.equals(row.getChapterId(), currentChapter)) {
                currentChapter = row.getChapterId();
                pastFrontierChapter = frontierChapter != null;
            }
            if (row.getRoomId() == null || Boolean.TRUE.equals(row.getSolved())) continue;
            if (mode == PathUnlockMode.ROOM ? frontierChapter != null : pastFrontierChapter) {
                lockedRooms.put(row.getRoomId(), currentChapter);
                if (pastFrontierChapter) lockedChapters.add(currentChapter);
            }
            if (frontierChapter == null) frontierChapter = currentChapter;
        }
        return new Progress(new Locks(lockedChapters, lockedRooms.keySet()), lockedRooms);
    }

    /**
     * Locks of one path as the player sees them: a room stays open when another path the player joined unlocks it.
     */
    public Locks playerLocks(Long pathId, PathUnlockMode mode, Long userId) {
        Progress own = progress(pathId, mode, userId);
        if (own.chapterOfLockedRoom().isEmpty()) return own.locks();
        Set<Long> locked = new HashSet<>(own.locks().roomIds());
        locked.removeAll(unlocked(enrolledOwners(chapterRoomRepository.findPublishedPathsOfRooms(locked), userId), pathId, userId));
        Set<Long> lockedChapters = new HashSet<>();
        for (Long roomId : locked) {
            Long chapterId = own.chapterOfLockedRoom().get(roomId);
            if (own.locks().chapterIds().contains(chapterId)) lockedChapters.add(chapterId);
        }
        return new Locks(lockedChapters, locked);
    }

    public Set<Long> premiumLocked(Collection<Long> roomIds, Long userId, Long viewedPathId) {
        if (roomIds.isEmpty() || subscriptionAccess.unlimited(userId)) return Set.of();
        return premiumLocked(chapterRoomRepository.findPublishedPathsOfRooms(roomIds), userId, viewedPathId);
    }

    private Set<Long> premiumLocked(List<ChapterRoomRepository.RoomPathView> owners, Long userId, Long viewedPathId) {
        Set<Long> enrolled = new HashSet<>(userId == null ? Set.of() : pathEnrollmentRepository.findPathIdsByUserId(userId));
        if (viewedPathId != null) enrolled.add(viewedPathId);
        Set<Long> free = new HashSet<>(userId == null ? List.of() : userSolvedRoomRepository.findSolvedRoomIdsByUserId(userId));
        Set<Long> locked = new HashSet<>();
        for (var owner : owners) {
            locked.add(owner.getRoomId());
            if (Boolean.TRUE.equals(owner.getFirstChapter()) && enrolled.contains(owner.getPathId())) free.add(owner.getRoomId());
        }
        locked.removeAll(free);
        return locked;
    }

    public void requireUnlocked(Long roomId, Long userId) {
        var owners = chapterRoomRepository.findPublishedPathsOfRooms(List.of(roomId));
        if (owners.isEmpty()) return;
        var joined = enrolledOwners(owners, userId);
        if (joined.isEmpty()) {
            throw new PathEnrollmentRequiredException(owners.stream().map(ChapterRoomRepository.RoomPathView::getPathId).toList());
        }
        if (!subscriptionAccess.unlimited(userId) && !premiumLocked(owners, userId, null).isEmpty()) {
            throw new SubscriptionRequiredException(PREMIUM_ROOM);
        }
        if (!unlocked(joined, null, userId).isEmpty()) return;
        PathUnlockMode mode = PathUnlockMode.valueOf(joined.get(0).getUnlockMode());
        throw new PathLockedException(mode == PathUnlockMode.CHAPTER
                ? "Ten rozdział jest jeszcze zablokowany. Ukończ wszystkie pokoje poprzednich rozdziałów."
                : "Ten pokój jest jeszcze zablokowany. Ukończ poprzednie pokoje ścieżki.");
    }

    private List<ChapterRoomRepository.RoomPathView> enrolledOwners(List<ChapterRoomRepository.RoomPathView> owners, Long userId) {
        if (owners.isEmpty() || userId == null) return List.of();
        Set<Long> enrolled = pathEnrollmentRepository.findPathIdsByUserId(userId);
        return owners.stream().filter(owner -> enrolled.contains(owner.getPathId())).toList();
    }

    private Set<Long> unlocked(List<ChapterRoomRepository.RoomPathView> owners, Long skippedPathId, Long userId) {
        Map<Long, Locks> byPath = new HashMap<>();
        Set<Long> unlocked = new HashSet<>();
        for (var owner : owners) {
            if (owner.getPathId().equals(skippedPathId) || unlocked.contains(owner.getRoomId())) continue;
            Locks pathLocks = byPath.computeIfAbsent(owner.getPathId(),
                    id -> locks(id, PathUnlockMode.valueOf(owner.getUnlockMode()), userId));
            if (!pathLocks.roomIds().contains(owner.getRoomId())) unlocked.add(owner.getRoomId());
        }
        return unlocked;
    }
}
