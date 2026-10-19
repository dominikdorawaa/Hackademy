package com.hackademy.server.cors;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.equalToIgnoringCase;
import static org.springframework.http.HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS;
import static org.springframework.http.HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS;
import static org.springframework.http.HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS;
import static org.springframework.http.HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN;
import static org.springframework.http.HttpHeaders.ACCESS_CONTROL_MAX_AGE;
import static org.springframework.http.HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS;
import static org.springframework.http.HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD;
import static org.springframework.http.HttpHeaders.ORIGIN;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "DB_URL=jdbc:h2:mem:production_cors_test",
        "DB_USERNAME=sa",
        "DB_PASSWORD=",
        "FRONTEND_URL=https://hackademy.app",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
class ProductionCorsIntegrationTest {
    private static final String FRONTEND = "https://hackademy.app";

    @Autowired
    private MockMvc mockMvc;

    @ParameterizedTest
    @ValueSource(strings = {"/api/badges", "/api/friends", "/api/arena/status", "/api/user/me", "/api/realtime/state",
            "/api/admin/users"})
    void allowsPreflightFromProductionFrontend(String path) throws Exception {
        mockMvc.perform(options(path)
                        .header(ORIGIN, FRONTEND)
                        .header(ACCESS_CONTROL_REQUEST_METHOD, "PATCH")
                        .header(ACCESS_CONTROL_REQUEST_HEADERS, "authorization,content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string(ACCESS_CONTROL_ALLOW_ORIGIN, FRONTEND))
                .andExpect(header().string(ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"))
                .andExpect(header().string(ACCESS_CONTROL_ALLOW_METHODS, "GET,POST,PUT,PATCH,DELETE"))
                .andExpect(header().string(ACCESS_CONTROL_ALLOW_HEADERS, equalToIgnoringCase("authorization, content-type")))
                .andExpect(header().string(ACCESS_CONTROL_MAX_AGE, "3600"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://www.hackademy.app", "https://hackademy.pages.dev",
            "https://feature-branch.hackademy.pages.dev", "http://hackademy.app", "https://hackademy.app:8443",
            "https://hackademy.app.evil.example", "https://evilhackademy.app", "http://localhost:5173", "null"})
    void rejectsPreflightFromOriginsThatAreNotConfigured(String origin) throws Exception {
        mockMvc.perform(options("/api/user/me")
                        .header(ORIGIN, origin)
                        .header(ACCESS_CONTROL_REQUEST_METHOD, "GET")
                        .header(ACCESS_CONTROL_REQUEST_HEADERS, "authorization"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    void rejectsPreflightForHeadersTheClientDoesNotUse() throws Exception {
        mockMvc.perform(options("/api/user/me")
                        .header(ORIGIN, FRONTEND)
                        .header(ACCESS_CONTROL_REQUEST_METHOD, "GET")
                        .header(ACCESS_CONTROL_REQUEST_HEADERS, "x-forwarded-for"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    void doesNotApproveUnlistedHeadersRequestedNextToAllowedOnes() throws Exception {
        mockMvc.perform(options("/api/user/me")
                        .header(ORIGIN, FRONTEND)
                        .header(ACCESS_CONTROL_REQUEST_METHOD, "GET")
                        .header(ACCESS_CONTROL_REQUEST_HEADERS, "authorization,x-forwarded-for"))
                .andExpect(header().string(ACCESS_CONTROL_ALLOW_HEADERS, equalToIgnoringCase("authorization")));
    }

    @Test
    void rejectsPreflightForMethodsTheApiDoesNotExpose() throws Exception {
        mockMvc.perform(options("/api/user/me")
                        .header(ORIGIN, FRONTEND)
                        .header(ACCESS_CONTROL_REQUEST_METHOD, "TRACE"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    void answersActualRequestsOnlyForTheProductionFrontend() throws Exception {
        mockMvc.perform(get("/api/rooms/top3").header(ORIGIN, FRONTEND))
                .andExpect(status().isOk())
                .andExpect(header().string(ACCESS_CONTROL_ALLOW_ORIGIN, FRONTEND))
                .andExpect(header().string(ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));

        mockMvc.perform(get("/api/rooms/top3").header(ORIGIN, "https://www.hackademy.app"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    void leavesRequestsWithoutOriginUnchanged() throws Exception {
        mockMvc.perform(get("/api/rooms/top3"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist(ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    void appliesTheSameOriginsToSockJsDiscovery() throws Exception {
        mockMvc.perform(get("/ws/info").header(ORIGIN, FRONTEND))
                .andExpect(status().isOk())
                .andExpect(header().string(ACCESS_CONTROL_ALLOW_ORIGIN, FRONTEND))
                .andExpect(header().string(ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));

        mockMvc.perform(get("/ws/info").header(ORIGIN, "https://hackademy.pages.dev"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(ACCESS_CONTROL_ALLOW_ORIGIN));
    }
}
