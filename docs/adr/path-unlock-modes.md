# Tryby odblokowania ścieżek (#18)

Każda ścieżka ma tryb `OPEN`, `CHAPTER` albo `ROOM`, wybierany w edytorze ścieżki przy tworzeniu i edycji. Migracja V10 ustawia `OPEN` wszystkim istniejącym ścieżkom; ścieżka utworzona bez trybu (także starym API) również dostaje `OPEN`. Zapis bez pola `unlockMode` zachowuje dotychczasowy tryb.

## Reguły

Kolejność wynika z kolejności rozdziałów i pokoi w ścieżce. Pod uwagę brane są tylko opublikowane pokoje, więc pokój przeniesiony do szkiców nie blokuje dalszej nauki. Rozdział bez opublikowanych pokoi jest traktowany jako ukończony.

- `OPEN`: wszystkie pokoje są dostępne.
- `CHAPTER`: dostępne są pokoje do pierwszego nieukończonego rozdziału włącznie. Kolejny rozdział otwiera się po ukończeniu wszystkich pokoi poprzednich rozdziałów.
- `ROOM`: pokoje tworzą jedną kolejkę przez całą ścieżkę, niezależnie od granic rozdziałów. Dostępny jest pierwszy nieukończony pokój.

Ukończony pokój zawsze pozostaje dostępny do powtórki, także po zmianie trybu. Blokady samouczków (Tutorial VM przed Tutorial VPN, Tutorial VPN przed pokojami z VPN) działają dodatkowo.

## Wyliczanie i egzekwowanie

Stan blokady nie jest zapisywany. `PathUnlockPolicy` wylicza go przy każdym żądaniu z aktualnego trybu, kolejności, publikacji i rozwiązań gracza, więc zmiana trybu, kolejności lub publikacji działa natychmiast.

`GET /api/paths/{id}` zwraca `unlockMode`, flagę `locked` pokoi oraz rozdziałów. Rozdział jest oznaczony jako zablokowany tylko wtedy, gdy zawiera pokój zablokowany przez tryb ścieżki, więc rozdział ukończony wcześniej nie wygląda na zablokowany. `rooms-mini` w dashboardzie również oznacza zablokowane pokoje. Zmiana rozdziałów, kolejności, publikacji, usunięcie pokoju lub ścieżki czyści cache dashboardu po zatwierdzeniu transakcji. Backend odrzuca zablokowany pokój kodem 403 z komunikatem dla gracza przy wejściu do pokoju, wysłaniu flagi, odpowiedzi na zadanie, ukończeniu pokoju z zadaniami, odsłonięciu podpowiedzi i pobraniu pliku. Podgląd administracyjny nie stosuje blokad.

## Weryfikacja

`PathUnlockModesIntegrationTest` pokrywa domyślny `OPEN`, oba tryby blokujące, odrzucanie wszystkich akcji pokoju, zmianę trybu na żywo, pomijanie nieopublikowanych pokoi, blokady samouczków i walidację trybu. `SchemaMigrationTest` sprawdza V10. Testy frontendu pokrywają wybór trybu w edytorze, kłódki rozdziałów i komunikat blokady pokoju.
