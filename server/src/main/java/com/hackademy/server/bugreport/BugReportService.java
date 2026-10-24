package com.hackademy.server.bugreport;

import com.hackademy.server.room.RoomRepository;
import com.hackademy.server.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class BugReportService {

    static final int MIN_LENGTH = 10;
    static final int MAX_LENGTH = 2000;
    static final int MAX_PATH_LENGTH = 300;
    static final Duration HOUR = Duration.ofHours(1);
    static final Duration DAY = Duration.ofHours(24);
    static final String TOO_SHORT = "Opisz problem w co najmniej " + MIN_LENGTH + " znakach.";
    static final String TOO_LONG = "Opis może mieć najwyżej " + MAX_LENGTH + " znaków.";
    static final String MISSING_SOURCE = "Wskaż, gdzie wystąpił problem.";
    static final String MISSING_ROOM = "Nie znaleziono pokoju, którego dotyczy zgłoszenie.";
    static final String WRONG_TASK = "To zadanie nie należy do wskazanego pokoju.";
    static final String ROOM_IN_ARENA = "Zgłoszenie z areny nie może wskazywać pokoju.";
    static final String WRONG_GAME = "Nieprawidłowy identyfikator meczu.";
    static final String WRONG_PATH = "Nieprawidłowy adres strony.";
    static final String DUPLICATE = "To zgłoszenie już do nas trafiło. Nie musisz wysyłać go ponownie.";
    static final String NOT_FOUND = "Nie znaleziono zgłoszenia.";

    private static final Pattern GAME_ID = Pattern.compile("[A-Za-z0-9-]{1,64}");
    private static final Pattern PAGE_PATH = Pattern.compile("/[A-Za-z0-9/_.~%-]*");

    private final BugReportRepository reports;
    private final RoomRepository rooms;
    private final UserRepository users;
    private final BugReportProperties limits;
    private final Clock clock;

    @Transactional
    public void submit(Long reporterId, BugReportRequest request) {
        String description = description(request.description());
        if (request.source() == null) throw new IllegalArgumentException(MISSING_SOURCE);
        BugReport report = new BugReport();
        report.setSource(request.source());
        if (request.source() == BugReportSource.ROOM) {
            if (request.roomId() == null || !rooms.existsById(request.roomId())) throw new IllegalArgumentException(MISSING_ROOM);
            if (request.taskId() != null && !reports.taskBelongsToRoom(request.taskId(), request.roomId())) {
                throw new IllegalArgumentException(WRONG_TASK);
            }
            if (request.gameId() != null) throw new IllegalArgumentException(WRONG_GAME);
            report.setRoomId(request.roomId());
            report.setTaskId(request.taskId());
        } else {
            if (request.roomId() != null || request.taskId() != null) throw new IllegalArgumentException(ROOM_IN_ARENA);
            if (request.gameId() != null && !GAME_ID.matcher(request.gameId()).matches()) throw new IllegalArgumentException(WRONG_GAME);
            report.setGameId(request.gameId());
        }
        report.setPagePath(pagePath(request.pagePath()));
        reports.lockReporter(reporterId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        LocalDateTime now = LocalDateTime.now(clock);
        long wait = Math.max(waitFor(reporterId, limits.hourlyLimit(), HOUR, now), waitFor(reporterId, limits.dailyLimit(), DAY, now));
        if (wait > 0) throw new BugReportLimitException(wait);
        if (reports.existsByReporterIdAndDescriptionAndCreatedAtAfter(reporterId, description, now.minus(DAY))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, DUPLICATE);
        }
        report.setReporter(users.getReferenceById(reporterId));
        report.setDescription(description);
        report.setCreatedAt(now);
        reports.save(report);
    }

    @Transactional(readOnly = true)
    public Slice<BugReportView> page(int page, int size, String status) {
        var request = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(100, size)));
        String filter = status == null ? "" : status.strip().toUpperCase(Locale.ROOT);
        if (filter.isEmpty()) return reports.findViews(request);
        return reports.findViewsByStatus(status(filter), request);
    }

    @Transactional
    public BugReportView updateStatus(Long id, String status) {
        BugReportStatus next = status(status == null ? "" : status.strip().toUpperCase(Locale.ROOT));
        BugReport report = reports.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, NOT_FOUND));
        if (report.getStatus() != next) {
            report.setStatus(next);
            report.setResolvedAt(next == BugReportStatus.RESOLVED ? LocalDateTime.now(clock) : null);
            reports.saveAndFlush(report);
        }
        return reports.findView(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, NOT_FOUND));
    }

    @Transactional
    public void delete(Long id) {
        if (!reports.existsById(id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, NOT_FOUND);
        reports.deleteById(id);
    }

    private long waitFor(Long reporterId, int limit, Duration window, LocalDateTime now) {
        return reports.findRecentTimes(reporterId, PageRequest.of(limit - 1, 1)).stream()
                .map(sent -> Duration.between(now, sent.plus(window)).toMillis())
                .filter(millis -> millis > 0)
                .map(millis -> (millis + 999) / 1000)
                .findFirst()
                .orElse(0L);
    }

    private static String description(String value) {
        String text = value == null ? "" : value.replace("\u0000", "").strip();
        int length = text.codePointCount(0, text.length());
        if (length < MIN_LENGTH) throw new IllegalArgumentException(TOO_SHORT);
        if (length > MAX_LENGTH) throw new IllegalArgumentException(TOO_LONG);
        return text;
    }

    private static String pagePath(String value) {
        if (value == null || value.isEmpty()) return null;
        if (value.length() > MAX_PATH_LENGTH || !PAGE_PATH.matcher(value).matches()) throw new IllegalArgumentException(WRONG_PATH);
        return value;
    }

    private static BugReportStatus status(String value) {
        try {
            return BugReportStatus.valueOf(value);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Nieznany status zgłoszenia: " + value);
        }
    }
}
