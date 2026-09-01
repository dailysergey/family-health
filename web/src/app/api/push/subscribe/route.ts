import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const SUBS_FILE = path.join(process.env.HEALTH_DATA_DIR ?? "/opt/health/data", "push-subscriptions.json");

function loadSubs(): Record<string, unknown>[] {
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, "utf8")); }
  catch { return []; }
}

function saveSubs(subs: Record<string, unknown>[]) {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subscription, memberId = "primary", action = "subscribe" } = body as {
      subscription: Record<string, unknown>;
      memberId?: string;
      action?: "subscribe" | "unsubscribe";
    };

    if (!subscription?.endpoint) {
      return NextResponse.json({ error: "no subscription" }, { status: 400 });
    }

    const subs = loadSubs();
    const endpoint = String(subscription.endpoint);

    if (action === "unsubscribe") {
      saveSubs(subs.filter((s) => s.endpoint !== endpoint));
      return NextResponse.json({ ok: true, action: "removed" });
    }

    // Upsert по endpoint
    const existing = subs.findIndex((s) => s.endpoint === endpoint);
    const entry = { ...subscription, memberId, subscribedAt: new Date().toISOString() };
    if (existing >= 0) { subs[existing] = entry; }
    else { subs.push(entry); }

    saveSubs(subs);
    return NextResponse.json({ ok: true, total: subs.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { endpoint } = await req.json().catch(() => ({})) as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ error: "no endpoint" }, { status: 400 });
  const subs = loadSubs().filter((s) => s.endpoint !== endpoint);
  saveSubs(subs);
  return NextResponse.json({ ok: true });
}
