# Jednoczesne wejście klasy: etap 4

Ticket #206, etap 4/4. Baza: etap 3 z PR #237.

## Ładowanie i renderowanie

Główny plik JavaScript zmniejszył się z 1542,70 KB do 813,07 KB, o 47,30%. Gzip: 467,67 KB do 253,56 KB. Próg 25% został przekroczony. [Pomiar bundla](stage-four-bundle.json). Panel administratora, w tym Recharts, i większe strony mają osobne chunki ładowane przy wejściu na ich trasę.

Zewnętrzne arkusze Google Fonts i Font Awesome nie blokują parsera strony; są aktywowane przy uruchomieniu aplikacji. Pozostają dotychczasowe rodziny i wygląd. Preconnect do API i Clerka jest generowany z konfiguracji środowiska przy budowaniu, z walidacją publicznej domeny Clerka. Test nie używa rzeczywistych kluczy.

Zegar pojedynku zatrzymuje interwał po końcu gry i w ukrytej karcie. Po powrocie uwzględnia czas, który upłynął; test potwierdza brak aktualizacji w tle i sprzątnięcie timerów. Wartości kontekstów konta, onboardingu, preferencji, realtime i motywu są memoizowane; kontekst powiadomień znajomych był już memoizowany. PathCard był już zdefiniowany poza PathsPage w aktualnym main, więc nie wymagał przenoszenia.

403 pokazuje błąd uprawnień i zachowuje sesję. Tylko 401 po ponowieniu z nowym tokenem może zakończyć sesję. Test integracyjny profilu obejmuje oba przypadki.

## Administracja

Użytkownicy i zgłoszenia są stronicowani w SQL: domyślnie po 50, maksymalnie po 100. Slice pobiera dodatkowy wiersz do ustalenia hasNext, bez liczenia wszystkich wyników. Użytkownicy mają wyszukiwanie po stronie serwera i reset strony po zmianie frazy. Kontrolki poprzedniej/następnej strony są zwykłymi przyciskami z obsługą klawiatury. Testy obejmują przechodzenie stron, zmianę roli, usunięcie konta, moderację zgłoszeń i ponowienie nieudanej operacji.

Nowa migracja V25 dodaje indeksy users(created_at), user_solved_rooms(solved_at, id) oraz częściowy indeks zgłoszonych chat_messages(sent_at, id). Wcześniejsze migracje pozostają bez zmian.

## Pomiar końcowy

Warunki: PostgreSQL 17 Testcontainers, Hikari 5, Xmx160m. [HTTP i restart](stage-four-http.json), [MockMvc i wspólny pokój](stage-four-after.json). Punktem odniesienia są [pomiary etapu 3](stage-three-http-restart.json).

- Prawdziwe HTTP: 30/30 sukcesów, p95 450 ms; 300/300, p95 765 ms. Około 12 SQL na dashboard łącznie z uwierzytelnieniem.
- Klasa przez trzy minuty: 30 połączeń WebSocket, 1 regularne żądanie/osobę/min, p95 pulsów 31, 35 i 21 ms; 3 SQL na puls, w tym uwierzytelnienie i jeden upsert.
- Restart zamyka backend przy otwartych połączeniach. Wszystkie 30 osób odzyskało połączenie, z rozrzutem opóźnień i limitem 8 równoległych klientów generatora, w 13,1 s. Timery obecności są anulowane przy zamykaniu aplikacji.
- Maksymalnie zajęte było 5 połączeń, oczekiwało 8; szczyt sterty całego procesu testowego 141,25 MiB z limitu 160. Generator HTTP i klienty WebSocket działają w tej samej JVM, więc wynik nie jest samą pamięcią serwera ani RSS dyno.
- MockMvc: 30 i 300 wejść bez błędów; 90 poprawnych, błędnych i powtórzonych odpowiedzi w jednym pokoju bez błędów, z dokładnie 3000 punktów i 30 ukończeniami.

Pomiar sieciowy wykonano na c3972a1. Późniejsze poprawki spójnego snapshotu odznak i stabilizacji testów UI nie zmieniają odczytów uruchamianych przez ten scenariusz. Różnice p95 między pojedynczymi lokalnymi przebiegami zależą od rozgrzania JVM i obciążenia komputera; nie stanowią pomiaru wydajności Heroku.

## Weryfikacja i pozostałe pomiary środowiskowe

Frontend: 707 testów w 93 plikach, pokrycie linii 92,33%. Ukierunkowane testy list administracyjnych: 93,47% (UsersPage 93,33%, ReportsPage 93,61%). Zegar areny, kontrolki stron i odroczone style: 100%. Testy zasobów Node: 31/31. Build, TypeScript, ESLint i diff --check przechodzą.

Backend: 738 testów, zero błędów, dwa pominięte testy opcjonalne; test HTTP/restart był uruchomiony osobno. Kontrolowany przeplot przyznania odznaki z odczytem profilu również przechodzi. Zmienione metody paginacji, PageResult i ChatServiceImpl mają pełne pokrycie; UserServiceImpl, BadgeServiceImpl i FriendPresence 100%. Raport JaCoCo powstaje w server/target/site/jacoco.

Wyniki dotyczą lokalnego HTTP/STOMP i ograniczonej sterty, nie pełnych przeglądarek ani routera Heroku. Test nie odtwarza wszystkich żądań startowych 300 kart. Do potwierdzenia w środowisku docelowym pozostają 30 minut ukrytej karty, pamięć RSS i rzeczywiste Core Web Vitals na desktopie oraz urządzeniu mobilnym. W tej sesji automatyzacja przeglądarki nie udostępniała żadnej przeglądarki; próba uruchomienia IAB zwróciła Browser is not available. Nie raportujemy niezmierzonych LCP/INP/CLS ani wizualnej kontroli urządzeń jako zaliczonych.
