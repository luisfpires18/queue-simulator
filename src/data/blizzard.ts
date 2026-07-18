// Blizzard WoW profile API client — called with the signed-in user's OAuth token
// (wow.profile scope). Read-only. See https://develop.battle.net/documentation
//
// M+ rating/keys-done data comes from src/data/raiderio.ts instead of this
// file's old mythic-keystone-profile fetch — Blizzard's API only ever exposes
// one best run per dungeon overall, badly under-counting secondary specs.
import { classIdFromName, specIdFromNames } from "@/game/blizzardMap";

const REGION = (process.env.BLIZZARD_REGION || "eu").toLowerCase();
const API_HOST = REGION === "cn" ? "https://gateway.battlenet.com.cn" : `https://${REGION}.api.blizzard.com`;
const LOCALE = "en_US";

export interface BlizzardChar {
  name: string;
  realm: string;
  realmSlug: string;
  region: string;
  classId: string | null;
  level: number;
  faction: string;
}

async function apiGet<T>(path: string, token: string, namespace: "profile" | "dynamic" = "profile"): Promise<T | null> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${API_HOST}${path}${sep}namespace=${namespace}-${REGION}&locale=${LOCALE}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

interface AccountProfile {
  wow_accounts?: {
    characters?: {
      name: string;
      level: number;
      realm: { name: string; slug: string };
      playable_class?: { name: string };
      faction?: { name: string };
    }[];
  }[];
}

// All characters across the user's WoW accounts (light data — no spec/ilvl).
export async function fetchAccountCharacters(token: string): Promise<BlizzardChar[]> {
  const data = await apiGet<AccountProfile>("/profile/user/wow", token);
  if (!data?.wow_accounts) return [];
  const out: BlizzardChar[] = [];
  for (const acc of data.wow_accounts) {
    for (const c of acc.characters ?? []) {
      out.push({
        name: c.name,
        realm: c.realm.name,
        realmSlug: c.realm.slug,
        region: REGION,
        classId: classIdFromName(c.playable_class?.name),
        level: c.level,
        faction: c.faction?.name ?? "Unknown",
      });
    }
  }
  return out;
}

interface CharSummary {
  active_spec?: { name: string };
  character_class?: { name: string };
  equipped_item_level?: number;
}

// Active spec + equipped ilvl for one character (called for the main / on demand).
export async function fetchCharacterSummary(
  token: string,
  realmSlug: string,
  name: string
): Promise<{ specId: string | null; ilvl: number | null }> {
  const data = await apiGet<CharSummary>(
    `/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(name.toLowerCase())}`,
    token
  );
  if (!data) return { specId: null, ilvl: null };
  return {
    specId: specIdFromNames(data.character_class?.name, data.active_spec?.name),
    ilvl: data.equipped_item_level ?? null,
  };
}

