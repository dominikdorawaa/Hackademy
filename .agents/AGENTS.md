# Zasady dla agentów

- Nigdy nie dodawaj komentarzy w kodzie (Java, JS/JSX, CSS, SQL, XML, YAML ani żadnych innych plikach).
- Nie używaj em dashy (znak "—") w kodzie, tekstach, commitach ani odpowiedziach.
- Nigdy nie dodawaj do commitów linii "Co-Authored-By" z modelem AI ani żadnej innej atrybucji AI. AI nigdy nie może trafić do contributorów.
- Commity piszemy w formacie Conventional Commits (np. `feat: ...`, `fix: ...`, `chore: ...`), krótko i treściwie.
- Tickety (issues, opisy PR) też mają być krótkie i treściwe, bez atrybucji AI.
- Przy tworzeniu PR na GitHubie użyj tytułu ticketa jako tytułu PR i automatycznie przygotuj krótki opis na podstawie rzeczywistych zmian oraz wyników weryfikacji.
- Przed rozpoczęciem zmian utwórz osobną gałąź od aktualnego `main`. Jeśli istnieje ticket, nazwij gałąź zgodnie z jego nazwą. Nie commituj ani nie pushuj bezpośrednio z `main`.
- Nigdy nie edytuj, nie usuwaj ani nie zmieniaj nazwy migracji, która kiedykolwiek trafiła na `main`. Każdą kolejną zmianę schematu lub danych wprowadzaj w nowej migracji. Przed zmianą istniejącej migracji sprawdź historię `main`.
