import type { NextRequest } from "next/server";
import { AUTH_COOKIE, hashPin } from "@/lib/auth";
import { HEALTH_PIN } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { pin?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  if (!body.pin || body.pin !== HEALTH_PIN) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const token = await hashPin(HEALTH_PIN);
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${AUTH_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`,
  );
  return res;
}
