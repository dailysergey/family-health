"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Sparkles, Settings2 } from "lucide-react";
import type { FamilyMember } from "@/lib/types";
import { accentVar, initials } from "@/lib/ui";

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
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex items-stretch"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", background: "var(--color-surface)", boxShadow: "0 -1px 0 var(--color-divider)" }}
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
                background: active ? color : "var(--color-neutral-300)",
                color: active ? "var(--color-neutral-100)" : "var(--color-neutral-700)",
              }}
            >
              {initials(m.name)}
            </span>
            <span
              className="text-[10px] font-medium truncate max-w-[60px] leading-tight"
              style={{ color: active ? "var(--color-text)" : "var(--color-neutral-700)", fontWeight: active ? 700 : 500 }}
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
            background: isSettings ? "var(--color-accent-2-200)" : "var(--color-neutral-300)",
          }}
        >
          <Settings2
            size={16}
            style={{ color: isSettings ? "var(--color-accent-2-800)" : "var(--color-neutral-700)" }}
          />
        </span>
        <span
          className="text-[10px] font-medium leading-tight"
          style={{ color: isSettings ? "var(--color-accent-2-800)" : "var(--color-neutral-700)" }}
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
            background: chatOpen ? "var(--color-accent)" : "var(--color-accent-200)",
          }}
        >
          <Sparkles
            size={16}
            style={{ color: chatOpen ? "var(--color-bg)" : "var(--color-accent-800)" }}
          />
        </span>
        <span
          className="text-[10px] font-medium leading-tight"
          style={{ color: chatOpen ? "var(--color-accent-700)" : "var(--color-neutral-700)" }}
        >
          Ассистент
        </span>
      </button>
    </nav>
  );
}
