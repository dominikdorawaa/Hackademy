export const lessons = [
  {
    id: "pwd",
    title: "Pierwszy dyżur",
    intro:
      "Zaczynasz pierwszy dyżur w zespole technicznym Hackademy. W nocy padł serwer szkoleniowy, a nocna zmiana opuściła stanowisko w pośpiechu. Zanim cokolwiek ruszysz, ustal, gdzie jesteś. Prompt student@hackademy:~$ pokazuje użytkownika, komputer i bieżący katalog. Znak ~ oznacza Twój katalog domowy, a pwd wypisuje jego pełną ścieżkę.",
    task: "Wykonaj pwd i odczytaj pełną ścieżkę bieżącego katalogu.",
    hints: [
      "pwd to skrót od print working directory. Polecenia rozróżniają wielkie i małe litery.",
      "Wpisz pwd i zatwierdź Enterem.",
    ],
  },
  {
    id: "ls",
    title: "Co zastaliśmy na stanowisku?",
    intro:
      "ls wyświetla pliki i katalogi. Bez argumentu pokazuje miejsce, w którym stoisz. Z argumentem, na przykład ls archiwum, zagląda do wskazanego katalogu. Brak komunikatu po poleceniu często oznacza sukces. O tym, czy operacja się udała, decyduje jej rezultat.",
    task: "Wyświetl zawartość katalogu domowego poleceniem ls.",
    hints: [
      "Bez argumentu ls pokazuje bieżący katalog.",
      "Jeśli nie jesteś w katalogu domowym, wróć do niego przez cd. Następnie wykonaj ls.",
    ],
  },
  {
    id: "ls-detail",
    title: "Zajrzyj do archiwum",
    intro:
      "W katalogu domowym jest tylko archiwum, a w nim zamknięte sprawy zespołu. Opcje zmieniają zachowanie programu, a argumenty wskazują, na czym pracuje. W ls -l archiwum opcja -l włącza długi widok, a archiwum jest argumentem. Pierwszy znak wiersza mówi, czym jest wpis: d oznacza katalog, a - zwykły plik. Dalej widać uprawnienia, właściciela, rozmiar i datę modyfikacji.",
    task: "Obejrzyj zawartość archiwum w długim widoku: użyj ls z opcją -l i argumentem archiwum.",
    hints: [
      "Najpierw opcja, potem argument. Opcje zaczynają się zwykle od myślnika.",
      "ls -l archiwum",
    ],
  },
  {
    id: "ls-hidden",
    title: "Wiadomość między wierszami",
    intro:
      "Między zamkniętymi sprawami leży dzisiejszy raport.txt. Coś tu się nie zgadza. Nocna zmiana miała zostawić wyjaśnienie, ale w katalogu domowym go nie widać. Nazwy zaczynające się od kropki są ukryte i ls domyślnie ich nie pokazuje. Opcja -a je odkrywa. Opcje można łączyć: -l -a i -la działają tak samo.",
    task: "Wyświetl ukryte pliki katalogu domowego w długim widoku, używając ls z opcjami a oraz l.",
    hints: [
      "Połącz dwie opcje poznane w tej części.",
      "Wykonaj ls -la w katalogu domowym. Zwróć uwagę na .wiadomosc.",
    ],
  },
  {
    id: "lab-read-message",
    title: "Wiadomość od nocnej zmiany",
    intro:
      "cat wypisuje zawartość pliku w terminalu. Nazwę pliku podajesz jako argument, także gdy plik jest ukryty. Kropka jest częścią jego nazwy. Przeczytaj, co zostawiła nocna zmiana.",
    task: "Przeczytaj ukryty plik .wiadomosc z katalogu domowego za pomocą cat.",
    hints: ["Kropka na początku należy do nazwy pliku.", "cat ~/.wiadomosc"],
  },
  {
    id: "lab-directory",
    title: "Miejsce na sprawy w toku",
    intro:
      "Zespół potrzebuje katalogu na sprawy w toku. Nazwiemy go biezace, bez polskich znaków i spacji, bo takie nazwy łatwiej wpisywać w terminalu. mkdir tworzy katalog. mkdir -p tworzy także brakujące katalogi nadrzędne i nie zgłasza błędu, gdy katalog już istnieje. Spacja rozdziela argumenty: mkdir jeden dwa tworzy dwa katalogi.",
    task: "Utwórz katalog biezace w katalogu domowym.",
    targets: ["~/biezace"],
    hints: [
      "mkdir biezace tworzy katalog tam, gdzie właśnie stoisz. Z innego miejsca podaj ścieżkę zaczynającą się od ~, które oznacza /home/student.",
      "mkdir ~/biezace",
    ],
  },
  {
    id: "lab-remove",
    title: "Posprzątaj po awarii",
    intro:
      "W archiwum został pusty katalog tymczasowe, z którego nocna zmiana korzystała podczas awarii. Puste katalogi tylko utrudniają szukanie dokumentów. rmdir usuwa wyłącznie puste katalogi, więc nie skasujesz nim przypadkiem dokumentów. Długie nazwy uzupełnia Tab: zacznij pisać i naciśnij Tab. Przy kilku pasujących nazwach naciśnij Tab drugi raz, żeby zobaczyć możliwości.",
    task: "Usuń pusty katalog ~/archiwum/tymczasowe, zachowując resztę archiwum.",
    hints: [
      "Użyj rmdir ze ścieżką do zbędnego katalogu.",
      "rmdir ~/archiwum/tymczasowe",
    ],
  },
  {
    id: "cd-relative",
    title: "Wyrusz ścieżką względną",
    intro:
      "Czas zająć się raportem. cd zmienia bieżący katalog. Ścieżka względna zaczyna się w miejscu, w którym aktualnie jesteś, i nie ma ukośnika na początku. Kropka to bieżący katalog, a dwie kropki jego rodzic, więc cd .. przenosi o poziom wyżej. Samo cd albo cd ~ zawsze zabiera Cię do katalogu domowego.",
    task: "Z katalogu domowego przejdź do archiwum, używając ścieżki względnej.",
    hints: [
      "Jeśli nie jesteś w katalogu domowym, wróć do niego przez cd. Potem podaj nazwę katalogu bez początkowego /.",
      "cd, a następnie cd archiwum",
    ],
  },
  {
    id: "lab-read-report",
    title: "Raport nocnej zmiany",
    intro:
      "Jesteś w archiwum, więc plik z tego katalogu możesz wskazać samą nazwą. To także ścieżka względna. Zanim przeniesiesz raport, przeczytaj go. Dowiesz się, czego zespół oczekuje dalej.",
    task: "Przeczytaj raport.txt za pomocą cat.",
    hints: [
      "Będąc w archiwum, wystarczy podać samą nazwę pliku.",
      "cat raport.txt",
    ],
  },
  {
    id: "lab-copy",
    title: "Kopia zapasowa",
    intro:
      "Nocna zmiana prosi, żeby przed przeniesieniem zostawić w archiwum kopię raportu. Jeśli coś pójdzie nie tak, będzie od czego zacząć. cp przyjmuje źródło i cel: najpierw podajesz, co kopiujesz, potem dokąd. Oryginał zostaje na miejscu. Opcja -v opisuje wykonaną operację. Uwaga: istniejący plik docelowy zostanie nadpisany bez pytania.",
    task: "Skopiuj raport do pliku ~/archiwum/raport-kopia.txt.",
    hints: [
      "Najpierw źródło, potem cel. W archiwum możesz podać same nazwy plików.",
      "cp -v raport.txt raport-kopia.txt",
    ],
  },
  {
    id: "lab-move",
    title: "Raport na swoje miejsce",
    intro:
      "Kopia jest bezpieczna, więc oryginał może opuścić archiwum. mv przenosi plik albo zmienia jego nazwę. W odróżnieniu od cp plik znika ze starego miejsca. Jeśli celem jest istniejący katalog, plik trafi do niego pod tą samą nazwą.",
    task: "Przenieś raport.txt z archiwum do katalogu ~/biezace.",
    hints: [
      "Składnia mv jest taka sama jak cp: źródło, potem cel.",
      "mv raport.txt ~/biezace/",
    ],
  },
  {
    id: "cd-absolute",
    title: "Adres niezależny od miejsca",
    intro:
      "Ścieżka bezwzględna zaczyna się od /, czyli korzenia systemu, i działa niezależnie od miejsca, w którym stoisz. ~/biezace to skrót od /home/student/biezace. Samo biezace oznaczałoby katalog biezace wewnątrz bieżącego katalogu, a w archiwum takiego nie ma.",
    task: "Przejdź do /home/student/biezace, podając pełną ścieżkę bezwzględną.",
    hints: ["Początkowy ukośnik ma znaczenie.", "cd /home/student/biezace"],
  },
  {
    id: "lab-touch",
    title: "Przygotuj notatkę dla zespołu",
    intro:
      "Raport kończy się prośbą o notatkę dla zespołu. touch tworzy pusty plik, jeśli jeszcze go nie ma. Gdy plik istnieje, aktualizuje tylko datę modyfikacji i nie usuwa treści. Rozszerzenie .txt jest wygodną konwencją, Linux nie wymaga rozszerzeń.",
    task: "Utwórz pusty plik notatka.txt w katalogu ~/biezace.",
    hints: [
      "Jesteś w biezace, więc wystarczy sama nazwa pliku.",
      "touch notatka.txt",
    ],
  },
  {
    id: "lab-note",
    title: "Gotowy do pracy",
    intro:
      "nano to edytor tekstu działający w terminalu. Na dole pokazuje skróty: ^ oznacza Ctrl. Ctrl+O zapisuje plik, Enter potwierdza nazwę, a Ctrl+X zamyka edytor. Samo otwarcie pliku niczego nie zmienia, więc zapisz tekst przed wyjściem.",
    task: "Zapisz w ~/biezace/notatka.txt tekst Gotowy do pracy. Zapisz plik i zamknij edytor.",
    hints: [
      "Otwórz plik w nano i wpisz dokładnie Gotowy do pracy.",
      "nano notatka.txt, wpisz tekst, potem Ctrl+O, Enter i Ctrl+X.",
    ],
  },
  {
    id: "history",
    title: "Twój ślad pracy",
    intro:
      "Raport jest wśród spraw w toku, w archiwum została kopia, a zespół wie, że może na Ciebie liczyć. Na koniec obejrzyj ślad swojej pracy. Strzałki w górę i w dół przywołują poprzednie polecenia, Tab uzupełnia nazwy, a Ctrl+C przerywa trwającą operację. history wypisuje listę wykonanych poleceń.",
    task: "Wyświetl historię poleceń przez history.",
    hints: [
      "Historia należy do powłoki Bash.",
      "Wpisz history i naciśnij Enter.",
    ],
  },
] as const;

export const upcomingLabs = [
  "Linux: uprawnienia i procesy",
  "Grep, wyrażenia regularne i potoki",
  "Skrypty Basha",
  "Skrypty Basha: dalsza automatyzacja",
  "Archiwa, data i czas",
  "Midnight Commander i FTP",
  "Strona zespołu: HTML i CSS",
];
