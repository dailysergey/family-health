import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  ChatStoredItem,
  Diagnosis,
  DocumentMeta,
  FamilyMember,
  LabResult,
  MemberBundle,
  Metric,
} from "./types";

export const DATA_DIR = process.env.HEALTH_DATA_DIR || "/opt/health/data";

export function memberDir(memberId: string): string {
  return path.join(DATA_DIR, memberId);
}

async function readJSON<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Atomic write: write to a temp file then rename. */
export async function writeJSON(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

export async function listMembers(): Promise<FamilyMember[]> {
  return readJSON<FamilyMember[]>(path.join(DATA_DIR, "family.json"), []);
}

export async function getMember(memberId: string): Promise<FamilyMember | null> {
  const members = await listMembers();
  return members.find((m) => m.id === memberId) ?? null;
}

export async function getLabs(memberId: string): Promise<LabResult[]> {
  return readJSON<LabResult[]>(path.join(memberDir(memberId), "labs.json"), []);
}

export async function getDiagnoses(memberId: string): Promise<Diagnosis[]> {
  return readJSON<Diagnosis[]>(path.join(memberDir(memberId), "diagnoses.json"), []);
}

export async function getMetrics(memberId: string): Promise<Metric[]> {
  return readJSON<Metric[]>(path.join(memberDir(memberId), "metrics.json"), []);
}

export async function getDocuments(memberId: string): Promise<DocumentMeta[]> {
  return readJSON<DocumentMeta[]>(path.join(memberDir(memberId), "documents.json"), []);
}

const CATEGORY_FOLDERS = ["Анализы", "Заключения", "Выписки", "Снимки", "_inbox"];

/** Create a new family member: append to family.json and scaffold their folder. */
export async function addMember(input: Omit<FamilyMember, "id">): Promise<FamilyMember> {
  const members = await listMembers();
  const id = `member-${Date.now().toString(36)}`;
  const member: FamilyMember = { id, ...input };
  await writeJSON(path.join(DATA_DIR, "family.json"), [...members, member]);

  const dir = memberDir(id);
  await Promise.all(CATEGORY_FOLDERS.map((f) => fs.mkdir(path.join(dir, f), { recursive: true })));
  await Promise.all([
    writeJSON(path.join(dir, "labs.json"), []),
    writeJSON(path.join(dir, "diagnoses.json"), []),
    writeJSON(path.join(dir, "metrics.json"), []),
    writeJSON(path.join(dir, "documents.json"), []),
  ]);
  return member;
}

// ---- Chat transcript persistence (data/<member>/chat.json) ----

const CHAT_FILE = "chat.json";
const CHAT_CAP = 600; // keep the transcript bounded

/** Map an SSE conversationId ("conv-<memberId>") back to its member id. */
export function memberIdFromConversation(conversationId: string): string {
  return conversationId.replace(/^conv-/, "");
}

// Per-member write lock so the user-message append (/api/chat) and the
// assistant-message append (/api/ingest) can't clobber each other's read-modify-write.
const chatLocks = new Map<string, Promise<unknown>>();
function withChatLock<T>(memberId: string, fn: () => Promise<T>): Promise<T> {
  const prev = chatLocks.get(memberId) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  chatLocks.set(
    memberId,
    next.catch(() => {}),
  );
  return next;
}

export async function getChatHistory(memberId: string): Promise<ChatStoredItem[]> {
  return readJSON<ChatStoredItem[]>(path.join(memberDir(memberId), CHAT_FILE), []);
}

export async function appendChatItems(memberId: string, items: ChatStoredItem[]): Promise<void> {
  if (items.length === 0) return;
  await withChatLock(memberId, async () => {
    const file = path.join(memberDir(memberId), CHAT_FILE);
    const current = await readJSON<ChatStoredItem[]>(file, []);
    const merged = [...current, ...items].slice(-CHAT_CAP);
    await writeJSON(file, merged);
  });
}

export async function clearChatHistory(memberId: string): Promise<void> {
  await withChatLock(memberId, async () => {
    await writeJSON(path.join(memberDir(memberId), CHAT_FILE), []);
  });
}

export async function getMemberBundle(memberId: string): Promise<MemberBundle | null> {
  const member = await getMember(memberId);
  if (!member) return null;
  const [diagnoses, labs, metrics, documents] = await Promise.all([
    getDiagnoses(memberId),
    getLabs(memberId),
    getMetrics(memberId),
    getDocuments(memberId),
  ]);
  return { member, diagnoses, labs, metrics, documents };
}
