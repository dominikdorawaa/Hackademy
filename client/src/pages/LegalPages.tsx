import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './UserDashboardPage.css';
import './LegalPages.css';

const CONTACT_EMAIL = 'kontakt@hackademy.app';
const UPDATED_AT = '19 października 2026';

function ContactLink() {
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
}

function LegalDocument({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="user-dashboard legal-page">
      <article className="legal-document" aria-labelledby="legal-title">
        <p className="legal-updated">Ostatnia aktualizacja: {UPDATED_AT}</p>
        <h1 id="legal-title">{title}</h1>
        {children}
      </article>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalDocument title="Polityka prywatności">
      <p>
        Ta polityka opisuje, jakie dane zbiera Hackademy (hackademy.app), po co je przetwarzamy i jakie masz prawa.
      </p>

      <h2>Administrator danych</h2>
      <p>
        Administratorem danych jest zespół projektu Hackademy. W sprawach danych osobowych pisz na <ContactLink />.
      </p>

      <h2>Jakie dane zbieramy</h2>
      <ul>
        <li>Dane konta: adres e-mail, nazwa użytkownika oraz identyfikator konta u dostawcy logowania.</li>
        <li>Dane z Google lub GitHub, jeśli logujesz się w ten sposób: adres e-mail, imię i nazwisko lub nazwa konta oraz zdjęcie profilowe.</li>
        <li>Profil, który uzupełniasz sam: opis, hasło przewodnie, zainteresowania, awatar i wyróżnione odznaki.</li>
        <li>Postępy w nauce: zapisy na ścieżki, ukończone zadania i pokoje, odblokowane podpowiedzi, punkty, seria dni, ranking, odznaki i czas aktywności.</li>
        <li>Aktywność społeczna: znajomi, wiadomości na czacie podczas pojedynków w Arenie i zgłoszenia tych wiadomości.</li>
        <li>Ustawienia aplikacji: preferencje powiadomień, motyw i postęp samouczka. Część z nich zapisujemy w pamięci przeglądarki.</li>
        <li>Dane techniczne: adres IP, informacje o przeglądarce i dzienniki serwera potrzebne do działania i ochrony serwisu.</li>
      </ul>
      <p>Nie sprzedajemy danych i nie używamy ich do reklam. Nie stosujemy narzędzi analitycznych ani reklamowych firm trzecich.</p>

      <h2>Po co przetwarzamy dane</h2>
      <ul>
        <li>Aby założyć i obsługiwać Twoje konto oraz umożliwić logowanie (art. 6 ust. 1 lit. b RODO).</li>
        <li>Aby prowadzić naukę, ranking, Arenę i funkcje społeczne, z których korzystasz (art. 6 ust. 1 lit. b RODO).</li>
        <li>Aby chronić serwis przed nadużyciami, moderować czat i usuwać błędy (art. 6 ust. 1 lit. f RODO).</li>
        <li>Aby odpowiadać na wiadomości wysłane na adres kontaktowy (art. 6 ust. 1 lit. f RODO).</li>
      </ul>

      <h2>Komu powierzamy dane</h2>
      <p>Korzystamy z usług zewnętrznych dostawców, którzy przetwarzają dane w naszym imieniu:</p>
      <ul>
        <li>Clerk: logowanie, rejestracja i bezpieczeństwo konta.</li>
        <li>Heroku (Salesforce): serwer aplikacji i baza danych w regionie UE.</li>
        <li>Cloudflare: hosting strony, DNS, ochrona przed atakami i przekierowanie poczty kontaktowej.</li>
        <li>Google i GitHub: tylko jeśli wybierzesz logowanie przez te serwisy.</li>
      </ul>
      <p>
        Część dostawców przetwarza dane w Stanach Zjednoczonych. Przekazanie odbywa się na podstawie unijno-amerykańskich
        ram ochrony danych (Data Privacy Framework) lub standardowych klauzul umownych.
      </p>

      <h2>Co widzą inni użytkownicy</h2>
      <p>
        Twoja nazwa użytkownika, awatar, profil, odznaki, punkty i miejsce w rankingu są widoczne dla innych użytkowników.
        Adres e-mail nie jest pokazywany publicznie.
      </p>

      <h2>Jak długo przechowujemy dane</h2>
      <p>
        Dane konta i postępy przechowujemy, dopóki masz konto. Po jego usunięciu kasujemy je w ciągu 30 dni, chyba że
        musimy zachować część z nich dłużej, aby wyjaśnić naruszenie regulaminu. Dzienniki serwera przechowujemy krótko,
        zwykle nie dłużej niż kilka tygodni.
      </p>

      <h2>Pliki cookie i pamięć przeglądarki</h2>
      <p>
        Używamy tylko niezbędnych plików cookie i pamięci przeglądarki: do utrzymania sesji logowania (Clerk), ochrony
        przed atakami (Cloudflare) i zapamiętania Twoich ustawień. Nie używamy cookie reklamowych ani śledzących.
      </p>

      <h2>Twoje prawa</h2>
      <p>
        Masz prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przeniesienia oraz
        sprzeciwu. Aby z nich skorzystać, w tym usunąć konto, napisz na <ContactLink />. Masz też prawo złożyć skargę do
        Prezesa Urzędu Ochrony Danych Osobowych.
      </p>

      <h2>Zmiany polityki</h2>
      <p>
        O istotnych zmianach poinformujemy w serwisie. Aktualna wersja jest zawsze dostępna na tej stronie. Zobacz też{' '}
        <Link to="/regulamin">regulamin</Link>.
      </p>
    </LegalDocument>
  );
}

export function TermsPage() {
  return (
    <LegalDocument title="Regulamin">
      <p>
        Regulamin określa zasady korzystania z Hackademy (hackademy.app), platformy do nauki cyberbezpieczeństwa przez
        zadania, ścieżki i pojedynki.
      </p>

      <h2>Konto</h2>
      <ul>
        <li>Korzystanie z serwisu jest bezpłatne. Do większości funkcji potrzebne jest konto.</li>
        <li>Podajesz prawdziwy adres e-mail i dbasz o bezpieczeństwo swojego konta.</li>
        <li>Jedna osoba może mieć jedno konto. Nie udostępniaj go innym.</li>
        <li>Nazwa użytkownika, awatar i opis nie mogą być obraźliwe ani podszywać się pod inne osoby.</li>
      </ul>

      <h2>Etyczne korzystanie z wiedzy</h2>
      <ul>
        <li>Techniki poznane w Hackademy stosujesz wyłącznie w środowiskach ćwiczeniowych serwisu lub w systemach, do których masz wyraźną zgodę właściciela.</li>
        <li>Zabronione są ataki na infrastrukturę Hackademy poza udostępnionymi zadaniami, w tym na serwery, API i innych użytkowników.</li>
        <li>Podłączając się do środowisk zadań przez VPN, atakujesz tylko maszyny przypisane do zadania.</li>
        <li>Lukę w samym serwisie zgłoś na <ContactLink /> zamiast ją wykorzystywać.</li>
      </ul>

      <h2>Uczciwa rywalizacja</h2>
      <ul>
        <li>Nie publikuj rozwiązań ani flag zadań i nie podawaj ich innym.</li>
        <li>Nie zawyżaj punktów, rankingu ani wyników w Arenie przez boty, wiele kont lub błędy serwisu.</li>
      </ul>

      <h2>Czat i zachowanie</h2>
      <p>
        Szanuj innych. Zabronione są obelgi, nękanie, spam i treści niezgodne z prawem. Wiadomości można zgłaszać, a
        moderatorzy mogą je usuwać i czasowo wyciszać użytkowników.
      </p>

      <h2>Naruszenia</h2>
      <p>
        Za naruszenie regulaminu możemy wyzerować wyniki, ograniczyć funkcje konta, czasowo je zablokować lub je usunąć.
      </p>

      <h2>Odpowiedzialność</h2>
      <p>
        Serwis jest rozwijany na bieżąco i udostępniany w obecnej postaci. Dokładamy starań, aby działał stabilnie, ale
        mogą zdarzać się przerwy i błędy. Nie odpowiadamy za skutki wykorzystania wiedzy z serwisu niezgodnie z
        regulaminem lub prawem.
      </p>

      <h2>Usunięcie konta</h2>
      <p>
        Możesz w każdej chwili przestać korzystać z serwisu i poprosić o usunięcie konta, pisząc na <ContactLink />.
      </p>

      <h2>Dane osobowe</h2>
      <p>
        Zasady przetwarzania danych opisuje <Link to="/prywatnosc">polityka prywatności</Link>.
      </p>

      <h2>Zmiany regulaminu</h2>
      <p>
        O istotnych zmianach poinformujemy w serwisie z wyprzedzeniem. Dalsze korzystanie z serwisu po zmianie oznacza
        akceptację nowej wersji.
      </p>
    </LegalDocument>
  );
}
