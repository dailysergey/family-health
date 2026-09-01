#!/usr/bin/env bash
# Установка family-health: спрашивает нужное, пишет .env, поднимает стенд и проверяет, что он живой.
# Повторный запуск безопасен: существующие ответы подставляются по умолчанию.
set -euo pipefail
cd "$(dirname "$0")"

source ./scripts/common.sh

YES=0; MODE=""
for arg in "$@"; do
  case "$arg" in
    --yes|-y) YES=1 ;;
    --source) MODE=local ;;
    --prebuilt) MODE=prebuilt ;;
    --help|-h) cat <<'USAGE'
Использование: ./install.sh [--yes] [--source|--prebuilt]

  --yes       без вопросов: берёт ответы из существующего .env и переменных окружения
  --source    собирать образ из исходников (нужно, если правите код)
  --prebuilt  брать готовый образ из GHCR (быстрее: скачивание вместо сборки)
USAGE
      exit 0 ;;
    *) die "неизвестный ключ: $arg (см. --help)" ;;
  esac
done
[ -t 0 ] || YES=1

title "Установка family-health"

# --- Шаг 1. Чем поднимать -----------------------------------------------------
have docker || die "нет docker. Поставьте Docker: https://docs.docker.com/get-docker/"
docker compose version >/dev/null 2>&1 || die "нет плагина docker compose (нужен Docker 20.10+)"
docker info >/dev/null 2>&1 || die "демон Docker не отвечает — запустите Docker и повторите"
ok "docker и compose на месте"

# --- Шаг 2. Каталоги данных ---------------------------------------------------
# Заводим сами и от текущего пользователя: иначе их создаст Docker от root,
# и на линуксовом хосте свои же записи не подправишь без sudo.
mkdir -p data
# Пустого ~/.claude.json Docker не найдёт и подставит на его место КАТАЛОГ,
# после чего CLI молча ломается. Заводим файлом заранее.
mkdir -p "$HOME/.claude"
[ -e "$HOME/.claude.json" ] || echo '{}' > "$HOME/.claude.json"
ok "каталоги данных готовы"

# --- Шаг 3. Ответы ------------------------------------------------------------
env_load .env

if [ -n "${HEALTH_PIN:-}" ]; then
  HEALTH_PIN=$(ask_secret "PIN для входа в веб" "$HEALTH_PIN")
else
  HEALTH_PIN=$(ask_secret "PIN для входа в веб" "1234" "по умолчанию 1234")
fi

# ingest secret — генерим один раз и не показываем, чтобы placeholder никто не оставил
if [ -z "${HEALTH_INGEST_SECRET:-}" ] || [ "${HEALTH_INGEST_SECRET}" = "change-me-generate-with-openssl-rand" ]; then
  HEALTH_INGEST_SECRET=$(rand_secret)
  ok "сгенерирован HEALTH_INGEST_SECRET"
fi

TZ=$(ask "Таймзона (по ней срабатывают напоминания)" "${TZ:-$(host_tz)}")
HEALTH_PORT=$(ask_port "Порт веб-интерфейса" "${HEALTH_PORT:-3100}")
HEALTH_DATA_DIR=$(ask "Куда класть данные семьи на хосте" "${HEALTH_DATA_DIR:-./data}")

# Claude Code creds. По умолчанию с хоста мапится ~/.claude и ~/.claude.json.
CLAUDE_DIR=$(ask "Путь к каталогу Claude Code на хосте" "${CLAUDE_DIR:-~/.claude}")
CLAUDE_JSON=$(ask "Путь к .claude.json на хосте" "${CLAUDE_JSON:-~/.claude.json}")

# --- Шаг 4. Авторизация Claude ------------------------------------------------
# Claude Code CLI ходит по подписке (OAuth). На сервере без браузера живёт только
# долгоживущий токен: OAuth-сессия в ~/.claude однажды перестаёт обновляться,
# и агент начинает отвечать «Failed to authenticate».
say
if [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  ok "токен Claude уже есть в .env — оставляю"
  AUTH=token
elif [ "$YES" = 1 ]; then
  AUTH=session
  warn "токена Claude нет — беру сессию из $CLAUDE_DIR (на сервере она однажды протухнет: ./health token)"
else
  say "Как агенту авторизоваться в Claude:"
  say "  1) выпустить долгоживущий токен (год) — годится и для сервера без браузера"
  say "  2) взять OAuth-сессию из ~/.claude — годится для своей машины"
  case "$(ask "Выбор" "1")" in
    2) AUTH=session ;;
    *) AUTH=token ;;
  esac
fi

if [ "$AUTH" = token ] && [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && have claude; then
  say
  say "Сейчас откроется вход в Claude. Скопируйте выданный токен и вставьте ниже."
  claude setup-token || warn "не получилось — токен можно выпустить позже: ./health token"
  CLAUDE_CODE_OAUTH_TOKEN=$(ask_secret "Токен (sk-ant-oat…), пусто — пропустить" "")
fi

# --- Шаг 5. .env --------------------------------------------------------------
if [ -z "$MODE" ]; then
  if [ "$YES" = 1 ]; then
    MODE=$([ "${HEALTH_TAG:-local}" = local ] && echo local || echo prebuilt)
  else
    say
    say "Откуда брать образ:"
    say "  1) готовый из GHCR — минута вместо сборки"
    say "  2) собрать из исходников — если собираетесь править код"
    case "$(ask "Выбор" "1")" in
      2) MODE=local ;;
      *) MODE=prebuilt ;;
    esac
  fi
fi
HEALTH_TAG=$([ "$MODE" = local ] && echo local || echo main)

env_save .env $ENV_KEYS
ok ".env записан (права 600)"

# --- Шаг 6. Подъём ------------------------------------------------------------
say
if [ "$HEALTH_TAG" = local ]; then
  say "Собираю образ — первый раз это несколько минут."
  dc up -d --build
else
  say "Скачиваю образ."
  dc pull --quiet || die "не скачался образ. Повторите с ./install.sh --source (сборка из исходников)"
  dc up -d --no-build
fi

if [ "$AUTH" = token ] && [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && ! have claude; then
  say
  say "Выпускаю токен Claude внутри контейнера — следуйте инструкции на экране."
  dc exec family-health claude setup-token || warn "не получилось: повторите позже через ./health token"
  CLAUDE_CODE_OAUTH_TOKEN=$(ask_secret "Токен (sk-ant-oat…), пусто — пропустить" "")
  if [ -n "$CLAUDE_CODE_OAUTH_TOKEN" ]; then
    env_save .env $ENV_KEYS
    dc up -d family-health
  fi
fi

wait_healthy 120 || die "приложение не поднялось. Логи: ./health logs"
ok "приложение отвечает"

# --- Шаг 7. Проверки ----------------------------------------------------------
say
say "Проверяю авторизацию агента — это занимает несколько секунд."
if check_auth; then
  ok "агент авторизован"
else
  warn "агент не авторизовался. Дальше: $(auth_hint)"
fi

# --- Готово -------------------------------------------------------------------
host=$(host_addr)
say
title "Готово"
say "  Дашборд:  http://$host:$HEALTH_PORT"
say "  PIN:      $HEALTH_PIN"
say
say "Дальше: ./health doctor — проверка стенда, ./health update — обновление."
