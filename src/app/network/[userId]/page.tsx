import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureUser } from "@/data/users";
import { areFriends, getDisplayIdentity } from "@/data/network";
import { listMessages } from "@/data/messages";
import { ChatClient } from "@/components/network/ChatClient";

export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  if (!s?.user || !s?.bnetId) redirect("/login");

  const user = await ensureUser(s.bnetId!, s.battletag);
  const { userId: friendUserId } = await params;

  if (friendUserId === user.id || !(await areFriends(user.id, friendUserId))) notFound();

  const [identity, messages] = await Promise.all([
    getDisplayIdentity(friendUserId),
    listMessages(user.id, friendUserId),
  ]);

  return <ChatClient friendUserId={friendUserId} identity={identity} initialMessages={messages ?? []} />;
}
