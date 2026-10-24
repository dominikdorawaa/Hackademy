package com.hackademy.server.arena;

import com.hackademy.server.arena.dto.ArenaQuestionAdminView;
import com.hackademy.server.arena.dto.ArenaQuestionRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;

/**
 * Manages the arena question bank. Duels copy their questions when they start, so changes here only reach
 * matches that begin afterwards.
 */
@Service
@RequiredArgsConstructor
public class ArenaQuestionAdminService {
    static final String NOT_FOUND = "Nie znaleziono pytania.";
    static final String STALE = "Ktoś zmienił to pytanie w międzyczasie. Odśwież listę i spróbuj ponownie.";
    static final String LAST_QUESTION = "Arena potrzebuje co najmniej jednego pytania. Dodaj inne, zanim usuniesz to.";
    static final String DUPLICATE_ANSWERS = "Odpowiedzi muszą się od siebie różnić.";
    static final String MISSING_VERSION = "Brak wersji pytania. Odśwież listę i spróbuj ponownie.";

    private final ArenaQuestionRepository questions;

    @Transactional(readOnly = true)
    public Slice<ArenaQuestionAdminView> page(int page, int size, String query, String category, String difficulty) {
        String term = query == null ? "" : query.strip();
        if (term.length() > 64) term = term.substring(0, 64);
        var request = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(100, size)));
        return questions.findAdminPage(term, filter(category, ArenaQuestionRules.CATEGORIES),
                filter(difficulty, ArenaQuestionRules.DIFFICULTIES), request).map(ArenaQuestionAdminView::of);
    }

    @Transactional
    public ArenaQuestionAdminView create(ArenaQuestionRequest request) {
        var question = new ArenaQuestion();
        apply(question, request);
        return ArenaQuestionAdminView.of(questions.saveAndFlush(question));
    }

    @Transactional
    public ArenaQuestionAdminView update(Long id, ArenaQuestionRequest request) {
        if (request.version() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, MISSING_VERSION);
        var question = questions.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, NOT_FOUND));
        if (question.getVersion() != request.version()) throw new ResponseStatusException(HttpStatus.CONFLICT, STALE);
        apply(question, request);
        return ArenaQuestionAdminView.of(questions.saveAndFlush(question));
    }

    @Transactional
    public void delete(Long id) {
        List<Long> ids = questions.lockAllIds();
        if (!ids.contains(id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, NOT_FOUND);
        if (ids.size() <= 1) throw new ResponseStatusException(HttpStatus.CONFLICT, LAST_QUESTION);
        questions.deleteById(id);
    }

    private static String filter(String value, List<String> allowed) {
        String normalized = value == null ? "" : value.strip().toUpperCase(Locale.ROOT);
        if (!normalized.isEmpty() && !allowed.contains(normalized)) {
            throw new IllegalArgumentException("Nieznany filtr: " + value);
        }
        return normalized;
    }

    private static void apply(ArenaQuestion question, ArenaQuestionRequest request) {
        String correct = request.correctAnswer().strip();
        List<String> wrong = request.wrongAnswers().stream().map(String::strip).toList();
        var distinct = new HashSet<String>();
        distinct.add(correct.toLowerCase(Locale.ROOT));
        wrong.forEach(answer -> distinct.add(answer.toLowerCase(Locale.ROOT)));
        if (distinct.size() != BattleEngine.ANSWERS) throw new IllegalArgumentException(DUPLICATE_ANSWERS);
        question.setContent(request.content().strip());
        question.setCorrectAnswer(correct);
        question.setWrongAnswer1(wrong.get(0));
        question.setWrongAnswer2(wrong.get(1));
        question.setWrongAnswer3(wrong.get(2));
        question.setCategory(request.category());
        question.setDifficulty(request.difficulty());
    }
}
