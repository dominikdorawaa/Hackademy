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

Compose uruchamia własny PostgreSQL w trwałym wolumenie. Nie używa adresu zewnętrznej bazy z istniejącego `.env`, więc lokalne uruchomienie nie zmieni danych produkcyjnych. Profil `local` tworzy i aktualizuje schemat w tej lokalnej bazie. Zatrzymaj usługi przez `docker compose down`; wolumen bazy zostaje zachowany.

Zmienne `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET` i `FRONTEND_URL` dla wdrożeń ustawiaj w panelu hostingu. Nie dodawaj pliku `.env` ani kluczy VPN do repozytorium. Jeśli korzystasz z VPN, podaj `VPN_SERVER_HOST`, `VPN_SERVER_USER` i `VPN_SERVER_PRIVATE_KEY_PATH` wskazujący na plik zamontowany poza obrazem, np. `file:/run/secrets/vpn_key`.

`VITE_API_URL` jest publicznym adresem API wpisywanym do frontendu podczas budowania; nigdy nie umieszczaj w zmiennych `VITE_` haseł ani tokenów serwera. Lokalny Compose ustawia ten adres na `http://localhost:8080`.
