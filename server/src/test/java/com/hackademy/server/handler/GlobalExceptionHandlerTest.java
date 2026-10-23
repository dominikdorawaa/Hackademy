package com.hackademy.server.handler;

import com.hackademy.server.arena.ArenaQuestion;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GlobalExceptionHandlerTest {

    @Test
    void reportsAConcurrentSaveAsAConflict() {
        var response = new GlobalExceptionHandler()
                .handleOptimisticLockingFailure(new ObjectOptimisticLockingFailureException(ArenaQuestion.class, 7L));
        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertEquals("Ktoś zmienił te dane w międzyczasie. Odśwież widok i spróbuj ponownie.", response.getBody().get("message"));
    }
}
