package com.hackademy.server.clerk;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class ClerkBackendClientTest {

    private static final String API = "https://api.clerk.test/v1";

    @Test
    void requiresTheSecretKey() {
        assertThrows(IllegalStateException.class,
                () -> new ClerkBackendClient(RestClient.builder(), new ClerkProperties(ClerkTestIssuer.VALUE, null, null, API)));
    }

    @Test
    void searchesUsersByExternalId() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var client = new ClerkBackendClient(builder, new ClerkProperties(ClerkTestIssuer.VALUE, null, "sk_test_x", API));
        server.expect(requestTo(API + "/users?external_id=12&limit=10")).andExpect(method(HttpMethod.GET))
                .andExpect(header("Authorization", "Bearer sk_test_x"))
                .andRespond(withSuccess("[{\"id\":\"user_12\",\"external_id\":\"12\",\"username\":null}]", MediaType.APPLICATION_JSON));
        server.expect(requestTo(API + "/users?external_id=13&limit=10"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
        server.expect(requestTo(API + "/users?external_id=14&limit=10"))
                .andRespond(withSuccess("null", MediaType.APPLICATION_JSON));

        assertEquals(List.of(new ClerkBackendClient.ClerkUser("user_12", "12")), client.findByExternalId("12"));
        assertEquals(List.of(), client.findByExternalId("13"));
        assertEquals(List.of(), client.findByExternalId("14"));
        server.verify();
    }

    @Test
    void createsUsersWithAPasswordDigestOrWithoutAPassword() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var client = new ClerkBackendClient(builder, new ClerkProperties(ClerkTestIssuer.VALUE, null, "sk_test_x", API));
        server.expect(requestTo(API + "/users")).andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.external_id").value("1"))
                .andExpect(jsonPath("$.email_address[0]").value("a@example.com"))
                .andExpect(jsonPath("$.password_digest").value("$2a$10$hash"))
                .andExpect(jsonPath("$.password_hasher").value("bcrypt"))
                .andExpect(jsonPath("$.skip_password_checks").value(true))
                .andExpect(jsonPath("$.skip_legal_checks").value(true))
                .andRespond(withSuccess("{\"id\":\"user_1\",\"external_id\":\"1\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(API + "/users")).andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.skip_password_requirement").value(true))
                .andExpect(jsonPath("$.password_digest").doesNotExist())
                .andRespond(withSuccess("{\"id\":\"user_2\",\"external_id\":\"2\"}", MediaType.APPLICATION_JSON));

        assertEquals("user_1", client.create("1", "a@example.com", "$2a$10$hash").id());
        assertEquals("user_2", client.create("2", "b@example.com", null).id());
        server.verify();
    }

    private static final class ClerkTestIssuer {
        static final String VALUE = "https://example.clerk.accounts.dev";
    }
}
