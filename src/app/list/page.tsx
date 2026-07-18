import Link from "next/link";
import { auth } from "@/auth";
import { ensureUser, getCurrentSelection, getGroup } from "@/data/source";
import { ListKeyForm } from "@/components/ListKeyForm";
import { RaidListForm } from "@/components/RaidListForm";
import { ListKindTabs } from "@/components/ListKindTabs";
import { redirect, notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ListPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; kind?: string }>;
}) {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  if (!s?.user) redirect("/profile");

  const user = await ensureUser(s.bnetId!, s.battletag);
  const current = await getCurrentSelection(user.id);

  const { edit, kind } = await searchParams;
  const editGroup = edit ? await getGroup(edit) : null;
  if (edit && (!editGroup || editGroup.ownerUserId !== user.id)) notFound();

  // Editing an existing listing always uses its own kind - the tab switcher
  // only matters when creating a fresh one.
  const activeKind = editGroup ? editGroup.kind : kind === "raid" ? "raid" : "mplus";

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-black mb-1">
        {editGroup ? (activeKind === "raid" ? "Edit your Raid" : "Edit your Key") : activeKind === "raid" ? "List your Raid" : "List your Key"}
      </h1>
      <p className="text-gray-400 text-sm mb-5">
        {activeKind === "raid"
          ? "Set your raid, difficulty, roster size and comp, and the character you bring."
          : "Set your key, the character you bring, and your comp preferences."}
      </p>

      {!editGroup && <ListKindTabs active={activeKind} />}

      {!current ? (
        <div className="panel p-8 text-center space-y-2">
          <p className="text-gray-300">No characters yet.</p>
          <p className="text-gray-500 text-sm">
            Go to <Link href="/profile" className="text-accent underline">Characters</Link> and sync from Battle.net.
          </p>
        </div>
      ) : activeKind === "raid" ? (
        <RaidListForm current={current} editGroup={editGroup} />
      ) : (
        <ListKeyForm current={current} editGroup={editGroup} />
      )}
    </div>
  );
}
