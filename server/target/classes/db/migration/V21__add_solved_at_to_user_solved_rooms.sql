ALTER TABLE user_solved_rooms ADD COLUMN solved_at TIMESTAMP DEFAULT NOW();
ALTER TABLE user_solved_rooms ALTER COLUMN solved_at SET NOT NULL;
