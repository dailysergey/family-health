import type { NextRequest } from "next/server";
import { addMember, listMembers } from "@/lib/store";
import type { Accent, FamilyMember } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ACCENTS: Accent[] = [
  "activity",
  "heart",
  "mindfulness",
  "nutrition",
  "sleep",
  "medications",
  "body",
  "labs",
  "reproductive",
  "hearing",
];

export async function GET() {
  return Response.json(await listMembers());
}

export async function POST(req: NextRequest) {
  let body: Partial<FamilyMember>;
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return new Response("name required", { status: 400 });

  const member = await addMember({
    name,
    relation: body.relation?.trim() || "Член семьи",
    birthDate: body.birthDate || "",
    sex: body.sex === "female" ? "female" : "male",
    accent: ACCENTS.includes(body.accent as Accent) ? (body.accent as Accent) : "activity",
  });

  return Response.json(member, { status: 201 });
}
