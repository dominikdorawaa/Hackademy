package com.hackademy.server.controller;

import com.hackademy.server.model.Challenge;
import com.hackademy.server.model.GameSession;
import com.hackademy.server.model.User;
import com.hackademy.server.service.ArenaService;
import com.hackademy.server.service.MatchmakingService;
import com.hackademy.server.service.UserService;
import com.hackademy.server.service.VpnService;
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

    private final MatchmakingService matchmakingService;
    private final ArenaService arenaService;
    private final UserService userService;
    private final VpnService vpnService;

    @PostMapping("/join")
    public ResponseEntity<?> joinQueue(@RequestBody(required = false) Map<String, Boolean> payload) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        
        if (user.getPoints() < 500) { 
             return ResponseEntity.badRequest().body(Map.of("message", "Wymagany poziom 5 (500 pkt) aby dołączyć do Areny."));
        }

        boolean vpnEnabled = payload != null && payload.getOrDefault("vpnEnabled", false);


        if (vpnEnabled && !userService.hasSolvedTutorialVpn(user.getId())) {
            return ResponseEntity.badRequest().body(
                    Map.of("message", "Aby grać w Arenie z VPN, musisz najpierw ukończyć pokój Tutorial VPN.")
            );
        }

        matchmakingService.joinQueue(user.getId(), user.getUsername(), vpnEnabled);
        return ResponseEntity.ok(Map.of("message", "Dołączono do kolejki"));
    }

    @PostMapping("/leave")
    public ResponseEntity<?> leaveQueue() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        matchmakingService.leaveQueue(user.getId());
        return ResponseEntity.ok(Map.of("message", "Opuszczono kolejkę"));
    }

    @GetMapping("/status")
    public ResponseEntity<?> checkStatus() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        
        GameSession session = arenaService.findCurrentGameForUser(user.getId());
        
        if (session != null) {
            return ResponseEntity.ok(session);
        }
        return ResponseEntity.noContent().build();
    }

    @Scheduled(fixedRate = 500) 
    public void processMatchmaking() {
        List<GameSession> sessions = matchmakingService.checkForMatches();
        for (GameSession session : sessions) {
            arenaService.addGame(session);
        }
    }
    
    
    @PostMapping("/game/{gameId}/win")
    public ResponseEntity<?> reportWin(@PathVariable String gameId) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        arenaService.finishGame(gameId, user.getId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/game/{gameId}/solve")
    public ResponseEntity<?> solveArenaRoom(@PathVariable String gameId, @RequestBody Map<String, String> payload) {
        String flag = payload.get("flag");
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        
        boolean solved = arenaService.submitFlag(gameId, user.getId(), flag);
        
        if (solved) {
            
            GameSession session = arenaService.getGameSession(gameId);
            if ("WAITING_FOR_OPPONENT".equals(session.getStatus())) {
                 return ResponseEntity.ok(Map.of("message", "Poprawna flaga! Czekanie na wynik przeciwnika (z powodu Twoich kar czasowych)...", "success", true, "status", "WAITING"));
            }
            return ResponseEntity.ok(Map.of("message", "Poprawna flaga! Wygrałeś!", "success", true, "status", "FINISHED"));
        } else {
            return ResponseEntity.badRequest().body(Map.of("message", "Niepoprawna flaga", "success", false));
        }
    }
    
    @PostMapping("/game/{gameId}/hint")
    public ResponseEntity<?> useHint(@PathVariable String gameId, @RequestBody Map<String, Long> payload) {
        Long hintId = payload.get("hintId");
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        arenaService.useHint(gameId, user.getId(), hintId);
        return ResponseEntity.ok(Map.of("message", "Podpowiedź odblokowana! +2 minuty kary."));
    }
    
    @PostMapping("/game/{gameId}/surrender")
    public ResponseEntity<?> surrenderGame(@PathVariable String gameId) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        arenaService.surrenderGame(gameId, user.getId());
        return ResponseEntity.ok(Map.of("message", "Poddałeś się!"));
    }
    
    @GetMapping("/game/{gameId}")
    public ResponseEntity<?> getGameStatus(@PathVariable String gameId) {
        GameSession session = arenaService.getGameSession(gameId);
        if (session != null) {
            return ResponseEntity.ok(session);
        }
        return ResponseEntity.notFound().build();
    }

    // --- Challenge Endpoints ---

    @PostMapping("/challenge/create")
    public ResponseEntity<?> createChallenge(@RequestBody Map<String, Object> payload) {
        String targetUsername = (String) payload.get("targetUsername");
        Boolean vpnEnabled = (Boolean) payload.getOrDefault("vpnEnabled", false);
        User challenger = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        
        try {
            Long targetId = userService.getUserIdByUsername(targetUsername);
            
            // Check if target has VPN access if vpnEnabled is true
            if (vpnEnabled) {
                boolean targetHasVpn = userService.hasSolvedTutorialVpn(targetId);
                if (!targetHasVpn) {
                    return ResponseEntity.badRequest().body(Map.of("message", "Użytkownik " + targetUsername + " nie ma odblokowanego dostępu do VPN."));
                }
            }
            
            arenaService.createChallenge(challenger.getId(), challenger.getUsername(), targetId, targetUsername, vpnEnabled);
            return ResponseEntity.ok(Map.of("message", "Propozycja została wysłana!"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/challenges")
    public ResponseEntity<List<Challenge>> getPendingChallenges() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(arenaService.getPendingChallenges(user.getId()));
    }

    @PostMapping("/challenge/{challengeId}/accept")
    public ResponseEntity<?> acceptChallenge(@PathVariable String challengeId) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        try {
            GameSession session = arenaService.acceptChallenge(challengeId, user.getId());
            return ResponseEntity.ok(session);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/challenge/{challengeId}/reject")
    public ResponseEntity<?> rejectChallenge(@PathVariable String challengeId) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        arenaService.rejectChallenge(challengeId, user.getId());
        return ResponseEntity.ok(Map.of("message", "Propozycja została odrzucona!"));
    }
}
