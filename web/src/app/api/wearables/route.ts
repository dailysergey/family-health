import type { NextRequest } from "next/server";
import { getMember, getWearables } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/wearables?member=<id>&days=30
// Returns the last N daily rollups synced by ghealth for the member,
// plus lightweight aggregates the dashboard can render without recomputing.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const memberId = url.searchParams.get("member");
  const days = Math.min(180, Math.max(1, Number(url.searchParams.get("days")) || 30));

  if (!memberId) return new Response("member required", { status: 400 });
  const member = await getMember(memberId);
  if (!member) return new Response("member not found", { status: 404 });

  const rollups = await getWearables(memberId, days);
  const nz = (arr: (number | undefined)[]) => arr.filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const steps = nz(rollups.map((r) => r.steps));
  const hr = nz(rollups.map((r) => r.heartRateAvg));
  const kcal = nz(rollups.map((r) => r.activeEnergyKcal));
  const sleep = nz(rollups.map((r) => r.sleepMinutes));

  const summary = {
    days: rollups.length,
    stepsAvg: steps.length ? Math.round(steps.reduce((a, b) => a + b, 0) / steps.length) : null,
    stepsLast: steps.length ? steps[steps.length - 1] : null,
    heartRateAvg: hr.length ? Math.round((hr.reduce((a, b) => a + b, 0) / hr.length) * 10) / 10 : null,
    activeKcalAvg: kcal.length ? Math.round(kcal.reduce((a, b) => a + b, 0) / kcal.length) : null,
    sleepMinutesAvg: sleep.length ? Math.round(sleep.reduce((a, b) => a + b, 0) / sleep.length) : null,
  };

  return Response.json({
    member: { id: member.id, name: member.name, wearables: member.wearables ?? null },
    summary,
    daily: rollups,
  });
}
