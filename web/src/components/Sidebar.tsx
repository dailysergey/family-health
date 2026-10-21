"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Heart, Moon, Smartphone, Sun, UserPlus } from "lucide-react";
import { useTheme } from "next-themes";
import type { Accent, FamilyMember } from "@/lib/types";
import { accentVar, ageLabel, initials } from "@/lib/ui";
import { AddMemberDialog } from "./AddMemberDialog";
import { PushPrompt } from "./PushPrompt";

function Avatar({ member, size = 40 }: { member: FamilyMember; size?: number }) {
  return (
    <span
      className="inline-grid place-items-center rounded-full font-bold shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.35,
        background: accentVar(member.accent),
        color: "var(--color-neutral-100)",
      }}
    >
      {initials(member.name)}
    </span>
  );
}

function profilesLabel(n: number) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} профиль`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return `${n} профиля`;
  return `${n} профилей`;
}

export function Sidebar({ members, activeId }: { members: FamilyMember[]; activeId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { resolvedTheme, setTheme } = useTheme();
  const [adding, setAdding] = useState(false);
  const dark = resolvedTheme === "dark";

  const select = (id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("member", id);
    router.push(`/?${next.toString()}`);
  };

  return (
    <aside
      className="w-[220px] lg:w-[268px] shrink-0 h-screen flex flex-col gap-6 px-4 pt-7 pb-5 overflow-y-auto"
      style={{ background: "var(--color-surface)" }}
    >
      <div className="flex items-center gap-3 px-2">
        <span
          className="w-10 h-10 rounded-full grid place-items-center shrink-0"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          <Heart size={20} strokeWidth={2.75} />
        </span>
        <span className="flex flex-col">
          <span className="font-heading text-xl leading-[1.1]">Здоровье семьи</span>
          <span className="text-xs text-muted">{profilesLabel(members.length)}</span>
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        {members.map((m) => {
          const active = m.id === activeId;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => select(m.id)}
              aria-current={active ? "page" : undefined}
              className="w-full flex items-center gap-3 p-2.5 rounded-[16px] text-left transition-colors hover:bg-[var(--color-neutral-200)]"
              style={active ? { background: "var(--color-neutral-100)" } : undefined}
            >
              <Avatar member={m} />
              <span className="flex flex-col min-w-0 flex-1">
                <span className="font-semibold text-sm truncate">{m.name.split(" ").slice(1).join(" ") || m.name}</span>
                <span className="text-xs text-muted truncate">
                  {[m.relation, ageLabel(m.birthDate)].filter(Boolean).join(" · ")}
                </span>
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="btn btn-ghost justify-start mt-1.5 text-[13px] gap-2.5"
          style={{ color: "var(--color-neutral-700)" }}
        >
          <UserPlus size={16} strokeWidth={2.5} />
          Добавить члена семьи
        </button>
      </nav>

      <div className="mt-auto flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => router.push("/settings/wearables")}
          className="btn btn-ghost justify-start gap-2.5 text-[13px]"
        >
          <Smartphone size={16} strokeWidth={2.5} />
          Устройства
        </button>
        <PushPrompt memberId={activeId} />
        <button
          type="button"
          onClick={() => setTheme(dark ? "light" : "dark")}
          className="btn btn-ghost justify-start gap-2.5 text-[13px]"
        >
          {dark ? <Sun size={16} strokeWidth={2.5} /> : <Moon size={16} strokeWidth={2.5} />}
          {dark ? "Светлая тема" : "Тёмная тема"}
        </button>
      </div>

      {adding && (
        <AddMemberDialog
          onClose={() => setAdding(false)}
          onCreated={(id) => {
            setAdding(false);
            select(id);
          }}
        />
      )}
    </aside>
  );
}

export { Avatar };
export const ACCENT_OPTIONS: Accent[] = [
  "medications",
  "reproductive",
  "nutrition",
  "heart",
  "sleep",
  "body",
  "labs",
  "activity",
];
