package com.hackademy.server;

import com.hackademy.server.arena.ArenaPresence;
import com.hackademy.server.user.Role;
import com.hackademy.server.user.UserRepository;
import com.jayway.jsonpath.JsonPath;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
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

@SpringBootTest
@AutoConfigureMockMvc
@Import(PostgresIntegrationTest.ConnectedPlayers.class)
abstract class PostgresIntegrationTest {
    @TestConfiguration
    static class ConnectedPlayers {
        @Bean
        @Primary
        ArenaPresence connectedPlayers() {
            return userId -> true;
        }
    }

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

    protected Account account(Role role) {
        var username = role.name().toLowerCase() + UUID.randomUUID().toString().substring(0, 8);
        var savedUser = ClerkTestTokens.createUser(userRepository, username, role);
        return new Account(savedUser.getId(), username, ClerkTestTokens.tokenFor(savedUser));
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
                {"title":"%s","description":"description","difficulty":"EASY","category":"Web","points":50,"requiresVpn":false,"roomType":"%s"}
                """.formatted(title, roomType).getBytes(StandardCharsets.UTF_8));
        var result = mockMvc.perform(multipart("/api/admin/rooms")
                        .file(room)
                        .header("Authorization", "Bearer " + admin.token()))
                .andExpect(status().isCreated())
                .andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).longValue();
    }

    protected long publishInPath(long... roomIds) {
        return PublishedPaths.publishInPath(jdbcTemplate, roomIds);
    }

    protected void joinPathsOf(Account account, long... roomIds) {
        PublishedPaths.joinPathsOf(jdbcTemplate, account.id(), roomIds);
    }

    protected long addFlagTask(long room, String flag) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO room_tasks (room_id, title, content, question, answer, sort_order)
                VALUES (?, 'Zdobądź flagę', 'Znajdź flagę',
                        (SELECT CASE WHEN room_type = 'PATH' THEN 'Jaka jest flaga?' END FROM rooms WHERE id = ?),
                        ?, (SELECT count(*) FROM room_tasks WHERE room_id = ?))
                RETURNING id
                """, Long.class, room, room, flag, room);
    }

    protected long addHint(long room, String description) {
        Long task = jdbcTemplate.query("SELECT id FROM room_tasks WHERE room_id = ? ORDER BY sort_order, id LIMIT 1",
                rows -> rows.next() ? rows.getLong(1) : null, room);
        long owner = task == null ? addFlagTask(room, "flag") : task;
        return jdbcTemplate.queryForObject("""
                INSERT INTO hints (description, task_id, sort_order)
                VALUES (?, ?, (SELECT count(*) FROM hints WHERE task_id = ?))
                RETURNING id
                """, Long.class, description, owner, owner);
    }

    protected ResultActions solveRoom(Account account, long room, String answer) throws Exception {
        long task = jdbcTemplate.queryForObject("SELECT id FROM room_tasks WHERE room_id = ? ORDER BY sort_order, id LIMIT 1", Long.class, room);
        return postJson(account, "/api/rooms/" + room + "/tasks/" + task + "/solve", "{\"answer\":\"" + answer + "\"}");
    }

    protected String uniqueTitle(String prefix) {
        return prefix + " " + UUID.randomUUID().toString().substring(0, 8);
    }
}
