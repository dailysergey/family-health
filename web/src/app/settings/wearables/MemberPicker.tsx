"use client";

import { useRouter } from "next/navigation";
import { accentVar, initials, tint } from "@/lib/ui";
import type { FamilyMember } from "@/lib/types";

export function MemberPicker({
  members,
  activeMemberId,
}: {
  members: FamilyMember[];
  activeMemberId: string;
}) {
  const router = useRouter();

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
      {members.map((m) => {
        const active = m.id === activeMemberId;
        const color = accentVar(m.accent);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => router.push(`/settings/wearables?member=${m.id}`)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full shrink-0 transition-all duration-150"
            style={{
              background: active
                ? `linear-gradient(135deg, ${color}, ${tint(color, 60)})`
                : "var(--color-bg-secondary)",
              border: active ? "none" : "1.5px solid var(--color-separator)",
              boxShadow: active ? `0 2px 12px ${color}44` : "none",
            }}
          >
            <span
              className="inline-flex items-center justify-center rounded-full font-semibold shrink-0"
              style={{
                width: 26,
                height: 26,
                fontSize: 10,
                background: active ? "rgba(255,255,255,0.25)" : `linear-gradient(135deg, ${color}, ${tint(color, 70)})`,
                color: "#fff",
              }}
            >
              {initials(m.name)}
            </span>
            <span
              className="text-subheadline font-semibold whitespace-nowrap"
              style={{ color: active ? "#fff" : "var(--color-text-primary)" }}
            >
              {m.name.split(" ")[1] ?? m.name.split(" ")[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
