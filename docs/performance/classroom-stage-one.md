# Jednoczesne wejście klasy: etap 1

Ticket: #206. Pomiar lokalny 22.10.2026, PostgreSQL 17 w Testcontainers, Hikari 5, JVM `-Xmx160m`.

## Wynik

Przed zmianą wszystkie 30 żądań dashboardu zakończyły się błędem, p95 wyniosło 40 554 ms. Po zmianie 30/30 zakończyło się powodzeniem, p95 741 ms. Dla 300 użytkowników: 300/300, p95 478 ms. Cache podsumowań był pusty przed każdym przebiegiem. Drugi przebieg korzystał z rozgrzanej JVM, dlatego nie należy porównywać jego czasu bezpośrednio z pierwszym.

90 równoczesnych prób w jednym pokoju (30 użytkowników, poprawna i powtórzona poprawna odpowiedź oraz błędna odpowiedź) nie wywołało błędów. Każdy użytkownik otrzymał dokładnie 100 punktów, licznik pokoju i liczba ukończeń wyniosły 30. p95 722 ms.

Surowe wyniki: [przed](stage-one-before.json), [po](stage-one-after.json).

## Baza i pamięć

Dashboard wykonuje około 12 zapytań na żądanie, łącznie z uwierzytelnieniem. Licznik obejmuje prepared statements Hibernate oraz jedno zapytanie JDBC agregujące cztery metryki. Nie porównujemy liczby SQL starej wersji, ponieważ żądania nie kończyły pełnej pracy. Maksymalnie zajęte było 5 połączeń. Liczba oczekujących na połączenie spadła z 15 do 9 (30 wejść) i 7 (300 wejść).

Szczyt użytej sterty w próbkowaniu co 5 ms: przed 121,4 MiB, po 110,0 MiB dla 30 wejść i 115,3 MiB dla 300. To pomiar sterty, nie RSS całego procesu ani pamięci dyno. Dane użytkowników są minimalne, bez historii produkcyjnej.

Tomcat ma 12 wątków obsługi zamiast 200, 2 wątki zapasowe, kolejkę przyjęcia 320 i maksymalnie 512 połączeń HTTP. Hikari pozostaje na 5: jeden Basic nie powinien zajmować całego limitu 20 połączeń Essential-0, potrzebny jest zapas dla operacji administracyjnych i okresu nakładania się procesów przy wdrożeniu. Limit oczekiwania na połączenie wynosi 1,5 s zamiast 10 s. Przeciążenie bazy zwraca 503 z Retry-After, także podczas uwierzytelnienia, bez wylogowania konta.

## Co zmieniono

- OSIV wyłączone. Podsumowanie dashboardu korzysta z jednej jawnej transakcji i sekwencyjnych zapytań zamiast dziewięciu zadań oczekujących na tę samą pulę. Cztery metryki połączono w jeden odczyt SQL.
- Zwykłe uwierzytelnienie nie blokuje wiersza konta. Powiązanie konta i zmiana emaila zachowują blokadę oraz kontrolę usuniętych kont.
- Odpowiedzi na zadania nie blokują wspólnego wiersza pokoju. Blokada użytkownika serializuje jego powtórzone odpowiedzi, istniejące ograniczenia unikalności zabezpieczają ukończenia, a licznik pokoju rośnie atomowo.
- STOMP używa heartbeat z Worker, wymuszonego zamknięcia starego transportu i wykładniczego reconnectu z losowym początkowym opóźnieniem 1–5 s, maksymalnie 60 s. Serwer wysyła heartbeat co 10 s; odbiorca toleruje opóźnienie karty w tle. Kolejki kanałów ograniczono do 128.
- UKOS odlicza 45 s dopiero po pobraniu obrazu. Postęp pobierania pozostaje widoczny. Wszystkie pliki obrazu mają wersjonowany katalog objęty immutable, a wersja zależy od skrótów całego zestawu plików.

## Odtworzenie i granice pomiaru

Uruchomić `mvn -f server/pom.xml -Dtest=ClassroomEntryLoadTest test` z `JAVA_TOOL_OPTIONS=-Xmx160m`. Wersja bazowa używa tego samego testu i dodatkowo `-Dclassroom.baseline=true`. Raport powstaje w `server/target/classroom-stage-one.json`.

Test uruchamia równoczesne zgłoszenia na executorze o 12 wątkach, zgodnym z limitem aplikacji. Czas jest liczony od wspólnego zwolnienia zgłoszeń, obejmuje oczekiwanie w kolejce. MockMvc pomija sieć, router Heroku i rzeczywistą kolejkę TCP. Nie jest to dowód przepustowości produkcji. Test 300 wejść dotyczy endpointu dashboardu, a nie pełnego zestawu żądań 300 przeglądarek.

Etap 1 nie zmienia regularnych odpytań HTTP: z kodu dashboardu wynika około 8 żądań/min na bezczynną widoczną kartę (4 recent-solved i 4 active-time), poza wejściem i realtime. Redukcja należy do etapu 2. Nie wykonano jeszcze kilkuminutowego pomiaru przeglądarek, restartu całego backendu ani 30-minutowego testu ukrytej karty. Brak dostępnej przeglądarki automatyzacji w tej sesji; konfigurację heartbeat i sprzątanie transportu sprawdzają testy jednostkowe.

## Weryfikacja

Backend: 719 testów, 0 błędów, 1 pominięty test opcjonalny. Frontend: 695 testów w 90 plikach, 0 błędów; 91,42% pokrycia linii całego testowanego frontendu, 97,98% w ukierunkowanym zestawie realtime/UKOS. Produkcyjny build, TypeScript i ESLint przeszły. JaCoCo: ClerkUserResolver 100%, ClerkAuthenticationFilter 100%, RoomServiceImpl 100%, DashboardMetrics 100%, DashboardController 94,44%. Dodatkowy test obsługi przeciążenia przeszedł. Testy zasobów Node: 30/30, diff --check bez błędów.
