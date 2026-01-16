package com.hackademy.server.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class DatabaseMigration implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    public DatabaseMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) throws Exception {
        System.out.println("Running database migrations...");
        
        try {
            // Migration 1: Update users role check constraint
            jdbcTemplate.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
            jdbcTemplate.execute("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('USER', 'ADMIN', 'EXPERT'))");

            // Migration 2: Add solutions_count column to rooms if missing
            jdbcTemplate.execute("DO $$ " +
                    "BEGIN " +
                    "    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='solutions_count') THEN " +
                    "        ALTER TABLE rooms ADD COLUMN solutions_count INTEGER NOT NULL DEFAULT 0; " +
                    "    END IF; " +
                    "END $$;");

            // Migration 3: Add flag column to rooms
            jdbcTemplate.execute("DO $$ " +
                    "BEGIN " +
                    "    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='flag') THEN " +
                    "        ALTER TABLE rooms ADD COLUMN flag VARCHAR(255); " +
                    "        UPDATE rooms SET flag = 'hackademy{default_flag}' WHERE flag IS NULL; " + 
                    "        ALTER TABLE rooms ALTER COLUMN flag SET NOT NULL; " +
                    "    END IF; " +
                    "END $$;");

            // Migration 4: RECREATE user_solved_rooms table (FORCE FIX)
            jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS user_solved_rooms (" +
                    "id BIGSERIAL PRIMARY KEY, " +
                    "user_id BIGINT NOT NULL, " +
                    "room_id BIGINT NOT NULL, " +
                    "UNIQUE (user_id, room_id), " +
                    "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, " +
                    "FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE" +
                    ")");

            // Migration 5: Add short_description column to rooms
            jdbcTemplate.execute("DO $$ " +
                    "BEGIN " +
                    "    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='short_description') THEN " +
                    "        ALTER TABLE rooms ADD COLUMN short_description VARCHAR(255); " +
                    "        UPDATE rooms SET short_description = SUBSTRING(description, 1, 100) WHERE short_description IS NULL; " +
                    "    END IF; " +
                    "END $$;");

            // Migration 6: Create hints table
            jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS hints (" +
                    "id BIGSERIAL PRIMARY KEY, " +
                    "description TEXT NOT NULL, " +
                    "room_id BIGINT NOT NULL, " +
                    "FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE" +
                    ")");

            // Migration 7: Create user_unlocked_hints table
            jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS user_unlocked_hints (" +
                    "id BIGSERIAL PRIMARY KEY, " +
                    "user_id BIGINT NOT NULL, " +
                    "hint_id BIGINT NOT NULL, " +
                    "UNIQUE (user_id, hint_id), " +
                    "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, " +
                    "FOREIGN KEY (hint_id) REFERENCES hints(id) ON DELETE CASCADE" +
                    ")");

            // Migration 8: Add streak and last_solved_date columns to users
            jdbcTemplate.execute("DO $$ " +
                    "BEGIN " +
                    "    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='streak') THEN " +
                    "        ALTER TABLE users ADD COLUMN streak INTEGER NOT NULL DEFAULT 0; " +
                    "    END IF; " +
                    "    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_solved_date') THEN " +
                    "        ALTER TABLE users ADD COLUMN last_solved_date DATE; " +
                    "    END IF; " +
                    "END $$;");

            // Migration 9: Add bio column to users
            jdbcTemplate.execute("DO $$ " +
                    "BEGIN " +
                    "    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='bio') THEN " +
                    "        ALTER TABLE users ADD COLUMN bio TEXT; " +
                    "    END IF; " +
                    "END $$;");

            // Migration 10: Create friendships table
            jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS friendships (" +
                    "id BIGSERIAL PRIMARY KEY, " +
                    "requester_id BIGINT NOT NULL, " +
                    "receiver_id BIGINT NOT NULL, " +
                    "status VARCHAR(20) NOT NULL, " +
                    "created_at TIMESTAMP NOT NULL DEFAULT NOW(), " +
                    "UNIQUE (requester_id, receiver_id), " +
                    "FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE, " +
                    "FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE" +
                    ")");

            // Migration 11: Create badges and user_badges tables
            jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS badges (" +
                    "id BIGSERIAL PRIMARY KEY, " +
                    "name VARCHAR(255) NOT NULL UNIQUE, " +
                    "description VARCHAR(255) NOT NULL, " +
                    "icon VARCHAR(255) NOT NULL, " +
                    "condition_type VARCHAR(50), " +
                    "condition_value INTEGER" +
                    ")");

            jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS user_badges (" +
                    "id BIGSERIAL PRIMARY KEY, " +
                    "user_id BIGINT NOT NULL, " +
                    "badge_id BIGINT NOT NULL, " +
                    "earned_at TIMESTAMP NOT NULL DEFAULT NOW(), " +
                    "UNIQUE (user_id, badge_id), " +
                    "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, " +
                    "FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE" +
                    ")");

            // Seed Badges
            String[] badges = {
                "('Hello World', 'Rozwiąż pierwsze zadanie', 'fas fa-globe', 'SOLVED_COUNT', 1)",
                "('Script Kiddie', 'Zdobądź 100 punktów', 'fas fa-baby', 'POINTS', 100)",
                "('Hacker', 'Zdobądź 1000 punktów', 'fas fa-user-secret', 'POINTS', 1000)",
                "('Elite', 'Zdobądź 5000 punktów', 'fas fa-crown', 'POINTS', 5000)",
                "('Streak Novice', 'Utrzymaj passę przez 3 dni', 'fas fa-fire', 'STREAK', 3)",
                "('Streak Master', 'Utrzymaj passę przez 7 dni', 'fas fa-fire-alt', 'STREAK', 7)",
                "('Social Butterfly', 'Dodaj pierwszego znajomego', 'fas fa-users', 'FRIENDS_COUNT', 1)"
            };

            for (String badge : badges) {
                jdbcTemplate.execute("INSERT INTO badges (name, description, icon, condition_type, condition_value) VALUES " + badge + " ON CONFLICT (name) DO NOTHING");
            }

            // Migration 12: Add wins columns to friendships
            System.out.println("Migration 12: Adding wins columns to friendships...");
            jdbcTemplate.execute("DO $$ " +
                    "BEGIN " +
                    "    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='friendships' AND column_name='requester_wins') THEN " +
                    "        ALTER TABLE friendships ADD COLUMN requester_wins INTEGER NOT NULL DEFAULT 0; " +
                    "    END IF; " +
                    "    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='friendships' AND column_name='receiver_wins') THEN " +
                    "        ALTER TABLE friendships ADD COLUMN receiver_wins INTEGER NOT NULL DEFAULT 0; " +
                    "    END IF; " +
                    "END $$;");
            System.out.println("Migration 12 completed.");

            System.out.println("All migrations completed successfully.");

        } catch (Exception e) {
            System.err.println("Migration failed: " + e.getMessage());
        }
    }
}
