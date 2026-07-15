// PIN auth helpers. Uses the Web Crypto API so the same code runs in both the
// edge middleware and Node route handlers.
export const AUTH_COOKIE = "health_auth";

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`health-salt:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
