#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [[ -t 1 ]]; then
    BLUE=$'\033[1;34m'
    GREEN=$'\033[1;32m'
    RED=$'\033[1;31m'
    RESET=$'\033[0m'
else
    BLUE='' GREEN='' RED='' RESET=''
fi

info() { printf '\n%s[Hackademy]%s %s\n' "$BLUE" "$RESET" "$*"; }
fail() { printf '\n%s[Hackademy]%s %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }

for tool in docker npm curl flock setsid; do
    command -v "$tool" >/dev/null 2>&1 || fail "Brakuje polecenia: $tool. Zainstaluj je i uruchom skrypt ponownie."
done

docker compose version >/dev/null 2>&1 || fail 'Potrzebny jest Docker Compose (docker compose).'
docker info >/dev/null 2>&1 || fail 'Docker jest niedostępny. Uruchom Docker Engine i sprawdź uprawnienia do jego socketu.'

exec 9>"$ROOT/.run.lock"
flock -n 9 || fail 'Inna instancja run.sh już działa dla tego projektu.'

if [[ ! -e "$ROOT/.env" ]]; then
    command -v openssl >/dev/null 2>&1 || fail 'Do utworzenia lokalnego .env potrzebny jest openssl.'
    db_password="$(openssl rand -hex 24)"
    jwt_secret="$(openssl rand -base64 32)"
    (umask 077; set -o noclobber; printf 'DB_PASSWORD=%s\nJWT_SECRET=%s\n' "$db_password" "$jwt_secret" > "$ROOT/.env")
    unset db_password jwt_secret
    info 'Utworzono lokalny .env z losowym hasłem bazy i sekretem JWT.'
fi

compose=(docker compose --project-directory "$ROOT" -f "$ROOT/docker-compose.yml")
"${compose[@]}" config --quiet || fail 'Sprawdź DB_PASSWORD i JWT_SECRET w głównym pliku .env.'

info 'Instalowanie zależności frontendu (npm ci)...'
(cd "$ROOT/client"; npm ci --no-audit --no-fund)

running_services="$("${compose[@]}" ps --status running --services)"
stop_services=()
for service in postgres backend; do
    if ! [[ $'\n'"$running_services"$'\n' == *$'\n'"$service"$'\n'* ]]; then
        stop_services+=("$service")
    fi
done

frontend_pid=''
cleanup() {
    status=$?
    trap - EXIT INT TERM
    if [[ -n "$frontend_pid" ]]; then
        info 'Zatrzymywanie frontendu...'
        kill -TERM -- "-$frontend_pid" 2>/dev/null || true
        wait "$frontend_pid" 2>/dev/null || true
    fi
    if ((${#stop_services[@]})); then
        info 'Zatrzymywanie usług Dockera uruchomionych przez skrypt (dane bazy zostają)...'
        "${compose[@]}" stop "${stop_services[@]}" || true
    fi
    exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

info 'Uruchamianie PostgreSQL i backendu w Dockerze...'
"${compose[@]}" up --build -d postgres backend

info 'Oczekiwanie na backend: http://localhost:8080/health'
backend_ready=false
for ((attempt = 1; attempt <= 90; attempt++)); do
    if curl --fail --silent --output /dev/null --connect-timeout 1 --max-time 2 http://127.0.0.1:8080/health; then
        backend_ready=true
        break
    fi
    if ((attempt % 10 == 0)); then
        info "Backend nadal startuje (próba $attempt/90)..."
    fi
    sleep 2
done

if [[ "$backend_ready" != true ]]; then
    "${compose[@]}" logs --tail 80 backend >&2 || true
    fail 'Backend nie uruchomił się w wyznaczonym czasie. Sprawdź powyższe logi.'
fi

info 'Uruchamianie frontendu przez npm run dev...'
printf '%sBackend gotowy.%s\nFrontend: http://localhost:5173\nBackend:  http://localhost:8080\nCtrl+C zatrzymuje frontend i usługi uruchomione przez ten skrypt.\n\n' "$GREEN" "$RESET"
(
    cd "$ROOT/client"
    exec setsid env VITE_API_URL=http://localhost:8080 npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
) 9>&- &
frontend_pid=$!
wait "$frontend_pid"
