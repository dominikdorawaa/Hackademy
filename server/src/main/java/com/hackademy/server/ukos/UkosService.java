package com.hackademy.server.ukos;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class UkosService {
    public static final int STEPS = 15;
    private final JdbcTemplate jdbc;

    public record State(int completedSteps) {}

    @Transactional
    public State state(String username) {
        return read(lock(username));
    }

    @Transactional
    public State progress(String username, int completedSteps) {
        if (completedSteps < 0 || completedSteps > STEPS) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        long user = lock(username);
        jdbc.update("UPDATE ukos_lab_progress SET completed_steps = GREATEST(completed_steps, ?) WHERE user_id = ?", completedSteps, user);
        return read(user);
    }

    private long lock(String username) {
        var ids = jdbc.queryForList("SELECT id FROM users WHERE username = ? FOR UPDATE", Long.class, username);
        if (ids.isEmpty()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        long user = ids.get(0);
        jdbc.update("INSERT INTO ukos_lab_progress (user_id) VALUES (?) ON CONFLICT DO NOTHING", user);
        return user;
    }

    private State read(long user) {
        return new State(jdbc.queryForObject("SELECT completed_steps FROM ukos_lab_progress WHERE user_id = ?", Integer.class, user));
    }
}
