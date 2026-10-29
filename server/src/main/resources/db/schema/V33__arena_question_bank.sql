-- Original scenario bank for #287. Q001-Q300 are stable editorial identifiers.
-- Coverage and primary reference anchors: docs/arena/question-bank-287.md.
ALTER TABLE arena_questions DROP CONSTRAINT arena_questions_category_check;
ALTER TABLE arena_questions ADD CONSTRAINT arena_questions_category_check
    CHECK (category IN ('WEB', 'SIECI', 'KRYPTOGRAFIA', 'LINUX', 'OGOLNE', 'WINDOWS', 'BLUE_TEAM', 'CHMURA'));

-- Repair unchanged original seed rows only; preserve administrator edits (version > 0).
UPDATE arena_questions SET correct_answer = 'Jest zbyt szybki i nie spowalnia zgadywania, więc hasła da się sprawdzać masowo',
    difficulty = 'MEDIUM', version = version + 1
WHERE content = 'Dlaczego MD5 nie nadaje się do przechowywania haseł?'
    AND correct_answer = 'Jest bardzo szybki i ma znane kolizje' AND version = 0;
UPDATE arena_questions SET correct_answer = 'Przechwytywanie ruchu przez ogłoszenie swojego MAC jako właściciela cudzego IP', version = version + 1
WHERE content = 'Co umożliwia ARP spoofing w sieci lokalnej?'
    AND correct_answer = 'Przechwytywanie ruchu przez podszycie się pod cudzy adres MAC' AND version = 0;
UPDATE arena_questions SET correct_answer = 'Dwa czynniki różnych rodzajów, na przykład hasło i kod z aplikacji uwierzytelniającej', version = version + 1
WHERE content = 'Co łączy uwierzytelnianie dwuskładnikowe (2FA)?'
    AND correct_answer = 'Dwa różne dowody tożsamości, na przykład hasło i kod z telefonu' AND version = 0;
UPDATE arena_questions SET difficulty = 'MEDIUM', version = version + 1
WHERE content = 'Czym jest SSRF?' AND difficulty = 'VERY_HARD' AND version = 0;

INSERT INTO arena_questions (content, correct_answer, wrong_answer_1, wrong_answer_2, wrong_answer_3, category, difficulty) VALUES
-- Q001
('Pracownik wysyła poufny raport na prywatną skrzynkę bez zgody firmy. Który element CIA jest bezpośrednio zagrożony ujawnieniem raportu?', 'Poufność informacji', 'Integralność informacji', 'Dostępność informacji', 'Rozliczalność operacji', 'OGOLNE', 'VERY_EASY'),
-- Q002
('Sklep nie przyjmuje zamówień przez awarię serwera. Który element CIA ucierpiał bezpośrednio?', 'Dostępność usługi', 'Poufność zamówień', 'Integralność zamówień', 'Autentyczność klientów', 'OGOLNE', 'VERY_EASY'),
-- Q003
('Ktoś zmienił numer konta na zatwierdzonej fakturze. Który element CIA naruszono przez tę zmianę?', 'Integralność danych', 'Dostępność danych', 'Poufność danych', 'Nadmiarowość danych', 'OGOLNE', 'VERY_EASY'),
-- Q004
('Portal prosi o hasło, zanim sprawdzi uprawnienia do raportu. Co realizuje sprawdzenie hasła?', 'Uwierzytelnienie użytkownika', 'Autoryzację do raportu', 'Archiwizację tożsamości', 'Rozliczenie wykorzystania', 'OGOLNE', 'VERY_EASY'),
-- Q005
('Na biurku zostaje wydruk z danymi klientów. Która zasada ograniczy dostęp przypadkowych osób?', 'Polityka czystego biurka', 'Polityka zmiany dostawców', 'Polityka wersjonowania kodu', 'Polityka przydziału adresów', 'OGOLNE', 'VERY_EASY'),
-- Q006
('Nowa osoba w SOC chce skanować firmę bez zgody. Co powinna uzyskać przed testem?', 'Zgodę i ustalony zakres testu', 'Listę wszystkich haseł firmy', 'Zrzut całego ruchu klientów', 'Kopię klucza podpisu firmy', 'OGOLNE', 'VERY_EASY'),
-- Q007
('W rejestrze ryzyka zapisano możliwość pożaru serwerowni. Czym jest pożar w tym scenariuszu?', 'Zagrożeniem dla zasobów', 'Zabezpieczeniem fizycznym', 'Podatnością w aplikacji', 'Dowodem naruszenia danych', 'OGOLNE', 'VERY_EASY'),
-- Q008
('Firma przechowuje CV kandydata z imieniem i e-mailem. Jak traktować te informacje w RODO?', 'Jako dane osobowe kandydata', 'Jako wyłącznie dane techniczne', 'Jako zawsze dane anonimowe', 'Jako automatycznie dane publiczne', 'OGOLNE', 'VERY_EASY'),
-- Q009
('Stażyście przyznano tylko odczyt dokumentów potrzebnych do zadania. Którą zasadę zastosowano?', 'Zasadę najmniejszych uprawnień', 'Zasadę dziedziczenia wyjątków', 'Zasadę pełnego zaufania sieci', 'Zasadę wspólnego konta zespołu', 'OGOLNE', 'EASY'),
-- Q010
('Pracownik zatwierdza w telefonie logowanie, którego nie rozpoczął. Jaki scenariusz należy podejrzewać?', 'Atak wykorzystujący zmęczenie MFA', 'Atak wykorzystujący fragmentację IP', 'Atak wykorzystujący przepełnienie ARP', 'Atak wykorzystujący zmianę strefy DNS', 'OGOLNE', 'EASY'),
-- Q011
('Drzwi wymagają karty, lecz obca osoba wchodzi za pracownikiem. Jak nazywa się to obejście kontroli?', 'Tailgating przy wejściu', 'Pharming w przeglądarce', 'Jamming transmisji radiowej', 'Skimming karty płatniczej', 'OGOLNE', 'EASY'),
-- Q012
('Firma ufa każdemu urządzeniu tylko dlatego, że jest w biurze. Co zmieni podejście zero trust?', 'Weryfikacja dostępu niezależnie od lokalizacji', 'Stały dostęp dla każdego adresu prywatnego', 'Pomijanie MFA w sieci pracowniczej', 'Zastąpienie autoryzacji filtrem adresów MAC', 'OGOLNE', 'EASY'),
-- Q013
('Firma rezygnuje z usługi, której ryzyka nie akceptuje. Jaką strategię reakcji na ryzyko wybrała?', 'Unikanie ryzyka', 'Transfer ryzyka', 'Akceptację ryzyka', 'Ograniczanie skutków przez polisę', 'OGOLNE', 'EASY'),
-- Q014
('Zespół kupuje polisę na część kosztów incydentu. Którą strategię reprezentuje to działanie?', 'Transfer części ryzyka', 'Usunięcie całego ryzyka', 'Rezygnację z działalności', 'Zwiększenie ekspozycji technicznej', 'OGOLNE', 'EASY'),
-- Q015
('Formularz newslettera wymaga PESEL, choć wystarcza e-mail. Która zasada RODO jest tu szczególnie istotna?', 'Minimalizacja zbieranych danych', 'Nieograniczone przechowywanie danych', 'Domniemana jawność danych klientów', 'Automatyczna zgoda na dowolny cel', 'OGOLNE', 'EASY'),
-- Q016
('Księgowy tworzy przelew, a inna osoba go zatwierdza. Jaki mechanizm ogranicza nadużycia jednej osoby?', 'Rozdział obowiązków', 'Agregacja uprawnień', 'Wspólne dane logowania', 'Dziedziczenie zaufania', 'OGOLNE', 'EASY'),
-- Q017
('System AAA zapisuje, kto pobrał raport i kiedy. Który składnik AAA realizuje ten zapis?', 'Accounting, czyli rejestrowanie aktywności', 'Authentication, czyli potwierdzenie tożsamości', 'Authorization, czyli przyznanie prawa', 'Availability, czyli zapewnienie działania', 'OGOLNE', 'MEDIUM'),
-- Q018
('Analityk potrzebuje dostępu administratora przez 30 minut do jednej naprawy. Jak ograniczyć stałe uprawnienia?', 'Nadać czasowy dostęp JIT do zadania', 'Dodać go na stałe do administratorów', 'Udostępnić mu wspólne konto serwisowe', 'Wyłączyć rejestrowanie tej sesji', 'OGOLNE', 'MEDIUM'),
-- Q019
('Dostawca wysyła fakturę z nowym kontem i prośbą o pilny przelew. Jak zweryfikować zmianę?', 'Oddzwonić na wcześniej zweryfikowany numer', 'Odpowiedzieć na numer z podejrzanej faktury', 'Sprawdzić tylko logo w załączonym pliku', 'Ufać zmianie, jeśli e-mail zawiera podpis', 'OGOLNE', 'MEDIUM'),
-- Q020
('Pracownik odszedł, ale zachował aktywną sesję SaaS. Co powinien obejmować offboarding?', 'Wyłączenie konta i unieważnienie sesji', 'Wyłącznie odebranie identyfikatora biurowego', 'Wyłącznie skasowanie lokalnego profilu', 'Wyłącznie zmianę nazwy wyświetlanej konta', 'OGOLNE', 'MEDIUM'),
-- Q021
('Zasób ma wartość 100 000 zł, a strata w zdarzeniu to 20%. Zdarzenie występuje średnio raz na 5 lat. Ile wynosi ALE?', '4 000 zł rocznie', '20 000 zł rocznie', '50 000 zł rocznie', '100 000 zł rocznie', 'OGOLNE', 'MEDIUM'),
-- Q022
('BIA określa, że usługę trzeba odtworzyć w 2 godziny, tracąc najwyżej 15 minut danych. Jakie są cele?', 'RTO 2 godziny, RPO 15 minut', 'RTO 15 minut, RPO 2 godziny', 'MTTR 15 minut, MTTF 2 godziny', 'MTTF 15 minut, MTBF 2 godziny', 'OGOLNE', 'MEDIUM'),
-- Q023
('Firma sama ustala cele i sposoby przetwarzania danych klientów. Jaką rolę zwykle pełni według RODO?', 'Administratora danych osobowych', 'Podmiotu przetwarzającego na jej zlecenie', 'Inspektora ochrony danych z urzędu', 'Organu nadzorczego właściwego dla klientów', 'OGOLNE', 'MEDIUM'),
-- Q024
('Organizacja ustala, czy podlega NIS2. Jakie informacje należy sprawdzić zamiast uznać, że obejmuje ona każdą firmę?', 'Sektor, wielkość, wyjątki i przepisy wdrażające', 'Wyłącznie liczbę komputerów w sieci Wi-Fi', 'Wyłącznie kraj producenta programu pocztowego', 'Wyłącznie obecność szyfrowania dysków', 'OGOLNE', 'MEDIUM'),
-- Q025
('Przejęte konto ma MFA, ale atakujący używa skradzionego aktywnego cookie. Który krok bezpośrednio ograniczy użycie tej sesji?', 'Unieważnienie sesji i powiązanych tokenów', 'Zmiana wyłącznie nazwy użytkownika', 'Włączenie dodatkowej historii przeglądarki', 'Zmiana wyłącznie adresu odzyskiwania', 'OGOLNE', 'HARD'),
-- Q026
('Do aplikacji finansowej dostęp ma mieć dział kadr tylko z zarządzanych urządzeń w godzinach pracy. Który model opisuje taką decyzję?', 'ABAC z atrybutami użytkownika i kontekstu', 'RBAC oparty wyłącznie na jednej roli', 'DAC oparty wyłącznie na właścicielu pliku', 'Kontrola oparta wyłącznie na adresie MAC', 'OGOLNE', 'HARD'),
-- Q027
('Serwis ufa nagłówkowi X-User od klienta zamiast tożsamości ze zweryfikowanej bramy. Co jest źródłem błędu?', 'Użycie danych klienta jako dowodu tożsamości', 'Brak kompresji przesyłanego nagłówka', 'Użycie tekstowego formatu odpowiedzi', 'Brak zapisu nagłówka w pamięci podręcznej', 'OGOLNE', 'HARD'),
-- Q028
('Przed usunięciem plików użytkownik usuwa wpisy w logach aplikacji, do których ma zapis. Co najlepiej utrudni ukrycie śladów?', 'Centralny odbiór logów z ograniczeniem ich modyfikacji', 'Dłuższy czas życia sesji w aplikacji', 'Większy limit rozmiaru załączników', 'Lokalne logi w tym samym katalogu co pliki', 'OGOLNE', 'HARD'),
-- Q029
('Po pseudonimizacji administrator zachował tabelę łączącą identyfikatory z osobami. Jak traktować zbiór w RODO?', 'Nadal jako dane osobowe możliwe do przypisania', 'Jako dane anonimowe niezależnie od tabeli', 'Jako dane wyłączone z ochrony przez sam skrót', 'Jako dane publiczne po zmianie identyfikatorów', 'OGOLNE', 'HARD'),
-- Q030
('Polityka wymaga pełnego testu odzyskiwania kopii, ale zespół sprawdza tylko sukces zadania backupu. Czego brakuje?', 'Dowodu odtworzenia danych w wymaganym czasie', 'Dowodu uruchomienia harmonogramu kopii', 'Dowodu przydziału nazwy dla kopii', 'Dowodu istnienia konta wykonującego kopię', 'OGOLNE', 'HARD'),
-- Q031
('W ocenie ryzyka zespół uwzględnił zabezpieczenia już wdrożone. Jak nazywa się ryzyko pozostające po tych zabezpieczeniach?', 'Ryzyko rezydualne', 'Ryzyko inherentne przed kontrolami', 'Wartość utraconego aktywa', 'Częstotliwość pierwotnego zagrożenia', 'OGOLNE', 'HARD'),
-- Q032
('Podmiot przetwarzający wykrywa naruszenie danych obsługiwanych dla klienta. Komu według RODO powinien zgłosić je bez zbędnej zwłoki?', 'Administratorowi tych danych', 'Wyłącznie producentowi systemu operacyjnego', 'Wyłącznie wszystkim innym swoim klientom', 'Wyłącznie dostawcy połączenia internetowego', 'OGOLNE', 'HARD'),
-- Q033
('Logowanie używa klucza FIDO2, ale odzyskiwanie konta pozwala zmienić MFA po podaniu publicznej daty urodzenia. Gdzie pozostaje istotne obejście?', 'W słabszej weryfikacji procesu odzyskiwania', 'W konieczności użycia kryptografii asymetrycznej', 'W samym wiązaniu klucza z domeną usługi', 'W braku ręcznego przepisywania kodu z klucza', 'OGOLNE', 'VERY_HARD'),
-- Q034
('Usługa A ma własny szeroki dostęp do faktur i na żądanie klienta pobiera dowolny numer faktury dla B. Nie sprawdza praw klienta. Jaki problem ilustruje ten przepływ?', 'Confused deputy i brak autoryzacji obiektowej', 'Niewystarczającą długość klucza szyfrowania', 'Kolizję identyfikatorów sesji w pamięci', 'Błąd synchronizacji zegara systemowego', 'OGOLNE', 'VERY_HARD'),
-- Q035
('Token użytkownika jest poprawnie podpisany, ale przeznaczony dla innej usługi. API akceptuje go bez kontroli odbiorcy. Które sprawdzenie usuwa ten konkretny błąd?', 'Walidacja oczekiwanej wartości aud', 'Walidacja wyłącznie obecności pola sub', 'Walidacja wyłącznie długości podpisu', 'Walidacja wyłącznie rozmiaru tokenu', 'OGOLNE', 'VERY_HARD'),
-- Q036
('System ocenia uprawnienia do przelewu, a potem pozwala zmienić odbiorcę bez ponownej oceny. Jak zabezpieczyć tę granicę?', 'Powiązać zatwierdzenie z niezmienną treścią transakcji', 'Przedłużyć sesję po każdym przelewie', 'Ukryć pole odbiorcy wyłącznie w interfejsie', 'Przenieść dziennik audytowy do przeglądarki', 'OGOLNE', 'VERY_HARD'),
-- Q037
('Region zapasowy istnieje, lecz używa tego samego konta administratora i klucza co produkcja. Dlaczego nie zapewnia pełnej odporności na przejęcie tego konta?', 'Wspólna granica zaufania umożliwia naruszenie obu środowisk', 'Oddzielny region wyklucza używanie kopii offline', 'Replikacja z definicji usuwa wszystkie uprawnienia', 'Konto administratora nie może mieć zasięgu wielu regionów', 'OGOLNE', 'VERY_HARD'),
-- Q038
('Kontrola A blokuje 80% ataków, a B również 80%, lecz oba wyniki pochodzą z tej samej listy sygnatur. Dlaczego nie można automatycznie przyjąć skuteczności 96%?', 'Nie wykazano niezależności działania obu kontroli', 'Procentów skuteczności nigdy nie wolno mnożyć', 'Każda druga kontrola obniża skuteczność do zera', 'Skuteczność kontroli zawsze wynosi dokładnie 80%', 'OGOLNE', 'VERY_HARD'),
-- Q039
('Zespół usuwa dane zgodnie z żądaniem, ale musi zachować część dokumentacji do wykonania obowiązku prawnego. Jak podejść do prawa do usunięcia w RODO?', 'Ocenić wyjątek i zachować tylko niezbędny zakres na tej podstawie', 'Usunąć całą dokumentację mimo obowiązku prawnego', 'Uznać każdą kopię danych za bezterminowo wyłączoną z RODO', 'Opublikować zachowane dokumenty jako dowód realizacji żądania', 'OGOLNE', 'VERY_HARD'),
-- Q040
('Dwóch dostawców awaryjnych korzysta z tego samego operatora centrum danych. Co musi uwzględnić analiza ciągłości działania?', 'Wspólną zależność jako źródło skorelowanej awarii', 'Wyłącznie różne nazwy handlowe dostawców', 'Wyłącznie sumę nominalnej przepustowości łączy', 'Automatyczne wyeliminowanie ryzyka przez dwie umowy', 'OGOLNE', 'VERY_HARD'),
-- Q041
('Laptop otrzymał adres, bramę i DNS automatycznie po podłączeniu do LAN. Który protokół typowo dostarcza taką konfigurację IPv4?', 'DHCP', 'SNMP', 'NTP', 'SMTP', 'SIECI', 'VERY_EASY'),
-- Q042
('Administrator musi bezpiecznie przesłać plik przez połączenie SSH. Która usługa pasuje do zadania?', 'SFTP', 'TFTP', 'FTP', 'Telnet', 'SIECI', 'VERY_EASY'),
-- Q043
('Komputer zna IPv4 bramy, ale potrzebuje jej adresu MAC w tej samej sieci Ethernet. Czego użyje?', 'ARP', 'DNS', 'NTP', 'IMAP', 'SIECI', 'VERY_EASY'),
-- Q044
('Analityk widzi połączenie do 127.0.0.1. Dokąd kierowany jest ten adres IPv4?', 'Do lokalnego hosta', 'Do całej sieci lokalnej', 'Do domyślnej bramy', 'Do publicznego DNS', 'SIECI', 'VERY_EASY'),
-- Q045
('Goście mają otrzymać internet bez dostępu do komputerów pracowników. Który podział najlepiej wspiera ten cel?', 'Oddzielna sieć gościnna z filtrowaniem ruchu', 'Wspólne hasło administratora dla wszystkich', 'Jeden wspólny udział plików dla obu grup', 'Stałe wyłączenie szyfrowania w sieci Wi-Fi', 'SIECI', 'VERY_EASY'),
-- Q046
('Pracownik łączy się z panelem routera przez Telnet. Co należy wybrać, aby szyfrować sesję tekstową?', 'SSH', 'HTTP', 'TFTP', 'SNMPv1', 'SIECI', 'VERY_EASY'),
-- Q047
('Pakiety muszą przejść z jednej podsieci IP do innej. Które urządzenie zwykle wybiera trasę między nimi?', 'Router', 'Pasywny koncentrator', 'Regenerator sygnału', 'Punkt końcowy Bluetooth', 'SIECI', 'VERY_EASY'),
-- Q048
('Zespół chce porównać czas zdarzeń na wielu serwerach. Który protokół pomaga synchronizować zegary?', 'NTP', 'ARP', 'FTP', 'POP3', 'SIECI', 'VERY_EASY'),
-- Q049
('Skan nmap pokazuje 22/tcp open ssh. Co wynika z tego wpisu bez dalszej weryfikacji?', 'Na porcie TCP 22 odpowiada usługa rozpoznana jako SSH', 'Na serwerze na pewno można zalogować się bez hasła', 'Wszystkie konta serwera mają uprawnienia root', 'Serwer na pewno ma publicznie znaną podatność', 'SIECI', 'EASY'),
-- Q050
('DNS zwraca NXDOMAIN dla błędnie wpisanej nazwy. Co oznacza ten wynik?', 'Nazwa domenowa nie istnieje według odpowiedzi DNS', 'Serwer DNS zawsze utracił połączenie z siecią', 'Port HTTPS pod tym adresem jest zamknięty', 'Certyfikat domeny został unieważniony', 'SIECI', 'EASY'),
-- Q051
('Administrator chce zapisać pakiety kierowane na port DNS 53 narzędziem tcpdump. Który filtr pasuje?', 'port 53', 'host 53', 'net 53', 'ether proto 53', 'SIECI', 'EASY'),
-- Q052
('Zapora ma dopuszczać wyłącznie wymagane połączenia. Jaka powinna być reguła domykająca politykę?', 'Odrzucanie pozostałego ruchu', 'Zezwalanie na pozostały ruch', 'Przekierowanie całego ruchu do DNS', 'Usunięcie informacji o portach', 'SIECI', 'EASY'),
-- Q053
('Host ma adres 10.20.30.50/24. Który adres należy do tej samej podsieci?', '10.20.30.60', '10.20.31.60', '10.20.29.60', '10.21.30.60', 'SIECI', 'EASY'),
-- Q054
('Przełącznik ma odseparować logicznie księgowość od laboratorium. Która funkcja dzieli sieć warstwy drugiej?', 'VLAN', 'NAT', 'PAT', 'DNSSEC', 'SIECI', 'EASY'),
-- Q055
('Czujnik IDS wykrywa atak, lecz nie blokuje pakietów. Jaka jest jego typowa rola w tym trybie?', 'Monitorowanie i generowanie alertów', 'Wymuszanie blokady każdego wykrytego pakietu', 'Nadawanie certyfikatów serwerom', 'Przydzielanie adresów klientom', 'SIECI', 'EASY'),
-- Q056
('Użytkownik ma poprawny IP, lecz nazwy stron się nie rozwiązują. Jaki test najlepiej sprawdzi podejrzany składnik?', 'Zapytanie dig do skonfigurowanego DNS', 'Zmiana uprawnień lokalnego katalogu', 'Odczyt tablicy partycji dysku', 'Porównanie wersji edytora tekstu', 'SIECI', 'EASY'),
-- Q057
('Po SYN host odpowiada RST na port TCP 445. Jak skan SYN zwykle sklasyfikuje ten port?', 'Jako zamknięty', 'Jako otwarty', 'Jako otwarty z TLS', 'Jako potwierdzone SMBv1', 'SIECI', 'MEDIUM'),
-- Q058
('Skan UDP nie otrzymuje odpowiedzi ani błędu ICMP. Dlaczego wynik open/filtered wymaga ostrożności?', 'Cisza nie rozstrzyga między usługą a filtrowaniem', 'Cisza zawsze potwierdza działający serwer DNS', 'Cisza oznacza wyłącznie wyłączony interfejs', 'UDP zawsze odpowiada pakietem RST', 'SIECI', 'MEDIUM'),
-- Q059
('Sieć 192.168.10.0/26 ma tradycyjną adresację z adresem sieci i broadcast. Ile adresów hostów jest dostępnych?', '62', '64', '30', '126', 'SIECI', 'MEDIUM'),
-- Q060
('Klient zestawia TCP z serwerem, ale odpowiedź wraca inną trasą przez zaporę stanową. Co może powodować odrzucanie sesji?', 'Asymetryczny routing bez wspólnego stanu', 'Zbyt krótka nazwa domenowa klienta', 'Użycie adresów prywatnych po obu stronach', 'Zbyt duża liczba rekordów TXT w DNS', 'SIECI', 'MEDIUM'),
-- Q061
('W LAN pojawił się obcy DHCP rozdający błędną bramę. Która funkcja przełącznika ogranicza takie odpowiedzi?', 'DHCP snooping z zaufanymi portami', 'Port mirroring na wszystkich portach', 'Wyłączenie kontroli ramek broadcast', 'Zwiększenie czasu dzierżawy na klientach', 'SIECI', 'MEDIUM'),
-- Q062
('Usługa DNS udostępnia rekurencję całemu internetowi. Jakie nadużycie może wspierać przy podszywaniu adresu źródłowego?', 'Refleksyjny atak amplifikacyjny DDoS', 'Odszyfrowanie ruchu TLS klientów', 'Automatyczny odczyt haseł z LDAP', 'Modyfikację plików przez protokół ARP', 'SIECI', 'MEDIUM'),
-- Q063
('W Wi-Fi goście widzą inne urządzenia gości. Która funkcja AP ograniczy bezpośrednią komunikację klientów tego samego SSID?', 'Izolacja klientów bezprzewodowych', 'Wyłącznie ukrycie nazwy SSID', 'Wyłącznie zmiana kanału radiowego', 'Wyłącznie zwiększenie mocy anteny', 'SIECI', 'MEDIUM'),
-- Q064
('Host w DMZ musi pytać wewnętrzny DNS i nie potrzebuje innych połączeń do LAN. Jaką regułę dodać?', 'Zezwolić do wskazanego DNS na potrzebny TCP i UDP 53', 'Zezwolić z DMZ do całego LAN na wszystkie porty', 'Zezwolić tylko na HTTP do dowolnego serwera LAN', 'Zezwolić na dowolny ruch, jeśli pochodzi z portu 53', 'SIECI', 'MEDIUM'),
-- Q065
('Administrator uruchomił nmap -sV na zatwierdzonym celu. Co wnosi ta opcja względem samej listy portów?', 'Sondowanie usług w celu rozpoznania wersji', 'Automatyczne wykorzystanie każdej podatności', 'Gwarancję pominięcia wszystkich alertów IDS', 'Odczyt wszystkich lokalnych haseł systemu', 'SIECI', 'HARD'),
-- Q066
('Zapora akceptuje pakiety tylko na podstawie portu źródłowego 53. Dlaczego to słaba kontrola DNS?', 'Nadawca może ustawić taki port bez wysyłania DNS', 'Port źródłowy 53 automatycznie uwierzytelnia serwer', 'Każdy pakiet z portu 53 ma podpis DNSSEC', 'Tylko system operacyjny serwera DNS może wybrać ten port', 'SIECI', 'HARD'),
-- Q067
('Łącze działa dla małych pakietów, lecz duże transfery z DF zawieszają się po zestawieniu TCP. Routery odrzucają ICMP fragmentation needed. Co podejrzewać?', 'Black hole mechanizmu Path MTU Discovery', 'Zatrucie pamięci podręcznej przeglądarki', 'Zbyt długi czas TTL w rekordzie MX', 'Wyłącznie błąd uwierzytelniania WPA3', 'SIECI', 'HARD'),
-- Q068
('W środowisku IPv6 obcy host rozsyła Router Advertisements. Która kontrola na przełączniku ogranicza to zagrożenie?', 'RA Guard na niezaufanych portach', 'DHCP snooping wyłącznie dla IPv4', 'Wyłącznie filtrowanie portu TCP 443', 'Wyłącznie wyłączenie odpowiedzi DNS AAAA', 'SIECI', 'HARD'),
-- Q069
('Zespół wdraża 802.1X z EAP-TLS. Co klient powinien zweryfikować, aby utrudnić podszycie się pod serwer uwierzytelniający?', 'Łańcuch zaufania i oczekiwaną nazwę serwera', 'Wyłącznie siłę sygnału punktu dostępowego', 'Wyłącznie zgodność widocznej nazwy SSID', 'Wyłącznie producenta karty bezprzewodowej', 'SIECI', 'HARD'),
-- Q070
('W zatwierdzonym teście transfer strefy AXFR ujawnia rekordy domeny obcemu hostowi. Co ograniczy ten wyciek?', 'Ograniczenie transferów do uprawnionych serwerów', 'Wydłużenie TTL wszystkich rekordów domeny', 'Dodanie kolejnego publicznego rekordu A', 'Zmiana adresów resolverów na stacjach', 'SIECI', 'HARD'),
-- Q071
('Host musi łączyć się wyłącznie z firmowym repozytorium przez HTTPS. Dlaczego samo dopuszczenie portu 443 do całego internetu nie spełnia celu?', 'Port docelowy nie ogranicza tożsamości odbiorcy', 'Port 443 automatycznie usuwa szyfrowanie ruchu', 'HTTPS uniemożliwia jakąkolwiek kontrolę połączeń', 'Ruch na 443 może prowadzić wyłącznie do repozytorium', 'SIECI', 'HARD'),
-- Q072
('Wireshark pokazuje wiele SYN do jednego serwera, niewiele końcowych ACK i rosnącą kolejkę półotwartych sesji. Jaki atak pasuje najlepiej?', 'Zalewanie SYN wyczerpujące stan połączeń', 'Próby transferu strefy przez DNS AXFR', 'Fałszowanie odpowiedzi protokołu NTP', 'Podszywanie się pod serwer pocztowy SMTP', 'SIECI', 'HARD'),
-- Q073
('Przeglądarka i serwer obsługują duże transfery, ale po dodaniu tunelu IPsec PMTU spada. ICMP jest blokowany. Co naprawia przyczynę zamiast wyłączać TLS?', 'Dopuścić właściwe komunikaty PMTU i dopasować MTU tunelu', 'Zwiększyć wyłącznie rozmiar bufora DNS', 'Wyłączyć kontrolę certyfikatu serwera HTTPS', 'Dodać regułę wpuszczającą dowolny ruch przychodzący', 'SIECI', 'VERY_HARD'),
-- Q074
('W regułach egress IPv4 zablokowano internet, lecz host ma globalny IPv6 i trasę domyślną. Transfer nadal działa. Jak usunąć obejście?', 'Objąć równoważną polityką również ruch IPv6', 'Usunąć wyłącznie rekordy DNS typu A', 'Zmienić wyłącznie adres MAC interfejsu', 'Zablokować wyłącznie prywatną pulę IPv4', 'SIECI', 'VERY_HARD'),
-- Q075
('Dynamic ARP Inspection odrzuca ruch legalnego hosta ze statycznym IPv4, nieobecnego w bazie DHCP snooping. Jak zachować ochronę i obsłużyć host?', 'Dodać kontrolowane statyczne powiązanie IP-MAC', 'Uczynić wszystkie porty użytkowników zaufanymi', 'Wyłączyć inspekcję ARP w całej organizacji', 'Wymusić szyfrowanie DNS na tym hoście', 'SIECI', 'VERY_HARD'),
-- Q076
('Reguła wykrywa skany, licząc tylko różne porty na pojedynczym IP źródłowym w minutę. Co może ją ominąć bez rezygnacji ze skanowania?', 'Rozłożenie prób w czasie i między źródłami', 'Wysyłanie wszystkich prób w jednej sekundzie', 'Skanowanie większej liczby portów z jednego IP', 'Powtarzanie jednego źródła z większą szybkością', 'SIECI', 'VERY_HARD'),
-- Q077
('Resolver poprawnie waliduje DNSSEC i zwraca SERVFAIL dla podpisanej strefy po rotacji klucza. DS u rodzica wskazuje stary klucz. Co sprawdzić najpierw?', 'Spójność łańcucha DS i DNSKEY po rotacji', 'Wyłącznie numer portu HTTPS na serwerze', 'Wyłącznie hasło konta pocztowego administratora', 'Wyłącznie wielkość plików hostowanych w strefie', 'SIECI', 'VERY_HARD'),
-- Q078
('NAT przekierowuje publiczny port 443 do aplikacji, ale firewall wciąż dopuszcza dowolny ruch do serwera. Jaki wniosek o ochronie przez NAT jest poprawny?', 'Translacja adresów nie zastępuje polityki filtrowania', 'Translacja adresów potwierdza tożsamość każdego klienta', 'NAT automatycznie weryfikuje wszystkie żądania HTTP', 'NAT eliminuje podatności aplikacji dostępnej na 443', 'SIECI', 'VERY_HARD'),
-- Q079
('Sensor sieciowy widzi tylko zaszyfrowany ruch TLS 1.3 i nie ma kluczy sesji. Których danych nie odczyta z samego ładunku TLS?', 'Treści żądania HTTP wewnątrz sesji', 'Docelowego adresu IP widocznego w pakiecie', 'Docelowego portu TCP widocznego w pakiecie', 'Rozmiaru pakietu widocznego na interfejsie', 'SIECI', 'VERY_HARD'),
-- Q080
('Dwa VLAN-y mają różne identyfikatory, lecz router dopuszcza między nimi dowolny ruch. Co brakuje, jeśli celem jest ograniczenie ruchu bocznego?', 'Polityki kontroli komunikacji między segmentami', 'Wyłącznie innej nazwy opisowej VLAN-ów', 'Wyłącznie zwiększenia liczby portów przełącznika', 'Wyłącznie wspólnego serwera czasu w obu VLAN-ach', 'SIECI', 'VERY_HARD'),
-- Q081
('Na stronie logowania adres zaczyna się od http://, a użytkownik jest w niezaufanej sieci. Co chroni transmisję danych logowania?', 'HTTPS z poprawnie zweryfikowanym certyfikatem', 'Samo skrócenie czasu wyświetlania formularza', 'Samo ukrycie przycisku logowania przed gośćmi', 'Samo dodanie ostrzeżenia w stopce strony', 'WEB', 'VERY_EASY'),
-- Q082
('Użytkownik zmienia numer zamówienia w URL i widzi cudzy zakup. Jaki typ kontroli powinien egzekwować serwer?', 'Uprawnienia do konkretnego zamówienia', 'Poprawność długości nazwy przeglądarki', 'Zgodność koloru przycisku z motywem', 'Kolejność parametrów w pasku adresu', 'WEB', 'VERY_EASY'),
-- Q083
('Po wylogowaniu cookie sesji wciąż pozwala otworzyć konto. Co powinno zrobić wylogowanie po stronie serwera?', 'Unieważnić aktywną sesję', 'Wyłącznie zmienić tytuł strony', 'Wyłącznie ukryć menu profilu', 'Wyłącznie zamknąć kartę przeglądarki', 'WEB', 'VERY_EASY'),
-- Q084
('Aplikacja pokazuje gościowi pełny stack trace z nazwami tabel. Co ograniczy ujawnianie szczegółów?', 'Ogólny komunikat dla klienta i szczegóły w chronionym logu', 'Pełny stack trace przeniesiony do parametru URL', 'Te same szczegóły dostępne pod innym kolorem tekstu', 'Wyłączenie wszystkich logów także dla administratora', 'WEB', 'VERY_EASY'),
-- Q085
('Formularz pozwala wysłać hasło w parametrze URL. Gdzie może ono trafić poza bazą aplikacji?', 'Do historii przeglądarki i logów adresów URL', 'Wyłącznie do szyfrowanej pamięci procesora', 'Wyłącznie do magazynu kluczy systemu', 'Do podpisu cyfrowego certyfikatu serwera', 'WEB', 'VERY_EASY'),
-- Q086
('Programista ukrywa przycisk administratora w CSS. Co jeszcze musi sprawdzać API przy żądaniu administracyjnym?', 'Uprawnienia nadawcy po stronie serwera', 'Wyłącznie rozdzielczość ekranu nadawcy', 'Wyłącznie kolor ukrytego przycisku', 'Wyłącznie pozycję menu na stronie', 'WEB', 'VERY_EASY'),
-- Q087
('W komentarzu pojawia się kod, który przeglądarka interpretuje jako HTML. Jak bezpiecznie wyświetlić zwykły tekst komentarza?', 'Kodować go zgodnie z kontekstem wyjścia', 'Usuwać wyłącznie znak spacji z komentarza', 'Zamienić wyłącznie wielkie litery na małe', 'Dodać komentarz do nazwy pliku serwera', 'WEB', 'VERY_EASY'),
-- Q088
('Aplikacja loguje pełne tokeny sesyjne. Dlaczego dostęp do tych logów jest wrażliwy?', 'Token może pozwolić na przejęcie sesji', 'Token zawsze ujawnia prywatny klucz TLS', 'Token zawsze daje dostęp do każdego konta', 'Token nie ma żadnego znaczenia po logowaniu', 'WEB', 'VERY_EASY'),
-- Q089
('Cookie ma flagę Secure, ale nie HttpOnly. Który dodatkowy cel realizuje HttpOnly?', 'Ograniczenie odczytu cookie przez JavaScript', 'Ograniczenie wszystkich żądań HTTP do localhost', 'Zastąpienie szyfrowania TLS podpisem cookie', 'Zablokowanie każdego żądania między domenami', 'WEB', 'EASY'),
-- Q090
('API składa SQL przez doklejanie tekstu z filtra wyszukiwania. Co powinno zastąpić ten mechanizm?', 'Parametryzowane zapytanie z wartościami wiązanymi', 'Kodowanie całego SQL algorytmem Base64', 'Ukrycie adresu API w kodzie przeglądarki', 'Wydłużenie czasu życia sesji użytkownika', 'WEB', 'EASY'),
-- Q091
('Atakujący dodaje do profilu własne pole isAdmin=true, a backend bezpośrednio mapuje wszystkie pola na encję. Jaka to klasa błędu?', 'Mass assignment niekontrolowanych pól', 'Nadmierna kompresja odpowiedzi HTTP', 'Kolizja identyfikatorów po stronie DNS', 'Niepoprawna fragmentacja pakietów IP', 'WEB', 'EASY'),
-- Q092
('Nieautoryzowany formularz z obcej strony wysyła przelew z cookie ofiary. Jaki mechanizm bezpośrednio utrudnia klasyczny CSRF?', 'Token anty-CSRF walidowany przez backend', 'Haszowanie nazwy przycisku formularza', 'Zwiększenie maksymalnej długości adresu URL', 'Przeniesienie formularza do innej zakładki', 'WEB', 'EASY'),
-- Q093
('Serwer pobiera obraz z URL podanego przez klienta i może sięgnąć do wewnętrznej sieci. Co należy podejrzewać?', 'Podatność SSRF w pobieraniu zasobu', 'Podatność XSS w odczycie obrazu przez serwer', 'Podatność CSRF wymagającą cookie administratora', 'Podatność na łamanie klucza publicznego', 'WEB', 'EASY'),
-- Q094
('Aplikacja przyjmuje nazwę pliku i odczytuje go bez kontroli katalogu bazowego. Co oznacza próba z ../ w tej nazwie?', 'Próbę wyjścia poza dozwolony katalog', 'Próbę negocjacji nowej wersji TLS', 'Próbę zmiany kodowania całej domeny', 'Próbę transferu strefy przez DNS', 'WEB', 'EASY'),
-- Q095
('Strona płatności ma być odporna na osadzenie w cudzym iframe. Która dyrektywa CSP określa dozwolonych osadzających?', 'frame-ancestors', 'default-language', 'script-hashes', 'cookie-origin', 'WEB', 'EASY'),
-- Q096
('Endpoint resetu hasła zawsze zwraca informację, czy e-mail istnieje. Co może ujawniać taka różnica odpowiedzi?', 'Istnienie kont użytkowników', 'Prywatne klucze wszystkich kont', 'Pełną zawartość bazy haseł', 'Uprawnienia procesu systemowego', 'WEB', 'EASY'),
-- Q097
('API /users/me ignoruje sub z tokenu i ufa userId w JSON. Jaka jest właściwa granica zaufania?', 'Wyznaczać użytkownika z uwierzytelnionego kontekstu', 'Ufać JSON, jeśli ma typ application/json', 'Ufać JSON, jeśli wysłano go metodą POST', 'Wyznaczać użytkownika z długości odpowiedzi', 'WEB', 'MEDIUM'),
-- Q098
('Upload sprawdza tylko rozszerzenie .jpg. Atakujący może kontrolować zawartość i nagłówek MIME. Jak wzmocnić walidację obrazu?', 'Dekodować obraz z limitami i zapisywać bez wykonywania kodu', 'Ufać wyłącznie MIME przesłanemu przez klienta', 'Ufać wyłącznie oryginalnej nazwie pliku', 'Uruchamiać każdy upload jako skrypt kontrolny', 'WEB', 'MEDIUM'),
-- Q099
('JWT ma poprawny format, ale podpisu nie zweryfikowano. Co powinno poprzedzić zaufanie polu role?', 'Weryfikacja podpisu i wymaganych roszczeń tokenu', 'Wyłącznie dekodowanie środkowej części Base64url', 'Wyłącznie sprawdzenie długości pola role', 'Wyłącznie zamiana formatu tokenu na JSON', 'WEB', 'MEDIUM'),
-- Q100
('API oddaje błędy 500 po pojedynczym apostrofie w wyszukiwaniu. Jaki jest rozsądny wniosek z samego objawu?', 'To sygnał do weryfikacji, a nie dowód SQL injection', 'To jednoznaczny dowód pełnego przejęcia bazy', 'To pewny dowód wykonania kodu JavaScript', 'To potwierdzenie wyłącznie awarii certyfikatu', 'WEB', 'MEDIUM'),
-- Q101
('Parser XML przetwarza encje zewnętrzne w danych klienta. Jaka zmiana ogranicza XXE, gdy aplikacja ich nie potrzebuje?', 'Wyłączyć DTD i rozwiązywanie encji zewnętrznych', 'Dopuścić encje tylko przy długich nazwach plików', 'Zwiększyć rozmiar odpowiedzi parsera XML', 'Zmienić nazwę głównego elementu dokumentu', 'WEB', 'MEDIUM'),
-- Q102
('Aplikacja zezwala na przekierowanie do dowolnego URL z parametru next. Która kontrola ogranicza open redirect?', 'Lista dozwolonych lokalnych celów przekierowania', 'Wyłącznie wymaganie portu 443 w dowolnym celu', 'Wyłącznie dodanie losowego parametru do URL', 'Wyłącznie sprawdzenie długości nazwy hosta', 'WEB', 'MEDIUM'),
-- Q103
('Atakujący wywołuje kosztowny endpoint tysiące razy na sekundę. Która kontrola bezpośrednio ogranicza takie zużycie?', 'Limity wywołań i kosztu operacji na serwerze', 'Wyłącznie ukrycie przycisku w przeglądarce', 'Wyłącznie zmiana numeracji odpowiedzi HTTP', 'Wyłącznie dłuższe nazwy parametrów wejścia', 'WEB', 'MEDIUM'),
-- Q104
('Serwer wstawia dane użytkownika do polecenia powłoki. Jak ograniczyć command injection przy uruchamianiu narzędzia?', 'Wywołać program bez powłoki z kontrolowaną listą argumentów', 'Dodać dane do polecenia po usunięciu samych spacji', 'Zakodować polecenie Base64 przed przekazaniem powłoce', 'Uruchomić powłokę z szerszymi uprawnieniami systemowymi', 'WEB', 'MEDIUM'),
-- Q105
('SSRF sprawdza pierwszy URL, ale klient HTTP automatycznie śledzi przekierowanie do 127.0.0.1. Co trzeba dodać?', 'Walidację każdego celu przekierowania lub ich wyłączenie', 'Wyłącznie większy limit liczby przekierowań', 'Wyłącznie sprawdzanie końcówki .png w pierwszym URL', 'Wyłącznie zmianę nagłówka User-Agent klienta', 'WEB', 'HARD'),
-- Q106
('CORS odzwierciedla dowolny Origin i pozwala na credentials. API używa cookie dostępnego w takim żądaniu. Co może się stać?', 'Obca dozwolona origin odczyta uwierzytelnioną odpowiedź', 'Każda odpowiedź zostanie automatycznie zaszyfrowana dla serwera', 'Przeglądarka przestanie wysyłać wszystkie nagłówki HTTP', 'Serwer automatycznie odrzuci każde poprawne cookie', 'WEB', 'HARD'),
-- Q107
('Token resetu jest losowy i wygasa, ale działa wielokrotnie także po zmianie hasła. Jak usunąć tę słabość?', 'Unieważniać token po użyciu i właściwych zmianach konta', 'Wydłużyć ważność tokenu po każdym użyciu', 'Dodać login użytkownika do nazwy parametru', 'Zmniejszyć długość losowej części tokenu', 'WEB', 'HARD'),
-- Q108
('API pozwala dowolnej roli wywołać DELETE /admin/users/7, choć UI ukrywa akcję. Jaką kontrolę przeoczono?', 'Autoryzację funkcji administracyjnej w backendzie', 'Wyłącznie walidację formatu odpowiedzi CSS', 'Wyłącznie szyfrowanie nazwy roli w menu', 'Wyłącznie sprawdzenie domeny serwera DNS', 'WEB', 'HARD'),
-- Q109
('Backend weryfikuje podpis webhooka po sparsowaniu i ponownej serializacji JSON. Nadawca podpisuje oryginalne bajty. Jaka jest właściwa podstawa weryfikacji?', 'Oryginalna treść żądania zgodna ze specyfikacją podpisu', 'Dowolna alfabetyczna kolejność pól po parsowaniu', 'Wyłącznie pole eventType po usunięciu spacji', 'Wyłącznie wartość nagłówka Content-Length', 'WEB', 'HARD'),
-- Q110
('Aplikacja przyjmuje od klienta obiekt serializowany z nazwami klas i odtwarza dowolne typy. Co ogranicza ryzyko niebezpiecznej deserializacji?', 'Prosty schemat danych bez dowolnego odtwarzania typów', 'Zwiększenie liczby obsługiwanych klas systemowych', 'Zaufanie obiektowi, jeśli przesłano go przez TLS', 'Zaufanie obiektowi, jeśli ma mały rozmiar', 'WEB', 'HARD'),
-- Q111
('Dwa równoległe żądania wypłacają ten sam dostępny stan konta przed jego aktualizacją. Jak usunąć przyczynę błędu?', 'Atomowo egzekwować warunek stanu i zapis transakcji', 'Wyłącznie ukryć saldo w odpowiedzi API', 'Wyłącznie losować czas odpowiedzi w przeglądarce', 'Wyłącznie zmienić metodę HTTP z POST na PUT', 'WEB', 'HARD'),
-- Q112
('Kod sprawdza podpis JWT kluczem z URL jku podanego w tym samym tokenie bez listy zaufania. Co jest błędem?', 'Klient może wskazać własne źródło zaufanego klucza', 'JWT nie może zawierać żadnych nagłówków', 'Klucz publiczny zawsze musi pozostać tajny', 'Poprawny podpis zawsze potwierdza rolę administratora', 'WEB', 'HARD'),
-- Q113
('Front proxy interpretuje długość żądania inaczej niż backend przy sprzecznych Content-Length i Transfer-Encoding. Jaki problem może powstać?', 'Desynchronizacja HTTP i request smuggling', 'Fałszowanie odpowiedzi ARP przez przeglądarkę', 'Odzyskanie klucza AES z samego certyfikatu', 'Zatrucie strefy DNS przez nagłówek Accept', 'WEB', 'VERY_HARD'),
-- Q114
('SSRF odrzuca prywatne IP przy walidacji DNS, lecz przed połączeniem rozwiązuje nazwę ponownie. DNS atakującego zmienia odpowiedź. Co naprawia to obejście?', 'Powiązać połączenie ze zweryfikowanym adresem i polityką egress', 'Sprawdzać wyłącznie długość nazwy hosta', 'Rozwiązywać nazwę jeszcze więcej razy bez porównania', 'Dopuścić każdy adres, jeśli pierwsza odpowiedź była publiczna', 'WEB', 'VERY_HARD'),
-- Q115
('Cache współdzielony ignoruje nagłówek X-Forwarded-Host w kluczu, choć backend używa go do budowy linków w odpowiedzi. Jaki scenariusz wymaga analizy?', 'Zatrucie cache przez wpływ nieujęty w jego kluczu', 'Zwiększenie poufności przez dodatkowy nagłówek', 'Automatyczne unieważnienie każdej sesji użytkownika', 'Wymuszenie nowego podpisu certyfikatu TLS', 'WEB', 'VERY_HARD'),
-- Q116
('Endpoint sprawdza, że ścieżka pliku jest w katalogu bazowym, a potem otwiera ją po zmianie dowiązania przez inny proces. Jaka to klasa błędu?', 'Wyścig TOCTOU między sprawdzeniem a użyciem', 'Kolizja skrótów haseł w pamięci cache', 'Negocjacja niezgodnych wersji protokołu TLS', 'Błąd autoryzacji wynikający wyłącznie z CORS', 'WEB', 'VERY_HARD'),
-- Q117
('API ufa alg z JWT i pozwala zweryfikować HS256 znanym publicznie kluczem RSA przeznaczonym dla RS256. Jaka kontrola jest potrzebna?', 'Stałe dozwolone algorytmy i właściwe powiązanie typu klucza', 'Akceptowanie każdego algorytmu podanego przez klienta', 'Samo wydłużenie czasu ważności tokenu JWT', 'Samo ukrycie pola alg przed interfejsem użytkownika', 'WEB', 'VERY_HARD'),
-- Q118
('Webhook płatności ma poprawny podpis, lecz ponowne wysłanie identycznego zdarzenia znów dopisuje środki. Czego brakuje?', 'Idempotentnej obsługi identyfikatora zdarzenia', 'Wyłącznie poprawnego nagłówka Content-Type', 'Wyłącznie szyfrowania połączenia HTTPS', 'Wyłącznie walidacji formatu pola kwoty', 'WEB', 'VERY_HARD'),
-- Q119
('API GraphQL ogranicza liczbę żądań HTTP, lecz jedno żądanie zawiera setki aliasów kosztownej operacji. Co powinno uwzględnić ograniczenie?', 'Koszt i liczbę operacji wewnątrz zapytania', 'Wyłącznie liczbę otwartych kart przeglądarki', 'Wyłącznie długość nazwy użytkownika API', 'Wyłącznie numer portu serwera GraphQL', 'WEB', 'VERY_HARD'),
-- Q120
('Serwer pobiera URL sprawdzony jako publiczny, lecz przekazuje do niego Authorization przeznaczone dla wewnętrznego API. Jaki błąd pozostaje mimo kontroli IP?', 'Wyciek poświadczeń do odbiorcy poza ich zakresem', 'Brak możliwości wykonania zapytania DNS', 'Automatyczna zmiana odbiorcy podpisu JWT', 'Gwarantowane odrzucenie nagłówka przez HTTPS', 'WEB', 'VERY_HARD'),
-- Q121
('Kopia laptopa trafiła w niepowołane ręce. Która kontrola chroni dane na wyłączonym skradzionym dysku?', 'Szyfrowanie całego dysku z chronionym kluczem', 'Wyłącznie ustawienie nazwy komputera', 'Wyłącznie kompresja katalogu domowego', 'Wyłącznie ukrycie rozszerzeń plików', 'KRYPTOGRAFIA', 'VERY_EASY'),
-- Q122
('Autor publikuje skrót SHA-256 obrazu systemu. Co można porównać z tym skrótem po pobraniu?', 'Zgodność pobranych bajtów z opublikowanym skrótem', 'Tajny klucz użyty do szyfrowania każdego pliku', 'Tożsamość każdego przyszłego użytkownika obrazu', 'Listę wszystkich podatności pobranego systemu', 'KRYPTOGRAFIA', 'VERY_EASY'),
-- Q123
('Przeglądarka ostrzega, że certyfikat jest dla innej domeny. Co powinien zrobić użytkownik?', 'Przerwać i zweryfikować właściwy adres usługi', 'Zignorować ostrzeżenie, jeśli strona ma logo', 'Wyłączyć weryfikację dla wszystkich witryn', 'Przesłać hasło, jeśli formularz wygląda znajomo', 'KRYPTOGRAFIA', 'VERY_EASY'),
-- Q124
('Zespół chce przechowywać sekrety aplikacji poza kodem źródłowym. Które rozwiązanie jest właściwe?', 'Kontrolowany magazyn sekretów', 'Publiczny komentarz w repozytorium', 'Nazwa gałęzi zawierająca token', 'Adres URL dokumentacji z hasłem', 'KRYPTOGRAFIA', 'VERY_EASY'),
-- Q125
('Administrator znajduje hasła zapisane jako zwykły Base64. Jaki jest właściwy wniosek?', 'To odwracalne kodowanie bez ochrony hasła', 'To funkcja haszująca o wysokim koszcie', 'To szyfr wymagający klucza prywatnego', 'To podpis cyfrowy odporny na odtworzenie', 'KRYPTOGRAFIA', 'VERY_EASY'),
-- Q126
('Wiadomość ma być czytelna tylko dla posiadacza odpowiedniego klucza. Jaki cel realizuje szyfrowanie?', 'Poufność treści', 'Dostępność serwera', 'Rozliczalność każdego odczytu', 'Usunięcie metadanych transmisji', 'KRYPTOGRAFIA', 'VERY_EASY'),
-- Q127
('Dwie osoby używają tego samego hasła. Baza stosuje losową sól osobno dla każdego hasła. Czego oczekujemy od zapisanych wyników?', 'Różnych wyników mimo takiego samego hasła', 'Zawsze identycznych wyników dla obu osób', 'Możliwości odszyfrowania hasła samą solą', 'Konieczności trzymania soli wyłącznie w HSM', 'KRYPTOGRAFIA', 'EASY'),
-- Q128
('Klucz prywatny serwera trafił do publicznego repozytorium. Jaka reakcja jest właściwa?', 'Wymienić klucz i ocenić unieważnienie certyfikatu', 'Wyłącznie zmienić nazwę pliku z tym kluczem', 'Wyłącznie skasować lokalną kopię repozytorium', 'Przenieść ten sam klucz do innego katalogu', 'KRYPTOGRAFIA', 'EASY'),
-- Q129
('Firma chce sprawdzić, czy certyfikat został unieważniony przed upływem ważności. Które mechanizmy służą do tego celu?', 'CRL lub OCSP', 'DHCP lub ARP', 'NAT lub PAT', 'FTP lub TFTP', 'KRYPTOGRAFIA', 'EASY'),
-- Q130
('Dwaj uczestnicy muszą wyprowadzić wspólny sekret przez niezaufany kanał. Który mechanizm jest do tego przeznaczony?', 'Uzgadnianie klucza Diffiego-Hellmana', 'Jednokierunkowe kodowanie Base64', 'Kompresja bezstratna wiadomości', 'Dodanie publicznej sumy CRC32', 'KRYPTOGRAFIA', 'EASY'),
-- Q131
('Aplikacja ma generować tokeny resetu trudne do odgadnięcia. Jakiego źródła powinna użyć?', 'Kryptograficznie bezpiecznego generatora losowego', 'Bieżącego czasu w sekundach jako całego tokenu', 'Rosnącego identyfikatora kolejnego użytkownika', 'Stałego skrótu publicznej nazwy aplikacji', 'KRYPTOGRAFIA', 'EASY'),
-- Q132
('Serwis przechowuje hasła przez Argon2id z solą i kosztem dobranym do środowiska. Jaki atak ma to utrudnić po wycieku bazy?', 'Masowe zgadywanie haseł offline', 'Podsłuch nazwy domeny w zapytaniach DNS', 'Wyłączenie serwera przez zerwanie zasilania', 'Modyfikację adresów MAC w sieci lokalnej', 'KRYPTOGRAFIA', 'EASY'),
-- Q133
('Aplikacja szyfruje rekordy AES-GCM. Czego musi dopilnować dla nonce przy tym samym kluczu?', 'Niepowtarzalności nonce dla szyfrowanych wiadomości', 'Stałej identycznej wartości dla każdego rekordu', 'Przechowywania nonce wyłącznie w tajemnicy', 'Równości nonce z hasłem każdego użytkownika', 'KRYPTOGRAFIA', 'MEDIUM'),
-- Q134
('Odbiorca sprawdza HMAC wiadomości wspólnym tajnym kluczem. Co zapewnia prawidłowa weryfikacja w tym modelu?', 'Integralność i uwierzytelnienie względem posiadaczy klucza', 'Publiczną niezaprzeczalność autorstwa konkretnej osoby', 'Poufność całej treści wiadomości bez szyfrowania', 'Gwarancję doręczenia wiadomości w określonym czasie', 'KRYPTOGRAFIA', 'MEDIUM'),
-- Q135
('Serwer przechowuje pepper dla haseł. Gdzie powinien go trzymać, aby oddzielić go od wycieku samej bazy?', 'Poza bazą haseł w chronionym magazynie sekretów', 'W tej samej tabeli w każdym rekordzie użytkownika', 'W publicznym kodzie JavaScript formularza logowania', 'W jawnym identyfikatorze każdego konta', 'KRYPTOGRAFIA', 'MEDIUM'),
-- Q136
('Klient ufa dowolnemu samopodpisanemu certyfikatowi pobranemu od serwera. Co pozostaje nieweryfikowane?', 'Powiązanie klucza z oczekiwaną tożsamością serwera', 'Sama możliwość zaszyfrowania ruchu danym kluczem', 'Sama obecność daty w strukturze certyfikatu', 'Sama długość zakodowanego pliku certyfikatu', 'KRYPTOGRAFIA', 'MEDIUM'),
-- Q137
('Klucz danych DEK jest szyfrowany kluczem KEK z KMS. Jak nazywa się ten wzorzec?', 'Szyfrowanie kopertowe', 'Szyfrowanie cezariańskie', 'Haszowanie bez soli', 'Kodowanie transportowe', 'KRYPTOGRAFIA', 'MEDIUM'),
-- Q138
('Atakujący podmienia plik i skrót na tej samej przejętej stronie. Dlaczego samo porównanie skrótu nie dowodzi autentyczności wydawcy?', 'Skrót odniesienia też wymaga zaufanego pochodzenia', 'SHA-256 zawsze umożliwia odtworzenie pliku ze skrótu', 'Skróty działają tylko dla zaszyfrowanych plików', 'Każdy skrót samodzielnie uwierzytelnia wydawcę', 'KRYPTOGRAFIA', 'MEDIUM'),
-- Q139
('Po przejęciu klucza certyfikatu napastnik chce odszyfrować stare sesje TLS zestawione z ECDHE. Co zapewnia forward secrecy przy bezpiecznej realizacji?', 'Sam klucz certyfikatu nie wystarczy do odszyfrowania tych sesji', 'Klucz certyfikatu zawsze odszyfruje wszystkie stare sesje', 'Wszystkie sesje używają jednego stałego klucza AES', 'Treść sesji staje się jawna po wygaśnięciu certyfikatu', 'KRYPTOGRAFIA', 'HARD'),
-- Q140
('Serwis porównuje HMAC bajt po bajcie i kończy po pierwszej różnicy. Co ogranicza wyciek informacji o zgodnym prefiksie?', 'Porównanie w stałym czasie odpowiednią funkcją', 'Wyłącznie zwiększenie rozmiaru odpowiedzi JSON', 'Wyłącznie obniżenie długości znacznika HMAC', 'Wyłącznie zmiana kodowania z hex na Base64', 'KRYPTOGRAFIA', 'HARD'),
-- Q141
('Podpisane oprogramowanie pochodzi z przejętego legalnego procesu wydawcy. Jaki wniosek o podpisie jest poprawny?', 'Podpis nie gwarantuje braku złośliwej logiki w kodzie', 'Poprawny podpis zawsze wyklucza atak łańcucha dostaw', 'Podpis umożliwia wykonanie kodu tylko przez autora', 'Podpis oznacza, że klucz prywatny został opublikowany', 'KRYPTOGRAFIA', 'HARD'),
-- Q142
('Aplikacja używa AES-ECB do wielu identycznych bloków obrazu. Jaką słabość ilustruje widoczny wzór szyfrogramu?', 'Identyczne bloki tekstu dają identyczne bloki szyfrogramu', 'Każdy blok ma zawsze losowy niezależny nonce', 'ECB automatycznie podpisuje każdy blok danych', 'ECB uniemożliwia ujawnienie jakiejkolwiek struktury', 'KRYPTOGRAFIA', 'HARD'),
-- Q143
('Serwer zgłasza różne błędy dla złego paddingu CBC i złego formatu treści. Jakiego zagrożenia trzeba się obawiać?', 'Wyroczni paddingowej ujawniającej informacje o tekście', 'Ataku wymagającego znajomości wszystkich haseł', 'Automatycznej kolizji wszystkich kluczy publicznych', 'Przepełnienia tablicy ARP przez zaszyfrowane dane', 'KRYPTOGRAFIA', 'HARD'),
-- Q144
('Rotacja KEK ma zachować istniejące duże zasoby szyfrowane kluczami DEK. Co pozwala ograniczyć ponowne szyfrowanie całych danych?', 'Ponowne opakowanie DEK nowym KEK, jeśli system to wspiera', 'Publiczne udostępnienie starego KEK wszystkim klientom', 'Zastąpienie szyfrowania plików samym kodowaniem Base64', 'Usunięcie wszystkich DEK przed odczytem istniejących danych', 'KRYPTOGRAFIA', 'HARD'),
-- Q145
('Dwa komunikaty zaszyfrowano AES-GCM tym samym kluczem i nonce. Dlaczego nie wystarczy uznać za naruszoną tylko poufność?', 'Powtórzenie nonce zagraża też integralności i umożliwia fałszerstwa', 'GCM nigdy nie zapewnia uwierzytelnienia wiadomości', 'GCM po powtórzeniu nonce automatycznie zmienia klucz', 'Powtórzenie nonce dotyczy wyłącznie rozmiaru szyfrogramu', 'KRYPTOGRAFIA', 'VERY_HARD'),
-- Q146
('Usługa podpisuje dowolny dokument po autoryzacji użytkownika, ale podpis nie zawiera kontekstu celu. Inny system przyjmuje taki podpis jako zgodę na przelew. Co ogranicza użycie między protokołami?', 'Powiązanie podpisywanych danych z jednoznacznym kontekstem', 'Wyłącznie zwiększenie liczby znaków w nazwie pliku', 'Użycie tego samego klucza do jeszcze większej liczby celów', 'Usunięcie identyfikatora protokołu z podpisywanych danych', 'KRYPTOGRAFIA', 'VERY_HARD'),
-- Q147
('Baza haseł ma losowe sole, ale używa pojedynczego SHA-256. Dlaczego sole nie zastępują funkcji haszującej z odpowiednim kosztem?', 'Nie podnoszą znacząco kosztu każdej próby dla jednego hasła', 'Każda publiczna sól natychmiast odszyfrowuje SHA-256', 'Sole służą wyłącznie do podpisywania certyfikatów', 'Losowe sole zawsze tworzą identyczne skróty różnych haseł', 'KRYPTOGRAFIA', 'VERY_HARD'),
-- Q148
('Organizacja usuwa klucz szyfrowania, ale zachowała jego kopię w starym backupie HSM. Dlaczego nie wykazała skutecznego kryptograficznego usunięcia danych?', 'Pozostawiona kopia klucza może nadal umożliwić odczyt', 'Backup klucza z definicji nie może odszyfrować danych', 'Usunięcie jednej kopii zawsze unieważnia pozostałe', 'HSM automatycznie publikuje wszystkie kopie klucza', 'KRYPTOGRAFIA', 'VERY_HARD'),
-- Q149
('W mTLS klient poprawnie przedstawia certyfikat z zaufanego CA, ale każdy klient otrzymuje dostęp do każdej faktury. Czego brakuje?', 'Autoryzacji dostępu do faktury po uwierzytelnieniu klienta', 'Wyłącznie ponownego zaszyfrowania samego certyfikatu', 'Wyłącznie zwiększenia rozmiaru klucza podpisującego CA', 'Wyłącznie dodatkowego algorytmu kompresji TLS', 'KRYPTOGRAFIA', 'VERY_HARD'),
-- Q150
('Duplikat maszyny wirtualnej odziedziczył stan generatora i klucz AEAD. Jakie ryzyko trzeba ocenić przed wysyłaniem danych z obu kopii?', 'Powtarzanie nonce pod wspólnym kluczem po sklonowaniu stanu', 'Automatyczne zwiększenie entropii przez identyczny stan', 'Automatyczne unieważnienie wszystkich podpisów certyfikatów', 'Brak możliwości używania szyfrów symetrycznych na VM', 'KRYPTOGRAFIA', 'VERY_HARD'),
-- Q151
('Analityk chce ustalić, na jakim koncie działa jego powłoka. Które polecenie pokaże nazwę efektywnego użytkownika?', 'whoami', 'hostname', 'uptime', 'lsblk', 'LINUX', 'VERY_EASY'),
-- Q152
('W katalogu trzeba wyświetlić również pliki zaczynające się kropką. Które polecenie pasuje?', 'ls -a', 'ls -d', 'ls -t', 'ls -S', 'LINUX', 'VERY_EASY'),
-- Q153
('Plik z kluczem prywatnym ma być czytelny i zapisywalny tylko dla właściciela. Który tryb odpowiada temu celowi?', '600', '644', '666', '777', 'LINUX', 'VERY_EASY'),
-- Q154
('Administrator chce zobaczyć procesy uruchomione w systemie. Które narzędzie do tego służy?', 'ps', 'df', 'du', 'ln', 'LINUX', 'VERY_EASY'),
-- Q155
('Zespół znalazł token API w publicznym repozytorium. Co zrobić z samym tokenem?', 'Unieważnić go i wydać nowy', 'Zmienić jedynie nazwę repozytorium', 'Przenieść go do komentarza w kodzie', 'Przekodować ten sam token do Base64', 'LINUX', 'VERY_EASY'),
-- Q156
('Plik /var/log/auth.log zawiera nieudane logowania SSH. Do jakiego zadania przyda się taki log?', 'Analizy prób uwierzytelniania', 'Zmiany tablicy partycji dysku', 'Podpisania certyfikatu serwera', 'Konfiguracji rozdzielczości ekranu', 'LINUX', 'VERY_EASY'),
-- Q157
('Użytkownik uruchamia chmod o-r raport.txt. Co polecenie usuwa?', 'Prawo odczytu pliku dla pozostałych', 'Prawo zapisu pliku dla właściciela', 'Prawo wykonania pliku dla grupy', 'Wszystkie uprawnienia do katalogu', 'LINUX', 'VERY_EASY'),
-- Q158
('Administrator chce znaleźć procesy nasłuchujące na portach TCP wraz z PID przy odpowiednich uprawnieniach. Jakiego polecenia użyć?', 'ss -lntp', 'ip route show', 'df -h', 'uname -r', 'LINUX', 'EASY'),
-- Q159
('Po serii błędów logowania trzeba przejrzeć logi jednostki sshd w systemd. Które polecenie jest właściwe?', 'journalctl -u sshd', 'systemctl enable sshd', 'hostnamectl set-hostname sshd', 'loginctl terminate-user sshd', 'LINUX', 'EASY'),
-- Q160
('Plik ma tryb 640. Jakie prawa ma grupa właścicielska?', 'Tylko odczyt', 'Odczyt i zapis', 'Odczyt i wykonanie', 'Brak uprawnień', 'LINUX', 'EASY'),
-- Q161
('Zespół chce wyświetlić reguły sudo dostępne dla bieżącego użytkownika. Jakiego polecenia użyć?', 'sudo -l', 'sudo -k', 'sudo -V', 'sudo -n', 'LINUX', 'EASY'),
-- Q162
('Usługa nie powinna działać jako root, jeśli nie potrzebuje takich praw. Jaki cel realizuje osobne konto usługi?', 'Ograniczenie skutków przejęcia procesu', 'Automatyczne usunięcie wszystkich podatności', 'Zastąpienie potrzeby aktualizacji pakietów', 'Zapewnienie anonimowości każdego połączenia', 'LINUX', 'EASY'),
-- Q163
('Analityk szuka plików z rozszerzeniem .conf pod /etc bez zmieniania danych. Które polecenie odpowiada temu celowi?', 'find /etc -name ''*.conf''', 'chmod -R 777 /etc', 'rm -rf /etc/*.conf', 'chown -R nobody /etc', 'LINUX', 'EASY'),
-- Q164
('SSH ma umożliwiać wyłącznie logowanie kluczem po sprawdzeniu konfiguracji i dostępu awaryjnego. Która opcja wyłącza metodę hasłową?', 'PasswordAuthentication no', 'PermitEmptyPasswords yes', 'PubkeyAuthentication no', 'StrictModes no', 'LINUX', 'EASY'),
-- Q165
('W katalogu współdzielonym /tmp ustawiono sticky bit. Jakie ograniczenie dodaje on dla zwykłych użytkowników?', 'Ogranicza usuwanie i zmianę nazw cudzych plików', 'Zabrania właścicielowi odczytu własnego pliku', 'Szyfruje automatycznie zawartość nowych plików', 'Nadaje każdemu procesowi uprawnienia root', 'LINUX', 'MEDIUM'),
-- Q166
('Usługa czyta sekret z pliku o trybie 600, ale uruchamiana jest z innego konta niż właściciel. Co sprawdzić przed rozszerzaniem praw wszystkim?', 'Właściciela pliku i tożsamość procesu usługi', 'Wyłącznie nazwę hosta zapisaną w DNS', 'Wyłącznie wersję przeglądarki administratora', 'Wyłącznie długość nazwy katalogu roboczego', 'LINUX', 'MEDIUM'),
-- Q167
('Plik ma tryb 644, ale odczyt kończy się Permission denied. Rodzic ma tryb 700 i należy do innej osoby. Co blokuje dostęp?', 'Brak prawa przejścia przez katalog nadrzędny', 'Brak prawa wykonania zwykłego pliku tekstowego', 'Brak wpisu tego pliku w publicznym DNS', 'Brak numeru portu w nazwie pliku', 'LINUX', 'MEDIUM'),
-- Q168
('Root uruchamia cronem skrypt, który zwykły użytkownik może modyfikować. Jaki problem należy usunąć?', 'Możliwość wykonania kodu użytkownika przez root', 'Możliwość odczytu nazwy hosta przez użytkownika', 'Konieczność wpisywania pełnej ścieżki do crona', 'Konieczność zmiany hasła po każdym uruchomieniu', 'LINUX', 'MEDIUM'),
-- Q169
('Proces działa na localhost:8080, a zewnętrzny skan nie widzi portu. Jaka jest prawdopodobna przyczyna?', 'Nasłuch tylko na interfejsie pętli zwrotnej', 'Automatyczne wyłączenie protokołu TCP', 'Obowiązkowe szyfrowanie każdego portu 8080', 'Brak możliwości skanowania usług HTTP', 'LINUX', 'MEDIUM'),
-- Q170
('Analityk chce policzyć wpisy zawierające Failed password w auth.log. Które polecenie realizuje ten cel?', 'grep -c ''Failed password'' /var/log/auth.log', 'chmod -c ''Failed password'' /var/log/auth.log', 'touch -c ''Failed password'' /var/log/auth.log', 'chown -c ''Failed password'' /var/log/auth.log', 'LINUX', 'MEDIUM'),
-- Q171
('Plik otrzymał ACL dającą dodatkowej osobie odczyt, mimo braku jej w grupie właścicielskiej. Jak zobaczyć tę kontrolę?', 'getfacl nazwa_pliku', 'lsblk nazwa_pliku', 'uname nazwa_pliku', 'uptime nazwa_pliku', 'LINUX', 'MEDIUM'),
-- Q172
('W laboratorium plik wykonywalny ma SUID właściciela root, ale montowanie zawiera nosuid. Jaki efekt tej flagi jest istotny?', 'Bit SUID nie nada efektywnego UID właściciela przy wykonaniu', 'Każde wykonanie automatycznie uzyska root', 'Plik stanie się niemożliwy do odczytu dla właściciela', 'Plik zostanie automatycznie usunięty po wykonaniu', 'LINUX', 'HARD'),
-- Q173
('sudo pozwala uruchomić dowolny edytor jako root. Dlaczego ograniczenie do nazwy jednego edytora może być niewystarczające?', 'Edytor może uruchamiać polecenia lub modyfikować pliki systemowe', 'Każdy edytor z definicji wyłącza uprawnienia root', 'Edytor nie ma dostępu do systemu plików', 'sudo zawsze blokuje procesy potomne edytora', 'LINUX', 'HARD'),
-- Q174
('Skrypt roota uruchamia tar bez pełnej ścieżki, a początek PATH wskazuje katalog zapisywalny przez użytkownika. Co należy poprawić?', 'Użyć zaufanej ścieżki i bezpiecznego środowiska', 'Dodać więcej katalogów użytkownika na początek PATH', 'Ustawić katalogowi użytkownika tryb 777', 'Uruchamiać skrypt częściej bez zmiany poleceń', 'LINUX', 'HARD'),
-- Q175
('Administrator nadał aplikacji CAP_DAC_READ_SEARCH. Jakie ryzyko trzeba rozważyć?', 'Obchodzenie kontroli odczytu plików i przeszukiwania katalogów', 'Automatyczne prawo zmiany czasu systemowego', 'Automatyczne prawo zarządzania modułami jądra', 'Wyłącznie możliwość wiązania portów poniżej 1024', 'LINUX', 'HARD'),
-- Q176
('Kontener ma zamontowany zapisowalny socket Dockera hosta. Dlaczego to niebezpieczne?', 'Dostęp do API Dockera może umożliwić przejęcie hosta', 'Socket automatycznie szyfruje pliki kontenera', 'Socket ogranicza użytkownika do odczytu logów aplikacji', 'Kontener z takim socketem zawsze działa bez sieci', 'LINUX', 'HARD'),
-- Q177
('Administrator uruchomił rm na wielkim logu, lecz df nie pokazuje odzyskanego miejsca. Proces nadal trzyma otwarty usunięty plik. Co sprawdzić?', 'Otwarte usunięte pliki narzędziem lsof +L1', 'Wyłącznie rekordy MX domeny serwera', 'Wyłącznie kolejność katalogów w PATH', 'Wyłącznie listę zaufanych certyfikatów przeglądarki', 'LINUX', 'HARD'),
-- Q178
('Demon działa jako nieuprzywilejowane konto, ale może modyfikować plik swojej jednostki systemd odczytywany przez administratora. Jakie ryzyko występuje?', 'Utrwalenie lub eskalacja po ponownym załadowaniu konfiguracji', 'Automatyczne szyfrowanie całego ruchu demona', 'Wyłącznie możliwość zmiany nazwy procesu w ps', 'Brak znaczenia, bo konto demona nie jest rootem', 'LINUX', 'HARD'),
-- Q179
('Program SUID root ładuje bibliotekę z katalogu zapisywalnego przez użytkownika na podstawie własnej konfiguracji. Dlaczego same ograniczenia LD_PRELOAD nie rozwiązują problemu?', 'Program nadal ufa kontrolowanemu źródłu kodu przy ładowaniu', 'SUID zawsze usuwa możliwość ładowania dowolnych bibliotek', 'LD_PRELOAD jest jedynym sposobem ładowania kodu w Linuksie', 'Katalog zapisywalny przez użytkownika zawsze staje się zaufany', 'LINUX', 'VERY_HARD'),
-- Q180
('Backup roota uruchamia tar z opcjami, a listę plików buduje przez rozwinięcie * w katalogu użytkownika. Nazwa pliku może zacząć się od -. Co ogranicza wstrzyknięcie opcji?', 'Bezpieczne przekazanie nazw i zakończenie opcji przez --', 'Wyłącznie zwiększenie częstotliwości wykonywania backupu', 'Wyłącznie zmiana nazwy katalogu na dłuższą', 'Wyłącznie szyfrowanie gotowego archiwum po wykonaniu', 'LINUX', 'VERY_HARD'),
-- Q181
('Proces z no_new_privs uruchamia plik SUID root. Jakie zachowanie jest zgodne z celem tej flagi?', 'exec nie uzyska dodatkowych praw przez SUID', 'exec automatycznie podniesie wszystkie capabilities', 'Proces odziedziczy hasło właściciela pliku', 'Proces zawsze zmieni realny UID na zero', 'LINUX', 'VERY_HARD'),
-- Q182
('Usługa w kontenerze ma UID 0, lecz brak mapowania użytkowników i izolacji odpowiednich zasobów hosta. Jaki wniosek jest bezpieczny?', 'UID 0 w kontenerze wymaga oceny granic izolacji hosta', 'UID 0 w kontenerze zawsze jest nieuprzywilejowany na hoście', 'Każdy kontener automatycznie tworzy osobną maszynę wirtualną', 'Samo słowo kontener gwarantuje brak możliwości eskalacji', 'LINUX', 'VERY_HARD'),
-- Q183
('Serwis sprawdza właściciela pliku, potem otwiera ścieżkę w zapisywalnym katalogu. Użytkownik może w tym czasie podmienić symlink. Co zmniejsza ryzyko?', 'Operacje na bezpiecznie otwartym deskryptorze z kontrolą dowiązań', 'Wyłącznie sprawdzanie nazwy pliku przed operacją', 'Wyłącznie dłuższa przerwa między sprawdzeniem i otwarciem', 'Wyłącznie dodanie rozszerzenia .safe do nazwy pliku', 'LINUX', 'VERY_HARD'),
-- Q184
('W audycie DAC pozwala na zapis pliku, ale SELinux zgłasza AVC denied dla procesu. Co należy zbadać przed wyłączeniem SELinux?', 'Kontekst bezpieczeństwa i właściwą regułę polityki MAC', 'Wyłącznie długość nazwy użytkownika w /etc/passwd', 'Wyłącznie ustawienia rekursji publicznego serwera DNS', 'Wyłącznie rozmiar swap bez analizy komunikatu AVC', 'LINUX', 'VERY_HARD'),
-- Q185
('Root używa find z -exec w drzewie zapisywalnym przez niezaufanego użytkownika. Bezpiecznie przekazuje argumenty, lecz użytkownik może zmieniać drzewo w czasie operacji. Co nadal wymaga oceny?', 'Wyścigi i podmiany obiektów pomiędzy odnalezieniem a użyciem', 'Wyłącznie interpretacja spacji przez powłokę', 'Automatyczne złamanie szyfrowania systemu plików', 'Gwarancja niezmienności drzewa dzięki samemu -exec', 'LINUX', 'VERY_HARD'),
-- Q186
('Administrator chce przejrzeć dziennik Security w Windows. Które narzędzie graficzne do tego służy?', 'Podgląd zdarzeń', 'Zarządzanie dyskami', 'Mapa znaków', 'Narzędzie wycinania', 'WINDOWS', 'VERY_EASY'),
-- Q187
('Pracownik odchodzi z firmy używającej Active Directory. Jaki krok bezpośrednio ograniczy nowe logowania jego konta domenowego?', 'Wyłączenie konta w katalogu', 'Zmiana tapety na jego komputerze', 'Zmiana nazwy drukarki biurowej', 'Usunięcie skrótu do przeglądarki', 'WINDOWS', 'VERY_EASY'),
-- Q188
('Na stacji Windows trzeba zobaczyć grupy zawarte w bieżącym tokenie użytkownika. Które polecenie pasuje?', 'whoami /groups', 'ipconfig /displaydns', 'netstat -an', 'route print', 'WINDOWS', 'VERY_EASY'),
-- Q189
('Laptop Windows ma chronić dane po kradzieży wyłączonego urządzenia. Która funkcja jest do tego przeznaczona?', 'BitLocker', 'Harmonogram zadań', 'Podgląd zdarzeń', 'Menedżer wydruku', 'WINDOWS', 'VERY_EASY'),
-- Q190
('Firma chce centralnie egzekwować konfigurację stacji w domenie AD. Który mechanizm typowo wykorzysta?', 'Zasady grupy GPO', 'Lokalną historię schowka', 'Publiczne zakładki przeglądarki', 'Wyłącznie listę drukarek', 'WINDOWS', 'VERY_EASY'),
-- Q191
('Pracownik ma zwykłe konto, a zmiany administracyjne wymagają podniesienia uprawnień. Który mechanizm Windows pokazuje typowy monit?', 'Kontrola konta użytkownika UAC', 'Usługa przydziału adresów DHCP', 'Mechanizm kompresji plików NTFS', 'Usługa buforowania wydruku', 'WINDOWS', 'VERY_EASY'),
-- Q192
('Serwer domeny odpowiada za usługi katalogowe i uwierzytelnianie AD. Jak nazywa się jego rola?', 'Kontroler domeny', 'Przekaźnik pocztowy', 'Serwer czasu przeglądarki', 'Pasywny koncentrator', 'WINDOWS', 'VERY_EASY'),
-- Q193
('Analityk chce zobaczyć konfigurację IP interfejsów Windows. Które polecenie jest właściwe?', 'ipconfig /all', 'whoami /priv', 'tasklist /svc', 'net user', 'WINDOWS', 'VERY_EASY'),
-- Q194
('Windows zapisał Security 4625 dla wielu prób logowania. Co oznacza ten typ zdarzenia?', 'Nieudane logowanie konta', 'Pomyślne utworzenie nowej grupy', 'Usunięcie całego dziennika Security', 'Zainstalowanie aktualizacji systemowej', 'WINDOWS', 'EASY'),
-- Q195
('Zdarzenie 4624 ma LogonType=10. Jaki rodzaj logowania wskazuje ten typ?', 'Zdalne interaktywne, typowo RDP', 'Wyłącznie uruchomienie usługi lokalnej', 'Wyłącznie odblokowanie ekranu stacji', 'Wyłącznie logowanie zadania wsadowego', 'WINDOWS', 'EASY'),
-- Q196
('Administrator otwiera SMB na TCP 445 do internetu bez potrzeby biznesowej. Jaka zmiana zmniejsza ekspozycję?', 'Ograniczyć SMB do wymaganych sieci i hostów', 'Zmienić wyłącznie nazwę udziału na dłuższą', 'Udostępnić więcej udziałów anonimowych', 'Wyłączyć rejestrowanie dostępu do udziałów', 'WINDOWS', 'EASY'),
-- Q197
('Użytkownik znalazł zapisane hasło konta usługi w skrypcie na udziale ogólnym. Jaka reakcja jest właściwa?', 'Rotacja hasła i ograniczenie dostępu do sekretu', 'Wyłącznie ukrycie rozszerzenia skryptu', 'Wyłącznie zmiana koloru ikony udziału', 'Skopiowanie hasła do drugiego publicznego pliku', 'WINDOWS', 'EASY'),
-- Q198
('Serwis używa konta Domain Admin, choć potrzebuje tylko odczytu jednego udziału. Co należy zmienić?', 'Nadać dedykowanemu kontu tylko niezbędne prawa', 'Dodać konto do kolejnych grup administracyjnych', 'Wyłączyć hasło konta dla wygody działania', 'Użyć konta każdego zalogowanego pracownika', 'WINDOWS', 'EASY'),
-- Q199
('PowerShell uruchomiony jako administrator pobiera skrypt z niezweryfikowanej strony. Co jest głównym ryzykiem?', 'Wykonanie obcego kodu z podniesionymi prawami', 'Wyłącznie zwiększenie liczby rekordów DNS', 'Automatyczna utrata wszystkich certyfikatów CA', 'Brak ryzyka, jeśli polecenie jest krótkie', 'WINDOWS', 'EASY'),
-- Q200
('Firma chce unikalnych, zarządzanych haseł lokalnego administratora na stacjach. Jakie rozwiązanie jest przeznaczone do tego celu?', 'Windows LAPS', 'Wspólna stała wartość hasła w obrazie', 'Publiczny arkusz z hasłem całej domeny', 'Wyłącznie zmiana nazwy konta Administrator', 'WINDOWS', 'EASY'),
-- Q201
('Analityk chce sprawdzić, jakie uprawnienia specjalne ma jego bieżący token Windows. Które polecenie pasuje?', 'whoami /priv', 'ipconfig /renew', 'netstat -r', 'arp -d', 'WINDOWS', 'EASY'),
-- Q202
('Zdarzenie 4624 ma LogonType=3. Co należy z niego wywnioskować?', 'Logowanie sieciowe wymagające dalszego kontekstu', 'Pewne interaktywne logowanie przez RDP', 'Pewne lokalne odblokowanie konsoli', 'Pewne uruchomienie procesu przez Harmonogram', 'WINDOWS', 'MEDIUM'),
-- Q203
('Windows rejestruje 4688 po włączeniu odpowiedniego audytu. Jaką aktywność opisuje to zdarzenie?', 'Utworzenie nowego procesu', 'Usunięcie konta domenowego', 'Nieudane odnowienie dzierżawy DHCP', 'Zmianę adresu fizycznego karty', 'WINDOWS', 'MEDIUM'),
-- Q204
('Podczas audytu AD znaleziono zwykłe konto z atrybutem SPN i słabym hasłem. Jaka technika może wykorzystać bilet usługi do zgadywania hasła offline?', 'Kerberoasting', 'ARP poisoning', 'DNS tunneling', 'Session fixation', 'WINDOWS', 'MEDIUM'),
-- Q205
('Udział SMB daje grupie odczyt, lecz NTFS odmawia dostępu. Jak ocenia się zdalny dostęp do pliku?', 'Z uwzględnieniem zarówno praw udziału, jak i NTFS', 'Wyłącznie na podstawie nazwy udziału SMB', 'Wyłącznie na podstawie uprawnień udziału', 'Wyłącznie na podstawie portu źródłowego klienta', 'WINDOWS', 'MEDIUM'),
-- Q206
('Administrator chce śledzić treść wykonywanych bloków skryptów PowerShell. Którą funkcję audytu powinien ocenić?', 'Script Block Logging', 'Wyłącznie historię ostatnich dokumentów', 'Wyłącznie logowanie zapytań ARP', 'Wyłącznie harmonogram synchronizacji czasu', 'WINDOWS', 'MEDIUM'),
-- Q207
('Konto usługi ma nie wymagać ręcznego przechowywania hasła w skryptach na kilku serwerach domeny. Co warto zastosować przy zgodności aplikacji?', 'Grupowe zarządzane konto usługi gMSA', 'Jedno wspólne konto Domain Admin dla aplikacji', 'Konto gościa bez hasła na każdym serwerze', 'Hasło zapisane w nazwie usługi Windows', 'WINDOWS', 'MEDIUM'),
-- Q208
('Test wykazał, że SMB akceptuje sesje bez wymagania podpisu. Która kontrola utrudnia manipulację i odpowiednie scenariusze relay do SMB?', 'Wymaganie podpisywania SMB', 'Wyłącznie wydłużenie nazwy NetBIOS', 'Wyłącznie zmiana litery dysku sieciowego', 'Wyłącznie wyłączenie widoku plików ukrytych', 'WINDOWS', 'MEDIUM'),
-- Q209
('Nowe GPO nie działa na stacji. Jak sprawdzić wynikowy zestaw zasad i ich zastosowanie?', 'gpresult /r', 'arp -a', 'hostname', 'getmac', 'WINDOWS', 'MEDIUM'),
-- Q210
('Usługa SYSTEM uruchamia binarkę z katalogu, w którym zwykły użytkownik ma prawo podmiany pliku. Co jest źródłem eskalacji?', 'Zapisywalny plik wykonywany przez uprzywilejowaną usługę', 'Sama obecność litery C w ścieżce', 'Wyłącznie brak rozszerzenia .txt w nazwie', 'Sama możliwość odczytu nazwy usługi', 'WINDOWS', 'HARD'),
-- Q211
('Ścieżka usługi SYSTEM zawiera spacje i nie ma cudzysłowów. Kiedy błąd może umożliwić eskalację?', 'Gdy użytkownik może umieścić wykonywalny plik w sprawdzanej wcześniej lokalizacji', 'Zawsze, nawet bez prawa zapisu w jakiejkolwiek lokalizacji', 'Tylko gdy wszystkie katalogi są dostępne wyłącznie dla SYSTEM', 'Wyłącznie wtedy, gdy usługa nie może się uruchomić', 'WINDOWS', 'HARD'),
-- Q212
('Zwykłe konto AD ma WriteDACL do uprzywilejowanej grupy. Dlaczego to groźne?', 'Może zmienić kontrolę dostępu i uzyskać dalsze uprawnienia', 'Może wyłącznie odczytać publiczny opis grupy', 'Może wyłącznie zmienić lokalną tapetę stacji', 'WriteDACL nigdy nie wpływa na uprawnienia obiektu', 'WINDOWS', 'HARD'),
-- Q213
('Z kontrolera domeny widać wiele zdarzeń 4769 dla różnych SPN, nietypowych dla jednego konta. Jak to traktować?', 'Jako sygnał do weryfikacji możliwego Kerberoastingu', 'Jako samodzielny dowód udanego złamania wszystkich haseł', 'Jako pewny dowód wyłącznie odnowienia adresu IP', 'Jako pewny dowód wykonania transferu strefy DNS', 'WINDOWS', 'HARD'),
-- Q214
('Konto ma ustawione DONT_REQ_PREAUTH. Jaki atak na hasło umożliwia ta konfiguracja w odpowiednich warunkach?', 'AS-REP roasting z próbami offline', 'Pass-the-cookie wymagający sesji WWW', 'Zatrucie cache ARP przez kontroler domeny', 'Przepełnienie kolejki pakietów SYN', 'WINDOWS', 'HARD'),
-- Q215
('Proces uzyskał odczyt pamięci LSASS bez uzasadnionej potrzeby. Jaki cel atakującego należy zbadać?', 'Pozyskiwanie materiału uwierzytelniającego', 'Wyłącznie zmianę polityki retencji plików PDF', 'Wyłącznie konfigurację nazw drukarek', 'Wyłącznie wzrost rozmiaru tablicy routingu', 'WINDOWS', 'HARD'),
-- Q216
('Konto ma prawa replikacji katalogu pozwalające odczytać sekrety domeny. Jaką technikę może to umożliwić?', 'DCSync', 'Clickjacking', 'ARP flooding', 'DNS rebinding', 'WINDOWS', 'HARD'),
-- Q217
('Aplikacja wymaga włączenia unconstrained delegation na serwerze. Co jest istotnym ryzykiem przejęcia takiego serwera?', 'Nadużycie przechowywanych poświadczeń delegowanych użytkowników', 'Automatyczne ujawnienie prywatnych kluczy każdego CA świata', 'Wyłącznie zmiana nazw wszystkich stacji w DNS', 'Brak wpływu na inne konta z definicji delegacji', 'WINDOWS', 'HARD'),
-- Q218
('Po kradzieży skrótu NT konto loguje się do usługi NTLM bez poznania jawnego hasła. Jaka technika opisuje użycie tego materiału?', 'Pass-the-hash', 'Kerberoasting', 'AS-REP roasting', 'Password spraying', 'WINDOWS', 'VERY_HARD'),
-- Q219
('W AD CS szablon pozwala zwykłemu użytkownikowi wskazać tożsamość w SAN, ma EKU Client Authentication i nie wymaga zatwierdzenia. Co należy zbadać?', 'Możliwość uzyskania certyfikatu do podszycia się pod inną tożsamość', 'Wyłącznie możliwość zmiany koloru certyfikatu w konsoli', 'Automatyczne usunięcie wszystkich grup domenowych', 'Wyłącznie dłuższy czas pobierania certyfikatu CRL', 'WINDOWS', 'VERY_HARD'),
-- Q220
('Atakujący kontroluje konto komputera i może zmienić msDS-AllowedToActOnBehalfOfOtherIdentity na serwerze docelowym. Jaki obszar delegacji jest narażony?', 'Resource-based constrained delegation', 'Wyłącznie delegacja strefy publicznego DNS', 'Wyłącznie dziedziczenie zasad drukowania', 'Wyłącznie przydział adresów przez DHCP', 'WINDOWS', 'VERY_HARD'),
-- Q221
('Zdarzenie 4769 używa RC4 0x17. Dlaczego nie należy samoistnie uznawać go za dowód ataku?', 'Legacy konfiguracja może legalnie używać RC4, potrzebny kontekst', 'Każdy bilet RC4 zawsze dowodzi złamania hasła offline', 'RC4 w 4769 oznacza wyłącznie podpisany skrypt PowerShell', 'Typ szyfrowania 0x17 jest zarezerwowany dla ruchu HTTP', 'WINDOWS', 'VERY_HARD'),
-- Q222
('W środowisku AD zarejestrowano kradzież klucza krbtgt i fałszowanie TGT. Które działanie jest elementem kontrolowanej remediacji domeny?', 'Dwie zaplanowane rotacje krbtgt z uwzględnieniem replikacji i życia biletów', 'Wyłącznie zmiana nazwy jednego konta użytkownika', 'Wyłącznie ponowne uruchomienie przeglądarki administratora', 'Natychmiastowe skasowanie wszystkich obiektów komputerów w AD', 'WINDOWS', 'VERY_HARD'),
-- Q223
('Usługa SYSTEM ma bezpieczną binarkę, ale zwykły użytkownik może zmieniać jej konfigurację przez SERVICE_CHANGE_CONFIG. Jakie ryzyko pozostaje?', 'Zmiana ścieżki usługi na kod uruchamiany jako SYSTEM', 'Wyłącznie odczyt opisu usługi w panelu', 'Wyłącznie zmiana układu ikon na pulpicie', 'Brak ryzyka bez prawa zapisu do starej binarki', 'WINDOWS', 'VERY_HARD'),
-- Q224
('Po wymuszeniu podpisu SMB relay do LDAP nadal pozostaje możliwy przy słabej konfiguracji LDAP. Co wynika z tego scenariusza?', 'Ochronę relay trzeba oceniać osobno dla usług docelowych', 'Podpis SMB automatycznie chroni wszystkie protokoły domeny', 'LDAP nie może używać uwierzytelniania Windows', 'Każdy relay wymaga najpierw odszyfrowania TLS', 'WINDOWS', 'VERY_HARD'),
-- Q225
('Zwykły użytkownik ma GenericAll do konta serwisowego o wysokich uprawnieniach. Co powinien uwzględnić audyt ścieżek eskalacji?', 'Możliwość przejęcia konta przez modyfikację jego atrybutów lub hasła', 'Wyłącznie odczyt publicznej nazwy tego konta', 'Wyłącznie prawo do zmiany własnej tapety', 'Brak wpływu, ponieważ audytowany użytkownik nie jest adminem', 'WINDOWS', 'VERY_HARD'),
-- Q226
('SOC otrzymał alert antywirusa na laptopie. Co należy zrobić przed uznaniem go za potwierdzony incydent?', 'Zweryfikować zdarzenie i kontekst alertu', 'Automatycznie uznać każdy alert za włamanie', 'Usunąć wszystkie logi powiązane z alertem', 'Opublikować dane użytkownika laptopa', 'BLUE_TEAM', 'VERY_EASY'),
-- Q227
('Zespół chce zbierać logi wielu systemów i korelować zdarzenia. Które rozwiązanie jest do tego przeznaczone?', 'SIEM', 'PKI', 'IPAM', 'DHCP', 'BLUE_TEAM', 'VERY_EASY'),
-- Q228
('Plik podejrzany o złośliwość ma być analizowany bez uruchamiania go na stacji pracownika. Co wybrać?', 'Odizolowane środowisko analityczne', 'Komputer księgowości z dostępem do płatności', 'Serwer produkcyjny z danymi klientów', 'Publiczny udział uruchamiany przez cały zespół', 'BLUE_TEAM', 'VERY_EASY'),
-- Q229
('Operator EDR izoluje zainfekowaną stację od sieci. Jaki jest główny cel tego działania?', 'Ograniczenie dalszego rozprzestrzeniania i komunikacji', 'Ostateczne udowodnienie tożsamości autora ataku', 'Automatyczne odzyskanie wszystkich skasowanych danych', 'Zastąpienie pełnej analizy i usunięcia przyczyny', 'BLUE_TEAM', 'VERY_EASY'),
-- Q230
('Analityk musi zachować kopię pliku jako dowód i sprawdzić, czy później się zmienił. Co zapisać przy pozyskaniu?', 'Skrót kryptograficzny i informacje o pozyskaniu', 'Wyłącznie kolor ikony na pulpicie', 'Wyłącznie bieżący adres strony startowej', 'Wyłącznie wersję klienta poczty analityka', 'BLUE_TEAM', 'VERY_EASY'),
-- Q231
('Reguła alarmuje o legalnym backupie jako o wycieku. Jak nazywa się taki wynik detekcji?', 'False positive', 'True positive', 'False negative', 'True negative', 'BLUE_TEAM', 'VERY_EASY'),
-- Q232
('Atak wystąpił, lecz reguła go nie wykryła. Jak nazywa się taki wynik detekcji?', 'False negative', 'True negative', 'False positive', 'True positive', 'BLUE_TEAM', 'VERY_EASY'),
-- Q233
('Zespół ustala, kto odbiera zgłoszenia i jakie czynności wykonać przy ransomware. Co przygotowuje?', 'Plan i playbook reagowania na incydent', 'Plan adresacji podsieci gościnnej', 'Instrukcję formatowania dokumentów', 'Katalog kolorów interfejsu aplikacji', 'BLUE_TEAM', 'VERY_EASY'),
-- Q234
('W logach widać setki nieudanych prób jednego hasła wobec różnych kont. Jaką technikę to przypomina?', 'Password spraying', 'Spear phishing', 'ARP spoofing', 'DNS rebinding', 'BLUE_TEAM', 'EASY'),
-- Q235
('W logach widać tysiące różnych haseł wobec jednego konta. Jaką technikę to przypomina?', 'Brute force hasła konta', 'Password spraying wielu kont', 'Transfer strefy DNS AXFR', 'Atak na delegację Kerberos', 'BLUE_TEAM', 'EASY'),
-- Q236
('Podczas incydentu trzeba udokumentować każdą osobę przejmującą nośnik dowodowy. Jaki proces to zapewnia?', 'Łańcuch nadzoru nad dowodem', 'Automatyczna rotacja adresów IP', 'Weryfikacja rekursji DNS', 'Kompresja obrazu dysku', 'BLUE_TEAM', 'EASY'),
-- Q237
('Komputer z ransomware nadal szyfruje udziały sieciowe. Jaki krok zwykle ogranicza bieżące szkody?', 'Odizolowanie stacji zgodnie z procedurą reakcji', 'Wyłącznie zmiana tapety ostrzegawczej', 'Wyłącznie eksport listy zainstalowanych fontów', 'Wyłącznie zmiana nazwy udziałów bez odcięcia dostępu', 'BLUE_TEAM', 'EASY'),
-- Q238
('Wiadomość z załącznikiem żąda natychmiastowego włączenia makr, aby zobaczyć fakturę. Jaki krok jest właściwy?', 'Zgłosić podejrzenie i analizować zgodnie z procedurą', 'Włączyć makra, jeśli nadawca użył firmowego logo', 'Przekazać plik wszystkim pracownikom do otwarcia', 'Wyłączyć ochronę dokumentów, aby sprawdzić zawartość', 'BLUE_TEAM', 'EASY'),
-- Q239
('Zespół porównuje logi z różnych źródeł i widzi godzinne przesunięcie. Co sprawdzić przed tworzeniem osi czasu?', 'Strefy czasowe i synchronizację zegarów', 'Wyłącznie kolejność liter w nazwie hosta', 'Wyłącznie rozmiar monitora analityka', 'Wyłącznie liczbę znaków w komunikacie błędu', 'BLUE_TEAM', 'EASY'),
-- Q240
('Antywirus nie wykrył pliku. Jaki wniosek jest uzasadniony?', 'Brak detekcji nie potwierdza bezpieczeństwa pliku', 'Plik na pewno nie może wykonać złośliwej operacji', 'Każdy antywirus zawsze zna wszystkie próbki', 'Plik automatycznie uzyskał zaufany podpis wydawcy', 'BLUE_TEAM', 'EASY'),
-- Q241
('Ustalono domenę C2 związaną z incydentem. Do czego może służyć ten wskaźnik IOC?', 'Do wyszukania powiązanej komunikacji w telemetrii', 'Do samodzielnego dowiedzenia tożsamości sprawcy', 'Do automatycznego odszyfrowania każdego pliku', 'Do zastąpienia całego procesu reagowania', 'BLUE_TEAM', 'EASY'),
-- Q242
('EDR pokazuje WINWORD.EXE uruchamiający powershell.exe z długim zakodowanym argumentem. Jak traktować ten łańcuch?', 'Jako podejrzany kontekst do analizy procesu i treści', 'Jako samodzielny dowód legalnej aktualizacji Office', 'Jako pewne potwierdzenie uszkodzenia dysku', 'Jako dowód wyłącznie błędnej konfiguracji czasu', 'BLUE_TEAM', 'MEDIUM'),
-- Q243
('Serwer DNS widzi długie losowe subdomeny i nietypowo dużo zapytań TXT z jednej stacji. Jaką hipotezę warto sprawdzić?', 'Tunelowanie lub eksfiltrację przez DNS', 'Wyłącznie odnowienie certyfikatu przeglądarki', 'Wyłącznie standardowe zapytanie ARP o bramę', 'Wyłącznie lokalne drukowanie dokumentu', 'BLUE_TEAM', 'MEDIUM'),
-- Q244
('Analityk chce dowiedzieć się, czy podejrzany proces łączył się z internetem. Które źródło najlepiej korelować z jego identyfikatorem?', 'Telemetrię połączeń sieciowych EDR lub Sysmon', 'Wyłącznie listę fontów zainstalowanych na stacji', 'Wyłącznie opis modelu monitora użytkownika', 'Wyłącznie sumę kontrolną publicznego logo firmy', 'BLUE_TEAM', 'MEDIUM'),
-- Q245
('W trakcie obsługi podejrzanej stacji planowany jest restart. Jaką utratę dowodów należy uwzględnić?', 'Utratę części danych ulotnych z pamięci i sesji', 'Automatyczne usunięcie wszystkich kopii offline', 'Automatyczną zmianę skrótów wszystkich plików', 'Usunięcie całej historii DNS na każdym serwerze', 'BLUE_TEAM', 'MEDIUM'),
-- Q246
('Log proxy pokazuje regularne małe połączenia co 60 sekund do nowej domeny. Co należy zweryfikować?', 'Możliwy beaconing z uwzględnieniem legalnych usług', 'Pewny wyciek całej bazy bez dalszych danych', 'Pewną legalność, bo połączenia są krótkie', 'Wyłącznie uszkodzenie klawiatury użytkownika', 'BLUE_TEAM', 'MEDIUM'),
-- Q247
('Reguła koreluje wiele błędów logowania, po których następuje sukces z tego samego źródła. Co jest rozsądnym kolejnym krokiem?', 'Sprawdzić konto, źródło i aktywność po zalogowaniu', 'Uznać sukces za dowód usunięcia zagrożenia', 'Skasować błędy logowania jako nieistotne', 'Zablokować wyłącznie zapis nowych logów', 'BLUE_TEAM', 'MEDIUM'),
-- Q248
('Zespół opisuje technikę przeciwnika według MITRE ATT&CK. Co reprezentuje taktyka w tym modelu?', 'Cel przeciwnika realizowany przez techniki', 'Konkretny numer CVE w każdym przypadku', 'Wyłącznie nazwę używanego malware', 'Wyłącznie wynik punktowy ryzyka CVSS', 'BLUE_TEAM', 'MEDIUM'),
-- Q249
('Firma chce automatyzować zatwierdzone kroki reakcji i wzbogacać alerty danymi z kilku narzędzi. Która klasa rozwiązania pasuje?', 'SOAR', 'RADIUS', 'DHCP', 'NAT', 'BLUE_TEAM', 'MEDIUM'),
-- Q250
('Alert wykrywa powershell.exe, lecz atakujący używa innej nazwy kopii tej samej binarki. Jak zwiększyć odporność reguły na samą zmianę nazwy?', 'Uwzględnić tożsamość pliku i zachowanie procesu', 'Dopasowywać wyłącznie jedną pełną ścieżkę nazwy', 'Wyłączyć rejestrowanie procesów o innych nazwach', 'Ufać każdej binarce spoza katalogu Windows', 'BLUE_TEAM', 'HARD'),
-- Q251
('Podejrzany proces usuwa kopie cieni i masowo zmienia pliki użytkownika. Która hipoteza najlepiej łączy te zachowania?', 'Przygotowanie i wykonanie szyfrowania ransomware', 'Standardowy odczyt czasu przez klienta NTP', 'Zwykłe odświeżenie zawartości pamięci DNS', 'Rutynowe wyświetlenie dokumentu w trybie odczytu', 'BLUE_TEAM', 'HARD'),
-- Q252
('Obraz dysku jest analizowany w laboratorium. Dlaczego do nośnika źródłowego stosuje się blokadę zapisu?', 'Aby ograniczyć modyfikowanie oryginalnego dowodu', 'Aby automatycznie usunąć wszystkie pliki tymczasowe', 'Aby odszyfrować każde hasło bez klucza', 'Aby zastąpić potrzebę dokumentowania pozyskania', 'BLUE_TEAM', 'HARD'),
-- Q253
('EDR widzi rundll32.exe z nietypową biblioteką w katalogu użytkownika. Co należy badać zamiast ufać podpisowi rundll32?', 'Argumenty, ładowaną bibliotekę i proces nadrzędny', 'Wyłącznie poprawność podpisu legalnej binarki systemowej', 'Wyłącznie to, czy ikona przypomina komponent Windows', 'Wyłącznie fakt, że proces ma nazwę zakończoną .exe', 'BLUE_TEAM', 'HARD'),
-- Q254
('Wiele stacji pyta o domenę IOC, ale wszystkie zapytania wychodzą z resolvera. Jak odnaleźć hosty źródłowe?', 'Skorelować logi zapytań resolvera z klientami', 'Przypisać każde zapytanie wyłącznie serwerowi DNS', 'Uznać wszystkie stacje za potwierdzone ofiary', 'Zablokować zapis logów na resolverze', 'BLUE_TEAM', 'HARD'),
-- Q255
('Reguła oparta na pięciu błędach w minutę nie wykrywa prób rozłożonych na dobę wobec wielu kont. Co należy dodać?', 'Korelację w dłuższym oknie i między kontami', 'Wyłącznie krótsze okno dla każdego zdarzenia', 'Wyłącznie dopasowanie koloru alertu w panelu', 'Wyłącznie liczenie sukcesów bez źródła i konta', 'BLUE_TEAM', 'HARD'),
-- Q256
('Po izolacji hosta napastnik nadal ma tokeny w chmurze. Co powinien uwzględnić zakres containment?', 'Unieważnienie poświadczeń i sesji poza samym hostem', 'Wyłącznie zmianę nazwy zainfekowanej stacji', 'Wyłącznie wymianę przewodu Ethernet', 'Wyłącznie usunięcie skrótu do aplikacji chmurowej', 'BLUE_TEAM', 'HARD'),
-- Q257
('W wykazie podatności CVSS 9.8 dotyczy odciętej usługi testowej, a CVSS 8.1 aktywnie wykorzystywanej usługi publicznej. Co powinno wpływać na priorytet?', 'Ekspozycja, wykorzystanie i znaczenie zasobu obok CVSS', 'Wyłącznie kolejność alfabetyczna nazw produktów', 'Wyłącznie wyższy numer CVE bez kontekstu', 'Wyłącznie wielkość pliku instalatora', 'BLUE_TEAM', 'HARD'),
-- Q258
('SIEM koreluje procesy po PID z logów obejmujących kilka restartów. Powstają fałszywe powiązania. Jak poprawić klucz korelacji?', 'Uwzględnić host, czas życia procesu i stabilny identyfikator', 'Łączyć wszystkie identyczne PID niezależnie od czasu', 'Usunąć identyfikator hosta z każdego zdarzenia', 'Korelować wyłącznie po długości nazwy procesu', 'BLUE_TEAM', 'VERY_HARD'),
-- Q259
('Logi pokazują 4624, potem 4672, ale z różnych hostów i z takim samym lokalnym LogonId. Dlaczego nie dowodzi to jednej sesji?', 'LogonId wymaga zakresu hosta i odpowiedniej osi czasu', 'Każdy LogonId jest globalnym identyfikatorem internetu', '4672 zawsze oznacza zdalne wykonanie malware', '4624 nie może dotyczyć konta uprzywilejowanego', 'BLUE_TEAM', 'VERY_HARD'),
-- Q260
('Malware używa legalnej usługi chmurowej jako C2. Blokada całej domeny zatrzyma krytyczne procesy firmy. Jak zawęzić reakcję?', 'Korelować tożsamości, hosty i ścieżki złośliwej aktywności', 'Uznać każdą komunikację z tą domeną za bezpieczną', 'Usunąć wszystkie alerty zawierające nazwę dostawcy', 'Zrezygnować z analizy, bo domena ma ważny TLS', 'BLUE_TEAM', 'VERY_HARD'),
-- Q261
('Stacja odczytała wrażliwe pliki, ale logi egress były wyłączone. Co można uczciwie stwierdzić o eksfiltracji?', 'Brak telemetrii nie rozstrzyga, czy nastąpił wyciek', 'Brak logów dowodzi, że żaden wyciek nie nastąpił', 'Odczyt pliku zawsze dowodzi wysłania go do internetu', 'Każdy odczyt pliku identyfikuje zewnętrznego odbiorcę', 'BLUE_TEAM', 'VERY_HARD'),
-- Q262
('Po incydencie odtworzono host z obrazu, ale zautomatyzowana konfiguracja ponownie dodaje skradziony klucz SSH. Co trzeba objąć eradication?', 'Źródło konfiguracji i rotację przejętych poświadczeń', 'Wyłącznie rozdzielczość ekranu odtworzonej stacji', 'Wyłącznie nazwę pliku z obrazem systemu', 'Wyłącznie czas wyświetlania banera logowania', 'BLUE_TEAM', 'VERY_HARD'),
-- Q263
('Reguła IOC przestała działać po zmianie domeny C2, lecz sekwencja technik pozostała taka sama. Co może poprawić trwałość detekcji?', 'Detekcja zachowań i korelacja technik niezależna od jednej domeny', 'Dodanie wyłącznie starej domeny do większej liczby list', 'Wydłużenie czasu wyświetlania tego samego alertu', 'Całkowite wyłączenie telemetrii procesów końcowych', 'BLUE_TEAM', 'VERY_HARD'),
-- Q264
('Analityk tworzy oś czasu z nagłówka e-mail Date oraz logów serwera odbiorczego. Który aspekt wymaga ostrożności?', 'Date może być kontrolowany przez nadawcę i różnić się od czasu odbioru', 'Date zawsze jest wiarygodnym czasem nadanym przez odbiorcę', 'Każdy nagłówek e-mail ma podpis urzędowego serwera czasu', 'Czas odbioru nie ma żadnej wartości w analizie wiadomości', 'BLUE_TEAM', 'VERY_HARD'),
-- Q265
('W ćwiczeniu purple team technika została zablokowana, lecz nie wygenerowała alertu. Jak opisać wynik weryfikacji?', 'Prewencja zadziałała, a widoczność detekcji wymaga osobnej oceny', 'Detekcja na pewno zadziałała, skoro zadziałała prewencja', 'Wszystkie cele testu zawsze uznaje się za spełnione', 'Blokada dowodzi nieistnienia prób wykonania techniki', 'BLUE_TEAM', 'VERY_HARD'),
-- Q266
('Firma uruchamia własny system operacyjny na maszynie IaaS. Kto zwykle odpowiada za jego aktualizacje?', 'Klient zarządzający systemem gościa', 'Wyłącznie dostawca zasilania centrum danych', 'Wyłącznie producent przeglądarki klienta', 'Każdy anonimowy użytkownik internetu', 'CHMURA', 'VERY_EASY'),
-- Q267
('Bucket z prywatnymi raportami omyłkowo udostępniono publicznie. Jaka zmiana bezpośrednio ograniczy dostęp?', 'Usunięcie publicznego dostępu i sprawdzenie polityk', 'Wyłącznie zmiana nazwy jednego raportu', 'Wyłącznie kompresja wszystkich obiektów', 'Wyłącznie przeniesienie ikony bucketu w panelu', 'CHMURA', 'VERY_EASY'),
-- Q268
('Aplikacja w chmurze potrzebuje tożsamości do odczytu jednego zasobu. Który wybór ogranicza zarządzanie stałym hasłem?', 'Dedykowana rola lub tożsamość zarządzana', 'Hasło administratora zapisane w kodzie', 'Wspólny klucz całej firmy w publicznym pliku', 'Anonimowy dostęp do wszystkich zasobów', 'CHMURA', 'VERY_EASY'),
-- Q269
('Administrator chce zabezpieczyć uprzywilejowane konto konsoli chmurowej. Która kontrola utrudnia użycie samego skradzionego hasła?', 'Uwierzytelnianie wieloskładnikowe', 'Wyłącznie zmiana logo profilu', 'Wyłącznie krótka nazwa konta', 'Wyłącznie codzienne czyszczenie historii', 'CHMURA', 'VERY_EASY'),
-- Q270
('W chmurze dane mają być odporne na awarię jednego centrum danych w regionie. Jaką cechę projektu warto wykorzystać?', 'Rozmieszczenie w wielu strefach dostępności', 'Wyłącznie większą nazwę jednej instancji', 'Wyłącznie jeden lokalny dysk bez kopii', 'Wyłącznie jeden adres administratora', 'CHMURA', 'VERY_EASY'),
-- Q271
('Zespół musi sprawdzić, kto zmienił reguły sieciowe w koncie chmurowym. Jakiego typu logów potrzebuje?', 'Dziennika audytu działań kontrolnych API', 'Wyłącznie logów czcionek aplikacji', 'Wyłącznie historii tapety użytkownika', 'Wyłącznie publicznych rekordów MX', 'CHMURA', 'VERY_EASY'),
-- Q272
('Maszyna testowa nie potrzebuje połączeń przychodzących z internetu. Co zmniejszy jej ekspozycję?', 'Brak publicznego dostępu i minimalne reguły sieciowe', 'Publiczny adres i otwarcie wszystkich portów', 'Wyłącznie zmiana nazwy projektu na prywatny', 'Wyłącznie dodanie ostrzeżenia do opisu instancji', 'CHMURA', 'VERY_EASY'),
-- Q273
('Reguła security group dopuszcza SSH z 0.0.0.0/0. Co oznacza wskazany zakres źródeł IPv4?', 'Dowolny adres IPv4', 'Wyłącznie adresy prywatne', 'Wyłącznie lokalny host', 'Wyłącznie serwery dostawcy', 'CHMURA', 'EASY'),
-- Q274
('Aplikacja ma odczytywać tylko obiekty z jednego bucketu. Jaką politykę IAM przygotować?', 'Niezbędne akcje odczytu na wskazanym zasobie', 'Wszystkie akcje na wszystkich zasobach konta', 'Pełne zarządzanie rolami całej organizacji', 'Anonimowy zapis do każdego bucketu', 'CHMURA', 'EASY'),
-- Q275
('Klucz API przypadkiem znalazł się w obrazie kontenera opublikowanym w rejestrze. Co zrobić?', 'Unieważnić klucz i usunąć sekret z procesu budowania', 'Wyłącznie usunąć tag latest z tego samego obrazu', 'Wyłącznie zmienić opis publicznego rejestru', 'Wyłącznie przemianować zmienną środowiskową w kodzie', 'CHMURA', 'EASY'),
-- Q276
('Firma korzysta z SaaS. Która odpowiedzialność zwykle pozostaje po stronie klienta?', 'Zarządzanie dostępem i konfiguracją swoich danych', 'Wymiana zasilaczy w centrum danych dostawcy', 'Aktualizacja firmware fizycznych dysków dostawcy', 'Kontrola wejścia do serwerowni dostawcy', 'CHMURA', 'EASY'),
-- Q277
('Zespół chce wykrywać tworzenie maszyn przez nieznane konto. Co powinien monitorować?', 'Audyt wywołań API i zmiany zasobów', 'Wyłącznie rozmiar ikony maszyny w panelu', 'Wyłącznie liczbę zakładek administratora', 'Wyłącznie kolor terminala instancji', 'CHMURA', 'EASY'),
-- Q278
('Backup jest w tym samym koncie i może go usunąć przejęty administrator produkcji. Co zwiększy odporność na takie przejęcie?', 'Oddzielona kopia z niezależną kontrolą i ochroną usunięcia', 'Więcej kopii dostępnych temu samemu administratorowi', 'Zmiana nazw kopii bez zmiany uprawnień', 'Dłuższy opis zadania backupu w panelu', 'CHMURA', 'EASY'),
-- Q279
('W Kubernetes aplikacja nie korzysta z API klastra. Co ograniczy zbędne poświadczenia dostępne w podzie?', 'Wyłączenie automatycznego montowania tokenu ServiceAccount', 'Nadanie jej roli cluster-admin dla wygody', 'Udostępnienie jej sekretów wszystkich przestrzeni nazw', 'Zapisanie tokenu administratora w obrazie aplikacji', 'CHMURA', 'EASY'),
-- Q280
('Polityka AWS IAM zezwala na akcję, lecz inna mająca zastosowanie polityka zawiera jawne Deny tej akcji. Jaki jest wynik?', 'Jawne Deny ma pierwszeństwo', 'Zawsze wygrywa ostatnia edytowana polityka', 'Zawsze wygrywa polityka z krótszą nazwą', 'Allow zawsze kasuje każde Deny', 'CHMURA', 'MEDIUM'),
-- Q281
('Aplikacja na EC2 pobiera role przez IMDS. Dlaczego wymuszenie IMDSv2 ogranicza część scenariuszy SSRF?', 'Wymaga tokenu sesji uzyskanego dodatkowym żądaniem', 'Usuwa potrzebę kontroli adresów docelowych aplikacji', 'Szyfruje hasła użytkowników zapisane w bazie', 'Automatycznie blokuje każde wywołanie HTTP z aplikacji', 'CHMURA', 'MEDIUM'),
-- Q282
('Deweloper ma credentials ważne godzinę zamiast stałego klucza konta. Co ogranicza taka zmiana?', 'Okno nadużycia po wycieku bez odnowienia poświadczeń', 'Każde możliwe nadużycie w czasie ważności', 'Potrzebę autoryzacji wszystkich wywołań API', 'Wszystkie ryzyka błędnej konfiguracji sieci', 'CHMURA', 'MEDIUM'),
-- Q283
('Klaster Kubernetes dopuszcza między podami cały ruch. Jak ograniczyć go do potrzebnych połączeń przy wsparciu CNI?', 'Wdrożyć odpowiednie NetworkPolicy', 'Wyłącznie zmienić nazwy podów', 'Wyłącznie zmienić etykietę wersji obrazu', 'Wyłącznie zwiększyć liczbę replik aplikacji', 'CHMURA', 'MEDIUM'),
-- Q284
('Zespół ustawił szyfrowanie obiektów w storage, ale bucket nadal jest publiczny. Co pozostaje zagrożone?', 'Dostęp do treści przez uprawnione przez politykę publiczne żądania', 'Wyłącznie długość nazwy klucza szyfrującego', 'Brak jakiegokolwiek ryzyka dzięki szyfrowaniu at rest', 'Wyłącznie możliwość zmiany koloru ikony obiektu', 'CHMURA', 'MEDIUM'),
-- Q285
('Aplikacja ma odczytywać sekret w czasie działania, ale nie wbudowywać go w obraz. Jaki wzorzec pasuje?', 'Pobieranie sekretu z magazynu przez ograniczoną tożsamość', 'Kopiowanie sekretu do publicznej warstwy obrazu', 'Dodanie sekretu do nazwy repozytorium kontenera', 'Przekazanie sekretu w publicznym adresie health check', 'CHMURA', 'MEDIUM'),
-- Q286
('Reguła AWS security group dopuszcza ruch przychodzący do usługi. Czy odpowiedź w tej samej śledzonej sesji wymaga osobnej reguły egress tej grupy?', 'Nie, security group śledzi stan połączeń', 'Tak, grupa jest zawsze bezstanowa', 'Tak, odpowiedzi nigdy nie są śledzone', 'Nie, ponieważ wszystkie odpowiedzi są publiczne', 'CHMURA', 'MEDIUM'),
-- Q287
('Zewnętrzny dostawca przyjmuje rolę w koncie klienta. Jaka kontrola AWS pomaga ograniczyć problem confused deputy między jego klientami?', 'Warunek ExternalId w zaufaniu roli z właściwą integracją', 'Wyłącznie nazwa roli zawierająca słowo secure', 'Publiczny klucz klienta zapisany w tagu instancji', 'Wyłącznie otwarcie portu 443 dla całego internetu', 'CHMURA', 'HARD'),
-- Q288
('Rola może modyfikować swoją politykę IAM i przypisać sobie szerszy dostęp bez ograniczeń nadrzędnych. Jaki scenariusz trzeba zbadać?', 'Eskalację uprawnień przez zarządzanie IAM', 'Wyłącznie utratę synchronizacji zegarów', 'Wyłącznie przeciążenie serwera DNS', 'Wyłącznie zmianę formatu logów aplikacji', 'CHMURA', 'HARD'),
-- Q289
('CloudTrail zapisuje działania do bucketu, który administrator aplikacji może modyfikować i czyścić. Co poprawia wartość dowodową logów?', 'Odseparowany magazyn z kontrolą zapisu i retencji', 'Przechowywanie wyłącznie ostatniej linii w pamięci', 'Nadanie wszystkim deweloperom prawa usuwania logów', 'Wyłączenie audytu dla uprzywilejowanych wywołań', 'CHMURA', 'HARD'),
-- Q290
('Obraz kontenera ma tag stable, który właściciel rejestru może nadpisać. Jak związać wdrożenie z konkretną zawartością?', 'Przypiąć zweryfikowany digest obrazu', 'Sprawdzać wyłącznie nazwę stable', 'Ufać wyłącznie dacie wyświetlanej w panelu', 'Zwiększyć liczbę używanych zmiennych środowiskowych', 'CHMURA', 'HARD'),
-- Q291
('Rola Kubernetes pozwala tworzyć pody w namespace z wrażliwymi sekretami. Dlaczego brak bezpośredniego get secrets może nie wystarczyć?', 'Nowy pod może zamontować dostępny sekret przy braku dalszych ograniczeń', 'Tworzenie podów z definicji zabrania wszystkich wolumenów', 'Sekrety w namespace są zawsze publiczne w internecie', 'Każdy pod automatycznie wymaga ręcznego hasła operatora', 'CHMURA', 'HARD'),
-- Q292
('Dwie strefy aplikacji używają jednej bazy w pojedynczej strefie. Dlaczego frontend w wielu strefach nie usuwa całego ryzyka awarii strefy?', 'Baza pozostaje pojedynczą zależnością strefową', 'Warstwa WWW automatycznie replikuje dowolną bazę', 'Dwie strefy wykluczają jakiekolwiek zależności', 'Każda baza automatycznie działa we wszystkich regionach', 'CHMURA', 'HARD'),
-- Q293
('Chmurowy flow log wskazuje zaakceptowaną sesję do obcego IP. Czego sam ten zapis nie potwierdza?', 'Treści danych przesłanych wewnątrz sesji', 'Adresu źródłowego ujętego w zapisie', 'Adresu docelowego ujętego w zapisie', 'Portu docelowego ujętego w zapisie', 'CHMURA', 'HARD'),
-- Q294
('Pipeline CI uzyskuje rolę przez OIDC, ale polityka zaufania sprawdza tylko wystawcę, nie projekt i gałąź w sub. Jaki jest problem?', 'Token innego projektu tego wystawcy może spełnić zaufanie', 'OIDC zawsze wymaga publicznego hasła administratora', 'Każdy podpisany token automatycznie ogranicza się do jednej gałęzi', 'Sprawdzenie wystawcy zawsze zastępuje kontrolę podmiotu', 'CHMURA', 'VERY_HARD'),
-- Q295
('Program ma iam:PassRole do roli administratora i może uruchamiać usługę wykonującą kod z tą rolą. Co może to umożliwić?', 'Pośrednie wykonanie działań z prawami przekazanej roli', 'Wyłącznie zmianę nazwy lokalnego pliku programu', 'Wyłącznie odczyt publicznego opisu regionu', 'Brak wpływu, ponieważ PassRole nie jest logowaniem', 'CHMURA', 'VERY_HARD'),
-- Q296
('Kubernetes RBAC pozwala tworzyć RoleBinding do istniejącej roli, ale odmawia nadania praw szerszych niż własne bez bind. Co należy zweryfikować przy analizie eskalacji?', 'Rzeczywiste posiadanie bind lub równoważnych uprawnień', 'Samą nazwę cluster-admin bez kontroli autoryzacji', 'Wyłącznie to, czy manifest ma rozszerzenie yaml', 'Wyłącznie liczbę znaków w nazwie namespace', 'CHMURA', 'VERY_HARD'),
-- Q297
('Rola ma szeroką politykę Allow, lecz ogranicza ją permissions boundary. Dlaczego sama boundary nie nadaje dostępu?', 'Jest ograniczeniem maksymalnych praw, a nie samodzielnym przyznaniem', 'Zawsze zastępuje wszystkie polityki zasobów publicznym dostępem', 'Z definicji usuwa potrzebę jakiejkolwiek polityki Allow', 'Nadaje wszystkie prawa, których nie wymieniono w nazwie roli', 'CHMURA', 'VERY_HARD'),
-- Q298
('Aplikacja odrzuca adres metadata zapisany dziesiętnie, lecz biblioteka przyjmuje też inne reprezentacje IP. Jak wzmocnić ochronę SSRF?', 'Walidować kanoniczne adresy docelowe i wymuszać politykę egress', 'Sprawdzać wyłącznie wystąpienie jednego tekstowego adresu', 'Dopuścić każdy URL zawierający nazwę publicznej domeny', 'Wyłącznie zakodować adres URL przy pomocy Base64', 'CHMURA', 'VERY_HARD'),
-- Q299
('Przejęta funkcja serverless może odczytać wszystkie sekrety konta, choć używa jednego. Jaka zmiana bezpośrednio ograniczy zasięg przejęcia?', 'Zawęzić rolę wykonawczą do potrzebnego sekretu i akcji', 'Zwiększyć limit równoległych wykonań funkcji', 'Wyłączyć logowanie błędów tej funkcji', 'Przenieść nazwę sekretu do komentarza w kodzie', 'CHMURA', 'VERY_HARD'),
-- Q300
('Reguła WAF blokuje atak na publicznym wejściu, lecz origin ma drugi publiczny adres bez WAF. Co usuwa tę ścieżkę obejścia?', 'Ograniczenie dostępu do origin do zaufanej ścieżki wejścia', 'Wyłącznie zmiana nazwy reguły WAF', 'Wyłącznie zwiększenie liczby reguł na omijanym wejściu', 'Wyłącznie ukrycie linku do origin w interfejsie', 'CHMURA', 'VERY_HARD');
