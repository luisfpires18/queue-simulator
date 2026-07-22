"use client";

import { useEffect, useRef, useState } from "react";
import { PaginationChips } from "@/components/ui/PaginationChips";
import type { AdminUserRow, UserFilter } from "@/data/admin";

const PAGE_SIZE = 20;

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: "all", label: "All users" },
  { value: "hasCharacters", label: "Has characters" },
  { value: "noCharacters", label: "No characters" },
];

export function UsersTable({
  initialUsers, initialTotal,
}: { initialUsers: AdminUserRow[]; initialTotal: number }) {
  const [rows, setRows] = useState(initialUsers);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const firstRun = useRef(true);

  // Reset to page 1 whenever the search/filter changes underneath the user,
  // rather than showing an empty "page 4 of 1" for the new query.
  useEffect(() => {
    if (firstRun.current) return;
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filter]);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return; // initial data already came from the server render
    }
    const controller = new AbortController();
    // Debounced so typing in the search box doesn't fire a request per key.
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), filter });
        if (search.trim()) params.set("search", search.trim());
        const res = await fetch(`/api/admin/users?${params}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          setRows(data.rows);
          setTotal(data.total);
        }
      } catch {
        // aborted by a newer request - ignore
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [search, filter, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search battletag or bnet id"
          className="flex-1 min-w-[12rem] bg-panel2 border border-panelborder rounded-md px-3 py-1.5 text-sm"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as UserFilter)}
          className="bg-panel2 border border-panelborder rounded-md px-2 py-1.5 text-sm"
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <span className="text-[11px] text-gray-500 ml-auto">{total} user{total === 1 ? "" : "s"}</span>
      </div>

      <div className={loading ? "opacity-50 transition-opacity" : "transition-opacity"}>
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-panelborder">
                <th className="px-3 py-2 font-semibold">Battletag</th>
                <th className="px-3 py-2 font-semibold">Bnet ID</th>
                <th className="px-3 py-2 font-semibold">Country</th>
                <th className="px-3 py-2 font-semibold text-right">Characters</th>
                <th className="px-3 py-2 font-semibold text-right">Member since</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-gray-500">No users match.</td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr key={u.id} className="border-b border-panelborder/60 last:border-0">
                    <td className="px-3 py-2 font-semibold text-gray-200">{u.battletag ?? "-"}</td>
                    <td className="px-3 py-2 text-gray-500 font-mono text-xs">{u.bnetId}</td>
                    <td className="px-3 py-2 text-gray-400">{u.country ?? "-"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{u.characterCount}</td>
                    <td className="px-3 py-2 text-right text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationChips page={page} totalPages={totalPages} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(totalPages, p + 1))} />
    </div>
  );
}
