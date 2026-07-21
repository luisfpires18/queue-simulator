"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api-client";
import { formatExpiry, isStale } from "@/game/expiry";
import type { GuildDTO, RaidTeamDTO } from "@/data/recruitmentDto";

/** Owner-only controls on a guild page. Each raid team refreshes and pauses
 * independently, since a guild routinely has one roster recruiting hard and
 * another that is full. */
export function GuildOwnerActions({ guild }: { guild: GuildDTO }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  // The refresh endpoint requires an explicit confirmation flag: a guild
  // listing lives 30 days, so a silent one-click bump would keep dead rosters
  // circulating.
  const refreshTeam = (team: RaidTeamDTO) =>
    run(() => apiPost(`/api/guilds/teams/${team.id}/refresh`, { stillRecruiting: true }));

  const setTeamStatus = (team: RaidTeamDTO, status: string) =>
    run(() => apiPost(`/api/guilds/teams/${team.id}`, { status }, "PATCH"));

  async function removeGuild() {
    setBusy(true);
    try {
      await apiPost(`/api/guilds/${guild.id}`, undefined, "DELETE");
      router.push("/guilds?tab=mine");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the guild.");
      setBusy(false);
    }
  }

  return (
    <div className="panel mb-5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Your guild</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/guilds/${guild.id}/edit`} className="btn-ghost">
            Edit guild
          </Link>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={busy}
            className="btn-ghost hover:text-rose-300"
          >
            Delete guild
          </button>
        </div>
      </div>

      {guild.raidTeams.length > 0 && (
        <div className="mt-3 space-y-2">
          {guild.raidTeams.map((team) => {
            const stale = isStale(team, "guild");
            return (
              <div
                key={team.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-panelborder p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{team.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {team.status === "open" ? "Recruiting" : team.status === "paused" ? "Paused" : "Closed"} ·{" "}
                    <span className={stale ? "text-gold" : "text-gray-500"}>{formatExpiry(team)}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => refreshTeam(team)} disabled={busy} className="btn-ghost">
                    Still recruiting
                  </button>
                  {team.status === "open" ? (
                    <button
                      type="button"
                      onClick={() => setTeamStatus(team, "paused")}
                      disabled={busy}
                      className="btn-ghost"
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setTeamStatus(team, "open")}
                      disabled={busy}
                      className="btn-gold"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmingDelete && (
        <div className="mt-3 rounded-md border border-rose-500/40 bg-rose-500/5 p-3">
          <p className="text-sm text-gray-200">
            Delete this guild permanently? This also removes its {guild.raidTeams.length} raid team
            {guild.raidTeams.length === 1 ? "" : "s"} and all their open positions.
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={removeGuild} disabled={busy} className="btn-gold">
              Yes, delete it
            </button>
            <button type="button" onClick={() => setConfirmingDelete(false)} className="btn-ghost">
              Keep it
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
