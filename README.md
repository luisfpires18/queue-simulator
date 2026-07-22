# Queue Simulator

A Mythic+ and raid group finder **and** Warcraft Logs parse-improvement tool for **World of
Warcraft: Midnight, Season 1** (patch 12.0.7), in one app, installable as a PWA on desktop or
mobile.

Where Blizzard's in-game LFG shows a flat list of ratings, the group boards analyze the *comp*:
Bloodlust / Battle Res coverage, role balance, and whether a group is the current meta or a
physical-cleave comp - before you ever apply. The profile page compares your Warcraft Logs
Mythic+ and raid runs against top players of your spec at the same key level and gives concrete,
data-derived advice on what they do differently.

## Features

- **M+ Key Board** (`/runs`) - live (SSE) list of forming Mythic+ groups with class/spec/role/
  rating visuals and comp-analysis badges.
- **Raid Board** (`/raids`) - list or apply to raid groups with a custom tank/healer/dps split,
  any difficulty, any size.
- **Solo Queue** (first section of `/runs`) - skip browsing the board yourself: queue up with a
  character, role, and spec, and the app proposes you to the best-fit forming M+ group's leader
  automatically. The leader accepts or declines from their normal Pending Requests list; a decline
  is invisible to you and the queue just keeps trying the next candidate, an accept drops you
  straight into the key. You can't list or join a key starting within an hour of one you're already
  in (`src/game/scheduling.ts`), so it also warns you
  if you already have a key listed.
- **Comp analyzer engine** - pure, unit-tested (`src/game/analyze.ts`). Powers both boards' cards
  and the Solo Queue matcher.
- **Character roster & public profile** (`/profile`, `/u/[realm]/[name]`) - sync your WoW
  characters from Battle.net, star your main, arrange alts, share one public link.
- **Live player lookup** (`/player/[region]/[realm]/[name]`) - look up any character on any
  server, registered here or not.
- **Parse improvement** (on `/profile`) - per-character Warcraft Logs zone/spec settings, a
  per-dungeon overview board (best/median %, sorted weakest-first by default), and an eight-section
  gap report vs a top same-spec run: DPS-over-time chart with a drag-to-inspect cast-order brush,
  rotation timeline, consumables & party buffs, gear check, parse tier, biggest gaps, and
  per-ability table. Raid parse analysis (`src/server/wcl/raid.js`, `/api/wcl/raid/*`) is ported
  and working server-side but has no dedicated raid UI yet.
- **Push notifications** - set a key-level range once and get pushed the moment a matching group
  opens, or the moment your application/Solo Queue match is accepted, even with the tab closed.

Every feature shares one roster: characters come from the Battle.net sync on `/profile`, which
also carries which specs to track for parse analysis.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19, TypeScript (strict) |
| Styling | TailwindCSS, custom dark theme (`tailwind.config.ts`) |
| Data fetching | TanStack React Query (client), Route Handlers + RSC (server) |
| Validation | Zod |
| ORM / DB | Prisma - SQLite (dev) / Postgres (prod) |
| Auth | Auth.js / NextAuth v5 (beta) - Battle.net OAuth2 |
| Real-time | Server-Sent Events (board live updates), Web Push (VAPID) for background notifications |
| Testing | Vitest |
| Legacy engine | `src/server/{analysis,parse,wcl}` - plain ESM JS, ported byte-for-byte from `wcl-parse-improver` |

The game meta is **config-driven**: edit `src/game/{classes,utilities,season,comps}.ts` when the
season or meta shifts - no logic changes.

### PWA / mobile

There is no native app, no React Native, no Capacitor - mobile support is entirely the web PWA:

- `public/manifest.json` - standalone display mode, installable to a phone home screen.
- `public/sw.js` - service worker, currently handles `push` and `notificationclick` (shows/focuses
  the app on a push event) but does **not** cache the app shell, so it is installable but not
  offline-capable yet.
- `src/components/SwRegister.tsx` - registers the service worker client-side, mounted in the root
  layout.
- Push subscriptions are managed per-user in `/profile` (`src/components/profile/NotificationsTab.tsx`).

## Architecture notes

- **No separate backend** - Next.js Route Handlers under `src/app/api/**/route.ts` are the entire
  server side; `src/data/source.ts` is the single Prisma-backed data-access layer everything else
  calls through.
- **Live board updates use SSE, not WebSockets** - `src/app/api/stream/board/route.ts` streams the
  full group list on a fixed interval; the client consumes it with the native `EventSource` API.
- **Domain logic is pure and config-driven** - `src/game/*` (comp analysis, rating, roles, season
  data) has no Prisma imports and is unit-tested in isolation from the DB layer.

## Setup

```bash
npm install
npm run setup     # prisma db push + seed (SQLite, zero infra)
```

You need two sets of API credentials in `.env` (copy `.env.example`):

- **Battle.net** (login + character sync): create a client at
  <https://develop.battle.net/access/clients>, redirect URL
  `http://localhost:3200/api/auth/callback/battlenet`. Sets `BLIZZARD_CLIENT_ID/SECRET/REGION`.
- **Warcraft Logs** (parse analysis only - no user login, just the app's own client-credentials
  token): create a client at <https://www.warcraftlogs.com/api/clients/> ("Public client"
  unchecked). Sets `WCL_CLIENT_ID/SECRET`.

```bash
npm run dev       # http://localhost:3200
```

Tests: `npm test` (vitest - comp engine, rating, Solo Queue matcher, plus the whole ported WCL
analysis suite).

### Prod with Postgres (optional)

Set `DATABASE_URL` to the Postgres URL, change the `provider` in `prisma/schema.prisma` to
`postgresql`, then:

```bash
docker compose up -d
npm run setup
```

## Deploying to Azure

Target: **Azure App Service** (Linux, Node 20), deployed via the included
`.github/workflows/azure-deploy.yml`. App Service was picked over Container Apps/Static Web Apps
because this app is a single Node process with no Docker step today, and Static Web Apps' managed-
Functions backend is serverless (breaks the SSE board stream and the Solo Queue matcher's in-
memory interval - see "Scaling to more users" below, which already assumes a single long-running
process).

### 1. Database - staying on SQLite for now

While the app is small, this deploy keeps SQLite instead of standing up Postgres - one less moving
piece and one less thing costing student credit. Two things to get right, or the database silently
resets on every deploy or misbehaves under load:

1. **Put the DB file outside the deployed code directory.** Every deploy replaces
   `/home/site/wwwroot` (where the repo's code lands) wholesale - if `DATABASE_URL` still points at
   `prisma/dev.db` inside that folder, each deploy wipes the database. Instead point it at Azure's
   persistent `/home` mount, which survives both restarts and redeploys:
   `DATABASE_URL="file:/home/data/prod.db"` (Application Settings - see step 2 below). Create the
   file once by running `npx prisma db push` locally against that same path over SSH (*App Service
   → SSH*, in the portal) after the first deploy, or just let the app create it on first write.
2. **Known risk: `/home` is network storage (Azure Files/SMB), not local disk.** SQLite's file
   locking wasn't designed for network file shares, and this is a well-known source of intermittent
   `SQLITE_BUSY` / "database is locked" errors under concurrent writes, even from a single app
   instance. At low traffic (a handful of concurrent users, matching student-project scale) this is
   usually fine in practice - but it's the **first thing to suspect** if you start seeing random
   500s under load, and it's the trigger to stop deferring the Postgres migration (see "Prod with
   Postgres" above and "Scaling to more users" below - same one-line `schema.prisma` provider
   switch, just pointed at Azure Database for PostgreSQL instead of a local docker-compose
   container when the time comes).

### 2. App Service

1. Create the plan + app: **Basic B1** or higher, Linux, **Node 20 LTS** runtime. Don't use the
   **Free F1** tier - it doesn't support *Always On*, so the App Service unloads after ~20 minutes
   idle and takes the SSE board tick / Solo Queue matcher's in-memory interval down with it until
   the next request wakes it back up.
2. *Configuration → Application settings*: add every variable from `.env.example` with real
   production values (fresh `AUTH_SECRET` - don't reuse your local dev one; real
   `BLIZZARD_CLIENT_ID/SECRET`, `WCL_CLIENT_ID/SECRET`, VAPID keys; `DATABASE_URL` from step 1;
   leave `ALLOW_DEV_LOGIN` unset), plus `SCM_DO_BUILD_DURING_DEPLOYMENT=true` (lets Azure's Oryx
   builder run `npm install`/`npm run build` itself on deploy - the workflow ships source only, not
   a prebuilt `node_modules`). Don't set `PORT` yourself - Azure injects it, and `npm start`
   (`package.json`) already reads `$PORT` with a `3200` fallback for local use.
3. *Configuration → General settings*: turn **Always On** on.
4. *Scale out*: leave the instance count at **1**, autoscale off. "Scaling to more users" below
   covers exactly why - the SSE tick, Solo Queue matcher, and web-push sends are all in-process
   state that doesn't survive (or coordinate across) more than one instance yet.

### 3. Battle.net OAuth

Add a second redirect URL on your Battle.net API client (the same one used for local dev, or a
separate prod client if you'd rather keep them apart):
`https://<app-name>.azurewebsites.net/api/auth/callback/battlenet`. Nothing else to configure -
`src/auth.ts` already sets `trustHost: true`, so Auth.js derives the correct callback origin from
Azure's forwarded `Host` header automatically; no `AUTH_URL` needed.

### 4. GitHub Actions

1. Azure Portal → your App Service → *Deployment Center* (or `az webapp deployment list-publishing-profiles`)
   → download the publish profile.
2. Add it as a GitHub repo secret named `AZURE_WEBAPP_PUBLISH_PROFILE` (*Settings → Secrets and
   variables → Actions*).
3. Edit `AZURE_WEBAPP_NAME` at the top of `.github/workflows/azure-deploy.yml` to your real App
   Service name.
4. Push to `main` - the workflow tests and typechecks, then deploys; Azure builds and starts the
   app from there.

## Scaling to more users

The app is built for a single small deployment out of the box; these are the concrete points that
break first as usage grows, in the order they'll bite:

1. **SQLite → Postgres is a hard requirement, not an optimization.** SQLite can't handle
   concurrent writers past a handful of simultaneous users - and on Azure specifically, it's on
   `/home`'s network-backed storage (see "Deploying to Azure" above), which adds flaky file-locking
   under concurrent writes on top of that ceiling. The Postgres path already exists
   (`docker-compose.yml`, one `provider` line in `schema.prisma`) - it just needs to be the default
   in prod, not opt-in.
2. **The SSE board stream re-queries the DB per connected client, every 4 seconds.** `GET
   /api/stream/board` calls `listGroups()` on its own interval for every open tab - at N
   concurrently connected clients that's N full group-list queries every 4s, with no shared cache.
   Fix: one server-side interval (or write-triggered invalidation) that queries once and broadcasts
   to all connected SSE clients, instead of each client driving its own query.
3. **In-memory interval state doesn't survive horizontal scaling.** The SSE stream's `setInterval`
   and the Solo Queue matcher that piggybacks on it only work correctly within a single Node
   process. Running more than one instance needs either sticky sessions for SSE connections or a
   shared broker (Redis pub/sub) so all instances see the same state.
4. **Move background work off the request path.** `web-push` sends and Solo Queue matching passes
   are currently fire-and-forget promises inside route handlers / the SSE tick. At scale these
   belong on a real job queue (e.g. BullMQ + Redis) so a slow push provider or a large matching
   pass can't stall a request.
5. **Add indexes as data grows.** `Group.status`, `Application.status` + `groupId`, and
   `SoloQueueEntry.status` are all filtered on every board/matching query and currently rely only
   on Prisma's implicit primary/foreign-key indexes.

## Suggested improvements

- **Test coverage gap**: `src/data/source.ts`, the entire DB access layer, has no automated tests
  today - only the pure `src/game/*` logic and the WCL analysis engine are covered.
- **No CI configuration** in the repo - `npm test`/`npm run lint`/`npm run build` aren't run
  automatically on push or PR.
- **No active-route highlighting** in the navbar (`NavLink` in `src/app/layout.tsx`) - a small UX
  gap now that there are several top-level tabs.
- **Raid Parses UI**: the backend (`src/server/wcl/raid.js`, `/api/wcl/raid/*`) is ported and
  working but has no React UI yet - same shape of feature as the M+ side, left for a follow-up.
- **PWA isn't offline-capable**: `sw.js` only handles push events, not asset caching. A basic
  cache-first strategy for the app shell would let the installed app open (even to a "you're
  offline" state) without a network round trip.
- **No rate limiting** on API routes - worth adding before opening the app up publicly at scale.
