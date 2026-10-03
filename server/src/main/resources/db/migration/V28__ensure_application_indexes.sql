CREATE INDEX IF NOT EXISTS idx_path_rooms_path_sort ON path_rooms(path_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_path_enrollments_user ON path_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_path_enrollments_path ON path_enrollments(path_id);
CREATE INDEX IF NOT EXISTS idx_room_tasks_room ON room_tasks(room_id);
CREATE INDEX IF NOT EXISTS idx_uct_user ON user_completed_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_solved_rooms_user_solved_at ON user_solved_rooms(user_id, solved_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_solved_rooms_user_room ON user_solved_rooms(user_id, room_id);
CREATE INDEX IF NOT EXISTS idx_users_points_desc ON users(points DESC);
CREATE INDEX IF NOT EXISTS idx_users_elo_desc ON users(elo DESC);
