
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('USER', 'ADMIN', 'EXPERT'));

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'rooms' AND column_name = 'solutions_count'
    ) THEN
        ALTER TABLE rooms ADD COLUMN solutions_count INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'rooms' AND column_name = 'flag'
    ) THEN
        ALTER TABLE rooms ADD COLUMN flag VARCHAR(255);
        UPDATE rooms SET flag = 'hackademy{default_flag}' WHERE flag IS NULL;
        ALTER TABLE rooms ALTER COLUMN flag SET NOT NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_solved_rooms (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    room_id BIGINT NOT NULL,
    UNIQUE (user_id, room_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'rooms' AND column_name = 'short_description'
    ) THEN
        ALTER TABLE rooms ADD COLUMN short_description VARCHAR(255);
        UPDATE rooms
        SET short_description = SUBSTRING(description, 1, 100)
        WHERE short_description IS NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS hints (
    id BIGSERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    room_id BIGINT NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_unlocked_hints (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    hint_id BIGINT NOT NULL,
    UNIQUE (user_id, hint_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (hint_id) REFERENCES hints(id) ON DELETE CASCADE
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'streak'
    ) THEN
        ALTER TABLE users ADD COLUMN streak INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'last_solved_date'
    ) THEN
        ALTER TABLE users ADD COLUMN last_solved_date DATE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'bio'
    ) THEN
        ALTER TABLE users ADD COLUMN bio TEXT;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS friendships (
    id BIGSERIAL PRIMARY KEY,
    requester_id BIGINT NOT NULL,
    receiver_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (requester_id, receiver_id),
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS badges (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL,
    icon VARCHAR(255) NOT NULL,
    condition_type VARCHAR(50),
    condition_value INTEGER
);

CREATE TABLE IF NOT EXISTS user_badges (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    badge_id BIGINT NOT NULL,
    earned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, badge_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE
);

INSERT INTO badges (name, description, icon, condition_type, condition_value)
VALUES
    ('Hello World', 'Rozwiąż pierwsze zadanie', 'fas fa-globe', 'SOLVED_COUNT', 1),
    ('Script Kiddie', 'Zdobądź 100 punktów', 'fas fa-baby', 'POINTS', 100),
    ('Hacker', 'Zdobądź 1000 punktów', 'fas fa-user-secret', 'POINTS', 1000),
    ('Elite', 'Zdobądź 5000 punktów', 'fas fa-crown', 'POINTS', 5000),
    ('Streak Novice', 'Utrzymaj passę przez 3 dni', 'fas fa-fire', 'STREAK', 3),
    ('Streak Master', 'Utrzymaj passę przez 7 dni', 'fas fa-fire-alt', 'STREAK', 7),
    ('Social Butterfly', 'Dodaj pierwszego znajomego', 'fas fa-users', 'FRIENDS_COUNT', 1)
ON CONFLICT (name) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'friendships' AND column_name = 'requester_wins'
    ) THEN
        ALTER TABLE friendships ADD COLUMN requester_wins INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'friendships' AND column_name = 'receiver_wins'
    ) THEN
        ALTER TABLE friendships ADD COLUMN receiver_wins INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    game_id VARCHAR(255) NOT NULL,
    sender_id BIGINT NOT NULL,
    sender_username VARCHAR(255) NOT NULL,
    content VARCHAR(500) NOT NULL,
    reported BOOLEAN NOT NULL DEFAULT FALSE,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'chat_messages' AND column_name = 'reported'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN reported BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'muted_until'
    ) THEN
        ALTER TABLE users ADD COLUMN muted_until TIMESTAMP;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'rooms' AND column_name = 'category'
    ) THEN
        ALTER TABLE rooms ADD COLUMN category VARCHAR(50);
        UPDATE rooms SET category = 'Web' WHERE category IS NULL;
        ALTER TABLE rooms ALTER COLUMN category SET NOT NULL;
    END IF;
END $$;
