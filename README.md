# 🎓 Hackademy

Polska platforma edukacyjna umożliwiająca naukę cyberbezpieczeństwa poprzez interaktywne ćwiczenia typu CTF (Capture The Flag).

## 🎯 O projekcie

Hackademy wypełnia lukę na polskim rynku edukacji w zakresie cyberbezpieczeństwa, oferując:
- Polskojęzyczne ścieżki edukacyjne
- Praktyczne zadania w bezpiecznym, izolowanym środowisku
- Interaktywną metodę nauczania przez praktykę

## 🌍 Wersja Live

Platforma jest dostępna online! Możesz ją przetestować pod adresem:
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

## 🚀 Uruchamianie lokalne

Aby uruchomić projekt na swoim komputerze:

1. Sklonuj repozytorium: `git clone https://github.com/dominikdorawaa/Hackademy.git`
2. W głównym folderze projektu utwórz plik `.env` i skopiuj do niego zawartość z pliku `.env.example`.
3. Podmień dane dostępowe w pliku `.env` na właściwe (zapytaj autora o hasła).
4. **Backend (Java/Spring Boot):** 
   - W VS Code odpal projekt za pomocą klawisza `F5` (gotowa konfiguracja załaduje plik `.env`).
   - W IntelliJ zainstaluj wtyczkę **EnvFile** i wskaż jej plik `.env` w ustawieniach *Edit Configurations*.
5. **Frontend (React/Vite):** 
   - Wejdź do folderu `client`, wpisz `npm install`, a następnie `npm run dev`.
