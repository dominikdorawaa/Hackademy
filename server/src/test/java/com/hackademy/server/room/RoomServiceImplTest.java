package com.hackademy.server.room;

import com.hackademy.server.badge.Badge;
import com.hackademy.server.badge.BadgeDto;
import com.hackademy.server.badge.BadgeRepository;
import com.hackademy.server.badge.BadgeServiceImpl;
import com.hackademy.server.badge.UserBadgeRepository;
import com.hackademy.server.content.ContentVisibility;
import com.hackademy.server.dashboard.DashboardSummaryCache;
import com.hackademy.server.exception.UserNotFoundException;
import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.path.ChapterRoomRepository;
import com.hackademy.server.path.PathUnlockPolicy;
import com.hackademy.server.room.dto.SolveRoomResponse;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.user.UserServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RoomServiceImplTest {

    static final Clock TODAY = Clock.fixed(Instant.parse("2026-10-15T12:00:00Z"), ZoneOffset.UTC);

    @Mock RoomRepository roomRepository;
    @Mock UserRepository userRepository;
    @Mock HintRepository hintRepository;
    @Mock UserUnlockedHintRepository userUnlockedHintRepository;
    @Mock UserSolvedRoomRepository userSolvedRoomRepository;
    @Mock RoomFileRepository roomFileRepository;
    @Mock RoomTaskRepository roomTaskRepository;
    @Mock UserCompletedTaskRepository userCompletedTaskRepository;
    @Mock UserServiceImpl userServiceImpl;
    @Mock DashboardSummaryCache dashboardSummaryCache;
    @Mock ChapterRoomRepository chapterRoomRepository;
    @Mock ContentVisibility visibility;
    @Mock PathUnlockPolicy pathUnlockPolicy;
    @Mock BadgeRepository badgeRepository;
    @Mock UserBadgeRepository userBadgeRepository;
    @Mock FriendshipRepository friendshipRepository;
    RoomServiceImpl service;

    User alice;

    @BeforeEach
    void setUp() {
        BadgeServiceImpl badges = new BadgeServiceImpl(badgeRepository, userBadgeRepository, userSolvedRoomRepository,
                friendshipRepository, userRepository, dashboardSummaryCache, TODAY);
        service = new RoomServiceImpl(roomRepository, userRepository, hintRepository, userUnlockedHintRepository,
                userSolvedRoomRepository, badges, roomFileRepository, roomTaskRepository, userCompletedTaskRepository,
                userServiceImpl, dashboardSummaryCache, chapterRoomRepository, visibility, pathUnlockPolicy, TODAY);

        alice = User.builder().username("alice").points(40).build();
        alice.setId(7L);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(userRepository.findByUsernameForUpdate("alice")).thenReturn(Optional.of(alice));
    }

    // ── solving with a flag ─────────────────────────────────────────────────

    @Test
    void correctFlagAwardsRoomPoints() {
        flagRoom(1L, 100, "FLAG{ok}");

        var result = service.solveRoom(1L, "FLAG{ok}", "alice");

        assertTrue(result.success());
        assertEquals(100, result.pointsEarned());
        assertEquals(140, alice.getPoints());
    }

    @Test
    void correctFlagCountsAnotherSolutionOfTheRoom() {
        Room room = flagRoom(1L, 100, "FLAG{ok}");
        room.setSolutionsCount(4);

        service.solveRoom(1L, "FLAG{ok}", "alice");

        assertEquals(5, room.getSolutionsCount());
    }

    @Test
    void wrongFlagIsRejectedWithoutPoints() {
        Room room = flagRoom(1L, 100, "FLAG{ok}");

        var result = service.solveRoom(1L, "FLAG{nope}", "alice");

        assertEquals(new SolveRoomResponse(false, "Niepoprawna flaga", 0, List.of()), result);
        assertEquals(40, alice.getPoints());
        assertEquals(0, room.getSolutionsCount());
    }

    @Test
    void flagIsCaseSensitive() {
        flagRoom(1L, 100, "FLAG{ok}");

        assertFalse(service.solveRoom(1L, "flag{ok}", "alice").success());
    }

    @Test
    void solvingAgainIsTrainingModeWorthNothing() {
        flagRoom(1L, 100, "FLAG{ok}");
        alreadySolved(1L);
        alice.setStreak(3);
        alice.setLastSolvedDate(LocalDate.of(2026, 10, 1));

        var result = service.solveRoom(1L, "FLAG{ok}", "alice");

        assertEquals(new SolveRoomResponse(true, "Poprawna flaga! (Tryb treningowy - 0 pkt)", 0, List.of()), result);
        assertEquals(40, alice.getPoints());
        assertEquals(3, alice.getStreak());
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = "   ")
    void blankFlagIsABadRequest(String flag) {
        flagRoom(1L, 100, "FLAG{ok}");

        var error = assertThrows(ResponseStatusException.class, () -> service.solveRoom(1L, flag, "alice"));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @ParameterizedTest
    @NullAndEmptySource
    void roomWithoutFlagCannotBeSolvedWithOne(String roomFlag) {
        flagRoom(1L, 100, roomFlag);

        var error = assertThrows(ResponseStatusException.class, () -> service.solveRoom(1L, "FLAG{ok}", "alice"));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    void solvingUnknownRoomFails() {
        assertThrows(IllegalArgumentException.class, () -> service.solveRoom(99L, "FLAG{ok}", "alice"));
    }

    @Test
    void solvingAsUnknownUserFails() {
        flagRoom(1L, 100, "FLAG{ok}");

        assertThrows(UserNotFoundException.class, () -> service.solveRoom(1L, "FLAG{ok}", "bob"));
    }

    @Test
    void solvingReturnsBadgesEarnedByIt() {
        flagRoom(1L, 100, "FLAG{ok}");
        firstSolveBadgeAvailable();

        var result = service.solveRoom(1L, "FLAG{ok}", "alice");

        assertEquals(List.of("Pierwsza krew"), result.newBadges().stream().map(BadgeDto::name).toList());
    }

    // ── hint penalty ────────────────────────────────────────────────────────

    @ParameterizedTest(name = "{0} hints → {1} points")
    @CsvSource({"0,100", "1,75", "2,50", "3,25", "4,0", "5,0"})
    void eachUnlockedHintCostsAQuarterOfFlagRoomPoints(long hints, int expected) {
        flagRoom(1L, 100, "FLAG{ok}");
        unlockedHints(1L, hints);

        var result = service.solveRoom(1L, "FLAG{ok}", "alice");

        assertEquals(expected, result.pointsEarned());
        assertEquals(40 + expected, alice.getPoints());
    }

    @Test
    void hintPenaltyRoundsPartialPointsDown() {
        flagRoom(1L, 50, "FLAG{ok}");
        unlockedHints(1L, 1);

        assertEquals(37, service.solveRoom(1L, "FLAG{ok}", "alice").pointsEarned());
    }

    // ── streak (today is 2026-10-15) ────────────────────────────────────────

    @ParameterizedTest(name = "last solved {0}, streak {1} → {2}")
    @CsvSource({",0,1", "2026-10-14,3,4", "2026-10-15,3,3", "2026-10-12,3,1"})
    void flagSolveUpdatesStreak(LocalDate lastSolved, int streak, int expected) {
        flagRoom(1L, 100, "FLAG{ok}");
        alice.setLastSolvedDate(lastSolved);
        alice.setStreak(streak);

        service.solveRoom(1L, "FLAG{ok}", "alice");

        assertEquals(expected, alice.getStreak());
        assertEquals(LocalDate.of(2026, 10, 15), alice.getLastSolvedDate());
    }

    @ParameterizedTest(name = "last solved {0}, streak {1} → {2}")
    @CsvSource({",0,1", "2026-10-14,3,4", "2026-10-15,3,3", "2026-10-12,3,1"})
    void taskRoomCompletionUpdatesStreak(LocalDate lastSolved, int streak, int expected) {
        taskRoom(2L, 100, task(20L, "a"));
        completedTasks(1);
        alice.setLastSolvedDate(lastSolved);
        alice.setStreak(streak);

        service.completeTaskRoom(2L, "alice");

        assertEquals(expected, alice.getStreak());
        assertEquals(LocalDate.of(2026, 10, 15), alice.getLastSolvedDate());
    }

    // ── tasks ───────────────────────────────────────────────────────────────

    @Test
    void taskAnswerIgnoresLetterCase() {
        taskRoom(2L, 100, task(20L, "FLAG{abc}"), task(21L, "x"));

        assertTrue(service.solveTask(2L, 20L, "flag{ABC}", "alice").success());
    }

    @Test
    void wrongTaskAnswerIsRejectedAndNotRecorded() {
        taskRoom(2L, 100, task(20L, "FLAG{abc}"));

        var result = service.solveTask(2L, 20L, "nope", "alice");

        assertEquals(new SolveRoomResponse(false, "Niepoprawna odpowiedź", 0, List.of()), result);
        verify(userCompletedTaskRepository, never()).save(any());
    }

    @Test
    void taskWithoutQuestionCompletesWithAnyAnswer() {
        taskRoom(2L, 100, task(20L, null), task(21L, "x"));

        assertTrue(service.solveTask(2L, 20L, "", "alice").success());
    }

    @Test
    void taskFromAnotherRoomIsRejected() {
        taskRoom(2L, 100, task(20L, "a"));
        Room other = Room.builder().id(3L).build();
        RoomTask foreign = RoomTask.builder().id(30L).room(other).answer("a").build();
        when(roomTaskRepository.findById(30L)).thenReturn(Optional.of(foreign));

        assertThrows(IllegalArgumentException.class, () -> service.solveTask(2L, 30L, "a", "alice"));
    }

    @Test
    void unknownTaskIsRejected() {
        taskRoom(2L, 100, task(20L, "a"));

        assertThrows(IllegalArgumentException.class, () -> service.solveTask(2L, 99L, "a", "alice"));
    }

    @Test
    void completedTaskIsRecordedOnce() {
        taskRoom(2L, 100, task(20L, "a"), task(21L, "b"));
        when(userCompletedTaskRepository.existsByUserIdAndTaskId(7L, 20L)).thenReturn(false, true);

        service.solveTask(2L, 20L, "a", "alice");
        service.solveTask(2L, 20L, "a", "alice");

        verify(userCompletedTaskRepository, times(1)).save(any());
    }

    @Test
    void correctAnswerBeforeLastTaskGivesNoReward() {
        taskRoom(2L, 100, task(20L, "a"), task(21L, "b"));
        completedTasks(1);

        var result = service.solveTask(2L, 20L, "a", "alice");

        assertEquals(new SolveRoomResponse(true, "Poprawna odpowiedź!", 0, List.of()), result);
        assertEquals(40, alice.getPoints());
    }

    @Test
    void lastTaskCompletesRoomAndAwardsPointsAndBadges() {
        Room room = taskRoom(2L, 100, task(20L, "a"), task(21L, "b"));
        completedTasks(2);
        firstSolveBadgeAvailable();

        var result = service.solveTask(2L, 21L, "b", "alice");

        assertEquals("Poprawna odpowiedź! Pokój ukończony!", result.message());
        assertEquals(100, result.pointsEarned());
        assertEquals(List.of("Pierwsza krew"), result.newBadges().stream().map(BadgeDto::name).toList());
        assertEquals(140, alice.getPoints());
        assertEquals(1, room.getSolutionsCount());
    }

    @Test
    void finishingAlreadySolvedTaskRoomGivesNothing() {
        taskRoom(2L, 100, task(20L, "a"));
        completedTasks(1);
        alreadySolved(2L);

        var result = service.solveTask(2L, 20L, "a", "alice");

        assertEquals(new SolveRoomResponse(true, "Poprawna odpowiedź! (Pokój już ukończony)", 0, List.of()), result);
        assertEquals(40, alice.getPoints());
    }

    @ParameterizedTest(name = "{0} hints → {1} points")
    @CsvSource({"0,100", "1,75", "2,50", "3,25", "4,0", "5,0"})
    void eachUnlockedHintCostsAQuarterOfTaskRoomPoints(long hints, int expected) {
        taskRoom(2L, 100, task(20L, "a"));
        completedTasks(1);
        unlockedHints(2L, hints);

        assertEquals(expected, service.completeTaskRoom(2L, "alice").pointsEarned());
        assertEquals(40 + expected, alice.getPoints());
    }

    @Test
    void roomWithoutTasksCannotBeCompletedWithoutFlag() {
        taskRoom(2L, 100);

        var result = service.completeTaskRoom(2L, "alice");

        assertEquals(new SolveRoomResponse(false, "Pokój bez zadań wymaga flagi", 0, List.of()), result);
    }

    @Test
    void roomWithUnfinishedTasksCannotBeCompleted() {
        taskRoom(2L, 100, task(20L, "a"), task(21L, "b"));
        completedTasks(1);

        var result = service.completeTaskRoom(2L, "alice");

        assertEquals(new SolveRoomResponse(false, "Ukończ wszystkie zadania pokoju", 0, List.of()), result);
        assertEquals(40, alice.getPoints());
    }

    @Test
    void roomWithAllTasksDoneCompletesWithReward() {
        taskRoom(2L, 100, task(20L, "a"), task(21L, "b"));
        completedTasks(2);

        var result = service.completeTaskRoom(2L, "alice");

        assertTrue(result.success());
        assertEquals(100, result.pointsEarned());
    }

    // ── hints ───────────────────────────────────────────────────────────────

    @Test
    void firstHintUnlocks() {
        hintRoom(1L, 11L, 12L);

        assertTrue(service.unlockHint(1L, 11L, "alice"));
        verify(userUnlockedHintRepository).save(argThat(u -> u.getHint().getId().equals(11L)));
    }

    @Test
    void hintsUnlockInOrder() {
        hintRoom(1L, 11L, 12L, 13L);
        when(userUnlockedHintRepository.existsByUser_IdAndHint_Id(7L, 11L)).thenReturn(true);

        assertTrue(service.unlockHint(1L, 12L, "alice"));
        assertThrows(IllegalStateException.class, () -> service.unlockHint(1L, 13L, "alice"));
    }

    @Test
    void skippingAHintIsRefused() {
        hintRoom(1L, 11L, 12L);

        assertThrows(IllegalStateException.class, () -> service.unlockHint(1L, 12L, "alice"));
        verify(userUnlockedHintRepository, never()).save(any());
    }

    @Test
    void solvedRoomAllowsAnyHint() {
        hintRoom(1L, 11L, 12L, 13L);
        alreadySolved(1L);

        assertTrue(service.unlockHint(1L, 13L, "alice"));
    }

    @Test
    void unlockedHintIsNotUnlockedAgain() {
        hintRoom(1L, 11L);
        when(userUnlockedHintRepository.existsByUser_IdAndHint_Id(7L, 11L)).thenReturn(true);

        assertFalse(service.unlockHint(1L, 11L, "alice"));
        verify(userUnlockedHintRepository, never()).save(any());
    }

    @Test
    void hintOrderFollowsIdsNotInsertionOrder() {
        hintRoom(1L, 12L, 11L);

        assertTrue(service.unlockHint(1L, 11L, "alice"));
        assertThrows(IllegalStateException.class, () -> service.unlockHint(1L, 12L, "alice"));
    }

    @Test
    void hintFromAnotherRoomIsRejected() {
        hintRoom(1L, 11L);
        Hint foreign = new Hint("Obca", Room.builder().id(2L).build());
        foreign.setId(21L);
        when(hintRepository.findById(21L)).thenReturn(Optional.of(foreign));

        assertThrows(IllegalArgumentException.class, () -> service.unlockHint(1L, 21L, "alice"));
    }

    @Test
    void unknownHintIsRejected() {
        hintRoom(1L, 11L);

        assertThrows(IllegalArgumentException.class, () -> service.unlockHint(1L, 99L, "alice"));
    }

    @Test
    void hintInUnknownRoomIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.unlockHint(99L, 11L, "alice"));
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    Room flagRoom(Long id, int points, String flag) {
        Room room = Room.builder().id(id).title("Room " + id).points(points).flag(flag).build();
        when(roomRepository.findById(id)).thenReturn(Optional.of(room));
        when(roomRepository.findByIdForUpdate(id)).thenReturn(Optional.of(room));
        return room;
    }

    Room taskRoom(Long id, int points, RoomTask... tasks) {
        Room room = Room.builder().id(id).title("Room " + id).points(points).roomType(RoomType.PATH).build();
        for (RoomTask task : tasks) {
            task.setRoom(room);
            room.getTasks().add(task);
            when(roomTaskRepository.findById(task.getId())).thenReturn(Optional.of(task));
        }
        when(roomRepository.findById(id)).thenReturn(Optional.of(room));
        when(roomRepository.findByIdForUpdate(id)).thenReturn(Optional.of(room));
        when(roomTaskRepository.findByRoomIdOrderBySortOrderAsc(id)).thenReturn(List.of(tasks));
        return room;
    }

    Room hintRoom(Long id, Long... hintIds) {
        Room room = flagRoom(id, 100, "FLAG{ok}");
        for (Long hintId : hintIds) {
            Hint hint = new Hint("Podpowiedź " + hintId, room);
            hint.setId(hintId);
            room.getHints().add(hint);
            when(hintRepository.findById(hintId)).thenReturn(Optional.of(hint));
        }
        return room;
    }

    static RoomTask task(Long id, String answer) {
        return RoomTask.builder().id(id).title("Zadanie " + id).content("Treść").answer(answer).build();
    }

    void completedTasks(long count) {
        when(userCompletedTaskRepository.countByUserIdAndTaskIdIn(eq(7L), anyList())).thenReturn(count);
    }

    void alreadySolved(Long roomId) {
        when(userSolvedRoomRepository.existsByUser_IdAndRoom_Id(7L, roomId)).thenReturn(true);
    }

    void unlockedHints(Long roomId, long count) {
        when(userUnlockedHintRepository.countByUser_IdAndHint_Room_Id(7L, roomId)).thenReturn(count);
    }

    void firstSolveBadgeAvailable() {
        Badge badge = new Badge("Pierwsza krew", "Rozwiąż pierwszy pokój", "icon", "SOLVED_COUNT", 1);
        badge.setId(1L);
        when(badgeRepository.findAll()).thenReturn(List.of(badge));
        when(userSolvedRoomRepository.countByUser_Id(7L)).thenReturn(1L);
        when(userRepository.count()).thenReturn(1L);
    }
}
