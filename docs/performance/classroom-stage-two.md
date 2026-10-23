# Jednoczesne wejście klasy: etap 2

Ticket #206, etap 2/4. Bazą jest etap 1 z PR #235. Metoda i ograniczenia pomiaru PostgreSQL są opisane w [etapie 1](classroom-stage-one.md).

## Żądania klienta

Widoczny, bezczynny dashboard wykonywał 8 regularnych żądań/min (recent-solved i active-time co 15 s). Teraz wykonuje jedno active-time/min. Oznacza to ośmiokrotną redukcję stałego ruchu. Test kontrolowanego zegara przez trzy minuty potwierdza 3 wywołania po jednym początkowym pulsie, bez pobierania recent-solved. To pomiar logiki klienta w jsdom z atrapą transportu aktywności, nie pomiar Cloudflare ani otwartych przeglądarek na produkcji.

Ostatnie rozwiązania pochodzą z podsumowania (do 20 wpisów) i są odświeżane po powodzeniu rozwiązania oraz raz na visibilitychange do widocznej karty. Focus nie generuje kolejnego żądania. Powrót z aktywnym snapshotem realtime nie pobiera stanu przez HTTP.

Konto, onboarding i preferencje mają wspólne pobranie `/api/user/me`. Dane konta współdzieli cache z TTL 60 s, własny ranking 30 s. Limit to 64 klucze, wspólne żądanie w toku, osobne kopie odpowiedzi i rozdzielenie sesji. Udane mutacje unieważniają odczyty, poza impulsem aktywności. Zmiana sesji przerywa stare żądania; nieudane odpowiedzi i nieprawidłowe dane konta nie pozostają w cache.

Dane strony mogą ładować się w ukrytym, nieinteraktywnym kontenerze równolegle z kontrolą onboardingu. Awatar pozostaje obowiązkowy przed pokazaniem strony.

Dashboard i arena korzystają ze znajomych oraz bilansu pojedynków w jednym stanie realtime. Nie wysyłają dodatkowej listy znajomych ani żądań statystyk na każdą osobę. Arena pobiera mały `/api/ranking/me`. Widok walki pomija pobranie gry, gdy ma już właściwy stan realtime. CORS cache preflight wynosi 7200 s.

## Baza

Puls aktywności wykonuje jeden upsert. Przyrost wylicza PostgreSQL z własnego czasu, maksymalnie 60 s pomiędzy impulsami. Ukrycie ustawia aktywność na false, powrót rozpoczyna nowy okres bez doliczania czasu w tle. Klient nie może zwiększyć czasu przez przesłanie deltaSeconds. Test PostgreSQL sprawdza ponowienie, ograniczenie przyrostu, ukrycie i powrót.

Nowa migracja V23 dodaje jedną flagę aktywności. Dotychczasowe migracje pozostają bez zmian.

## Powtórny pomiar obciążenia

Przed: [wyniki etapu 1](stage-one-after.json). Po: [surowy raport etapu 2](stage-two-after.json). Nadal Hikari 5 i sterta 160 MiB.

- 30 wejść: 0 błędów, p95 798 ms, 12,33 SQL/żądanie, szczyt 5 zajętych połączeń i 9 oczekujących, sterta 125,2 MiB.
- 300 wejść: 0 błędów, p95 554 ms, 12 SQL/żądanie, szczyt 5 zajętych i 7 oczekujących, sterta 124,3 MiB.
- 90 prób odpowiedzi w jednym pokoju: 0 błędów, p95 712 ms, dokładne 3000 punktów i 30 ukończeń.

Etap obniża liczbę żądań klienta, nie liczbę SQL podsumowania. Różnice czasu i sterty pomiędzy pojedynczymi lokalnymi przebiegami nie stanowią trendu wydajności. RSS dyno i rzeczywista sesja kilkuminutowa nie były tu mierzone.

## Weryfikacja

Frontend: 701 testów w 91 plikach, pokrycie linii 91,50%. Zmienione obszary: HTTP 100%, onboarding API 100%, realtime context 100%, sesja areny 100%, ArenaPage 95,93%, user API 84%. Build, TypeScript, ESLint i diff --check przechodzą. Backend: 723 testy, zero błędów, jeden pominięty test opcjonalny. JaCoCo: RealtimeFriendshipStateService 100%, UserServiceImpl 100%, UserController 88,89%, RankingController 86,67%, CORS 100%.

Do pomiaru środowiskowego pozostają przeglądarki z długą sesją oraz restart backendu. Ten raport nie zastępuje monitorowania produkcji.
