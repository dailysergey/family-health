// Shared data model for the family health dashboard.
// These shapes are the contract between the Next.js app (reads) and the
// health-ui MCP server (writes). Keep both sides in sync.

export type Accent =
  | "activity"
  | "heart"
  | "mindfulness"
  | "nutrition"
  | "sleep"
  | "medications"
  | "body"
  | "labs"
  | "reproductive"
  | "hearing";

export type LabStatus = "normal" | "high" | "low" | "borderline" | "critical";

export interface FamilyMember {
  id: string;
  name: string;
  relation: string; // «Папа», «Мама», «Сын»…
  birthDate: string; // ISO date
  sex: "male" | "female";
  accent: Accent;
}

export interface LabResult {
  id: string;
  name: string; // «Гемоглобин»
  value: number | string; // число или качественный результат («обнаружено», «< 0,9»)
  unit: string; // «г/л»
  refLow?: number;
  refHigh?: number;
  refText?: string; // free-form reference when numeric range is absent
  status: LabStatus;
  date: string; // ISO date
  docId?: string;
  category?: Accent; // domain color for the card accent
  group?: string; // medical panel, e.g. «Общий анализ крови», «Биохимия крови», «Обследования»
  history?: { date: string; value: number }[];
}

export interface Diagnosis {
  id: string;
  title: string;
  icd10?: string;
  status: "active" | "remission" | "resolved";
  severity: LabStatus; // reuse status palette for severity pill
  description: string;
  doctor?: string;
  date: string; // ISO date
  medications: string[];
  category?: Accent;
}

export interface Metric {
  id: string;
  name: string; // «Артериальное давление»
  category: Accent;
  unit: string;
  series: { date: string; value: number }[];
}

export interface DocumentMeta {
  id: string;
  filename: string;
  path: string; // path relative to the member folder
  category: string; // folder name, e.g. «Анализы»
  sizeBytes: number;
  addedAt: string; // ISO datetime
  summary?: string;
  status: "processing" | "done";
}

export interface MemberBundle {
  member: FamilyMember;
  diagnoses: Diagnosis[];
  labs: LabResult[];
  metrics: Metric[];
  documents: DocumentMeta[];
}

// One persisted entry of a member's chat transcript (data/<member>/chat.json).
// Widget props are stored verbatim so the same WidgetRenderer can replay them.
export type ChatStoredItem =
  | { id: string; kind: "text"; role: "user" | "assistant"; text: string; ts: number }
  | { id: string; kind: "widget"; widgetType: string; props: unknown; ts: number };

export const MEMBER_FILES = {
  diagnoses: "diagnoses.json",
  labs: "labs.json",
  metrics: "metrics.json",
  documents: "documents.json",
  profile: "profile.json",
} as const;

export type MemberFile = keyof typeof MEMBER_FILES;
