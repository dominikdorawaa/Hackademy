package com.hackademy.server.clerk;

import com.hackademy.server.ClerkTestTokens;
import com.hackademy.server.user.Role;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "DB_URL=jdbc:h2:mem:clerk_authentication_test",
        "DB_USERNAME=sa",
        "DB_PASSWORD=",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
class ClerkAuthenticationIntegrationTest {

    private static final String ORIGIN = ClerkTestTokens.DEFAULT_ORIGIN;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Test
    void protectedEndpointsReturnUnauthorizedWithoutAValidToken() throws Exception {
        mockMvc.perform(get("/api/user/me")).andExpect(status().isUnauthorized());
        for (String header : invalidHeaders()) {
            mockMvc.perform(get("/api/user/me").header("Authorization", header)).andExpect(status().isUnauthorized());
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"/health", "/api/rooms/top3", "/api/user/ranking"})
    void publicEndpointsIgnoreStaleOrBrokenTokens(String path) throws Exception {
        for (String header : invalidHeaders()) {
            mockMvc.perform(get(path).header("Authorization", header)).andExpect(status().isOk());
        }
    }

    @Test
    void authorizationComesFromTheLocalRoleNotFromTokenClaims() throws Exception {
        var user = ClerkTestTokens.createUser(userRepository, name("member"), Role.USER);
        var forged = ClerkTestTokens.token(user.getClerkUserId(), ORIGIN,
                Map.of("roles", List.of("ROLE_ADMIN"), "role", "ADMIN", "email", user.getEmail(), "email_verified", true));
        mockMvc.perform(get("/api/admin/users").header("Authorization", "Bearer " + forged)).andExpect(status().isForbidden());

        var admin = ClerkTestTokens.createUser(userRepository, name("admin"), Role.ADMIN);
        mockMvc.perform(get("/api/admin/users").header("Authorization", ClerkTestTokens.bearer(admin))).andExpect(status().isOk());
    }

    @Test
    void firstSignInCannotClaimLegacyAccountByEmailOrExternalId() throws Exception {
        var imported = userRepository.saveAndFlush(User.builder()
                .username(name("legacy")).email(name("legacy") + "@example.com").password("$2a$10$legacy").role(Role.EXPERT).build());
        var clerkUserId = "user_" + UUID.randomUUID().toString().replace("-", "");
        var token = ClerkTestTokens.token(clerkUserId, ORIGIN,
                Map.of("external_id", imported.getId().toString(), "email", imported.getEmail(), "email_verified", true));

        mockMvc.perform(get("/api/user/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
        assertEquals(null, userRepository.findById(imported.getId()).orElseThrow().getClerkUserId());
    }

    @Test
    void newClerkUsersGetANeutralPublicUsername() throws Exception {
        var clerkUserId = "user_" + UUID.randomUUID().toString().replace("-", "");
        var token = ClerkTestTokens.token(clerkUserId, ORIGIN, Map.of("email", "jan.kowalski@example.com", "email_verified", true));

        mockMvc.perform(get("/api/user/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("USER"))
                .andExpect(jsonPath("$.onboarding.avatarConfirmed").value(false));
        var created = userRepository.findByClerkUserId(clerkUserId).orElseThrow();
        assertEquals(true, created.getUsername().matches("gracz[0-9]{6}"));
    }

    private static List<String> invalidHeaders() {
        Instant now = Instant.now();
        String expired = ClerkTestTokens.sign(ClerkTestTokens.keys(),
                ClerkTestTokens.builder("user_old", ORIGIN, now.minusSeconds(600), now.minusSeconds(300), Map.of()).build());
        String foreignKey = ClerkTestTokens.sign(ClerkTestTokens.generate(),
                ClerkTestTokens.builder("user_any", ORIGIN, now, now.plusSeconds(60), Map.of()).build());
        String unverified = ClerkTestTokens.token("user_unverified_http", ORIGIN, Map.of("email", "u@example.com"));
        return List.of("Bearer ", "Bearer broken", "Bearer " + expired, "Bearer " + foreignKey, "Bearer " + unverified);
    }

    private static String name(String prefix) {
        return prefix + UUID.randomUUID().toString().substring(0, 8);
    }
}
