// POST /api/asr/transcribe
// Проксирует аудио на ASR-сервер (обходит CORS + mixed content)
export async function POST(req: Request): Promise<Response> {
  const formData = await req.formData();
  const audio = formData.get("audio") as Blob | null;
  if (!audio) return Response.json({ error: "no audio" }, { status: 400 });

  const fd = new FormData();
  fd.append("audio", audio, "recording.webm");

  const PRIMARY = "http://asr.keendaily.keenetic.pro/api/transcribe";
  const FALLBACK = "https://asr.muravskiy.com/api/transcribe";

  async function tryAsr(url: string, isMain: boolean): Promise<Response> {
    const body = new FormData();
    body.append(isMain ? "audio" : "file", audio!, isMain ? "recording.webm" : "recording.ogg");
    if (!isMain) body.append("model_id", "gigaam-rnnt");
    return fetch(url, { method: "POST", body, signal: AbortSignal.timeout(90_000) });
  }

  let res: Response;
  try {
    res = await tryAsr(PRIMARY, true);
    if (!res.ok) throw new Error(`Primary ${res.status}`);
  } catch {
    res = await tryAsr(FALLBACK, false);
  }

  const data = (await res.json()) as { text?: string };
  return Response.json({ text: data.text ?? null });
}
