"use client";

import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import type { FamilyMember } from "@/lib/types";

export function SettingsNav({ members }: { members: FamilyMember[] }) {
  const router = useRouter();
  return (
    <BottomNav
      members={members}
      activeId=""
      chatOpen={false}
      onChatToggle={() => router.push("/")}
    />
  );
}
