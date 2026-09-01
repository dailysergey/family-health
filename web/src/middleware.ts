import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, hashPin } from "@/lib/auth";
import { HEALTH_PIN } from "@/lib/config";

export async function middleware(req: NextRequest) {
  const expected = await hashPin(HEALTH_PIN);
  const token = req.cookies.get(AUTH_COOKIE)?.value;

  if (token === expected) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return new NextResponse("unauthorized", { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

// Protect everything except the login page, the auth endpoint, the MCP ingest
// endpoint (guarded by its own secret), and static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon\\.svg|apple-touch-icon\\.png|manifest\\.json|sw\\.js|login|api/auth|api/ingest|api/oura).*)"],
};
