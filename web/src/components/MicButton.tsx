"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type State = "idle" | "recording" | "transcribing";

// Safari/iOS records mp4/aac, Chrome/Firefox webm/opus; pick what the browser can do.
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

function extFor(mime: string): string {
  if (mime.includes("mp4") || mime.includes("aac")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

interface MicButtonProps {
  onTranscription: (text: string) => void;
}

export function MicButton({ onTranscription }: MicButtonProps) {
  const [state, setState] = useState<State>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveCleanupRef = useRef<(() => void) | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fail = useCallback((msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  }, []);

  const handleTranscribe = useCallback(
    async (blob: Blob) => {
      setState("transcribing");
      try {
        const fd = new FormData();
        fd.append("audio", blob, `recording.${extFor(blob.type)}`);
        const res = await fetch("/api/asr/transcribe", { method: "POST", body: fd });
        const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? `ASR ${res.status}`);
        if (data.text) onTranscription(data.text);
        else fail("Речь не распознана — попробуйте ещё раз");
      } catch (err) {
        console.error("Transcription failed:", err);
        fail("Не удалось распознать речь");
      } finally {
        setState("idle");
      }
    },
    [onTranscription, fail],
  );

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      fail("Браузер не поддерживает запись звука");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error("Mic access denied:", err);
      fail("Нет доступа к микрофону — разрешите его в настройках браузера");
      return;
    }
    try {
      const mime = pickMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (waveCleanupRef.current) {
          waveCleanupRef.current();
          waveCleanupRef.current = null;
        }
        streamRef.current = null;
        void handleTranscribe(new Blob(chunksRef.current, { type: recorder.mimeType || mime || "audio/webm" }));
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      streamRef.current = stream;
      setState("recording");
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      console.error("MediaRecorder failed:", err);
      fail("Не удалось начать запись");
    }
  }, [handleTranscribe, fail]);

  // The waveform canvas only exists once the "recording" state has rendered.
  useEffect(() => {
    if (state !== "recording" || !canvasRef.current || !streamRef.current || waveCleanupRef.current) return;
    try {
      waveCleanupRef.current = createWaveform(streamRef.current, canvasRef.current);
    } catch {
      /* waveform is decorative */
    }
  }, [state]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, [state]);

  const toggle = useCallback(() => {
    if (state === "recording") stopRecording();
    else if (state === "idle") void startRecording();
  }, [state, startRecording, stopRecording]);

  const color =
    error
      ? "var(--color-accent-700)"
      : state === "recording"
      ? "var(--color-status-high)"
      : state === "transcribing"
        ? "var(--color-brand)"
        : "var(--color-text-tertiary)";

  return (
    <button
      type="button"
      aria-label={
        error ?? (state === "recording" ? "Остановить запись" : state === "transcribing" ? "Транскрибирую…" : "Голосовой ввод")
      }
      title={error ?? undefined}
      onClick={toggle}
      disabled={state === "transcribing"}
      className="relative h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full transition-all duration-150"
      style={{
        color,
        background: state === "recording" ? "var(--color-accent-100)" : "transparent",
      }}
    >
      {state === "transcribing" ? (
        /* Spinner */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" style={{ animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </svg>
      ) : state === "recording" ? (
        /* Stop square */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        /* Mic icon */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="1" width="6" height="12" rx="3" />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
          <line x1="12" y1="22" x2="12" y2="18" />
        </svg>
      )}
      {/* Waveform canvas (shown while recording) */}
      {state === "recording" && (
        <canvas
          ref={canvasRef}
          width={28}
          height={28}
          className="absolute inset-0 pointer-events-none"
          style={{ opacity: 0.8 }}
        />
      )}
      {error && (
        <span
          role="status"
          className="absolute bottom-full right-0 mb-2 w-max max-w-[240px] px-3 py-2 rounded-[12px] text-xs text-left leading-snug z-30"
          style={{ background: "var(--color-text)", color: "var(--color-neutral-100)", boxShadow: "var(--shadow-md)" }}
        >
          {error}
        </span>
      )}
    </button>
  );
}

function createWaveform(stream: MediaStream, canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d")!;
  const audioCtx = new AudioContext();
  const analyser = audioCtx.createAnalyser();
  const source = audioCtx.createMediaStreamSource(stream);
  analyser.fftSize = 32;
  analyser.smoothingTimeConstant = 0.6;
  source.connect(analyser);

  const data = new Uint8Array(analyser.frequencyBinCount);
  const bars = 5;
  let running = true;

  function draw() {
    if (!running) return;
    requestAnimationFrame(draw);
    analyser.getByteFrequencyData(data);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barW = 3;
    const gap = 2;
    const total = bars * barW + (bars - 1) * gap;
    let x = (canvas.width - total) / 2;

    for (let i = 0; i < bars; i++) {
      const idx = Math.floor((i / bars) * data.length * 0.6);
      const level = data[idx] / 255;
      const h = 4 + Math.round(level * 14);
      const y = (canvas.height - h) / 2;
      ctx.fillStyle = getComputedStyle(canvas).color || "#8c491a";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, barW, h, 1.5);
      else ctx.rect(x, y, barW, h);
      ctx.fill();
      x += barW + gap;
    }
  }
  draw();

  return () => {
    running = false;
    void audioCtx.close();
  };
}
