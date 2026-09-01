"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Moon, Sun, UserPlus, Smartphone } from "lucide-react";
import { useTheme } from "next-themes";
import type { Accent, FamilyMember } from "@/lib/types";
import { accentVar, ageLabel, initials, tint } from "@/lib/ui";
import { AddMemberDialog } from "./AddMemberDialog";
import { PushPrompt } from "./PushPrompt";

function Avatar({ member, size = 40 }: { member: FamilyMember; size?: number }) {
  const color = accentVar(member.accent);
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-text-on-accent font-medium shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: `linear-gradient(135deg, ${color}, ${tint(color, 70)})`,
      }}
    >
      {initials(member.name)}
    </span>
  );
}

export function Sidebar({ members, activeId }: { members: FamilyMember[]; activeId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [adding, setAdding] = useState(false);

  const select = (id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("member", id);
    router.push(`/?${next.toString()}`);
  };

  return (
    <aside className="w-full md:w-[280px] md:shrink-0 md:h-screen bg-bg-secondary border-b md:border-b-0 md:border-r border-separator flex flex-col">
      <div className="px-5 pt-6 pb-4">
        <div className="text-title-2 text-text-primary">Здоровье семьи</div>
        <div className="text-subheadline text-text-tertiary mt-0.5">{members.length} профиля</div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 space-y-1">
        {members.map((m) => {
          const active = m.id === activeId;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => select(m.id)}
              className="relative w-full h-16 px-3 flex items-center gap-3 rounded-inner text-left transition-colors duration-150"
              style={active ? { backgroundColor: tint("var(--color-brand)", 10) } : undefined}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = "rgba(127,127,127,0.06)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = "";
              }}
            >
              {active && (
                <span className="absolute left-0 inset-y-3 w-[3px] rounded-full" style={{ backgroundColor: "var(--color-brand)" }} />
              )}
              <Avatar member={m} />
              <span className="min-w-0">
                <span
                  className="block text-headline truncate"
                  style={{ color: active ? "var(--color-brand)" : "var(--color-text-primary)" }}
                >
                  {m.name}
                </span>
                <span className="block text-subheadline text-text-tertiary truncate">
                  {[m.relation, ageLabel(m.birthDate)].filter(Boolean).join(" · ")}
                </span>
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full h-14 mt-1 flex items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-separator text-text-tertiary hover:text-brand hover:border-brand transition-colors"
        >
          <UserPlus size={18} />
          <span className="text-subheadline">Добавить члена семьи</span>
        </button>
      </nav>

      <div className="p-3 border-t border-separator space-y-1">
        <PushPrompt memberId={activeId} />
        <button
          type="button"
          onClick={() => router.push("/settings/wearables")}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-inner text-text-secondary hover:bg-[rgba(127,127,127,0.08)] transition-colors"
        >
          <Smartphone size={18} />
          <span className="text-subheadline">Устройства</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-inner text-text-secondary hover:bg-[rgba(127,127,127,0.08)] transition-colors"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          <span className="text-subheadline">{theme === "dark" ? "Светлая тема" : "Тёмная тема"}</span>
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
