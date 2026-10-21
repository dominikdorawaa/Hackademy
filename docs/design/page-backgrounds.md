# Pixelowy świat Hackademy

36 teł pochodzących z PixelLaba tworzy 18 osobnych miejsc dla zakładek aplikacji. Każda scena ma jasną i ciemną wersję. Seria zużyła 90 ze 150 dozwolonych generacji, łącznie z odrzuconymi wariantami; zużycie potwierdzono saldem API. Gotowe WebP zajmują łącznie 376 804 bajty. Prompty, ziarna, użyte modele, koszt generacji i sumy kontrolne są w `client/public/assets/scenery/provenance.json`. Źródłowe PNG i pełny rejestr prób pozostają w `local-prototype-backups/site-backgrounds-v1` poza repozytorium.

## Miejsca

- Strona główna: wejście na kampus Hackademy.
- Dashboard: własne centrum dowodzenia.
- Nauka: dziedziniec i biblioteka.
- Ścieżka: droga między górskimi wyspami.
- CTF: skarbiec serwerowy.
- Dyżur Zero: warsztat operatora Linuksa.
- Arena: sala treningowa.
- Walka: hala turniejowa. Właściwa scena walki zachowuje istniejące tło.
- Kreator avatara: pracownia wyposażenia.
- Ranking: galeria trofeów.
- Profil: osobiste studio.
- Znajomi: klub na dachu akademii.
- Ustawienia: stanowisko kalibracji.
- Logowanie i rejestracja: punkt wejścia do akademii.
- Powitanie: recepcja.
- Dokumenty prawne: archiwum.
- Brak strony: opuszczony przekaźnik.
- Administracja: wieża kontroli.

## Integracja

`pageScene` wybiera scenę z rodziny adresu, a `sceneStyle` podaje wyłącznie stałe lokalne adresy grafik. Parametry profili, pokoi i rozgrywek nie trafiają do URL zasobów. Obrazy dobierane są przez bieżącą zakładkę i motyw; wejście na stronę nie pobiera całej serii.

`PageBackdrop` jest dekoracyjnym, nieinteraktywnym tłem. Treść pozostaje w normalnym układzie; obraz nie zmienia wymiarów paneli i nie zajmuje fokusu. Ciemne i jasne maski oddzielają grafikę od tekstu. Karty zachowują swoje powierzchnie, a grafika pojawia się również w wybranych nagłówkach dashboardu, Areny, profilu, logowania i rankingu.

Pokoje zachowują istniejące powierzchnie tekstu, pytań, odpowiedzi, terminala i przycisków. Bit nie ma osobnego tła ani wydzielonego pasa: porusza się jako nakładka wewnątrz widocznego obszaru ćwiczenia, zgodnie z aktualną prośbą. Nie zmniejsza paneli ani terminala.

Obrazy są statyczne i nie dodają pętli animacji. WebP jest bezstratny, bez zmiany rozdzielczości ani kolorów wygenerowanych PNG. Eksport porównuje zdekodowane piksele obu formatów. Test zasobów sprawdza komplet zakładek, oba motywy, sumy kontrolne, format, rozmiar całej serii i limit 150 generacji.

Wspólna wersja zawiera także odświeżony ranking (#148) oraz Bita w pokojach (#220). Testy importu JSON i konfiguracji cache uwzględniają końce linii CRLF na Windows.

## Granice weryfikacji

Wygenerowane obrazy są oceniane bezpośrednio. Weryfikacja wyglądu całych stron w renderowanej przeglądarce pozostaje niedostępna, ponieważ narzędzie CUA nie udostępnia przeglądarek ani aplikacji. Testy DOM i ocena plików graficznych nie zastępują kontroli kontrastu, kadrowania i długich treści w rzeczywistym widoku.

Przeszło 679 testów widoków oraz 29 testów backendu, w tym zapytania rankingu na PostgreSQL w Testcontainers. Nowa obsługa doboru tła i integracja layoutów mają 100% pokrycia linii. Wszystkie 36 adresów obrazów i lokalna galeria odpowiedziały HTTP 200. Podgląd aplikacji działa na porcie 5173, a galeria pod `/__scenery-preview` jest dostępna wyłącznie przez lokalny skrypt podglądu i nie stanowi nowej ścieżki produkcyjnej.
