# Prototyp UKOS: wynik próby technicznej

Pomiar z 18.10.2026 na Linuksie x86_64, Intel Core i5-9600K (6 CPU), 16 GB RAM, Node 26.8.1 i Chromium 152.0.7977.82. Testy korzystały z oddzielnego buildu Vite serwowanego na localhost, bez ograniczania pasma. Nie są pomiarem wydajności na urządzeniach użytkowników ani czasu pobierania przez internet.

## Wynik

v86 z prawdziwym Linuksem, Bashem i nano jest wykonalnym kierunkiem dla pierwszego laboratorium. Emulacja działa w osobnym Web Workerze. Sprawdzono rzeczywiste wykonanie poleceń, ocenę stanu plików, UTF-8, lokalny zapis i odtworzenie warsztatu.

| Próba | Wynik ostatniego uruchomienia |
| --- | --- |
| Przygotowany stan startowy, nowy warsztat | 2,12 s do gotowego Basha |
| Pełny rozruch kernela od zera | 6,98 s |
| Stan startowy z odtworzeniem plików ucznia | 3,45 s |
| Klatki głównego wątku podczas nieskończonej pętli Basha | p95 16,7 ms; maksimum 16,8 ms w próbce 120 klatek |
| Długie zadania głównego wątku z monitora prototypu | 0 w tym uruchomieniu |
| Ostatni zapis małego warsztatu | 1119 B, 304 ms |
| Pamięć przydzielona gościowi | 128 MiB, bez uwzględnienia narzutu JS/WASM i przeglądarki |

Snapshot startowy ma 22 990 638 B (21,93 MiB), wasm 2 007 347 B. Alternatywny rozruch pobiera kernel 7 688 704 B i initrd 7 316 324 B. Przygotowany stan zmniejsza pracę CPU podczas startu, ale zwiększa transfer pierwszego uruchomienia. Każdy plik mieści się w limicie Pages 25 MiB. Domyślny start nie pobiera ponownie kernela i initrd; tryb `?cold` pozostaje do porównania.

Zmniejszenie przydziału do 64 MiB nie pasuje do tego obrazu: loader tej wersji v86 umieszcza initrd pod adresem 64 MiB. Pozostawiono 128 MiB. Nie jest to dowód minimalnego możliwego zużycia pamięci przy innych konstrukcjach obrazu.

## Sprawdzone zachowania

- `pwd` zalicza krok. `echo pwd`, `PWD` i `ls missing; true` go nie obchodzą. Wariant `ls -la` działa. Ocena korzysta ze zdarzeń Basha i checkera, nie z tekstu wyświetlonego w terminalu.
- Tworzenie katalogów, zapis w nano z tekstem „Zażółć gęślą jaźń”, kopiowanie i przenoszenie zaliczają kolejne kroki po sprawdzeniu stanu plików.
- Ctrl+O, Enter, Ctrl+X, wklejanie, Tab, historia i Ctrl+C działają. Niezapisany bufor edytora nie jest utrwalany.
- Zapis w IndexedDB i odtworzenie po ponownym otwarciu zachowują treść oraz usunięte pliki. Reset usuwa własne pliki i odtwarza standardowy początek aktywnego kroku, zachowując numer kroku.
- Druga karta nie uruchamia jednoczesnego zapisu tego samego warsztatu. Zatrzymanie pierwszej zwalnia blokadę. Pauza i wznowienie działają.
- Nieskończona pętla Basha nie blokuje przycisków strony i może zostać przerwana przez Ctrl+C. Wyświetlenie 10 000 wierszy nie uniemożliwia dalszej pracy.
- Timeout startu i zakończenie sesji mają pojedynczy błąd, bez pętli ponownego uruchamiania. Błędy storage nie są pokazywane jako udany zapis.

## Weryfikacja

- `npm test`: 466 testów Vitest i 25 kontroli Node, wszystkie poprawne.
- `npm run ukos:test`: 29 testów, 98% pokrycia linii prototypu; każdy objęty plik przekracza wymagane 80%.
- `npm run ukos:test:browser`: trzy scenariusze z prawdziwym obrazem Linuksa. Pomiary i screenshot są zapisywane w `client/test-results/`.
- `npm run build`, `npm run ukos:build`, `npm run lint`, `git diff --check` oraz kontrola składni skryptów gościa przechodzą.
- Standardowy build aplikacji nie zawiera strony prototypu, v86, xterm ani obrazów Linuksa. Nie zmieniono tras aplikacji, API ani bazy.

## Następny etap

Wynik uzasadnia budowę pełnego Laboratorium 1 na tym silniku. Pozostają treści i historia kursu, integracja listy ścieżek i konta, synchronizacja zaliczeń oraz serwerowe podejścia do godzinnego finału. Prototyp nie wdraża jeszcze tych funkcji i nie jest egzaminem odpornym na modyfikację klienta.

Przed produkcją należy zmierzyć wolniejsze urządzenia i sieci, Firefox i Safari oraz większe archiwa plików. Przesyłanie archiwów kanałem szeregowym i brak migracji lokalnych zapisów między wersjami obrazu pozostają ograniczeniami tej próby. Nie ustalono całkowitego zużycia RAM renderera. Instrukcja odtworzenia i pochodzenie obrazów: [tools/ukos/README.md](../../tools/ukos/README.md).

## Zintegrowane Laboratorium 1

Lokalny widok aplikacji `/learn/ukos` zawiera 15 ćwiczeń, historię Dyżuru Zero i postęp konta. Godzinny finał laboratorium był częścią pierwszej wersji i został usunięty; egzamin bez podpowiedzi będzie osobnym pokojem na końcu ścieżki. Osobny prototyp pozostaje punktem odniesienia dla pomiarów silnika. Build aplikacji dołącza teraz statyczne obrazy i osobne moduły kursu, ale nie pobiera emulatora ani obrazów przy zwykłym wejściu na stronę.

Pełny test Chromium z lokalnym Spring Boot i Postgresem przechodzi wszystkie ćwiczenia z prawdziwym nano, synchronizację, odtworzenie standardowego warsztatu na drugim urządzeniu i ukończenie pokoju. Testy API sprawdzają izolację kont, monotoniczny zapis i walidację postępu.

### Próba równoczesnych żądań API

18.10.2026, lokalny kontener z limitem 512 MiB, bez swapu, ograniczeniem 1 CPU i flagami JVM z `heroku.yml`. Lokalny PostgreSQL, bez opóźnień internetu i bez modelowania limitów współdzielonego CPU i I/O Heroku. W tle działały inne lokalne kontrole. Rejestracja 150 oddzielnych kont odbyła się przed pomiarem. Dwie grupy, 50 i 100 kont, wykonały kolejno równoczesne odczyty, zapisy postępu, rozpoczęcia i przesłanie poprawnego archiwum egzaminacyjnego. Nie uruchamiano 150 emulatorów: terminal nie korzysta z API do wykonywania komend.

| Grupa | Odczyt p95 | Zapis postępu p95 | Start p95 | Oddanie p95 |
| --- | --- | --- | --- | --- |
| 50 kont | 1695 ms | 1694 ms | 1322 ms | 793 ms |
| 100 kont | 1519 ms | 1725 ms | 1553 ms | 1514 ms |

600 żądań zakończyło się poprawnie, wszystkie podejścia zaliczono. Pomiar dotyczy wersji z finałem; endpointy rozpoczęcia i oddania zostały później usunięte, więc obecne API wykonuje tylko odczyty i zapisy postępu. Szczyt pamięci całego cgroup: 483 954 688 B, około 461,5 MiB z 512 MiB. Bez OOM. To szczyt kontenera, obejmujący także pamięć podręczną, nie odpowiednik samego RSS ani pomiar dodatkowej pamięci na osobę.

Próba potwierdza obsługę takich krótkich serii przez lokalne API z ograniczoną pamięcią. Nie ustala limitu użytkowników produkcyjnych. Nie obejmuje jednoczesnego logowania, pełnego ruchu innych ścieżek, WebSocketów areny, długiego utrzymania obciążenia, słabych urządzeń ani zbiorowego pobierania obrazów przez sieć uczelni. Nie zwiększono planów ani nie wykonywano testu obciążeniowego na produkcji.

### Ograniczone łącze i CPU

Test zintegrowanego kursu w Chromium, nowy profil, emulowane 10 Mb/s pobierania, 100 ms opóźnienia oraz czterokrotne spowolnienie CPU przez CDP: pierwszy start 24 549 ms. Podczas nieskończonej pętli Basha podpowiedź pozostała dostępna, a p95 odstępu 120 klatek głównego wątku wyniosło 16,8 ms. Ctrl+C oraz zapis i wyjście działały. Jest to symulacja ograniczeń w Chromium na opisanym komputerze, nie pomiar fizycznie słabszego urządzenia ani innych silników przeglądarki.

Końcowe kontrole: pełne testy frontendu i backendu bez niepowodzeń (jeden istniejący test backendu pominięty), trzy scenariusze przeglądarkowe silnika i dwa kursu poprawne. Nowe moduły kursu mają 96–100% pokrycia linii, nowe moduły serwera 97–100%, silnik około 98%. Lint, TypeScript, formatowanie, składnia skryptów, build Vite i wieloetapowy build frontendu w Dockerze przechodzą.
