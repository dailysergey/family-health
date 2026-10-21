import type { NextRequest } from "next/server";
import { getMember, getMeals, memberDir } from "@/lib/store";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface NutritionGoals {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  goal?: string;
}

async function getNutritionGoals(memberId: string): Promise<NutritionGoals | null> {
  try {
    const raw = await fs.readFile(path.join(memberDir(memberId), "nutrition-goals.json"), "utf8");
    return JSON.parse(raw) as NutritionGoals;
  } catch {
    return null;
  }
}

// GET /api/meals?member=<id>&days=7
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const memberId = url.searchParams.get("member");
  const days = Math.min(30, Math.max(1, Number(url.searchParams.get("days")) || 7));

  if (!memberId) return new Response("member required", { status: 400 });
  const member = await getMember(memberId);
  if (!member) return new Response("member not found", { status: 404 });

  const [data, goals] = await Promise.all([
    getMeals(memberId, days),
    getNutritionGoals(memberId),
  ]);

  return Response.json({ member: { id: member.id, name: member.name }, days: data, goals });
}
