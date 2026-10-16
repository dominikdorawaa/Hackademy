package com.hackademy.server.arena;

import com.hackademy.server.user.User;
import com.hackademy.server.user.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/arena")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH, RequestMethod.DELETE, RequestMethod.OPTIONS})
public class ArenaController {

    private static final Map<BattleEngine.AnswerResult, String> ANSWER_ERRORS = Map.of(
            BattleEngine.AnswerResult.NOT_ACTIVE, "Ta runda jest już zakończona.",
            BattleEngine.AnswerResult.INVALID_ANSWER, "Wybierz jedną z czterech odpowiedzi.",
            BattleEngine.AnswerResult.ALREADY_ANSWERED, "Odpowiedź w tej rundzie została już wysłana.",
            BattleEngine.AnswerResult.TOO_LATE, "Czas na odpowiedź minął.");

    private final MatchmakingService matchmakingService;
    private final ArenaService arenaService;
    private final UserService userService;

    private static User currentUser() {
        return (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    @PostMapping("/join")
    public ResponseEntity<?> joinQueue() {
        User user = currentUser();
        if (user.getPoints() < 500) {
            return ResponseEntity.badRequest().body(Map.of("message", "Do Areny dołączysz od 500 XP."));
        }
        matchmakingService.joinQueue(user.getId(), user.getUsername());
        processMatchmaking();
        return ResponseEntity.ok(Map.of("message", "Dołączono do kolejki"));
    }

    @PostMapping("/leave")
    public ResponseEntity<?> leaveQueue() {
        matchmakingService.leaveQueue(currentUser().getId());
        return ResponseEntity.ok(Map.of("message", "Opuszczono kolejkę"));
    }

    @GetMapping("/status")
    public ResponseEntity<?> checkStatus() {
        GameSession session = arenaService.findCurrentGameForUser(currentUser().getId());
        return session == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(session);
    }

    @Scheduled(fixedRate = 500)
    public synchronized void processMatchmaking() {
        for (GameSession session : matchmakingService.checkForMatches()) {
            arenaService.addGame(session);
        }
    }

    @PostMapping("/game/{gameId}/answer")
    public ResponseEntity<?> answer(@PathVariable String gameId, @RequestBody Map<String, Integer> payload) {
        Integer answer = payload.get("answer");
        if (answer == null) {
            return ResponseEntity.badRequest().body(Map.of("message", ANSWER_ERRORS.get(BattleEngine.AnswerResult.INVALID_ANSWER)));
        }
        var result = arenaService.answer(gameId, currentUser().getId(), answer);
        if (result == BattleEngine.AnswerResult.ACCEPTED) {
            return ResponseEntity.ok(Map.of("message", "Odpowiedź przyjęta"));
        }
        if (result == BattleEngine.AnswerResult.NOT_PLAYER) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.badRequest().body(Map.of("message", ANSWER_ERRORS.get(result)));
    }

    @PostMapping("/game/{gameId}/surrender")
    public ResponseEntity<?> surrenderGame(@PathVariable String gameId) {
        arenaService.surrenderGame(gameId, currentUser().getId());
        return ResponseEntity.ok(Map.of("message", "Poddałeś się!"));
    }

    @GetMapping("/game/{gameId}")
    public ResponseEntity<?> getGameStatus(@PathVariable String gameId) {
        GameSession session = arenaService.getGameSession(gameId);
        if (session != null && session.includes(currentUser().getId())) {
            return ResponseEntity.ok(session);
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/challenge/create")
    public ResponseEntity<?> createChallenge(@RequestBody Map<String, Object> payload) {
        String targetUsername = (String) payload.get("targetUsername");
        User challenger = currentUser();
        try {
            Long targetId = userService.getUserIdByUsername(targetUsername);
            arenaService.createChallenge(challenger.getId(), challenger.getUsername(), targetId, targetUsername);
            return ResponseEntity.ok(Map.of("message", "Propozycja została wysłana!"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/challenges")
    public ResponseEntity<List<Challenge>> getPendingChallenges() {
        return ResponseEntity.ok(arenaService.getPendingChallenges(currentUser().getId()));
    }

    @PostMapping("/challenge/{challengeId}/accept")
    public ResponseEntity<?> acceptChallenge(@PathVariable String challengeId) {
        try {
            return ResponseEntity.ok(arenaService.acceptChallenge(challengeId, currentUser().getId()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/challenge/{challengeId}/reject")
    public ResponseEntity<?> rejectChallenge(@PathVariable String challengeId) {
        arenaService.rejectChallenge(challengeId, currentUser().getId());
        return ResponseEntity.ok(Map.of("message", "Propozycja została odrzucona!"));
    }

    @PostMapping("/challenge/{challengeId}/cancel")
    public ResponseEntity<?> cancelChallenge(@PathVariable String challengeId) {
        try {
            arenaService.cancelChallenge(challengeId, currentUser().getId());
            return ResponseEntity.ok(Map.of("message", "Wyzwanie anulowane"));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(Map.of("message", exception.getMessage()));
        }
    }
}
