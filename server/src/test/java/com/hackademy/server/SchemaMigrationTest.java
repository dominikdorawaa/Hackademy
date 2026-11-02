package com.hackademy.server;

import com.hackademy.server.clerk.ClerkUserResolver;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Testcontainers
class SchemaMigrationTest {
    static final int SCHEMA_VERSION = 39;
    @Container
    private static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17.11-alpine");

    private String schema;
    private String url;
    private String username;
    private String password;

    @BeforeEach
    void createSchema() throws Exception {
        schema = "schema_test_" + UUID.randomUUID().toString().replace("-", "");
        username = postgres.getUsername();
        password = postgres.getPassword();
        var baseUrl = postgres.getJdbcUrl();
        try (var connection = connect(baseUrl);
             var statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA " + schema);
        }
        url = baseUrl + (baseUrl.contains("?") ? "&" : "?") + "currentSchema=" + schema;
    }

    @AfterEach
    void dropSchema() throws Exception {
        if (schema == null) {
            return;
        }
        try (var connection = connect(postgres.getJdbcUrl());
             var statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA " + schema + " CASCADE");
        }
    }

    @Test
    void migratesEmptyDatabaseWithBadgesOnly() throws Exception {
        var flyway = flyway();
        assertEquals(SCHEMA_VERSION, flyway.migrate().migrationsExecuted);
        assertEquals(7, scalar("SELECT count(*) FROM badges"));
        assertEquals(0, scalar("SELECT count(*) FROM users"));
        assertEquals(0, scalar("SELECT count(*) FROM rooms"));
        assertEquals("ukos", text("SELECT system_key FROM paths"));
        assertEquals(0, flyway.migrate().migrationsExecuted);
        assertTrue(flyway.validateWithResult().validationSuccessful);
    }

    @Test
    void addsClerkIdentityAfterNotificationMigrationsWithoutChangingExistingAccounts() throws Exception {
        flyway("20").migrate();
        insertUser(1, "Alice", "alice@example.com");
        execute("INSERT INTO user_notification_preferences (user_id, sound, friend_online, friend_online_bell) VALUES (1, false, false, false)");

        assertEquals(SCHEMA_VERSION - 20, flyway().migrate().migrationsExecuted);
        assertEquals(String.valueOf(SCHEMA_VERSION), text("SELECT version FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1"));
        assertEquals("clerk identity", text("SELECT description FROM flyway_schema_history WHERE version = '21'"));
        assertEquals(1, scalar("SELECT count(*) FROM users WHERE id = 1 AND username = 'Alice' AND email = 'alice@example.com' AND password = 'p' AND clerk_user_id IS NULL"));
        assertEquals(1, scalar("SELECT count(*) FROM user_notification_preferences WHERE user_id = 1 AND NOT sound AND NOT friend_online AND NOT friend_online_bell AND game_sounds"));
        execute("UPDATE users SET clerk_user_id = 'user_alice', password = NULL WHERE id = 1");
        assertEquals(0, flyway().migrate().migrationsExecuted);
        assertTrue(flyway().validateWithResult().validationSuccessful);
    }

    @Test
    void deletionBlocksSurviveUserRemovalAndIdentityCannotBeReassigned() throws Exception {
        flyway("21").migrate();
        insertUser(1, "Alice", "alice@example.com");
        assertEquals(SCHEMA_VERSION - 21, flyway().migrate().migrationsExecuted);
        execute("INSERT INTO account_deletions (user_id, clerk_user_id) VALUES (1, 'user_alice')");
        execute("DELETE FROM users WHERE id = 1");
        assertEquals("user_alice", text("SELECT clerk_user_id FROM account_deletions WHERE user_id = 1"));
        assertSqlState("23505", "INSERT INTO account_deletions (user_id, clerk_user_id) VALUES (2, 'user_alice')");
        assertEquals(0, flyway().migrate().migrationsExecuted);
    }

    @Test
    void preservesExistingProfileWhenAddingPersonalization() throws Exception {
        Flyway.configure().dataSource(url, username, password)
                .locations("classpath:db/schema").target("5").load().migrate();
        execute("INSERT INTO users (id, username, email, password, role, points, streak, bio, created_at, updated_at) VALUES (1, 'Alice', 'alice@example.com', 'p', 'USER', 0, 0, 'Learning Linux', now(), now())");
        assertEquals(11, flyway("16").migrate().migrationsExecuted);
        assertEquals("Alice", text("SELECT avatar_seed FROM users WHERE id = 1"));
        assertEquals(SCHEMA_VERSION - 16, flyway().migrate().migrationsExecuted);
        assertEquals(0, scalar("SELECT count(*) FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar_seed'"));
        assertEquals("COMPLETED", text("SELECT tour_status FROM users WHERE id = 1"));
        assertEquals(1, scalar("SELECT count(*) FROM users WHERE id = 1 AND avatar_confirmed_at IS NOT NULL"));
        assertEquals("Learning Linux", text("SELECT bio FROM users WHERE id = 1"));
        assertEquals("", text("SELECT tagline FROM users WHERE id = 1"));
        assertEquals(0, scalar("SELECT count(*) FROM user_profile_interests"));
        assertEquals(0, scalar("SELECT count(*) FROM user_featured_badges"));
        assertEquals(0, flyway().migrate().migrationsExecuted);
    }

    @Test
    void splitsArenaAnswersIntoTheCorrectOneAndThreeWrongOnes() throws Exception {
        flyway("26").migrate();
        execute("""
                DELETE FROM arena_questions;
                INSERT INTO arena_questions (id, content, answer_a, answer_b, answer_c, answer_d, correct_answer, category, difficulty, version) VALUES
                (1, 'Pierwsza', 'P', 'X1', 'X2', 'X3', 0, 'WEB', 'EASY', 4),
                (2, 'Druga', 'X1', 'P', 'X2', 'X3', 1, 'SIECI', 'MEDIUM', 0),
                (3, 'Trzecia', 'X1', 'X2', 'P', 'X3', 2, 'LINUX', 'HARD', 0),
                (4, 'Czwarta', 'X1', 'X2', 'X3', 'P', 3, 'OGOLNE', 'EASY', 0);
                """);
        assertEquals(1, flyway("27").migrate().migrationsExecuted);
        assertEquals(4, scalar("""
                SELECT count(*) FROM arena_questions
                WHERE correct_answer = 'P' AND wrong_answer_1 = 'X1' AND wrong_answer_2 = 'X2' AND wrong_answer_3 = 'X3'
                """));
        assertEquals("1:Pierwsza:WEB:EASY:4", text("SELECT id || ':' || content || ':' || category || ':' || difficulty || ':' || version FROM arena_questions WHERE id = 1"));
        assertEquals(0, scalar("""
                SELECT count(*) FROM information_schema.columns WHERE table_schema = current_schema()
                AND table_name = 'arena_questions' AND column_name IN ('answer_a', 'answer_b', 'answer_c', 'answer_d', 'correct_answer_text')
                """));
        assertEquals("character varying", text("""
                SELECT data_type FROM information_schema.columns WHERE table_schema = current_schema()
                AND table_name = 'arena_questions' AND column_name = 'correct_answer'
                """));
        assertSqlState("23502", "INSERT INTO arena_questions (content, correct_answer, wrong_answer_1, wrong_answer_2, category, difficulty) VALUES ('Brak', 'P', 'X1', 'X2', 'WEB', 'EASY')");
    }

    @Test
    void keepsTheSeededArenaAnswersWhenSplittingThem() throws Exception {
        flyway("27").migrate();
        assertEquals(42, scalar("SELECT count(*) FROM arena_questions"));
        assertEquals("Podatnością nieznaną producentowi i bez dostępnej poprawki", text("SELECT correct_answer FROM arena_questions WHERE content = 'Czym jest podatność zero-day?'"));
        assertEquals("Podatnością naprawioną w dniu zgłoszenia|Podatnością dotyczącą tylko starych systemów|Podatnością, której nie da się wykorzystać",
                text("SELECT wrong_answer_1 || '|' || wrong_answer_2 || '|' || wrong_answer_3 FROM arena_questions WHERE content = 'Czym jest podatność zero-day?'"));
        assertEquals("Na którym porcie domyślnie działa HTTPS?:443:80|8080|25", text("SELECT content || ':' || correct_answer || ':' || wrong_answer_1 || '|' || wrong_answer_2 || '|' || wrong_answer_3 FROM arena_questions WHERE content = 'Na którym porcie domyślnie działa HTTPS?'"));
    }

    @Test
    void spreadsArenaQuestionsOverFiveDifficultyLevels() throws Exception {
        flyway("27").migrate();
        execute("UPDATE arena_questions SET difficulty = 'MEDIUM' WHERE content = 'Czym jest phishing?'");
        assertSqlState("23514", "UPDATE arena_questions SET difficulty = 'VERY_EASY' WHERE content = 'Czym jest OSINT?'");
        assertEquals(1, flyway("28").migrate().migrationsExecuted);
        assertEquals("EASY:19,HARD:3,MEDIUM:15,VERY_EASY:4,VERY_HARD:1", text("""
                SELECT string_agg(difficulty || ':' || total, ',' ORDER BY difficulty)
                FROM (SELECT difficulty, count(*) AS total FROM arena_questions GROUP BY difficulty) levels
                """));
        assertEquals("MEDIUM", text("SELECT difficulty FROM arena_questions WHERE content = 'Czym jest phishing?'"));
        assertEquals("VERY_EASY", text("SELECT difficulty FROM arena_questions WHERE content = 'Które polecenie wyświetla bieżący katalog?'"));
        assertEquals("VERY_HARD", text("SELECT difficulty FROM arena_questions WHERE content = 'Czym jest SSRF?'"));
        assertEquals("HARD", text("SELECT difficulty FROM arena_questions WHERE content = 'Dlaczego MD5 nie nadaje się do przechowywania haseł?'"));
        execute("UPDATE arena_questions SET difficulty = 'VERY_EASY' WHERE content = 'Czym jest OSINT?'");
        assertSqlState("23514", "UPDATE arena_questions SET difficulty = 'INSANE' WHERE content = 'Czym jest OSINT?'");
    }

    @Test
    void extendsTheArenaBankWithoutOverwritingAdminEdits() throws Exception {
        flyway("32").migrate();
        long previousMax = scalar("SELECT max(id) FROM arena_questions");
        execute("UPDATE arena_questions SET correct_answer = 'Własna odpowiedź administratora', version = 1 WHERE content = 'Co umożliwia ARP spoofing w sieci lokalnej?'");

        assertEquals(1, flyway("33").migrate().migrationsExecuted);
        assertEquals(342, scalar("SELECT count(*) FROM arena_questions"));
        assertEquals(300, scalar("SELECT count(*) FROM arena_questions WHERE id > " + previousMax));
        assertEquals("EASY:60,HARD:60,MEDIUM:60,VERY_EASY:60,VERY_HARD:60", text("""
                SELECT string_agg(difficulty || ':' || total, ',' ORDER BY difficulty)
                FROM (SELECT difficulty, count(*) AS total FROM arena_questions WHERE id > %d GROUP BY difficulty) levels
                """.formatted(previousMax)));
        assertEquals("BLUE_TEAM,CHMURA,KRYPTOGRAFIA,LINUX,OGOLNE,SIECI,WEB,WINDOWS", text("""
                SELECT string_agg(category, ',' ORDER BY category)
                FROM (SELECT DISTINCT category FROM arena_questions) categories
                """));
        assertEquals(0, scalar("""
                SELECT count(*) FROM (
                    SELECT lower(trim(content)) FROM arena_questions GROUP BY lower(trim(content)) HAVING count(*) > 1
                ) duplicates
                """));
        assertEquals(0, scalar("""
                SELECT count(*) FROM arena_questions
                WHERE length(trim(content)) = 0 OR length(content) > 500
                    OR EXISTS (SELECT 1 FROM unnest(ARRAY[correct_answer, wrong_answer_1, wrong_answer_2, wrong_answer_3]) answer
                               WHERE length(trim(answer)) = 0 OR length(answer) > 200)
                    OR (SELECT count(DISTINCT lower(trim(answer)))
                        FROM unnest(ARRAY[correct_answer, wrong_answer_1, wrong_answer_2, wrong_answer_3]) answer) <> 4
                """));
        assertEquals(0, scalar("""
                SELECT count(*) FROM arena_questions
                WHERE greatest(length(correct_answer), length(wrong_answer_1), length(wrong_answer_2), length(wrong_answer_3))
                    - least(length(correct_answer), length(wrong_answer_1), length(wrong_answer_2), length(wrong_answer_3)) > 25
                """));
        long correctIsLongest = scalar("""
                SELECT count(*) FROM arena_questions WHERE id > %d
                    AND length(correct_answer) > greatest(length(wrong_answer_1), length(wrong_answer_2), length(wrong_answer_3))
                """.formatted(previousMax));
        assertTrue(correctIsLongest <= 75, "Correct answer uniquely longest in " + correctIsLongest + " of 300 questions");
        assertEquals(0, scalar("""
                SELECT count(*) FROM (
                    SELECT abs(avg(length(correct_answer))
                        - avg((length(wrong_answer_1) + length(wrong_answer_2) + length(wrong_answer_3)) / 3.0)) AS gap
                    FROM arena_questions WHERE id > %d
                ) lengths WHERE gap > 3
                """.formatted(previousMax)));
        assertEquals("Własna odpowiedź administratora:1", text("SELECT correct_answer || ':' || version FROM arena_questions WHERE content = 'Co umożliwia ARP spoofing w sieci lokalnej?'"));
        assertEquals("MEDIUM:1", text("SELECT difficulty || ':' || version FROM arena_questions WHERE content = 'Czym jest SSRF?'"));
        assertTrue(text("SELECT correct_answer FROM arena_questions WHERE content = 'Dlaczego MD5 nie nadaje się do przechowywania haseł?'").contains("zgadywania"));
        assertTrue(text("SELECT correct_answer FROM arena_questions WHERE content = 'Co łączy uwierzytelnianie dwuskładnikowe (2FA)?'").contains("różnych rodzajów"));
        assertSqlState("23514", "UPDATE arena_questions SET category = 'WINDOWS_AD' WHERE id = 1");
        assertEquals(0, flyway("33").migrate().migrationsExecuted);
        assertTrue(flyway("33").validateWithResult().validationSuccessful);
    }

    @Test
    void compactsTheBankAndAddsShortOffensiveQuestions() throws Exception {
        flyway("33").migrate();
        long previousMax = scalar("SELECT max(id) FROM arena_questions");
        String previousLevels = text("""
                SELECT string_agg(id || ':' || category || ':' || difficulty, ',' ORDER BY id) FROM arena_questions
                """);
        String previousVersions = text("SELECT string_agg(id || ':' || (version + 1), ',' ORDER BY id) FROM arena_questions");

        assertEquals(1, flyway("34").migrate().migrationsExecuted);
        assertEquals(382, scalar("SELECT count(*) FROM arena_questions"));
        assertEquals(previousLevels, text("""
                SELECT string_agg(id || ':' || category || ':' || difficulty, ',' ORDER BY id)
                FROM arena_questions WHERE id <= %d
                """.formatted(previousMax)));
        assertEquals(previousVersions, text("""
                SELECT string_agg(id || ':' || version, ',' ORDER BY id) FROM arena_questions WHERE id <= %d
                """.formatted(previousMax)));
        assertEquals(40, scalar("SELECT count(*) FROM arena_questions WHERE id > " + previousMax));
        assertEquals("EASY:8,HARD:8,MEDIUM:8,VERY_EASY:8,VERY_HARD:8", text("""
                SELECT string_agg(difficulty || ':' || total, ',' ORDER BY difficulty)
                FROM (SELECT difficulty, count(*) AS total FROM arena_questions WHERE id > %d GROUP BY difficulty) levels
                """.formatted(previousMax)));
        assertEquals("LINUX:10,SIECI:5,WEB:15,WINDOWS:10", text("""
                SELECT string_agg(category || ':' || total, ',' ORDER BY category)
                FROM (SELECT category, count(*) AS total FROM arena_questions WHERE id > %d GROUP BY category) categories
                """.formatted(previousMax)));
        assertEquals(0, scalar("""
                SELECT count(*) FROM arena_questions
                WHERE length(trim(content)) = 0 OR length(content) > 120
                    OR EXISTS (SELECT 1 FROM unnest(ARRAY[correct_answer, wrong_answer_1, wrong_answer_2, wrong_answer_3]) answer
                               WHERE length(trim(answer)) = 0 OR length(answer) > 50)
                    OR (SELECT count(DISTINCT lower(trim(answer)))
                        FROM unnest(ARRAY[correct_answer, wrong_answer_1, wrong_answer_2, wrong_answer_3]) answer) <> 4
                    OR greatest(length(correct_answer), length(wrong_answer_1), length(wrong_answer_2), length(wrong_answer_3))
                        - least(length(correct_answer), length(wrong_answer_1), length(wrong_answer_2), length(wrong_answer_3)) > 20
                """));
        assertEquals(0, scalar("""
                SELECT count(*) FROM (
                    SELECT lower(trim(content)) FROM arena_questions GROUP BY lower(trim(content)) HAVING count(*) > 1
                ) duplicates
                """));
        assertTrue(scalar("SELECT round(avg(length(content))) FROM arena_questions") <= 65);
        assertTrue(scalar("""
                SELECT count(*) FROM arena_questions
                WHERE length(correct_answer) > greatest(length(wrong_answer_1), length(wrong_answer_2), length(wrong_answer_3))
                """) <= 95);
        assertEquals(0, scalar("""
                SELECT count(*) FROM (
                    SELECT abs(avg(length(correct_answer))
                        - avg((length(wrong_answer_1) + length(wrong_answer_2) + length(wrong_answer_3)) / 3.0)) AS gap,
                        avg((length(correct_answer) + length(wrong_answer_1) + length(wrong_answer_2) + length(wrong_answer_3)) / 4.0) AS mean
                    FROM arena_questions
                ) lengths WHERE gap > 3 OR mean > 30
                """));
        assertEquals("Brakiem kontroli dostępu do obiektu", text("SELECT correct_answer FROM arena_questions WHERE content = 'Czym jest IDOR?'"));
        assertEquals("Zbierania i korelacji logów", text("SELECT correct_answer FROM arena_questions WHERE content = 'Do czego służy SIEM?'"));
        assertEquals("Automatyzacja reakcji", text("SELECT correct_answer FROM arena_questions WHERE content = 'Co wyróżnia SOAR w obsłudze incydentów?'"));
        assertEquals("Fuzzingu ścieżek i parametrów", text("SELECT correct_answer FROM arena_questions WHERE content = 'Do czego służy ffuf w testach WWW?'"));
        assertEquals(0, flyway("34").migrate().migrationsExecuted);
        assertEquals(382, scalar("SELECT count(*) FROM arena_questions"));
        assertTrue(flyway("34").validateWithResult().validationSuccessful);
    }

    @Test
    void keepsNetworkLessonsAtTheirOriginalLevelsAndClarifiesPermissionQuestions() throws Exception {
        flyway().migrate();
        assertEquals(10, scalar("""
                SELECT count(*) FROM (VALUES
                    (89, 'Co wybiera trasę między podsieciami IP?', 'Router', 'VERY_EASY'),
                    (90, 'Który protokół synchronizuje zegary hostów?', 'NTP', 'VERY_EASY'),
                    (91, 'Nmap bez -sV pokazuje 22/tcp open ssh. Co potwierdza sam wynik?', 'Port TCP 22 jest otwarty', 'EASY'),
                    (92, 'Co oznacza odpowiedź DNS NXDOMAIN?', 'Nazwa nie istnieje', 'EASY'),
                    (93, 'Który filtr tcpdump wybierze ruch portu 53?', 'port 53', 'EASY'),
                    (99, 'Skan SYN otrzymał RST. Jaki jest zwykle stan portu?', 'Zamknięty', 'MEDIUM'),
                    (100, 'Co oznacza UDP open/filtered w nmap?', 'Brak rozstrzygającej odpowiedzi', 'MEDIUM'),
                    (101, 'Ile adresów hostów ma tradycyjna podsieć IPv4 /26?', '62', 'MEDIUM'),
                    (217, 'Jakie kontrole omija CAP_DAC_READ_SEARCH?', 'Kontrole odczytu i przejścia', 'HARD'),
                    (265, 'Co może zmienić posiadacz SERVICE_CHANGE_CONFIG?', 'Ścieżkę uruchamianej usługi', 'VERY_HARD')
                ) AS expected(id, content, correct_answer, difficulty)
                JOIN arena_questions q ON q.id = expected.id AND q.content = expected.content
                    AND q.correct_answer = expected.correct_answer AND q.difficulty = expected.difficulty
                """));
    }

    @Test
    void compactMigrationPreservesAdminEditsAndDeletedQuestions() throws Exception {
        flyway("33").migrate();
        execute("""
                UPDATE arena_questions SET content = 'Pytanie zmienione przez administratora' WHERE id = 1;
                UPDATE arena_questions SET correct_answer = 'Własna poprawna odpowiedź' WHERE id = 2;
                UPDATE arena_questions SET wrong_answer_1 = 'Własny wariant pierwszy' WHERE id = 3;
                UPDATE arena_questions SET wrong_answer_2 = 'Własny wariant drugi' WHERE id = 4;
                UPDATE arena_questions SET wrong_answer_3 = 'Własny wariant trzeci' WHERE id = 5;
                UPDATE arena_questions SET category = 'OGOLNE' WHERE id = 6;
                UPDATE arena_questions SET difficulty = 'EASY' WHERE id = 7;
                UPDATE arena_questions SET version = 8 WHERE id = 8;
                UPDATE arena_questions SET content = 'Nowy bank zmieniony przez admina', version = 3 WHERE id = 43;
                DELETE FROM arena_questions WHERE id = 44;
                INSERT INTO arena_questions (content, correct_answer, wrong_answer_1, wrong_answer_2, wrong_answer_3, category, difficulty)
                VALUES ('Własne pytanie administratora', 'Tak', 'Nie', 'Być może', 'Nie wiadomo', 'WEB', 'MEDIUM');
                """);
        String adminEdits = text("""
                SELECT json_agg(q ORDER BY id)::text FROM arena_questions q
                WHERE id <= 8 OR id = 43 OR content = 'Własne pytanie administratora'
                """);

        assertEquals(1, flyway("34").migrate().migrationsExecuted);
        assertEquals(adminEdits, text("""
                SELECT json_agg(q ORDER BY id)::text FROM arena_questions q
                WHERE id <= 8 OR id = 43 OR content = 'Własne pytanie administratora'
                """));
        assertEquals(0, scalar("SELECT count(*) FROM arena_questions WHERE id = 44"));
        assertEquals(382, scalar("SELECT count(*) FROM arena_questions"));
        assertEquals("Brakiem kontroli dostępu do obiektu", text("SELECT correct_answer FROM arena_questions WHERE id = 9"));
        assertEquals(0, flyway("34").migrate().migrationsExecuted);
    }

    @Test
    void sharesActivityOfExistingUsersUntilTheyHideIt() throws Exception {
        flyway("31").migrate();
        insertUser(1, "Alice", "alice@example.com");
        assertEquals(SCHEMA_VERSION - 31, flyway().migrate().migrationsExecuted);
        assertEquals(1, scalar("SELECT count(*) FROM users WHERE share_activity AND last_seen_at IS NULL"));
        execute("UPDATE users SET share_activity = false, last_seen_at = now() WHERE id = 1");
        assertEquals(1, scalar("SELECT count(*) FROM users WHERE NOT share_activity AND last_seen_at IS NOT NULL"));
        assertSqlState("23502", "UPDATE users SET share_activity = NULL WHERE id = 1");
        assertEquals(0, flyway().migrate().migrationsExecuted);
        assertTrue(flyway().validateWithResult().validationSuccessful);
    }

    @Test
    void addsLabReportsWithoutChangingExistingReports() throws Exception {
        flyway("30").migrate();
        insertUser(1, "Alice", "alice@example.com");
        execute("INSERT INTO bug_reports (reporter_id, source, game_id, page_path, description, created_at) VALUES (1, 'ARENA', 'game', '/arena', 'Mecz się zawiesił', now())");
        execute("INSERT INTO bug_reports (reporter_id, source, description, status, created_at, resolved_at) VALUES (1, 'ROOM', 'Nie działa podpowiedź', 'RESOLVED', now(), now())");
        assertEquals(1, flyway("31").migrate().migrationsExecuted);
        assertEquals(2, scalar("SELECT count(*) FROM bug_reports WHERE lesson_id IS NULL"));
        assertEquals(1, scalar("SELECT count(*) FROM bug_reports WHERE source = 'ARENA' AND game_id = 'game' AND page_path = '/arena' AND description = 'Mecz się zawiesił' AND status = 'OPEN'"));
        assertEquals(1, scalar("SELECT count(*) FROM bug_reports WHERE source = 'ROOM' AND description = 'Nie działa podpowiedź' AND status = 'RESOLVED' AND resolved_at IS NOT NULL"));
        execute("INSERT INTO bug_reports (reporter_id, source, lesson_id, page_path, description, created_at) VALUES (1, 'LAB', 'pwd', '/learn/ukos', 'Terminal nie działa', now())");
        assertEquals("pwd", text("SELECT lesson_id FROM bug_reports WHERE source = 'LAB'"));
        assertSqlState("23514", "INSERT INTO bug_reports (reporter_id, source, description, created_at) VALUES (1, 'CHAT', 'Nieznane źródło', now())");
        assertSqlState("23514", "INSERT INTO bug_reports (reporter_id, source, description, created_at) VALUES (1, 'LAB', 'Brak kroku laboratorium', now())");
        assertSqlState("23514", "UPDATE bug_reports SET lesson_id = 'pwd' WHERE source = 'ARENA'");
        assertEquals(0, flyway("31").migrate().migrationsExecuted);
        assertTrue(flyway("31").validateWithResult().validationSuccessful);
    }

    @Test
    void replacesChatReportsAndMutingWithBugReports() throws Exception {
        flyway("28").migrate();
        insertUser(1, "Alice", "alice@example.com");
        execute("UPDATE users SET muted_until = now() + interval '1 day' WHERE id = 1");
        execute("INSERT INTO chat_messages (game_id, sender_id, sender_username, content, reported, sent_at) VALUES ('g', 1, 'Alice', 'stara', true, now())");
        assertEquals(1, flyway("29").migrate().migrationsExecuted);
        assertEquals(0, scalar("""
                SELECT count(*) FROM information_schema.columns WHERE table_schema = current_schema()
                AND (table_name = 'chat_messages' OR (table_name = 'users' AND column_name = 'muted_until'))
                """));
        assertEquals(1, scalar("SELECT count(*) FROM users WHERE username = 'Alice'"));
        execute("INSERT INTO bug_reports (reporter_id, source, game_id, page_path, description, created_at) VALUES (1, 'ARENA', 'abc', '/arena', 'Mecz się zawiesił', now())");
        assertEquals("OPEN", text("SELECT status FROM bug_reports"));
        assertSqlState("23514", "INSERT INTO bug_reports (reporter_id, source, description, created_at) VALUES (1, 'CHAT', 'Opis problemu', now())");
        assertSqlState("23514", "INSERT INTO bug_reports (reporter_id, source, description, status, created_at) VALUES (1, 'ARENA', 'Opis problemu', 'CLOSED', now())");
        assertSqlState("23514", "INSERT INTO bug_reports (reporter_id, source, description, created_at) VALUES (1, 'ARENA', 'za krótko', now())");
        assertSqlState("23503", "INSERT INTO bug_reports (reporter_id, source, description, created_at) VALUES (99, 'ARENA', 'Opis problemu', now())");
        assertSqlState("23502", "INSERT INTO bug_reports (reporter_id, source, created_at) VALUES (1, 'ARENA', now())");
    }

    @Test
    void keepsExistingAvatarsAndGivesThemTheFrontPortraitPose() throws Exception {
        flyway("13").migrate();
        insertUser(1, "Alice", "alice@example.com");
        execute("INSERT INTO user_avatars (user_id, outfit, hair, hat, skin, hair_color, top_color, bottom_color, shoes_color, hat_color) VALUES (1, 'dres', 'kucyk', 'brak', 'heban', 'rude', 'bialy', 'granatowy', 'czerwony', 'bialy')");
        assertEquals(SCHEMA_VERSION - 13, flyway().migrate().migrationsExecuted);
        assertEquals("przod", text("SELECT pose FROM user_avatars WHERE user_id = 1"));
        assertEquals("kucyk", text("SELECT hair FROM user_avatars WHERE user_id = 1"));
        execute("UPDATE user_avatars SET pose = 'profil' WHERE user_id = 1");
        assertSqlState("23514", "UPDATE user_avatars SET pose = 'bokiem' WHERE user_id = 1");
        assertEquals("profil", text("SELECT pose FROM user_avatars WHERE user_id = 1"));
    }

    @Test
    void givesExistingAvatarsTheDefaultFinisherAndVictoryDance() throws Exception {
        flyway("29").migrate();
        insertUser(1, "Alice", "alice@example.com");
        execute("INSERT INTO user_avatars (user_id, outfit, hair, hat, skin, hair_color, top_color, bottom_color, shoes_color, hat_color) VALUES (1, 'dres', 'kucyk', 'brak', 'heban', 'rude', 'bialy', 'granatowy', 'czerwony', 'bialy')");
        assertEquals(SCHEMA_VERSION - 29, flyway().migrate().migrationsExecuted);
        assertEquals("beam", text("SELECT finisher FROM user_avatars WHERE user_id = 1"));
        assertEquals("groove", text("SELECT victory_dance FROM user_avatars WHERE user_id = 1"));
        execute("UPDATE user_avatars SET finisher = 'combo', victory_dance = 'scuba' WHERE user_id = 1");
        assertSqlState("23514", "UPDATE user_avatars SET finisher = 'kopniak' WHERE user_id = 1");
        assertSqlState("23514", "UPDATE user_avatars SET victory_dance = 'walc' WHERE user_id = 1");
        assertEquals("scuba", text("SELECT victory_dance FROM user_avatars WHERE user_id = 1"));
    }

    @Test
    void publishesExistingContentWithoutChangingPlayerProgress() throws Exception {
        Flyway.configure().dataSource(url, username, password).locations("classpath:db/schema").target("7").load().migrate();
        insertUser(1, "Alice", "alice@example.com");
        insertRoom(1);
        execute("INSERT INTO paths (id, title, created_at, updated_at) VALUES (1, 'Existing', now(), now())");
        execute("INSERT INTO user_solved_rooms (user_id, room_id, solved_at) VALUES (1, 1, now())");
        assertEquals(1, flyway("8").migrate().migrationsExecuted);
        assertEquals(1, scalar("SELECT count(*) FROM paths WHERE published"));
        assertEquals(1, scalar("SELECT count(*) FROM rooms WHERE published"));
        assertEquals(1, scalar("SELECT count(*) FROM user_solved_rooms WHERE user_id = 1 AND room_id = 1"));
    }

    @Test
    void scopesRoomTitlesAndDerivesCtfPointsFromDifficulty() throws Exception {
        flyway("8").migrate();
        execute("""
                INSERT INTO rooms (id, title, description, difficulty, category, points, flag, solutions_count, requires_vpn, room_type, created_at, updated_at) VALUES
                (1, 'Easy CTF', 'd', 'EASY', 'Web', 10, 'f', 0, false, 'CTF', now(), now()),
                (2, 'Hard CTF', 'd', 'HARD', 'Web', 999, 'f', 0, false, 'CTF', now(), now()),
                (3, 'Intro', 'd', 'MEDIUM', 'Path', 7, 'f', 0, false, 'PATH', now(), now()),
                (4, 'Other', 'd', 'EASY', 'Path', 5, 'f', 0, false, 'PATH', now(), now()),
                (7, ' Easy CTF ', 'd', 'EASY', 'Web', 50, 'f', 0, false, 'CTF', now(), now()),
                (8, '  Solo', 'd', 'EASY', 'Web', 50, 'f', 0, false, 'CTF', now(), now()),
                (9, 'Intro ', 'd', 'EASY', 'Path', 5, 'f', 0, false, 'PATH', now(), now()),
                (10, ' Loose', 'd', 'EASY', 'Path', 5, 'f', 0, false, 'PATH', now(), now()),
                (11, 'Loose', 'd', 'EASY', 'Path', 5, 'f', 0, false, 'PATH', now(), now()),
                (12, E'Tab\t', 'd', 'EASY', 'Path', 5, 'f', 0, false, 'PATH', now(), now());
                INSERT INTO users (id, username, email, password, role, points, streak, created_at, updated_at, avatar_seed) VALUES (1, 'Alice', 'alice@example.com', 'p', 'USER', 10, 0, now(), now(), 'seed');
                INSERT INTO user_solved_rooms (user_id, room_id, solved_at) VALUES (1, 1, now());
                INSERT INTO paths (id, title, created_at, updated_at) VALUES (1, 'Path', now(), now());
                INSERT INTO path_chapters (id, path_id, title, sort_order, created_at, updated_at) VALUES (1, 1, 'One', 0, now(), now()), (2, 1, 'Two', 1, now(), now());
                INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) VALUES (3, 1, 0), (4, 1, 1), (9, 1, 2);
                """);

        assertEquals(SCHEMA_VERSION - 8, flyway().migrate().migrationsExecuted);

        assertEquals("1:50,2:150,3:7,4:5", text("SELECT string_agg(id || ':' || points, ',' ORDER BY id) FROM rooms WHERE id <= 4"));
        assertEquals(10, scalar("SELECT points FROM users WHERE id = 1"));
        assertEquals("1:Easy CTF|7:Easy CTF (7)|8:Solo|9:Intro (9)|10:Loose|11:Loose|12:Tab", text("SELECT string_agg(id || ':' || title, '|' ORDER BY id) FROM rooms WHERE id IN (1, 7, 8, 9, 10, 11, 12)"));
        assertEquals("Intro,Other,Intro (9)", text("SELECT string_agg(room_title, ',' ORDER BY sort_order) FROM chapter_rooms WHERE chapter_id = 1"));
        assertSqlState("23514", "UPDATE rooms SET title = ' Padded' WHERE id = 8");
        assertSqlState("23514", "UPDATE rooms SET title = E'Padded\\n' WHERE id = 8");
        assertSqlState("23514", "UPDATE rooms SET points = 60 WHERE id = 1");
        assertSqlState("23514", "UPDATE rooms SET difficulty = 'INSANE' WHERE id = 1");
        execute("UPDATE rooms SET difficulty = 'INSANE', points = 200 WHERE id = 1");
        execute("INSERT INTO rooms (id, title, description, difficulty, category, points, solutions_count, requires_vpn, room_type, created_at, updated_at) VALUES (5, 'Hard CTF', 'd', 'HARD', 'Web', 150, 0, false, 'CTF', now(), now())");
        execute("INSERT INTO rooms (id, title, description, difficulty, category, points, solutions_count, requires_vpn, room_type, created_at, updated_at) VALUES (6, 'Intro', 'd', 'EASY', 'Path', 1, 0, false, 'PATH', now(), now())");
        assertSqlState("23505", "INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) VALUES (6, 1, 2)");
        execute("INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) VALUES (6, 2, 0)");
        assertSqlState("23505", "UPDATE rooms SET title = 'Intro' WHERE id = 4");
        execute("UPDATE rooms SET title = 'Renamed' WHERE id = 4");
        assertEquals("Renamed", text("SELECT room_title FROM chapter_rooms WHERE room_id = 4"));
        execute("UPDATE chapter_rooms SET room_title = 'Forged', chapter_id = 2 WHERE room_id = 4");
        assertEquals("Renamed", text("SELECT room_title FROM chapter_rooms WHERE room_id = 4"));
        assertSqlState("23505", "UPDATE chapter_rooms SET chapter_id = 2 WHERE room_id = 3");
    }

    @Test
    void movesStandaloneCtfRoomsAndTutorialsIntoOpenPathsWithoutTouchingProgress() throws Exception {
        flyway("35").migrate();
        insertUser(1, "Alice", "alice@example.com");
        insertUser(2, "Bob", "bob@example.com");
        execute("""
                UPDATE users SET points = 175 WHERE id = 1;
                UPDATE users SET points = 50 WHERE id = 2;
                INSERT INTO rooms (id, title, description, difficulty, category, points, flag, solutions_count, requires_vpn, room_type, published, created_at, updated_at) VALUES
                (1, 'Tutorial VPN', 'd', 'EASY', 'Tutorial', 50, 'vpn', 1, false, 'CTF', true, now(), now()),
                (2, 'Tutorial VM', 'd', 'EASY', 'Tutorial', 50, 'vm', 2, false, 'CTF', true, now(), now()),
                (3, 'SQL', 'd', 'MEDIUM', 'Web', 100, 'FLAG{sql}', 1, true, 'CTF', true, now() - interval '2 days', now()),
                (4, 'Crypto', 'd', 'HARD', 'Crypto', 150, 'FLAG{c}', 0, false, 'CTF', true, now() - interval '1 day', now()),
                (5, 'Szkic', 'd', 'EASY', 'Web', 50, '', 0, false, 'CTF', false, now(), now()),
                (6, 'Lekcja', 'd', 'EASY', 'Path', 10, 'f', 0, false, 'PATH', true, now(), now());
                INSERT INTO hints (id, description, room_id) VALUES (1, 'Spójrz na parametr', 3), (2, 'Szkicowa podpowiedź', 5);
                INSERT INTO user_unlocked_hints (user_id, hint_id) VALUES (1, 1);
                INSERT INTO room_files (file_name, file_type, data, room_id) VALUES ('dump.pcap', 'application/octet-stream', decode('0102', 'hex'), 3);
                INSERT INTO user_solved_rooms (user_id, room_id, solved_at, awarded_points) VALUES
                (1, 2, now() - interval '3 days', 50), (1, 1, now() - interval '2 days', 50), (1, 3, now() - interval '1 day', 75), (2, 2, now(), NULL);
                INSERT INTO paths (id, title, created_at, updated_at) VALUES (50, 'Linux', now(), now());
                INSERT INTO path_chapters (id, path_id, title, sort_order, created_at, updated_at) VALUES (50, 50, 'Start', 0, now(), now());
                INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) VALUES (6, 50, 0);
                """);

        assertEquals(1, flyway("36").migrate().migrationsExecuted);

        assertEquals("1:CTF:vpn|2:CTF:vm|3:CTF:FLAG{sql}|4:CTF:FLAG{c}|5:CTF:|6:PATH:f",
                text("SELECT string_agg(id || ':' || room_type || ':' || flag, '|' ORDER BY id) FROM rooms"));
        assertEquals("1:50:1|2:50:2|3:100:1|4:150:0|5:50:0|6:10:0",
                text("SELECT string_agg(id || ':' || points || ':' || solutions_count, '|' ORDER BY id) FROM rooms"));
        assertEquals(1, scalar("SELECT count(*) FROM paths WHERE title = 'Pierwsze kroki' AND published AND unlock_mode = 'OPEN' AND system_key IS NULL"));
        assertEquals("Samouczki:Tutorial VM,Tutorial VPN", text("""
                SELECT pc.title || ':' || string_agg(cr.room_title, ',' ORDER BY cr.sort_order)
                FROM chapter_rooms cr JOIN path_chapters pc ON pc.id = cr.chapter_id JOIN paths p ON p.id = pc.path_id
                WHERE p.title = 'Pierwsze kroki' GROUP BY pc.title
                """));
        assertEquals(1, scalar("SELECT count(*) FROM paths WHERE title = 'Zadania CTF' AND published AND unlock_mode = 'OPEN' AND system_key IS NULL"));
        assertEquals("3:0,4:1", text("""
                SELECT string_agg(cr.room_id || ':' || cr.sort_order, ',' ORDER BY cr.sort_order)
                FROM chapter_rooms cr JOIN path_chapters pc ON pc.id = cr.chapter_id JOIN paths p ON p.id = pc.path_id
                WHERE p.title = 'Zadania CTF'
                """));
        assertEquals(0, scalar("SELECT count(*) FROM chapter_rooms WHERE room_id = 5"));
        assertEquals(0, scalar("SELECT count(*) FROM rooms WHERE id = 5 AND published"));
        assertEquals(50, scalar("SELECT chapter_id FROM chapter_rooms WHERE room_id = 6"));
        assertEquals("1:Pierwsze kroki,1:Zadania CTF,2:Pierwsze kroki", text("""
                SELECT string_agg(e.user_id || ':' || p.title, ',' ORDER BY e.user_id, p.title)
                FROM path_enrollments e JOIN paths p ON p.id = e.path_id
                """));

        assertEquals("1:175,2:50", text("SELECT string_agg(id || ':' || points, ',' ORDER BY id) FROM users"));
        assertEquals("1:1:50,1:2:50,1:3:75,2:2:-", text("SELECT string_agg(user_id || ':' || room_id || ':' || coalesce(awarded_points::text, '-'), ',' ORDER BY user_id, room_id) FROM user_solved_rooms"));
        assertEquals("1:3,2:5", text("SELECT string_agg(id || ':' || room_id, ',' ORDER BY id) FROM hints"));
        assertEquals(1, scalar("SELECT count(*) FROM user_unlocked_hints WHERE user_id = 1 AND hint_id = 1"));
        assertEquals("dump.pcap:0102", text("SELECT file_name || ':' || encode(data, 'hex') FROM room_files WHERE room_id = 3"));
        assertEquals(0, flyway("36").migrate().migrationsExecuted);
        assertTrue(flyway("36").validateWithResult().validationSuccessful);
    }

    @Test
    void splitsMoreThan500MovedCtfRoomsIntoChaptersThatThePathEditorAccepts() throws Exception {
        flyway("35").migrate();
        execute("""
                INSERT INTO rooms (id, title, description, difficulty, category, points, flag, solutions_count, requires_vpn, room_type, published, created_at, updated_at)
                SELECT n, 'CTF ' || n, 'd', 'EASY', 'Web', 50, 'f', 0, false, 'CTF', true, now() + n * interval '1 second', now()
                FROM generate_series(1, 1001) AS n;
                """);

        assertEquals(1, flyway("36").migrate().migrationsExecuted);

        assertEquals("Rozdział 1:0:500:1:500|Rozdział 2:1:500:501:1000|Rozdział 3:2:1:1001:1001", text("""
                SELECT string_agg(title || ':' || sort_order || ':' || total || ':' || first_room || ':' || last_room, '|' ORDER BY sort_order)
                FROM (
                    SELECT pc.title, pc.sort_order, count(*) AS total, min(cr.room_id) AS first_room, max(cr.room_id) AS last_room
                    FROM path_chapters pc JOIN chapter_rooms cr ON cr.chapter_id = pc.id
                    JOIN paths p ON p.id = pc.path_id WHERE p.title = 'Zadania CTF'
                    GROUP BY pc.title, pc.sort_order
                ) chapters
                """));
        assertEquals(1, scalar("SELECT count(*) FROM paths WHERE title = 'Zadania CTF'"));
        assertEquals(0, scalar("SELECT count(*) FROM chapter_rooms WHERE sort_order >= 500"));
        assertEquals("0:1|499:500|0:501", text("""
                SELECT string_agg(sort_order || ':' || room_id, '|' ORDER BY room_id) FROM chapter_rooms WHERE room_id IN (1, 500, 501)
                """));
    }

    @Test
    void createsNoPathsWhenThereAreNoStandaloneCtfRooms() throws Exception {
        flyway("35").migrate();
        insertUser(1, "Alice", "alice@example.com");
        execute("""
                INSERT INTO rooms (id, title, description, difficulty, category, points, flag, solutions_count, requires_vpn, room_type, published, created_at, updated_at) VALUES
                (1, 'Szkic', 'd', 'EASY', 'Web', 50, '', 0, false, 'CTF', false, now(), now()),
                (2, 'Lekcja', 'd', 'EASY', 'Path', 10, 'f', 0, false, 'PATH', true, now(), now());
                """);

        assertEquals(1, flyway("36").migrate().migrationsExecuted);

        assertEquals("ukos", text("SELECT string_agg(coalesce(system_key, title), ',') FROM paths"));
        assertEquals(0, scalar("SELECT count(*) FROM path_chapters"));
        assertEquals(0, scalar("SELECT count(*) FROM path_enrollments"));
    }

    @Test
    void turnsRoomFlagsIntoTaskAnswersAndKeepsSolves() throws Exception {
        flyway("36").migrate();
        insertUser(1, "Alice", "alice@example.com");
        insertUser(2, "Bob", "bob@example.com");
        execute("""
                INSERT INTO rooms (id, title, description, difficulty, category, points, flag, solutions_count, requires_vpn, room_type, published, tasks_revision, content_revision, created_at, updated_at) VALUES
                (1, 'SQL', E'Znajdź <flagę> & wyślij
Druga linia', 'MEDIUM', 'Web', 100, 'FLAG{sql}', 1, false, 'CTF', true, 0, 2, now(), now()),
                (2, 'Lekcja z flagą', 'Opis lekcji', 'EASY', 'Path', 10, 'HACK{path}', 0, false, 'PATH', true, 3, 4, now(), now()),
                (3, 'Lekcja z zadaniami', 'Opis', 'EASY', 'Path', 10, 'unused', 1, false, 'PATH', true, 1, 1, now(), now()),
                (4, 'Szkic', '', 'EASY', 'Web', 50, '  ', 0, false, 'CTF', false, 0, 0, now(), now());
                INSERT INTO room_tasks (id, room_id, title, content, question, answer, sort_order) VALUES (30, 3, 'Pytanie', 'c', 'q?', 'a', 0);
                INSERT INTO user_solved_rooms (user_id, room_id, solved_at, awarded_points) VALUES
                (1, 1, TIMESTAMP '2026-10-01 12:00:00', 75), (2, 3, now(), 10);
                INSERT INTO user_completed_tasks (user_id, task_id, completed_at) VALUES (2, 30, now());
                """);

        assertEquals(1, flyway("37").migrate().migrationsExecuted);

        assertEquals(0, scalar("SELECT count(*) FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'rooms' AND column_name = 'flag'"));
        assertEquals("1:Zdobądź flagę:FLAG{sql}:0|2:Zdobądź flagę:HACK{path}:0|3:Pytanie:a:0", text("""
                SELECT string_agg(room_id || ':' || title || ':' || answer || ':' || sort_order, '|' ORDER BY room_id) FROM room_tasks
                """));
        assertEquals(0, scalar("SELECT count(*) FROM room_tasks WHERE room_id = 1 AND question IS NOT NULL"));
        assertEquals("Jaka jest flaga?", text("SELECT question FROM room_tasks WHERE room_id = 2"));
        assertEquals("<p>Znajdź &lt;flagę&gt; &amp; wyślij<br>Druga linia</p>", text("SELECT content FROM room_tasks WHERE room_id = 1"));
        assertEquals("<p>Opis lekcji</p>", text("SELECT content FROM room_tasks WHERE room_id = 2"));
        assertEquals(0, scalar("SELECT count(*) FROM room_tasks WHERE room_id = 4"));
        assertEquals("1:1:3-1|2:1:5-4|3:1:1-1|4:0:0-0", text("""
                SELECT string_agg(r.id || ':' || (SELECT count(*) FROM room_tasks t WHERE t.room_id = r.id) || ':' || r.content_revision || '-' || r.tasks_revision, '|' ORDER BY r.id)
                FROM rooms r
                """));
        assertEquals("1:1:2026-10-01 12:00:00|2:3:-", text("""
                SELECT string_agg(c.user_id || ':' || t.room_id || ':' || CASE WHEN t.room_id = 1 THEN to_char(c.completed_at, 'YYYY-MM-DD HH24:MI:SS') ELSE '-' END, '|' ORDER BY c.user_id)
                FROM user_completed_tasks c JOIN room_tasks t ON t.id = c.task_id
                """));
        assertEquals("1:1:75,2:3:10", text("SELECT string_agg(user_id || ':' || room_id || ':' || awarded_points, ',' ORDER BY user_id) FROM user_solved_rooms"));
        assertEquals("1:1|2:0|3:1|4:0", text("SELECT string_agg(id || ':' || solutions_count, '|' ORDER BY id) FROM rooms"));
        assertEquals(0, flyway("37").migrate().migrationsExecuted);
        assertTrue(flyway("37").validateWithResult().validationSuccessful);
    }

    @Test
    void keepsMigratedTaskContentWithinTheEditorLimit() throws Exception {
        flyway("36").migrate();
        execute("""
                INSERT INTO rooms (id, title, description, difficulty, category, points, flag, solutions_count, requires_vpn, room_type, published, created_at, updated_at) VALUES
                (1, 'Granica', repeat('a', 19993), 'EASY', 'Web', 50, 'F{1}', 0, false, 'CTF', true, now(), now()),
                (2, 'Za długi', repeat('a', 19994), 'EASY', 'Web', 50, 'F{2}', 0, false, 'CTF', true, now(), now()),
                (3, 'Znaki', repeat('<', 5000), 'EASY', 'Web', 50, 'F{3}', 0, false, 'CTF', true, now(), now());
                """);

        assertEquals(1, flyway("37").migrate().migrationsExecuted);

        assertEquals("1:20000|2:56|3:56", text("SELECT string_agg(room_id || ':' || char_length(content), '|' ORDER BY room_id) FROM room_tasks"));
        assertEquals("<p>Treść zadania znajdziesz w opisie pokoju powyżej.</p>", text("SELECT content FROM room_tasks WHERE room_id = 2"));
        assertEquals(19994, scalar("SELECT char_length(description) FROM rooms WHERE id = 2"));
    }

    @Test
    void dropsRoomPublishingAndDetachesDraftsFromPublishedPathsWithoutTouchingProgress() throws Exception {
        flyway("38").migrate();
        insertUser(1, "Alice", "alice@example.com");
        execute("""
                INSERT INTO rooms (id, title, description, difficulty, category, points, solutions_count, requires_vpn, room_type, published, created_at, updated_at) VALUES
                (1, 'Gotowy', 'Opis', 'EASY', 'Web', 50, 1, false, 'CTF', true, now(), now()),
                (2, 'Szkic w opublikowanej', '', 'EASY', 'Web', 50, 0, false, 'CTF', false, now(), now()),
                (3, 'Szkic w szkicu', '', 'EASY', 'Path', 10, 0, false, 'PATH', false, now(), now()),
                (4, 'Gotowy w szkicu', 'Opis', 'EASY', 'Path', 10, 0, false, 'PATH', true, now(), now()),
                (5, 'Luźny', 'Opis', 'EASY', 'Web', 50, 1, false, 'CTF', true, now(), now());
                INSERT INTO room_tasks (id, room_id, title, content, answer, sort_order) VALUES (10, 1, 'Flaga', '<p>x</p>', 'F{1}', 0), (50, 5, 'Flaga', '<p>x</p>', 'F{5}', 0);
                INSERT INTO paths (id, title, description, published, unlock_mode, chapters_revision, content_revision, created_at, updated_at) VALUES
                (101, 'Opublikowana', 'Opis', true, 'OPEN', 2, 3, now(), now()),
                (102, 'Szkic', '', false, 'OPEN', 4, 5, now(), now());
                INSERT INTO path_chapters (id, path_id, title, sort_order, created_at, updated_at) VALUES
                (101, 101, 'Rozdział', 0, now(), now()), (102, 102, 'Rozdział', 0, now(), now());
                INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) VALUES (1, 101, 0), (2, 101, 1), (3, 102, 0), (4, 102, 1);
                INSERT INTO user_solved_rooms (user_id, room_id, solved_at, awarded_points) VALUES (1, 1, now(), 50), (1, 5, now(), 50);
                INSERT INTO user_completed_tasks (user_id, task_id, completed_at) VALUES (1, 10, now()), (1, 50, now());
                """);

        assertEquals(1, flyway().migrate().migrationsExecuted);

        assertEquals(0, scalar("SELECT count(*) FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'rooms' AND column_name = 'published'"));
        assertEquals(5, scalar("SELECT count(*) FROM rooms"));
        assertEquals("1:101|3:102|4:102", text("""
                SELECT string_agg(cr.room_id || ':' || pc.path_id, '|' ORDER BY cr.room_id) FROM chapter_rooms cr JOIN path_chapters pc ON pc.id = cr.chapter_id
                """));
        assertEquals("101:3:4:true|102:4:5:false", text("""
                SELECT string_agg(id || ':' || chapters_revision || ':' || content_revision || ':' || published, '|' ORDER BY id) FROM paths WHERE id > 100
                """));
        assertEquals("1:1:50,1:5:50", text("SELECT string_agg(user_id || ':' || room_id || ':' || awarded_points, ',' ORDER BY room_id) FROM user_solved_rooms"));
        assertEquals(2, scalar("SELECT count(*) FROM user_completed_tasks WHERE user_id = 1"));
        assertEquals(2, scalar("SELECT count(*) FROM room_tasks"));
        assertEquals(0, flyway().migrate().migrationsExecuted);
        assertTrue(flyway().validateWithResult().validationSuccessful);
    }

    @Test
    void letsARoomJoinManyPathsButOnlyOneChapterOfEach() throws Exception {
        flyway("37").migrate();
        execute("""
                INSERT INTO rooms (id, title, description, difficulty, category, points, solutions_count, requires_vpn, room_type, published, created_at, updated_at) VALUES
                (1, 'Wspólny', 'd', 'EASY', 'Web', 50, 0, false, 'PATH', true, now(), now()),
                (2, 'Drugi', 'd', 'EASY', 'Web', 50, 0, false, 'PATH', true, now(), now());
                INSERT INTO paths (id, title, created_at, updated_at) VALUES (101, 'Web', now(), now()), (102, 'Linux', now(), now());
                INSERT INTO path_chapters (id, path_id, title, sort_order, created_at, updated_at) VALUES
                (10, 101, 'A', 0, now(), now()), (11, 101, 'B', 1, now(), now()), (20, 102, 'A', 0, now(), now());
                INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) VALUES (1, 10, 0), (2, 11, 0);
                """);

        assertEquals(1, flyway("38").migrate().migrationsExecuted);

        assertEquals("1:10:101:0|2:11:101:0", text("SELECT string_agg(room_id || ':' || chapter_id || ':' || path_id || ':' || sort_order, '|' ORDER BY room_id) FROM chapter_rooms"));
        execute("INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) VALUES (1, 20, 0)");
        assertEquals(102, scalar("SELECT path_id FROM chapter_rooms WHERE room_id = 1 AND chapter_id = 20"));
        assertSqlState("23505", "INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) VALUES (1, 11, 1)");
        assertSqlState("23503", "UPDATE chapter_rooms SET path_id = 102 WHERE room_id = 2");
        execute("DELETE FROM paths WHERE id = 102");
        assertEquals(2, scalar("SELECT count(*) FROM chapter_rooms"));
    }

    @Test
    void setsExistingPathsToOpenUnlockMode() throws Exception {
        flyway("9").migrate();
        execute("INSERT INTO paths (id, title, created_at, updated_at) VALUES (1, 'Existing', now(), now())");
        assertEquals(1, flyway("10").migrate().migrationsExecuted);
        assertEquals("OPEN", text("SELECT unlock_mode FROM paths WHERE id = 1"));
        execute("UPDATE paths SET unlock_mode = 'ROOM' WHERE id = 1");
        assertSqlState("23514", "UPDATE paths SET unlock_mode = 'SEQUENTIAL' WHERE id = 1");
        assertSqlState("23502", "UPDATE paths SET unlock_mode = NULL WHERE id = 1");
    }

    @Test
    void startsApplicationTwiceAndProvisionsClerkUser() throws Exception {
        try (var context = startApplication()) {
            var resolver = context.getBean(ClerkUserResolver.class);
            var first = resolver.resolve(clerkJwt("user_schema_a", " Tester@Example.com "));
            assertEquals("tester@example.com", text("SELECT email FROM users WHERE clerk_user_id = 'user_schema_a'"));
            assertEquals(500, scalar("SELECT elo FROM users WHERE clerk_user_id = 'user_schema_a'"));
            assertEquals(first.getId(), resolver.resolve(clerkJwt("user_schema_a", "tester@example.com")).getId());
            assertThrows(BadCredentialsException.class, () -> resolver.resolve(clerkJwt("user_schema_b", "TESTER@example.com")));
            assertEquals(1, scalar("SELECT count(*) FROM users"));
            assertEquals(1, scalar("SELECT count(*) FROM users WHERE password IS NULL"));
        }
        try (var ignored = startApplication()) {
            assertEquals(SCHEMA_VERSION, scalar("SELECT count(*) FROM flyway_schema_history WHERE success"));
        }
    }

    private static Jwt clerkJwt(String subject, String email) {
        return Jwt.withTokenValue("token").header("alg", "RS256").subject(subject)
                .claim("email", email.trim()).claim("email_verified", true).build();
    }

    @Test
    void enforcesUniquenessAndChecks() throws Exception {
        flyway().migrate();
        insertUser(1, "Alice", "alice@example.com");
        insertUser(2, "Bob", "bob@example.com");
        assertSqlState("23505", "INSERT INTO users (id, username, email, password, role, points, streak, created_at, updated_at) VALUES (3, 'ALICE', 'x@example.com', 'p', 'USER', 0, 0, now(), now())");
        assertSqlState("23505", "INSERT INTO users (id, username, email, password, role, points, streak, created_at, updated_at) VALUES (3, 'Carol', 'alice@example.com', 'p', 'USER', 0, 0, now(), now())");
        assertSqlState("23514", "INSERT INTO users (id, username, email, password, role, points, streak, created_at, updated_at) VALUES (3, 'Carol', 'Carol@example.com', 'p', 'USER', 0, 0, now(), now())");
        assertSqlState("23514", "INSERT INTO users (id, username, email, password, role, points, streak, created_at, updated_at) VALUES (3, 'Carol', 'carol@example.com', 'p', 'GUEST', 0, 0, now(), now())");
        execute("INSERT INTO users (id, username, email, role, points, streak, created_at, updated_at, clerk_user_id) VALUES (3, 'Carol', 'carol@example.com', 'USER', 0, 0, now(), now(), 'user_carol')");
        assertSqlState("23505", "INSERT INTO users (id, username, email, role, points, streak, created_at, updated_at, clerk_user_id) VALUES (4, 'Dave', 'dave@example.com', 'USER', 0, 0, now(), now(), 'user_carol')");
        execute("INSERT INTO friendships (requester_id, receiver_id, status, requester_wins, receiver_wins, created_at) VALUES (1, 2, 'PENDING', 0, 0, now())");
        assertSqlState("23505", "INSERT INTO friendships (requester_id, receiver_id, status, requester_wins, receiver_wins, created_at) VALUES (2, 1, 'PENDING', 0, 0, now())");
        assertSqlState("23514", "INSERT INTO friendships (requester_id, receiver_id, status, requester_wins, receiver_wins, created_at) VALUES (1, 1, 'PENDING', 0, 0, now())");
        insertRoom(1);
        execute("INSERT INTO room_tasks (id, room_id, title, content, sort_order) VALUES (1, 1, 't', 'c', 0)");
        execute("INSERT INTO user_completed_tasks (user_id, task_id, completed_at) VALUES (1, 1, now())");
        assertSqlState("23505", "INSERT INTO user_completed_tasks (user_id, task_id, completed_at) VALUES (1, 1, now())");
        execute("INSERT INTO user_solved_rooms (user_id, room_id, solved_at) VALUES (1, 1, now())");
        assertSqlState("23505", "INSERT INTO user_solved_rooms (user_id, room_id, solved_at) VALUES (1, 1, now())");
        assertSqlState("23503", "INSERT INTO user_weekly_active_time (user_id, week_key, seconds, updated_at) VALUES (99, '2026-W40', 0, now())");
    }

    @Test
    void cascadesUserAndRoomDeletion() throws Exception {
        flyway().migrate();
        insertUser(1, "Alice", "alice@example.com");
        insertUser(2, "Bob", "bob@example.com");
        insertRoom(1);
        execute("""
                INSERT INTO room_tasks (id, room_id, title, content, sort_order) VALUES (1, 1, 't', 'c', 0);
                INSERT INTO hints (id, room_id, description) VALUES (1, 1, 'h');
                INSERT INTO room_files (room_id, file_name, data) VALUES (1, 'f.txt', '\\x00'::bytea);
                INSERT INTO paths (id, title, created_at, updated_at) VALUES (100, 'p', now(), now());
                INSERT INTO path_chapters (id, path_id, title, sort_order, created_at, updated_at) VALUES (1, 100, 'c', 0, now(), now());
                INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) VALUES (1, 1, 0);
                INSERT INTO path_enrollments (user_id, path_id, enrolled_at) VALUES (1, 100, now());
                INSERT INTO user_solved_rooms (user_id, room_id, solved_at) VALUES (1, 1, now()), (2, 1, now());
                INSERT INTO user_completed_tasks (user_id, task_id, completed_at) VALUES (1, 1, now()), (2, 1, now());
                INSERT INTO user_unlocked_hints (user_id, hint_id) VALUES (1, 1), (2, 1);
                INSERT INTO user_badges (user_id, badge_id, earned_at) SELECT 1, id, now() FROM badges LIMIT 1;
                INSERT INTO friendships (requester_id, receiver_id, status, requester_wins, receiver_wins, created_at) VALUES (1, 2, 'ACCEPTED', 0, 0, now());
                INSERT INTO bug_reports (reporter_id, source, room_id, task_id, description, created_at) VALUES (1, 'ROOM', 1, 1, 'Nie działa podpowiedź', now());
                INSERT INTO bug_reports (reporter_id, source, room_id, task_id, description, created_at) VALUES (2, 'ROOM', 1, 1, 'Nie działa zadanie', now());
                INSERT INTO user_weekly_active_time (user_id, week_key, seconds, updated_at) VALUES (1, '2026-W40', 10, now());
                """);
        execute("DELETE FROM users WHERE id = 1");
        assertEquals(0, scalar("""
                SELECT (SELECT count(*) FROM user_solved_rooms WHERE user_id = 1)
                     + (SELECT count(*) FROM user_completed_tasks WHERE user_id = 1)
                     + (SELECT count(*) FROM user_unlocked_hints WHERE user_id = 1)
                     + (SELECT count(*) FROM user_badges)
                     + (SELECT count(*) FROM friendships)
                     + (SELECT count(*) FROM bug_reports WHERE reporter_id = 1)
                     + (SELECT count(*) FROM user_weekly_active_time)
                     + (SELECT count(*) FROM path_enrollments)
                """));
        execute("DELETE FROM rooms WHERE id = 1");
        assertEquals(0, scalar("""
                SELECT (SELECT count(*) FROM room_tasks)
                     + (SELECT count(*) FROM hints)
                     + (SELECT count(*) FROM room_files)
                     + (SELECT count(*) FROM chapter_rooms)
                     + (SELECT count(*) FROM user_solved_rooms)
                     + (SELECT count(*) FROM user_completed_tasks)
                     + (SELECT count(*) FROM user_unlocked_hints)
                """));
        assertEquals(1, scalar("SELECT count(*) FROM bug_reports WHERE room_id IS NULL AND task_id IS NULL"));
        assertEquals(1, scalar("SELECT count(*) FROM users"));
        assertEquals(7, scalar("SELECT count(*) FROM badges"));
        assertEquals(1, scalar("SELECT count(*) FROM path_chapters"));
        execute("DELETE FROM paths WHERE id = 100");
        assertEquals(0, scalar("SELECT count(*) FROM path_chapters"));
    }

    @Test
    void movesPathRoomsIntoFirstChapterOfTheLowestPath() throws Exception {
        assertEquals(2, flyway("2").migrate().migrationsExecuted);
        for (long id = 1; id <= 5; id++) {
            insertRoom(id);
        }
        execute("""
                UPDATE rooms SET room_type = 'PATH' WHERE id <= 4;
                INSERT INTO paths (id, title, created_at, updated_at) VALUES (1, 'a', now(), now()), (2, 'b', now(), now()), (3, 'c', now(), now());
                INSERT INTO path_rooms (path_id, room_id, sort_order) VALUES (1, 3, 5), (1, 1, 7), (1, 2, 9), (2, 1, 0), (2, 4, 3), (1, 5, 0);
                """);

        assertEquals(1, flyway("3").migrate().migrationsExecuted);
        assertEquals(1, scalar("SELECT count(*) FROM chapter_rooms WHERE room_id = 5"));
        assertEquals(1, flyway("4").migrate().migrationsExecuted);
        assertEquals(0, scalar("SELECT count(*) FROM chapter_rooms WHERE room_id = 5"));
        assertEquals(SCHEMA_VERSION - 4, flyway().migrate().migrationsExecuted);
        assertEquals(5, scalar("SELECT sum(tasks_revision) FROM rooms"));
        assertEquals(1, scalar("SELECT count(*) FROM rooms WHERE id = 5 AND room_type = 'CTF'"));
        assertEquals("Zadania CTF", text("SELECT p.title FROM chapter_rooms cr JOIN path_chapters pc ON pc.id = cr.chapter_id JOIN paths p ON p.id = pc.path_id WHERE cr.room_id = 5"));
        assertEquals(0, scalar("SELECT sum(chapters_revision) FROM paths"));

        assertEquals(4, scalar("SELECT count(*) FROM path_chapters WHERE title = 'Rozdział 1' AND sort_order = 0"));
        assertEquals(4, scalar("SELECT count(DISTINCT path_id) FROM path_chapters"));
        assertEquals("3:0,1:1,2:2", text("""
                SELECT string_agg(cr.room_id || ':' || cr.sort_order, ',' ORDER BY cr.sort_order)
                FROM chapter_rooms cr JOIN path_chapters pc ON pc.id = cr.chapter_id WHERE pc.path_id = 1
                """));
        assertEquals("4:0", text("""
                SELECT string_agg(cr.room_id || ':' || cr.sort_order, ',' ORDER BY cr.sort_order)
                FROM chapter_rooms cr JOIN path_chapters pc ON pc.id = cr.chapter_id WHERE pc.path_id = 2
                """));
        assertEquals(0, scalar("SELECT count(*) FROM chapter_rooms cr JOIN path_chapters pc ON pc.id = cr.chapter_id WHERE pc.path_id = 3"));
        assertEquals(0, scalar("SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'path_rooms'"));
        assertSqlState("23505", "INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) SELECT 3, id, 1 FROM path_chapters WHERE path_id = 1");
        assertSqlState("23514", "INSERT INTO path_chapters (path_id, title, sort_order, created_at, updated_at) VALUES (1, '  ', 1, now(), now())");
    }

    private ConfigurableApplicationContext startApplication() {
        return new SpringApplicationBuilder(ServerApplication.class).run(
                "--DB_URL=" + url,
                "--DB_USERNAME=" + username,
                "--DB_PASSWORD=" + password,
                "--server.port=0"
        );
    }

    private Flyway flyway() {
        return Flyway.configure().dataSource(url, username, password)
                .locations("classpath:db/schema")
                .load();
    }

    private Flyway flyway(String target) {
        return Flyway.configure().dataSource(url, username, password)
                .locations("classpath:db/schema")
                .target(target)
                .load();
    }

    private void insertUser(long id, String username, String email) throws SQLException {
        boolean seeded = scalar("SELECT count(*) FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar_seed'") > 0;
        execute("INSERT INTO users (id, username, email, password, role, points, streak, created_at, updated_at" + (seeded ? ", avatar_seed" : "") + ") VALUES ("
                + id + ", '" + username + "', '" + email + "', 'p', 'USER', 0, 0, now(), now()" + (seeded ? ", 'test-seed'" : "") + ")");
    }

    private void insertRoom(long id) throws SQLException {
        boolean flagged = scalar("SELECT count(*) FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'rooms' AND column_name = 'flag'") > 0;
        execute("INSERT INTO rooms (id, title, description, difficulty, category, points" + (flagged ? ", flag" : "") + ", solutions_count, requires_vpn, room_type, created_at, updated_at) VALUES ("
                + id + ", 'room " + id + "', 'd', 'EASY', 'Web', 50" + (flagged ? ", 'flag'" : "") + ", 0, false, 'CTF', now(), now())");
    }

    private void assertSqlState(String expected, String sql) {
        var error = assertThrows(SQLException.class, () -> execute(sql));
        assertEquals(expected, error.getSQLState());
    }

    private Connection connect(String jdbcUrl) throws SQLException {
        return DriverManager.getConnection(jdbcUrl, username, password);
    }

    private void execute(String sql) throws SQLException {
        try (var connection = connect(url); var statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private long scalar(String sql) throws SQLException {
        try (var connection = connect(url); var statement = connection.createStatement();
             var result = statement.executeQuery(sql)) {
            result.next();
            return result.getLong(1);
        }
    }

    private String text(String sql) throws SQLException {
        try (var connection = connect(url); var statement = connection.createStatement();
             var result = statement.executeQuery(sql)) {
            result.next();
            return result.getString(1);
        }
    }
}
