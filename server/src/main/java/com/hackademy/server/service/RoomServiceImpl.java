package com.hackademy.server.service;

import com.hackademy.server.dto.BadgeDto;
import com.hackademy.server.dto.CreateRoomRequest;
import com.hackademy.server.dto.RoomAdminSummaryDto;
import com.hackademy.server.dto.RoomDetailDto;
import com.hackademy.server.dto.RoomDto;
import com.hackademy.server.dto.RoomSummaryDto;
import com.hackademy.server.dto.SolveRoomResponse;
import com.hackademy.server.exception.UserNotFoundException;
import com.hackademy.server.model.Room;
import com.hackademy.server.model.RoomFile;
import com.hackademy.server.model.User;
import com.hackademy.server.model.UserSolvedRoom;
import com.hackademy.server.model.UserUnlockedHint;
import com.hackademy.server.repository.HintRepository;
import com.hackademy.server.repository.RoomFileRepository;
import com.hackademy.server.repository.RoomRepository;
import com.hackademy.server.repository.UserRepository;
import com.hackademy.server.repository.UserSolvedRoomRepository;
import com.hackademy.server.repository.UserUnlockedHintRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
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


    @Override
    @Transactional
    public Room createRoom(CreateRoomRequest createRoomRequest, MultipartFile file) throws IOException {
        Room room = Room.builder()
                .title(createRoomRequest.getTitle())
                .description(createRoomRequest.getDescription())
                .shortDescription(createRoomRequest.getShortDescription())
                .difficulty(createRoomRequest.getDifficulty())
                .category(createRoomRequest.getCategory())
                .points(createRoomRequest.getPoints())
                .flag(createRoomRequest.getFlag())
                .build();

        if (createRoomRequest.getHints() != null && !createRoomRequest.getHints().isEmpty()) {
            List<com.hackademy.server.model.Hint> hints = createRoomRequest.getHints().stream()
                    .map(desc -> new com.hackademy.server.model.Hint(desc, room))
                    .collect(Collectors.toList());
            room.setHints(hints);
        }

        Room savedRoom = roomRepository.save(room);

        if (file != null && !file.isEmpty()) {
            RoomFile roomFile = new RoomFile(file.getOriginalFilename(), file.getContentType(), file.getBytes(), savedRoom);
            roomFileRepository.save(roomFile);
        }

        return savedRoom;
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoomSummaryDto> getAllRooms(String username) {
        // Use projection to fetch only necessary fields
        List<RoomSummaryDto> rooms = roomRepository.findAllSummaries();
        Set<Long> solvedRoomIds;

        if (username != null) {
            User user = userRepository.findByUsername(username)
                    .orElseThrow(() -> new UserNotFoundException("User not found"));
            
            // Optimized: Fetch only IDs of solved rooms
            solvedRoomIds = userSolvedRoomRepository.findByUser_Id(user.getId()).stream()
                    .map(usr -> usr.getRoom().getId())
                    .collect(Collectors.toSet());
        } else {
            solvedRoomIds = Set.of();
        }

        // Set solved status in memory
        rooms.forEach(room -> room.setSolved(solvedRoomIds.contains(room.getId())));
        
        return rooms;
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoomAdminSummaryDto> getAllRoomsForAdmin() {
        // Fetch all rooms but map to a lightweight DTO
        return roomRepository.findAll().stream()
                .map(room -> new RoomAdminSummaryDto(
                        room.getId(),
                        room.getTitle(),
                        room.getCategory(),
                        room.getDifficulty(),
                        room.getPoints()
                ))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public Room updateRoom(Long id, com.hackademy.server.dto.UpdateRoomRequest updateRoomRequest, MultipartFile file) throws IOException {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Room not found with ID: " + id));

        room.setTitle(updateRoomRequest.getTitle());
        room.setDescription(updateRoomRequest.getDescription());
        room.setShortDescription(updateRoomRequest.getShortDescription());
        room.setDifficulty(updateRoomRequest.getDifficulty());
        room.setCategory(updateRoomRequest.getCategory());
        room.setPoints(updateRoomRequest.getPoints());
        room.setFlag(updateRoomRequest.getFlag());

        // Update hints logic to preserve existing ones if possible
        List<String> newHintDescriptions = updateRoomRequest.getHints();
        if (newHintDescriptions == null) {
            newHintDescriptions = new ArrayList<>();
        }

        List<com.hackademy.server.model.Hint> oldHints = new ArrayList<>(room.getHints());
        room.getHints().clear();
        
        for (String desc : newHintDescriptions) {
            boolean found = false;
            // Try to find a hint in oldHints with the same description
            for (int i = 0; i < oldHints.size(); i++) {
                if (oldHints.get(i).getDescription().equals(desc)) {
                    room.getHints().add(oldHints.get(i));
                    oldHints.remove(i);
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                // Create new
                room.getHints().add(new com.hackademy.server.model.Hint(desc, room));
            }
        }
        
        Room savedRoom = roomRepository.save(room);

        if (file != null && !file.isEmpty()) {
            // Check if file already exists
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
    }

    @Override
    @Transactional(readOnly = true)
    public RoomDetailDto getRoomDetail(Long id, String username) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Room not found with ID: " + id));

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        // Use new repository to check if solved
        boolean isSolved = userSolvedRoomRepository.existsByUser_IdAndRoom_Id(user.getId(), room.getId());

        // Sort hints by ID to ensure consistent order
        List<com.hackademy.server.dto.HintDto> hintDtos = room.getHints().stream()
                .sorted(Comparator.comparing(com.hackademy.server.model.Hint::getId))
                .map(this::mapToDto)
                .collect(Collectors.toList());

        List<Long> unlockedHintIds = userUnlockedHintRepository.findByUser_IdAndHint_Room_Id(user.getId(), room.getId())
                .stream()
                .map(unlockedHint -> unlockedHint.getHint().getId())
                .collect(Collectors.toList());
        
        String fileName = room.getRoomFile() != null ? room.getRoomFile().getFileName() : null;

        return RoomDetailDto.builder()
                .id(room.getId())
                .title(room.getTitle())
                .description(room.getDescription())
                .shortDescription(room.getShortDescription())
                .difficulty(room.getDifficulty())
                .points(room.getPoints())
                .solutionsCount(room.getSolutionsCount())
                .createdAt(room.getCreatedAt())
                .solved(isSolved)
                .hints(hintDtos)
                .unlockedHintIds(unlockedHintIds)
                .fileName(fileName)
                .build();
    }

    @Override
    @Transactional
    public SolveRoomResponse solveRoom(Long id, String flag, String username) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Room not found with ID: " + id));

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        // Check if already solved
        boolean alreadySolved = userSolvedRoomRepository.existsByUser_IdAndRoom_Id(user.getId(), room.getId());

        if (room.getFlag().equals(flag)) {
            if (alreadySolved) {
                // If already solved, return success but 0 points and no new badges
                return new SolveRoomResponse(true, "Correct flag! (Training mode - 0 points)", 0, new ArrayList<>());
            }

            long unlockedHintsCount = userUnlockedHintRepository.countByUser_IdAndHint_Room_Id(user.getId(), room.getId());
            double pointsToAward = room.getPoints() * (1 - (unlockedHintsCount * 0.25));
            if (pointsToAward < 0) {
                pointsToAward = 0;
            }

            // Create and save UserSolvedRoom entity manually
            UserSolvedRoom userSolvedRoom = new UserSolvedRoom(user, room);
            userSolvedRoomRepository.save(userSolvedRoom);

            user.setPoints(user.getPoints() + (int) pointsToAward);
            room.setSolutionsCount(room.getSolutionsCount() + 1);
            
            // Streak Logic
            LocalDate today = LocalDate.now();
            LocalDate lastSolved = user.getLastSolvedDate();

            if (lastSolved == null) {
                user.setStreak(1);
            } else if (lastSolved.equals(today.minusDays(1))) {
                user.setStreak(user.getStreak() + 1);
            } else if (!lastSolved.equals(today)) {
                // If not today and not yesterday (so older), reset streak
                user.setStreak(1);
            }
            // If solved today, streak remains unchanged (already incremented or set)
            
            user.setLastSolvedDate(today);
            
            userRepository.save(user);
            roomRepository.save(room);

            // Check for badges
            List<BadgeDto> newBadges = badgeService.checkAndAwardBadges(user);

            return new SolveRoomResponse(true, "Correct flag!", (int) pointsToAward, newBadges);
        }

        return new SolveRoomResponse(false, "Incorrect flag", 0, new ArrayList<>());
    }

    @Override
    @Transactional
    public boolean unlockHint(Long roomId, Long hintId, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found with ID: " + roomId));

        com.hackademy.server.model.Hint hint = hintRepository.findById(hintId)
                .orElseThrow(() -> new IllegalArgumentException("Hint not found with ID: " + hintId));

        if (!hint.getRoom().getId().equals(roomId)) {
             throw new IllegalArgumentException("Hint does not belong to this room");
        }

        // Allow unlocking hints even if room is solved (for training purposes)
        // if (userSolvedRoomRepository.existsByUser_IdAndRoom_Id(user.getId(), roomId)) {
        //    return false; // Room already solved
        // }

        if (userUnlockedHintRepository.existsByUser_IdAndHint_Id(user.getId(), hintId)) {
            return false; // Hint already unlocked
        }

        // Check if previous hints are unlocked
        List<com.hackademy.server.model.Hint> allHints = room.getHints().stream()
                .sorted(Comparator.comparing(com.hackademy.server.model.Hint::getId))
                .collect(Collectors.toList());

        int hintIndex = -1;
        for (int i = 0; i < allHints.size(); i++) {
            if (allHints.get(i).getId().equals(hintId)) {
                hintIndex = i;
                break;
            }
        }

        if (hintIndex > 0) {
            com.hackademy.server.model.Hint previousHint = allHints.get(hintIndex - 1);
            boolean isPreviousUnlocked = userUnlockedHintRepository.existsByUser_IdAndHint_Id(user.getId(), previousHint.getId());
            if (!isPreviousUnlocked) {
                // In training mode, allow unlocking any hint if room is solved
                boolean isRoomSolved = userSolvedRoomRepository.existsByUser_IdAndRoom_Id(user.getId(), roomId);
                if (!isRoomSolved) {
                    throw new IllegalStateException("Previous hint must be unlocked first");
                }
            }
        }

        UserUnlockedHint userUnlockedHint = new UserUnlockedHint(user, hint);
        userUnlockedHintRepository.save(userUnlockedHint);

        return true;
    }

    @Override
    @Transactional(readOnly = true)
    public Room getRoomById(Long id) {
        return roomRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Room not found with ID: " + id));
    }

    @Override
    @Transactional(readOnly = true)
    public RoomFile getRoomFile(Long roomId) {
        return roomFileRepository.findByRoomId(roomId)
                .orElseThrow(() -> new IllegalArgumentException("File not found for room ID: " + roomId));
    }

    private com.hackademy.server.dto.HintDto mapToDto(com.hackademy.server.model.Hint hint) {
        return new com.hackademy.server.dto.HintDto(hint.getId(), hint.getDescription());
    }

    private RoomDto mapToDto(Room room, boolean solved) {
        return RoomDto.builder()
                .id(room.getId())
                .title(room.getTitle())
                .description(room.getDescription())
                .shortDescription(room.getShortDescription())
                .difficulty(room.getDifficulty())
                .category(room.getCategory())
                .points(room.getPoints())
                .solutionsCount(room.getSolutionsCount())
                .solved(solved)
                .createdAt(room.getCreatedAt())
                .updatedAt(room.getUpdatedAt())
                .build();
    }
}
