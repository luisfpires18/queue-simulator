// Query-string parsing and ownership guards shared by the /api/recruitment/*
// and /api/guilds/* handlers. Sits beside src/server/http.ts (session,
// character ownership, body parsing) rather than inside it - that file is the
// plumbing every non-wcl route uses, this is recruitment-specific.
import { NextResponse } from "next/server";
import type {
  MPlusPostFilters,
  RaidTeamFilters,
  RaiderProfileFilters,
} from "@/data/recruitmentDto";

export function notOwned(what = "post") {
  return NextResponse.json({ error: `Not your ${what}` }, { status: 403 });
}

export function notFound(what = "Post") {
  return NextResponse.json({ error: `${what} not found` }, { status: 404 });
}

function str(params: URLSearchParams, key: string): string | undefined {
  const v = params.get(key)?.trim();
  return v ? v : undefined;
}

/** Repeatable params accept both `?lang=en&lang=pt` and `?lang=en,pt`, since
 * the client builds one and hand-typed URLs tend to be the other. */
function list(params: URLSearchParams, key: string): string[] | undefined {
  const all = params.getAll(key).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
  return all.length ? all : undefined;
}

function int(params: URLSearchParams, key: string): number | undefined {
  const raw = str(params, key);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function bool(params: URLSearchParams, key: string): boolean | undefined {
  const raw = str(params, key);
  if (raw === undefined) return undefined;
  return raw === "1" || raw.toLowerCase() === "true";
}

export function parseMPlusFilters(url: string): MPlusPostFilters {
  const p = new URL(url).searchParams;
  return {
    postType: str(p, "postType"),
    postTypes: list(p, "postTypes"),
    region: str(p, "region"),
    languages: list(p, "lang"),
    goal: str(p, "goal"),
    role: str(p, "role"),
    specId: str(p, "spec"),
    keyMin: int(p, "keyMin"),
    keyMax: int(p, "keyMax"),
    voiceRequired: bool(p, "voice"),
    teamMaturity: str(p, "maturity"),
    isPermanent: bool(p, "permanent"),
    limit: int(p, "limit"),
  };
}

export function parseRaidTeamFilters(url: string): RaidTeamFilters {
  const p = new URL(url).searchParams;
  return {
    region: str(p, "region"),
    languages: list(p, "lang"),
    difficulty: str(p, "difficulty"),
    role: str(p, "role"),
    specId: str(p, "spec"),
    recruitmentType: str(p, "type"),
    limit: int(p, "limit"),
  };
}

export function parseRaiderFilters(url: string): RaiderProfileFilters {
  const p = new URL(url).searchParams;
  return {
    region: str(p, "region"),
    languages: list(p, "lang"),
    difficulty: str(p, "difficulty"),
    role: str(p, "role"),
    atmosphere: str(p, "atmosphere"),
    trialAvailable: bool(p, "trial"),
    limit: int(p, "limit"),
  };
}
