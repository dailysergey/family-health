"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Sparkles, Settings2 } from "lucide-react";
import type { FamilyMember } from "@/lib/types";
import { accentVar, initials, tint } from "@/lib/ui";

export function BottomNav({
  members,
  activeId,
  onChatToggle,
  chatOpen,
}: {
  members: FamilyMember[];
  activeId: string;
  onChatToggle: () => void;
  chatOpen: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();

  const isSettings = pathname.startsWith("/settings");

  const select = (id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("member", id);
    router.push(`/?${next.toString()}`);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex items-stretch bg-bg-secondary border-t border-separator"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {members.map((m) => {
        const active = m.id === activeId && !chatOpen && !isSettings;
        const color = accentVar(m.accent);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              if (isSettings) router.push(`/?member=${m.id}`);
              else select(m.id);
              if (chatOpen) onChatToggle();
            }}
            className="flex-1 flex flex-col items-center justify-center gap-[3px] py-2.5 min-w-0"
          >
            <span
              className="inline-flex items-center justify-center rounded-full font-semibold transition-all duration-150"
              style={{
                width: 34,
                height: 34,
                fontSize: 12,
                background: active
                  ? `linear-gradient(135deg, ${color}, ${tint(color, 60)})`
                  : "var(--color-fill-quaternary)",
                color: active ? "#fff" : "var(--color-text-tertiary)",
                boxShadow: active ? `0 2px 10px ${color}44` : "none",
              }}
            >
              {initials(m.name)}
            </span>
            <span
              className="text-[10px] font-medium truncate max-w-[60px] leading-tight"
              style={{ color: active ? color : "var(--color-text-tertiary)" }}
            >
              {m.name.split(" ")[0]}
            </span>
          </button>
        );
      })}

      {/* Настройки устройств */}
      <button
        type="button"
        onClick={() => {
          if (chatOpen) onChatToggle();
          router.push("/settings/wearables");
        }}
        className="flex-1 flex flex-col items-center justify-center gap-[3px] py-2.5 min-w-0"
      >
        <span
          className="inline-flex items-center justify-center rounded-full transition-all duration-150"
          style={{
            width: 34,
            height: 34,
            background: isSettings ? "rgba(255,149,0,0.15)" : "var(--color-fill-quaternary)",
          }}
        >
          <Settings2
            size={16}
            style={{ color: isSettings ? "#ff9500" : "var(--color-text-tertiary)" }}
          />
        </span>
        <span
          className="text-[10px] font-medium leading-tight"
          style={{ color: isSettings ? "#ff9500" : "var(--color-text-tertiary)" }}
        >
          Устройства
        </span>
      </button>

      {/* AI-ассистент */}
      <button
        type="button"
        onClick={onChatToggle}
        className="flex-1 flex flex-col items-center justify-center gap-[3px] py-2.5 min-w-0"
      >
        <span
          className="inline-flex items-center justify-center rounded-full transition-all duration-150"
          style={{
            width: 34,
            height: 34,
            background: chatOpen ? "var(--color-brand)" : "var(--color-fill-quaternary)",
            boxShadow: chatOpen ? "0 2px 10px rgba(0,122,255,0.35)" : "none",
          }}
        >
          <Sparkles
            size={16}
            style={{ color: chatOpen ? "#fff" : "var(--color-text-tertiary)" }}
          />
        </span>
        <span
          className="text-[10px] font-medium leading-tight"
          style={{ color: chatOpen ? "var(--color-brand)" : "var(--color-text-tertiary)" }}
        >
          Ассистент
        </span>
      </button>
    </nav>
  );
}
