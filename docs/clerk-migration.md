# Przełączenie uwierzytelniania na Clerk

Kod obsługuje Clerk Development lokalnie. Instancję Production dla `hackademy.app` należy utworzyć i skonfigurować osobno przed merge i wdrożeniem. Ten PR nie zmienia konfiguracji produkcyjnej ani kont w Clerk.

## Konfiguracja

W Clerk włącz e-mail i hasło, Google i GitHub. Wymagaj weryfikacji e-maila przy rejestracji, ochrony CAPTCHA i ochrony przed wyciekłymi hasłami. Produkcyjne połączenia OAuth wymagają własnych poświadczeń Google i GitHub oraz skonfigurowanego DNS zgodnie z panelem Clerka. Nazwa publiczna jest przechowywana w Hackademy, nowe konta dostają neutralną nazwę, którą można zmienić w ustawieniach.

W sesji Clerka ustaw własne claims:

```json
{
  "email": "{{user.primary_email_address}}",
  "email_verified": "{{user.email_verified}}"
}
```

Nie pobieraj identyfikatora lokalnego ani ról z metadanych edytowalnych przez użytkownika. Role zawsze pochodzą z lokalnej bazy. Claim `external_id` nie jest używany do uwierzytelniania ani wiązania kont w HTTP.

Backend wymaga `CLERK_ISSUER`, np. `https://clerk.example.com`. Pobiera publiczne klucze z `/.well-known/jwks.json`; opcjonalnie `CLERK_JWT_KEY` pozwala użyć publicznego klucza PEM bez pobierania JWKS. Token musi mieć podpis RS256, poprawnego wystawcę, termin ważności oraz `azp` zgodne z listą CORS. Sesja `pending` jest odrzucana. REST używa nagłówka Authorization, STOMP używa Authorization w CONNECT. Cookies nie uwierzytelniają API.

Lokalnie ustaw klucz publiczny Development jako `VITE_CLERK_PUBLISHABLE_KEY` w `client/.env.local`, a `CLERK_ISSUER` w głównym `.env`. Dla kontenera frontendu klucz przekazuje argument builda o tej samej nazwie z głównego `.env`. Nie wpisuj kluczy do repozytorium. Klucz sekretny nigdy nie trafia do klienta.

Na Heroku ustaw produkcyjny `CLERK_ISSUER` i zachowaj `FRONTEND_URL=https://hackademy.app` lub zgodne `CORS_ALLOWED_ORIGINS`. W GitHub ustaw zmienną repozytorium `VITE_CLERK_PUBLISHABLE_KEY` z kluczem `pk_live_` tej samej instancji. Workflow buduje i wysyła gotowe pliki Pages, dlatego zmienna ustawiona wyłącznie w panelu Pages nie trafi do tego builda. Klucz publiczny musi być gotowy przed wdrożeniem backendu.

## Import istniejących kont

1. Wykonaj kopię bazy. Zapisz identyfikatory ostatnich działających wdrożeń API i Pages. Zamknij możliwość rejestracji w docelowej instancji Clerka na czas importu i odetnij zapisy w starej aplikacji. Importu nie uruchamiaj równolegle z obsługą użytkowników ani z drugim importerem.
2. Uruchom nowy artefakt jako osobny proces z dostępem do tej samej bazy, bez publicznego portu. Flyway dodaje V19: unikalny `clerk_user_id` i opcjonalne hasło. Nie usuwaj ani nie zmieniaj wcześniejszych migracji.
3. Przekaż importerowi `CLERK_ISSUER`, `CLERK_SECRET_KEY`, dane bazy i `CLERK_IMPORT_USERS=true`, np. przez bezpieczne zmienne procesu: `java -jar server.jar --server.port=0`. Nie umieszczaj sekretu w poleceniu ani historii terminala. W normalnym serwerze `CLERK_IMPORT_USERS` musi pozostać `false`.
4. Import tworzy użytkowników z dotychczasowym e-mailem i hashem bcrypt oraz `external_id` równym lokalnemu ID. Od razu zapisuje zwrócony identyfikator Clerka w lokalnym koncie. Nazwy, role, punkty, znajomi, awatary i postępy pozostają w tej samej bazie.
5. Powtórzenie pomija już powiązane konta. Jeśli poprzedni przebieg utworzył konto zewnętrzne, ale nie zapisał powiązania, importer odzyskuje je przez `external_id`. Nie dołącza kont po samym e-mailu. Konflikt z istniejącym kontem Clerka lub błąd API daje niezerowy kod wyjścia i wymaga ustalenia właściciela. Nie naprawiaj konfliktu przez automatyczne przejęcie konta.
6. Warunkiem przełączenia jest zero błędów i zero starych kont bez `clerk_user_id`. Zweryfikuj logowanie dotychczasowym hasłem, konto administratora i zwykłego użytkownika, zmianę nazwy, odzyskanie hasła, preferencje i realtime. Import bcrypt zachowuje hasło. Konta OAuth bez lokalnego hasła nie dostają losowego hasła.
7. Wdróż API, następnie frontend z tą samą instancją Clerka. Włącz rejestrację. Stare tokeny przestają działać, użytkownicy logują się ponownie. Nowe konto jest zakładane lokalnie przy pierwszym żądaniu z podpisanym tokenem i zweryfikowanym e-mailem.
8. Po sprawdzeniu odłącz sekret importu z procesu i usuń ustawienie `CLERK_IMPORT_USERS`. Zachowane lokalne hashe służą okresowi migracji i wycofania; ich usunięcie wymaga osobnej migracji po zakończeniu okresu stabilizacji.

Przy dużej liczbie kont zaplanuj limit zapytań Backend API Clerka. Importer raportuje błąd pojedynczego konta i kontynuuje; po ograniczeniu tempa można ponowić przebieg. Nie uruchamiaj importu do innej instancji na tej samej bazie bez osobnego planu przepięcia identyfikatorów.

## Powrót po niepowodzeniu

Przed otwarciem zapisów można przywrócić poprzednie wdrożenia API i Pages oraz ich wcześniejszy sekret JWT. V19 jest zmianą addytywną, stare konta zachowują hashe. Nie cofaj Flyway ręcznie. Jeśli stare wydanie nie rozpoznaje nowszej migracji, użyj przygotowanego wydania zgodności lub odtwórz backup w osobnej bazie i skieruj stare API do tej bazy.

Po otwarciu zapisów nie przywracaj ślepo backupu: utraciłby nowy postęp. Konta utworzone w Clerk po przełączeniu nie mają lokalnego hasła, a zmiany hasła w Clerk nie aktualizują starego hasha. Wymagają uzgodnionego odzyskania dostępu przed powrotem do starego logowania. Ponownie zatrzymaj zapisy, uzgodnij dane i sposób odzyskania dostępu, następnie przełącz oba wdrożenia. Nie obiecuj automatycznego bezstratnego rollbacku po zmianach kont.

## Pozostałe zależności

Ochrona Cloudflare i limity aplikacyjnego API są osobnymi zadaniami #131 i #132. Lokalne endpointy `/api/auth/login` i `/api/auth/register` oraz zmiana hasła w API są usunięte. Dostosuj reguły do rzeczywistych endpointów; limity i ochronę logowania ustaw w Clerk. Ten PR nie deklaruje realizacji #131 ani #132.
