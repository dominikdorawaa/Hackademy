CREATE TABLE IF NOT EXISTS user_weekly_active_time (
    user_id BIGINT NOT NULL,
    week_key VARCHAR(16) NOT NULL,
    seconds INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, week_key),
    CONSTRAINT fk_user_weekly_active_time_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);

