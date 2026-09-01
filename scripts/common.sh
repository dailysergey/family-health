# Общие функции установщика и ./health. Подключается через `source ./scripts/common.sh`.
# Совместимо с bash 3.2 (штатный bash в macOS): без ассоциативных массивов и mapfile.

if [ -t 1 ]; then
  C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_DIM=$'\033[2m'; C_B=$'\033[1m'; C_0=$'\033[0m'
else
  C_OK=""; C_WARN=""; C_ERR=""; C_DIM=""; C_B=""; C_0=""
fi

say()   { printf '%s\n' "${1-}"; }
title() { printf '\n%s%s%s\n\n' "$C_B" "$1" "$C_0"; }
ok()    { printf '%s  ok %s %s\n' "$C_OK" "$C_0" "$1"; }
warn()  { printf '%s  !  %s %s\n' "$C_WARN" "$C_0" "$1"; }
bad()   { printf '%s нет %s %s\n' "$C_ERR" "$C_0" "$1"; }
dim()   { printf '%s      %s%s\n' "$C_DIM" "$1" "$C_0"; }
die()   { printf '\n%sОшибка:%s %s\n' "$C_ERR" "$C_0" "$1" >&2; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

# Вопрос с ответом по умолчанию. Промпт уходит в терминал, ответ — в stdout,
# иначе подстановка $(ask ...) съела бы сам вопрос.
_prompt() { if [ -e /dev/tty ]; then printf '%s' "$1" > /dev/tty; else printf '%s' "$1" >&2; fi; }

ask() {
  local q="$1" def="${2-}" a=""
  if [ "${YES:-0}" = 1 ]; then printf '%s' "$def"; return; fi
  if [ -n "$def" ]; then _prompt "$q [$def]: "; else _prompt "$q: "; fi
  if [ -e /dev/tty ]; then read -r a < /dev/tty; else read -r a; fi
  printf '%s' "${a:-$def}"
}

ask_secret() {
  local q="$1" def="${2-}" hint="${3-оставить прежний}" a=""
  if [ "${YES:-0}" = 1 ] || [ ! -e /dev/tty ]; then printf '%s' "$def"; return; fi
  if [ -n "$def" ]; then _prompt "$q [$hint]: "; else _prompt "$q: "; fi
  read -rs a < /dev/tty; printf '\n' > /dev/tty
  printf '%s' "${a:-$def}"
}

port_busy() { (exec 3<>/dev/tcp/127.0.0.1/"$1") >/dev/null 2>&1; }

ask_port() {
  local v; v=$(ask "$1" "$2")
  if port_busy "$v"; then warn "порт $v уже занят — если это не сам family-health, поменяйте его в .env" >&2; fi
  printf '%s' "$v"
}

rand_pass() {
  if have openssl; then openssl rand -base64 18 | tr -d '/+=' | cut -c1-14
  else head -c 256 /dev/urandom | LC_ALL=C tr -dc 'A-Za-z0-9' | cut -c1-14; fi
}

rand_secret() {
  # 32 байта для HEALTH_INGEST_SECRET — base64 без переносов
  if have openssl; then openssl rand -base64 32 | tr -d '\n'
  else head -c 256 /dev/urandom | LC_ALL=C tr -dc 'A-Za-z0-9+/' | cut -c1-44; fi
}

host_tz() {
  local tz=""
  if [ -L /etc/localtime ]; then tz=$(readlink /etc/localtime); tz=${tz##*zoneinfo/}; fi
  [ -z "$tz" ] && [ -f /etc/timezone ] && tz=$(cat /etc/timezone)
  printf '%s' "${tz:-${TZ:-Europe/Moscow}}"
}

# Адрес, по которому интерфейс откроется у того, кто ставит: на сервере по ssh
# «localhost» бесполезен, там нужен адрес самого сервера.
host_addr() {
  local addr=""
  [ -n "${SSH_CONNECTION:-}" ] && addr=$(echo "$SSH_CONNECTION" | awk '{print $3}')
  case "$addr" in ""|localhost|::1|127.*) printf 'localhost'; return 0 ;; esac
  case "$addr" in *:*) printf '[%s]' "$addr" ;; *) printf '%s' "$addr" ;; esac
}

# Читает KEY=VALUE из .env в одноимённые переменные. Не исполняет файл: там
# лежат пароли и токены, лишний eval в этом месте не нужен.
env_load() {
  [ -f "$1" ] || return 0
  local line key val
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|'#'*) continue ;; esac
    case "$line" in *=*) ;; *) continue ;; esac
    key=${line%%=*}; val=${line#*=}
    case "$key" in *[!A-Za-z0-9_]*) continue ;; esac
    val=${val%\"}; val=${val#\"}
    printf -v "$key" '%s' "$val"
  done < "$1"
}

# Перезаписывает .env перечисленными ключами, сохраняя всё остальное, что человек
# добавил руками.
env_save() {
  local file="$1"; shift
  local tmp="$file.tmp" key val line
  : > "$tmp"; chmod 600 "$tmp"
  for key in "$@"; do
    eval "val=\${$key-}"
    case "$val" in *[\ \"\']*) val="\"$(printf '%s' "$val" | sed 's/"/\\"/g')\"" ;; esac
    printf '%s=%s\n' "$key" "$val" >> "$tmp"
  done
  if [ -f "$file" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
      case "$line" in '') continue ;; '#'*) printf '%s\n' "$line" >> "$tmp"; continue ;;
                       *=*) key=${line%%=*} ;; *) continue ;; esac
      for k in "$@"; do [ "$k" = "$key" ] && continue 2; done
      printf '%s\n' "$line" >> "$tmp"
    done < "$file"
  fi
  mv "$tmp" "$file"
}

dc() { docker compose "$@"; }

# Ключи, которые пишет установщик. Один список на install.sh и ./health.
ENV_KEYS="HEALTH_PIN HEALTH_INGEST_SECRET HEALTH_PORT HEALTH_DATA_DIR \
CLAUDE_DIR CLAUDE_JSON CLAUDE_CODE_OAUTH_TOKEN GHEALTH_CONFIG_DIR TZ HEALTH_TAG"

# Проверка живости: /api/members отвечает — приложение и сессия tmux/claude на плаву.
backend_health() {
  local port="${HEALTH_PORT:-3100}"
  curl -fsS -m 5 "http://127.0.0.1:$port/api/members" >/dev/null 2>&1
}

wait_healthy() {
  local secs="${1:-120}" i=0
  while [ "$i" -lt "$secs" ]; do
    backend_health && return 0
    i=$((i + 3)); sleep 3
  done
  return 1
}

# Настоящая проверка авторизации Claude: один короткий ход через тот же движок,
# которым ходит агент. Наличие креденшелов на диске ничего не доказывает —
# OAuth-сессия могла протухнуть, а подписка — кончиться.
check_auth() {
  local secs=120 pid rc=0
  ( dc exec -T family-health claude -p 'Ответь одним словом: ok' >/dev/null 2>&1 ) & pid=$!
  ( sleep "$secs"; kill -TERM "$pid" 2>/dev/null ) & local watcher=$!
  disown "$watcher" 2>/dev/null || true
  wait "$pid" 2>/dev/null || rc=$?
  kill -TERM "$watcher" 2>/dev/null || true
  return $rc
}

auth_hint() {
  printf 'выпустите токен: ./health token'
}
