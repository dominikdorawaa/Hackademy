# Bank pytań areny - #287

Aktualną krótką wersję banku opisuje [V34: krótkie pytania areny](compact-questions.md). Poniższy opis i `question-index-287.json` dokumentują historyczną migrację V33.

Migracja `V33__arena_question_bank.sql` dodaje **300 oryginalnych pytań**, po **60 na każdy z pięciu poziomów**. Po migracji czysta baza zawiera 342 pytania. Treści nie pochodzą z egzaminów, dumpów, TryHackMe ani Hack The Box; zakresy certyfikacji służą jako mapa zagadnień.

Identyfikatory `Q001`–`Q300` w `question-index-287.json` odpowiadają kolejności 300 wierszy INSERT w SQL i są stałymi identyfikatorami redakcyjnymi. Indeks zawiera kategorię, trudność, skrót SHA-256 treści oraz dodatkowe źródła do sprawdzanych szczegółów. Nie są identyfikatorami rekordów w bazie, ponieważ administratorzy mogą wcześniej dodawać i usuwać pytania. Każda pozycja zapisuje jedną poprawną i trzy błędne odpowiedzi; silnik walki tasuje je osobno dla pojedynku.

## Rozkład

| Kategoria | Identyfikatory | Bardzo łatwe | Łatwe | Średnie | Trudne | Bardzo trudne | Razem |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| OGOLNE | Q001–Q040 | 8 | 8 | 8 | 8 | 8 | 40 |
| SIECI | Q041–Q080 | 8 | 8 | 8 | 8 | 8 | 40 |
| WEB | Q081–Q120 | 8 | 8 | 8 | 8 | 8 | 40 |
| KRYPTOGRAFIA | Q121–Q150 | 6 | 6 | 6 | 6 | 6 | 30 |
| LINUX | Q151–Q185 | 7 | 7 | 7 | 7 | 7 | 35 |
| WINDOWS | Q186–Q225 | 8 | 8 | 8 | 8 | 8 | 40 |
| BLUE_TEAM | Q226–Q265 | 8 | 8 | 8 | 8 | 8 | 40 |
| CHMURA | Q266–Q300 | 7 | 7 | 7 | 7 | 7 | 35 |

`WINDOWS` obejmuje Windows i Active Directory. Nazwy wyświetlane dla wszystkich kategorii znajdują się we wspólnym `client/src/components/arena/arenaCategory.ts`, używanym przez panel admina i ekran walki.

## Pokrycie obszarów ticketu

Obszary edukacyjne nakładają się na kategorie produktu. Poniższe zbiory rozłączne stanowią minimalne przykłady pokrycia, a nie automatyczny odpowiednik domen egzaminacyjnych.

- **Podstawy, CIA, AAA, tożsamość i dostęp:** Q001–Q004, Q009–Q012, Q017–Q020, Q025–Q028, Q033–Q036 (20).
- **Zarządzanie, ryzyko, zgodność, RODO, zakres NIS2:** Q005–Q008, Q013–Q016, Q021–Q024, Q029–Q032, Q037–Q040 (20).
- **Zagrożenia i podatności aplikacji:** Q081–Q120 (40).
- **Architektura, segmentacja, chmura, IAM, PKI:** Q041–Q080, Q121–Q150, Q266–Q300 (105).
- **Operacje, SIEM, logi, reagowanie i forensics:** Q226–Q265 (40).
- **Ofensywa, enumeracja i eskalacja Linux/Windows/AD:** Q151–Q185 i Q186–Q225 (75).

Bardzo łatwe pytania wymagają rozpoznania podstawowej kontroli lub narzędzia w krótkiej sytuacji. Kolejne poziomy wymagają interpretacji wyniku, wyboru kontroli, a następnie analizy granic zaufania, zależności i warunków eskalacji. Poziom jest oceną redakcyjną, nie deklaracją równoważności z poziomem egzaminu.

## Podstawy merytoryczne

Pytania obejmują podstawy i praktyczne zagadnienia cyberbezpieczeństwa; nie deklarują pokrycia całego egzaminu ani autoryzacji przez organizatora. Źródła sprawdzano 2026-10-29. Nie utrwalamy punktacji, cen, dat egzaminów ani krajowych terminów wdrożenia NIS2 jako odpowiedzi w banku.

- [ISC2 CC - zakres egzaminu](https://www.isc2.org/certifications/cc/cc-certification-exam-outline).
- [eJPT](https://ine.com/security/certifications/ejpt-certification), [PNPT](https://certifications.tcm-sec.com/pnpt/), [OSCP - przewodnik egzaminacyjny](https://help.offsec.com/hc/en-us/articles/360040165632-OSCP-Exam-Guide).
- [NIST SP 800-63B-4 - uwierzytelnianie](https://pages.nist.gov/800-63-4/sp800-63b.html), [NIST SP 800-207 - zero trust](https://csrc.nist.gov/pubs/sp/800/207/final), [NIST SP 800-61r3 - reagowanie](https://csrc.nist.gov/pubs/sp/800/61/r3/final).
- [RODO - tekst rozporządzenia](https://eur-lex.europa.eu/eli/reg/2016/679/oj), w szczególności art. 4, 5, 17 i 33; [NIS2 - tekst dyrektywy](https://eur-lex.europa.eu/eli/dir/2022/2555/oj), w szczególności zakres podmiotowy.
- [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org/), w szczególności [hasła](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [autoryzacja](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
- [Nmap - techniki skanowania](https://nmap.org/book/man-port-scanning-techniques.html), [RFC 8201 - IPv6 PMTU](https://www.rfc-editor.org/rfc/rfc8201), [RFC 8899 - datagram PLPMTUD](https://www.rfc-editor.org/rfc/rfc8899).
- [Linux execve i SUID](https://man7.org/linux/man-pages/man2/execve.2.html), [capabilities](https://man7.org/linux/man-pages/man7/capabilities.7.html), [no_new_privs](https://docs.kernel.org/userspace-api/no_new_privs.html), [shadow](https://man7.org/linux/man-pages/man5/shadow.5.html).
- [Microsoft - zdarzenie 4624](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/auditing/event-4624), [Windows LAPS](https://learn.microsoft.com/en-us/windows-server/identity/laps/laps-overview), [Sysmon](https://learn.microsoft.com/en-us/sysinternals/downloads/sysmon).
- [MITRE ATT&CK](https://attack.mitre.org/), m.in. [ARP poisoning](https://attack.mitre.org/techniques/T1557/002/), [Kerberoasting](https://attack.mitre.org/techniques/T1558/003/), [DCSync](https://attack.mitre.org/techniques/T1003/006/).
- [AWS - ewaluacja IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html), [stanowe security groups](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-connection-tracking.html), [IMDS](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html).
- [Kubernetes - ryzyka RBAC](https://kubernetes.io/docs/concepts/security/rbac-good-practices/), [NetworkPolicy](https://kubernetes.io/docs/concepts/services-networking/network-policies/).

## Migracja i wdrożenie

V33 rozszerza ograniczenie kategorii i dodaje nowe rekordy bez założeń o ich ID. Koryguje niezmienione stare odpowiedzi o MD5, ARP i 2FA oraz trudność definicji SSRF. Wyrównuje też warianty odpowiedzi w 20 dotychczasowych pytaniach. Aktualizacje starych rekordów wymagają `version = 0` i zgodności wszystkich czterech dotychczasowych odpowiedzi z oryginalnym seedem, a przy zmianie podnoszą wersję. Dzięki temu nie nadpisują edycji administratora.

Kolejność wdrożenia: **backend z V33 przed klientem**, a potem klient ze wspólnymi etykietami. Starszy klient nadal potrafi wyświetlić tekstowy kod kategorii w walce, ale jego formularz admina nie obsługuje nowych opcji. Migracja jest transakcyjna w PostgreSQL, a Flyway uruchamia ją raz; ponowny start waliduje checksum i nie dodaje kolejnych rekordów.

## Weryfikacja techniczna

- `SchemaMigrationTest`: migracja pustej bazy, upgrade V32→V33, 300 nowych rekordów, rozkład 60/poziom, osiem kategorii, limity 500/200, różne warianty odpowiedzi, brak identycznych treści, zachowanie zmian admina i powtórny start Flyway.
- `ArenaBattleIntegrationTest`: rzeczywisty `drawForElo` na zmigrowanym PostgreSQL dla pięciu przedziałów ELO, obecność każdego poziomu, preferencja poziomu docelowego i brak powtórek w pojedynku.
- `ArenaQuestionAdminIntegrationTest`: obecność pytań migracji w panelu (wraz z odpowiedziami), tworzenie, filtrowanie i edycja każdej nowej kategorii przez API.
- Testy klienta: etykiety nowych kategorii w panelu i na ekranie walki; istniejące testy formularza i zapisywania pytań.

Same testy strukturalne nie dowodzą prawdziwości odpowiedzi. Audyt merytoryczny obejmuje każdą pozycję i wszystkie cztery opcje; jego zakres i ograniczenia są raportowane osobno od testów i od oceny PR.

## Korekty redakcyjne

Zweryfikowano wszystkie 300 pozycji i ich cztery odpowiedzi. Poprawiono 168 pozycji, w tym zastąpiono 16 powtarzających się lub zbyt prostych scenariuszy. Błędne opcje skrócono i dopasowano do zagadnienia bez dopisywania wyjaśnień zdradzających ich błędność. W szczególności doprecyzowano wielokrotne monity MFA, wyłączenie keyboard-interactive w pytaniu SSH, weryfikację MIME skryptów, audyt zdarzeń danych S3 i alternatywną ścieżkę odczytu szyfrogramu przez KMS.

Prawdziwość odpowiedzi zależy od warunków w treści pytania. Nie każda strona źródłowa została przeczytana w całości; dla szczegółów technicznych sprawdzano właściwe sekcje dokumentacji. Poziomy trudności pozostają oceną redakcyjną. Testy automatyczne sprawdzają strukturę i działanie banku, a nie zastępują oceny merytorycznej.

## Długość odpowiedzi

Nie stosujemy długości jako podpowiedzi. W 300 nowych pytaniach poprawna odpowiedź jest jedyną najdłuższą w 68 przypadkach (22,7%). Jej średnia długość wynosi 38,4 znaku, a średnia długość błędnej opcji 39,1 znaku. W całej puli 342 pytań poprawna jest jedyną najdłuższą w 72 przypadkach (21,1%). Remisy długości są liczone osobno.

Test migracji sprawdza maksymalnie 25 znaków różnicy między najkrótszą a najdłuższą opcją w każdym pytaniu, najwyżej 25% nowych pytań z jednoznacznie najdłuższym kluczem oraz różnicę średnich długości do 3 znaków. Dotyczy to dostarczonego banku; administrator nadal może samodzielnie redagować pytania w granicach 500/200 znaków. Wartości nie są sztucznie dopełniane spacjami ani znakami niewidocznymi.
