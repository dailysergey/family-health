"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Accent, FamilyMember } from "@/lib/types";
import { accentVar, tint } from "@/lib/ui";

const ACCENTS: Accent[] = [
  "medications",
  "reproductive",
  "nutrition",
  "heart",
  "sleep",
  "body",
  "labs",
  "activity",
];

const field =
  "w-full h-11 px-3 rounded-inner bg-bg-tertiary text-callout text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-brand";

export function AddMemberDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [accent, setAccent] = useState<Accent>("medications");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, relation, birthDate, sex, accent }),
      });
      if (!res.ok) throw new Error(await res.text());
      const member: FamilyMember = await res.json();
      onCreated(member.id);
    } catch {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-bg-elevated rounded-card shadow-modal p-5 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-title-3 text-text-primary">Новый член семьи</h3>
          <button type="button" onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <input className={field} placeholder="Имя и фамилия" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <input className={field} placeholder="Кем приходится (напр. Дочь)" value={relation} onChange={(e) => setRelation(e.target.value)} />
          <div className="flex gap-3">
            <input type="date" className={`${field} flex-1`} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            <select className={`${field} w-28`} value={sex} onChange={(e) => setSex(e.target.value as "male" | "female")}>
              <option value="male">М</option>
              <option value="female">Ж</option>
            </select>
          </div>

          <div>
            <div className="text-caption-1 text-text-tertiary mb-2">Цвет профиля</div>
            <div className="flex gap-2 flex-wrap">
              {ACCENTS.map((a) => {
                const color = accentVar(a);
                const selected = a === accent;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAccent(a)}
                    className="w-8 h-8 rounded-full transition-transform"
                    style={{
                      background: `linear-gradient(135deg, ${color}, ${tint(color, 70)})`,
                      outline: selected ? `2px solid ${color}` : "none",
                      outlineOffset: 2,
                      transform: selected ? "scale(1.05)" : "none",
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!name.trim() || busy}
          className="w-full h-11 mt-5 rounded-inner bg-brand text-text-on-accent text-headline disabled:opacity-40 transition-opacity"
        >
          {busy ? "Создаём…" : "Добавить"}
        </button>
      </div>
    </div>
  );
}
