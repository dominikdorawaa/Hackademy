# 🎓 Hackademy

Polska platforma edukacyjna umożliwiająca naukę cyberbezpieczeństwa poprzez interaktywne ćwiczenia typu CTF (Capture The Flag).

## 🎯 O projekcie

Hackademy wypełnia lukę na polskim rynku edukacji w zakresie cyberbezpieczeństwa, oferując:
- Polskojęzyczne ścieżki edukacyjne
- Praktyczne zadania w bezpiecznym, izolowanym środowisku
- Interaktywną metodę nauczania przez praktykę

## 🌍 Wersja Live

Platforma jest dostępna online Możesz ją przetestować pod adresem:
👉 **[https://hackademy-front.onrender.com](https://hackademy-front.onrender.com)**

---

## ✨ Funkcjonalności

### 👤 Dla użytkowników

- **✅ Rejestracja i uwierzytelnianie**  
  Logowanie przez email oraz SSO (Google)

- **📊 Dashboard użytkownika**  
  Śledzenie postępów i rekomendacje ścieżek edukacyjnych

- **🎮 Interaktywne laboratoria**  
  Izolowane środowiska (kontenery/VM) do wykonywania zadań

- **💡 System podpowiedzi**  
  Hinty ułatwiające naukę bez ujawniania pełnego rozwiązania

- **📚 Samouczek**  
  Interaktywny tutorial wprowadzający nowych użytkowników

- **🏆 System rankingowy**  
  Punkty XP, odznaki, statystyki i porównywanie wyników

- **⚔️ Tryb rywalizacji**  
  Wspólna gra w czasie rzeczywistym

### 🎓 Dla ekspertów

- **📝 Edytor zadań**  
  Tworzenie i edycja scenariuszy CTF

- **🗂️ Zarządzanie kursami**  
  Tworzenie modułów i ścieżek edukacyjnych

- **🎯 Metadane zadań**  
  Definiowanie poziomu trudności i czasu rozwiązania

- **📋 Szablony zadań**  
  Gotowe wzorce do szybkiego tworzenia treści

### 🔐 Dla administratorów

- **🔧 Panel administracyjny**  
  Pełna kontrola nad platformą

- **👥 Zarządzanie użytkownikami**  
  Tworzenie, usuwanie i zmiana ról

- **🔒 Audyt bezpieczeństwa**  
  Logi i monitoring aktywności

---

## 🛠️ Technologie

### Frontend
- React 18+
- TailwindCSS
- JavaScript

### Backend
- Java
- Spring Boot
- REST API
- JWT/OAuth2

### Baza danych
- PostgreSQL

---

## Uruchomienie lokalne przez run.sh

Na Linuksie uruchom `./run.sh` z katalogu projektu. Skrypt uruchamia PostgreSQL i backend przez Docker Compose oraz frontend przez `npm run dev`, z automatycznym odświeżaniem po zmianach w kodzie. Możesz wywołać go również z innego katalogu, podając pełną ścieżkę do pliku.

Wymagane są działający Docker Engine z Docker Compose, Node.js z npm, curl oraz polecenia flock i setsid (pakiet util-linux). Bez istniejącego `.env` potrzebny jest również openssl; skrypt tworzy wtedy lokalny `.env` z losowymi wartościami `DB_PASSWORD` i `JWT_SECRET`, dostępnym tylko dla właściciela. Istniejącego `.env` nie nadpisuje. Przy każdym uruchomieniu wykonuje `npm ci` i buduje backend, więc pierwszy start może potrwać kilka minut.

Frontend działa pod `http://localhost:5173`, a backend pod `http://localhost:8080`. Porty 5173, 8080 i 15432 muszą być dostępne. Skrypt korzysta z lokalnej bazy Compose; adres `DB_URL` z istniejącego `.env` nie jest używany. Nie uruchamiaj równocześnie frontendowego kontenera Compose, ponieważ korzysta z tego samego portu co Vite.

Jeśli `.env` zaginie, a wolumen lokalnej bazy nadal istnieje, skrypt zatrzyma się przed wygenerowaniem nowych haseł. Przywróć poprzedni `.env` albo utwórz go z dotychczasowym hasłem bazy w `DB_PASSWORD` i własnym sekretem `JWT_SECRET`. Nowe losowe hasło nie zmienia hasła w istniejącej bazie. Skrypt nie usuwa wolumenu ani jego danych.

Przed oczekiwaniem na API skrypt sprawdza logowanie do bazy. Jeśli backend zakończy pracę lub zacznie się restartować, od razu wypisze błąd i ostatnie logi, zamiast czekać na pełny limit startu.

Zatrzymaj aplikację przez Ctrl+C. Skrypt kończy frontend i zatrzymuje tylko te usługi backendu i bazy, które przed jego uruchomieniem nie były aktywne. Wolumen bazy zostaje zachowany. Usługi uruchomione wcześniej pozostają aktywne. Ponowne uruchomienie drugiej instancji `run.sh` dla tego samego katalogu jest blokowane.

## Uruchomienie lokalne przez Docker Compose

1. Skopiuj `.env.example` do `.env` w katalogu głównym i ustaw własne `DB_PASSWORD` oraz `JWT_SECRET`. Jeżeli masz już `.env`, nie nadpisuj go; sprawdź tylko te dwie zmienne. Sekret JWT musi być losową wartością Base64 o co najmniej 32 bajtach. W PowerShell można go wygenerować poleceniem `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`.
2. Uruchom `docker compose up --build -d` z katalogu głównego projektu.
3. Otwórz `http://localhost:5173`. Backend odpowiada pod `http://localhost:8080/health`.

Compose uruchamia własny PostgreSQL w trwałym wolumenie. Nie używa adresu zewnętrznej bazy z istniejącego `.env`, więc lokalne uruchomienie nie zmieni danych produkcyjnych. Flyway przygotowuje schemat bazy przy starcie backendu z migracji w `db/schema`, a Hibernate sprawdza jego zgodność. Nowa baza zawiera tylko definicje odznak; pierwsze konto administratora nadaj ręcznie po rejestracji poleceniem `UPDATE users SET role = 'ADMIN' WHERE username = '...'`. Zatrzymaj usługi przez `docker compose down`; wolumen bazy zostaje zachowany.

## Testy backendu

Uruchom Docker Engine, a następnie wykonaj `mvn -B -ntp verify` w katalogu `server`. Testcontainers sam uruchamia PostgreSQL, a Flyway przygotowuje schemat testowej bazy; nie trzeba ustawiać `DB_URL` ani używać bazy z `.env`. Ten sam zestaw testów wykonuje workflow `Backend` dla każdego pull requestu. Wynik i logi są dostępne w zakładce Actions oraz w Checks danego PR.

## Testy frontendu

W katalogu `client` wykonaj `npm ci`, a następnie `npm test`. Sam zestaw testów logowania i chronionych tras uruchomisz przez `npm run test:integration`. Workflow `Frontend` wykonuje lint, build z kontrolą typów i pełny zestaw testów na każdym pull requeście.

Testy korzystają z Vitest, React Testing Library, `user-event` i matcherów `jest-dom`. Helper `src/test/renderWithAuth.tsx` renderuje trasy z `MemoryRouter` i prawdziwym `AuthProvider`. Sesję można przygotować przez zapis tokena z `src/test/fixtures/auth.ts` do `localStorage` przed renderowaniem.

MSW przechwytuje API bez uruchamiania backendu. Handlery w `src/test/mocks/handlers.ts` używają typów z `src/types/api.ts` i adresu z `apiConfig.ts`. Nadpisuj odpowiedzi dla danego scenariusza przez `server.use(...)`; konfiguracja automatycznie resetuje handlery, czyści DOM i storage po każdym teście. Żądanie bez handlera jest błędem.

## Tailwind i shadcn/ui

Tailwind 4 działa przez plugin Vite i import w `client/src/index.css`, razem z Preflightem. Nie wymaga konfiguracji v3 ani PostCSS. Style bazowe są w warstwie `base`, a własne style komponentów w `components`, dzięki czemu klasy użytkowe Tailwinda mogą je nadpisywać. Istniejący kontener strony używa klasy `hackademy-container`; `container` jest klasą Tailwinda.

W katalogu `client` dodawaj komponenty poleceniem `npx shadcn@latest add <nazwa>`. Konfiguracja `components.json` generuje TSX w `src/components/ui`, ze stylem `new-york` i aliasem `@/`. Gotowe są Button, Input, Card i Label. Helper `cn` jest dostępny przez `@/lib/utils` i korzysta z pakietu `cn` używanego przez aktualny generator shadcn.

Tokeny shadcn są w `src/styles/theme.css` i odwołują się do istniejącej palety Hackademy: niebieski jest kolorem głównym, czerwony oznacza akcje destrukcyjne, a tła, teksty i obramowania korzystają z obecnych zmiennych. `ThemeProvider` nadal steruje atrybutem `data-theme` i zapisem `app-theme`; ten sam atrybut obsługuje wariant `dark:`. Domyślny motyw jest ciemny.

Style zgodności starych formularzy nie obejmują elementów z `data-slot`, używanych przez shadcn. Przy generowaniu kolejnych komponentów zachowuj ten atrybut oraz zasady repozytorium, w tym brak komentarzy w nowym kodzie. `npm test` sprawdza także kompilację CSS produkcyjnego i działanie podstawowych komponentów shadcn.

## Profile użytkowników

Profil to wizytówka z bio, zainteresowaniami, wybieranym avatarem DiceBear i gablotą maksymalnie trzech zdobytych odznak. Formularz „Edytuj profil” zapisuje opis do 500 znaków, do pięciu zainteresowań, seed avatara i uporządkowany wybór odznak przez `PATCH /api/user/me/profile`. Bez własnego wyboru gablota prezentuje trzy ostatnie odznaki. Migracja Flyway V6 zachowuje dotychczasowe avatary i uniezależnia je od przyszłych zmian nazw użytkowników.

Kolekcja obejmuje zdobyte i niezdobyte osiągnięcia. Paski postępu są widoczne tylko w pełnym katalogu, który otwiera się w oknie z wyszukiwaniem, filtrami, popularnością globalną i paginacją po sześć wpisów. Obok kalendarza są statystyki nauki: rekord jednego dnia, najdłuższa seria, data najaktywniejszego dnia i średnia liczba rozwiązań w aktywnym dniu. Wszystkie dotyczą ostatnich dwunastu tygodni. Profil nie ma przycisku udostępniania; jego adres nadal wymaga zalogowania. Ostatnio ukończone pokoje, XP, poziom, awans i Elo pozostają w dashboardzie.

Decyzje projektowe i zasady widoczności opisuje [ADR profili](docs/adr/user-profiles.md). Znaczenie XP, rang i aktywności wyjaśnia [słownik](docs/glossary.md).
