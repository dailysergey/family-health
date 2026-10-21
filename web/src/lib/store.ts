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

// ---- Wearables (ghealth-synced daily rollups) ----

export type WearablesDaily = {
  date: string;
  steps?: number;
  stepsGoal?: number;
  heartRateAvg?: number;
  heartRateMin?: number;
  heartRateMax?: number;
  activeEnergyKcal?: number;
  activeZoneMinutes?: number;
  sleepMinutes?: number;
  sleepEfficiency?: number;
  restingHeartRate?: number;
  hrvRmssd?: number;
  spo2?: number;
  vo2max?: number;
  sleepScore?: number; // Oura sleep score 0–100
  readinessScore?: number; // Oura readiness 0–100
  sleepStages?: { deep: number; rem: number; light: number; awake: number }; // minutes
};

/** Flatten a raw ghealth rollup file into a compact daily summary. */
function normalizeWearables(raw: unknown, date: string): WearablesDaily {
  const r = raw as Record<string, unknown>;

  const num = (v: unknown): number | undefined => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : undefined;
  };

  // pickPoint: ghealth nested format {dataPoints:[{...}]} or flat array
  // Returns undefined for plain numbers/strings (handled separately as flat fields)
  const pickPoint = <T = Record<string, unknown>>(field: string): T | undefined => {
    const v = r?.[field];
    if (v === undefined || v === null || typeof v !== "object") return undefined;
    if (Array.isArray(v)) return v[0] as T;
    return (v as { dataPoints?: T[] }).dataPoints?.[0];
  };

  // flat: read oura flat numeric field, fallback to ghealth nested
  const flat = (
    flatKey: string,
    nestedKey: string,
    ...props: string[]
  ): number | undefined => {
    const direct = num(r?.[flatKey]);
    if (direct != null) return direct;
    const pt = pickPoint<Record<string, unknown>>(nestedKey);
    for (const p of props) {
      const v = num(pt?.[p]);
      if (v != null) return v;
    }
    return undefined;
  };

  // Steps: oura writes flat number, ghealth writes nested object — check both
  const stepsFlat = num(r?.steps);  // oura: steps = 7234
  const stepsNested = pickPoint<Record<string, unknown>>("steps");  // ghealth: steps.dataPoints[0]
  const stepsVal = stepsFlat ?? num(stepsNested?.countSum) ?? num(stepsNested?.total);

  // stepsGoal: ghealth может писать в steps.goal
  const stepsObjGoal = typeof r?.steps === "object" && r?.steps !== null && !Array.isArray(r?.steps)
    ? num((r.steps as Record<string, unknown>).goal)
    : undefined;
  const stepsGoal = stepsObjGoal ?? num(stepsNested?.goal);

  // ghealth nested fields
  const hr  = pickPoint<Record<string, unknown>>("heart_rate");
  const aek = pickPoint<Record<string, unknown>>("active_energy_kcal");
  const azm = pickPoint<Record<string, unknown>>("active_zone_minutes");
  const rhr = pickPoint<Record<string, unknown>>("resting_heart_rate");
  const hrv = pickPoint<Record<string, unknown>>("hrv");
  const spo2pt = pickPoint<Record<string, unknown>>("spo2");
  const vo2 = pickPoint<Record<string, unknown>>("vo2max");
  const sleepList = (r?.sleep as { dataPoints?: Record<string, unknown>[] })?.dataPoints ?? [];

  const sleepMinutes = (() => {
    // oura flat (sleepMinutes) takes priority
    const ouraFlat = num(r?.sleepMinutes);
    if (ouraFlat != null) return ouraFlat;
    // Several sources (Oura + phone) may report the same night: count
    // time-overlapping sessions once, keeping the longest; naps still add up.
    const sessions = sleepList
      .map((s) => ({
        min: num(s?.minutesAsleep) ?? num(s?.totalMinutesAsleep),
        start: Date.parse(String(s?.start ?? "")),
        end: Date.parse(String(s?.end ?? "")),
      }))
      .filter((s): s is { min: number; start: number; end: number } => s.min !== undefined)
      .sort((a, b) => b.min - a.min);
    const kept: typeof sessions = [];
    for (const s of sessions) {
      const overlaps = kept.some((k) => s.start < k.end && k.start < s.end);
      if (!overlaps) kept.push(s);
    }
    return kept.length ? kept.reduce((acc, s) => acc + s.min, 0) : undefined;
  })();

  const sleepEfficiency = (() => {
    const ouraFlat = num(r?.sleepEfficiency);
    if (ouraFlat != null) return ouraFlat;
    if (sleepList.length === 0) return undefined;
    const s = sleepList[0];
    const explicit = num(s?.efficiency);
    if (explicit != null) return explicit;
    const asleep = num(s?.minutesAsleep) ?? num(s?.totalMinutesAsleep);
    const awake  = num(s?.minutesAwake) ?? 0;
    const total  = num(s?.totalMinutes) ?? (asleep != null ? asleep + awake : undefined);
    if (asleep != null && total != null && total > 0) {
      return Math.round((asleep / total) * 100);
    }
    return undefined;
  })();

  // Stages of the main (longest) staged sleep session
  const sleepStages = (() => {
    let best: { deep: number; rem: number; light: number; awake: number } | undefined;
    let bestTotal = 0;
    for (const s of sleepList) {
      const st = s?.stageMinutes as Record<string, unknown> | undefined;
      if (!st) continue;
      const stages = {
        deep: num(st.DEEP) ?? 0,
        rem: num(st.REM) ?? 0,
        light: num(st.LIGHT) ?? 0,
        awake: num(st.AWAKE) ?? 0,
      };
      const total = stages.deep + stages.rem + stages.light;
      if (total > bestTotal) {
        // Some sources report stage totals that exceed the session; scale
        // asleep stages to the reported time asleep so the labels add up.
        const asleep = num(s?.minutesAsleep);
        const k = asleep && total > asleep ? asleep / total : 1;
        best = {
          deep: Math.round(stages.deep * k),
          rem: Math.round(stages.rem * k),
          light: Math.round(stages.light * k),
          awake: num(s?.minutesAwake) ?? stages.awake,
        };
        bestTotal = total;
      }
    }
    return best;
  })();

  return {
    date,
    sleepScore:       num(r?.sleepScore),
    readinessScore:   num(r?.readinessScore),
    sleepStages,
    steps:            stepsVal,
    stepsGoal,
    // heartRate: oura flat keys take priority over ghealth nested
    heartRateAvg:     num(r?.heartRateAvg)     ?? num(hr?.beatsPerMinuteAvg),
    heartRateMin:     num(r?.heartRateMin)     ?? num(hr?.beatsPerMinuteMin),
    heartRateMax:     num(r?.heartRateMax)     ?? num(hr?.beatsPerMinuteMax),
    // calories: oura flat `activeEnergyKcal`, ghealth `active_energy_kcal.dataPoints[0].kcalSum`
    activeEnergyKcal: flat("activeEnergyKcal", "active_energy_kcal", "kcalSum"),
    // AZM: oura flat, ghealth three-zone breakdown
    activeZoneMinutes: (() => {
      const ouraFlat = num(r?.activeZoneMinutes);
      if (ouraFlat != null) return ouraFlat;
      const direct = num(azm?.activeZoneMinutesSum) ?? num(azm?.total);
      if (direct != null) return direct;
      const fatBurn = num(azm?.sumInFatBurnHeartZone) ?? 0;
      const cardio  = num(azm?.sumInCardioHeartZone)  ?? 0;
      const peak    = num(azm?.sumInPeakHeartZone)    ?? 0;
      const sum = fatBurn + cardio + peak;
      return sum > 0 ? sum : undefined;
    })(),
    sleepMinutes,
    sleepEfficiency,
    // rhr: oura flat, ghealth nested beatsPerMinute
    restingHeartRate: flat("restingHeartRate", "resting_heart_rate", "beatsPerMinute"),
    // hrv: oura flat `hrvRmssd`, ghealth `hrv.dataPoints[0].averageHeartRateVariabilityMilliseconds`
    hrvRmssd:         num(r?.hrvRmssd) ?? num(hrv?.averageHeartRateVariabilityMilliseconds) ?? num(hrv?.rmssd),
    // spo2: oura flat, ghealth nested averagePercentage
    spo2:             flat("spo2", "spo2", "averagePercentage", "percentage"),
    vo2max:           num(vo2?.vo2Max) ?? num(vo2?.value),
  };
}

/** Read the last `days` daily rollup files for a member (chronological). */
export async function getWearables(memberId: string, days = 30): Promise<WearablesDaily[]> {
  const dir = path.join(memberDir(memberId), "wearables");
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const dayFiles = entries
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .slice(-days);

  return Promise.all(
    dayFiles.map(async (f) => {
      const date = f.replace(/\.json$/, "");
      const raw = await readJSON<unknown>(path.join(dir, f), {});
      return normalizeWearables(raw, date);
    }),
  );
}

export interface MealItem {
  name: string;
  grams?: number;
  kcal: number;
  protein_g?: number;
  fat_g?: number;
  carbs_g?: number;
  note?: string;
}

export interface MealEntry {
  name: string;
  time?: string;
  date: string;
  logged_at: string;
  items: MealItem[];
}

export interface MealDay {
  date: string;
  meals: MealEntry[];
  totals: { kcal: number; protein_g: number; fat_g: number; carbs_g: number };
}

export async function getMeals(memberId: string, days = 7): Promise<MealDay[]> {
  const dir = path.join(memberDir(memberId), "meals");
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const dayFiles = entries
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .slice(-days);

  return Promise.all(
    dayFiles.map(async (f) => {
      const date = f.replace(/\.json$/, "");
      const meals = await readJSON<MealEntry[]>(path.join(dir, f), []);
      const totals = meals.reduce(
        (acc, m) => {
          for (const item of m.items ?? []) {
            acc.kcal      += item.kcal      ?? 0;
            acc.protein_g += item.protein_g ?? 0;
            acc.fat_g     += item.fat_g     ?? 0;
            acc.carbs_g   += item.carbs_g   ?? 0;
          }
          return acc;
        },
        { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
      );
      return { date, meals, totals };
    }),
  );
}

const CATEGORY_FOLDERS = ["Анализы", "Заключения", "Выписки", "Снимки", "_inbox"];

/** Update fields of an existing family member in family.json. */
export async function updateMember(memberId: string, updates: Partial<FamilyMember>): Promise<void> {
  const members = await listMembers();
  const idx = members.findIndex((m) => m.id === memberId);
  if (idx < 0) throw new Error(`Member ${memberId} not found`);
  members[idx] = { ...members[idx], ...updates };
  await writeJSON(path.join(DATA_DIR, "family.json"), members);
}

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
