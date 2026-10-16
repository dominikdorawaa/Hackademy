# Szkice, publikacja i podgląd materiałów (#61)

Migracja V8 zachowuje wszystkie istniejące ścieżki i pokoje jako opublikowane. Nie zmienia zapisów na ścieżki, ukończeń pokoi, zadań ani odblokowanych podpowiedzi. Nowe materiały startują jako szkice.

Administratorzy i eksperci widzą oba statusy w panelu. Zwykłe listy, rekomendacje, losowanie Areny, bezpośrednie szczegóły, pliki, bannery i operacje rozwiązywania sprawdzają publikację po stronie serwera. Pokój PATH jest ukryty także wtedy, gdy jego ścieżka jest szkicem. Ukrycie nie kasuje postępów; po ponownej publikacji nadal są dostępne.

## Zapis i równoczesna edycja

Edytory wysyłają informacje i strukturę jednym żądaniem multipart do `POST /api/admin/content/paths` lub `/rooms`; edycja używa `PUT .../{id}`. JSON znajduje się w części `content`, opcjonalny banner lub plik w `file`. Zapis jest transakcyjny. Nieudana walidacja, konflikt lub problem z plikiem nie pozostawia częściowo zapisanej struktury ani pokoju bez przypisania.

Każdy zapis istniejącego materiału wymaga `revision` (contentRevision). Ścieżka dodatkowo wymaga `chaptersRevision`, a pokój `tasksRevision`. Aktualizacja starszym stanem zwraca 409. Dotychczasowe API rozdziałów i zadań nadal sprawdza własne rewizje i zwiększa także rewizję całego materiału, aby nowy edytor nie nadpisał zmian starego klienta.

`published` określa wynikowy status. Zapis szkicu pozostawia `false`; publikacja zapisuje aktualne dane i ustawia `true` dopiero po walidacji. Zapis opublikowanego materiału aktualizuje wersję dla graczy bez ukrywania. „Przenieś do szkiców” zapisuje aktualne dane jako szkic.

## Walidacja i limity

Do zapisu szkicu wymagane są tytuł materiału, nazwy dodanych rozdziałów, tytuły dodanych zadań i treść dodanych podpowiedzi. Pokój wymaga także typu, kategorii i trudności, a pokój ścieżki także nieujemnych całkowitych punktów (formularz ma wartości domyślne). Punkty pokoju CTF wylicza backend z trudności: EASY 50, MEDIUM 100, HARD 150, INSANE 200. Przesłana wartość jest ignorowana. Treść pokoju i zadań, pytanie/odpowiedź oraz flaga mogą pozostawać niekompletne.

Publikacja dodatkowo wymaga opisu, treści zadań po sanitizacji HTML, poprawnych par pytanie/odpowiedź oraz flagi w pokoju bez zadań. Ścieżka wymaga co najmniej jednego rozdziału; każdy rozdział musi zawierać opublikowany pokój. Banner i plik są opcjonalne.

Tytuł pokoju CTF jest unikalny wśród pokoi CTF, a tytuł pokoju ścieżki w obrębie rozdziału. Pokoje ścieżki poza rozdziałem i pokoje różnych typów mogą mieć ten sam tytuł. Tytuły „Tutorial VM” i „Tutorial VPN” (bez względu na wielkość liter) są zarezerwowane; istniejący pokój samouczka zachowuje swój tytuł. Tytuły są zapisywane bez spacji na początku i końcu. V9 przycina istniejące tytuły, a jeśli przycięcie tworzy duplikat w tym samym zakresie, dopisuje do nowszego pokoju jego identyfikator, np. „Intro (9)”. Baza pilnuje obu reguł unikalności (V9), także przy równoczesnych zapisach. Konflikt zwraca 409 z błędem przy polu `title` albo `chapters.N.rooms`.

Limity znaków są takie same w przeglądarce i backendzie (jednostki UTF-16):

| Pole | Limit |
| --- | ---: |
| Tytuł ścieżki / nazwa rozdziału | 120 |
| Opis ścieżki / pokoju / treść zadania | 20000 |
| URL bannera | 2048 |
| Tytuł pokoju / kategoria / flaga / tytuł zadania / odpowiedź | 255 |
| Krótki opis pokoju | 100 |
| Podpowiedź / pytanie zadania | 2000 |

Materiał może zawierać do 100 rozdziałów, zadań lub podpowiedzi; rozdział do 500 pokoi. Banner obsługuje PNG, JPEG, WebP i GIF do 5 MB; plik pokoju do 50 MB. Liczniki nie obcinają wpisanej treści. Niepoprawny zapis zachowuje stan, wskazuje pole i ustawia fokus. Błędy walidacji API zwracają mapę `fields`; konflikty wersji pozostawiają cały lokalny formularz.

## Tworzenie pokoju i nawigacja

„Nowa ścieżka” prowadzi do pełnego edytora. „Utwórz pokój” w rozdziale prowadzi do pełnego formularza PATH. Zapisany kontekst zawiera `pathId`, `chapterId` i `pathRevision`; serwer sprawdza przynależność i wersję, a następnie przypisuje pokój w tej samej transakcji.

Niezapisane zmiany obejmują wszystkie pola, pliki, rozdziały, przypisania, kolejność, podpowiedzi i zadania. Dialog pozwala kontynuować, wyjść bez zapisu lub zapisać zgodnie z bieżącym statusem i dopiero potem przejść dalej. Odświeżenie/zamknięcie karty używa natywnego beforeunload.

Jeśli przy tworzeniu pokoju odrzucono nową niezapisaną ścieżkę lub nowy rozdział, formularz pokoju pozwala podać świeży tytuł kontekstu. `parentDraft` i `chapterIndex` zapisują ten kontekst atomowo razem z pokojem. Przy błędzie wszystko jest wycofywane. Nowy rozdział opublikowanej ścieżki wymaga gotowego opublikowanego pokoju; alternatywnie najpierw można przenieść ścieżkę do szkiców.

## Podgląd

`GET /api/admin/content/{paths|rooms}/{id}/preview` korzysta z zapisanej wersji i wymaga roli ADMIN lub EXPERT. Ten sam komponent strony gracza renderuje podgląd. Banner i plik szkicu mają osobne chronione endpointy. Podgląd ścieżki pozwala otwierać jej pokoje także w szkicu i wracać do edycji.

Podgląd nie ma endpointów modyfikujących postęp. Symulacja oznaczenia zadania odbywa się tylko w pamięci przeglądarki; podpowiedzi można odsłonić lokalnie bez zapisywania odblokowań. Nie przyznaje punktów, nie aktualizuje statystyk ani nie publikuje materiału.

## Weryfikacja

Testy `ContentDraftsIntegrationTest` i `SchemaMigrationTest` pokrywają migrację, dostęp do szkiców, publikację/ukrycie, zachowanie postępów, role, podgląd, limity, sanitizację, konflikty i atomowe tworzenie kontekstu. `contentEditors.test.tsx` pokrywa edytory, liczniki, nawigację w tym browser back, beforeunload, trzy decyzje, nieudany zapis i fokus oraz wspólne widoki podglądu. Pozostałe testy zadań, rozdziałów i Areny nadal uruchamiają się w pełnym zestawie.

Po wdrożeniu backendu uruchomionego z migracją V8 można wdrożyć frontend. Lokalnie zrestartuj/przebuduj backend przed testowaniem nowego edytora.
