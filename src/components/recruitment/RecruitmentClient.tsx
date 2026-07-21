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
  GOAL_OPTIONS,
  LANGUAGE_OPTIONS,
  MAX_KEY_LEVEL,
  MIN_KEY_LEVEL,
  REGION_OPTIONS,
  RECRUITMENT_STATUS_LABEL,
} from "@/game/recruitmentTypes";
import type { MPlusRecruitmentPostDTO } from "@/data/recruitmentDto";
import type { RecruitmentApplicationDTO } from "@/data/recruitmentApplications";
import { PlayerCard, TeamCard } from "./RecruitmentCards";
import { PostDetail } from "./PostDetail";
import { MyApplications } from "./MyApplications";

const TABS = [
  { id: "teams", label: "Browse Teams" },
  { id: "players", label: "Players Looking for Team" },
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
  goal: string;
  role: string;
  keyMin: string;
  keyMax: string;
  voice: boolean;
}

const EMPTY_FILTERS: Filters = {
  region: "",
  languages: [],
  goal: "",
  role: "",
  keyMin: "",
  keyMax: "",
  voice: false,
};

export function RecruitmentClient({
  initialTeams,
  initialPlayers,
  signedIn,
}: {
  initialTeams: MPlusRecruitmentPostDTO[];
  initialPlayers: MPlusRecruitmentPostDTO[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();

  // Tab and filters live in the URL, not just state, so returning from a
  // detail page restores exactly what the user was looking at. This is the
  // "preserve filters" requirement, and it also makes a filtered board
  // shareable as a link.
  const active = params.get("tab") ?? "teams";
  const [filters, setFilters] = useState<Filters>(() => fromParams(params));

  const [teams, setTeams] = useState(initialTeams);
  const [players, setPlayers] = useState(initialPlayers);
  const [mine, setMine] = useState<MPlusRecruitmentPostDTO[] | null>(null);
  const [myApplications, setMyApplications] = useState<RecruitmentApplicationDTO[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<MPlusRecruitmentPostDTO | null>(null);

  const query = useMemo(() => toQuery(filters), [filters]);

  function setTab(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", id);
    router.replace(`/recruitment?${next.toString()}`, { scroll: false });
  }

  const applyFilters = useCallback(
    (next: Filters) => {
      setFilters(next);
      const sp = new URLSearchParams(toQuery(next));
      sp.set("tab", active);
      router.replace(`/recruitment?${sp.toString()}`, { scroll: false });
    },
    [active, router]
  );

  // Refetch the browse tabs whenever the filter query changes. The initial
  // server-rendered lists cover the unfiltered first paint, so this only runs
  // once a filter is actually touched.
  useEffect(() => {
    if (active !== "teams" && active !== "players") return;
    if (!query) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const postTypes = active === "teams" ? "team_lfp,group_lfm,new_team" : "player_lft";
    apiFetch<{ posts: MPlusRecruitmentPostDTO[] }>(`/api/recruitment/mplus?postTypes=${postTypes}&${query}`)
      .then((r) => {
        if (cancelled) return;
        if (active === "teams") setTeams(r.posts);
        else setPlayers(r.posts);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [query, active]);

  // My Recruitment is fetched on demand - it needs a session and is not part
  // of the server-rendered first paint.
  useEffect(() => {
    if (active !== "mine" || mine !== null || !signedIn) return;
    setLoading(true);
    apiFetch<{ posts: MPlusRecruitmentPostDTO[] }>("/api/recruitment/mplus?mine=1")
      .then((r) => setMine(r.posts))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [active, mine, signedIn]);

  useEffect(() => {
    if (active !== "applications" || myApplications !== null || !signedIn) return;
    apiFetch<{ applications: RecruitmentApplicationDTO[] }>(
      "/api/recruitment/applications?mine=1&type=mplus"
    )
      .then((r) => setMyApplications(r.applications))
      .catch((e) => setError(e.message));
  }, [active, myApplications, signedIn]);

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tight text-white">Recruitment M+</h1>
          <p className="mt-1 text-sm text-gray-500">
            Find a team to run keys with every week - not a group for one key.
          </p>
        </div>
        <Link href="/recruitment/create" className="btn-gold">
          Create Recruitment Post
        </Link>
      </header>

      <Tabs tabs={TABS} active={active} onChange={setTab} className="mb-4" />

      {(active === "teams" || active === "players") && (
        <FilterBar filters={filters} onChange={applyFilters} />
      )}

      {error && (
        <p className="panel mb-4 px-4 py-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      <TabPanel id="teams" active={active}>
        {loading ? (
          <SkeletonList />
        ) : teams.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((p) => (
              <TeamCard key={p.id} post={p} onOpen={() => setOpen(p)} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No teams match these filters"
            body="Try widening the key range or clearing a filter. New teams post here every day."
            action={
              <button type="button" className="btn-ghost" onClick={() => applyFilters(EMPTY_FILTERS)}>
                Clear filters
              </button>
            }
          />
        )}
      </TabPanel>

      <TabPanel id="players" active={active}>
        {loading ? (
          <SkeletonList />
        ) : players.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {players.map((p) => (
              <PlayerCard key={p.id} post={p} onOpen={() => setOpen(p)} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No players match these filters"
            body="Nobody is advertising for a team with these settings right now."
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
          <EmptyState title="Sign in to manage your posts" body="Your recruitment posts live here once you are signed in." />
        ) : loading || mine === null ? (
          <SkeletonList count={2} />
        ) : mine.length ? (
          <div className="space-y-3">
            {mine.map((p) => (
              <MyPostRow key={p.id} post={p} onOpen={() => setOpen(p)} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="You have no recruitment posts"
            body="Create one to advertise yourself, or to list the spots your team needs to fill."
            action={
              <Link href="/recruitment/create" className="btn-gold">
                Create Recruitment Post
              </Link>
            }
          />
        )}
      </TabPanel>

      <TabPanel id="applications" active={active}>
        {!signedIn ? (
          <EmptyState
            title="Sign in to see your applications"
            body="Everywhere you have applied, and what each team said, appears here once you are signed in."
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
          body="You will be able to save a search like 'EU push team, +20 to +23, evenings' and get notified when something matches."
        />
      </TabPanel>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.teamName || open?.title || "Post"}>
        {open && (
          <>
            <PostDetail post={open} />
            <Link href={`/recruitment/${open.id}`} className="btn-ghost w-full">
              Open full page
            </Link>
          </>
        )}
      </Drawer>
    </div>
  );
}

function MyPostRow({ post, onOpen }: { post: MPlusRecruitmentPostDTO; onOpen: () => void }) {
  return (
    <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
      >
        <p className="truncate text-sm font-bold text-white">{post.teamName || post.title}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          {RECRUITMENT_STATUS_LABEL[post.status as keyof typeof RECRUITMENT_STATUS_LABEL]} ·{" "}
          {post.positions.filter((p) => !p.isFilled).length} open
        </p>
      </button>
      <Link href={`/recruitment/create?edit=${post.id}`} className="btn-ghost">
        Edit
      </Link>
    </div>
  );
}

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
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
          label="Goal"
          value={filters.goal}
          onChange={(v) => set("goal", v)}
          options={GOAL_OPTIONS.map((g) => ({ value: g.value, label: g.label }))}
          placeholder="Any goal"
        />
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            Key range
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={MIN_KEY_LEVEL}
              max={MAX_KEY_LEVEL}
              value={filters.keyMin}
              onChange={(e) => set("keyMin", e.target.value)}
              placeholder="Min"
              aria-label="Minimum key level"
              className="w-full rounded-md border border-panelborder bg-panel2 px-2.5 py-1.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <span className="text-gray-600">-</span>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_KEY_LEVEL}
              max={MAX_KEY_LEVEL}
              value={filters.keyMax}
              onChange={(e) => set("keyMax", e.target.value)}
              placeholder="Max"
              aria-label="Maximum key level"
              className="w-full rounded-md border border-panelborder bg-panel2 px-2.5 py-1.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
        </label>
        <FilterGroup label="Role needed">
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
        <FilterGroup label="Voice">
          <FilterChip
            label="Voice required"
            selected={filters.voice}
            onClick={() => set("voice", !filters.voice)}
          />
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
    goal: p.get("goal") ?? "",
    role: p.get("role") ?? "",
    keyMin: p.get("keyMin") ?? "",
    keyMax: p.get("keyMax") ?? "",
    voice: p.get("voice") === "1",
  };
}

function toQuery(f: Filters): string {
  const sp = new URLSearchParams();
  if (f.region) sp.set("region", f.region);
  if (f.languages.length) sp.set("lang", f.languages.join(","));
  if (f.goal) sp.set("goal", f.goal);
  if (f.role) sp.set("role", f.role);
  if (f.keyMin) sp.set("keyMin", f.keyMin);
  if (f.keyMax) sp.set("keyMax", f.keyMax);
  if (f.voice) sp.set("voice", "1");
  return sp.toString();
}
