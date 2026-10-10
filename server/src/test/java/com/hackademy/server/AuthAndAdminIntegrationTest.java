package com.hackademy.server;

import com.hackademy.server.user.Role;
import com.hackademy.server.user.UserRepository;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "JWT_SECRET=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
@AutoConfigureMockMvc
@Testcontainers
class AuthAndAdminIntegrationTest {
    @Container
    private static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17.11-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("DB_URL", postgres::getJdbcUrl);
        registry.add("DB_USERNAME", postgres::getUsername);
        registry.add("DB_PASSWORD", postgres::getPassword);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void registersAndLogsInAgainstMigratedDatabase() throws Exception {
        assertEquals(3, jdbcTemplate.queryForObject(
                "SELECT count(*) FROM flyway_schema_history WHERE success", Integer.class));

        var username = "user" + UUID.randomUUID().toString().substring(0, 8);
        var email = username + "@example.com";
        var registration = mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content(registerBody(username, email)))
                .andExpect(status().isOk())
                .andReturn();
        assertNotNull(JsonPath.read(registration.getResponse().getContentAsString(), "$.token"));

        var savedUser = userRepository.findByEmail(email).orElseThrow();
        assertEquals(Role.USER, savedUser.getRole());
        assertNotEquals("password123", savedUser.getPassword());

        var login = mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(loginBody(email.toUpperCase(), "password123")))
                .andExpect(status().isOk())
                .andReturn();
        assertFalse(((String) JsonPath.read(login.getResponse().getContentAsString(), "$.token")).isBlank());

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(loginBody(email, "wrong-password")))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content(registerBody(username, email)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void enforcesAdminEndpointPermissionsForEveryRole() throws Exception {
        var userToken = tokenFor(Role.USER);
        var expertToken = tokenFor(Role.EXPERT);
        var adminToken = tokenFor(Role.ADMIN);

        mockMvc.perform(get("/api/admin/rooms").header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/rooms").header("Authorization", "Bearer " + expertToken))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/admin/rooms").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/users").header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/users").header("Authorization", "Bearer " + expertToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/users").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    private String tokenFor(Role role) throws Exception {
        var username = role.name().toLowerCase() + UUID.randomUUID().toString().substring(0, 8);
        var email = username + "@example.com";
        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content(registerBody(username, email)))
                .andExpect(status().isOk());

        var savedUser = userRepository.findByEmail(email).orElseThrow();
        savedUser.setRole(role);
        userRepository.saveAndFlush(savedUser);

        var login = mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(loginBody(email, "password123")))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(login.getResponse().getContentAsString(), "$.token");
    }

    private String registerBody(String username, String email) {
        return """
                {"username":"%s","email":"%s","password":"password123"}
                """.formatted(username, email);
    }

    private String loginBody(String email, String password) {
        return """
                {"email":"%s","password":"%s"}
                """.formatted(email, password);
    }
}
