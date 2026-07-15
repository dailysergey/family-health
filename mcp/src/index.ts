#!/usr/bin/env -S npx tsx
// health-ui MCP server.
// Gives the persistent tmux Claude session a structured output channel: every
// user-facing message, widget, and data mutation goes through these tools,
// which translate the action into AG-UI events POSTed to the Next.js app
// (/api/ingest) and/or write the member JSON files. This avoids scraping the
// terminal and guarantees valid AG-UI events.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = process.env.HEALTH_DATA_DIR || process.cwd() || "/opt/health/data";
const INGEST_URL = process.env.HEALTH_INGEST_URL || "http://localhost:3000/api/ingest";
const INGEST_SECRET = process.env.HEALTH_INGEST_SECRET || "dev-ingest-secret";

// ---- AG-UI event helpers (mirror web/src/lib/agui.ts on the wire) ----
type Json = Record<string, unknown>;

function envelope(type: string, conversationId: string, extra: Json): Json {
  return { type, conversationId, timestamp: Date.now(), ...extra };
}

async function postEvents(events: Json[]): Promise<void> {
  try {
    await fetch(INGEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ingest-secret": INGEST_SECRET },
      body: JSON.stringify(events),
    });
  } catch (err) {
    process.stderr.write(`[health-ui] ingest failed: ${String(err)}\n`);
  }
}

// ---- File helpers ----
function memberFile(memberId: string, file: string): string {
  return path.join(DATA_DIR, memberId, file);
}

async function readArray<T>(file: string): Promise<T[]> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T[];
  } catch {
    return [];
  }
}

async function writeJSON(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

/** Upsert items into an array file, matching on `id`. */
async function upsert(file: string, items: Json[]): Promise<void> {
  const current = await readArray<Json>(file);
  const byId = new Map(current.map((x) => [x.id, x]));
  for (const item of items) {
    if (!item.id) item.id = randomUUID();
    byId.set(item.id, { ...byId.get(item.id), ...item });
  }
  await writeJSON(file, Array.from(byId.values()));
}

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });

// ---- MCP server ----
const server = new McpServer({ name: "health-ui", version: "1.0.0" });

server.registerTool(
  "emit_message",
  {
    title: "Отправить текстовый ответ в чат",
    description:
      "Показать пользователю текстовый ответ ассистента в панели чата. Используй для каждого ответа на вопрос пользователя.",
    inputSchema: {
      conversationId: z.string().describe("ID диалога из запроса [conv:...]"),
      text: z.string().describe("Текст ответа в Markdown"),
    },
  },
  async ({ conversationId, text }) => {
    const messageId = randomUUID();
    await postEvents([
      envelope("TEXT_MESSAGE_START", conversationId, { messageId, role: "assistant" }),
      envelope("TEXT_MESSAGE_CONTENT", conversationId, { messageId, delta: text }),
      envelope("TEXT_MESSAGE_END", conversationId, { messageId }),
    ]);
    return ok(`Сообщение отправлено в диалог ${conversationId}.`);
  },
);

server.registerTool(
  "emit_widget",
  {
    title: "Вставить виджет/отчёт в чат",
    description:
      "Отрендерить интерактивный виджет в панели чата (AG-UI генеративный UI). Типы: lab_card (карточка анализа), metric_ring (кольцо метрики), trend_chart (график тренда), summary (сводка), diagnosis_card (диагноз), report (отчёт из секций). Смотри схемы props в CLAUDE.md.",
    inputSchema: {
      conversationId: z.string(),
      widgetType: z.enum([
        "lab_card",
        "metric_ring",
        "trend_chart",
        "summary",
        "diagnosis_card",
        "report",
      ]),
      props: z.any().describe("Объект свойств виджета (см. CLAUDE.md)"),
    },
  },
  async ({ conversationId, widgetType, props }) => {
    // Tolerate props passed as a JSON string (common LLM behavior): parse to an
    // object so the renderer receives real fields, not a character-indexed string.
    let normalized: unknown = props;
    if (typeof props === "string") {
      try {
        normalized = JSON.parse(props);
      } catch {
        /* leave as-is; renderer falls back gracefully */
      }
    }
    await postEvents([
      envelope("CUSTOM", conversationId, {
        name: "widget",
        value: { widgetType, props: normalized },
        messageId: randomUUID(),
      }),
    ]);
    return ok(`Виджет ${widgetType} отправлен.`);
  },
);

server.registerTool(
  "add_lab_results",
  {
    title: "Добавить результаты анализов",
    description:
      "Добавить или обновить результаты анализов члена семьи (labs.json). Каждый объект: {id?, name, value, unit, refLow?, refHigh?, refText?, status: normal|high|low|borderline|critical, date, docId?, category?, group?}. group — медицинская панель для группировки на дашборде (напр. «Общий анализ крови», «Биохимия крови», «Липидный профиль», «Углеводный обмен», «Гормоны», «Витамины и микроэлементы», «Воспаление и обмен», «Почки и моча», «Обследования»). См. CLAUDE.md.",
    inputSchema: {
      memberId: z.string(),
      conversationId: z.string().optional(),
      results: z.array(z.any()),
    },
  },
  async ({ memberId, conversationId, results }) => {
    await upsert(memberFile(memberId, "labs.json"), results as Json[]);
    if (conversationId) {
      await postEvents([envelope("CUSTOM", conversationId, { name: "member_updated", value: { memberId } })]);
    }
    return ok(`Добавлено результатов: ${results.length} для ${memberId}.`);
  },
);

server.registerTool(
  "save_diagnosis",
  {
    title: "Сохранить диагноз",
    description:
      "Добавить или обновить диагноз (diagnoses.json). Объект: {id?, title, icd10?, status: active|remission|resolved, severity: normal|borderline|high|critical, description, doctor?, date, medications: string[], category?}.",
    inputSchema: {
      memberId: z.string(),
      conversationId: z.string().optional(),
      diagnosis: z.any(),
    },
  },
  async ({ memberId, conversationId, diagnosis }) => {
    await upsert(memberFile(memberId, "diagnoses.json"), [diagnosis as Json]);
    if (conversationId) {
      await postEvents([envelope("CUSTOM", conversationId, { name: "member_updated", value: { memberId } })]);
    }
    return ok(`Диагноз сохранён для ${memberId}.`);
  },
);

server.registerTool(
  "file_document",
  {
    title: "Разложить документ по папкам",
    description:
      "Перенести загруженный файл из _inbox в папку категории и записать его в documents.json со сводкой. Категории: Анализы, Заключения, Выписки, Снимки.",
    inputSchema: {
      memberId: z.string(),
      conversationId: z.string().optional(),
      srcPath: z.string().describe("Путь к файлу в _inbox (абсолютный или относительно папки члена)"),
      category: z.string().describe("Папка-категория, напр. Анализы"),
      summary: z.string().describe("Краткое содержание документа"),
    },
  },
  async ({ memberId, conversationId, srcPath, category, summary }) => {
    const base = path.join(DATA_DIR, memberId);
    const abs = path.isAbsolute(srcPath) ? srcPath : path.join(base, srcPath);
    const filename = path.basename(abs);
    const destRel = path.join(category, filename);
    const dest = path.join(base, destRel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.rename(abs, dest);
    const stat = await fs.stat(dest);
    const doc: Json = {
      id: randomUUID(),
      filename,
      path: destRel,
      category,
      sizeBytes: stat.size,
      addedAt: new Date().toISOString(),
      summary,
      status: "done",
    };
    await upsert(memberFile(memberId, "documents.json"), [doc]);
    if (conversationId) {
      await postEvents([envelope("CUSTOM", conversationId, { name: "member_updated", value: { memberId } })]);
    }
    return ok(`Документ перемещён в ${destRel} (id ${doc.id}).`);
  },
);

server.registerTool(
  "update_member_json",
  {
    title: "Заменить файл данных члена семьи",
    description:
      "Полностью заменить один из файлов данных члена семьи переданным JSON (для правок/исправлений). file: labs|diagnoses|metrics|documents.",
    inputSchema: {
      memberId: z.string(),
      conversationId: z.string().optional(),
      file: z.enum(["labs", "diagnoses", "metrics", "documents"]),
      content: z.array(z.any()),
    },
  },
  async ({ memberId, conversationId, file, content }) => {
    await writeJSON(memberFile(memberId, `${file}.json`), content);
    if (conversationId) {
      await postEvents([envelope("CUSTOM", conversationId, { name: "member_updated", value: { memberId } })]);
    }
    return ok(`Файл ${file}.json заменён для ${memberId}.`);
  },
);

server.registerTool(
  "run_finished",
  {
    title: "Завершить обработку запроса",
    description: "Сообщить интерфейсу, что обработка текущего запроса завершена (убирает индикатор «печатает»).",
    inputSchema: {
      conversationId: z.string(),
      runId: z.string().describe("runId из запроса [run:...]"),
    },
  },
  async ({ conversationId, runId }) => {
    await postEvents([envelope("RUN_FINISHED", conversationId, { runId })]);
    return ok(`Прогон ${runId} завершён.`);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`[health-ui] MCP запущен. DATA_DIR=${DATA_DIR} INGEST=${INGEST_URL}\n`);
