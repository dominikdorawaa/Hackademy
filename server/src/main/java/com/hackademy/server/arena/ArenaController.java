package com.hackademy.server.arena;

import com.hackademy.server.user.User;
import com.hackademy.server.user.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/arena")
@RequiredArgsConstructor
@Slf4j
public class ArenaController {

    private static final Map<BattleEngine.AnswerResult, String> ANSWER_ERRORS = Map.of(
            BattleEngine.AnswerResult.WRONG_ROUND, "Ta odpowiedź dotyczy innej rundy. Odpowiedz na bieżące pytanie.",
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
            try {
                arenaService.addGame(session);
            } catch (RuntimeException error) {
                log.warn("Could not prepare arena match {}", session.getId(), error);
                continue;
            }
            matchmakingService.leaveQueue(session.getPlayer1Id());
            matchmakingService.leaveQueue(session.getPlayer2Id());
        }
    }

    @PostMapping("/game/{gameId}/answer")
    public ResponseEntity<?> answer(@PathVariable String gameId, @RequestBody Map<String, Integer> payload) {
        Integer answer = payload.get("answer");
        if (answer == null) {
            return ResponseEntity.badRequest().body(Map.of("message", ANSWER_ERRORS.get(BattleEngine.AnswerResult.INVALID_ANSWER)));
        }
        Integer round = payload.get("round");
        if (round == null || round < 1) {
            return ResponseEntity.badRequest().body(Map.of("message", "Podaj numer rundy, na którą odpowiadasz."));
        }
        var result = arenaService.answer(gameId, currentUser().getId(), round, answer);
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
        return switch (arenaService.surrenderGame(gameId, currentUser().getId())) {
            case SURRENDERED -> ResponseEntity.ok(Map.of("message", "Poddałeś się!"));
            case NOT_PLAYER -> ResponseEntity.notFound().build();
            case NOT_ACTIVE -> ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "Ta walka jest już zakończona."));
        };
    }

    @PostMapping("/game/{gameId}/reaction")
    public ResponseEntity<?> react(@PathVariable String gameId, @RequestBody(required = false) Map<String, String> payload) {
        String reaction = payload == null ? null : payload.get("reaction");
        ReactionOutcome outcome = arenaService.react(gameId, currentUser().getId(), reaction);
        return switch (outcome.status()) {
            case SENT -> ResponseEntity.ok(Map.of("message", "Reakcja wysłana"));
            case NOT_PLAYER -> ResponseEntity.notFound().build();
            case UNKNOWN_REACTION -> ResponseEntity.badRequest().body(Map.of("message", "Wybierz reakcję z menu."));
            case MUTED -> ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "message", "Masz wyciszone reakcje.",
                    "mutedUntil", outcome.mutedUntil().atOffset(ZoneOffset.UTC).toInstant().toString()));
            case TOO_FAST -> {
                long seconds = Math.max(1, (outcome.retryAfterMillis() + 999) / 1000);
                yield ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .header(HttpHeaders.RETRY_AFTER, Long.toString(seconds))
                        .body(Map.of("message", "Za szybko. Poczekaj chwilę przed kolejną reakcją.", "retryAfter", seconds));
            }
        };
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
