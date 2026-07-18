# M+ Queue Simulator

A Mythic+ group finder **and** Warcraft Logs parse-improvement tool for **World of Warcraft:
Midnight, Season 1** (patch 12.0.7), in one app. This merges what used to be two separate
projects — `wow_lfg` (group finder) and `wcl-parse-improver` (WCL parse analysis) — with
**Battle.net as the single login** (the old WCL account login is gone by design).

Where Blizzard's in-game LFG shows a flat list of ratings, the group board analyzes the *comp*:
Bloodlust / Battle Res coverage, role balance, and whether a group is the current meta or a
physical-cleave comp — before you ever apply. The Parses page compares your Warcraft Logs
Mythic+ runs against top players of your spec at the same key level and gives concrete,
data-derived advice on what they do differently.

## Features

- **Group board** (`/`) — live (SSE) list of forming groups with class/spec/role/rating visuals
  and comp-analysis badges.
- **Comp analyzer engine** — pure, unit-tested (`src/game/analyze.ts`). Powers the board cards.
- **Characters** (`/me`) — sync your WoW characters from Battle.net, star your main.
- **Group listing** (`/list`) — post a key you're forming for.
- **Parses** (`/parses`) — per-character Warcraft Logs zone/spec settings, a per-dungeon overview
  board (best/median % , sorted weakest-first by default), and an eight-section gap report vs a
  top same-spec run: DPS-over-time chart with a drag-to-inspect cast-order brush, rotation
  timeline, consumables & party buffs, gear check, parse tier, biggest gaps, and per-ability table.

Both features share one roster: characters come from the Battle.net sync on `/me`; Parses adds a
per-character Warcraft Logs zone + which specs to track for analysis.

## Stack

Next.js 15 (App Router) · TypeScript · TailwindCSS · Prisma · SQLite (dev) / Postgres (prod) ·
TanStack Query · Zod · Vitest. The Warcraft Logs analysis engine (`src/server/{analysis,parse,wcl}`)
is plain ESM JS, ported unchanged from `wcl-parse-improver`.

The game meta is **config-driven**: edit `src/game/{classes,utilities,season,comps}.ts` when the
season or meta shifts — no logic changes.

## Setup

```bash
npm install
npm run setup     # prisma db push + seed (SQLite, zero infra)
```

You need two sets of API credentials in `.env` (copy `.env.example`):

- **Battle.net** (login + character sync): create a client at
  <https://develop.battle.net/access/clients>, redirect URL
  `http://localhost:3200/api/auth/callback/battlenet`. Sets `BLIZZARD_CLIENT_ID/SECRET/REGION`.
- **Warcraft Logs** (parse analysis only — no user login, just the app's own client-credentials
  token): create a client at <https://www.warcraftlogs.com/api/clients/> ("Public client"
  unchecked). Sets `WCL_CLIENT_ID/SECRET`.

```bash
npm run dev       # http://localhost:3200
```

Tests: `npm test` (vitest — comp engine + the whole ported WCL analysis suite).

### Prod with Postgres (optional)

Set `DATABASE_URL` to the Postgres URL, change the `provider` in `prisma/schema.prisma` to
`postgresql`, then:

```bash
docker compose up -d
npm run setup
```

## What changed in the merge

- **Login**: Battle.net only. `wcl-parse-improver`'s own WCL OAuth login + cookie session +
  `characters.json` flat-file roster are gone; the roster now lives in Prisma (`Character`,
  `CharacterSpecTrack`), synced from Battle.net.
- **Analysis engine**: `wcl-parse-improver`'s `server/{analysis,parse,wcl}` ported byte-for-byte
  into `src/server/{analysis,parse,wcl}` (only `server/wcl/auth.js` was trimmed to keep just the
  client-credentials app token — the per-user WCL login half is gone). Exposed via
  `src/app/api/wcl/*` route handlers gated by the Battle.net session.
- **UI**: the M+ side (per-dungeon overview, eight-section gap report, DPS chart with brush,
  rotation timeline, cast-order columns) was rebuilt as React under `/parses`, styled with this
  app's existing dark panel/gold/accent Tailwind theme instead of `wcl-parse-improver`'s own CSS.
- **Not yet ported**: the **Raid Parses** view (raid progression from a pasted report code, boss
  rotation preview, raid pull analysis — `src/server/wcl/raid.js` and the `/api/wcl/raid/*` routes
  are already ported and working) has no React UI yet. It's a separate, similarly-sized feature
  from the M+ side and was left for a follow-up pass rather than rushed.
- **Not carried over on purpose**: importing a roster straight from a signed-in WCL account (it
  needed the WCL user login this merge removes). Characters come from the Battle.net sync
  instead; picking which specs to track for parse analysis is a small settings form on `/parses`.
