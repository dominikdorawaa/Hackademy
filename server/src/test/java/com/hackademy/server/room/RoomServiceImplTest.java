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
        flagRoom(1L, 100, "FLAG{ok}");

        service.solveRoom(1L, "FLAG{ok}", "alice");

        verify(roomRepository).incrementSolutions(1L);
    }

    @Test
    void wrongFlagIsRejectedWithoutPoints() {
        flagRoom(1L, 100, "FLAG{ok}");

        var result = service.solveRoom(1L, "FLAG{nope}", "alice");

        assertEquals(new SolveRoomResponse(false, "Niepoprawna flaga", 0, List.of()), result);
        assertEquals(40, alice.getPoints());
        verify(roomRepository, never()).incrementSolutions(any());
    }

    @Test
    void onlyACorrectFlagLocksTheUser() {
        flagRoom(1L, 100, "FLAG{ok}");

        service.solveRoom(1L, "FLAG{nope}", "alice");
        verify(userRepository, never()).findByUsernameForUpdate(any());

        service.solveRoom(1L, "FLAG{ok}", "alice");
        verify(userRepository).findByUsernameForUpdate("alice");
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
        verify(userSolvedRoomRepository).save(argThat(s -> s.getAwardedPoints() == expected));
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

    // ── guessing limit ──────────────────────────────────────────────────────

    @Test
    void wrongFlagsAndTaskAnswersShareOneLimitPerRoom() {
        Room room = taskRoom(2L, 100, task(20L, "a"));
        room.setFlag("FLAG{ok}");

        assertFalse(service.solveRoom(2L, "FLAG{nope}", "alice").success());
        assertFalse(service.solveTask(2L, 20L, "nope", "alice").success());

        assertThrows(RoomAnswerLimitException.class, () -> service.solveTask(2L, 20L, "a", "alice"));
        assertThrows(RoomAnswerLimitException.class, () -> service.solveRoom(2L, "FLAG{ok}", "alice"));
        verify(userSolvedRoomRepository, never()).save(any());
        verify(userCompletedTaskRepository, never()).save(any());
        assertEquals(40, alice.getPoints());
    }

    @Test
    void rightAnswersAndBlankFlagsDoNotCountTowardsTheLimit() {
        flagRoom(1L, 100, "FLAG{ok}");
        alreadySolved(1L);

        for (int i = 0; i < 5; i++) {
            assertTrue(service.solveRoom(1L, "FLAG{ok}", "alice").success());
            assertThrows(ResponseStatusException.class, () -> service.solveRoom(1L, " ", "alice"));
        }

        assertFalse(service.solveRoom(1L, "FLAG{nope}", "alice").success());
        assertFalse(service.solveRoom(1L, "FLAG{nope}", "alice").success());
        assertThrows(RoomAnswerLimitException.class, () -> service.solveRoom(1L, "FLAG{nope}", "alice"));
    }

    @Test
    void aBlockedRoomLeavesOtherRoomsSolvable() {
        flagRoom(1L, 100, "FLAG{ok}");
        flagRoom(3L, 50, "FLAG{other}");
        service.solveRoom(1L, "FLAG{nope}", "alice");
        service.solveRoom(1L, "FLAG{nope}", "alice");

        var result = service.solveRoom(3L, "FLAG{other}", "alice");

        assertTrue(result.success());
        assertEquals(50, result.pointsEarned());
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
    @CsvSource({"0,100", "1,75", "2,50", "3,25", "4,0", "5,0"})
    void eachUnlockedHintCostsAQuarterOfTaskRoomPoints(long hints, int expected) {
        taskRoom(2L, 100, task(20L, "a"));
        completedTasks(1);
        unlockedHints(2L, hints);

        assertEquals(expected, service.completeTaskRoom(2L, "alice").pointsEarned());
        assertEquals(40 + expected, alice.getPoints());
        verify(userSolvedRoomRepository).save(argThat(s -> s.getAwardedPoints() == expected));
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

    // ── creating rooms ──────────────────────────────────────────────────────

    @Test
    void newRoomIsADraftCtfWithHintsInGivenOrder() throws IOException {
        returnSavedRoom();

        Room room = service.createRoom(createRequest("  Nowy  ", DifficultyLevel.HARD, null, null, List.of("Pierwsza", "Druga")), null);

        assertFalse(room.isPublished());
        assertEquals(RoomType.CTF, room.getRoomType());
        assertEquals("Nowy", room.getTitle());
        assertEquals(List.of("Pierwsza", "Druga"), room.getHints().stream().map(Hint::getDescription).toList());
        verifyNoInteractions(roomFileRepository);
    }

    @Test
    void ctfRoomPointsComeFromDifficultyNotFromRequest() throws IOException {
        returnSavedRoom();

        Room room = service.createRoom(createRequest("Nowy", DifficultyLevel.HARD, 999, RoomType.CTF, null), null);

        assertEquals(150, room.getPoints());
    }

    @Test
    void pathRoomKeepsRequestedPoints() throws IOException {
        returnSavedRoom();

        Room room = service.createRoom(createRequest("Nowy", DifficultyLevel.HARD, 30, RoomType.PATH, null), null);

        assertEquals(30, room.getPoints());
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(ints = -1)
    void pathRoomNeedsNonNegativePoints(Integer points) {
        var error = assertThrows(RoomRuleException.class,
                () -> service.createRoom(createRequest("Nowy", DifficultyLevel.EASY, points, RoomType.PATH, null), null));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        assertEquals("points", error.field());
    }

    @ParameterizedTest
    @ValueSource(strings = {"Tutorial VM", "tutorial vpn"})
    void tutorialTitlesAreReserved(String title) {
        var error = assertThrows(RoomRuleException.class,
                () -> service.createRoom(createRequest(title, DifficultyLevel.EASY, null, null, null), null));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        assertEquals("title", error.field());
    }

    @Test
    void ctfTitleMustBeUnique() {
        when(roomRepository.existsByTitleAndRoomType("Zajęty", RoomType.CTF)).thenReturn(true);

        var error = assertThrows(RoomRuleException.class,
                () -> service.createRoom(createRequest("Zajęty", DifficultyLevel.EASY, null, null, null), null));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    void pathRoomMayShareTitleWithCtfRoom() throws IOException {
        returnSavedRoom();
        when(roomRepository.existsByTitleAndRoomType("Zajęty", RoomType.CTF)).thenReturn(true);

        assertEquals("Zajęty", service.createRoom(createRequest("Zajęty", DifficultyLevel.EASY, 10, RoomType.PATH, null), null).getTitle());
    }

    @Test
    void uploadedFileIsStoredWithTheRoom() throws IOException {
        returnSavedRoom();
        var file = new MockMultipartFile("file", "dump.pcap", "application/octet-stream", new byte[] {1, 2});

        Room room = service.createRoom(createRequest("Nowy", DifficultyLevel.EASY, null, null, null), file);

        verify(roomFileRepository).save(argThat(f -> f.getFileName().equals("dump.pcap") && f.getRoom() == room));
    }

    @Test
    void emptyUploadIsIgnored() throws IOException {
        returnSavedRoom();

        service.createRoom(createRequest("Nowy", DifficultyLevel.EASY, null, null, null),
                new MockMultipartFile("file", "empty.txt", "text/plain", new byte[0]));

        verifyNoInteractions(roomFileRepository);
    }

    // ── editing and deleting rooms ──────────────────────────────────────────

    @Test
    void editingRoomBumpsContentRevisionAndKeepsMatchingHints() throws IOException {
        Room room = hintRoom(1L, 11L, 12L);
        room.setTitle("Stary");
        room.setContentRevision(3);
        returnSavedRoom();

        service.updateRoom(1L, updateRequest("Nowy", RoomType.CTF, List.of("Podpowiedź 12", "Świeża")), null);

        assertEquals(4, room.getContentRevision());
        assertEquals("Nowy", room.getTitle());
        assertEquals(DifficultyLevel.MEDIUM.ctfPoints(), room.getPoints());
        assertEquals(12L, room.getHints().get(0).getId());
        assertNull(room.getHints().get(1).getId());
        assertEquals("Świeża", room.getHints().get(1).getDescription());
    }

    @Test
    void editingWithoutHintsRemovesThem() throws IOException {
        Room room = hintRoom(1L, 11L);
        room.setTitle("Stary");
        returnSavedRoom();

        service.updateRoom(1L, updateRequest("Stary", RoomType.CTF, null), null);

        assertTrue(room.getHints().isEmpty());
    }

    @Test
    void pathRoomInChapterCannotBecomeCtf() {
        taskRoom(2L, 10);
        when(chapterRoomRepository.existsByRoomId(2L)).thenReturn(true);

        assertThrows(IllegalArgumentException.class,
                () -> service.updateRoom(2L, updateRequest("Room 2", RoomType.CTF, null), null));
    }

    @Test
    void pathRoomWithTasksCannotBecomeCtf() {
        taskRoom(2L, 10, task(20L, "a"));

        assertThrows(IllegalArgumentException.class,
                () -> service.updateRoom(2L, updateRequest("Room 2", RoomType.CTF, null), null));
    }

    @Test
    void keepingReservedTutorialTitleIsAllowed() throws IOException {
        Room room = flagRoom(1L, 100, "FLAG{ok}");
        room.setTitle("Tutorial VM");
        returnSavedRoom();

        assertEquals("Tutorial VM", service.updateRoom(1L, updateRequest("Tutorial VM", RoomType.CTF, null), null).getTitle());
    }

    @Test
    void renamingToReservedTutorialTitleIsRefused() {
        flagRoom(1L, 100, "FLAG{ok}");

        assertThrows(RoomRuleException.class,
                () -> service.updateRoom(1L, updateRequest("Tutorial VPN", RoomType.CTF, null), null));
    }

    @Test
    void renamingCtfRoomToAnotherCtfTitleIsRefused() {
        flagRoom(1L, 100, "FLAG{ok}");
        when(roomRepository.existsByTitleAndRoomTypeAndIdNot("Zajęty", RoomType.CTF, 1L)).thenReturn(true);

        var error = assertThrows(RoomRuleException.class,
                () -> service.updateRoom(1L, updateRequest("Zajęty", RoomType.CTF, null), null));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    void renamingToTitleUsedInSameChapterIsRefused() {
        taskRoom(2L, 10);
        when(chapterRoomRepository.existsByRoomId(2L)).thenReturn(true);
        when(chapterRoomRepository.existsOtherRoomWithTitleInSameChapter(2L, "Sąsiad")).thenReturn(true);

        var error = assertThrows(RoomRuleException.class,
                () -> service.updateRoom(2L, updateRequest("Sąsiad", RoomType.PATH, null), null));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    void editingReplacesExistingFile() throws IOException {
        flagRoom(1L, 100, "FLAG{ok}");
        returnSavedRoom();
        RoomFile existing = new RoomFile("old.txt", "text/plain", new byte[] {1}, null);
        when(roomFileRepository.findByRoomId(1L)).thenReturn(Optional.of(existing));

        service.updateRoom(1L, updateRequest("Room 1", RoomType.CTF, null),
                new MockMultipartFile("file", "new.txt", "text/plain", new byte[] {2}));

        assertEquals("new.txt", existing.getFileName());
        assertArrayEquals(new byte[] {2}, existing.getData());
    }

    @Test
    void editingAddsFileWhenRoomHadNone() throws IOException {
        flagRoom(1L, 100, "FLAG{ok}");
        returnSavedRoom();

        service.updateRoom(1L, updateRequest("Room 1", RoomType.CTF, null),
                new MockMultipartFile("file", "new.txt", "text/plain", new byte[] {2}));

        verify(roomFileRepository).save(argThat(f -> f.getFileName().equals("new.txt")));
    }

    @Test
    void editingUnknownRoomFails() {
        assertThrows(IllegalArgumentException.class,
                () -> service.updateRoom(99L, updateRequest("X", RoomType.CTF, null), null));
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

    // ── room lists ──────────────────────────────────────────────────────────

    @Test
    void anonymousVisitorSeesNothingSolvedAndVpnRoomsLocked() {
        when(roomRepository.findAllSummaries()).thenReturn(List.of(
                summary(1L, "Tutorial VM", false, RoomType.CTF),
                summary(2L, "Tutorial VPN", false, RoomType.CTF),
                summary(3L, "Sieć", true, RoomType.CTF),
                summary(4L, "Web", false, RoomType.CTF)));

        var rooms = service.getAllRooms(null);

        assertEquals(List.of(false, false, false, false), rooms.stream().map(RoomSummaryDto::isSolved).toList());
        assertEquals(List.of(false, true, true, false), rooms.stream().map(RoomSummaryDto::isLocked).toList());
    }

    @Test
    void solvingTutorialsUnlocksVpnRooms() {
        stubTutorials(List.of(1L, 2L), List.of("Tutorial VM", "Tutorial VPN"));
        when(roomRepository.findAllSummaries()).thenReturn(List.of(
                summary(1L, "Tutorial VM", false, RoomType.CTF),
                summary(2L, "Tutorial VPN", false, RoomType.CTF),
                summary(3L, "Sieć", true, RoomType.CTF)));

        var rooms = service.getAllRooms("alice");

        assertEquals(List.of(true, true, false), rooms.stream().map(RoomSummaryDto::isSolved).toList());
        assertEquals(List.of(false, false, false), rooms.stream().map(RoomSummaryDto::isLocked).toList());
    }

    @Test
    void tutorialVmAloneUnlocksTutorialVpnButNotVpnRooms() {
        stubTutorials(List.of(1L), List.of("Tutorial VM"));
        when(roomRepository.findAllSummaries()).thenReturn(List.of(
                summary(2L, "Tutorial VPN", false, RoomType.CTF),
                summary(3L, "Sieć", true, RoomType.CTF)));

        var rooms = service.getAllRooms("alice");

        assertEquals(List.of(false, true), rooms.stream().map(RoomSummaryDto::isLocked).toList());
    }

    @Test
    void listCanBeFilteredByRoomType() {
        when(roomRepository.findAllSummaries()).thenReturn(List.of(
                summary(1L, "CTF", false, RoomType.CTF),
                summary(2L, "Ścieżka", false, RoomType.PATH)));

        assertEquals(List.of(2L), service.getAllRoomsByType(null, RoomType.PATH).stream().map(RoomSummaryDto::getId).toList());
        assertEquals(List.of(1L, 2L), service.getAllRoomsByType(null, null).stream().map(RoomSummaryDto::getId).toList());
    }

    @Test
    void listForUnknownUserFails() {
        when(userRepository.findIdByUsername("bob")).thenReturn(Optional.empty());

        assertThrows(UserNotFoundException.class, () -> service.getAllRooms("bob"));
    }

    @Test
    void adminAndLandingListsComeFromRepository() {
        var admin = List.of(new RoomAdminSummaryDto(1L, "Web", "Web", DifficultyLevel.EASY, 50, false, RoomType.CTF, null, null, true));
        var top = List.of(summary(1L, "Web", false, RoomType.CTF));
        when(roomRepository.findAllAdminSummaries()).thenReturn(admin);
        when(roomRepository.findTop3ByCategoryNot("Tutorial", PageRequest.of(0, 3))).thenReturn(top);

        assertEquals(admin, service.getAllRoomsForAdmin());
        assertEquals(top, service.getTop3Rooms());
    }

    // ── room detail ─────────────────────────────────────────────────────────

    @Test
    void detailShowsSortedHintsUnlockedHintsTasksAndFile() {
        Room room = hintRoom(1L, 12L, 11L);
        when(roomFileRepository.findFileNameByRoomId(1L)).thenReturn("dump.pcap");
        RoomTask done = task(20L, "a");
        RoomTask open = task(21L, "b");
        done.setRoom(room);
        open.setRoom(room);
        when(roomTaskRepository.findByRoomIdOrderBySortOrderAsc(1L)).thenReturn(List.of(done, open));
        when(userCompletedTaskRepository.findCompletedTaskIdsInRoom(7L, 1L)).thenReturn(List.of(20L));
        when(userUnlockedHintRepository.findByUser_IdAndHint_Room_Id(7L, 1L))
                .thenReturn(List.of(new UserUnlockedHint(alice, room.getHints().get(1))));
        alreadySolved(1L);

        var detail = service.getRoomDetail(1L, "alice");

        assertTrue(detail.solved());
        assertEquals(List.of(new HintDto(11L, "Podpowiedź 11"), new HintDto(12L, "Podpowiedź 12")), detail.hints());
        assertEquals(List.of(11L), detail.unlockedHintIds());
        assertEquals(List.of(true, false), detail.tasks().stream().map(RoomTaskDto::completed).toList());
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

    // ── task editor ─────────────────────────────────────────────────────────

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
    void tasksCanOnlyBeAddedToPathRooms() {
        flagRoom(1L, 100, "FLAG{ok}");

        assertThrows(IllegalArgumentException.class,
                () -> service.updateRoomTasks(1L, new UpdateRoomTasksRequest(0L, List.of())));
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
    void publishedRoomNeedsQuestionAndAnswerTogether(String question, String answer) {
        taskRoom(2L, 10).setPublished(true);

        assertThrows(IllegalArgumentException.class, () -> service.updateRoomTasks(2L,
                new UpdateRoomTasksRequest(0L, List.of(new RoomTaskRequest(null, "T", "Treść", question, answer)))));
    }

    @Test
    void draftRoomMayHaveQuestionWithoutAnswer() {
        taskRoom(2L, 10).setPublished(false);

        var result = service.updateRoomTasks(2L,
                new UpdateRoomTasksRequest(0L, List.of(new RoomTaskRequest(null, "T", "", "Pytanie?", null))));

        assertEquals("Pytanie?", result.tasks().get(0).question());
    }

    @Test
    void publishedRoomTaskNeedsContentAfterSanitizing() {
        taskRoom(2L, 10).setPublished(true);

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

    void returnSavedRoom() {
        when(roomRepository.save(any(Room.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    static CreateRoomRequest createRequest(String title, DifficultyLevel difficulty, Integer points, RoomType type, List<String> hints) {
        return new CreateRoomRequest(title, "Opis", "Krótko", difficulty, "Web", points, "FLAG{new}", false, type, hints);
    }

    static UpdateRoomRequest updateRequest(String title, RoomType type, List<String> hints) {
        return new UpdateRoomRequest(title, "Opis", "Krótko", DifficultyLevel.MEDIUM, "Web", 10, "FLAG{new}", false, type, hints);
    }

    static RoomSummaryDto summary(Long id, String title, boolean requiresVpn, RoomType type) {
        return new RoomSummaryDto(id, title, null, DifficultyLevel.EASY, "Web", 50, 0, requiresVpn, type, null);
    }

    void stubTutorials(List<Long> solvedIds, List<String> solvedTutorials) {
        when(userRepository.findIdByUsername("alice")).thenReturn(Optional.of(7L));
        when(userSolvedRoomRepository.findSolvedRoomIdsByUserId(7L)).thenReturn(solvedIds);
        when(userSolvedRoomRepository.findSolvedRoomTitlesByUserId(eq(7L), anyList())).thenReturn(solvedTutorials);
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
