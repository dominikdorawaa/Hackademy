CREATE TABLE IF NOT EXISTS paths (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS path_rooms (
    path_id BIGINT NOT NULL,
    room_id BIGINT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (path_id, room_id),
    CONSTRAINT fk_path_rooms_path FOREIGN KEY (path_id) REFERENCES paths(id) ON DELETE CASCADE,
    CONSTRAINT fk_path_rooms_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_path_rooms_path_sort ON path_rooms(path_id, sort_order);

