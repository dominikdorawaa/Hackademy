# Osobny kurs interaktywny UKOS

Kurs UKOS ma odtwarzać zakres i kolejność materiałów MHyla, rozwijając je w angażujące ćwiczenia z historią. Treści i reguły ćwiczeń utrzymujemy w kodzie, bez rozszerzania panelu administracyjnego o edytor tego typu kursów, ponieważ jest to wyjątkowa ścieżka przygotowywana indywidualnie.

Pierwsza wersja obejmuje kompletne Laboratorium 1 z terminalem, automatycznym zaliczaniem kroków i postępem zapisywanym na koncie. Dalszy zakres obejmuje Linux oraz HTML i CSS. Zaliczenie sprawdza poprawne wykonanie polecenia albo rezultat, zależnie od celu ćwiczenia. Kurs nie przyznaje globalnego XP i nie wpływa na ranking Hackademy.

Pozostajemy przy obecnym hostingu bez nowej miesięcznej opłaty za środowiska laboratoriów. Pełna obsługa ćwiczeń wymaga komputera z klawiaturą; telefon służy do czytania i przeglądania postępu. Preferowanym środowiskiem jest prawdziwy Linux uruchamiany w przeglądarce przez v86. Przed budową kompletnego laboratorium prototyp musi potwierdzić wykonalność; istotne ograniczenia wymagają ponownego wyboru rozwiązania.

## Historia i prezentacja

Przyjmujemy fabułę „Dyżur Zero”: początkujący członek zespołu technicznego Hackademy porządkuje zaniedbane środowisko szkoleniowe. Kolejne laboratoria rozwijają tę samą historię przez odzyskiwanie dokumentów, analizę logów, automatyzację, kopie zapasowe i przygotowanie strony zespołu. Krótkie wiadomości zespołu nadają ćwiczeniom cel, a instrukcje jasno wyjaśniają polecenia. Historia nie używa imion postaci.

Karta na istniejącej liście ścieżek otwiera dedykowany widok kursu z laboratoriami i osobnym postępem. Kurs jest zapisany w tabeli paths jako ścieżka systemowa. Panel administracyjny ją pokazuje, ale nie pozwala jej edytować ani usunąć. Usunąć ją może tylko developer z dostępem do bazy danych. Na komputerze materiały i aktualne zadanie są po lewej, a stale dostępny terminal po prawej. Do edycji plików w pierwszym laboratorium używamy nano.

## Przebieg nauki i zapis

Każde laboratorium łączy wyjaśnienie i ćwiczenia z prowadzeniem. Podpowiedzi na żądanie stopniowo odkrywają rozwiązanie. Uczeń pracuje nad jednym aktywnym krokiem, a po zaliczeniu automatycznie przechodzi do następnego. Może swobodnie eksperymentować w terminalu; wcześniejsze wykonanie polecenia nie zalicza przyszłych kroków. Ukończone instrukcje pozostają dostępne.

Zaliczenia zapisujemy na koncie, a pliki robocze automatycznie w danej przeglądarce. Odświeżenie przywraca zapisaną pracę. Każde laboratorium ma własny zestaw plików startowych, bez zależności od plików poprzedniego. Pomyłki i reset plików nie odbierają zaliczeń. Przy braku lokalnej pracy, zmianie urządzenia lub resecie w trakcie laboratorium odtwarzamy standardowy warsztat odpowiadający początkowi aktywnego kroku, aby umożliwić kontynuację. Nie odtwarza to własnej treści notatek ucznia z innego urządzenia.

Utrata połączenia z API nie blokuje już uruchomionego terminala. Nowe zaliczenia zapisujemy lokalnie i synchronizujemy po powrocie połączenia, z wyraźnym statusem oczekiwania na synchronizację. Błąd lokalnego zapisu musi być widoczny; aplikacja nie może wtedy deklarować zachowania pracy.

## Laboratorium 1 i publikacja

Fabuła Laboratorium 1: dzisiejszy raport nocnej zmiany trafił przez pomyłkę do archiwum, gdzie zespół trzyma wyłącznie zamknięte sprawy. Ukryta wiadomość i sam raport prowadzą ucznia przez kolejne kroki: pwd, warianty ls, cat, mkdir, rmdir, ścieżkę względną, cp z kopią zapasową w archiwum, mv do katalogu biezace, ścieżkę bezwzględną, touch, nano i history. Każdy krok łączy powód wynikający z historii z wyjaśnieniem polecenia. Kroki wynikowe oceniają stan plików względem wzorcowej treści raportu, bez narzucania sekwencji poleceń. Rezultat osiągnięty wcześniej zalicza krok, gdy staje się on aktywny, więc wykonanie zadań w innej kolejności nie blokuje postępu.

## Sprawdzian końcowy

Laboratoria nie kończą się egzaminem. Pokój kończy się po zaliczeniu ostatniego ćwiczenia z prowadzeniem. Samodzielny sprawdzian bez podpowiedzi będzie osobnym pokojem na końcu całej ścieżki, obejmującym materiał wszystkich laboratoriów. Jego forma, limit czasu i sposób oceny wymagają osobnej decyzji. Pierwsza wersja z godzinnym, serwerowym finałem Laboratorium 1 została wycofana przed wdrożeniem.

Pierwsze wydanie udostępnia tylko grywalne Laboratorium 1. Dalsze tematy są zapowiedziami bez możliwości rozpoczęcia. Po ukończeniu pierwszego labu pokazujemy ukończenie dostępnego laboratorium; cały kurs pozostaje oznaczony jako rozwijany. Kolejne grywalne laboratoria docelowo wymagają ukończenia poprzedniego.

## Wykonalność i płynność

Płynność strony jest priorytetem. Runtime i obraz Linuksa ładujemy wyłącznie dla uruchamianego warsztatu. Prototyp ma sprawdzić sposób ograniczenia pracy emulatora na głównym wątku, zużycie CPU i pamięci, reakcję terminala i interfejsu, koszt automatycznego zapisu oraz zwalnianie zasobów po wyjściu. Ukryta lub nieaktywna sesja nie powinna wykonywać niepotrzebnej pracy. Nie przyjmujemy częstego pełnego zrzutu pamięci maszyny jako domyślnego sposobu zapisu bez pomiarów.

Próba techniczna obejmuje rzeczywisty obraz z Bashem i nano, czas zimnego startu i wielkość pobieranych plików, historię i autouzupełnianie, polskie znaki i skróty edytora, wykrywanie sukcesu właściwego polecenia oraz sprawdzanie rezultatu niezależnie od widocznego tekstu terminala. Musi też sprawdzić odtwarzanie pracy, awarie zapisu, separację kont i kart oraz zgodność zapisów przy aktualizacji obrazu. Wyniki pomiarów są warunkiem dalszej implementacji, a nie obietnicą wynikającą z samego wyboru v86.

Materiały odniesienia: [program UKOS](https://mhyla.com/courses/UKOS/stacjonarne/), [Laboratorium 1](https://mhyla.com/ukos-1/).

## Próba techniczna

Prototyp korzysta z minimalnego obrazu Alpine, Basha i nano w v86 uruchomionym w osobnym Web Workerze. Stan przygotowanego systemu jest generowany podczas budowy, co skraca lokalny start kosztem większego początkowego transferu. Pliki ucznia są zapisywane oddzielnie od tego stanu, bez cyklicznego zapisywania całej pamięci maszyny. Pełny rozruch pozostaje dostępny do porównania.

[Raport prototypu](../performance/ukos-prototype.md) opisuje pomiary i sprawdzone zachowania. Implementacja pozostaje oddzielnym lokalnym prototypem, bez zmian zwykłych tras aplikacji, kont ani produkcyjnego wdrożenia.

## Integracja Laboratorium 1

Widok `/learn/ukos` jest ładowany na żądanie z karty na liście ścieżek. Piętnaście kroków jest utrzymywanych w kodzie, bez zmian edytora administracyjnego. Nowa migracja V15 dodaje pojedynczy rekord postępu dla konta. Zapis ukończonych ćwiczeń jest monotoniczny.

Serwer blokuje rekord użytkownika na czas aktualizacji. Zaliczenia kroków zgłasza przeglądarka ucznia, która kontroluje środowisko i ocenę. Nie zapewnia to ochrony przed świadomym fałszowaniem klienta. Nie przyznajemy XP, certyfikatów ani korzyści rankingowych. Silniejszy model zaufania wymaga osobnej decyzji i innej architektury.

Wersja obrazu rozdziela lokalne pliki. Po zmianie obrazu, zmianie urządzenia lub braku zapisu odtwarzamy początek kroku zgodny z postępem konta i lokalnymi zaliczeniami. Własne notatki nie są migrowane między wersjami obrazu.
