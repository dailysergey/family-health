import type { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "@/lib/config";
import { getMemberBundle } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Content-Types for the extensions we actually upload.
const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heic",
  ".gif": "image/gif",
};

// Serve a single filed document (Анализы/Заключения/Выписки/Снимки) by id, so
// the chat/dashboard can open PDFs and images directly. Path is resolved
// through documents.json, not from user input — with a defense-in-depth check
// that the resolved absolute path stays inside the member folder.
export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("member");
  const docId = req.nextUrl.searchParams.get("id");
  if (!memberId || !docId) {
    return new Response("member and id required", { status: 400 });
  }

  const bundle = await getMemberBundle(memberId);
  if (!bundle) return new Response("member not found", { status: 404 });

  const doc = bundle.documents.find((d) => d.id === docId);
  if (!doc) return new Response("document not found", { status: 404 });

  const memberRoot = path.resolve(DATA_DIR, memberId);
  const absPath = path.resolve(memberRoot, doc.path);
  if (absPath !== memberRoot && !absPath.startsWith(memberRoot + path.sep)) {
    return new Response("forbidden", { status: 403 });
  }

  let data: Buffer;
  try {
    data = await readFile(absPath);
  } catch {
    return new Response("file missing on disk", { status: 404 });
  }

  const ext = path.extname(absPath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";

  // `inline` so PDFs render in the browser tab; RFC 5987 filename* keeps
  // Cyrillic names intact in Save-As.
  return new Response(data as unknown as BodyInit, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
