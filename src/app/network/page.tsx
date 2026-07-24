import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureUser } from "@/data/users";
import { listFriends, listIncomingRequests, listOutgoingRequests } from "@/data/network";
import { listMyChatGroups } from "@/data/chatGroups";
import { NetworkClient } from "@/components/network/NetworkClient";

export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  if (!s?.user || !s?.bnetId) redirect("/login");

  const user = await ensureUser(s.bnetId!, s.battletag);
  const [friends, incoming, outgoing, groups] = await Promise.all([
    listFriends(user.id),
    listIncomingRequests(user.id),
    listOutgoingRequests(user.id),
    listMyChatGroups(user.id),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">Network</h1>
        <p className="text-gray-400 text-sm">Friends, requests, and Team Groups. Accept a request to start chatting.</p>
      </div>
      <NetworkClient initialFriends={friends} initialRequests={{ incoming, outgoing }} initialGroups={groups} />
    </div>
  );
}
