ALTER TABLE arena_questions
    ADD COLUMN correct_answer_text VARCHAR(200),
    ADD COLUMN wrong_answer_1 VARCHAR(200),
    ADD COLUMN wrong_answer_2 VARCHAR(200),
    ADD COLUMN wrong_answer_3 VARCHAR(200);

UPDATE arena_questions SET
    correct_answer_text = CASE correct_answer WHEN 0 THEN answer_a WHEN 1 THEN answer_b WHEN 2 THEN answer_c ELSE answer_d END,
    wrong_answer_1 = CASE correct_answer WHEN 0 THEN answer_b ELSE answer_a END,
    wrong_answer_2 = CASE WHEN correct_answer <= 1 THEN answer_c ELSE answer_b END,
    wrong_answer_3 = CASE correct_answer WHEN 3 THEN answer_c ELSE answer_d END;

ALTER TABLE arena_questions
    DROP COLUMN answer_a,
    DROP COLUMN answer_b,
    DROP COLUMN answer_c,
    DROP COLUMN answer_d,
    DROP COLUMN correct_answer;

ALTER TABLE arena_questions RENAME COLUMN correct_answer_text TO correct_answer;

ALTER TABLE arena_questions
    ALTER COLUMN correct_answer SET NOT NULL,
    ALTER COLUMN wrong_answer_1 SET NOT NULL,
    ALTER COLUMN wrong_answer_2 SET NOT NULL,
    ALTER COLUMN wrong_answer_3 SET NOT NULL;
