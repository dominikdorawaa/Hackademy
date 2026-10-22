# Jednoczesne wejście klasy: etap 3

Ticket #206, etap 3/4. Baza: etap 2 z PR #236. Pomiary lokalne na PostgreSQL 17, bez danych produkcyjnych.

## Stały koszt realtime

Zimny odczyt stanu społecznościowego wykonywał 9 zapytań przy 5 znajomych i 34 przy 30. Po pobraniu obu stron relacji w zapytaniu wykonuje 4 w obu przypadkach. To pomiar samego serwisu, bez SQL uwierzytelnienia. Aktualizacje areny korzystają z gotowego snapshotu społecznościowego; zmiana znajomości, profilu i obecności unieważnia właściwe wpisy. TTL stanowi dodatkowy bezpiecznik 30 s.

Surowe wyniki: [przed](stage-three-realtime-before.json), [po](stage-three-realtime-after.json). Czas pojedynczego pierwszego odczytu zależy od rozgrzania JVM; celem tego testu jest liczba SQL, nie p95.

Zdarzenia jednej osoby są łączone przed dostarczeniem, z rytmem 50 ms. Kolejka pending mieści do 1024 osób; ponad limit wysyłany jest sygnał ponownej synchronizacji. Offline nie odkłada historii zdarzeń do wysłania po ponownym połączeniu. Executor ma 2 wątki i kolejkę 64 zadań. Jeden cykl planuje maksymalnie 32 osoby; przy pełnej kolejce odkłada pracę na kolejny cykl. Przy sprawnej bazie budżet na 300 osób wynosi około 0,5 s samego planowania, plus czas SQL. Test sprawdza scalanie 100 zdarzeń, przepełnienie i ponowienie. Koniec walki ma jedną publikację.

## SQL i pamięć

- V24 dodaje indeks friendships(requester_id, status). Wyszukiwanie pary używa LEAST/GREATEST, zgodnie z istniejącym unikalnym indeksem uq_friendships_pair.
- EXPLAIN (ANALYZE, BUFFERS) na ponad 1000 relacji potwierdza oba indeksy: odczyt nadawcy i odczyt pary mają po 3 trafienia bufora, zamiast skanu 11 stron w próbce bazowej. [Plany przed](stage-three-friendship-plans-before.txt), [plany po](stage-three-friendship-plans.txt).
- Szczegóły pokoju mają osobną projekcję nazwy pliku. Usunięto odwrotne mapowanie OneToOne, które mogło pobierać załącznik nawet bez jawnego użycia getRoomFile. Test z plikiem 1 MiB potwierdza zero załadowanych encji RoomFile podczas odczytu treści, a następnie poprawne pobranie pliku.
- Identyfikatory ukończonych zadań są ograniczone do pokoju. Ścieżka pobiera tylko własne pokoje i rozwiązania; JSON zawiera pokoje jedynie w chapters, bez drugiej kopii rooms.
- Przyznawanie odznak odczytuje zdobyte identyfikatory oraz liczniki zbiorczo, bez sprawdzania każdej odznaki osobnym SQL.
- Wyszukiwarka wymaga 2 znaków, ogranicza frazę do 64 znaków i wyniki do 20. Statusy znajomości pobiera jednym zapytaniem.
- /me korzysta z użytkownika z uwierzytelnienia. Personalizacja czyta dwie małe kolekcje bez ponownego odczytu wiersza konta, a onboarding używa już dostępnych pól. Test potwierdza jeden odczyt encji User na cały request, łącznie z uwierzytelnieniem.

Cache korzystają z Caffeine: ograniczenie rozmiaru, wygasanie, sprzątanie i pojedynczy loader na klucz. Dashboard mieści 512 wpisów przez 10 min; oczekiwanie na wspólne odświeżenie odbywa się przed otwarciem transakcji. Rankingi i dostęp VPN mają do 1024 wpisów przez 30 s, globalna tabela rankingu jeden wpis. Cache społecznościowy ma łączny budżet 10 000 rekordów osób/żądań, pomocnicze listy po 5000. Limit uwzględnia wielkość list, nie tylko liczbę kont. Zmiana profilu unieważnia jego dane i dane powiązanych osób, bez czyszczenia wszystkich dashboardów.

Arena indeksuje bieżącą grę po użytkowniku, zachowuje zakończone gry do 5 min i maksymalnie 512 wpisów historii po sprzątaniu. Wyzwania wygasają po 2 min również dla osób online, z limitem 1024 oczekujących. Nieużywane kolejki reakcji są usuwane. Matchmaking rezerwuje pary pod krótką blokadą pamięci, wykonuje odczyty bazy poza nią i zwalnia rezerwacje po błędzie przygotowania. Testy zachowują możliwość ponowienia pary oraz wykluczają podwójny pojedynek.

## Obciążenie i weryfikacja

Przed: [etap 2](stage-two-after.json), po: [raport etapu 3](stage-three-after.json). Hikari pozostaje na 5, sterta 160 MiB. Test obejmuje 30 i 300 zimnych dashboardów oraz 90 poprawnych, błędnych i powtórzonych odpowiedzi w jednym pokoju. Zero błędów; punkty i liczniki dokładne. Raport JSON zawiera p95, SQL, zajętość puli i szczyt sterty. Metoda MockMvc i jej ograniczenia pozostają takie jak w etapie 1.

Backend: pełny przebieg 732 testy, zero błędów, dwa testy obciążeniowe opcjonalne pominięte; dodatkowe dwa testy odczytów pokoju i /me również przechodzą. JaCoCo: LocalCaches 100%, RealtimeDelivery 100%, CurrentProfileDetails 100%, FriendshipServiceImpl 100%, DashboardSummaryReader 97,83%, ArenaServiceImpl 97,78%, MatchmakingServiceImpl 95,12%. TypeScript, ESLint, testy API klienta i diff --check przechodzą.

Opcjonalny test rzeczywistego HTTP, WebSocket i restartu: `mvn -f server/pom.xml -Dtest=ClassroomHttpLoadTest -Dclassroom.http=true -Dclassroom.minutes=3 test`, z JAVA_TOOL_OPTIONS=-Xmx160m. Wynik powstaje w server/target/classroom-http.json. Klient obciążeniowy działa w tej samej JVM, więc odczyt sterty obejmuje także klienta i fixture testowe; nie jest RSS dyno. Wyniki tego dłuższego testu są uzupełniane przed zamknięciem całego zadania.
