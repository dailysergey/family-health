import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Dashboard } from "@/components/Dashboard";
import { ChatPanel } from "@/components/ChatPanel";
import { getChatHistory, getMemberBundle, listMembers } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const members = await listMembers();
  if (members.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center text-text-tertiary">
        Нет членов семьи. Добавьте данные в /opt/health/data.
      </div>
    );
  }

  const { member: requested } = await searchParams;
  const activeId = members.find((m) => m.id === requested)?.id ?? members[0].id;
  const bundle = await getMemberBundle(activeId);
  if (!bundle) redirect(`/?member=${members[0].id}`);

  const conversationId = `conv-${activeId}`;
  const chatHistory = await getChatHistory(activeId);

  return (
    <div className="flex flex-col md:flex-row md:h-screen md:overflow-hidden">
      <Sidebar members={members} activeId={activeId} />
      <Dashboard bundle={bundle} conversationId={conversationId} />
      {/* key remounts the panel per member so it seeds from that member's transcript */}
      <ChatPanel
        key={conversationId}
        conversationId={conversationId}
        memberId={activeId}
        memberName={bundle.member.name}
        initialItems={chatHistory}
      />
    </div>
  );
}
