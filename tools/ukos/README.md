# Prototyp warsztatu UKOS

Lokalna próba techniczna kursu „Dyżur Zero”. Prawdziwy Linux działa w osobnym Web Workerze; interfejs i xterm.js działają w głównym wątku. Sześć ćwiczeń testuje polecenia, nano oraz stan plików. Nie jest to jeszcze kompletne Laboratorium 1.

## Uruchomienie

Z katalogu `client`:

```bash
npm ci
npm run ukos:prepare
npm run ukos:build
npm run ukos:preview
```

Otwórz `http://localhost:5175/prototypes/ukos.html`. Porównawczy start kernela od zera: `http://localhost:5175/prototypes/ukos.html?cold`.

Do pracy nad interfejsem można użyć zwykłego `npm run dev` i ścieżki `/prototypes/ukos.html`. Zmiany runtime mogą przeładować stronę; testy zapisu i wydajności wykonuj na buildzie przez `ukos:preview`.

Potrzebne są Docker z obsługą obrazów `linux/386` i Node z funkcją `zstdCompressSync` w `node:zlib`. Użyto Linuksa x86_64, Dockera 29.7.2 i Node 26.8.1. Budowa korzysta z oficjalnego Alpine oraz npm v86. BIOS-y pochodzą z przypiętego commita v86 i mają sprawdzane SHA-256.

Wygenerowane pliki w `client/prototypes/runtime/` są ignorowane przez Git i są dołączane do buildu jako osobne pliki statyczne. Osobny build prototypu jest w `client/dist-ukos/`. `manifest.json` i `packages.txt` zawierają wersję obrazu, wersje pakietów, rozmiary i skróty plików. Budowa wymusza limit 25 MiB na pojedynczy asset Pages.

## Testy

```bash
npm run ukos:test
npm run ukos:build
npm run ukos:test:browser
npm run lint
```

Testy jednostkowe wymagają co najmniej 80% pokrycia linii każdego pliku prototypu poza punktem wejścia Reacta. Chromium uruchamia prawdziwy obraz i sprawdza polecenia, błędne zaliczenia, nano z polskimi znakami, stan plików, odtworzenie zapisu z zachowaniem usuniętych plików, reset z zachowaniem postępu, blokadę drugiej karty i reakcję strony przy nieskończonej pętli w gościu. Sprawdza też historię, Tab, Ctrl+C i duży strumień wyjścia.

Testy korzystają z `/usr/bin/chromium`, jeśli istnieje. Można ustawić `PLAYWRIGHT_CHROMIUM_EXECUTABLE` albo wykonać `npx playwright install chromium`. Screenshot i pomiary są zapisywane w ignorowanym `client/test-results/`.

## Konstrukcja

- Alpine x86, Bash, nano, coreutils, grep, findutils i narzędzia archiwizacji. Linux otrzymuje 128 MiB RAM; nie jest to całkowita pamięć przeglądarki. Ładowanie initrd w tej wersji v86 używa adresu 64 MiB, dlatego ten obraz nie może bezpośrednio startować z przydziałem 64 MiB.
- `snapshot.mjs` podczas budowy doprowadza Linux do punktu startowego i zapisuje stan z kompresją Zstandard. Przeglądarka odtwarza go zamiast wykonywać rozruch kernela. Zegar gościa jest ustawiany ponownie na początku sesji. Ten stan nie zawiera pracy użytkowników.
- Serial0 obsługuje terminal UTF-8, Serial1 polecenia checkera i archiwa, Serial2 zdarzenia zakończenia komend Basha, Serial3 informacje o zmianach plików. Ocenianie nie analizuje widocznego tekstu terminala.
- Kroki poleceń akceptują udane, samodzielne `pwd` i `ls` z obsługiwanymi opcjami. Odrzucają `echo pwd`, `PWD`, aliasy, funkcje i złożone polecenia maskujące błąd. Kroki wynikowe sprawdzają pliki i treść, pozwalając na różne sposoby rozwiązania.
- Zapis obejmuje archiwum katalogu domowego i numer kroku, nie pełną pamięć maszyny. Inotify uruchamia zapis po 1,2 sekundy bez kolejnych zmian. Jest też zapis ręczny. Niezapisany bufor nano nie jest utrwalany; trzeba użyć Ctrl+O.
- IndexedDB działa w Workerze. Klucz obejmuje konto, laboratorium i wersję obrazu. Prototyp używa stałego konta `local-prototype`. Web Locks chroni przed zapisem z dwóch kart. Reset odtwarza standardowy warsztat początku bieżącego kroku, zachowując lokalny postęp.
- Limit warsztatu 4 MiB, odmowa storage i timeout zapisu mają widoczne błędy. Nie potwierdzamy nieudanego zapisu. Twarde zamknięcie procesu może utracić zmiany od ostatniego potwierdzonego zapisu.
- Ukrycie karty zapisuje pracę i wstrzymuje emulator. Powrót wznawia go. „Zatrzymaj” zapisuje pracę, niszczy emulator i kończy Workera. xterm i emulator ładują się dopiero po uruchomieniu warsztatu. System nie ma skonfigurowanego połączenia z siecią.

## Granice prototypu

Nie ma jeszcze zapisu na koncie, synchronizacji z API ani karty na liście ścieżek. Postęp jest lokalny i podatny na modyfikację klienta; nie daje XP. Zmiana wersji obrazu tworzy nowy warsztat. Migracja lokalnych danych między wersjami wymaga osobnego wdrożenia.

Pomiar localhost nie obejmuje wolnej sieci. Przed produkcją potrzebne są testy na słabszych komputerach, Firefox i Safari, przy ograniczonym paśmie i z większymi zestawami plików. Archiwa przez kanał szeregowy są rozwiązaniem prototypowym, wymagającym osobnego pomiaru dla większych danych.

## Pochodzenie i dystrybucja

[v86](https://github.com/copy/v86) ma licencję BSD-2-Clause; zależności i BIOS-y mają własne warunki. Obraz zawiera pakiety Alpine, w tym programy GNU na GPL. Wygenerowane binaria pozostają lokalne. Przed publiczną dystrybucją obrazu trzeba dołączyć wymagane informacje licencyjne i zapewnić odpowiednie źródła rozpowszechnianych wersji pakietów. Wersje są w `packages.txt`, a commit BIOS-ów i skróty w `manifest.json`.

## Pełne Laboratorium 1

Widok aplikacji to `/learn/ukos`, z dostępem przez kartę na liście ścieżek. Po `npm run ukos:prepare` uruchom `npm run dev`, lokalny backend i Postgresa. `npm run ukos:test:course` sprawdza pełne przejście z rzeczywistym API na porcie 8080 i frontendem na 5173. Test tworzy tymczasowe konta w instancji Clerk Development przez `@clerk/testing` i usuwa je po zakończeniu. Wymaga `CLERK_SECRET_KEY` z kluczem `sk_test_` w zmiennej procesu oraz `VITE_CLERK_PUBLISHABLE_KEY` z kluczem `pk_test_` w `client/.env.local`; klucze Production są odrzucane. Nigdy nie wskazuj w nim produkcyjnej bazy ani API.

Standardowy build zawiera teraz osobne, ładowane na żądanie moduły kursu i runtime. Obrazy są kopiowane do `dist/prototypes/runtime/`; nie są pobierane przy zwykłym wejściu na stronę. CI przygotowuje je przed buildem. `docker compose build frontend` buduje obraz Linuksa w osobnym etapie, bez Dockera wewnątrz kontenera. Kontekst budowy frontendu to katalog główny repozytorium.

Przed publiczną publikacją nadal trzeba zakończyć przygotowanie dystrybucji źródeł i informacji licencyjnych pakietów obrazu oraz testy Firefox i Safari. Automatyzacja obecnie sprawdza Chromium. Lokalny prototyp nadal istnieje jako osobny punkt wejścia i używa własnego zapisu, niezależnego od kont kursu.
