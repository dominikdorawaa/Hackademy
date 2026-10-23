package com.hackademy.server.clerk;

import com.hackademy.server.handler.GlobalExceptionHandler;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ClerkCapacityTest {
    @Test
    void reportsTemporaryCapacityFailureWithoutInvalidatingCredentials() throws Exception {
        var authenticator = mock(ClerkTokenAuthenticator.class);
        when(authenticator.authenticateHeader("Bearer test")).thenThrow(new DataAccessResourceFailureException("private database detail"));
        var request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer test");
        var response = new MockHttpServletResponse();
        var chain = mock(FilterChain.class);
        new ClerkAuthenticationFilter(authenticator).doFilter(request, response, chain);
        assertEquals(503, response.getStatus());
        assertEquals("2", response.getHeader("Retry-After"));
        assertFalse(response.getContentAsString().contains("private"));
        verifyNoInteractions(chain);
        var handled = new GlobalExceptionHandler().databaseUnavailable(new DataAccessResourceFailureException("private"));
        assertEquals(503, handled.getStatusCode().value());
        assertEquals("2", handled.getHeaders().getFirst("Retry-After"));
    }
}
