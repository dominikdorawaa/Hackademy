DO $$
BEGIN
    IF to_regclass('public.user_completed_tasks') IS NULL THEN
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.user_completed_tasks'::regclass
            AND contype = 'u'
            AND conkey = ARRAY[
                (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.user_completed_tasks'::regclass AND attname = 'user_id'),
                (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.user_completed_tasks'::regclass AND attname = 'task_id')
            ]
    ) THEN
        LOCK TABLE public.user_completed_tasks IN SHARE ROW EXCLUSIVE MODE;

        DELETE FROM public.user_completed_tasks
        WHERE id IN (
            SELECT id
            FROM (
                SELECT id, ROW_NUMBER() OVER (
                    PARTITION BY user_id, task_id
                    ORDER BY completed_at, id
                ) AS duplicate_number
                FROM public.user_completed_tasks
            ) AS completions
            WHERE duplicate_number > 1
        );
    END IF;
END $$;
