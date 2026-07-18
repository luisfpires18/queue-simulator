import { NextResponse } from "next/server";
import { fetchRealmIndex } from "@/data/blizzardApp";

export const dynamic = "force-dynamic";

const VALID_REGIONS = new Set(["eu", "us", "kr", "tw", "cn"]);

// Realm list for the player-search bar's autocomplete. With no `q`, returns
// EVERY realm in the region (a few hundred, ~15KB) so the client can do
// instant local filtering as the user types - no round-trip per keystroke,
// and "all servers" is available immediately rather than only once you've
// typed enough for a server-side filter to narrow down to it. `q` is kept as
// a lighter server-filtered fallback, unused by the current client but a
// reasonable option for a future lower-bandwidth caller.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const region = (searchParams.get("region") ?? "").toLowerCase();
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  if (!VALID_REGIONS.has(region)) return NextResponse.json({ error: "Invalid region" }, { status: 400 });

  try {
    const realms = await fetchRealmIndex(region);
    const body = q ? { realms: realms.filter((r) => r.name.toLowerCase().includes(q) || r.slug.includes(q)).slice(0, 20) } : { realms };
    // Realm lists change essentially never - let the BROWSER cache this too
    // (fetchRealmIndex already caches server-side, but that still costs a
    // network round-trip + ~15-30KB JSON parse per client request without
    // this). `force-dynamic` above only opts this route out of Next's own
    // render caching, it doesn't block a manual Cache-Control header.
    return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Realm lookup failed" }, { status: 500 });
  }
}
