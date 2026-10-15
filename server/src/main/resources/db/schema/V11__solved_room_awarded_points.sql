-- XP actually granted for the solve (room points minus hint penalties). NULL for solves recorded before this column.
ALTER TABLE user_solved_rooms ADD COLUMN awarded_points INTEGER;
