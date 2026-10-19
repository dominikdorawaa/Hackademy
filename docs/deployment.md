# Wdrożenie produkcyjne

Opis hostingu Hackademy po migracji z Render i Neon (#130, ADR 0004). Wartości sekretów są w menedżerze haseł, nie w repozytorium.

## Architektura

| Część | Usługa | Adres |
| --- | --- | --- |
| Frontend | Cloudflare Pages Free, projekt `hackademy` | `https://hackademy.app` |
| Backend i realtime | Heroku, aplikacja `hackademy`, jedno dyno Basic, stack `container`, region EU | `https://api.hackademy.app` |
| Baza danych | Heroku Postgres Essential-0, PostgreSQL 17 | zmienna `DATABASE_URL` |
| DNS, TLS i przekierowania | Cloudflare Free, strefa `hackademy.app` | |

- `hackademy.app` to rekord CNAME do `hackademy.pages.dev`, z proxy, dodany jako domena projektu Pages.
- `api.hackademy.app` to rekord CNAME do adresu docelowego domeny Heroku, z proxy. TLS działa w trybie Full (strict); certyfikat na Heroku wystawia i odnawia ACM (Let's Encrypt).
- `www.hackademy.app` ma rekord z proxy i regułę przekierowania `www to apex` (301 na `https://hackademy.app` z zachowaniem ścieżki i parametrów).
- Reguła `api https` przekierowuje HTTP na HTTPS dla `api.hackademy.app` kodem 308, z wyjątkiem `/.well-known/acme-challenge/`, z którego ACM korzysta przy odnawianiu certyfikatu. „Always Use HTTPS” w Cloudflare musi pozostać wyłączone.
- Koszt stałych zasobów to 12 USD miesięcznie (Basic 7 USD, Essential-0 5 USD) w ramach kredytu studenckiego 13 USD. Nie dodajemy dyno, dodatków firm trzecich ani droższych planów bez osobnej decyzji. Jednorazowe dyno (`heroku run`) też są płatne.

## Wdrażanie

Workflow `.github/workflows/deploy.yml` uruchamia się po każdym pushu na `main` oraz ręcznie (Actions, Deploy, Run workflow).

1. Wykrywa zmienione części. Backend to `server/`, `Dockerfile`, `.dockerignore` i `heroku.yml`; frontend to `client/`. Uruchomienie ręczne wdraża obie części.
2. Uruchamia te same testy co w PR-ach (`backend.yml`, `frontend.yml`).
3. Backend: `git push` do Heroku, które buduje obraz z `heroku.yml`, a następnie czeka na `200` z `BACKEND_HEALTH_URL`.
4. Frontend: build z `VITE_API_URL` i `wrangler pages deploy`. Rusza dopiero po udanym wdrożeniu backendu lub gdy backend się nie zmienił.

Wdrożenia nie przerywają się nawzajem. Nieudane testy lub nieudany backend zatrzymują frontend. Wdrożenie frontendu nie restartuje Heroku.

Sekrety repozytorium (dodaje je właściciel repozytorium):

| Sekret | Opis |
| --- | --- |
| `HEROKU_API_KEY` | osobna autoryzacja Heroku z opisem „GitHub Actions Hackademy deploy”; odwołanie przez `heroku authorizations:revoke <id>` |
| `CLOUDFLARE_API_TOKEN` | token z jednym uprawnieniem `Account / Cloudflare Pages / Edit` |
| `CLOUDFLARE_ACCOUNT_ID` | identyfikator konta Cloudflare |

Po rotacji tokenu właściciel repozytorium podmienia sekret, a stary token jest odwoływany.

## Zmiany API

Frontend i backend wdrażają się osobno, więc przez kilka minut nowy backend obsługuje stary frontend.

1. Najpierw wdrażamy backend zgodny wstecz: nowe pola i endpointy są opcjonalne, stare działają dalej.
2. Potem frontend korzystający z nowego API.
3. Usunięcie starego API to osobny, późniejszy PR.

Migracje bazy uruchamia Flyway przy starcie backendu. Muszą działać ze starym kodem, który jeszcze obsługuje ruch do restartu dyno.

## Konfiguracja Heroku

| Zmienna | Wartość |
| --- | --- |
| `DATABASE_URL` | ustawia i rotuje Heroku; backend wymusza SSL |
| `JWT_SECRET` | ten sam sekret co wcześniej na Renderze, więc migracja nie wylogowała użytkowników; Base64, co najmniej 256 bitów |
| `FRONTEND_URL` | `https://hackademy.app`; jedyny origin dopuszczony dla API i WebSocket, dopóki nie ustawiono `CORS_ALLOWED_ORIGINS` |

- Nie ustawiamy na Heroku `DB_URL`, `DB_USERNAME` ani `DB_PASSWORD`. Zmienne `VPN_SERVER_*` nie są ustawione, bo VPN nie działa i nie był migrowany.
- Zmiana zmiennej restartuje dyno.
- Włączone jest `log-runtime-metrics`, więc `heroku logs -a hackademy` pokazuje zużycie pamięci (`sample#memory_rss`).

## Pamięć i restarty

`heroku.yml` uruchamia backend z limitami dobranymi testem w kontenerze 512 MB:

```
MALLOC_ARENA_MAX=2 exec java -Xmx160m -Xss512k -XX:MaxMetaspaceSize=160m -XX:ReservedCodeCacheSize=96m -XX:CICompilerCount=2 -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError -jar /app/app.jar
```

Rozmiary są podane wprost, bo JVM na dyno może nie widzieć limitu 512 MB. `Dockerfile` ma `ENTRYPOINT []` i `CMD`, żeby Heroku mogło podać własne polecenie; Docker Compose uruchamia ten sam obraz bez tych flag.

Heroku restartuje dyno raz na dobę oraz przy każdym wdrożeniu i zmianie konfiguracji. Stan pojedynków jest w pamięci procesu, więc przy zamykaniu trwające mecze kończą się statusem `CANCELLED` bez zmiany Elo, a gracze widzą komunikat. Zamykanie jest łagodne (`server.shutdown: graceful`, do 20 s z 30 s, które daje Heroku).

## Kopie zapasowe

Essential-0 przechowuje 5 kopii ręcznych oraz kopie z harmonogramu dziennego: 7 dziennych i 1 tygodniową.

```bash
heroku pg:backups:schedule DATABASE_URL --at '03:00 Europe/Warsaw' -a hackademy
heroku pg:backups:capture -a hackademy
heroku pg:backups -a hackademy
heroku pg:backups:download -a hackademy
```

Przywrócenie kopii nadpisuje całą bazę: `heroku pg:backups:restore <id> DATABASE_URL -a hackademy`. Przed przywróceniem zatrzymaj dyno (`heroku ps:scale web=0`), a po nim uruchom je ponownie (`heroku ps:scale web=1`).

## Wyniki testów migracji

| Test | Wynik |
| --- | --- |
| Neon przed migracją | PostgreSQL 17.11, około 9 MB z 1 GB limitu Essential-0, jedyne rozszerzenie `plpgsql` |
| Próba lokalna (`pg_dump` z Neon, `pg_restore` do PostgreSQL 17.11) | identyczne liczby wierszy 23 tabel, wartości 15 sekwencji i skróty treści 22 tabel; backend uruchomiony na kopii, Flyway i Hibernate bez błędów |
| Pamięć w kontenerze 512 MB | szczyt RSS 410 MB przy 20 graczach i 40 równoległych meczach z ponownym łączeniem; bez `OutOfMemoryError` |
| Próba na Heroku | identyczne liczby wierszy, sekwencje i treść; logowanie, pojedynek, bannery, pliki i realtime działają; pamięć dyno do 336 MB |
| Przełączenie 18.10.2026 | Neon w trybie tylko do odczytu, końcowy zrzut 23 tabel i 15 sekwencji zgodny w całości; użytkownicy pozostali zalogowani |

## Przełączenie i postępowanie przy awarii

Przełączenie wykonano tak:

1. Wdrożenie aktualnego `main` na Heroku i Pages z `VITE_API_URL=https://api.hackademy.app`.
2. Zablokowanie zapisów w Neon: `ALTER DATABASE neondb SET default_transaction_read_only = on;` i zakończenie istniejących sesji przez `pg_terminate_backend`.
3. Zatrzymanie dyno, `heroku pg:reset`, `pg_dump` z Neon, `pg_restore --no-owner --no-privileges` do Heroku i porównanie liczby wierszy, sekwencji oraz skrótów treści.
4. `FRONTEND_URL=https://hackademy.app` i uruchomienie dyno.
5. Domena `hackademy.app` w projekcie Pages, reguła `www to apex` i rekord `www` z proxy.

Po przełączeniu usunięto usługi Render i `render.yaml`. Projekt Neon pozostaje tymczasowo jako dodatkowa kopia danych sprzed przełączenia, w trybie tylko do odczytu; aplikacja z niego nie korzysta. Kopia Heroku `b001` z 18.10.2026 zawiera te same dane, więc Neon można usunąć w dowolnym momencie.

Przy awarii po wdrożeniu najpierw cofnij zmianę przez revert PR-a na `main`; workflow wdroży poprzednią wersję tą samą drogą. Przy utracie lub uszkodzeniu danych przywróć ostatnią poprawną kopię zgodnie z sekcją „Kopie zapasowe”.

## Certyfikat i domeny

- `heroku certs:auto -a hackademy` pokazuje stan certyfikatu ACM. Prawidłowy stan to `Cert issued`; odnowienie następuje miesiąc przed wygaśnięciem.
- Jeśli ACM zgłasza błąd, sprawdź, czy rekord `api` wskazuje adres z `heroku domains -a hackademy`, czy tryb SSL to Full (strict) i czy `http://api.hackademy.app/.well-known/acme-challenge/test` przekierowuje do `va-acm.heroku.com`.
- CORS dopuszcza tylko `https://hackademy.app`, więc `www.hackademy.app` ani `hackademy.pages.dev` z podglądami nie mogą wywoływać API. Dodatkowy origin wymaga ustawienia `CORS_ALLOWED_ORIGINS` z pełną listą, łącznie z `https://hackademy.app`, bo ta zmienna zastępuje `FRONTEND_URL`. Bezpośredni adres `hackademy-6d39a54d38e4.herokuapp.com` nadal odpowiada; odrzucanie ruchu z pominięciem Cloudflare opisuje #131.
