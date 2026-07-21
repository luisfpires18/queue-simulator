import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureUser } from "@/data/users";
import { getGuild } from "@/data/guilds";
import { GuildForm } from "@/components/guilds/GuildForm";

export const dynamic = "force-dynamic";

export default async function EditGuildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  if (!s?.bnetId) redirect("/guilds");

  const [guild, user] = await Promise.all([getGuild(id), ensureUser(s.bnetId, s.battletag)]);
  if (!guild) notFound();
  if (guild.ownerUserId !== user.id) redirect(`/guilds/${id}`);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/guilds/${id}`}
        className="mb-4 inline-block text-[11px] font-semibold uppercase tracking-widest text-gray-500 hover:text-gray-300"
      >
        Back to guild
      </Link>
      <h1 className="mb-5 text-xl font-black uppercase tracking-tight text-white">Edit guild</h1>

      <GuildForm editGuild={guild} />
    </div>
  );
}
