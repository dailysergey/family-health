"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Dashboard } from "./Dashboard";
import { ChatPanel } from "./ChatPanel";
import { BottomNav } from "./BottomNav";
import type { MemberBundle, FamilyMember, ChatStoredItem } from "@/lib/types";

export function MobileShell({
  members,
  bundle,
  conversationId,
  chatHistory,
}: {
  members: FamilyMember[];
  bundle: MemberBundle;
  conversationId: string;
  chatHistory: ChatStoredItem[];
}) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      {/* ───────────── Desktop layout (md+) ───────────── */}
      <div className="hidden md:flex md:flex-row md:h-screen md:overflow-hidden">
        <Sidebar members={members} activeId={bundle.member.id} />
        <Dashboard bundle={bundle} conversationId={conversationId} />
        <ChatPanel
          key={conversationId}
          conversationId={conversationId}
          memberId={bundle.member.id}
          memberName={bundle.member.name}
          initialItems={chatHistory}
        />
      </div>

      {/* ───────────── Mobile layout ───────────── */}
      <div className="flex flex-col md:hidden min-h-screen bg-bg-primary">
        {/* Основной контент — с отступом снизу под bottom nav */}
        <div className="flex-1 overflow-y-auto" style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}>
          <Dashboard bundle={bundle} conversationId={conversationId} />
        </div>

        {/* Bottom nav */}
        <BottomNav
          members={members}
          activeId={bundle.member.id}
          chatOpen={chatOpen}
          onChatToggle={() => setChatOpen((v) => !v)}
        />
      </div>

      {/* ───────────── Chat drawer (mobile) ───────────── */}
      {chatOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setChatOpen(false)}
          />

          {/* Drawer */}
          <div
            className="absolute inset-x-0 bottom-0 bg-bg-secondary rounded-t-[28px] shadow-modal flex flex-col overflow-hidden"
            style={{
              top: "8vh",
              paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            {/* Drag handle */}
            <div className="shrink-0 flex flex-col items-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-fill-quaternary" />
            </div>

            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-4 pb-3">
              <div>
                <p className="text-headline font-semibold text-text-primary">Ассистент</p>
                <p className="text-caption-1 text-text-tertiary">{bundle.member.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-fill-quaternary text-text-secondary"
              >
                <X size={16} />
              </button>
            </div>

            {/* Chat panel — takes remaining space */}
            <div className="flex-1 min-h-0">
              <ChatPanel
                key={`mobile-${conversationId}`}
                conversationId={conversationId}
                memberId={bundle.member.id}
                memberName={bundle.member.name}
                initialItems={chatHistory}
                hideHeader
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
