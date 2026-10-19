package com.hackademy.server.clerk;

import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class ClerkImportRunnerTest {
    private final UserRepository repository = mock(UserRepository.class);
    private final ConfigurableApplicationContext context = mock(ConfigurableApplicationContext.class);
    private final ClerkProperties properties = new ClerkProperties("https://example.clerk.accounts.dev", null, "sk_test_example", null);

    @Test
    void closesTheImportProcessAfterSuccess() {
        when(repository.findByClerkUserIdIsNullOrderByIdAsc()).thenReturn(List.of());
        new ClerkImportRunner(repository, properties, RestClient.builder(), context).run(new DefaultApplicationArguments());
        verify(context).close();
    }

    @Test
    void failsStartupWhenAnyAccountCouldNotBeImported() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        when(repository.findByClerkUserIdIsNullOrderByIdAsc()).thenReturn(List.of(User.builder().id(1L).email("a@example.com").build()));
        server.expect(requestTo("https://api.clerk.com/v1/users?external_id=1&limit=10"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.clerk.com/v1/users")).andRespond(withStatus(HttpStatus.UNPROCESSABLE_CONTENT));
        assertThrows(IllegalStateException.class, () -> new ClerkImportRunner(repository, properties, builder, context).run(new DefaultApplicationArguments()));
        verify(context, never()).close();
        server.verify();
    }
}
