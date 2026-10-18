ALTER TABLE paths ADD COLUMN system_key varchar(32);
ALTER TABLE paths ADD CONSTRAINT uq_paths_system_key UNIQUE (system_key);

SELECT setval(pg_get_serial_sequence('paths', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM paths;

INSERT INTO paths (title, description, published, unlock_mode, system_key, created_at, updated_at)
VALUES ('Dyżur Zero',
        'Pierwszy dzień w zespole. Prawdziwy terminal w przeglądarce. Laboratorium 1 jest już dostępne.',
        true, 'OPEN', 'ukos', now(), now());
