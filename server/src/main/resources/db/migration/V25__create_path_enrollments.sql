CREATE TABLE IF NOT EXISTS path_enrollments (
    user_id     BIGINT NOT NULL,
    path_id     BIGINT NOT NULL,
    enrolled_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, path_id),
    CONSTRAINT fk_pe_user FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE CASCADE,
    CONSTRAINT fk_pe_path FOREIGN KEY (path_id) REFERENCES paths(id)  ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_path_enrollments_user ON path_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_path_enrollments_path ON path_enrollments(path_id);
