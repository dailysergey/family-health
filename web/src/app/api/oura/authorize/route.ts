import { NextResponse } from "next/server";

// GET /api/oura/authorize?member=primary
// Redirects to Oura OAuth consent screen
export async function GET(req: Request) {
  const url = new URL(req.url);
  const memberId = (url.searchParams.get("member") ?? "primary").replace(/[^a-zA-Z0-9_-]/g, "");

  const clientId = process.env.OURA_CLIENT_ID;
  const redirectUri = process.env.OURA_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "Oura OAuth not configured" }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "email personal daily heartrate workout tag session",
    state: memberId,
  });

  return NextResponse.redirect(
    `https://cloud.ouraring.com/oauth/authorize?${params.toString()}`
  );
}
