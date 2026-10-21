# Bit wewnątrz ćwiczenia

Bit występuje w otwartym pokoju PATH, CTF i warsztacie UKOS. Nie występuje w przeglądzie kursu ani poza ekranem ćwiczenia. Aktualne zachowanie uwzględnia zmianę wymagań: maskotka chodzi jako nakładka po pokoju, również nad terminalem, bez osobnego pasa i tła.

## Układ i granice

RoomFrame umieszcza jedną maskotkę w nakładce nad obszarem treści, obok przewijanego panelu. Nakładka nie zajmuje miejsca w układzie. Rozmiar paneli, terminala i czytnika pozostaje taki jak przed dodaniem maskotki. Grafika ma 116 na 118 px, dwukrotność źródłowego sprite'a.

Granice to przecięcie obszaru ćwiczenia z widocznym viewportem. Górna nawigacja i dolna stopka pozostają poza trasą. Przewijanie, ResizeObserver i zmiana rozmiaru okna aktualizują granice. Cała sylwetka, cień i podskok o 18 px mieszczą się w nich z marginesem. Przy zbyt małym lub niewidocznym obszarze maskotka znika i zatrzymuje timery. Na telefonie ruch pozostaje ograniczony do widocznej części otwartego ćwiczenia.

Zgodnie z aktualną prośbą Bit może przechodzić nad treścią i terminalem. Tylko jego przycisk przechwytuje kliknięcia. Pozostała część nakładki przepuszcza interakcje do pokoju. Otwarte dialogi ukrywają Bita.

## Ruch i reakcje

Pierwszy ruch zaczyna się po 2,2-4 s. Spacery stanowią dwie trzecie losowanych akcji, obejmują oba wymiary pokoju i trwają 1,2-3,2 s. Po nich jest 4-8 s przerwy. Pozostałe akcje to machanie i rozglądanie. Przy granicy Bit zawraca.

Kliknięty Bit wraca do punktu po lewej, na 12% szerokości i 85% wysokości dostępnej trasy. Powrót trwa 650 ms. Następnie tańczy Scubę przez dwie pętle, łącznie 3520 ms. Ponowne kliknięcia podczas powrotu lub tańca nie tworzą kolejki. Kliknięcie wskaźnikiem zachowuje fokus odpowiedzi lub terminala; przycisk obsługuje też klawiaturę i zachowuje fokus podczas animacji.

PATH i CTF reagują wyłącznie na nową odpowiedź serwera z success: true. UKOS reaguje po potwierdzeniu nowego postępu przez serwer i udanym zapisie lokalnym. Odtworzony postęp, trening, błędy odpowiedzi i zapisu nie wywołują celebracji. Każde nowe zaliczenie ma jeden podskok, z pierwszeństwem przed losowym ruchem i tańcem. Losowe ruchy nie tworzą kolejki. Reakcja oczekująca podczas dialogu uruchamia się po jego zamknięciu; rozpoczęta nie jest powtarzana.

Systemowe i aplikacyjne ograniczenie ruchu zatrzymuje animacje. Kliknięcie przenosi wtedy Bita do punktu powrotu bez spaceru i tańca. Istniejące komunikaty zaliczenia pozostają dostępne. Ukrycie karty lub opuszczenie widocznego pokoju zatrzymuje ruch. Odmontowanie usuwa timery, obserwatory oraz nasłuchy przewijania i zmiany rozmiaru.

## Weryfikacja

64 testy w 5 plikach przeszły. Pokrycie linii RoomMascot, RoomFrame i UkosPage wynosi 99,52%; każdy plik przekracza 80%. Testy obejmują nowe i odtworzone zaliczenia, błędy, dialogi, powrót i taniec, fokus, ruch w obu wymiarach, granice mobilnego viewportu, przewijanie, zmianę rozmiaru oraz sprzątanie timerów. Weryfikacja wyglądu i działania w renderowanej przeglądarce pozostaje niedostępna, ponieważ narzędzie nie udostępnia przeglądarki. Testy DOM i geometrii nie zastępują kontroli rzeczywistego widoku.