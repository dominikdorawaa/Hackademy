package com.hackademy.server;

import com.hackademy.server.user.Role;
import com.hackademy.server.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.client.RestClient;


import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "DB_URL=jdbc:h2:mem:hackademy_test",
        "DB_USERNAME=sa",
        "DB_PASSWORD=",
        "FRONTEND_URL=https://hackademy.app",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
class ServerStartupTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RestClient.Builder restClientBuilder;

    @Test
    void startsAndServesHealthEndpoint() throws Exception {
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    void providesRestClientBuilderForClerkImport() {
        assertNotNull(restClientBuilder.build());
    }

    @Test
    void allowsOnlyConfiguredFrontendOrigin() throws Exception {
        mockMvc.perform(get("/health").header("Origin", "https://hackademy.app"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://hackademy.app"));

        mockMvc.perform(get("/health").header("Origin", "http://localhost:5173"))
                .andExpect(status().isForbidden());
    }

    @Test
    void servesPublicRoomsAsJson() throws Exception {
        mockMvc.perform(get("/api/rooms/top3"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void bindsAndValidatesRecordRequestFromJson() throws Exception {
        var user = ClerkTestTokens.createUser(userRepository, "startup" + System.nanoTime() % 100000, Role.USER);
        mockMvc.perform(patch("/api/user/me/username")
                        .header("Authorization", "Bearer " + ClerkTestTokens.tokenFor(user, "https://hackademy.app"))
                        .contentType("application/json")
                        .content("{\"newUsername\":\"ab\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.newUsername").exists());
    }
}
