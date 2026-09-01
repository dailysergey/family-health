import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.HEALTH_DATA_DIR ?? "/opt/health/data";

// GET /api/oura/callback?code=...&state=<memberId>
// Exchanges code for tokens and stores them
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const memberId = (url.searchParams.get("state") ?? "primary").replace(/[^a-zA-Z0-9_-]/g, "");
  const error = url.searchParams.get("error");

  if (error) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:2rem;background:#1c1c1e;color:#fff">
        <h2>❌ Ошибка авторизации Oura</h2>
        <p>${error}: ${url.searchParams.get("error_description") ?? ""}</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  if (!code) {
    return NextResponse.json({ error: "no code" }, { status: 400 });
  }

  const clientId     = process.env.OURA_CLIENT_ID!;
  const clientSecret = process.env.OURA_CLIENT_SECRET!;
  const redirectUri  = process.env.OURA_REDIRECT_URI!;

  // Exchange code → tokens
  const tokenRes = await fetch("https://api.ouraring.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:2rem;background:#1c1c1e;color:#fff">
        <h2>❌ Ошибка получения токена</h2>
        <pre>${body}</pre>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };

  // Сохраняем токены
  const tokenFile = path.join(DATA_DIR, memberId, "oura-tokens.json");
  fs.mkdirSync(path.dirname(tokenFile), { recursive: true });
  fs.writeFileSync(
    tokenFile,
    JSON.stringify(
      {
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at:    Date.now() + tokens.expires_in * 1000,
        member_id:     memberId,
        connected_at:  new Date().toISOString(),
      },
      null,
      2
    )
  );

  return new NextResponse(
    `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Oura подключён</title></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:2rem;background:#1c1c1e;color:#fff;text-align:center;margin:0">
      <div style="margin-top:4rem;max-width:360px;margin-left:auto;margin-right:auto">
        <div style="font-size:3rem">&#x1F49A;</div>
        <h2 style="margin:1rem 0;font-size:1.5rem">Oura Ring подключён!</h2>
        <p style="color:#8e8e93;line-height:1.6">Аккаунт <strong style="color:#fff">${memberId}</strong> авторизован.<br>
        Откройте приложение Oura на телефоне, чтобы синхронизировать данные с кольца.</p>
        <a href="/" style="display:inline-block;margin-top:2rem;padding:0.75rem 1.5rem;
          background:#ff3a5c;color:#fff;border-radius:12px;text-decoration:none;font-weight:600;font-size:1rem">
          Открыть дашборд
        </a>
      </div>
    </body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
