package com.hackademy.server.room;

import com.hackademy.server.room.dto.CreateRoomRequest;
import com.hackademy.server.room.dto.HintDto;
import com.hackademy.server.room.dto.RoomAdminSummaryDto;
import com.hackademy.server.room.dto.RoomDetailDto;
import com.hackademy.server.room.dto.RoomPathDto;
import com.hackademy.server.room.dto.RoomSummaryDto;
import com.hackademy.server.room.dto.RoomTasksAdminDto;
import com.hackademy.server.room.dto.RoomTaskAdminDto;
import com.hackademy.server.room.dto.RoomTaskDto;
import com.hackademy.server.room.dto.RoomTaskRequest;
import com.hackademy.server.room.dto.SolveRoomResponse;
import com.hackademy.server.room.dto.UpdateRoomRequest;
import com.hackademy.server.room.dto.UpdateRoomTasksRequest;

import com.hackademy.server.badge.BadgeDto;
import com.hackademy.server.badge.BadgeService;
import com.hackademy.server.dashboard.DashboardSummaryCache;
import com.hackademy.server.path.ChapterRoomRepository;
import com.hackademy.server.path.PathUnlockPolicy;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.user.UserServiceImpl;

import com.hackademy.server.exception.UserNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoomServiceImpl implements RoomService {

    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final HintRepository hintRepository;
    private final UserUnlockedHintRepository userUnlockedHintRepository;
    private final UserSolvedRoomRepository userSolvedRoomRepository;
    private final BadgeService badgeService;
    private final RoomFileRepository roomFileRepository;
    private final RoomTaskRepository roomTaskRepository;
    private final UserCompletedTaskRepository userCompletedTaskRepository;
    private final UserServiceImpl userServiceImpl;
    private final DashboardSummaryCache dashboardSummaryCache;
    private final ChapterRoomRepository chapterRoomRepository;
    private final com.hackademy.server.content.ContentVisibility visibility;
    private final PathUnlockPolicy pathUnlockPolicy;
    private final Clock clock;
    private final RoomAnswerGuard roomAnswerGuard;

    private static final Set<String> RESERVED_TITLES = Set.of("tutorial vm", "tutorial vpn");

    private void checkTitle(Room existing, String title) {
        boolean renamed = existing == null || !existing.getTitle().equals(title);
        if (renamed && RESERVED_TITLES.contains(title.toLowerCase(Locale.ROOT))) {
            throw new RoomRuleException(HttpStatus.BAD_REQUEST, "title",
                    "Tytuły \u201eTutorial VM\u201d i \u201eTutorial VPN\u201d są zarezerwowane dla pokoi samouczka");
        }
        if (existing != null && renamed && chapterRoomRepository.existsOtherRoomWithTitleInSameChapter(existing.getId(), title)) {
            throw new RoomRuleException(HttpStatus.CONFLICT, "title", "Rozdział tego pokoju ma już pokój o tym tytule");
        }
    }

    private static int points(RoomType roomType, DifficultyLevel difficulty, Integer requested) {
        if (roomType == RoomType.CTF) {
            return difficulty.ctfPoints();
        }
        if (requested == null || requested < 0) {
            throw new RoomRuleException(HttpStatus.BAD_REQUEST, "points", "Podaj nieujemną liczbę punktów");
        }
        return requested;
    }

    @Override
    @Transactional
    public Room createRoom(CreateRoomRequest createRoomRequest, MultipartFile file) throws IOException {
        RoomType roomType = createRoomRequest.roomType() == null ? RoomType.PATH : createRoomRequest.roomType();
        String title = createRoomRequest.title().trim();
        checkTitle(null, title);
        Room room = Room.builder()
                .title(title)
                .description(createRoomRequest.description())
                .shortDescription(createRoomRequest.shortDescription())
                .difficulty(createRoomRequest.difficulty())
                .category(createRoomRequest.category())
                .points(points(roomType, createRoomRequest.difficulty(), createRoomRequest.points()))
                .requiresVpn(createRoomRequest.requiresVpn())
                .roomType(roomType)
                .build();

        Room savedRoom = roomRepository.save(room);

        if (file != null && !file.isEmpty()) {
            RoomFile roomFile = new RoomFile(file.getOriginalFilename(), file.getContentType(), file.getBytes(), savedRoom);
            roomFileRepository.save(roomFile);
        }

        return savedRoom;
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoomAdminSummaryDto> getAllRoomsForAdmin() {
        Map<Long, List<RoomPathDto>> pathsByRoom = new HashMap<>();
        for (var owner : chapterRoomRepository.findAllOwners()) {
            pathsByRoom.computeIfAbsent(owner.getRoomId(), id -> new ArrayList<>())
                    .add(new RoomPathDto(owner.getPathId(), owner.getPathTitle(), Boolean.TRUE.equals(owner.getPathPublished())));
        }
        return roomRepository.findAllAdminSummaries().stream()
                .map(room -> room.withPaths(pathsByRoom.getOrDefault(room.id(), List.of())))
                .toList();
    }

    @Override
    @Transactional
    public Room updateRoom(Long id, com.hackademy.server.room.dto.UpdateRoomRequest updateRoomRequest, MultipartFile file) throws IOException {
        return updateRoom(id, updateRoomRequest, file, true);
    }

    @Override
    @Transactional
    public Room updateRoomBeforeTasks(Long id, UpdateRoomRequest updateRoomRequest, MultipartFile file) throws IOException {
        return updateRoom(id, updateRoomRequest, file, false);
    }

    private Room updateRoom(Long id, UpdateRoomRequest updateRoomRequest, MultipartFile file, boolean checkTasks) throws IOException {
        Room room = roomRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new IllegalArgumentException("Room not found with ID: " + id));
        RoomType newRoomType = updateRoomRequest.roomType() == null ? room.getRoomType() : updateRoomRequest.roomType();
        if (checkTasks && newRoomType != room.getRoomType() && !room.getTasks().isEmpty()) {
            requirePlayable(roomRepository.isVisible(room.getId()), newRoomType, room.getTasks().stream()
                    .sorted(Comparator.comparingInt(RoomTask::getSortOrder).thenComparing(RoomTask::getId)).toList());
        }
        String title = updateRoomRequest.title().trim();
        checkTitle(room, title);
        int points = points(newRoomType, updateRoomRequest.difficulty(), updateRoomRequest.points());
        room.setContentRevision(room.getContentRevision() + 1);
        room.setTitle(title);
        room.setDescription(updateRoomRequest.description());
        room.setShortDescription(updateRoomRequest.shortDescription());
        room.setDifficulty(updateRoomRequest.difficulty());
        room.setCategory(updateRoomRequest.category());
        room.setPoints(points);
        room.setRequiresVpn(updateRoomRequest.requiresVpn());
        room.setRoomType(newRoomType);

        Room savedRoom = roomRepository.save(room);

        if (file != null && !file.isEmpty()) {
            RoomFile existingFile = roomFileRepository.findByRoomId(id).orElse(null);
            if (existingFile != null) {
                existingFile.setFileName(file.getOriginalFilename());
                existingFile.setFileType(file.getContentType());
                existingFile.setData(file.getBytes());
                roomFileRepository.save(existingFile);
            } else {
                RoomFile roomFile = new RoomFile(file.getOriginalFilename(), file.getContentType(), file.getBytes(), savedRoom);
                roomFileRepository.save(roomFile);
            }
        }
        
        return savedRoom;
    }

    @Override
    public void deleteRoom(Long id) {
        if (!roomRepository.existsById(id)) {
            throw new IllegalArgumentException("Room not found with ID: " + id);
        }
        roomRepository.deleteById(id);
        dashboardSummaryCache.invalidateAllAfterCommit();
    }
    @Override
    @Transactional(readOnly = true)
    public RoomDetailDto getRoomDetail(Long id, String username) {
        visibility.requireRoom(id);
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Room not found with ID: " + id));

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        pathUnlockPolicy.requireUnlocked(id, user.getId());

        if ("Tutorial VPN".equals(room.getTitle())) {
            boolean hasTutorialVM = userSolvedRoomRepository.existsByUser_UsernameAndRoom_Title(username, "Tutorial VM");
            if (!hasTutorialVM) {
                throw new IllegalStateException("Musisz najpierw ukończyć pokój 'Tutorial VM', aby odblokować ten pokój.");
            }
        }
        
        if (room.isRequiresVpn()) {
            boolean hasTutorialVPN = userSolvedRoomRepository.existsByUser_UsernameAndRoom_Title(username, "Tutorial VPN");
            if (!hasTutorialVPN) {
                throw new IllegalStateException("Ten pokój wymaga połączenia VPN. Musisz najpierw ukończyć pokój 'Tutorial VPN'.");
            }
        }

        boolean isSolved = userSolvedRoomRepository.existsByUser_IdAndRoom_Id(user.getId(), room.getId());

        Set<Long> unlockedHintIds = userUnlockedHintRepository.findByUser_IdAndHint_Task_Room_Id(user.getId(), room.getId())
                .stream()
                .map(unlockedHint -> unlockedHint.getHint().getId())
                .collect(Collectors.toSet());

        String fileName = roomFileRepository.findFileNameByRoomId(id);

        List<Long> completedTaskIds = userCompletedTaskRepository.findCompletedTaskIdsInRoom(user.getId(), id);
        List<RoomTaskDto> taskDtos = roomTaskRepository.findByRoomIdOrderBySortOrderAsc(id).stream()
                .map(t -> RoomTaskDto.builder()
                        .id(t.getId())
                        .title(t.getTitle())
                        .content(t.getContent())
                        .question(t.getQuestion())
                        .requiresAnswer(t.getAnswer() != null)
                        .completed(completedTaskIds.contains(t.getId()))
                        .hints(hintDtos(t, unlockedHintIds::contains))
                        .build())
                .collect(Collectors.toList());

        return RoomDetailDto.builder()
                .id(room.getId())
                .title(room.getTitle())
                .description(room.getDescription())
                .shortDescription(room.getShortDescription())
                .difficulty(room.getDifficulty())
                .roomType(room.getRoomType())
                .points(room.getPoints())
                .solutionsCount(room.getSolutionsCount())
                .createdAt(room.getCreatedAt())
                .solved(isSolved)
                .requiresVpn(room.isRequiresVpn())
                .fileName(fileName)
                .tasks(taskDtos)
                .build();
    }

    @Override
    @Transactional
    public SolveRoomResponse solveTask(Long roomId, Long taskId, String answer, String username) {
        visibility.requireRoom(roomId);
        User user = userRepository.findByUsernameForUpdate(username)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));
        pathUnlockPolicy.requireUnlocked(roomId, user.getId());
        RoomTask task = roomTaskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found"));

        if (!task.getRoom().getId().equals(roomId)) {
            throw new IllegalArgumentException("Task does not belong to this room");
        }

        if (task.getAnswer() != null
                && !roomAnswerGuard.check(user.getId(), roomId, () -> matches(room.getRoomType(), task.getAnswer(), answer))) {
            return new SolveRoomResponse(false, "Niepoprawna odpowiedź", 0, new ArrayList<>());
        }

        if (!userCompletedTaskRepository.existsByUserIdAndTaskId(user.getId(), taskId)) {
            userCompletedTaskRepository.save(new UserCompletedTask(null, user.getId(), taskId, LocalDateTime.now()));
        }

        List<RoomTask> allTasks = roomTaskRepository.findByRoomIdOrderBySortOrderAsc(roomId);
        long completedCount = userCompletedTaskRepository.countByUserIdAndTaskIdIn(user.getId(), 
                allTasks.stream().map(RoomTask::getId).collect(Collectors.toList()));

        if (completedCount == allTasks.size()) {
            return awardTaskRoomCompletion(user, room);
        }
        return new SolveRoomResponse(true, "Poprawna odpowiedź!", 0, new ArrayList<>());
    }

    @Override
    @Transactional
    public SolveRoomResponse completeTaskRoom(Long roomId, String username) {
        visibility.requireRoom(roomId);
        User user = userRepository.findByUsernameForUpdate(username)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));
        pathUnlockPolicy.requireUnlocked(roomId, user.getId());
        List<RoomTask> tasks = roomTaskRepository.findByRoomIdOrderBySortOrderAsc(roomId);
        if (tasks.isEmpty()) {
            return new SolveRoomResponse(false, "Pokój nie ma jeszcze zadań", 0, List.of());
        }
        long completed = userCompletedTaskRepository.countByUserIdAndTaskIdIn(user.getId(),
                tasks.stream().map(RoomTask::getId).toList());
        if (completed != tasks.size()) {
            return new SolveRoomResponse(false, "Ukończ wszystkie zadania pokoju", 0, List.of());
        }
        return awardTaskRoomCompletion(user, room);
    }

    private SolveRoomResponse awardTaskRoomCompletion(User user, Room room) {
        return awardRoomSolve(user, room, "Poprawna odpowiedź! Pokój ukończony!", "Poprawna odpowiedź! (Pokój już ukończony)");
    }

    // A CTF flag must match exactly; a theory answer ignores letter case.
    private static boolean matches(RoomType roomType, String expected, String answer) {
        return roomType == RoomType.CTF ? expected.equals(answer) : expected.equalsIgnoreCase(answer);
    }

    private SolveRoomResponse awardRoomSolve(User user, Room room, String solvedMessage, String alreadySolvedMessage) {
        Long roomId = room.getId();
        if (userSolvedRoomRepository.existsByUser_IdAndRoom_Id(user.getId(), roomId)) {
            return new SolveRoomResponse(true, alreadySolvedMessage, 0, new ArrayList<>());
        }

        long unlockedHintsCount = userUnlockedHintRepository.countByUser_IdAndHint_Task_Room_Id(user.getId(), roomId);
        int pointsToAward = RoomScoring.pointsAfterHints(room.getPoints(), unlockedHintsCount);

        UserSolvedRoom userSolvedRoom = new UserSolvedRoom(user, room, pointsToAward);
        userSolvedRoomRepository.save(userSolvedRoom);

        user.setPoints(user.getPoints() + pointsToAward);
        roomRepository.incrementSolutions(roomId);

        LocalDate today = LocalDate.now(clock);
        LocalDate lastSolved = user.getLastSolvedDate();
        if (lastSolved == null || lastSolved.equals(today.minusDays(1))) {
            user.setStreak(user.getStreak() + 1);
        } else if (!lastSolved.equals(today)) {
            user.setStreak(1);
        }
        user.setLastSolvedDate(today);

        userRepository.save(user);
        userServiceImpl.invalidateUserComputedCaches(user.getId());
        userServiceImpl.invalidateGlobalRankingCache();
        dashboardSummaryCache.invalidateUser(user.getId());

        List<BadgeDto> newBadges = badgeService.checkAndAwardBadges(user);
        return new SolveRoomResponse(true, solvedMessage, pointsToAward, newBadges);
    }

    @Override
    @Transactional
    public HintDto unlockHint(Long roomId, Long hintId, String username) {
        visibility.requireRoom(roomId);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        if (!roomRepository.existsById(roomId)) {
            throw new IllegalArgumentException("Room not found with ID: " + roomId);
        }
        pathUnlockPolicy.requireUnlocked(roomId, user.getId());

        Hint hint = hintRepository.findById(hintId)
                .filter(found -> found.getTask().getRoom().getId().equals(roomId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Podpowiedź nie istnieje w tym pokoju"));

        List<Hint> taskHints = hint.getTask().getHints();
        int hintIndex = taskHints.indexOf(hint);

        if (userUnlockedHintRepository.existsByUser_IdAndHint_Id(user.getId(), hintId)) {
            return mapToDto(hint, hintIndex);
        }

        if (hintIndex > 0) {
            Hint previousHint = taskHints.get(hintIndex - 1);
            boolean isPreviousUnlocked = userUnlockedHintRepository.existsByUser_IdAndHint_Id(user.getId(), previousHint.getId());
            if (!isPreviousUnlocked) {
                boolean isRoomSolved = userSolvedRoomRepository.existsByUser_IdAndRoom_Id(user.getId(), roomId);
                if (!isRoomSolved) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Najpierw odblokuj poprzednią podpowiedź");
                }
            }
        }

        UserUnlockedHint userUnlockedHint = new UserUnlockedHint(user, hint);
        userUnlockedHintRepository.save(userUnlockedHint);

        return mapToDto(hint, hintIndex);
    }

    @Override
    @Transactional
    public RoomTasksAdminDto getRoomTasksForAdmin(Long roomId) {
        Room room = roomRepository.findByIdForUpdate(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found with ID: " + roomId));
        return new RoomTasksAdminDto(room.getTasksRevision(), room.getTasks().stream()
                .sorted(Comparator.comparingInt(RoomTask::getSortOrder).thenComparing(RoomTask::getId))
                .map(this::mapTaskToAdminDto)
                .toList());
    }

    @Override
    @Transactional
    public RoomTasksAdminDto updateRoomTasks(Long roomId, UpdateRoomTasksRequest request) {
        Room room = roomRepository.findByIdForUpdate(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found with ID: " + roomId));
        if (request.revision() == null || request.revision() != room.getTasksRevision()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Zadania zmieniły się w międzyczasie. Wczytaj aktualną listę przed ponowną edycją.");
        }

        Map<Long, RoomTask> existing = room.getTasks().stream()
                .collect(Collectors.toMap(RoomTask::getId, Function.identity()));
        boolean visible = roomRepository.isVisible(roomId);
        Set<Long> keptIds = new HashSet<>();
        List<RoomTask> ordered = new ArrayList<>();
        int position = 0;
        for (RoomTaskRequest taskRequest : request.tasks()) {
            position++;
            String question = blankToNull(taskRequest.question());
            String answer = blankToNull(taskRequest.answer());

            RoomTask task;
            if (taskRequest.id() == null) {
                task = RoomTask.builder().room(room).build();
            } else {
                task = existing.get(taskRequest.id());
                if (task == null) {
                    throw new IllegalArgumentException("Zadanie " + taskRequest.id() + " nie należy do tego pokoju");
                }
                if (!keptIds.add(task.getId())) {
                    throw new IllegalArgumentException("Zadanie " + taskRequest.id() + " występuje więcej niż raz");
                }
            }
            task.setTitle(taskRequest.title().trim());
            String content = TaskContentSanitizer.clean(taskRequest.content() == null ? "" : taskRequest.content());
            if (visible && content.isBlank()) {
                throw new IllegalArgumentException("Zadanie " + position + ": podaj treść po usunięciu niedozwolonego HTML");
            }
            task.setContent(content);
            task.setQuestion(question);
            task.setAnswer(answer);
            task.setSortOrder(position - 1);
            replaceHints(task, taskRequest.hints());
            ordered.add(task);
        }

        requirePlayable(visible, room.getRoomType(), ordered);
        room.getTasks().removeIf(task -> !keptIds.contains(task.getId()));
        for (RoomTask task : ordered) {
            if (task.getId() == null) {
                roomTaskRepository.save(task);
                room.getTasks().add(task);
            }
        }
        room.setTasksRevision(room.getTasksRevision() + 1);
        room.setContentRevision(room.getContentRevision() + 1);
        roomRepository.flush();

        return new RoomTasksAdminDto(room.getTasksRevision(), ordered.stream().map(this::mapTaskToAdminDto).toList());
    }

    // A room players can see through a published path must stay solvable.
    private static void requirePlayable(boolean visible, RoomType roomType, List<RoomTask> tasks) {
        if (!visible) {
            return;
        }
        RoomReadiness.taskProblems(roomType, tasks).stream().findFirst().ifPresent(problem -> {
            throw new IllegalArgumentException(Character.toUpperCase(problem.charAt(0)) + problem.substring(1));
        });
    }

    private static void replaceHints(RoomTask task, List<String> descriptions) {
        if (descriptions == null) {
            return;
        }
        if (descriptions.size() > RoomTaskRequest.MAX_HINTS) {
            throw new IllegalArgumentException("Zadanie może mieć maksymalnie " + RoomTaskRequest.MAX_HINTS + " podpowiedzi");
        }
        List<Hint> unused = new ArrayList<>(task.getHints());
        List<Hint> kept = new ArrayList<>();
        for (String description : descriptions) {
            String text = description == null ? "" : description.trim();
            if (text.isEmpty()) {
                throw new IllegalArgumentException("Podpowiedź nie może być pusta");
            }
            Hint hint = unused.stream().filter(candidate -> candidate.getDescription().equals(text)).findFirst().orElse(null);
            if (hint == null) {
                hint = new Hint(text, task, kept.size());
            } else {
                unused.remove(hint);
                hint.setSortOrder(kept.size());
            }
            kept.add(hint);
        }
        task.getHints().clear();
        task.getHints().addAll(kept);
    }

    public static List<HintDto> hintDtos(RoomTask task, Predicate<Long> unlocked) {
        List<HintDto> hints = new ArrayList<>();
        for (int i = 0; i < task.getHints().size(); i++) {
            Hint hint = task.getHints().get(i);
            hints.add(unlocked.test(hint.getId()) ? new HintDto(hint.getId(), i, hint.getDescription()) : HintDto.locked(hint.getId(), i));
        }
        return hints;
    }

    private RoomTaskAdminDto mapTaskToAdminDto(RoomTask task) {
        return new RoomTaskAdminDto(task.getId(), task.getTitle(), task.getContent(), task.getQuestion(), task.getAnswer(),
                task.getHints().stream().map(Hint::getDescription).toList());
    }

    private static String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    @Override
    @Transactional(readOnly = true)
    public Room getRoomById(Long id) {
        return roomRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Room not found with ID: " + id));
    }

    @Override
    @Transactional(readOnly = true)
    public RoomFile getRoomFile(Long roomId, String username) {
        visibility.requireRoom(roomId);
        Long userId = userRepository.findIdByUsername(username)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        pathUnlockPolicy.requireUnlocked(roomId, userId);
        return roomFileRepository.findByRoomId(roomId)
                .orElseThrow(() -> new IllegalArgumentException("File not found for room ID: " + roomId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoomSummaryDto> getTop3Rooms() {
        return roomRepository.findTop3ByCategoryNot("Tutorial", PageRequest.of(0, 3));
    }

    private HintDto mapToDto(Hint hint, int order) {
        return new HintDto(hint.getId(), order, hint.getDescription());
    }
}
