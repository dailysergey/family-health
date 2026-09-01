import { redirect } from "next/navigation";
import { getChatHistory, getMemberBundle, listMembers } from "@/lib/store";
import { MobileShell } from "@/components/MobileShell";

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
    <MobileShell
      members={members}
      bundle={bundle}
      conversationId={conversationId}
      chatHistory={chatHistory}
    />
  );
}
