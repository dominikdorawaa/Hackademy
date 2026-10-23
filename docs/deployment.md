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

Po rotacji tokenu właściciel repozytorium podmienia sekret, a stary token jest odwoływany. Workflow nie zmienia konfiguracji strefy Cloudflare; robi to ręcznie skrypt z sekcji „Ochrona API przez Cloudflare”.

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
| `CLERK_ISSUER` | adres Frontend API produkcyjnej instancji Clerka |
| `CLERK_JWT_KEY` | opcjonalny publiczny klucz PEM; bez niego backend pobiera JWKS wystawcy |
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

Przy awarii po wdrożeniu najpierw cofnij zmianę przez revert PR-a na `main`; workflow wdroży poprzednią wersję tą samą drogą. Revert nie cofa migracji Flyway: starsze wydanie nie uruchomi się na bazie z nowszą migracją. Dla przełączenia na Clerk (migracja V21) stosuj procedurę powrotu z [docs/clerk-migration.md](clerk-migration.md). Przy utracie lub uszkodzeniu danych przywróć ostatnią poprawną kopię zgodnie z sekcją „Kopie zapasowe”.

## Certyfikat i domeny

- `heroku certs:auto -a hackademy` pokazuje stan certyfikatu ACM. Prawidłowy stan to `Cert issued`; odnowienie następuje miesiąc przed wygaśnięciem.
- Jeśli ACM zgłasza błąd, sprawdź, czy rekord `api` wskazuje adres z `heroku domains -a hackademy`, czy tryb SSL to Full (strict) i czy `http://api.hackademy.app/.well-known/acme-challenge/test` przekierowuje do `va-acm.heroku.com`.
- CORS dopuszcza tylko `https://hackademy.app`, więc `www.hackademy.app` ani `hackademy.pages.dev` z podglądami nie mogą wywoływać API. Dodatkowy origin wymaga ustawienia `CORS_ALLOWED_ORIGINS` z pełną listą, łącznie z `https://hackademy.app`, bo ta zmienna zastępuje `FRONTEND_URL`. Bezpośredni adres `hackademy-6d39a54d38e4.herokuapp.com` odpowiada `403`, gdy ustawiono `ORIGIN_GUARD_SECRETS` (sekcja „Ochrona API przez Cloudflare”).

Integracja Clerka wymaga przeprowadzenia [procedury migracji kont](clerk-migration.md) przed wdrożeniem. Build Cloudflare Pages otrzymuje produkcyjny `VITE_CLERK_PUBLISHABLE_KEY` ze zmiennej repozytorium GitHub. Klucz sekretny służy wyłącznie do importu; zwykła obsługa API weryfikuje JWT przez JWKS.

## Ochrona API przez Cloudflare

Konfiguracja strefy jest w `tools/cloudflare/` (#131): `rules.mjs` opisuje reguły, a `apply.mjs` zapisuje je w Cloudflare. Skrypt nadpisuje w całości tylko fazy `http_request_late_transform`, `http_request_cache_settings`, `http_config_settings` i `http_ratelimit` oraz ustawienie `min_tls_version`. Reguł przekierowań (`api https`, `www to apex`) i reguł zarządzanych nie zmienia. Przed zapisem odczytuje fazy i przerywa, jeśli znajdzie regułę dodaną poza skryptem (bez prefiksu `hackademy_` w `ref`), chyba że podano `--force`. Taką regułę trzeba najpierw przenieść do `rules.mjs`.

Dla usuniętego `/api/auth` nie ma i nie dodajemy żadnej reguły. Logowanie obsługuje Clerk na `clerk.hackademy.app` i `accounts.hackademy.app` (rekordy DNS bez proxy).

### Cache

| Ruch | Zasada |
| --- | --- |
| `/static/*` na Pages | `public, max-age=31536000, immutable`; nazwy plików zawierają skrót treści |
| HTML, głębokie linki SPA, favikony, logotypy, `/assets/*`, `robots.txt`, `sitemap.xml`, `/prototypes/runtime/*` | `public, max-age=0, must-revalidate`; przeglądarka sprawdza ETag przy każdym wejściu, więc po wdrożeniu dostaje nowe pliki |
| `api.hackademy.app` | reguła cache `cache: false`; odpowiedzi nigdy nie trafiają do cache Cloudflare |

- `_headers` ustawia tylko politykę `/static/*`. Pozostałe pliki dostają domyślny nagłówek Pages `public, max-age=0, must-revalidate` razem z ETag i `X-Content-Type-Options: nosniff`. Treść `_headers` sprawdza test `client/tests/pages-config.test.mjs`.
- Strefa ma Browser Cache TTL 4 h, które może podnieść `max-age=0` plików statycznych. Reguła cache dla `hackademy.app` ustawia `browser_ttl: respect_origin`, żeby obowiązywały nagłówki z Pages.
- Strefa ma poziom cache aggressive, więc bez reguły Cloudflare mógłby zapisać odpowiedź API, której adres kończy się rozszerzeniem z domyślnej listy, np. plik VPN albo chroniony plik pokoju, i podać ją innemu użytkownikowi. `cache: false` wyłącza cache całej domeny API niezależnie od nagłówków backendu (`Cache-Control: no-store`). WebSocket i SockJS (`/ws`) zawsze trafiają do backendu.

### Ustawienia ochrony

- Dla `api.hackademy.app` reguła konfiguracji ustawia `security_level: essentially_off` i wyłącza Browser Integrity Check. Wyzwanie Cloudflare to strona HTML, której `fetch`, XHR ani WebSocket nie rozwiążą, więc każde wyzwanie kończy się błędem w aplikacji. Najbardziej narażona jest klasa za jednym adresem NAT. Browser Integrity Check może zablokować lub sprawdzić żądanie z nietypowymi nagłówkami, a API nie serwuje stron. Dostęp chroni JWT Clerka, a nadużycia ogranicza limit żądań. `hackademy.app` zachowuje ustawienia strefy.
- `min_tls_version` to 1.2 dla całej strefy.
- Nadal działają Cloudflare Managed Free Ruleset i ochrona DDoS L7.

Limit żądań to jedyna reguła `http_ratelimit` dostępna w planie Free:

| Wzorzec ścieżki | Endpoint |
| --- | --- |
| `/api/rooms/*/solve` | flaga pokoju i flaga zadania |
| `/api/rooms/*/hints/*/unlock` | odblokowanie podpowiedzi |
| `/api/friends/request/*` | zaproszenie do znajomych |
| `/api/arena/challenge/create` | wyzwanie na arenie |

- Próg: 150 żądań w 10 s na adres IP w jednym centrum danych Cloudflare, potem blokada na 10 s. Reguła liczy każdą metodę, także preflight CORS (`OPTIONS`), który przeglądarka wysyła przed pierwszym POST pod nowy adres. Klasa 30 osób za jednym NAT, w której każdy wysyła w tych samych 10 s dwie odpowiedzi pod różne adresy, daje 120 żądań i mieści się w limicie. Skrypt z jednego adresu wyśle najwyżej 15 takich żądań na sekundę.
- Plan Free pozwala w wyrażeniu tylko na ścieżkę, bez hosta, metody i wyrażeń regularnych. Reguła używa więc operatora `wildcard`, w którym `*` obejmuje też `/`. Ścieżki `/api/` istnieją tylko w API, a pod tymi adresami backend przyjmuje tylko POST. Reguła nie obejmuje `/ws`, odpowiedzi w pojedynku (`/api/arena/game/{id}/answer`) ani zwykłych zapytań GET.

Plan Free nie zatrzyma każdego ataku. Limit liczy się osobno w każdym centrum danych, nie ma własnych reguł WAF w trybie zarządzanym, ochrony przed botami ani płatnych produktów. Autoryzacja i walidacja zostają w backendzie.

### Weryfikacja pochodzenia

1. Transform Rule dodaje do każdego żądania do `api.hackademy.app` nagłówek `X-Origin-Verify` z sekretem. Wartość wysłana przez klienta zostaje nadpisana.
2. Backend porównuje nagłówek z listą `ORIGIN_GUARD_SECRETS` (wartości oddzielone przecinkami). Bez zgodności zwraca `403` z pustą treścią, zanim zadziała Spring Security, kontrolery i baza. Pusta lub nieustawiona zmienna wyłącza sprawdzanie.
3. Backend uznaje `CF-Connecting-IP` za adres klienta dopiero po zgodnym sekrecie.
4. `/health` też wymaga nagłówka; workflow wdrożenia sprawdza go przez `api.hackademy.app`. ACME nie potrzebuje wyjątku, bo router Heroku odpowiada na `/.well-known/acme-challenge/` przed aplikacją.

Sekret nie trafia do repozytorium, przeglądarki, odpowiedzi ani logów. Przechowujemy go w menedżerze haseł. Skrypt pokazuje go zawsze jako `[redacted]`.

### Uruchomienie skryptu

Skrypt wymaga Node 24 i nie ma zależności. Bez `--apply` niczego nie zmienia i tylko wypisuje planowane żądania. `--diff` dodatkowo odczytuje obecne reguły ze strefy.

| Zmienna | Opis |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | osobny token tylko na czas zmiany, nie token Pages z sekretów GitHub |
| `CLOUDFLARE_ZONE_ID` | identyfikator strefy `hackademy.app` z panelu Cloudflare (Overview) |
| `ORIGIN_VERIFY_SECRET` | sekret wysyłany przez Cloudflare; co najmniej 32 znaki `A-Z`, `a-z`, `0-9`, `_`, `-` |

Token tworzymy w panelu (My Profile, API Tokens) tylko dla strefy `hackademy.app`, z krótkim czasem ważności, np. 1 dzień, i uprawnieniami Zone: Transform Rules Edit, Cache Rules Edit, Config Rules Edit, Zone WAF Edit (limit żądań) oraz Zone Settings Edit. Po zmianie token usuwamy.

### Kolejność wdrożenia

1. Wdrożenie backendu z filtrem, bez `ORIGIN_GUARD_SECRETS` (filtr wyłączony).
2. Wygenerowanie sekretu przez `openssl rand -hex 32` i zapis w menedżerze haseł.
3. Konfiguracja Cloudflare:

   ```bash
   read -rs CLOUDFLARE_API_TOKEN && export CLOUDFLARE_API_TOKEN
   read -rs ORIGIN_VERIFY_SECRET && export ORIGIN_VERIFY_SECRET
   export CLOUDFLARE_ZONE_ID=0123456789abcdef0123456789abcdef
   node tools/cloudflare/apply.mjs --diff
   node tools/cloudflare/apply.mjs --apply
   ```

4. Włączenie filtra: `heroku config:set ORIGIN_GUARD_SECRETS="$ORIGIN_VERIFY_SECRET" -a hackademy > /dev/null` (przekierowanie, bo Heroku wypisuje ustawioną wartość).
5. Sprawdzenie według listy poniżej.

### Lista kontrolna

- `curl -s -o /dev/null -w '%{http_code}\n' https://hackademy-6d39a54d38e4.herokuapp.com/health` zwraca `403`.
- `curl -fsS https://api.hackademy.app/health` zwraca `200`.
- `curl -sI https://api.hackademy.app/health` pokazuje `cf-cache-status: DYNAMIC` lub `BYPASS`, nigdy `HIT`.
- `curl -sI https://hackademy.app/paths/test` pokazuje `cache-control: public, max-age=0, must-revalidate`, a plik z `/static/` z tej strony `immutable`.
- W przeglądarce: logowanie, lista pokoi, wysłanie flagi, odświeżenie głębokiego linku.
- Realtime: w narzędziach deweloperskich połączenie `wss://api.hackademy.app/ws/.../websocket` z kodem `101` i ramkami STOMP, heartbeat bez rozłączeń przez kilka minut, ponowne połączenie po wyłączeniu i włączeniu sieci oraz zapasowy transport SockJS przy zablokowanym WebSocket.
- Dwa konta w dwóch przeglądarkach: ten sam endpoint, np. `/api/user/me`, zwraca dane właściwego konta, a `cf-cache-status` to `DYNAMIC` lub `BYPASS`.
- ACME: `heroku certs:auto -a hackademy` pokazuje `Cert issued`, a `curl -sI http://api.hackademy.app/.well-known/acme-challenge/test` przekierowuje do `va-acm.heroku.com`.

### Wycofanie

1. Najpierw `heroku config:unset ORIGIN_GUARD_SECRETS -a hackademy`. W odwrotnej kolejności API zacznie odpowiadać `403`.
2. `node tools/cloudflare/apply.mjs --remove-origin-header --apply` usuwa tylko nagłówek. `node tools/cloudflare/apply.mjs --rollback --apply` czyści wszystkie cztery fazy i przywraca TLS 1.0, czyli stan sprzed #131. Oba polecenia wymagają `CLOUDFLARE_API_TOKEN` i `CLOUDFLARE_ZONE_ID`; bez `--apply` pokazują tylko plan.
3. Jeśli problem jest w backendzie, cofamy go revertem PR-a.

### Rotacja sekretu

Sekret zmieniamy po wycieku lub gdy dostęp traci osoba, która go znała.

1. `heroku config:set ORIGIN_GUARD_SECRETS="stary,nowy" -a hackademy > /dev/null`.
2. `node tools/cloudflare/apply.mjs --apply` z nowym `ORIGIN_VERIFY_SECRET`.
3. Sprawdzenie `/health` przez `api.hackademy.app` (`200`) i adres Heroku (`403`).
4. `heroku config:set ORIGIN_GUARD_SECRETS="nowy" -a hackademy > /dev/null` i aktualizacja menedżera haseł.

## Limity żądań w backendzie

Backend ogranicza ruch filtrem `RateLimitFilter` (#132) niezależnie od reguły Cloudflare. Filtr działa w łańcuchu Spring Security przed uwierzytelnieniem Clerka, więc odrzucone żądanie nie dociera do kontrolerów ani bazy, nie zakłada konta i nie zmienia stanu meczu.

| Grupa | Klucz | Burst | Próg | Ruch |
| --- | --- | --- | --- | --- |
| `api-read` | konto Clerka | 150 | 300 na minutę | `GET` i `HEAD` do `/api/` z ważnym tokenem |
| `api-write` | konto Clerka | 50 | 100 na minutę | pozostałe metody do `/api/` z ważnym tokenem |
| `anonymous` | adres IP | 150 | 300 na minutę | żądania bez ważnego tokenu, np. ranking po wylogowaniu |
| `public-banner` | adres IP | 1000 | 1000 na minutę | bannery ścieżek ładowane przez `<img>` bez tokenu |
| `websocket-handshake` | adres IP | 540 | 540 na minutę | `/ws/info` i otwarcie WebSocket |
| `websocket-transport` | adres IP | 600 | 3600 na minutę | pozostałe żądania SockJS (`xhr_send`, `xhr`, `xhr_streaming`) |

- Limit to token bucket: burst to pojemność, próg to tempo odnawiania. Nie liczymy `/health`, `/` ani preflight CORS (`OPTIONS`). Statyczny frontend serwuje Cloudflare Pages.
- Konto ustalamy z podpisanego JWT Clerka bez zapytania do bazy. Żądanie z nieważnym tokenem liczy się do adresu IP.
- Adres IP pochodzi z `CF-Connecting-IP` wyłącznie po zgodnym `X-Origin-Verify` (sekcja „Weryfikacja pochodzenia”). Na Heroku Spring Boot rozpoznaje platformę i przyjmuje `X-Forwarded-For` tylko od wewnętrznego routera. Lokalnie liczy się adres połączenia. Wartości `X-Forwarded-For`, `Forwarded` ani `CF-Connecting-IP` wysłane przez klienta nie zmieniają klucza. Bez `ORIGIN_GUARD_SECRETS` wszystkie żądania anonimowe na produkcji miałyby adresy Cloudflare, dlatego filtr pochodzenia musi być włączony.
- Adresy IPv6 liczymy wspólnie dla prefiksu `/64`, który kontroluje jeden klient.
- Po przekroczeniu limitu odpowiedź ma kod `429`, nagłówek `Retry-After` (udostępniony przez CORS) i treść `{"message": "Zbyt wiele żądań. Spróbuj ponownie za N s.", "retryAfter": N}`. Klient pokazuje komunikat i nie ponawia zapisów sam.
- Liczniki są w pamięci jednej instancji i znikają po restarcie. Tabela ma najwyżej `max-keys` (50 000) kluczy. Klucze, których limit odnowił się w całości, są usuwane. Gdy tabela jest pełna, nowe klucze dzielą jeden wspólny limit grupy.
- Progi dobrał test `RateLimitDefaultsLoadTest` na podstawie ruchu klienta: klasa 30 osób za jednym NAT przez 10 minut (logowanie, szybka nawigacja, bannery ścieżek, przeładowania, zablokowany WebSocket), ponowne połączenie 60 kart po restarcie i pełny pojedynek z reakcjami przechodzą bez odmowy. Limity na adres IP mają zapas co najmniej trzykrotny dla jednej klasy; większa szkoła za jednym adresem wymaga podniesienia progów.
- Nie ma lokalnych endpointów logowania ani rejestracji. Logowanie chroni Clerk. Zakładanie konta przy pierwszym żądaniu z nowym tokenem jest objęte limitem konta.
- `RateLimiter.acquire(scope, id, rule)` może posłużyć do limitu błędnych flag (#40) z własnym zakresem i regułą.

Progi zmieniamy zmiennymi środowiskowymi, np. `APPLICATION_RATELIMIT_RULES_APIREAD_BURST=200`. `RATE_LIMIT_ENABLED=false` wyłącza filtr. Zmiana zmiennej restartuje dyno i zeruje liczniki.
