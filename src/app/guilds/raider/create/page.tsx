import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureUser } from "@/data/users";
import { getUserCharacters } from "@/data/characters";
import { getRaiderProfile } from "@/data/raiderProfiles";
import { RaiderProfileForm } from "@/components/guilds/RaiderProfileForm";

export const dynamic = "force-dynamic";

export default async function CreateRaiderProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ edit }, session] = await Promise.all([searchParams, auth()]);
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  if (!s?.bnetId) redirect("/guilds");

  const user = await ensureUser(s.bnetId, s.battletag);
  const [characters, editProfile] = await Promise.all([
    getUserCharacters(user.id),
    edit ? getRaiderProfile(edit) : Promise.resolve(null),
  ]);

  if (editProfile && editProfile.ownerUserId !== user.id) redirect("/guilds");

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/guilds"
        className="mb-4 inline-block text-[11px] font-semibold uppercase tracking-widest text-gray-500 hover:text-gray-300"
      >
        Back to guilds
      </Link>
      <h1 className="mb-1 text-xl font-black uppercase tracking-tight text-white">
        {editProfile ? "Edit raider profile" : "Create raider profile"}
      </h1>
      <p className="mb-5 text-sm text-gray-500">
        Advertise one character to guilds that are recruiting. You can create a separate profile per
        character.
      </p>

      <RaiderProfileForm
        characters={characters.filter((c) => c.bucket !== "hidden")}
        editProfile={editProfile}
      />
    </div>
  );
}
