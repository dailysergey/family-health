import type { NextRequest } from "next/server";
import { getMember, getWearables } from "@/lib/store";
import { calculateReadiness } from "@/lib/readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/readiness?member=<id>&days=30
// Returns per-day readiness scores + component breakdown.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const memberId = url.searchParams.get("member");
  const days = Math.min(180, Math.max(1, Number(url.searchParams.get("days")) || 30));

  if (!memberId) return new Response("member required", { status: 400 });
  const member = await getMember(memberId);
  if (!member) return new Response("member not found", { status: 404 });

  const rollups = await getWearables(memberId, days);

  const daily = rollups.map((r) => ({
    date: r.date,
    score: calculateReadiness(r),
    components: {
      hrv: r.hrvRmssd ?? null,
      rhr: r.restingHeartRate ?? null,
      sleepEfficiency: r.sleepEfficiency ?? null,
      spo2: r.spo2 ?? null,
    },
  }));

  // Последние значения для «сегодняшних» колец
  const latest = daily[daily.length - 1] ?? null;

  return Response.json({
    member: { id: member.id, name: member.name },
    latest,
    daily,
  });
}
