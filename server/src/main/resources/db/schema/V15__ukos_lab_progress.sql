CREATE TABLE ukos_lab_progress (
    user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    completed_steps integer NOT NULL DEFAULT 0 CHECK (completed_steps BETWEEN 0 AND 15)
);
