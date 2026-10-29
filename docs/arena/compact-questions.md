# Krótkie pytania areny

Migracja `V34__compact_arena_questions.sql` skraca 342 pytania bazowe i dodaje 40 pytań z ofensywy oraz pentestingu. Na czystej bazie daje to 382 pytania. Limit redakcyjny wynosi 120 znaków na pytanie i 50 na odpowiedź. Limity nie są docelowymi długościami: średnie wynoszą około 54 i 21 znaków, a najdłuższe teksty mają odpowiednio 96 i 44 znaki.

Czas rundy pozostaje bez zmian. Krótkie definicje IDOR, SIEM i SOAR występują obok pytań o interpretację wyników, granice uprawnień i techniki ofensywne. Trudność zależy od wiedzy i warunków scenariusza.

## Zakres

| Zmiana | Bardzo łatwe | Łatwe | Średnie | Trudne | Bardzo trudne | Razem |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Nowe pytania ofensywne | 8 | 8 | 8 | 8 | 8 | 40 |

Nowe pytania obejmują WEB (15), LINUX (10), WINDOWS (10) i SIECI (5). Dotyczą między innymi Burp Proxy, ffuf, powłok reverse i bind, linPEAS, GTFOBins, BloodHound, SSTI, LDAP injection, capabilities, biletów Kerberos i shadow credentials.

`compact-question-index.json` identyfikuje aktualne rekordy redakcyjne: L001–L042 to dawne pytania z V13, Q001–Q300 to pozycje dodane w V33, a N001–N040 to nowe pozycje V34. Każdy wpis zawiera kategorię, poziom i SHA-256 treści po V34. Identyfikatory redakcyjne nie są identyfikatorami rekordów bazy.

## Długości odpowiedzi

Różnica między najkrótszym a najdłuższym wariantem wynosi najwyżej 20 znaków. Poprawny wariant jest jedynym najdłuższym w 75 z 382 pytań, czyli 19,6%. Średnia długość poprawnego wariantu wynosi 20,8 znaku, a błędnego 21,4 znaku. Silnik nadal tasuje odpowiedzi w pojedynku.

Test migracji sprawdza limity 120/50, średnią długość pytania najwyżej 65 znaków, średnią długość odpowiedzi najwyżej 30 znaków, rozrzut wariantów najwyżej 20 znaków, udział jednoznacznie najdłuższych poprawnych odpowiedzi najwyżej 25% i różnicę średnich poprawnych oraz błędnych wariantów najwyżej 3 znaki.

## Migracja

V34 nie zmienia historycznych migracji. Aktualizacja zachowuje ID, kategorię i trudność każdego pytania bazowego, a wersję podnosi o jeden. Warunkiem aktualizacji jest zgodność pełnej starej treści, czterech odpowiedzi, kategorii, poziomu oraz wersji z bazowym rekordem po V33.

Edycje administratora pozostają nietknięte, także gdy zostały wykonane bez zmiany wersji. Usunięte pytania nie są odtwarzane. Własne pytania administratora nie są skracane automatycznie. Redakcyjne limity dotyczą dostarczonego banku, a dotychczasowe limity formularza administratora pozostają bez zmian.

Flyway uruchamia V34 raz przy starcie nowego backendu. Nowe i zmienione rekordy są dostępne w dotychczasowym panelu pytań oraz w losowaniu walk; wdrożenie nie wymaga zmian klienta. Testy obejmują upgrade z V33, ochronę każdej części rekordu przed nadpisaniem, zachowanie usunięć, rozkład nowych pytań oraz ponowne uruchomienie Flyway.

## Źródła do weryfikacji

- [PortSwigger: SSTI](https://portswigger.net/web-security/server-side-template-injection), [Host header attacks](https://portswigger.net/web-security/host-header).
- [OWASP WSTG](https://owasp.org/www-project-web-security-testing-guide/), [XPath injection](https://owasp.org/www-community/attacks/XPATH_Injection).
- [ffuf](https://github.com/ffuf/ffuf), [PEASS-ng](https://github.com/peass-ng/PEASS-ng), [GTFOBins](https://gtfobins.github.io/).
- [SharpHound](https://github.com/SpecterOps/SharpHound), [SpecterOps: shadow credentials](https://specterops.io/blog/2021/06/17/shadow-credentials-abusing-key-trust-account-mapping-for-account-takeover/).
- [Nmap: ACK scan](https://nmap.org/book/scan-methods-ack-scan.html), [Nmap: host discovery](https://nmap.org/book/man-host-discovery.html).
- [Linux capabilities](https://man7.org/linux/man-pages/man7/capabilities.7.html), [no_new_privs](https://docs.kernel.org/userspace-api/no_new_privs.html).
- [Microsoft: LDAP channel binding](https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/ldap-channel-binding).
- [RFC 6811: BGP origin validation](https://www.rfc-editor.org/rfc/rfc6811), [RFC 1858: fragment filtering](https://www.rfc-editor.org/rfc/rfc1858), [RFC 4035: DNSSEC i NSEC](https://www.rfc-editor.org/rfc/rfc4035).

Źródła techniczne służą weryfikacji pojęć i zachowań. Samo sprawdzenie długości nie zastępuje oceny poprawności odpowiedzi i jednoznaczności pytania.
