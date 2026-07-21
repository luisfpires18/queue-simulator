"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { FilterChip, FilterGroup, Select } from "@/components/ui/Filters";
import { apiFetch } from "@/lib/api-client";
import {
  ATMOSPHERE_OPTIONS,
  LANGUAGE_OPTIONS,
  RAID_DIFFICULTY_OPTIONS,
  RAID_RECRUITMENT_TYPE_OPTIONS,
  REGION_OPTIONS,
} from "@/game/recruitmentTypes";
import type { GuildDTO, RaidTeamDTO, RaiderProfileDTO } from "@/data/recruitmentDto";
import type { RecruitmentApplicationDTO } from "@/data/recruitmentApplications";
import { MyApplications } from "@/components/recruitment/MyApplications";
import { GuildCard, RaiderCard } from "./GuildCards";
import { RaidTeamDetail, RaiderDetail } from "./GuildDetail";

const TABS = [
  { id: "guilds", label: "Browse Guilds" },
  { id: "raiders", label: "Raiders Looking for Guild" },
  { id: "mine", label: "My Recruitment" },
  { id: "applications", label: "Applications" },
  { id: "saved", label: "Saved Searches" },
];

const ROLE_OPTIONS = [
  { value: "TANK", label: "Tank" },
  { value: "HEALER", label: "Healer" },
  { value: "DPS", label: "DPS" },
];

interface Filters {
  region: string;
  languages: string[];
  difficulty: string;
  role: string;
  type: string;
  atmosphere: string;
}

const EMPTY_FILTERS: Filters = {
  region: "",
  languages: [],
  difficulty: "",
  role: "",
  type: "",
  atmosphere: "",
};

export function GuildsClient({
  initialTeams,
  initialRaiders,
  signedIn,
}: {
  initialTeams: RaidTeamDTO[];
  initialRaiders: RaiderProfileDTO[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();

  // Same URL-backed tab and filter state as the M+ side, so returning from a
  // guild detail page restores the board exactly.
  const active = params.get("tab") ?? "guilds";
  const [filters, setFilters] = useState<Filters>(() => fromParams(params));

  const [teams, setTeams] = useState(initialTeams);
  const [raiders, setRaiders] = useState(initialRaiders);
  const [myGuilds, setMyGuilds] = useState<GuildDTO[] | null>(null);
  const [myApplications, setMyApplications] = useState<RecruitmentApplicationDTO[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openTeam, setOpenTeam] = useState<RaidTeamDTO | null>(null);
  const [openRaider, setOpenRaider] = useState<RaiderProfileDTO | null>(null);

  const query = useMemo(() => toQuery(filters), [filters]);

  function setTab(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", id);
    router.replace(`/guilds?${next.toString()}`, { scroll: false });
  }

  const applyFilters = useCallback(
    (next: Filters) => {
      setFilters(next);
      const sp = new URLSearchParams(toQuery(next));
      sp.set("tab", active);
      router.replace(`/guilds?${sp.toString()}`, { scroll: false });
    },
    [active, router]
  );

  useEffect(() => {
    if (active !== "guilds" && active !== "raiders") return;
    if (!query) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const path = active === "guilds" ? `/api/guilds?${query}` : `/api/guilds/raiders?${query}`;
    apiFetch<{ teams?: RaidTeamDTO[]; profiles?: RaiderProfileDTO[] }>(path)
      .then((r) => {
        if (cancelled) return;
        if (active === "guilds") setTeams(r.teams ?? []);
        else setRaiders(r.profiles ?? []);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [query, active]);

  useEffect(() => {
    if (active !== "mine" || myGuilds !== null || !signedIn) return;
    setLoading(true);
    apiFetch<{ guilds: GuildDTO[] }>("/api/guilds?mine=1")
      .then((r) => setMyGuilds(r.guilds))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [active, myGuilds, signedIn]);

  useEffect(() => {
    if (active !== "applications" || myApplications !== null || !signedIn) return;
    apiFetch<{ applications: RecruitmentApplicationDTO[] }>(
      "/api/recruitment/applications?mine=1&type=guild"
    )
      .then((r) => setMyApplications(r.applications))
      .catch((e) => setError(e.message));
  }, [active, myApplications, signedIn]);

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tight text-white">Guilds</h1>
          <p className="mt-1 text-sm text-gray-500">
            Raid guilds, teams, trials and substitute spots.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/guilds/create" className="btn-gold">
            Create Guild Recruitment
          </Link>
          <Link href="/guilds/raider/create" className="btn-ghost">
            Create Raider Profile
          </Link>
        </div>
      </header>

      <Tabs tabs={TABS} active={active} onChange={setTab} className="mb-4" />

      {(active === "guilds" || active === "raiders") && (
        <FilterBar filters={filters} onChange={applyFilters} showType={active === "guilds"} />
      )}

      {error && (
        <p className="panel mb-4 px-4 py-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      <TabPanel id="guilds" active={active}>
        {loading ? (
          <SkeletonList />
        ) : teams.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((t) => (
              <GuildCard key={t.id} team={t} onOpen={() => setOpenTeam(t)} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No guilds match these filters"
            body="Try a different difficulty or clear a filter."
            action={
              <button type="button" className="btn-ghost" onClick={() => applyFilters(EMPTY_FILTERS)}>
                Clear filters
              </button>
            }
          />
        )}
      </TabPanel>

      <TabPanel id="raiders" active={active}>
        {loading ? (
          <SkeletonList />
        ) : raiders.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {raiders.map((p) => (
              <RaiderCard key={p.id} profile={p} onOpen={() => setOpenRaider(p)} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No raiders match these filters"
            body="Nobody is advertising for a guild with these settings right now."
            action={
              <button type="button" className="btn-ghost" onClick={() => applyFilters(EMPTY_FILTERS)}>
                Clear filters
              </button>
            }
          />
        )}
      </TabPanel>

      <TabPanel id="mine" active={active}>
        {!signedIn ? (
          <EmptyState title="Sign in to manage your guilds" body="Your guilds and raid teams live here once you are signed in." />
        ) : loading || myGuilds === null ? (
          <SkeletonList count={2} />
        ) : myGuilds.length ? (
          <div className="space-y-3">
            {myGuilds.map((g) => (
              <div key={g.id} className="panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{g.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {g.raidTeams.length} raid team{g.raidTeams.length === 1 ? "" : "s"}
                      {g.realm && ` · ${g.realm}`}
                    </p>
                  </div>
                  <Link href={`/guilds/${g.id}`} className="btn-ghost">
                    Manage
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="You have no guilds"
            body="Create one to list your raid team's open spots."
            action={
              <Link href="/guilds/create" className="btn-gold">
                Create Guild Recruitment
              </Link>
            }
          />
        )}
      </TabPanel>

      <TabPanel id="applications" active={active}>
        {!signedIn ? (
          <EmptyState
            title="Sign in to see your applications"
            body="Every guild you have applied to, and where each one got to, appears here once you are signed in."
          />
        ) : myApplications === null ? (
          <SkeletonList count={3} />
        ) : (
          <MyApplications
            applications={myApplications}
            onChanged={(updated) =>
              setMyApplications((all) => all?.map((a) => (a.id === updated.id ? updated : a)) ?? null)
            }
          />
        )}
      </TabPanel>

      <TabPanel id="saved" active={active}>
        <EmptyState
          title="Saved searches are coming next"
          body="You will be able to save a search and get notified when a matching guild or raider appears."
        />
      </TabPanel>

      <Drawer
        open={!!openTeam}
        onClose={() => setOpenTeam(null)}
        title={openTeam ? `${openTeam.guild?.name ?? "Guild"} - ${openTeam.name}` : "Guild"}
      >
        {openTeam && (
          <>
            <RaidTeamDetail team={openTeam} />
            <Link href={`/guilds/${openTeam.guildId}`} className="btn-ghost w-full">
              Open full page
            </Link>
          </>
        )}
      </Drawer>

      <Drawer
        open={!!openRaider}
        onClose={() => setOpenRaider(null)}
        title={openRaider?.character.name ?? "Raider"}
      >
        {openRaider && <RaiderDetail profile={openRaider} />}
      </Drawer>
    </div>
  );
}

function FilterBar({
  filters,
  onChange,
  showType,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  showType: boolean;
}) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value });

  return (
    <div className="panel mb-4 space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Region"
          value={filters.region}
          onChange={(v) => set("region", v)}
          options={REGION_OPTIONS}
          placeholder="Any region"
        />
        <Select
          label="Raid difficulty"
          value={filters.difficulty}
          onChange={(v) => set("difficulty", v)}
          options={RAID_DIFFICULTY_OPTIONS}
          placeholder="Any difficulty"
        />
        {showType ? (
          <Select
            label="Recruitment type"
            value={filters.type}
            onChange={(v) => set("type", v)}
            options={RAID_RECRUITMENT_TYPE_OPTIONS.map((t) => ({ value: t.value, label: t.label }))}
            placeholder="Any type"
          />
        ) : (
          <Select
            label="Atmosphere"
            value={filters.atmosphere}
            onChange={(v) => set("atmosphere", v)}
            options={ATMOSPHERE_OPTIONS.map((a) => ({ value: a.value, label: a.label }))}
            placeholder="Any atmosphere"
          />
        )}
        <FilterGroup label="Role">
          {ROLE_OPTIONS.map((r) => (
            <FilterChip
              key={r.value}
              label={r.label}
              selected={filters.role === r.value}
              onClick={() => set("role", filters.role === r.value ? "" : r.value)}
            />
          ))}
        </FilterGroup>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <FilterGroup label="Language">
          {LANGUAGE_OPTIONS.slice(0, 8).map((l) => (
            <FilterChip
              key={l.value}
              label={l.label}
              selected={filters.languages.includes(l.value)}
              onClick={() =>
                set(
                  "languages",
                  filters.languages.includes(l.value)
                    ? filters.languages.filter((x) => x !== l.value)
                    : [...filters.languages, l.value]
                )
              }
            />
          ))}
        </FilterGroup>
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="ml-auto text-[11px] font-semibold uppercase tracking-widest text-gray-500 hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}

function fromParams(p: URLSearchParams): Filters {
  return {
    region: p.get("region") ?? "",
    languages: p.getAll("lang").flatMap((v) => v.split(",")).filter(Boolean),
    difficulty: p.get("difficulty") ?? "",
    role: p.get("role") ?? "",
    type: p.get("type") ?? "",
    atmosphere: p.get("atmosphere") ?? "",
  };
}

function toQuery(f: Filters): string {
  const sp = new URLSearchParams();
  if (f.region) sp.set("region", f.region);
  if (f.languages.length) sp.set("lang", f.languages.join(","));
  if (f.difficulty) sp.set("difficulty", f.difficulty);
  if (f.role) sp.set("role", f.role);
  if (f.type) sp.set("type", f.type);
  if (f.atmosphere) sp.set("atmosphere", f.atmosphere);
  return sp.toString();
}
