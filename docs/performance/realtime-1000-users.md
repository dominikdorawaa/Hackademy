# Powiadomienia realtime przy 1000 użytkowników

Pomiar wykonano 11 października 2026 na Windows, lokalnie, z Javą 21.0.9 i 28 procesorami logicznymi. Backend uruchomiono przez Spring Boot na losowym porcie, z H2 i produkcyjną pulą Hikari o rozmiarze 5. Test nie używa bazy ani kont produkcyjnych.

1000 osobnych kont oczekiwało w kolejce Areny, bez dostępnych pokoi, i miało 1000 uwierzytelnionych połączeń STOMP. Każde konto korzystało z produkcyjnego `RealtimeProvider` i `RealtimeConnection`. Test zastępuje transport SockJS bezpośrednim WebSocketem Node `ws`, a logowanie dostarczeniem JWT testowego konta. Komponent React renderuje rewizję i liczbę zaproszeń oraz wyzwań w DOM-ie jsdom. Zdarzenia przechodzą przez prawdziwy HTTP, JWT, transakcje, executor i broker backendu.

Po pobraniu stanu początkowego test obserwował 11 sekund bezczynności. Następnie wysłał 100 zaproszeń do znajomych i 100 wyzwań, po 10 równoległych akcji, do 200 różnych odbiorców. Czas liczony jest od rozpoczęcia HTTP POST do `useLayoutEffect` po aktualizacji DOM-u odbiorcy, a nie tylko do odpowiedzi HTTP lub odebrania ramki.

Wyniki ostatniego uruchomienia:

- 1000 jednocześnie podłączonych użytkowników, wszyscy w kolejce.
- 1000 początkowych `GET /api/realtime/state` i 200 żądań wykonujących akcje, razem 1200 HTTP. Handshake WebSocket i ramki STOMP nie są w tej liczbie.
- 0 żądań HTTP przez 11 sekund bezczynności i 0 odpytań `/api/friends/requests`, `/api/arena/challenges` oraz `/api/arena/status`.
- p50 aktualizacji React: 7,50 ms; p95: 11,01 ms; maksimum: 47,77 ms. Wszystkie 200 aktualizacji dotarło. Faza akcji trwała 0,36 s.
- Średnie zużycie CPU procesu backendu: 0,37 rdzenia w okresie od udostępnienia kont testowych do zakończenia klienta, włącznie z bezczynnością. Szczyt zajętej pamięci heap JVM: 262 MiB; szczyt liczby wątków JVM: 50. Pomiar nie obejmuje procesu Node.

W tym scenariuszu p95 spełnia cel poniżej 500 ms. Wynik nie jest gwarancją dla sieci użytkownika, przeglądarki, produkcyjnego PostgreSQL, VPN ani wielu instancji backendu. Test mierzy commit React w jsdom, bez kosztu rzeczywistego malowania przeglądarki. Pomiar wydajności obejmuje tworzenie zaproszeń i wyzwań; akceptacje, odrzucenia, wyniki i znalezienie meczu weryfikują osobne testy integracyjne, bez deklarowania dla nich zmierzonego p95.

Powtórzenie w dwóch terminalach PowerShell, z korzenia repozytorium:

```powershell
cd server
mvn test -Dtest=RealtimeLoadTest -Drealtime.load=true
```

Po pojawieniu się `server/target/realtime-load-fixtures.json` uruchom klienta w drugim terminalu:

```powershell
cd client
npm ci
$env:REALTIME_LOAD = 'true'
npm run test:realtime-load
```

Backend czeka maksymalnie sześć minut na zakończenie klienta. Klient sprawdza 1000 stanów kolejki, brak HTTP podczas bezczynności, dostarczenie 200 zmian i p95 poniżej 500 ms. Pliki `server/target/realtime-load-client.json` oraz `server/target/realtime-load-server.json` zawierają surowe wyniki. Konta i JWT testowe w `target/realtime-load-fixtures.json` są tymczasowe i nie trafiają do repozytorium. Przy kolejnym uruchomieniu poczekaj na nową datę modyfikacji tego pliku.

Pierwszy pomiar wykrył wyczerpanie puli bazy przy synchronicznym odczycie `REQUIRES_NEW` w obsłudze `AFTER_COMMIT`. Dostarczanie przeniesiono na osobny executor z dwoma wątkami; przedstawione wyniki dotyczą poprawionej wersji, bez zwiększania puli połączeń.
