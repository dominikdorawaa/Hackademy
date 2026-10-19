package com.hackademy.server.clerk;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class ClerkBackendClient {

    private final RestClient restClient;

    public ClerkBackendClient(RestClient.Builder builder, ClerkProperties properties) {
        if (properties.secretKey() == null) {
            throw new IllegalStateException("application.clerk.secret-key is required to call the Clerk Backend API");
        }
        this.restClient = builder
                .baseUrl(properties.apiUrl())
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.secretKey())
                .build();
    }

    public List<ClerkUser> findByExternalId(String externalId) {
        return list("external_id", externalId);
    }

    public ClerkUser create(String externalId, String email, String passwordDigest) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("external_id", externalId);
        body.put("email_address", List.of(email));
        body.put("skip_legal_checks", true);
        if (passwordDigest == null) {
            body.put("skip_password_requirement", true);
        } else {
            body.put("password_digest", passwordDigest);
            body.put("password_hasher", "bcrypt");
            body.put("skip_password_checks", true);
        }
        return restClient.post().uri("/users").contentType(MediaType.APPLICATION_JSON).body(body)
                .retrieve().body(ClerkUser.class);
    }

    private List<ClerkUser> list(String filter, String value) {
        ClerkUser[] users = restClient.get()
                .uri(uri -> uri.path("/users").queryParam(filter, value).queryParam("limit", 10).build())
                .retrieve().body(ClerkUser[].class);
        return users == null ? List.of() : List.of(users);
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ClerkUser(String id, @JsonProperty("external_id") String externalId) {
    }
}
