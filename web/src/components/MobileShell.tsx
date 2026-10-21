"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Dashboard } from "./Dashboard";
import { ChatPanel } from "./ChatPanel";
import { BottomNav } from "./BottomNav";
import type { MemberBundle, FamilyMember, ChatStoredItem } from "@/lib/types";
import { ScrollToTop } from "./ScrollToTop";
import { ASK_EVENT } from "./dashboard/primitives";

// One dashboard and one chat panel for every viewport; CSS decides where the
// chat lives: a right column on desktop (auto-open from xl, overlay below),
// a bottom drawer on mobile. A single ChatPanel means a single SSE stream.
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
  const [mobileChat, setMobileChat] = useState(false);
  // null = auto: shown from xl (≥1280px), hidden on narrower desktops.
  const [deskChat, setDeskChat] = useState<boolean | null>(null);

  useEffect(() => {
    const open = () => {
      if (window.matchMedia("(min-width: 768px)").matches) setDeskChat(true);
      else setMobileChat(true);
    };
    window.addEventListener(ASK_EVENT, open);
    return () => window.removeEventListener(ASK_EVENT, open);
  }, []);

  const closeChat = () => {
    if (window.matchMedia("(min-width: 768px)").matches) setDeskChat(false);
    else setMobileChat(false);
  };

  const mobileCls = mobileChat ? "flex fixed inset-x-0 bottom-0 top-[8vh] z-40 rounded-t-[28px]" : "hidden";
  const deskCls =
    deskChat === true
      ? "md:flex md:absolute md:left-auto md:right-0 md:top-0 md:bottom-auto md:z-30 xl:static"
      : deskChat === false
        ? "md:hidden"
        : "md:hidden xl:flex xl:static";
  const assistantButtonClass =
    deskChat === true ? "hidden" : deskChat === false ? "hidden md:inline-flex" : "hidden md:inline-flex xl:hidden";

  return (
    <>
      <div className="md:flex md:h-screen md:overflow-hidden relative overflow-x-clip pb-[calc(64px+env(safe-area-inset-bottom,0px))] md:pb-0">
        <div className="hidden md:flex">
          <Sidebar members={members} activeId={bundle.member.id} />
        </div>

        <Dashboard
          bundle={bundle}
          conversationId={conversationId}
          assistantButtonClass={assistantButtonClass}
          onOpenAssistant={() => setDeskChat(true)}
        />

        {mobileChat && (
          <div className="fixed inset-0 z-40 md:hidden bg-black/30 backdrop-blur-[2px]" onClick={() => setMobileChat(false)} />
        )}
        <div
          className={`${mobileCls} ${deskCls} flex-col overflow-hidden md:rounded-none md:h-screen md:w-[380px] md:max-w-[100vw] md:shrink-0 pb-[calc(64px+env(safe-area-inset-bottom,0px))] md:pb-0`}
          style={{ background: "var(--color-neutral-100)", boxShadow: "var(--shadow-lg)" }}
        >
          <ChatPanel
            key={conversationId}
            conversationId={conversationId}
            memberId={bundle.member.id}
            memberName={bundle.member.name}
            initialItems={chatHistory}
            onClose={closeChat}
          />
        </div>
      </div>

      <BottomNav
        members={members}
        activeId={bundle.member.id}
        chatOpen={mobileChat}
        onChatToggle={() => setMobileChat((v) => !v)}
      />

      <ScrollToTop />
    </>
  );
}
