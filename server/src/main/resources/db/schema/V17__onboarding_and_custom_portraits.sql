ALTER TABLE users ADD COLUMN avatar_confirmed_at timestamp(6);
ALTER TABLE users ADD COLUMN tour_status varchar(16) NOT NULL DEFAULT 'PENDING';
UPDATE users SET avatar_confirmed_at = now(), tour_status = 'COMPLETED';
ALTER TABLE users ADD CONSTRAINT ck_users_tour_status CHECK (tour_status IN ('PENDING', 'COMPLETED', 'SKIPPED'));
ALTER TABLE users DROP COLUMN avatar_seed;
