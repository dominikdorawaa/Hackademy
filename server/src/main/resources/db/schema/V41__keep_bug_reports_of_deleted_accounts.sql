ALTER TABLE bug_reports ALTER COLUMN reporter_id DROP NOT NULL;
ALTER TABLE bug_reports DROP CONSTRAINT fk_bug_reports_reporter;
ALTER TABLE bug_reports ADD CONSTRAINT fk_bug_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users (id) ON DELETE SET NULL;
