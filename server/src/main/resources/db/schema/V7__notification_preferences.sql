CREATE TABLE user_notification_preferences (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    friend_requests BOOLEAN NOT NULL DEFAULT TRUE,
    challenges BOOLEAN NOT NULL DEFAULT TRUE,
    match_found BOOLEAN NOT NULL DEFAULT TRUE,
    sound BOOLEAN NOT NULL DEFAULT FALSE,
    browser_notifications BOOLEAN NOT NULL DEFAULT FALSE
);
