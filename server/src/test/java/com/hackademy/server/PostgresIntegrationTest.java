package com.hackademy.server;

import com.hackademy.server.user.Role;
import com.hackademy.server.user.UserRepository;
import com.jayway.jsonpath.JsonPath;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "JWT_SECRET=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
@AutoConfigureMockMvc
abstract class PostgresIntegrationTest {
    private static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17.11-alpine");

    static {
        postgres.start();
    }

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("DB_URL", postgres::getJdbcUrl);
        registry.add("DB_USERNAME", postgres::getUsername);
        registry.add("DB_PASSWORD", postgres::getPassword);
    }

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected UserRepository userRepository;

    @Autowired
    protected JdbcTemplate jdbcTemplate;

    protected record Account(long id, String username, String token) {}

    protected Account account(Role role) throws Exception {
        var username = role.name().toLowerCase() + UUID.randomUUID().toString().substring(0, 8);
        var email = username + "@example.com";
        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content("""
                                {"username":"%s","email":"%s","password":"password123"}
                                """.formatted(username, email)))
                .andExpect(status().isOk());

        var savedUser = userRepository.findByEmail(email).orElseThrow();
        savedUser.setRole(role);
        userRepository.saveAndFlush(savedUser);

        var login = mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("""
                                {"email":"%s","password":"password123"}
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andReturn();
        String token = JsonPath.read(login.getResponse().getContentAsString(), "$.token");
        return new Account(savedUser.getId(), username, token);
    }

    protected ResultActions getAs(Account account, String url) throws Exception {
        return mockMvc.perform(get(url).header("Authorization", "Bearer " + account.token()));
    }

    protected ResultActions putJson(Account account, String url, String body) throws Exception {
        return mockMvc.perform(put(url)
                .header("Authorization", "Bearer " + account.token())
                .contentType("application/json")
                .content(body));
    }

    protected ResultActions postJson(Account account, String url, String body) throws Exception {
        return mockMvc.perform(post(url)
                .header("Authorization", "Bearer " + account.token())
                .contentType("application/json")
                .content(body));
    }

    protected long createRoom(Account admin, String title, String roomType) throws Exception {
        var room = new MockMultipartFile("room", "", MediaType.APPLICATION_JSON_VALUE, """
                {"title":"%s","description":"description","difficulty":"EASY","category":"Web","points":50,"flag":"flag","requiresVpn":false,"roomType":"%s","hints":[]}
                """.formatted(title, roomType).getBytes(StandardCharsets.UTF_8));
        var result = mockMvc.perform(multipart("/api/admin/rooms")
                        .file(room)
                        .header("Authorization", "Bearer " + admin.token()))
                .andExpect(status().isCreated())
                .andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).longValue();
    }

    protected String uniqueTitle(String prefix) {
        return prefix + " " + UUID.randomUUID().toString().substring(0, 8);
    }
}
