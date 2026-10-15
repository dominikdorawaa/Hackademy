package com.hackademy.server.path;

import com.hackademy.server.content.ContentVisibility;
import com.hackademy.server.path.dto.ChapterRequest;
import com.hackademy.server.path.dto.CreatePathRequest;
import com.hackademy.server.path.dto.PathChapterAdminDto;
import com.hackademy.server.path.dto.PathProgressDto;
import com.hackademy.server.path.dto.PathRoomMiniDto;
import com.hackademy.server.path.dto.PathSummaryDto;
import com.hackademy.server.path.dto.UpdatePathChaptersRequest;
import com.hackademy.server.path.dto.UpdatePathMetaRequest;
import com.hackademy.server.room.Room;
import com.hackademy.server.room.RoomRepository;
import com.hackademy.server.room.RoomService;
import com.hackademy.server.room.RoomType;
import com.hackademy.server.room.UserSolvedRoomRepository;
import com.hackademy.server.room.dto.RoomSummaryDto;
import com.hackademy.server.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PathServiceImplTest {

    @Mock PathRepository pathRepository;
    @Mock PathChapterRepository pathChapterRepository;
    @Mock ChapterRoomRepository chapterRoomRepository;
    @Mock RoomRepository roomRepository;
    @Mock RoomService roomService;
    @Mock PathEnrollmentRepository pathEnrollmentRepository;
    @Mock UserRepository userRepository;
    @Mock UserSolvedRoomRepository userSolvedRoomRepository;
    @Mock ContentVisibility visibility;
    @InjectMocks PathServiceImpl service;

    // ── listing and progress ────────────────────────────────────────────────

    @Test
    void listsPathsWithEnrollmentAndBannerForLoggedInUser() {
        when(userRepository.findIdByUsername("alice")).thenReturn(Optional.of(1L));
        when(pathEnrollmentRepository.findPathIdsByUserId(1L)).thenReturn(Set.of(2L));
        when(pathRepository.findAllListViews()).thenReturn(List.of(
                new ListView(1L, "Web", "Opis", "https://img", false, true, 3),
                new ListView(2L, "Linux", null, "https://unused", true, null, null)));

        var paths = service.listPaths("alice");

        assertEquals(new PathSummaryDto(1L, true, "Web", "Opis", "https://img", false, 3, false), paths.get(0));
        assertEquals(new PathSummaryDto(2L, false, "Linux", null, "/api/paths/2/banner", true, 0, true), paths.get(1));
    }

    @Test
    void anonymousUserIsNotEnrolledAnywhere() {
        when(pathRepository.findAllListViews()).thenReturn(List.of(new ListView(1L, "Web", null, null, null, true, 1)));

        assertFalse(service.listPaths(null).get(0).enrolled());
        verifyNoInteractions(userRepository, pathEnrollmentRepository);
    }

    @Test
    void progressCountsMissingTotalsAsZeroAndCompletesOnlyNonEmptyPaths() {
        when(pathRepository.findProgressForUsername("alice")).thenReturn(List.of(
                new ProgressView(1L, "Pusta", null, null, null, null),
                new ProgressView(2L, "Gotowa", "Opis", "https://img", 3, 3),
                new ProgressView(3L, "W toku", null, null, 3, 2)));

        var progress = service.getMyPathsProgress("alice");

        assertEquals(new PathProgressDto(1L, "Pusta", null, null, 0, 0, false), progress.get(0));
        assertEquals(new PathProgressDto(2L, "Gotowa", "Opis", "https://img", 3, 3, true), progress.get(1));
        assertFalse(progress.get(2).completed());
    }

    @Test
    void progressForAnonymousUserIsEmpty() {
        assertTrue(service.getMyPathsProgress(null).isEmpty());
        assertTrue(service.getMyPathsProgress("  ").isEmpty());
        verifyNoInteractions(pathRepository);
    }

    // ── path detail ─────────────────────────────────────────────────────────

    @Test
    void enrolledUserSeesRoomsGroupedByChapterWithProgress() {
        stubDetail(true);

        var detail = service.getPathDetail(5L, "alice");

        verify(visibility).requirePath(5L);
        assertTrue(detail.enrolled());
        assertEquals("/api/paths/5/banner", detail.bannerUrl());
        assertTrue(detail.hasBanner());
        assertEquals(2, detail.chapters().size());
        var first = detail.chapters().get(0);
        assertEquals(List.of(10L, 11L), first.rooms().stream().map(RoomSummaryDto::getId).toList());
        assertEquals(2, first.totalRooms());
        assertEquals(1, first.solvedRooms());
        assertEquals(0, detail.chapters().get(1).totalRooms());
        assertEquals(2, detail.rooms().size());
        assertFalse(detail.rooms().get(1).isLocked());
    }

    @Test
    void userWhoIsNotEnrolledSeesLockedUnsolvedRooms() {
        stubDetail(false);

        var detail = service.getPathDetail(5L, "alice");

        assertFalse(detail.enrolled());
        assertTrue(detail.rooms().stream().allMatch(room -> room.isLocked() && !room.isSolved()));
        assertEquals(0, detail.chapters().get(0).solvedRooms());
    }

    @Test
    void detailUsesBannerUrlWhenNoBannerIsStored() {
        when(pathRepository.findById(5L)).thenReturn(Optional.of(path(5L, "Web")));

        var detail = service.getPathDetail(5L, null);

        assertEquals("https://img", detail.bannerUrl());
        assertFalse(detail.hasBanner());
        assertFalse(detail.enrolled());
        verify(roomService).getAllRoomsByType(null, RoomType.PATH);
    }

    @Test
    void detailOfMissingPathFails() {
        when(pathRepository.findById(5L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> service.getPathDetail(5L, "alice"));
    }

    private void stubDetail(boolean enrolled) {
        var path = path(5L, "Web");
        path.setBannerData(new byte[] {1});
        when(pathRepository.findById(5L)).thenReturn(Optional.of(path));
        when(pathChapterRepository.findByPathIdOrderBySortOrderAscIdAsc(5L))
                .thenReturn(List.of(chapter(100L, "Pierwszy", 0), chapter(101L, "Drugi", 1)));
        when(chapterRoomRepository.findByPathId(5L)).thenReturn(List.of(
                new ChapterRoom(10L, 100L, 0), new ChapterRoom(11L, 100L, 1), new ChapterRoom(99L, 100L, 2)));
        when(userRepository.findIdByUsername("alice")).thenReturn(Optional.of(1L));
        when(pathEnrollmentRepository.existsByUserIdAndPathId(1L, 5L)).thenReturn(enrolled);
        when(roomService.getAllRoomsByType("alice", RoomType.PATH)).thenReturn(List.of(
                room(10L, true), room(11L, false), room(10L, false)));
    }

    // ── enrollment ──────────────────────────────────────────────────────────

    @Test
    void enrollsUserOnce() {
        when(pathRepository.existsById(5L)).thenReturn(true);
        when(userRepository.findIdByUsername("alice")).thenReturn(Optional.of(1L));
        when(pathEnrollmentRepository.existsByUserIdAndPathId(1L, 5L)).thenReturn(false, true);

        service.enrollUser(5L, "alice");
        service.enrollUser(5L, "alice");

        var saved = ArgumentCaptor.forClass(PathEnrollment.class);
        verify(pathEnrollmentRepository, times(1)).save(saved.capture());
        assertEquals(1L, saved.getValue().getUserId());
        assertEquals(5L, saved.getValue().getPathId());
        verify(visibility, times(2)).requirePath(5L);
    }

    @Test
    void enrollingRequiresPathAndUser() {
        when(pathRepository.existsById(5L)).thenReturn(false);
        assertThrows(IllegalArgumentException.class, () -> service.enrollUser(5L, "alice"));

        when(pathRepository.existsById(5L)).thenReturn(true);
        when(userRepository.findIdByUsername("ghost")).thenReturn(Optional.empty());
        assertThrows(IllegalStateException.class, () -> service.enrollUser(5L, "ghost"));
        assertThrows(IllegalStateException.class, () -> service.enrollUser(5L, null));
        verify(pathEnrollmentRepository, never()).save(any());
    }

    @Test
    void unenrollsUser() {
        when(userRepository.findIdByUsername("alice")).thenReturn(Optional.of(1L));

        service.unenrollUser(5L, "alice");

        verify(pathEnrollmentRepository).deleteByUserIdAndPathId(1L, 5L);
        // Unlike enrollUser and isEnrolled, unenrolling does not check path visibility (see #104).
        verifyNoInteractions(visibility);
    }

    @Test
    void unenrollingAnonymousOrUnknownUserDoesNothing() {
        when(userRepository.findIdByUsername("ghost")).thenReturn(Optional.empty());

        service.unenrollUser(5L, null);
        service.unenrollUser(5L, "ghost");

        verifyNoInteractions(pathEnrollmentRepository);
    }

    @Test
    void checksEnrollment() {
        when(userRepository.findIdByUsername("alice")).thenReturn(Optional.of(1L));
        when(pathEnrollmentRepository.existsByUserIdAndPathId(1L, 5L)).thenReturn(true);

        assertTrue(service.isEnrolled(5L, "alice"));
        assertFalse(service.isEnrolled(5L, null));
        verify(visibility, times(2)).requirePath(5L);
    }

    // ── path room list ──────────────────────────────────────────────────────

    @Test
    void locksTutorialAndVpnRoomsUntilTutorialsAreSolved() {
        when(pathRepository.existsById(5L)).thenReturn(true);
        when(userRepository.findIdByUsername("alice")).thenReturn(Optional.of(1L));
        when(userSolvedRoomRepository.findSolvedRoomTitlesByUserId(1L, List.of("Tutorial VPN", "Tutorial VM")))
                .thenReturn(List.of());
        when(chapterRoomRepository.findMiniRoomsForUser(5L, 1L, 3)).thenReturn(List.of(
                new MiniRow(1L, "Tutorial VPN", null, null),
                new MiniRow(2L, "Sieć", true, false),
                new MiniRow(3L, "Web", false, true)));

        var response = service.getPathRoomsMini(5L, "alice", 3);

        verify(visibility).requirePath(5L);
        assertEquals(5L, response.pathId());
        assertEquals(List.of(
                new PathRoomMiniDto(1L, "Tutorial VPN", false, true, false),
                new PathRoomMiniDto(2L, "Sieć", false, true, true),
                new PathRoomMiniDto(3L, "Web", true, false, false)), response.rooms());
    }

    @Test
    void solvedTutorialsUnlockRooms() {
        when(pathRepository.existsById(5L)).thenReturn(true);
        when(userRepository.findIdByUsername("alice")).thenReturn(Optional.of(1L));
        when(userSolvedRoomRepository.findSolvedRoomTitlesByUserId(anyLong(), any()))
                .thenReturn(List.of("Tutorial VPN", "Tutorial VM"));
        when(chapterRoomRepository.findMiniRoomsForUser(5L, 1L, 500)).thenReturn(List.of(
                new MiniRow(1L, "Tutorial VPN", false, true),
                new MiniRow(2L, "Sieć", true, false)));

        var rooms = service.getPathRoomsMini(5L, "alice", 10_000).rooms();

        assertTrue(rooms.stream().noneMatch(PathRoomMiniDto::locked));
    }

    @Test
    void zeroOrNegativeLimitReturnsAllRoomsForAnonymousUser() {
        when(pathRepository.existsById(5L)).thenReturn(true);
        when(chapterRoomRepository.findRoomIdsOrdered(5L)).thenReturn(List.of(1L, 2L));
        when(chapterRoomRepository.findMiniRoomsForUser(5L, -1L, 2)).thenReturn(List.of());

        assertTrue(service.getPathRoomsMini(5L, null, -5).rooms().isEmpty());
        verifyNoInteractions(userSolvedRoomRepository);
    }

    @Test
    void roomListOfMissingPathFails() {
        when(pathRepository.existsById(5L)).thenReturn(false);
        assertThrows(IllegalArgumentException.class, () -> service.getPathRoomsMini(5L, "alice", 3));
    }

    // ── creating, deleting and editing ──────────────────────────────────────

    @Test
    void createsUnpublishedPathWithFirstChapterAndOrderedRooms() {
        stubPathRooms(room(17L, "A", RoomType.PATH), room(3L, "B", RoomType.PATH));
        when(pathRepository.save(any())).thenAnswer(invocation -> {
            Path path = invocation.getArgument(0);
            path.setId(5L);
            return path;
        });
        when(pathChapterRepository.save(any())).thenAnswer(invocation -> {
            PathChapter chapter = invocation.getArgument(0);
            chapter.setId(100L);
            return chapter;
        });

        var created = service.createPath(new CreatePathRequest("Web", "Opis", "https://img", List.of(17L, 3L)));

        assertEquals(new PathSummaryDto(5L, false, "Web", "Opis", "https://img", false, 2, false), created);
        var path = ArgumentCaptor.forClass(Path.class);
        verify(pathRepository).save(path.capture());
        assertFalse(path.getValue().isPublished());
        var chapter = ArgumentCaptor.forClass(PathChapter.class);
        verify(pathChapterRepository).save(chapter.capture());
        assertEquals("Rozdział 1", chapter.getValue().getTitle());
        assertEquals(5L, chapter.getValue().getPathId());
        var rooms = ArgumentCaptor.forClass(ChapterRoom.class);
        verify(chapterRoomRepository, times(2)).save(rooms.capture());
        assertEquals(List.of(17L, 3L), rooms.getAllValues().stream().map(ChapterRoom::getRoomId).toList());
        assertEquals(List.of(0, 1), rooms.getAllValues().stream().map(ChapterRoom::getSortOrder).toList());
        // Rooms are locked in ascending id order to avoid deadlocks; a HashSet would yield 17 before 3.
        InOrder lockOrder = inOrder(roomRepository);
        lockOrder.verify(roomRepository).findByIdForUpdate(3L);
        lockOrder.verify(roomRepository).findByIdForUpdate(17L);
        verify(chapterRoomRepository).flush();
    }

    @Test
    void createsPathWithoutRooms() {
        when(pathRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(pathChapterRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        assertEquals(0, service.createPath(new CreatePathRequest("Web", null, null, null)).roomsCount());
        verifyNoInteractions(roomRepository);
    }

    @Test
    void concurrentRoomAssignmentIsReportedAsConflict() {
        when(pathRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(pathChapterRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        doThrow(new DataIntegrityViolationException("duplicate")).when(chapterRoomRepository).flush();

        var error = assertThrows(ResponseStatusException.class,
                () -> service.createPath(new CreatePathRequest("Web", null, null, List.of())));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    void rejectsInvalidRoomLists() {
        assertInvalidRooms(java.util.Arrays.asList(1L, null));
        assertInvalidRooms(List.of(1L, 1L));

        when(roomRepository.findByIdForUpdate(1L)).thenReturn(Optional.empty());
        assertInvalidRooms(List.of(1L));

        when(roomRepository.findByIdForUpdate(2L)).thenReturn(Optional.of(room(2L, "Flaga", RoomType.CTF)));
        assertInvalidRooms(List.of(2L));

        when(roomRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(room(3L, "Zajęty", RoomType.PATH)));
        when(chapterRoomRepository.findOwners(Set.of(3L))).thenReturn(List.of(new Owner(3L, 9L, "Inna")));
        var error = assertInvalidRooms(List.of(3L));
        assertTrue(error.getMessage().contains("Inna"));
        verify(pathRepository, never()).save(any());
    }

    private IllegalArgumentException assertInvalidRooms(List<Long> roomIds) {
        return assertThrows(IllegalArgumentException.class,
                () -> service.createPath(new CreatePathRequest("Web", null, null, roomIds)));
    }

    @Test
    void deletesExistingPath() {
        when(pathRepository.existsById(5L)).thenReturn(true, false);

        service.deletePath(5L);
        verify(pathRepository).deleteById(5L);

        assertThrows(IllegalArgumentException.class, () -> service.deletePath(5L));
    }

    @Test
    void adminDetailListsChaptersWithRoomIds() {
        var path = path(5L, "Web");
        path.setChaptersRevision(4);
        path.setContentRevision(6);
        path.setPublished(false);
        when(pathRepository.findById(5L)).thenReturn(Optional.of(path));
        when(pathChapterRepository.findByPathIdOrderBySortOrderAscIdAsc(5L))
                .thenReturn(List.of(chapter(100L, "Pierwszy", 0), chapter(101L, "Drugi", 1)));
        when(chapterRoomRepository.findByPathId(5L)).thenReturn(List.of(new ChapterRoom(10L, 100L, 0)));

        var detail = service.getAdminDetail(5L);

        assertEquals(4, detail.revision());
        assertEquals(6, detail.contentRevision());
        assertFalse(detail.published());
        assertEquals("https://img", detail.bannerUrl());
        assertEquals(List.of(
                new PathChapterAdminDto(100L, "Pierwszy", List.of(10L)),
                new PathChapterAdminDto(101L, "Drugi", List.of())), detail.chapters());

        when(pathRepository.findById(6L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> service.getAdminDetail(6L));
    }

    @Test
    void updatesMetadataAndBumpsContentRevision() {
        var path = path(5L, "Stary");
        when(pathRepository.findByIdForUpdate(5L)).thenReturn(Optional.of(path));

        service.updatePathMeta(5L, new UpdatePathMetaRequest("Nowy", "Opis", "https://new"));

        assertEquals("Nowy", path.getTitle());
        assertEquals("Opis", path.getDescription());
        assertEquals("https://new", path.getBannerUrl());
        assertEquals(1, path.getContentRevision());
        verify(pathRepository).save(path);

        when(pathRepository.findByIdForUpdate(6L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class,
                () -> service.updatePathMeta(6L, new UpdatePathMetaRequest("x", null, null)));
    }

    @Test
    void replacesChaptersAndBumpsRevisions() {
        var path = path(5L, "Web");
        path.setChaptersRevision(2);
        when(pathRepository.findByIdForUpdate(5L)).thenReturn(Optional.of(path));
        when(pathRepository.findById(5L)).thenReturn(Optional.of(path));
        var kept = chapter(100L, "Stary", 0);
        var removed = chapter(101L, "Usunięty", 1);
        when(pathChapterRepository.findByPathIdOrderBySortOrderAscIdAsc(5L)).thenReturn(List.of(kept, removed));
        stubPathRooms(room(10L, "A", RoomType.PATH));
        when(chapterRoomRepository.findOwners(Set.of(10L))).thenReturn(List.of(new Owner(10L, 5L, "Web")));
        List<PathChapter> saved = new ArrayList<>();
        when(pathChapterRepository.save(any())).thenAnswer(invocation -> {
            PathChapter chapter = invocation.getArgument(0);
            if (chapter.getId() == null) chapter.setId(102L);
            saved.add(chapter);
            return chapter;
        });

        service.updatePathChapters(5L, new UpdatePathChaptersRequest(2L, List.of(
                new ChapterRequest(null, "  Nowy  ", List.of(10L)),
                new ChapterRequest(100L, "Stary", null))), true);

        verify(chapterRoomRepository).deleteByPathId(5L);
        verify(pathChapterRepository).deleteAll(List.of(removed));
        assertEquals(List.of("Nowy", "Stary"), saved.stream().map(PathChapter::getTitle).toList());
        assertEquals(List.of(0, 1), saved.stream().map(PathChapter::getSortOrder).toList());
        assertEquals(5L, saved.get(0).getPathId());
        verify(chapterRoomRepository).save(argThat(room -> room.getRoomId() == 10L && room.getChapterId() == 102L));
        assertEquals(3, path.getChaptersRevision());
        assertEquals(1, path.getContentRevision());
        verify(chapterRoomRepository).flush();
    }

    @Test
    void staleRevisionIsAConflict() {
        var path = path(5L, "Web");
        path.setChaptersRevision(2);
        when(pathRepository.findByIdForUpdate(5L)).thenReturn(Optional.of(path));
        var chapters = List.of(new ChapterRequest(null, "Nowy", List.of()));

        for (Long revision : java.util.Arrays.asList(null, 1L)) {
            var error = assertThrows(ResponseStatusException.class,
                    () -> service.updatePathChapters(5L, new UpdatePathChaptersRequest(revision, chapters), true));
            assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        }
        verifyNoInteractions(pathChapterRepository);
    }

    @Test
    void rejectsForeignAndRepeatedChapters() {
        when(pathRepository.findByIdForUpdate(5L)).thenReturn(Optional.of(path(5L, "Web")));
        when(pathChapterRepository.findByPathIdOrderBySortOrderAscIdAsc(5L)).thenReturn(List.of(chapter(100L, "A", 0)));

        assertThrows(IllegalArgumentException.class, () -> service.updatePathChapters(5L,
                new UpdatePathChaptersRequest(0L, List.of(new ChapterRequest(999L, "Obcy", List.of()))), true));
        assertThrows(IllegalArgumentException.class, () -> service.updatePathChapters(5L,
                new UpdatePathChaptersRequest(0L, List.of(
                        new ChapterRequest(100L, "A", List.of()),
                        new ChapterRequest(100L, "A", List.of()))), true));
        verify(chapterRoomRepository, never()).deleteByPathId(anyLong());
    }

    @Test
    void onlyAdministratorsCanDeleteChapters() {
        when(pathRepository.findByIdForUpdate(5L)).thenReturn(Optional.of(path(5L, "Web")));
        when(pathChapterRepository.findByPathIdOrderBySortOrderAscIdAsc(5L))
                .thenReturn(List.of(chapter(100L, "A", 0), chapter(101L, "B", 1)));

        assertThrows(AccessDeniedException.class, () -> service.updatePathChapters(5L,
                new UpdatePathChaptersRequest(0L, List.of(new ChapterRequest(100L, "A", List.of()))), false));
        verify(pathChapterRepository, never()).deleteAll(any());
    }

    @Test
    void editingMissingPathFails() {
        when(pathRepository.findByIdForUpdate(5L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> service.updatePathChapters(5L,
                new UpdatePathChaptersRequest(0L, List.of()), true));
    }

    // ── banner ──────────────────────────────────────────────────────────────

    @Test
    void storesBannerAndBumpsContentRevision() {
        var path = path(5L, "Web");
        when(pathRepository.findByIdForUpdate(5L)).thenReturn(Optional.of(path));

        service.uploadBanner(5L, new MockMultipartFile("file", "b.png", "image/png", new byte[] {1, 2}));

        assertArrayEquals(new byte[] {1, 2}, path.getBannerData());
        assertEquals("image/png", path.getBannerMime());
        assertEquals(1, path.getContentRevision());
        verify(pathRepository).save(path);
    }

    @Test
    void emptyBannerUploadIsIgnored() {
        service.uploadBanner(5L, null);
        service.uploadBanner(5L, new MockMultipartFile("file", new byte[0]));
        verifyNoInteractions(pathRepository);
    }

    @Test
    void bannerUploadFailuresAreReported() throws IOException {
        when(pathRepository.findByIdForUpdate(5L)).thenReturn(Optional.of(path(5L, "Web")));
        var broken = mock(MultipartFile.class);
        when(broken.isEmpty()).thenReturn(false);
        when(broken.getBytes()).thenThrow(new IOException("disk"));

        var error = assertThrows(RuntimeException.class, () -> service.uploadBanner(5L, broken));
        assertInstanceOf(IOException.class, error.getCause());

        when(pathRepository.findByIdForUpdate(6L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> service.uploadBanner(6L, broken));
    }

    @Test
    void readsBannerAfterCheckingVisibility() {
        var path = path(5L, "Web");
        path.setBannerData(new byte[] {9});
        path.setBannerMime("image/webp");
        when(pathRepository.findById(5L)).thenReturn(Optional.of(path));
        when(pathRepository.findById(6L)).thenReturn(Optional.empty());

        assertArrayEquals(new byte[] {9}, service.getBannerData(5L));
        assertEquals("image/webp", service.getBannerMime(5L));
        assertThrows(IllegalArgumentException.class, () -> service.getBannerData(6L));
        assertThrows(IllegalArgumentException.class, () -> service.getBannerMime(6L));
        verify(visibility, times(2)).requirePath(5L);
        verify(visibility, times(2)).requirePath(6L);
    }

    @Test
    void hiddenPathBannerIsNotRead() {
        doThrow(new ResponseStatusException(HttpStatus.NOT_FOUND)).when(visibility).requirePath(5L);

        assertThrows(ResponseStatusException.class, () -> service.getBannerData(5L));
        verifyNoInteractions(pathRepository);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private void stubPathRooms(Room... rooms) {
        for (Room room : rooms) {
            when(roomRepository.findByIdForUpdate(room.getId())).thenReturn(Optional.of(room));
        }
    }

    private static Path path(long id, String title) {
        return Path.builder().id(id).title(title).bannerUrl("https://img").build();
    }

    private static PathChapter chapter(long id, String title, int sortOrder) {
        return PathChapter.builder().id(id).pathId(5L).title(title).sortOrder(sortOrder).build();
    }

    private static Room room(long id, String title, RoomType type) {
        return Room.builder().id(id).title(title).roomType(type).build();
    }

    private static RoomSummaryDto room(long id, boolean solved) {
        return RoomSummaryDto.builder().id(id).solved(solved).build();
    }

    private record ListView(Long getId, String getTitle, String getDescription, String getBannerUrl,
                            Boolean getHasBanner, Boolean getPublished, Integer getRoomsCount)
            implements PathRepository.PathListView {}

    private record ProgressView(Long getId, String getTitle, String getDescription, String getBannerUrl,
                                Integer getTotalRooms, Integer getSolvedRooms)
            implements PathRepository.PathProgressView {
        @Override public Boolean getHasBanner() { return false; }
        @Override public Boolean getPublished() { return true; }
    }

    private record MiniRow(Long getId, String getTitle, Boolean getRequiresVpn, Boolean getSolved)
            implements ChapterRoomRepository.PathRoomMiniRow {}

    private record Owner(Long getRoomId, Long getPathId, String getPathTitle)
            implements ChapterRoomRepository.RoomOwnerView {}
}
