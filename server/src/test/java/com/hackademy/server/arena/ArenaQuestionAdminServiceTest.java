package com.hackademy.server.arena;

import com.hackademy.server.arena.dto.ArenaQuestionRequest;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.SliceImpl;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ArenaQuestionAdminServiceTest {
    private final ArenaQuestionRepository repository = mock(ArenaQuestionRepository.class);
    private final ArenaQuestionAdminService service = new ArenaQuestionAdminService(repository);

    private static ArenaQuestionRequest request(List<String> answers, Long version) {
        return new ArenaQuestionRequest("  Co robi nmap?  ", answers, 1, "SIECI", "EASY", version);
    }

    private static ArenaQuestion stored(long version) {
        return new ArenaQuestion(7L, "Stare", "A", "B", "C", "D", 0, "WEB", "HARD", version);
    }

    private static HttpStatus status(ResponseStatusException failure) {
        return HttpStatus.valueOf(failure.getStatusCode().value());
    }

    @Test
    void createsATrimmedQuestion() {
        when(repository.saveAndFlush(any())).thenAnswer(call -> {
            ArenaQuestion question = call.getArgument(0);
            question.setId(9L);
            return question;
        });
        var view = service.create(request(List.of(" Skanuje porty ", "Szyfruje", "Kompresuje", "Drukuje"), null));
        assertEquals(9L, view.id());
        assertEquals("Co robi nmap?", view.content());
        assertEquals(List.of("Skanuje porty", "Szyfruje", "Kompresuje", "Drukuje"), view.answers());
        assertEquals(1, view.correctAnswer());
        assertEquals("SIECI", view.category());
        assertEquals("EASY", view.difficulty());
    }

    @Test
    void refusesAnswersThatOnlyDifferInCaseOrSpaces() {
        var failure = assertThrows(IllegalArgumentException.class,
                () -> service.create(request(List.of("Porty", " porty", "Pliki", "Hasła"), null)));
        assertEquals(ArenaQuestionAdminService.DUPLICATE_ANSWERS, failure.getMessage());
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void updatesOnlyTheVersionTheAdministratorSaw() {
        var question = stored(3);
        when(repository.findById(7L)).thenReturn(Optional.of(question));
        when(repository.saveAndFlush(question)).thenReturn(question);
        var answers = List.of("Skanuje porty", "Szyfruje", "Kompresuje", "Drukuje");

        var stale = assertThrows(ResponseStatusException.class, () -> service.update(7L, request(answers, 2L)));
        assertEquals(HttpStatus.CONFLICT, status(stale));
        var missing = assertThrows(ResponseStatusException.class, () -> service.update(7L, request(answers, null)));
        assertEquals(HttpStatus.BAD_REQUEST, status(missing));
        assertEquals("Stare", question.getContent());

        var view = service.update(7L, request(answers, 3L));
        assertEquals("Co robi nmap?", view.content());
        assertEquals("SIECI", question.getCategory());
        assertEquals("Drukuje", question.getAnswerD());
    }

    @Test
    void reportsMissingQuestions() {
        when(repository.findById(5L)).thenReturn(Optional.empty());
        when(repository.lockAllIds()).thenReturn(List.of(1L, 2L));
        var answers = List.of("A", "B", "C", "D");
        assertEquals(HttpStatus.NOT_FOUND, status(assertThrows(ResponseStatusException.class, () -> service.update(5L, request(answers, 0L)))));
        assertEquals(HttpStatus.NOT_FOUND, status(assertThrows(ResponseStatusException.class, () -> service.delete(5L))));
    }

    @Test
    void keepsAtLeastOneQuestionForTheArena() {
        when(repository.lockAllIds()).thenReturn(List.of(4L));
        var failure = assertThrows(ResponseStatusException.class, () -> service.delete(4L));
        assertEquals(HttpStatus.CONFLICT, status(failure));
        verify(repository, never()).deleteById(any());

        when(repository.lockAllIds()).thenReturn(List.of(4L, 5L));
        service.delete(4L);
        verify(repository).deleteById(4L);
    }

    @Test
    void normalizesFiltersAndBoundsPages() {
        when(repository.findAdminPage(anyString(), anyString(), anyString(), any()))
                .thenReturn(new SliceImpl<>(List.of(stored(0)), PageRequest.of(0, 100), false));
        var page = service.page(-3, 5_000, "  " + "x".repeat(80) + " ", " web ", "hard");
        assertEquals("Stare", page.getContent().get(0).content());
        verify(repository).findAdminPage(eq("x".repeat(64)), eq("WEB"), eq("HARD"), eq(PageRequest.of(0, 100)));
        service.page(1, 0, null, null, null);
        verify(repository).findAdminPage(eq(""), eq(""), eq(""), eq(PageRequest.of(1, 1)));
        assertThrows(IllegalArgumentException.class, () -> service.page(0, 50, "", "CTF", ""));
        assertThrows(IllegalArgumentException.class, () -> service.page(0, 50, "", "", "INSANE"));
    }
}
