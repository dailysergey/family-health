# family-health

Self-hosted семейный дашборд здоровья с интерактивным ассистентом Claude Code.

Ведёшь одну папку на семью: анализы, диагнозы, выписки, снимки — данные хранятся
локально в JSON и обычных папках, никаких облаков. Ассистент читает эту папку,
разбирает загруженные PDF/JPG документы, отвечает на вопросы про анализы,
строит графики и генерирует отчёты через AG-UI-виджеты.

Интерфейс — Next.js 15 в стиле Apple Health (тёмная/светлая тема, русский).

## Как это работает

```
Браузер ──POST /api/chat──▶ Next.js ──tmux send-keys──▶ [tmux «health»: claude REPL]
                                                              │ вызывает MCP-инструменты
                                                              ▼
Браузер ◀──SSE /api/events── Next.js ◀──POST /api/ingest── health-ui MCP (дочерний к claude)
```

- **Пользователь** пишет сообщение в панели чата (правая колонка).
- **Next.js** сохраняет его, форматирует как `[conv:...][run:...][member:...] <текст>`
  и отправляет в tmux-сессию `health` через `tmux send-keys`.
- **Claude Code** внутри tmux читает данные семьи (папку `data/<memberId>/`),
  думает и вызывает MCP-инструменты сервера `health-ui`:
  - `emit_message` — текстовый ответ (Markdown);
  - `emit_widget` — визуализация: `SummaryCard`, `TrendChartCard`, `ReportCard`;
  - `add_lab_results`, `save_diagnosis`, `file_document`, `update_member_json`
    — изменения в данных;
  - `run_finished` — маркер конца ответа.
- **MCP-сервер** POST-ит каждое событие в `/api/ingest` веб-приложения.
- **Next.js** транслирует события в браузер по SSE (`/api/events`).
- **Браузер** рендерит текст и виджеты в чат, дашборд обновляется по данным.

Терминал Claude никогда не парсится — структурированный вывод идёт только через
MCP-инструменты. Это делает интеграцию устойчивой к смене TUI Claude Code.

### Что видно в интерфейсе

- **Слева** — карточки членов семьи, кнопка «Добавить члена семьи».
- **В центре** — активные диагнозы, последние анализы (сгруппированы по панелям:
  ОАК, биохимия, липидный профиль, гормоны и т.д.), тренды метрик, документы
  с drag&drop-загрузкой.
- **Справа** — чат с Claude, история сохраняется в `data/<memberId>/chat.json`.

## Структура данных

```
data/
├── family.json                   # массив членов семьи (id, ФИО, дата, пол, accent)
├── .mcp.json                     # конфиг MCP-сервера health-ui для claude
├── CLAUDE.md                     # системная инструкция для агента
└── <memberId>/                   # любой slug (parent1, mom, kid...)
    ├── labs.json                 # анализы (с units, refRange, статусами, историей)
    ├── diagnoses.json            # диагнозы (ICD-10 опционально)
    ├── metrics.json              # тренды (вес, давление, глюкоза)
    ├── documents.json            # документы (filename, path, category, summary)
    ├── chat.json                 # история переписки
    ├── Анализы/                  # PDF-файлы анализов
    ├── Заключения/               # заключения врачей
    ├── Выписки/                  # стационарные выписки
    ├── Снимки/                   # УЗИ/МРТ/КТ снимки
    └── _inbox/                   # входящие файлы (агент разберёт и разложит)
```

Пример скелета — в `data.example/`. Скопируй в `data/` и наполняй.

## Установка

Требования: Node.js 20+, tmux, Claude Code CLI (`claude`), pm2 (опционально для prod).

```bash
git clone git@github.com:dailysergey/family-health.git
cd family-health

# 1. web
cp web/.env.example web/.env.local
# отредактируй web/.env.local: HEALTH_DATA_DIR, HEALTH_PIN, HEALTH_INGEST_SECRET
(cd web && npm install && npm run build)

# 2. mcp-сервер health-ui
(cd mcp && npm install)

# 3. данные
cp -r data.example data
# синхронизируй HEALTH_INGEST_SECRET между web/.env.local и data/.mcp.json

# 4. tmux-сессия с Claude
bash runtime/start-claude.sh
# при желании понаблюдать: tmux attach -t health

# 5. запуск
cd web && PORT=3100 npm start
# либо через pm2:
# pm2 start ecosystem.config.js
```

Открой `http://localhost:3100`, введи PIN из `web/.env.local`.

## Переменные окружения (`web/.env.local`)

| Переменная | Назначение | По умолчанию |
|---|---|---|
| `HEALTH_DATA_DIR` | Путь к папке с данными семьи | `./data` |
| `HEALTH_TMUX_SESSION` | Имя tmux-сессии для Claude | `health` |
| `HEALTH_INGEST_SECRET` | Секрет для `/api/ingest` (совпадает с `data/.mcp.json`) | *обязательно задать* |
| `HEALTH_PIN` | PIN для входа в веб | *обязательно задать* |
| `HEALTH_START_SCRIPT` | Путь к скрипту старта tmux | `./runtime/start-claude.sh` |

## Безопасность

- Данные и переписка хранятся локально в файловой системе. Ничего не уходит наружу,
  кроме LLM-запросов от Claude Code к Anthropic API (это твой API-ключ на твоём
  профиле Claude Code).
- Claude запущен с `--dangerously-skip-permissions` — агент может читать и
  двигать файлы в папке `data/` без подтверждений. Запускай **только на своей
  машине или в доверенной среде**, не выставляй tmux-сокет в сеть.
- PIN-аутентификация — минимальный барьер, не замена нормальной авторизации.
  За публичным reverse-proxy (nginx/traefik) добавь HTTPS + rate-limit + отдельный
  слой авторизации (basic auth / OIDC), если хочешь открывать в интернет.
- Никогда не коммить `data/` и `web/.env.local` — они в `.gitignore`.

## Стек

- **Frontend/Backend**: Next.js 15 (App Router), React 19, TypeScript, TailwindCSS,
  next-themes, recharts, react-markdown.
- **AG-UI**: `@ag-ui/core` + `@ag-ui/client` для потока событий и рендеринга виджетов.
- **MCP-сервер**: собственный `health-ui` (`mcp/src/index.ts`) на `tsx`.
- **LLM-агент**: Claude Code CLI внутри tmux-сессии, чтобы веб-приложение могло
  переиспользовать один REPL и не платить за холодный старт каждой команды.
- **Хранилище**: обычные JSON-файлы + папки на диске. Никакой БД.

## Лицензия

MIT — используй как хочешь, но помни: это персональный проект, никаких гарантий
про медицинскую корректность. Ассистент помогает разбирать анализы, но не заменяет
врача. Проверяй важные интерпретации сам.
