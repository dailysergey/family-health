"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HeartPulse } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(false);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      router.replace("/");
      router.refresh();
    } else {
      setError(true);
      setPin("");
      setBusy(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-xs bg-bg-secondary rounded-card shadow-card p-7 text-center">
        <span className="w-14 h-14 rounded-full bg-brand inline-flex items-center justify-center mx-auto">
          <HeartPulse size={28} className="text-white" />
        </span>
        <h1 className="text-title-2 text-text-primary mt-4">Здоровье семьи</h1>
        <p className="text-subheadline text-text-tertiary mt-1">Введите PIN-код для входа</p>

        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••"
          className="w-full h-12 mt-5 text-center text-title-2 tracking-[0.5em] tabular bg-bg-tertiary rounded-inner outline-none focus:ring-2 focus:ring-brand"
          style={error ? { boxShadow: "0 0 0 2px var(--color-status-high)" } : undefined}
        />
        {error && <p className="text-footnote text-status-high mt-2">Неверный PIN-код</p>}

        <button
          type="submit"
          disabled={!pin || busy}
          className="w-full h-11 mt-5 rounded-inner bg-brand text-white text-headline disabled:opacity-40 transition-opacity"
        >
          {busy ? "Проверяем…" : "Войти"}
        </button>
      </form>
    </div>
  );
}
