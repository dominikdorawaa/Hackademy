INSERT INTO public.badges (name, description, icon, condition_type, condition_value)
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
DECLARE
    relationship record;
    existing_constraint record;
BEGIN
    FOR relationship IN
        SELECT * FROM (VALUES
            ('friendships', 'requester_id', 'users'),
            ('friendships', 'receiver_id', 'users'),
            ('hints', 'room_id', 'rooms'),
            ('user_badges', 'user_id', 'users'),
            ('user_badges', 'badge_id', 'badges'),
            ('room_tasks', 'room_id', 'rooms'),
            ('path_rooms', 'path_id', 'paths'),
            ('path_rooms', 'room_id', 'rooms'),
            ('path_enrollments', 'user_id', 'users'),
            ('path_enrollments', 'path_id', 'paths'),
            ('user_completed_tasks', 'user_id', 'users'),
            ('user_completed_tasks', 'task_id', 'room_tasks')
        ) AS relationships(table_name, column_name, referenced_table)
    LOOP
        FOR existing_constraint IN
            SELECT constraint_name.conname
            FROM pg_constraint AS constraint_name
            JOIN pg_class AS table_name ON table_name.oid = constraint_name.conrelid
            JOIN pg_namespace AS schema_name ON schema_name.oid = table_name.relnamespace
            JOIN pg_attribute AS column_name
                ON column_name.attrelid = table_name.oid
                AND constraint_name.conkey = ARRAY[column_name.attnum]
            WHERE constraint_name.contype = 'f'
                AND constraint_name.confdeltype <> 'c'
                AND schema_name.nspname = 'public'
                AND table_name.relname = relationship.table_name
                AND column_name.attname = relationship.column_name
        LOOP
            EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', relationship.table_name, existing_constraint.conname);
        END LOOP;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint AS constraint_name
            JOIN pg_class AS table_name ON table_name.oid = constraint_name.conrelid
            JOIN pg_namespace AS schema_name ON schema_name.oid = table_name.relnamespace
            JOIN pg_attribute AS column_name
                ON column_name.attrelid = table_name.oid
                AND constraint_name.conkey = ARRAY[column_name.attnum]
            WHERE constraint_name.contype = 'f'
                AND constraint_name.confdeltype = 'c'
                AND schema_name.nspname = 'public'
                AND table_name.relname = relationship.table_name
                AND column_name.attname = relationship.column_name
        ) THEN
            EXECUTE format(
                'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON DELETE CASCADE',
                relationship.table_name,
                format('fk_%s_%s_cascade', relationship.table_name, relationship.column_name),
                relationship.column_name,
                relationship.referenced_table
            );
        END IF;
    END LOOP;
END $$;
