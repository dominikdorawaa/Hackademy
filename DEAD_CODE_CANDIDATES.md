## DEADCODE_CANDIDATE index

Szybkie szukanie w repo: wyszukaj tekst `DEADCODE_CANDIDATE`.

### Backend – endpointy prawdopodobnie nieużywane przez frontend

- **DEADCODE_CANDIDATE**: `GET /api/files/mission-brief` (`server/.../controller/FileController.java`)
  - Nie znaleziono wywołań w `client/src` (brak `/api/files` / `mission-brief`).

- **DEADCODE_CANDIDATE**: `POST /api/arena/game/{gameId}/win` (`server/.../controller/ArenaController.java`)
  - Front używa `solve/hint/surrender/getGame`, brak wywołań `/win`.

- **DEADCODE_CANDIDATE**: `GET /api/user/me/rank` (`server/.../controller/UserController.java`)
  - Front przerzucony na `GET /api/ranking/summary`, brak wywołań `/api/user/me/rank`.

### Backend – dependency podejrzane o nieużywane

- **DEADCODE_CANDIDATE**: `com.jcraft:jzlib` (`server/pom.xml`)
  - Brak odwołań w kodzie. Uwaga: możliwe użycie pośrednie (SSHD/kompresja), usuwać dopiero po sprawdzeniu flow VPN/SSH.

### Frontend/Repo – śmieci / nieużywane paczki

- **DEADCODE_CANDIDATE**: root `package.json`
  - Zawiera `@google/generative-ai` i `@supabase/supabase-js`, ale brak jakichkolwiek użyć w kodzie JS/TS w repo.
  - Dodatkowo dubluje tailwind/postcss, które już są w `client/package.json`.

