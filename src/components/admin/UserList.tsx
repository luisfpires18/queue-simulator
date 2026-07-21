"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { FEATURE_BY_KEY } from "@/game/features";
import { formatListingAge } from "@/game/expiry";
import { countryByCode, flagUrl } from "@/game/countries";
import { inputClass } from "@/components/ui/Filters";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AdminUserRow } from "@/data/admin";

export function UserList({ initial }: { initial: AdminUserRow[] }) {
  const [users, setUsers] = useState(initial);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced so typing does not fire a query per keystroke.
  useEffect(() => {
    const q = search.trim();
    const timer = setTimeout(() => {
      setLoading(true);
      apiFetch<{ users: AdminUserRow[] }>(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`)
        .then((r) => setUsers(r.users))
        .catch((e) => setError(e instanceof Error ? e.message : "Search failed."))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div>
      <label className="mb-3 block max-w-sm">
        <span className="sr-only">Search users</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search battletag or Battle.net id"
          className={inputClass}
        />
      </label>

      {error && (
        <p className="panel mb-3 px-4 py-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      {!users.length ? (
        <EmptyState
          title={search ? "No accounts match that" : "No accounts yet"}
          body={search ? "Try a different battletag or id." : undefined}
        />
      ) : (
        <div className={`space-y-2 ${loading ? "opacity-60" : ""}`}>
          {users.map((u) => (
            <article key={u.id} className="panel p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                    {u.country && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={flagUrl(u.country)}
                        width={16}
                        height={12}
                        alt=""
                        title={countryByCode(u.country)?.name ?? u.country}
                        className="rounded-[2px]"
                      />
                    )}
                    {u.battletag ?? "No battletag"}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-gray-600">{u.bnetId}</p>
                </div>
                <span className="shrink-0 text-[11px] text-gray-600">
                  Joined {formatListingAge(u.createdAt).toLowerCase()}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <Meta label="Characters" value={u.characterCount} />
                <Meta label="Listings" value={u.listingCount} />
                <Meta label="Applications" value={u.applicationCount} />
                {u.blocksMade > 0 && <Meta label="Blocks made" value={u.blocksMade} />}
              </div>

              {u.grants.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-gray-600">Alpha access</span>
                  {u.grants.map((key) => (
                    <span key={key} className="chip bg-accent/15 text-accent">
                      {FEATURE_BY_KEY[key]?.label ?? key}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-gray-600">{label}</span>
      <span className="tabular-nums text-gray-300">{value}</span>
    </span>
  );
}
