// POST /api/asr/transcribe
// Проксирует аудио на ASR-сервер (обходит CORS + mixed content).
// Оба сервера принимают multipart-поле `audio`. Порядок: сначала тот, что
// отвечает стабильно; keendaily (только https — http отдаёт 302, и fetch
// превращает POST в GET) — запасной.
const SERVERS = [
  { url: "https://asr.muravskiy.com/api/transcribe", extra: { model_id: "gigaam-rnnt" }, timeoutMs: 90_000 },
  { url: "https://asr.keendaily.keenetic.pro/api/transcribe", extra: {}, timeoutMs: 60_000 },
];

export async function POST(req: Request): Promise<Response> {
  const formData = await req.formData();
  const audio = formData.get("audio");
  if (!(audio instanceof Blob)) return Response.json({ error: "no audio" }, { status: 400 });
  const filename = audio instanceof File && audio.name ? audio.name : "recording.webm";

  const errors: string[] = [];
  for (const s of SERVERS) {
    try {
      const body = new FormData();
      body.append("audio", audio, filename);
      for (const [k, v] of Object.entries(s.extra)) body.append(k, v);
      const res = await fetch(s.url, { method: "POST", body, signal: AbortSignal.timeout(s.timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = (await res.json()) as { text?: string };
      return Response.json({ text: (data.text ?? "").trim() });
    } catch (err) {
      errors.push(`${new URL(s.url).host}: ${String(err)}`);
    }
  }
  console.error("[asr] all servers failed:", errors.join(" | "));
  return Response.json({ error: "Распознавание речи недоступно" }, { status: 502 });
}
