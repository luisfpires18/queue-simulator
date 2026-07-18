// Shared plumbing for the /api/wcl/* route handlers: auth, character
// ownership, and the classId (src/game/classes.ts) -> Warcraft Logs class-slug
// translation the ported analysis engine (src/server/wcl, src/server/analysis)
// expects. Keeps the ported .js modules untouched — only this TS boundary
// layer knows about Prisma / next-auth.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { classById, specById, type ClassId } from "@/game/classes";

// Warcraft Logs wants its own class slug (`DeathKnight`, `DemonHunter`), which
// differs in casing/concatenation from our lowercase classId. See
// docs/wcl-api.md in wcl-parse-improver: "class.slug is exactly the className
// the ranking queries want — not the display name."
const WCL_CLASS_SLUG: Record<ClassId, string> = {
  warrior: "Warrior",
  paladin: "Paladin",
  hunter: "Hunter",
  rogue: "Rogue",
  priest: "Priest",
  shaman: "Shaman",
  mage: "Mage",
  warlock: "Warlock",
  monk: "Monk",
  druid: "Druid",
  demonhunter: "DemonHunter",
  deathknight: "DeathKnight",
  evoker: "Evoker",
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type SessionExtra = { bnetId?: string; accessToken?: string; battletag?: string };

/** Resolves the signed-in Battle.net user, or throws a 401 ApiError. */
export async function requireUser() {
  const session = await auth();
  const s = session as (typeof session & SessionExtra) | null;
  if (!s?.bnetId) throw new ApiError("Not signed in", 401);
  const user = await prisma.user.upsert({
    where: { bnetId: s.bnetId },
    create: { bnetId: s.bnetId, battletag: s.battletag },
    update: {},
  });
  return { userId: user.id, session: s };
}

/** Loads a character owned by this user, or throws a 404 ApiError. */
export async function loadOwnedCharacter(userId: string, characterId: string) {
  const character = await prisma.character.findFirst({ where: { id: characterId, userId } });
  if (!character) throw new ApiError(`No character "${characterId}" on this account`, 404);
  return character;
}

/** classId (e.g. "deathknight") -> Warcraft Logs className (e.g. "DeathKnight"). */
export function wclClassName(classId: string): string {
  const wcl = WCL_CLASS_SLUG[classId as ClassId];
  if (!wcl) throw new ApiError(`Unknown class "${classId}"`, 400);
  return wcl;
}

/** classId + specId -> { className, specName, classLabel } for the ported analysis calls. */
export function wclSpecParams(classId: string, specId: string | null) {
  const className = wclClassName(classId);
  const classLabel = classById(classId)?.name ?? classId;
  if (!specId) return { className, specName: null as string | null, classLabel };
  const spec = specById(specId);
  if (!spec) throw new ApiError(`Unknown spec "${specId}"`, 400);
  return { className, specName: spec.name, classLabel };
}

/** `refresh=1` (or any truthy string other than "0"/"false") bypasses the disk cache. */
export function wantsRefresh(searchParams: URLSearchParams): boolean {
  const v = searchParams.get("refresh");
  return v != null && v !== "" && v !== "0" && v !== "false";
}

export function errorResponse(err: unknown) {
  const status = err instanceof ApiError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unknown error";
  return NextResponse.json({ error: message }, { status });
}
