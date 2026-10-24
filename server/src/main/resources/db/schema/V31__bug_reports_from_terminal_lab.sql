ALTER TABLE bug_reports ADD COLUMN lesson_id varchar(64);

ALTER TABLE bug_reports DROP CONSTRAINT ck_bug_reports_source;
ALTER TABLE bug_reports ADD CONSTRAINT ck_bug_reports_source CHECK (source IN ('ROOM', 'ARENA', 'LAB'));
ALTER TABLE bug_reports ADD CONSTRAINT ck_bug_reports_lesson CHECK (
    (source = 'LAB' AND lesson_id IS NOT NULL) OR (source <> 'LAB' AND lesson_id IS NULL)
);
