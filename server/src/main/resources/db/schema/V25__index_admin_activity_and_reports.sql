CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_solved_rooms_time ON user_solved_rooms(solved_at DESC, id DESC);
CREATE INDEX idx_reported_chat_time ON chat_messages(sent_at DESC, id DESC) WHERE reported = true;
