CREATE TABLE IF NOT EXISTS room_tasks (
    id BIGSERIAL PRIMARY KEY,
    room_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    question TEXT,
    answer VARCHAR(255),
    sort_order INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT fk_task_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_completed_tasks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    task_id BIGINT NOT NULL,
    completed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, task_id),
    CONSTRAINT fk_uct_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_uct_task FOREIGN KEY (task_id) REFERENCES room_tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_room_tasks_room ON room_tasks(room_id);
CREATE INDEX IF NOT EXISTS idx_uct_user ON user_completed_tasks(user_id);
