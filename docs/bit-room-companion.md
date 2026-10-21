# Bit w pokojach

Realizacja #220 zachowuje istniejące sprite'y pingwina. `RoomFrame` udostępnia licznik nowych zaliczeń i informację o otwartym dialogu. `RoomMascot` odpowiada za wspólną strefę oraz stan oczekiwania, spacer, machanie, rozglądanie i podskok.

## Układ i granice

- PATH: strefa jest rodzeństwem przewijanego czytnika, przed stopką nawigacji. Na telefonie czytnik ma naturalną wysokość i nie kurczy się pod strefę.
- CTF, w tym VM/VPN: strefa jest pod przewijanym opisem w lewym panelu, poza formularzem flagi i podpowiedziami.
- UKOS: strefa jest pod przewijaną treścią ćwiczenia w lewym panelu, poza terminalem, ekranem startowym i paskami przycisków. Osobna strefa występuje też na stronie kursu, również w istniejącym mobilnym widoku postępu.

Strefa rezerwuje 116 px wysokości, 104 px poniżej 900 px szerokości ekranu. Sprite zajmuje zawsze 58 na 59 px. Tor zaczyna się 16 px od lewej i kończy 74 px od prawej: ostatnie 58 px mieszczą całą postać, pozostawiając 16 px marginesu. Spacer interpoluje procenty toru, nie piksele viewportu, dlatego zmiana proporcji paneli nie pozostawia trasy o starej szerokości. Przy torze węższym niż 72 px spacer nie zaczyna się; zwężenie zatrzymuje trwający spacer. Podskok na 18 px mieści się z marginesem nawet w kompaktowej strefie. Cień postaci również mieści się w niej. `contain: layout paint` i `overflow: clip` stanowią dodatkową granicę malowania. Maskotka nie ma własnego globalnego z-index ani portalu.

## Zaliczenia i ruch

PATH i CTF zwiększają licznik wyłącznie po odpowiedzi HTTP zakończonej powodzeniem z `success: true`. Nowe identyfikatory zadań są deduplikowane. Wczytane zadania, ukończony pokój, trening i podgląd nie zwiększają licznika. Flaga ma blokadę równoległego wysłania.

UKOS oznacza początkowe i odtwarzane zdarzenie runtime jako `restored`. Nowe kroki zwiększają licznik dopiero po potwierdzeniu zapisu na serwerze i udanym zapisie lokalnym. Hydratacja, synchronizacja wcześniejszych zapisów, duplikaty oraz błędy zapisu nie wywołują reakcji. Późniejsza synchronizacja nie odtwarza reakcji po nieudanym zapisie. Sam postęp offline zachowuje dotychczasowe działanie.

Losowa animacja trwa 1,8 s, po czym następuje przerwa 14-30 s. Sukces przerywa losowy ruch w aktualnej pozycji. Każde nowe zaliczenie ma jeden podskok trwający 640 ms; zaliczenia występujące blisko siebie są obsługiwane kolejno. Losowe ruchy nie tworzą kolejki. Otwarte dialogi zatrzymują animacje, a jeszcze nierozpoczęta reakcja czeka na ich zamknięcie. Rozpoczęta reakcja nie jest odtwarzana ponownie po przerwaniu.

Systemowe i aplikacyjne ograniczenie ruchu zatrzymuje również sprite'y oraz usuwa oczekujące reakcje. Istniejące komunikaty zaliczenia pozostają w interfejsie. Maskotka jest dekoracyjna, nie ma przycisku ani fokusu. Ukrycie karty zatrzymuje ruch. Odmontowanie usuwa timeout, obserwator rozmiaru i nasłuchy.

## Weryfikacja

Przeszły 104 testy w 12 plikach. Pokrycie linii zmienionego obszaru wynosi 96,37%, w tym 100% dla RoomMascot, Mascot i RoomFrame. Każdy zmieniony plik przekracza wymagane 80%. Kontrola typów, lint, git diff --check i pełny build przeszły. Lokalny obraz UKOS został przygotowany, a Linux doszedł do punktu startowego. Wygenerowane pliki runtime pozostają ignorowane przez Git.

Testy obejmują nowy i odtworzony postęp, błędy odpowiedzi i zapisu, kilka szybkich zaliczeń, priorytet sukcesu, dialog, zmianę szerokości toru, oba kierunki spaceru, ograniczenie ruchu, zachowanie fokusu, długą treść, rozwinięte podpowiedzi oraz ćwiczenie „Miejsce na sprawy w toku”. Sprawdzenie geometrii i wyglądu w renderowanej przeglądarce pozostaje niewykonane: narzędzie CUA nie udostępnia żadnych przeglądarek ani aplikacji. Testy DOM nie zastępują takiej weryfikacji.
