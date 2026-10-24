ALTER TABLE arena_questions DROP CONSTRAINT arena_questions_difficulty_check;

ALTER TABLE arena_questions ADD CONSTRAINT arena_questions_difficulty_check
    CHECK (difficulty IN ('VERY_EASY', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD'));

UPDATE arena_questions SET difficulty = 'VERY_EASY'
WHERE difficulty = 'EASY' AND content IN (
    'Które polecenie wyświetla bieżący katalog?',
    'Na którym porcie domyślnie działa HTTPS?',
    'Na którym porcie domyślnie działa SSH?',
    'Który protokół zamienia nazwy domen na adresy IP?',
    'Czym jest phishing?'
);

UPDATE arena_questions SET difficulty = 'HARD'
WHERE difficulty = 'MEDIUM' AND content IN (
    'Dlaczego MD5 nie nadaje się do przechowywania haseł?',
    'Którym kluczem nadawca szyfruje wiadomość przeznaczoną dla Ciebie w kryptografii asymetrycznej?'
);

UPDATE arena_questions SET difficulty = 'VERY_HARD'
WHERE difficulty = 'HARD' AND content = 'Czym jest SSRF?';
