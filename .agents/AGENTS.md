# Zasady dla agentów

- Nigdy nie dodawaj komentarzy w kodzie (Java, JS/JSX, CSS, SQL, XML, YAML ani żadnych innych plikach).
- Nie używaj em dashy (znak "—") w kodzie, tekstach, commitach ani odpowiedziach.
- Nigdy nie dodawaj do commitów linii "Co-Authored-By" z modelem AI ani żadnej innej atrybucji AI. AI nigdy nie może trafić do contributorów.
- Commity piszemy w formacie Conventional Commits (np. `feat: ...`, `fix: ...`, `chore: ...`), krótko i treściwie.
- Komunikaty commitów zawsze piszemy po angielsku.
- Tytuł commita ma prostymi słowami mówić, co się zmieniło z punktu widzenia projektu, bez skrótów i wewnętrznego żargonu (np. `fix: use new database migrations by default` zamiast `chore: flyway defaults`). Jeśli powód zmiany nie wynika z tytułu, dodaj jedno lub dwa zdania opisu, dlaczego była potrzebna.
- Tickety (issues, opisy PR) też mają być krótkie i treściwe, bez atrybucji AI.
- Wszystkie nowe zmiany testuj w rozsądnym zakresie, odpowiednio do ich charakteru i ryzyka. Dla nowego kodu celuj w 80-100% pokrycia testami tam, gdzie da się je sensownie zmierzyć.
- Przed oddaniem zmian uruchom testy dotyczące zmienionego obszaru i sprawdź formatowanie zmienionych plików. W podsumowaniu podaj wyniki; jeśli czegoś nie dało się sprawdzić, wskaż co i dlaczego.
- Nie dodawaj do repozytorium haseł, tokenów, kluczy prywatnych ani plików `.env` z rzeczywistymi danymi. W przykładach i dokumentacji używaj wyłącznie fikcyjnych wartości.
- Tytuły ticketów na GitHubie pisz po angielsku, krótko i konkretnie, tak aby nadawały się na nazwę gałęzi. Szczegóły umieszczaj w opisie ticketa.
- Przy tworzeniu PR na GitHubie użyj tytułu ticketa jako tytułu PR i automatycznie przygotuj krótki opis na podstawie rzeczywistych zmian oraz wyników weryfikacji.
- Przed rozpoczęciem zmian utwórz osobną gałąź od aktualnego `main`. Jeśli istnieje ticket, nazwij gałąź zgodnie z jego nazwą. Nie commituj ani nie pushuj bezpośrednio z `main`.
- Przed każdym pushem pobierz i zintegruj najnowsze zmiany z gałęzi `main`.
- Nigdy nie twórz gałęzi z prefiksem `codex/`. Gdy nie ma ticketa, wybierz krótką nazwę opisującą zmianę.
- Nigdy nie edytuj, nie usuwaj ani nie zmieniaj nazwy migracji, która kiedykolwiek trafiła na `main`. Każdą kolejną zmianę schematu lub danych wprowadzaj w nowej migracji. Przed zmianą istniejącej migracji sprawdź historię `main`.
- Migracje są w `server/src/main/resources/db/schema` i zaczynają się od V1. Dawny katalog `db/migration` usunięto jednorazowo, za wyraźną zgodą, przy postawieniu bazy od zera (issue #7). Nie traktuj tego jako precedensu.
