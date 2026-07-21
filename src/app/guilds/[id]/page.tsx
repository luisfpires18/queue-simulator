import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ensureUser } from "@/data/users";
import { getUserCharacters } from "@/data/characters";
import { getGuild } from "@/data/guilds";
import { getMyApplication, listApplicationsForTarget } from "@/data/recruitmentApplications";
import { RAID_RECRUITMENT_TYPE_LABEL, type RaidRecruitmentType } from "@/game/recruitmentTypes";
import { RaidTeamDetail } from "@/components/guilds/GuildDetail";
import { GuildOwnerActions } from "@/components/guilds/GuildOwnerActions";
import { ApplySection } from "@/components/recruitment/ApplySection";
import { GuildApplications } from "@/components/guilds/GuildApplications";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CharacterDTO } from "@/data/dto";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = { TANK: "Tank", HEALER: "Healer", DPS: "DPS" };

export default async function GuildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [guild, session] = await Promise.all([getGuild(id), auth()]);
  if (!guild) notFound();

  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  const user = s?.bnetId ? await ensureUser(s.bnetId, s.battletag) : null;
  const isOwner = user?.id === guild.ownerUserId;

  const characters: CharacterDTO[] =
    user && !isOwner ? (await getUserCharacters(user.id)).filter((c) => c.bucket !== "hidden") : [];

  // One read per team: a guild can run several rosters, each with its own
  // application state for this viewer (or its own queue, for the owner).
  const perTeam = await Promise.all(
    guild.raidTeams.map(async (team) => ({
      teamId: team.id,
      myApplication:
        user && !isOwner ? await getMyApplication("guild", team.id, user.id) : null,
      applications:
        user && isOwner ? await listApplicationsForTarget("guild", team.id, user.id) : [],
    }))
  );
  const byTeam = new Map(perTeam.map((t) => [t.teamId, t]));

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/guilds"
        className="mb-4 inline-block text-[11px] font-semibold uppercase tracking-widest text-gray-500 hover:text-gray-300"
      >
        Back to guilds
      </Link>

      <h1 className="text-xl font-black uppercase tracking-tight text-white">{guild.name}</h1>
      <p className="mb-5 mt-1 text-sm text-gray-500">
        {guild.realm ? `${guild.realm} · ` : ""}
        {guild.region.toUpperCase()}
      </p>

      {isOwner && <GuildOwnerActions guild={guild} />}

      {guild.raidTeams.length === 0 ? (
        <EmptyState
          title="No raid teams yet"
          body={
            isOwner
              ? "Add a raid team so raiders can see what you are recruiting for."
              : "This guild has not listed a raid team yet."
          }
        />
      ) : (
        guild.raidTeams.map((team) => {
          const state = byTeam.get(team.id);
          const positions = team.positions
            .filter((p) => !p.isFilled && p.priority >= 0)
            .map((p) => ({
              id: p.id,
              role: p.role,
              label: `${ROLE_LABEL[p.role] ?? p.role} - ${
                RAID_RECRUITMENT_TYPE_LABEL[p.recruitmentType as RaidRecruitmentType] ?? p.recruitmentType
              }`,
            }));

          return (
            <div key={team.id} className="mb-6">
              {isOwner && (state?.applications.length ?? 0) > 0 && (
                <section className="mb-4">
                  <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-white">
                    Applications for {team.name}
                    <span className="ml-2 rounded bg-panel2 px-1.5 py-0.5 text-[11px] font-semibold text-gray-300">
                      {state!.applications.length}
                    </span>
                  </h2>
                  <GuildApplications team={team} initial={state!.applications} />
                </section>
              )}

              <RaidTeamDetail
                team={team}
                guild={guild}
                applySlot={
                  <ApplySection
                    recruitmentType="guild"
                    targetId={team.id}
                    targetName={`${guild.name} - ${team.name}`}
                    ownerUserId={guild.ownerUserId}
                    positions={positions}
                    characters={characters}
                    initialApplication={state?.myApplication ?? null}
                    signedIn={!!user}
                    isOwner={isOwner}
                  />
                }
              />
            </div>
          );
        })
      )}
    </div>
  );
}
