-- Performance indexes for frequent dashboard queries.
-- Safe for repeated runs via IF NOT EXISTS.

-- Recent solved rooms (ordered by solved_at) + existence checks by user_id.
CREATE INDEX IF NOT EXISTS idx_user_solved_rooms_user_solved_at
    ON user_solved_rooms(user_id, solved_at DESC);

-- Common existence checks: existsByUser_IdAndRoom_Id
CREATE INDEX IF NOT EXISTS idx_user_solved_rooms_user_room
    ON user_solved_rooms(user_id, room_id);

-- Ranking (ORDER BY points / elo).
CREATE INDEX IF NOT EXISTS idx_users_points_desc
    ON users(points DESC);

CREATE INDEX IF NOT EXISTS idx_users_elo_desc
    ON users(elo DESC);

