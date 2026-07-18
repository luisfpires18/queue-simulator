// Blizzard WoW Game Data API client — APP-LEVEL auth (client_credentials),
// distinct from src/data/blizzard.ts which only ever passes through a
// signed-in user's own OAuth token. Game Data endpoints (realm/connected-realm/
// mythic-keystone-period/mythic-leaderboard) are public reference data, not
// tied to any one player, so they use the app's own client id/secret instead —
// same env vars already configured for user login (see src/auth.ts), just a
// different grant type. Token-fetch pattern mirrors src/server/wcl/auth.js's
// existing client-credentials cache.
const LOCALE = "en_US";

function authHost(region: string): string {
  return region === "cn" ? "https://oauth.battlenet.com.cn" : "https://oauth.battle.net";
}

function apiHost(region: string): string {
  return region === "cn" ? "https://gateway.battlenet.com.cn" : `https://${region}.api.blizzard.com`;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/** The app-wide token for one region. Cached in memory until shortly before expiry. */
export async function getAppAccessToken(region: string): Promise<string> {
  const cached = tokenCache.get(region);
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;

  const id = process.env.BLIZZARD_CLIENT_ID;
  const secret = process.env.BLIZZARD_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("Missing BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET — see .env.example.");
  }
  const basic = "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(`${authHost(region)}/token`, {
    method: "POST",
    headers: { Authorization: basic, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Blizzard app token request failed: HTTP ${res.status} — ${await res.text()}`);
  const data = await res.json();
  if (!data.access_token) throw new Error(`Blizzard token response had no access_token: ${JSON.stringify(data).slice(0, 300)}`);

  const token = data.access_token as string;
  tokenCache.set(region, { token, expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 });
  return token;
}

async function gameDataGet<T>(region: string, path: string, namespace: "dynamic" | "static"): Promise<T> {
  const token = await getAppAccessToken(region);
  const sep = path.includes("?") ? "&" : "?";
  const url = `${apiHost(region)}${path}${sep}namespace=${namespace}-${region}&locale=${LOCALE}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Blizzard Game Data GET ${path} failed: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchCurrentPeriodId(region: string): Promise<number> {
  const data = await gameDataGet<{ current_period?: { id: number } }>(
    region,
    "/data/wow/mythic-keystone/period/index",
    "dynamic"
  );
  const id = data.current_period?.id;
  if (id == null) throw new Error("Blizzard period index had no current_period.id");
  return id;
}

export async function fetchCurrentSeasonId(region: string): Promise<number | null> {
  const data = await gameDataGet<{ current_season?: { id: number } }>(
    region,
    "/data/wow/mythic-keystone/season/index",
    "dynamic"
  );
  return data.current_season?.id ?? null;
}

const connectedRealmCache = new Map<string, number>(); // `${region}|${realmSlug}` -> connectedRealmId

/** Character.realmSlug -> the connected-realm id the leaderboard endpoint needs. */
export async function resolveConnectedRealmId(region: string, realmSlug: string): Promise<number> {
  const key = `${region}|${realmSlug}`;
  const cached = connectedRealmCache.get(key);
  if (cached != null) return cached;

  const data = await gameDataGet<{ connected_realm?: { href?: string } }>(
    region,
    `/data/wow/realm/${encodeURIComponent(realmSlug)}`,
    "dynamic"
  );
  const href = data.connected_realm?.href;
  const match = href?.match(/connected-realm\/(\d+)/);
  if (!match) throw new Error(`Could not resolve connected realm id for ${realmSlug} (${region})`);
  const id = Number(match[1]);
  connectedRealmCache.set(key, id);
  return id;
}

export interface RealmSummary {
  id: number;
  name: string;
  slug: string;
}

const realmIndexCache = new Map<string, { realms: RealmSummary[]; expiresAt: number }>();
const REALM_INDEX_TTL_MS = 24 * 60 * 60 * 1000; // realm lists change essentially never

/** Every realm in a region - for the player-search realm autocomplete. Cached
 * in memory for a day (same in-memory pattern as resolveConnectedRealmId
 * above); this is reference data, not per-player. */
export async function fetchRealmIndex(region: string): Promise<RealmSummary[]> {
  const cached = realmIndexCache.get(region);
  if (cached && Date.now() < cached.expiresAt) return cached.realms;

  const data = await gameDataGet<{ realms?: { id: number; name: string; slug: string }[] }>(
    region,
    "/data/wow/realm/index",
    "dynamic"
  );
  const realms = (data.realms ?? []).map((r) => ({ id: r.id, name: r.name, slug: r.slug }));
  realmIndexCache.set(region, { realms, expiresAt: Date.now() + REALM_INDEX_TTL_MS });
  return realms;
}

export interface BlizzardLeaderboardRun {
  ranking: number;
  duration: number; // ms
  completed_timestamp: number; // epoch ms
  keystone_level: number;
  members: {
    profile: { name: string; id: number; realm: { id: number; slug: string } };
    faction: { type: string };
    specialization: { id: number };
  }[];
  mythic_rating?: { rating: number };
}

export interface BlizzardLeaderboardResponse {
  period: number;
  map_challenge_mode_id: number;
  name: string;
  leading_groups?: BlizzardLeaderboardRun[];
}

export async function fetchDungeonLeaderboard(
  region: string,
  connectedRealmId: number,
  dungeonId: number,
  periodId: number
): Promise<BlizzardLeaderboardResponse> {
  return gameDataGet<BlizzardLeaderboardResponse>(
    region,
    `/data/wow/connected-realm/${connectedRealmId}/mythic-leaderboard/${dungeonId}/period/${periodId}`,
    "dynamic"
  );
}
