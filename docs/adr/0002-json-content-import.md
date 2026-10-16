# ADR 0002: Import materiałów z JSON

## Import ścieżek

Administrator w sekcji Ścieżki wgrywa dokument UTF-8 zawierający jedną nową ścieżkę. Import zawsze tworzy szkic ścieżki i szkice pokoi typu PATH. Ekspert i zwykły użytkownik nie mogą wywołać importu. Publikacja, bannery i pliki do pobrania są dostępne później w istniejącym edytorze.

Format i przykład są dostępne w oknie importu do skopiowania lub pobrania. Źródło przykładu: `client/src/data/path-import-example.json`.

| Obiekt | Pola wymagane | Pola opcjonalne |
| --- | --- | --- |
| Ścieżka | `title`, `description`, `chapters` | `unlockMode` (domyślnie `OPEN`) |
| Rozdział | `title`, `rooms` | brak |
| Pokój | `title`, `description`, `difficulty`, `category`, `points` | `shortDescription`, `flag`, `requiresVpn` (domyślnie `false`), `hints`, `tasks` |
| Zadanie | `title`, `content` | `question`, `answer` |

`chapters`, `rooms`, `hints` i `tasks` są listami. Listy rozdziałów i pokoi nie mogą być puste. Pominięte listy podpowiedzi i zadań są puste. `hints` zawiera teksty podpowiedzi. Każdy pokój bez zadań wymaga niepustej flagi. Pytanie w zadaniu wymaga odpowiedzi, a odpowiedź wymaga pytania. Treść zadania obsługuje wyłącznie HTML formatowania zgodny z edytorem; niedozwolony HTML jest usuwany i nie może pozostawić pustej treści.

Tryby odblokowania: `OPEN`, `CHAPTER`, `ROOM`. Trudność: `EASY`, `MEDIUM`, `HARD`, `INSANE`. Punkty pokoi PATH są podawane jako nieujemna liczba całkowita do 2147483647. Kolejność list określa kolejność rozdziałów, pokoi, podpowiedzi i zadań. Tytuły są przycinane na początku i końcu; tytuły pokoi muszą być różne w obrębie rozdziału (wielkość liter jest rozróżniana). Tytuły Tutorial VM i Tutorial VPN są zarezerwowane, niezależnie od wielkości liter. Powtórzenia tytułów w różnych rozdziałach i ścieżkach są dozwolone.

Limity: 5 MB na plik, 100 rozdziałów, 500 pokoi łącznie, 100 podpowiedzi i 100 zadań na pokój. Maksymalne długości: tytuł ścieżki i rozdziału 120, tytuł pokoju i zadania 255, opisy i treść zadania 20000, krótki opis 100, kategoria i flaga 255, podpowiedź i pytanie 2000, odpowiedź 255 znaków.

Nieznane pola, identyfikatory istniejących materiałów, pola publikacji, bannery i pliki są odrzucane. Typy są sprawdzane bez konwersji, np. `points: "30"` i `requiresVpn: "false"` są błędne. Opcjonalne teksty mogą być null; opcjonalne listy, tryb i boolean po podaniu muszą mieć poprawny typ. Powtórzone klucze JSON i dodatkowa treść po dokumencie są błędami składni. Przy błędnej składni zwracany jest błąd pliku; przy poprawnej składni zbierane są błędy wszystkich elementów, z pozycją od 1, np. `rozdział 2, pokój 3: flag`.

`POST /api/admin/content/paths/import`, multipart z częścią `file`, zwraca 201 i szczegóły nowej ścieżki zgodne z edytorem. Przy walidacji zwraca 400 z `message` i mapą `fields`. Cała struktura jest zapisywana w jednej transakcji, także błąd podczas zapisu wycofuje wszystkie nowe materiały. Import nie modyfikuje istniejących ścieżek ani pokoi. Nie wymaga migracji bazy.

## Dopisywanie pokoi do istniejącej ścieżki

Administrator w edytorze zapisanej ścieżki wybiera „Importuj pokoje z JSON”, wskazuje istniejący rozdział i wgrywa dokument `{"rooms": [...]}`. Elementy `rooms` mają identyczny format jak pokoje w imporcie nowej ścieżki. Okno pokazuje przykład tego dokumentu do skopiowania lub pobrania. Plik nie zawiera metadanych ścieżki, identyfikatorów ani numerów wersji.

Nowe pokoje są dopisywane na końcu wybranego rozdziału jako szkice; pozostają ukryte dla graczy nawet w opublikowanej ścieżce. Tytuł, opis, tryb odblokowania, status publikacji, istniejące rozdziały, kolejność obecnych pokoi i postępy pozostają bez zmian. Jedna transakcja obejmuje całą partię. Walidacja zbiera błędy wszystkich pokoi i porównuje tytuły także z istniejącymi pokojami wybranego rozdziału. Rozdział nie może po imporcie przekroczyć 500 pokoi; plik nadal ma limit 5 MB. Import nie tworzy nowych rozdziałów.

`POST /api/admin/content/paths/{id}/rooms/import` przyjmuje multipart: `file` oraz część JSON `target` z `chapterId`, `contentRevision` i `chaptersRevision`. Wersje pochodzą ze szczegółów ścieżki, a rozdział musi należeć do tej ścieżki. Backend blokuje ścieżkę na czas zapisu; nieaktualne wersje lub obcy rozdział zwracają 409 bez zapisania pokoi. Sukces zwraca 201 ze zaktualizowanymi szczegółami i zwiększa obie wersje ścieżki. Edytor odświeża listę pokoi. Import korzysta z istniejącej ochrony niezapisanych zmian: przed otwarciem okna można zapisać zmiany, kontynuować edycję lub odrzucić zmiany.

## Import CTF

Administrator w sekcji Pokoje CTF wybiera „Importuj CTF z JSON” i wgrywa dokument `{"rooms": [...]}`. Przykład jest dostępny w oknie do obejrzenia, skopiowania i pobrania; źródło: `client/src/data/ctf-import-example.json`.

Pokój CTF wymaga `title`, `description`, `difficulty`, `category` i `flag`. Opcjonalne są `shortDescription`, `requiresVpn` (domyślnie false) i `hints` (domyślnie pusta lista). Limity tekstów i podpowiedzi są identyczne jak dla importu ścieżek; plik do 5 MB, lista od 1 do 500 pokoi. Nieznane pola, w tym `points`, `tasks`, `id`, `roomType`, publikacja i pliki, są błędami. Pokój CTF rozwiązuje się flagą; nie importuje zadań PATH.

Punkty liczy wyłącznie backend z trudności: EASY 50, MEDIUM 100, HARD 150, INSANE 200. Tytuły są przycinane i muszą być unikalne w pliku oraz globalnie wśród pokoi CTF, również szkiców; wielkość liter jest rozróżniana. Tytuł istniejącego pokoju PATH nie blokuje importu CTF. Nazwy samouczków pozostają zarezerwowane. Walidacja przed zapisem zbiera błędy wszystkich pokojów, także konflikty tytułów z bazą, z pozycją `pokój 2: title`.

`POST /api/admin/content/ctf/import`, multipart z częścią `file`, jest dostępny tylko dla administratora. Zwraca 201 z `roomIds` i `count`. Import tworzy nowe pokoje CTF jako szkice, z podpowiedziami, w jednej transakcji. Istniejące pokoje i postępy pozostają bez zmian; nowe szkice nie trafiają do list gracza ani Areny do czasu publikacji w edytorze. Błędny dokument zwraca 400 z mapą `fields` i nie zapisuje nic. Konflikt tytułu powstały równocześnie podczas zapisu zwraca 409 i wycofuje całą partię. Pliki do pobrania i publikację dodaje się później w edytorze. Nie wymaga migracji bazy.
