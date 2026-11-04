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
import com.hackademy.server.room.dto.CreateRoomRequest;
import com.hackademy.server.room.dto.HintDto;
import com.hackademy.server.room.dto.RoomAdminSummaryDto;
import com.hackademy.server.room.dto.RoomPathDto;
import com.hackademy.server.room.dto.RoomSummaryDto;
import com.hackademy.server.room.dto.RoomTaskAdminDto;
import com.hackademy.server.room.dto.RoomTaskDto;
import com.hackademy.server.room.dto.RoomTaskRequest;
import com.hackademy.server.room.dto.SolveRoomResponse;
import com.hackademy.server.room.dto.UpdateRoomRequest;
import com.hackademy.server.room.dto.UpdateRoomTasksRequest;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.user.UserServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
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
                userServiceImpl, dashboardSummaryCache, chapterRoomRepository, visibility, pathUnlockPolicy, TODAY,
                RoomAnswerGuardTest.guard(TODAY, true, 2, Duration.ofHours(1)));

        alice = User.builder().username("alice").points(40).build();
        alice.setId(7L);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(userRepository.findIdByUsername("alice")).thenReturn(Optional.of(7L));
        when(userRepository.findByUsernameForUpdate("alice")).thenReturn(Optional.of(alice));
    }


    @Test
    void correctFlagAwardsRoomPoints() {
        flagRoom(1L, 100, "FLAG{ok}");

        var result = solveFlag(1L, "FLAG{ok}", "alice");

        assertTrue(result.success());
        assertEquals(100, result.pointsEarned());
        assertEquals(140, alice.getPoints());
    }

    @Test
    void correctFlagCountsAnotherSolutionOfTheRoom() {
        flagRoom(1L, 100, "FLAG{ok}");

        solveFlag(1L, "FLAG{ok}", "alice");

        verify(roomRepository).incrementSolutions(1L);
    }

    @Test
    void wrongFlagIsRejectedWithoutPoints() {
        flagRoom(1L, 100, "FLAG{ok}");

        var result = solveFlag(1L, "FLAG{nope}", "alice");

        assertEquals(new SolveRoomResponse(false, "Niepoprawna odpowiedź", 0, List.of()), result);
        assertEquals(40, alice.getPoints());
        verify(roomRepository, never()).incrementSolutions(any());
    }

    @Test
    void flagIsCaseSensitive() {
        flagRoom(1L, 100, "FLAG{ok}");

        assertFalse(solveFlag(1L, "flag{ok}", "alice").success());
    }

    @Test
    void solvingAgainIsTrainingModeWorthNothing() {
        flagRoom(1L, 100, "FLAG{ok}");
        alreadySolved(1L);
        alice.setStreak(3);
        alice.setLastSolvedDate(LocalDate.of(2026, 10, 1));

        var result = solveFlag(1L, "FLAG{ok}", "alice");

        assertEquals(new SolveRoomResponse(true, "Poprawna odpowiedź! (Pokój już ukończony)", 0, List.of()), result);
        assertEquals(40, alice.getPoints());
        assertEquals(3, alice.getStreak());
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = "   ")
    void blankFlagIsAWrongAnswer(String flag) {
        flagRoom(1L, 100, "FLAG{ok}");

        assertFalse(solveFlag(1L, flag, "alice").success());
        verify(userSolvedRoomRepository, never()).save(any());
    }

    @Test
    void solvingUnknownRoomFails() {
        assertThrows(IllegalArgumentException.class, () -> solveFlag(99L, "FLAG{ok}", "alice"));
    }

    @Test
    void solvingAsUnknownUserFails() {
        flagRoom(1L, 100, "FLAG{ok}");

        assertThrows(UserNotFoundException.class, () -> solveFlag(1L, "FLAG{ok}", "bob"));
    }

    @Test
    void solvingReturnsBadgesEarnedByIt() {
        flagRoom(1L, 100, "FLAG{ok}");
        firstSolveBadgeAvailable();

        var result = solveFlag(1L, "FLAG{ok}", "alice");

        assertEquals(List.of("Pierwsza krew"), result.newBadges().stream().map(BadgeDto::name).toList());
    }


    @ParameterizedTest(name = "{0} hints → {1} points")
    @CsvSource({"0,100", "1,90", "4,60", "5,50", "6,50", "12,50"})
    void eachUnlockedHintCostsATenthOfFlagRoomPointsUpToHalf(long hints, int expected) {
        flagRoom(1L, 100, "FLAG{ok}");
        unlockedHints(1L, hints);

        var result = solveFlag(1L, "FLAG{ok}", "alice");

        assertEquals(expected, result.pointsEarned());
        assertEquals(40 + expected, alice.getPoints());
        verify(userSolvedRoomRepository).save(argThat(s -> s.getAwardedPoints() == expected));
    }

    @Test
    void hintPenaltyRoundsPartialPointsDown() {
        flagRoom(1L, 55, "FLAG{ok}");
        unlockedHints(1L, 1);

        assertEquals(49, solveFlag(1L, "FLAG{ok}", "alice").pointsEarned());
    }


    @ParameterizedTest(name = "last solved {0}, streak {1} → {2}")
    @CsvSource({",0,1", "2026-10-14,3,4", "2026-10-15,3,3", "2026-10-12,3,1"})
    void flagSolveUpdatesStreak(LocalDate lastSolved, int streak, int expected) {
        flagRoom(1L, 100, "FLAG{ok}");
        alice.setLastSolvedDate(lastSolved);
        alice.setStreak(streak);

        solveFlag(1L, "FLAG{ok}", "alice");

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


    @Test
    void wrongAnswersToDifferentTasksShareOneLimitPerRoom() {
        taskRoom(2L, 100, task(20L, "a"), task(21L, "FLAG{ok}")).setRoomType(RoomType.CTF);

        assertFalse(service.solveTask(2L, 21L, "FLAG{nope}", "alice").success());
        assertFalse(service.solveTask(2L, 20L, "nope", "alice").success());

        assertThrows(RoomAnswerLimitException.class, () -> service.solveTask(2L, 20L, "a", "alice"));
        assertThrows(RoomAnswerLimitException.class, () -> service.solveTask(2L, 21L, "FLAG{ok}", "alice"));
        verify(userSolvedRoomRepository, never()).save(any());
        verify(userCompletedTaskRepository, never()).save(any());
        assertEquals(40, alice.getPoints());
    }

    @Test
    void rightAnswersDoNotCountTowardsTheLimit() {
        flagRoom(1L, 100, "FLAG{ok}");
        alreadySolved(1L);

        for (int i = 0; i < 5; i++) {
            assertTrue(solveFlag(1L, "FLAG{ok}", "alice").success());
        }

        assertFalse(solveFlag(1L, "FLAG{nope}", "alice").success());
        assertFalse(solveFlag(1L, "FLAG{nope}", "alice").success());
        assertThrows(RoomAnswerLimitException.class, () -> solveFlag(1L, "FLAG{nope}", "alice"));
    }

    @Test
    void aBlockedRoomLeavesOtherRoomsSolvable() {
        flagRoom(1L, 100, "FLAG{ok}");
        flagRoom(3L, 50, "FLAG{other}");
        solveFlag(1L, "FLAG{nope}", "alice");
        solveFlag(1L, "FLAG{nope}", "alice");

        var result = solveFlag(3L, "FLAG{other}", "alice");

        assertTrue(result.success());
        assertEquals(50, result.pointsEarned());
    }


    @Test
    void taskAnswerIgnoresLetterCase() {
        taskRoom(2L, 100, task(20L, "FLAG{abc}"), task(21L, "x"));

        assertTrue(service.solveTask(2L, 20L, "flag{ABC}", "alice").success());
    }

    @Test
    void ctfTaskFlagIsCaseSensitive() {
        taskRoom(2L, 100, task(20L, "FLAG{abc}"), task(21L, "x")).setRoomType(RoomType.CTF);

        assertFalse(service.solveTask(2L, 20L, "flag{ABC}", "alice").success());
        assertTrue(service.solveTask(2L, 20L, "FLAG{abc}", "alice").success());
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
        verify(roomRepository).incrementSolutions(room.getId());
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
    @CsvSource({"0,100", "1,90", "5,50", "6,50"})
    void eachUnlockedHintCostsATenthOfTaskRoomPointsUpToHalf(long hints, int expected) {
        taskRoom(2L, 100, task(20L, "a"));
        completedTasks(1);
        unlockedHints(2L, hints);

        assertEquals(expected, service.completeTaskRoom(2L, "alice").pointsEarned());
        assertEquals(40 + expected, alice.getPoints());
        verify(userSolvedRoomRepository).save(argThat(s -> s.getAwardedPoints() == expected));
    }

    @Test
    void roomWithoutTasksCannotBeCompleted() {
        taskRoom(2L, 100);

        var result = service.completeTaskRoom(2L, "alice");

        assertEquals(new SolveRoomResponse(false, "Pokój nie ma jeszcze zadań", 0, List.of()), result);
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


    @Test
    void firstHintUnlocks() {
        hintRoom(1L, 11L, 12L);

        assertEquals(new HintDto(11L, 0, "Podpowiedź 11"), service.unlockHint(1L, 11L, "alice"));
        verify(userUnlockedHintRepository).save(argThat(u -> u.getHint().getId().equals(11L)));
    }

    @Test
    void hintsUnlockInOrder() {
        hintRoom(1L, 11L, 12L, 13L);
        when(userUnlockedHintRepository.existsByUser_IdAndHint_Id(7L, 11L)).thenReturn(true);

        assertEquals(1, service.unlockHint(1L, 12L, "alice").order());
        assertStatus(HttpStatus.CONFLICT, () -> service.unlockHint(1L, 13L, "alice"));
    }

    @Test
    void skippingAHintIsRefused() {
        hintRoom(1L, 11L, 12L);

        assertStatus(HttpStatus.CONFLICT, () -> service.unlockHint(1L, 12L, "alice"));
        verify(userUnlockedHintRepository, never()).save(any());
    }

    @Test
    void solvedRoomAllowsAnyHint() {
        hintRoom(1L, 11L, 12L, 13L);
        alreadySolved(1L);

        assertEquals("Podpowiedź 13", service.unlockHint(1L, 13L, "alice").description());
    }

    @Test
    void unlockedHintIsNotUnlockedAgain() {
        hintRoom(1L, 11L);
        when(userUnlockedHintRepository.existsByUser_IdAndHint_Id(7L, 11L)).thenReturn(true);

        assertEquals(new HintDto(11L, 0, "Podpowiedź 11"), service.unlockHint(1L, 11L, "alice"));
        verify(userUnlockedHintRepository, never()).save(any());
    }

    @Test
    void hintOrderFollowsTheTaskNotTheIds() {
        hintRoom(1L, 12L, 11L);

        assertEquals(0, service.unlockHint(1L, 12L, "alice").order());
        assertStatus(HttpStatus.CONFLICT, () -> service.unlockHint(1L, 11L, "alice"));
    }

    @Test
    void hintsOfAnotherTaskDoNotBlockTheFirstHintOfATask() {
        Room room = hintRoom(1L, 11L);
        RoomTask second = task(11L * 10 + 1, "b");
        second.setRoom(room);
        room.getTasks().add(second);
        Hint hint = new Hint("Druga", second, 0);
        hint.setId(31L);
        second.getHints().add(hint);
        when(hintRepository.findById(31L)).thenReturn(Optional.of(hint));

        assertEquals(new HintDto(31L, 0, "Druga"), service.unlockHint(1L, 31L, "alice"));
    }

    @Test
    void hintFromAnotherRoomIsRejected() {
        hintRoom(1L, 11L);
        Hint foreign = new Hint("Obca", RoomTask.builder().room(Room.builder().id(2L).build()).build(), 0);
        foreign.setId(21L);
        when(hintRepository.findById(21L)).thenReturn(Optional.of(foreign));

        assertStatus(HttpStatus.NOT_FOUND, () -> service.unlockHint(1L, 21L, "alice"));
    }

    @Test
    void unknownHintIsRejected() {
        hintRoom(1L, 11L);

        assertStatus(HttpStatus.NOT_FOUND, () -> service.unlockHint(1L, 99L, "alice"));
    }

    @Test
    void hintInUnknownRoomIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.unlockHint(99L, 11L, "alice"));
    }


    @Test
    void newRoomIsALessonByDefault() throws IOException {
        returnSavedRoom();

        Room room = service.createRoom(createRequest("  Nowy  ", DifficultyLevel.HARD, 20, null), null);

        assertEquals(RoomType.PATH, room.getRoomType());
        assertEquals(20, room.getPoints());
        assertEquals("Nowy", room.getTitle());
        verifyNoInteractions(roomFileRepository);
    }

    @Test
    void ctfRoomPointsComeFromDifficultyNotFromRequest() throws IOException {
        returnSavedRoom();

        Room room = service.createRoom(createRequest("Nowy", DifficultyLevel.HARD, 999, RoomType.CTF), null);

        assertEquals(150, room.getPoints());
    }

    @Test
    void pathRoomKeepsRequestedPoints() throws IOException {
        returnSavedRoom();

        Room room = service.createRoom(createRequest("Nowy", DifficultyLevel.HARD, 30, RoomType.PATH), null);

        assertEquals(30, room.getPoints());
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(ints = -1)
    void pathRoomNeedsNonNegativePoints(Integer points) {
        var error = assertThrows(RoomRuleException.class,
                () -> service.createRoom(createRequest("Nowy", DifficultyLevel.EASY, points, RoomType.PATH), null));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        assertEquals("points", error.field());
    }

    @ParameterizedTest
    @ValueSource(strings = {"Tutorial VM", "tutorial vpn"})
    void tutorialTitlesAreReserved(String title) {
        var error = assertThrows(RoomRuleException.class,
                () -> service.createRoom(createRequest(title, DifficultyLevel.EASY, null, null), null));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        assertEquals("title", error.field());
    }

    @Test
    void roomsOfBothTypesMayShareATitleOutsideAChapter() throws IOException {
        returnSavedRoom();

        assertEquals("Zajęty", service.createRoom(createRequest("Zajęty", DifficultyLevel.EASY, 10, RoomType.PATH), null).getTitle());
        assertEquals("Zajęty", service.createRoom(createRequest("Zajęty", DifficultyLevel.EASY, null, RoomType.CTF), null).getTitle());
        assertEquals("Zajęty", service.createRoom(createRequest("Zajęty", DifficultyLevel.EASY, null, RoomType.CTF), null).getTitle());
    }

    @Test
    void uploadedFileIsStoredWithTheRoom() throws IOException {
        returnSavedRoom();
        var file = new MockMultipartFile("file", "dump.pcap", "application/octet-stream", new byte[] {1, 2});

        Room room = service.createRoom(createRequest("Nowy", DifficultyLevel.EASY, 20, null), file);

        verify(roomFileRepository).save(argThat(f -> f.getFileName().equals("dump.pcap") && f.getRoom() == room));
    }

    @Test
    void emptyUploadIsIgnored() throws IOException {
        returnSavedRoom();

        service.createRoom(createRequest("Nowy", DifficultyLevel.EASY, 20, null),
                new MockMultipartFile("file", "empty.txt", "text/plain", new byte[0]));

        verifyNoInteractions(roomFileRepository);
    }


    @Test
    void editingRoomBumpsContentRevision() throws IOException {
        Room room = flagRoom(1L, 100, "FLAG{ok}");
        room.setTitle("Stary");
        room.setContentRevision(3);
        returnSavedRoom();

        service.updateRoom(1L, updateRequest("Nowy", RoomType.CTF), null);

        assertEquals(4, room.getContentRevision());
        assertEquals("Nowy", room.getTitle());
        assertEquals(DifficultyLevel.MEDIUM.ctfPoints(), room.getPoints());
    }

    @Test
    void savingTasksKeepsMatchingHintsInTheGivenOrder() {
        Room room = hintRoom(1L, 11L, 12L);
        RoomTask task = room.getTasks().get(0);

        var result = service.updateRoomTasks(1L, new UpdateRoomTasksRequest(0L, List.of(
                new RoomTaskRequest(task.getId(), "Zadanie", "Treść", null, "FLAG{ok}", List.of(" Podpowiedź 12 ", "Świeża")))));

        assertEquals(List.of("Podpowiedź 12", "Świeża"), result.tasks().get(0).hints());
        assertEquals(12L, task.getHints().get(0).getId());
        assertEquals(0, task.getHints().get(0).getSortOrder());
        assertNull(task.getHints().get(1).getId());
        assertEquals(1, task.getHints().get(1).getSortOrder());
    }

    @Test
    void savingTasksWithoutAHintListKeepsTheHints() {
        Room room = hintRoom(1L, 11L);
        RoomTask task = room.getTasks().get(0);

        service.updateRoomTasks(1L, new UpdateRoomTasksRequest(0L, List.of(
                new RoomTaskRequest(task.getId(), "Zadanie", "Treść", null, "FLAG{ok}"))));
        assertEquals(List.of(11L), task.getHints().stream().map(Hint::getId).toList());

        service.updateRoomTasks(1L, new UpdateRoomTasksRequest(1L, List.of(
                new RoomTaskRequest(task.getId(), "Zadanie", "Treść", null, "FLAG{ok}", List.of()))));
        assertTrue(task.getHints().isEmpty());
    }

    @Test
    void aTaskTakesAtMostTenHints() {
        Room room = hintRoom(1L);
        RoomTask task = room.getTasks().get(0);
        var hints = java.util.Collections.nCopies(RoomTaskRequest.MAX_HINTS + 1, "Podpowiedź");

        assertThrows(IllegalArgumentException.class, () -> service.updateRoomTasks(1L, new UpdateRoomTasksRequest(0L, List.of(
                new RoomTaskRequest(task.getId(), "Zadanie", "Treść", null, "FLAG{ok}", hints)))));
    }

    @Test
    void pathRoomInChapterCanBecomeCtf() throws IOException {
        taskRoom(2L, 10);
        returnSavedRoom();

        Room room = service.updateRoom(2L, updateRequest("Room 2", RoomType.CTF), null);

        assertEquals(RoomType.CTF, room.getRoomType());
        assertEquals(DifficultyLevel.MEDIUM.ctfPoints(), room.getPoints());
    }

    @Test
    void updateWithoutTypeKeepsTheRoomType() throws IOException {
        flagRoom(1L, 100, "FLAG{ok}").setRoomType(RoomType.CTF);
        returnSavedRoom();

        Room room = service.updateRoom(1L, updateRequest("Room 1", null), null);

        assertEquals(RoomType.CTF, room.getRoomType());
        assertEquals(DifficultyLevel.MEDIUM.ctfPoints(), room.getPoints());
    }

    @Test
    void roomTypeChangesBothWaysWithoutLosingTasks() throws IOException {
        Room room = taskRoom(2L, 10, task(20L, "a"), task(21L, "b"));
        returnSavedRoom();

        service.updateRoom(2L, updateRequest("Room 2", RoomType.CTF), null);
        assertEquals(RoomType.CTF, room.getRoomType());
        assertEquals(List.of(20L, 21L), room.getTasks().stream().map(RoomTask::getId).toList());

        service.updateRoom(2L, updateRequest("Room 2", RoomType.PATH), null);
        assertEquals(RoomType.PATH, room.getRoomType());
        assertEquals(List.of("a", "b"), room.getTasks().stream().map(RoomTask::getAnswer).toList());
    }

    @Test
    void keepingReservedTutorialTitleIsAllowed() throws IOException {
        Room room = flagRoom(1L, 100, "FLAG{ok}");
        room.setTitle("Tutorial VM");
        returnSavedRoom();

        assertEquals("Tutorial VM", service.updateRoom(1L, updateRequest("Tutorial VM", RoomType.CTF), null).getTitle());
    }

    @Test
    void renamingToReservedTutorialTitleIsRefused() {
        flagRoom(1L, 100, "FLAG{ok}");

        assertThrows(RoomRuleException.class,
                () -> service.updateRoom(1L, updateRequest("Tutorial VPN", RoomType.CTF), null));
    }

    @Test
    void renamingToTitleUsedInSameChapterIsRefused() {
        taskRoom(2L, 10);
        when(chapterRoomRepository.existsOtherRoomWithTitleInSameChapter(2L, "Sąsiad")).thenReturn(true);

        var error = assertThrows(RoomRuleException.class,
                () -> service.updateRoom(2L, updateRequest("Sąsiad", RoomType.PATH), null));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    void editingReplacesExistingFile() throws IOException {
        flagRoom(1L, 100, "FLAG{ok}");
        returnSavedRoom();
        RoomFile existing = new RoomFile("old.txt", "text/plain", new byte[] {1}, null);
        when(roomFileRepository.findByRoomId(1L)).thenReturn(Optional.of(existing));

        service.updateRoom(1L, updateRequest("Room 1", RoomType.CTF),
                new MockMultipartFile("file", "new.txt", "text/plain", new byte[] {2}));

        assertEquals("new.txt", existing.getFileName());
        assertArrayEquals(new byte[] {2}, existing.getData());
    }

    @Test
    void editingAddsFileWhenRoomHadNone() throws IOException {
        flagRoom(1L, 100, "FLAG{ok}");
        returnSavedRoom();

        service.updateRoom(1L, updateRequest("Room 1", RoomType.CTF),
                new MockMultipartFile("file", "new.txt", "text/plain", new byte[] {2}));

        verify(roomFileRepository).save(argThat(f -> f.getFileName().equals("new.txt")));
    }

    @Test
    void editingUnknownRoomFails() {
        assertThrows(IllegalArgumentException.class,
                () -> service.updateRoom(99L, updateRequest("X", RoomType.CTF), null));
    }

    @Test
    void deletingRoomRemovesIt() {
        when(roomRepository.existsById(1L)).thenReturn(true);

        service.deleteRoom(1L);

        verify(roomRepository).deleteById(1L);
    }

    @Test
    void deletingUnknownRoomFails() {
        assertThrows(IllegalArgumentException.class, () -> service.deleteRoom(99L));
        verify(roomRepository, never()).deleteById(any());
    }


    @Test
    void adminAndLandingListsComeFromRepository() {
        var web = new RoomAdminSummaryDto(1L, "Web", "Web", DifficultyLevel.EASY, 50, false, RoomType.CTF);
        var linux = new RoomAdminSummaryDto(2L, "Linux", "Linux", DifficultyLevel.EASY, 50, false, RoomType.PATH);
        var top = List.of(summary(1L, "Web", false, RoomType.CTF));
        when(roomRepository.findAllAdminSummaries()).thenReturn(List.of(web, linux));
        when(chapterRoomRepository.findAllOwners()).thenReturn(List.of(owner(1L, 5L, "Linux 101", true), owner(1L, 6L, "Web Basics", false)));
        when(roomRepository.findTop3ByCategoryNot("Tutorial", PageRequest.of(0, 3))).thenReturn(top);

        assertEquals(List.of(web.withPaths(List.of(new RoomPathDto(5L, "Linux 101", true), new RoomPathDto(6L, "Web Basics", false))), linux),
                service.getAllRoomsForAdmin());
        assertEquals(top, service.getTop3Rooms());
    }


    @Test
    void detailShowsEachTaskWithItsOwnHintsTasksAndFile() {
        Room room = flagRoom(1L, 100, "FLAG{ok}");
        when(roomFileRepository.findFileNameByRoomId(1L)).thenReturn("dump.pcap");
        RoomTask done = task(20L, "a");
        RoomTask open = task(21L, "b");
        done.setRoom(room);
        open.setRoom(room);
        Hint first = new Hint("Podpowiedź 12", done, 0);
        first.setId(12L);
        Hint second = new Hint("Podpowiedź 11", done, 1);
        second.setId(11L);
        done.getHints().addAll(List.of(first, second));
        when(roomTaskRepository.findByRoomIdOrderBySortOrderAsc(1L)).thenReturn(List.of(done, open));
        when(userCompletedTaskRepository.findCompletedTaskIdsInRoom(7L, 1L)).thenReturn(List.of(20L));
        when(userUnlockedHintRepository.findByUser_IdAndHint_Task_Room_Id(7L, 1L))
                .thenReturn(List.of(new UserUnlockedHint(alice, first)));
        alreadySolved(1L);

        var detail = service.getRoomDetail(1L, "alice");

        assertTrue(detail.solved());
        assertEquals(List.of(new HintDto(12L, 0, "Podpowiedź 12"), HintDto.locked(11L, 1)), detail.tasks().get(0).hints());
        assertEquals(List.of(), detail.tasks().get(1).hints());
        assertEquals(List.of(true, false), detail.tasks().stream().map(RoomTaskDto::completed).toList());
        assertEquals(List.of(true, true), detail.tasks().stream().map(RoomTaskDto::requiresAnswer).toList());
        assertEquals(RoomType.CTF, detail.roomType());
        assertEquals("dump.pcap", detail.fileName());
        verify(visibility).requireRoom(1L);
        verify(pathUnlockPolicy).requireUnlocked(1L, 7L);
    }

    @Test
    void detailWithoutFileHasNoFileName() {
        flagRoom(1L, 100, "FLAG{ok}");

        var detail = service.getRoomDetail(1L, "alice");

        assertNull(detail.fileName());
        assertFalse(detail.solved());
    }

    @Test
    void tutorialVpnDetailRequiresTutorialVm() {
        flagRoom(1L, 100, "FLAG{ok}").setTitle("Tutorial VPN");

        assertThrows(IllegalStateException.class, () -> service.getRoomDetail(1L, "alice"));

        when(userSolvedRoomRepository.existsByUser_UsernameAndRoom_Title("alice", "Tutorial VM")).thenReturn(true);
        assertEquals("Tutorial VPN", service.getRoomDetail(1L, "alice").title());
    }

    @Test
    void vpnRoomDetailRequiresTutorialVpn() {
        flagRoom(1L, 100, "FLAG{ok}").setRequiresVpn(true);

        assertThrows(IllegalStateException.class, () -> service.getRoomDetail(1L, "alice"));

        when(userSolvedRoomRepository.existsByUser_UsernameAndRoom_Title("alice", "Tutorial VPN")).thenReturn(true);
        assertTrue(service.getRoomDetail(1L, "alice").requiresVpn());
    }

    @Test
    void detailOfUnknownRoomOrUserFails() {
        flagRoom(1L, 100, "FLAG{ok}");

        assertThrows(IllegalArgumentException.class, () -> service.getRoomDetail(99L, "alice"));
        assertThrows(UserNotFoundException.class, () -> service.getRoomDetail(1L, "bob"));
    }

    @Test
    void rawRoomAndItsFileCanBeFetched() {
        Room room = flagRoom(1L, 100, "FLAG{ok}");
        RoomFile file = new RoomFile("dump.pcap", "application/octet-stream", new byte[0], room);
        when(userRepository.findIdByUsername("alice")).thenReturn(Optional.of(7L));
        when(roomFileRepository.findByRoomId(1L)).thenReturn(Optional.of(file));

        assertSame(room, service.getRoomById(1L));
        assertSame(file, service.getRoomFile(1L, "alice"));
        verify(pathUnlockPolicy).requireUnlocked(1L, 7L);
    }

    @Test
    void missingRoomOrFileFails() {
        when(userRepository.findIdByUsername("alice")).thenReturn(Optional.of(7L));

        assertThrows(IllegalArgumentException.class, () -> service.getRoomById(99L));
        assertThrows(IllegalArgumentException.class, () -> service.getRoomFile(1L, "alice"));
        assertThrows(UserNotFoundException.class, () -> service.getRoomFile(1L, "bob"));
    }


    @Test
    void adminSeesTasksOrderedWithRevision() {
        Room room = taskRoom(2L, 10);
        room.setTasksRevision(5);
        room.getTasks().add(RoomTask.builder().id(22L).title("C").sortOrder(1).build());
        room.getTasks().add(RoomTask.builder().id(21L).title("B").sortOrder(0).build());
        room.getTasks().add(RoomTask.builder().id(20L).title("A").sortOrder(0).build());

        var tasks = service.getRoomTasksForAdmin(2L);

        assertEquals(5, tasks.revision());
        assertEquals(List.of("A", "B", "C"), tasks.tasks().stream().map(RoomTaskAdminDto::title).toList());
    }

    @Test
    void savingTasksReordersKeepsRemovesAndAddsTasks() {
        Room room = taskRoom(2L, 10, task(20L, "a"), task(21L, "b"));
        room.setTasksRevision(4);

        var result = service.updateRoomTasks(2L, new UpdateRoomTasksRequest(4L, List.of(
                new RoomTaskRequest(null, " Nowe ", "<b>Treść</b><script>x()</script>", "Pytanie?", " odp "),
                new RoomTaskRequest(21L, "B", "Treść B", "  ", null))));

        assertEquals(5, result.revision());
        assertEquals(List.of("Nowe", "B"), result.tasks().stream().map(RoomTaskAdminDto::title).toList());
        assertEquals("<b>Treść</b>", result.tasks().get(0).content());
        assertEquals("odp", result.tasks().get(0).answer());
        assertNull(result.tasks().get(1).question());
        assertEquals(List.of(21L), room.getTasks().stream().map(RoomTask::getId).filter(java.util.Objects::nonNull).toList());
        assertEquals(2, room.getTasks().size());
        verify(roomTaskRepository).save(argThat(t -> t.getTitle().equals("Nowe") && t.getSortOrder() == 0));
    }

    @Test
    void visibleRoomCannotTurnIntoCtfWithATaskWithoutFlag() {
        Room room = taskRoom(2L, 10, task(20L, null));
        visible(2L);

        var error = assertThrows(IllegalArgumentException.class,
                () -> service.updateRoom(2L, updateRequest("Room 2", RoomType.CTF), null));

        assertEquals("Zadanie 1: podaj flagę", error.getMessage());
        assertEquals(RoomType.PATH, room.getRoomType());
    }

    @Test
    void visibleRoomCannotTurnIntoTheoryWithAFlagWithoutQuestion() {
        flagRoom(1L, 100, "FLAG{ok}");
        visible(1L);

        assertThrows(IllegalArgumentException.class,
                () -> service.updateRoom(1L, updateRequest("Room 1", RoomType.PATH), null));
    }

    @Test
    void editorChangesTheTypeBeforeItSavesTheMatchingTasks() throws IOException {
        Room room = taskRoom(2L, 10, task(20L, null));
        visible(2L);
        returnSavedRoom();

        service.updateRoomBeforeTasks(2L, updateRequest("Room 2", RoomType.CTF), null);

        assertEquals(RoomType.CTF, room.getRoomType());
    }

    @Test
    void visibleRoomWithoutTasksMayStillChangeItsType() throws IOException {
        Room room = taskRoom(2L, 10);
        visible(2L);
        returnSavedRoom();

        service.updateRoom(2L, updateRequest("Room 2", RoomType.CTF), null);

        assertEquals(RoomType.CTF, room.getRoomType());
    }

    @Test
    void visibleRoomKeepsAtLeastOneTask() {
        Room room = taskRoom(2L, 10, task(20L, "a"));
        visible(2L);

        var error = assertThrows(IllegalArgumentException.class,
                () -> service.updateRoomTasks(2L, new UpdateRoomTasksRequest(0L, List.of())));

        assertEquals("Dodaj przynajmniej jedno zadanie", error.getMessage());
        assertEquals(1, room.getTasks().size());
    }

    @Test
    void roomOutsidePublishedPathsMayHaveNoTasks() {
        taskRoom(2L, 10, task(20L, "a"));

        assertTrue(service.updateRoomTasks(2L, new UpdateRoomTasksRequest(0L, List.of())).tasks().isEmpty());
    }

    @Test
    void visibleCtfTaskNeedsAFlagButNoQuestion() {
        flagRoom(1L, 100, "FLAG{ok}");
        visible(1L);

        var result = service.updateRoomTasks(1L, new UpdateRoomTasksRequest(0L, List.of(
                new RoomTaskRequest(10L, "Flaga", "Znajdź flagę", null, " HACK{x} "))));
        assertEquals("HACK{x}", result.tasks().get(0).answer());
        assertNull(result.tasks().get(0).question());

        assertThrows(IllegalArgumentException.class, () -> service.updateRoomTasks(1L,
                new UpdateRoomTasksRequest(1L, List.of(new RoomTaskRequest(10L, "Flaga", "Znajdź flagę", "Pytanie?", "  ")))));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(longs = 3)
    void staleTaskRevisionIsAConflict(Long revision) {
        taskRoom(2L, 10).setTasksRevision(4);

        var error = assertThrows(ResponseStatusException.class,
                () -> service.updateRoomTasks(2L, new UpdateRoomTasksRequest(revision, List.of())));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @ParameterizedTest(name = "question={0}, answer={1}")
    @CsvSource({"Pytanie?,", ",odp"})
    void visibleRoomNeedsQuestionAndAnswerTogether(String question, String answer) {
        taskRoom(2L, 10);
        visible(2L);

        assertThrows(IllegalArgumentException.class, () -> service.updateRoomTasks(2L,
                new UpdateRoomTasksRequest(0L, List.of(new RoomTaskRequest(null, "T", "Treść", question, answer)))));
    }

    @Test
    void roomOutsidePublishedPathsMayHaveQuestionWithoutAnswer() {
        taskRoom(2L, 10);

        var result = service.updateRoomTasks(2L,
                new UpdateRoomTasksRequest(0L, List.of(new RoomTaskRequest(null, "T", "", "Pytanie?", null))));

        assertEquals("Pytanie?", result.tasks().get(0).question());
    }

    @Test
    void visibleRoomTaskNeedsContentAfterSanitizing() {
        taskRoom(2L, 10);
        visible(2L);

        assertThrows(IllegalArgumentException.class, () -> service.updateRoomTasks(2L,
                new UpdateRoomTasksRequest(0L, List.of(new RoomTaskRequest(null, "T", "<script>x()</script>", null, null)))));
    }

    @Test
    void taskFromAnotherRoomCannotBeSaved() {
        taskRoom(2L, 10, task(20L, "a"));

        assertThrows(IllegalArgumentException.class, () -> service.updateRoomTasks(2L,
                new UpdateRoomTasksRequest(0L, List.of(new RoomTaskRequest(99L, "T", "Treść", null, null)))));
    }

    @Test
    void taskCannotAppearTwice() {
        taskRoom(2L, 10, task(20L, "a"));

        assertThrows(IllegalArgumentException.class, () -> service.updateRoomTasks(2L, new UpdateRoomTasksRequest(0L, List.of(
                new RoomTaskRequest(20L, "T", "Treść", null, null),
                new RoomTaskRequest(20L, "T", "Treść", null, null)))));
    }

    @Test
    void taskEditorForUnknownRoomFails() {
        assertThrows(IllegalArgumentException.class, () -> service.getRoomTasksForAdmin(99L));
        assertThrows(IllegalArgumentException.class,
                () -> service.updateRoomTasks(99L, new UpdateRoomTasksRequest(0L, List.of())));
    }


    // The room sits in a published path, so players see it.
    void visible(Long id) {
        when(roomRepository.isVisible(id)).thenReturn(true);
    }

    Room flagRoom(Long id, int points, String flag) {
        Room room = taskRoom(id, points, task(id * 10, flag));
        room.setRoomType(RoomType.CTF);
        completedTasks(1);
        return room;
    }

    SolveRoomResponse solveFlag(Long roomId, String flag, String username) {
        return service.solveTask(roomId, roomId * 10, flag, username);
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

    static void assertStatus(HttpStatus status, org.junit.jupiter.api.function.Executable call) {
        assertEquals(status, assertThrows(ResponseStatusException.class, call).getStatusCode());
    }

    Room hintRoom(Long id, Long... hintIds) {
        Room room = flagRoom(id, 100, "FLAG{ok}");
        RoomTask task = room.getTasks().get(0);
        for (Long hintId : hintIds) {
            Hint hint = new Hint("Podpowiedź " + hintId, task, task.getHints().size());
            hint.setId(hintId);
            task.getHints().add(hint);
            lenient().when(hintRepository.findById(hintId)).thenReturn(Optional.of(hint));
        }
        lenient().when(roomRepository.existsById(id)).thenReturn(true);
        return room;
    }

    static RoomTask task(Long id, String answer) {
        return RoomTask.builder().id(id).title("Zadanie " + id).content("Treść").answer(answer).build();
    }

    void completedTasks(long count) {
        when(userCompletedTaskRepository.countByUserIdAndTaskIdIn(eq(7L), anyList())).thenReturn(count);
    }

    void returnSavedRoom() {
        when(roomRepository.save(any(Room.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    static CreateRoomRequest createRequest(String title, DifficultyLevel difficulty, Integer points, RoomType type) {
        return new CreateRoomRequest(title, "Opis", "Krótko", difficulty, "Web", points, false, type);
    }

    static UpdateRoomRequest updateRequest(String title, RoomType type) {
        return new UpdateRoomRequest(title, "Opis", "Krótko", DifficultyLevel.MEDIUM, "Web", 10, false, type);
    }

    static RoomSummaryDto summary(Long id, String title, boolean requiresVpn, RoomType type) {
        return new RoomSummaryDto(id, title, null, DifficultyLevel.EASY, "Web", 50, 0, requiresVpn, type, null);
    }

    void alreadySolved(Long roomId) {
        when(userSolvedRoomRepository.existsByUser_IdAndRoom_Id(7L, roomId)).thenReturn(true);
    }

    void unlockedHints(Long roomId, long count) {
        when(userUnlockedHintRepository.countByUser_IdAndHint_Task_Room_Id(7L, roomId)).thenReturn(count);
    }

    void firstSolveBadgeAvailable() {
        Badge badge = new Badge("Pierwsza krew", "Rozwiąż pierwszy pokój", "icon", "SOLVED_COUNT", 1);
        badge.setId(1L);
        when(badgeRepository.findAll()).thenReturn(List.of(badge));
        when(userSolvedRoomRepository.countByUser_Id(7L)).thenReturn(1L);
        when(userRepository.count()).thenReturn(1L);
    }

    private static ChapterRoomRepository.RoomOwnerView owner(Long roomId, Long pathId, String title, boolean published) {
        record Owner(Long getRoomId, Long getPathId, String getPathTitle, Boolean getPathPublished)
                implements ChapterRoomRepository.RoomOwnerView {}
        return new Owner(roomId, pathId, title, published);
    }
}
