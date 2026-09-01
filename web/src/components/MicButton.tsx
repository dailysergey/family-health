"use client";

import { useState, useRef, useCallback } from "react";

type State = "idle" | "recording" | "transcribing";

interface MicButtonProps {
  onTranscription: (text: string) => void;
}

export function MicButton({ onTranscription }: MicButtonProps) {
  const [state, setState] = useState<State>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveCleanupRef = useRef<(() => void) | null>(null);

  const handleTranscribe = useCallback(
    async (blob: Blob) => {
      setState("transcribing");
      try {
        const fd = new FormData();
        fd.append("audio", blob, "recording.webm");
        const res = await fetch("/api/asr/transcribe", { method: "POST", body: fd });
        if (!res.ok) throw new Error("ASR error");
        const data = (await res.json()) as { text?: string };
        if (data.text) onTranscription(data.text);
      } catch (err) {
        console.error("Transcription failed:", err);
      } finally {
        setState("idle");
      }
    },
    [onTranscription],
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
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
        void handleTranscribe(new Blob(chunksRef.current, { type: "audio/webm" }));
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setState("recording");

      if (canvasRef.current) {
        waveCleanupRef.current = createWaveform(stream, canvasRef.current);
      }
    } catch (err) {
      console.error("Mic access denied:", err);
    }
  }, [handleTranscribe]);

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
    state === "recording"
      ? "var(--color-status-high)"
      : state === "transcribing"
        ? "var(--color-brand)"
        : "var(--color-text-tertiary)";

  return (
    <button
      type="button"
      aria-label={
        state === "recording" ? "Остановить запись" : state === "transcribing" ? "Транскрибирую…" : "Голосовой ввод"
      }
      onClick={toggle}
      disabled={state === "transcribing"}
      className="relative h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full transition-all duration-150"
      style={{
        color,
        background: state === "recording" ? "rgba(255,59,48,0.1)" : "transparent",
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
      ctx.fillStyle = "rgba(255,59,48,0.85)";
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
