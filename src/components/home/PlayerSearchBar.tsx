"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface RealmOption {
  id: number;
  name: string;
  slug: string;
}

const REGIONS = [
  { value: "eu", label: "EU" },
  { value: "us", label: "US" },
  { value: "kr", label: "KR" },
  { value: "tw", label: "TW" },
  { value: "cn", label: "CN" },
];

// Module-level (not component state) so it survives remounts and, more
// importantly, dedupes concurrent fetches — React's dev-mode double-invoke
// and a user flipping the region selector back and forth both hit the same
// in-flight Promise instead of firing a second request. The API route itself
// also sets long-lived Cache-Control headers, so a real reload skips the
// network entirely once the browser has cached a region once.
const realmCache = new Map<string, Promise<RealmOption[]>>();
function loadRealms(region: string): Promise<RealmOption[]> {
  let pending = realmCache.get(region);
  if (!pending) {
    pending = fetch(`/api/realms?region=${region}`)
      .then((r) => r.json())
      .then((data) => data.realms ?? [])
      .catch(() => []);
    realmCache.set(region, pending);
  }
  return pending;
}

export function PlayerSearchBar({
  className, initialRegion, initialRealms,
}: {
  className?: string;
  /** Server-prefetched realm list for one region (see src/app/page.tsx) -
   * skips the client's very first fetch/loading-state entirely for whichever
   * region most visitors land on. */
  initialRegion?: string;
  initialRealms?: RealmOption[];
}) {
  const router = useRouter();
  const [region, setRegion] = useState(initialRegion ?? "eu");
  const [realmText, setRealmText] = useState("");
  const [selectedRealm, setSelectedRealm] = useState<RealmOption | null>(null);
  const [name, setName] = useState("");
  const [allRealms, setAllRealms] = useState<RealmOption[]>(initialRealms ?? []);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Seed the module cache with whatever the server already fetched, once,
  // so a later flip back to this region (e.g. EU -> US -> EU) is instant too.
  useEffect(() => {
    if (initialRegion && initialRealms) realmCache.set(initialRegion, Promise.resolve(initialRealms));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load every realm in the region ONCE (a few hundred, ~15KB) so typing
  // filters instantly, client-side - no per-keystroke round trip, and every
  // server is available right away instead of only once enough is typed for
  // a server-side filter to find it. Cached (see loadRealms above), so
  // flipping back to an already-loaded region is instant, and the very first
  // region (initialRegion) skips this fetch entirely.
  useEffect(() => {
    if (region === initialRegion && initialRealms) return; // already have it from the server
    let cancelled = false;
    setSelectedRealm(null);
    setAllRealms((prev) => (realmCache.has(region) ? prev : []));
    loadRealms(region).then((realms) => {
      if (!cancelled) setAllRealms(realms);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const matches = useMemo(() => {
    const q = realmText.trim().toLowerCase();
    if (!q) return allRealms.slice(0, 8);
    return allRealms.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 8);
  }, [realmText, allRealms]);

  function pickRealm(r: RealmOption) {
    setSelectedRealm(r);
    setRealmText(r.name);
    setDropdownOpen(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const realmSlug =
      selectedRealm?.name === realmText.trim()
        ? selectedRealm.slug
        : allRealms.find((r) => r.name.toLowerCase() === realmText.trim().toLowerCase())?.slug;
    if (!realmSlug) return; // must pick a real realm from the list - no free-text slug guessing
    router.push(`/player/${region}/${encodeURIComponent(realmSlug)}/${encodeURIComponent(name.trim())}`);
  }

  return (
    <form onSubmit={submit} className={cn("panel p-3 flex flex-wrap items-center gap-2", className)}>
      <select
        value={region}
        onChange={(e) => setRegion(e.target.value)}
        className="bg-panel2 border border-panelborder rounded-md px-2 py-2 text-sm"
      >
        {REGIONS.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      <div ref={boxRef} className="relative flex-1 min-w-[8rem]">
        <input
          value={realmText}
          onChange={(e) => {
            setRealmText(e.target.value);
            setSelectedRealm(null);
            setDropdownOpen(true);
          }}
          onFocus={() => setDropdownOpen(true)}
          placeholder={allRealms.length ? "Realm" : "Loading realms…"}
          disabled={!allRealms.length}
          className="w-full bg-panel2 border border-panelborder rounded-md px-3 py-2 text-sm disabled:opacity-50"
        />
        {dropdownOpen && matches.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 panel max-h-56 overflow-y-auto shadow-card">
            {matches.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => pickRealm(r)}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-panel2 hover:text-white"
              >
                {r.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Character name"
        className="flex-1 min-w-[8rem] bg-panel2 border border-panelborder rounded-md px-3 py-2 text-sm"
      />
      <button type="submit" className="btn-gold px-5 py-2">Search</button>
    </form>
  );
}
