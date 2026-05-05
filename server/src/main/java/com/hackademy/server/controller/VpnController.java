package com.hackademy.server.controller;

import com.hackademy.server.model.User;
import com.hackademy.server.repository.UserRepository;
import com.hackademy.server.service.UserService;
import com.hackademy.server.service.VpnService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/vpn")
@RequiredArgsConstructor
public class VpnController {

    private final VpnService vpnService;
    private final UserRepository userRepository;
    private final UserService userService;

    @GetMapping("/status")
    public ResponseEntity<?> getVpnStatus() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof UserDetails)) {
            return ResponseEntity.status(401).build();
        }
        String username = ((UserDetails) principal).getUsername();
        User user = userRepository.findByUsername(username).orElseThrow();

        int userLevel = (user.getPoints() / 100) + 1;
        boolean hasLevel = userLevel >= 10;
        boolean hasTutorial = userService.hasSolvedTutorialVpn(user.getId());

        Map<String, Object> status = new HashMap<>();
        status.put("canDownload", hasLevel && hasTutorial);
        status.put("levelRequirementMet", hasLevel);
        status.put("tutorialRequirementMet", hasTutorial);
        status.put("currentLevel", userLevel);

        return ResponseEntity.ok(status);
    }

    @GetMapping("/download")
    public ResponseEntity<?> downloadVpnConfig() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof UserDetails)) {
            return ResponseEntity.status(401).build();
        }
        String username = ((UserDetails) principal).getUsername();
        User user = userRepository.findByUsername(username).orElseThrow();

        int userLevel = (user.getPoints() / 100) + 1;
        boolean hasLevel = userLevel >= 10;
        boolean hasTutorial = userService.hasSolvedTutorialVpn(user.getId());

        if (!hasLevel || !hasTutorial) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Nie spełniasz wymagań: Poziom 10+ oraz ukończony pokój 'Tutorial VPN/VM'.");
        }

        try {
            Resource resource = vpnService.generateVpnConfig(username);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + username + ".ovpn\"")
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .body(resource);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
}
