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
