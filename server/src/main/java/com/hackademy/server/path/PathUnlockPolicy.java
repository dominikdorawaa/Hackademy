package com.hackademy.server.path;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class PathUnlockPolicy {

    public record Locks(Set<Long> chapterIds, Set<Long> roomIds) {
        public static final Locks NONE = new Locks(Set.of(), Set.of());
    }

    private final ChapterRoomRepository chapterRoomRepository;

    public Locks locks(Long pathId, PathUnlockMode mode, Long userId) {
        if (mode == null || mode == PathUnlockMode.OPEN) return Locks.NONE;
        Set<Long> lockedChapters = new HashSet<>();
        Set<Long> lockedRooms = new HashSet<>();
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
                lockedRooms.add(row.getRoomId());
                if (pastFrontierChapter) lockedChapters.add(currentChapter);
            }
            if (frontierChapter == null) frontierChapter = currentChapter;
        }
        return new Locks(lockedChapters, lockedRooms);
    }

    public void requireUnlocked(Long roomId, Long userId) {
        var owner = chapterRoomRepository.findPathOfRoom(roomId).orElse(null);
        if (owner == null) return;
        PathUnlockMode mode = PathUnlockMode.valueOf(owner.getUnlockMode());
        if (locks(owner.getPathId(), mode, userId).roomIds().contains(roomId)) {
            throw new PathLockedException(mode == PathUnlockMode.CHAPTER
                    ? "Ten rozdział jest jeszcze zablokowany. Ukończ wszystkie pokoje poprzednich rozdziałów."
                    : "Ten pokój jest jeszcze zablokowany. Ukończ poprzednie pokoje ścieżki.");
        }
    }
}
