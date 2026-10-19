CREATE TABLE account_deletions (
    user_id BIGINT PRIMARY KEY,
    clerk_user_id VARCHAR(64) UNIQUE
);
