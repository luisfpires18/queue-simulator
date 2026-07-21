import Link from "next/link";
import { getAdminStats, getRecentActivity } from "@/data/admin";
import { listFeatureStates } from "@/data/features";
import { VISIBILITY_LABEL } from "@/game/features";
import { formatListingAge } from "@/game/expiry";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [stats, recent, features] = await Promise.all([
    getAdminStats(),
    getRecentActivity(),
    listFeatureStates(),
  ]);

  const gated = features.filter((f) => f.visibility !== "public");

  return (
    <div className="space-y-6">
      {/* Leads with what is currently exposed - the question the dashboard
          exists to answer at a glance. */}
      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
          Feature access
        </h2>
        <div className="panel divide-y divide-panelborder/60">
          {features.map((f) => (
            <div key={f.feature.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-200">{f.feature.label}</p>
                <p className="truncate text-xs text-gray-600">{f.feature.description}</p>
              </div>
              <span
                className={`chip shrink-0 ${
                  f.visibility === "public" ? "bg-accent/15 text-accent" : "bg-panel2 text-gray-400"
                }`}
              >
                {VISIBILITY_LABEL[f.visibility]}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-600">
          {gated.length} of {features.length} features are not public.{" "}
          <Link href="/admin/features" className="text-accent hover:brightness-110">
            Change access
          </Link>
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
          Totals
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Users" value={stats.users} />
          <Stat label="Characters" value={stats.characters} />
          <Stat label="M+ posts" value={stats.mplusPosts} />
          <Stat label="Guilds" value={stats.guilds} />
          <Stat label="Raid teams" value={stats.raidTeams} />
          <Stat label="Raider profiles" value={stats.raiderProfiles} />
          <Stat label="Applications" value={stats.applications} />
          <Stat label="Key listings" value={stats.groups} />
          <Stat label="Runs collected" value={stats.runs} />
          <Stat
            label="Open reports"
            value={stats.openReports}
            href={stats.openReports > 0 ? "/admin/reports" : undefined}
            highlight={stats.openReports > 0}
          />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            Newest accounts
          </h2>
          <div className="panel divide-y divide-panelborder/60">
            {recent.users.length === 0 && <p className="px-4 py-3 text-sm text-gray-600">None yet.</p>}
            {recent.users.map((u) => (
              <div key={u.bnetId} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="truncate text-sm text-gray-300">{u.battletag ?? u.bnetId}</span>
                <span className="shrink-0 text-[11px] text-gray-600">
                  {formatListingAge(u.createdAt).toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            Newest recruitment posts
          </h2>
          <div className="panel divide-y divide-panelborder/60">
            {recent.posts.length === 0 && <p className="px-4 py-3 text-sm text-gray-600">None yet.</p>}
            {recent.posts.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <Link
                  href={`/recruitment/${p.id}`}
                  className="truncate text-sm text-gray-300 hover:text-white"
                >
                  {p.title}
                </Link>
                <span className="shrink-0 text-[11px] text-gray-600">
                  {formatListingAge(p.createdAt).toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
  highlight,
}: {
  label: string;
  value: number;
  href?: string;
  highlight?: boolean;
}) {
  const body = (
    <div className={`panel px-3 py-2.5 ${highlight ? "border-gold/50" : ""}`}>
      <p className="text-[11px] uppercase tracking-widest text-gray-600">{label}</p>
      <p className={`mt-0.5 text-lg font-bold tabular-nums ${highlight ? "text-gold" : "text-white"}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:brightness-125">
      {body}
    </Link>
  ) : (
    body
  );
}
