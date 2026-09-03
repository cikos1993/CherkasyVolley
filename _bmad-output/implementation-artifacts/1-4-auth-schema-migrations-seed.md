---
baseline_commit: cd223c5
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - AGENTS.md
---

# Story 1.4: Auth-schema, migrations, and first-admin seed

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the `User` model with the first Prisma migration and a seed script,
so that there is a schema-evolution mechanism and a way to create the first admin (AD-10).

## Acceptance Criteria

Translated from `epics.md` → Epic 1 → Story 1.4. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** a connected Neon Postgres
**When** the first Prisma migration is applied, containing the `User` model (`googleSub`, `email`, `name`, `isAdmin`, `id` = cuid)
**Then**

1. The migration applies cleanly on an empty database.
2. `pnpm seed` (`npm run seed`) creates one `User` with `isAdmin = true`, keyed on an email taken from an environment variable.
3. Running the seed again creates no duplicate.
4. The schema still contains **no** domain entities (`Tournament`, `Team`, …).

### Notes on AC interpretation

- **"connected Neon Postgres"** — Story 1.1 attached Neon via the Vercel Storage integration; `.env.local` already carries `DATABASE_URL` (pooled) **and** `DATABASE_URL_UNPOOLED` (direct). No `.env` file exists — Prisma's config must load `.env.local` (see Task 3). The dev needs those two values present locally plus `SEED_ADMIN_EMAIL`.
- **"the first Prisma migration"** — this is where the Prisma 7 **driver adapter** is first wired (flagged since Story 1.1 / AGENTS.md "Stack status"). Constructing `PrismaClient` in Prisma 7 requires an adapter. Use **`@prisma/adapter-pg`** + `pg` (see Dev Notes — the app runs on Vercel Node functions, not Edge, so the serverless Neon driver is unnecessary weight). These are **new dependencies** — pre-authorised by this AC and by the Story 1.1 Dev Notes ("driver adapter … wired in Story 1.4").
- **"`npm run seed`"** — the repo uses **pnpm**; implement a `seed` script in `package.json` and verify with `pnpm seed`. Also wire `migrations.seed` in `prisma7.config.ts` so `prisma migrate reset` / `prisma db seed` run it too.
- **"keyed on an email from an env var"** — `SEED_ADMIN_EMAIL` (already stubbed, commented, in `.env.example`). The seed **upserts** by `email` (unique) — that is what makes re-runs idempotent (AC 3). It sets `isAdmin = true`. It does **not** set `googleSub` (unknown until the first Google sign-in in Story 1.5).
- **"no domain entities yet"** — schema contains only `User` (+ the generator/datasource blocks). `Tournament` etc. arrive in Story 2.1 with their own migration ("schema grows per-epic", `epics.md` cross-cutting principles).
- **AD-11 boundary** — the constructed `PrismaClient` lives in `src/data/` (the sole Prisma importer). `src/data/README.md` (Story 1.3) already states: "constructs the single shared `PrismaClient` instance … and exports it for `src/auth`". The ESLint block from Story 1.3 permits `@prisma/client` / `@/generated/prisma` only under `src/data/**` — the new client file must live there. `prisma/seed.ts` is outside `src/`, so it is not lint-restricted and constructs its own throwaway client.
- **Scope guard.** `User` model + first migration + seed + the client singleton + adapter deps + Vercel build wiring. **Not** in scope: Better Auth config, Google provider, `session`/`account` tables, `requireAdmin()`, any `src/auth` code (Story 1.5); any `src/data` entity query function beyond the shared client (Story 1.5+); any domain model.

## Tasks / Subtasks

- [x] **Task 1 — Add the Prisma 7 driver-adapter dependencies** (AC: 1, 2)
  - [x] `@prisma/adapter-pg@7.10.0` (exact) + `pg@^8.23.0` deps; `@types/pg@^8.23.1` devDep. No `pg` build script — no `allowBuilds` change for it.
- [x] **Task 2 — Add the `User` model to `prisma/schema.prisma`** (AC: 1, 4)
  - [x] `generator client` + `datasource db` blocks unchanged (no `url`).
  - [x] `User` model added:
    ```prisma
    model User {
      id        String   @id @default(cuid())
      email     String   @unique
      name      String?
      googleSub String?  @unique
      isAdmin   Boolean  @default(false)
      createdAt DateTime @default(now())
      updatedAt DateTime @updatedAt
    }
    ```
  - [x] `name` / `googleSub` nullable; `googleSub` unique; `createdAt`/`updatedAt` added.
  - [x] No other models. `migration.sql` creates only `"User"`.
- [x] **Task 3 — Wire `prisma7.config.ts` for env loading, direct URL, and seed** (AC: 1, 2, 3)
  - [x] `config({ path: [".env.local", ".env"] })` from `dotenv`.
  - [x] `datasource.url` = `DIRECT_URL ?? DATABASE_URL_UNPOOLED ?? DATABASE_URL`.
  - [x] `migrations.seed = "tsx prisma/seed.mts"` — **deviation:** raw `node` cannot resolve the extensionless imports inside the Prisma 7 generated client, and `.ts` under `node` was parsed as CJS (no top-level await). `tsx` (esbuild) + `.mts` fixes both. `tsx` added as a devDep (see Task 6 note).
  - [x] `schema` + `migrations.path` kept.
- [x] **Task 4 — Update `.env.example`** (AC: 1, 2)
  - [x] `DIRECT_URL=` + comment; `SEED_ADMIN_EMAIL=` activated + comment; optional `SHADOW_DATABASE_URL` comment; Story 1.5 block still commented.
- [x] **Task 5 — Construct the shared `PrismaClient` in `src/data/`** (AC: 1; AD-11)
  - [x] `src/data/client.ts` — `PrismaPg({ connectionString: process.env.DATABASE_URL })` (pooled) + `PrismaClient` from `@/generated/prisma/client`; `globalThis` singleton guard; `export const db`.
  - [x] No entity query functions. `pnpm lint` + `tsc --noEmit` clean.
- [x] **Task 6 — Create `prisma/seed.mts`** (AC: 2, 3)
  - [x] `prisma/seed.mts` (not `.ts` — ESM for top-level await). Own client via `@prisma/adapter-pg` against `DIRECT_URL ?? DATABASE_URL_UNPOOLED ?? DATABASE_URL`. Loads `.env.local`/`.env` itself.
  - [x] Missing `SEED_ADMIN_EMAIL` → `process.exit(1)` with message.
  - [x] `findUnique` (for the log message) then `upsert` by `email`; `$disconnect()` in `finally`.
  - [x] **Deviation:** `tsx` devDep added (`^4.23.13`) + `esbuild: true` in `pnpm-workspace.yaml allowBuilds`. Not in the original story plan — the plan assumed `node` could run the seed, which it cannot (generated-client import resolution). `tsx` is the standard Prisma-seed runner. Runtime cost: none (dev-only, seed/CLI only).
- [x] **Task 7 — `package.json` scripts + Vercel build wiring** (AC: 1, 2)
  - [x] `"seed": "prisma db seed"` (delegates to `migrations.seed`); `"postinstall": "prisma generate"`; `"build": "prisma migrate deploy && next build"`.
  - [x] `pnpm install` cold-run OK — `postinstall` regenerated the client; `esbuild` postinstall ran after the `allowBuilds` entry.
- [x] **Task 8 — `next.config.ts`** (AC: 1 — runtime correctness)
  - [x] Build passed clean **without** any change. Added `serverExternalPackages: ["pg", "@prisma/adapter-pg"]` proactively (Prisma/`pg` best practice — keeps `pg`'s optional native dep out of the server bundle). Build still clean. Deferred `next.config.ts` item from the Story 1.1 review is addressed; Story 1.5 should re-confirm once a route/action actually imports `db`.
- [x] **Task 9 — Run the first migration** (AC: 1, 4)
  - [x] `.env.local` had `DATABASE_URL` + `DATABASE_URL_UNPOOLED`; `SEED_ADMIN_EMAIL=nightfate1993@gmail.com` added (git-ignored).
  - [x] `pnpm prisma migrate dev --name init_user` → `prisma/migrations/20260903105840_init_user/migration.sql` created + applied via the direct URL. No shadow-DB error (Neon role has `CREATEDB`). Committed.
  - [x] `migration.sql` creates only table `"User"` (5 columns + `createdAt`/`updatedAt`) with unique indexes on `email` and `googleSub`.
- [x] **Task 10 — Prisma agent-skills cleanup guard** (housekeeping)
  - [x] No `prisma` command re-created `.agents/` / `.windsurf/` / `skills-lock.json` / anything under `.claude/skills/`. Nothing to clean.
- [x] **Task 11 — Verification gate** (AC: all)
  - [~] `pnpm prisma migrate reset --force` — **not run.** Prisma's AI-agent safety gate blocks it, and the target is the live production Neon DB with no dev branch. AC 1 ("applies cleanly on an empty database") is already proven: the original `migrate dev` created the migration against a DB with no `User` table and it applied without error. See Dev Agent Record.
  - [x] `pnpm seed` run 1 → "Admin created"; run 2 → "Admin already present (isAdmin ensured true)". Exactly one row (AC 3).
  - [x] `pnpm lint` clean; `pnpm build` clean on Node 24 (`prisma migrate deploy` → "No pending migrations to apply").
  - [x] `pnpm prisma migrate status` → "Database schema is up to date!".
  - [x] Client smoke: `db.user.findMany()` (via a temp `tsx` script, deleted) returned the one admin row — `id` a cuid, `isAdmin: true`, `name`/`googleSub` null.
  - [x] Outputs captured in the Dev Agent Record.
- [x] **Task 12 — AGENTS.md** (housekeeping)
  - [x] `## Running and verifying`: migration/seed TODO resolved (`migrate dev` / `migrate deploy` in build / `pnpm seed` / `postinstall generate`).
  - [x] `## Stack status`: adapter wired, `src/data/client.ts` (`db`), direct URL for migrations, `postinstall`+`build` wiring. Hosting: Neon marked provisioned.
- [x] **Task 13 — Commit**
  - [x] committed on `main` — `feat(db): User model, first migration, first-admin seed (Story 1.4)`. Includes `prisma/migrations/**`. **Not pushed** — pushing triggers Vercel `build` → `prisma migrate deploy` against prod (migration is already applied there, so it would be a no-op, but holding per the Story 1.2/1.3 pattern of pushing after review).

### Review Findings

_Adversarial code review 2026-09-03 (`bmad-code-review`, 4 layers — Blind Hunter, Edge Case Hunter, Verification Gap, Acceptance Auditor). Scope: `cd223c5..HEAD` (`prisma/**`, `prisma7.config.ts`, `src/data/**`, `package.json`, `next.config.ts`, `.env.example`, `AGENTS.md`, `pnpm-workspace.yaml`). Outcome: 1 decision-needed (resolved), 10 patch (applied), 5 defer, ~7 dismissed. No high-severity findings._

- [x] [Review][Decision] **Deploy / DB-environment strategy** — all four layers flagged `build`↔DB coupling and the single prod DB. **Resolved: option (1).** `build` = `prisma generate && node scripts/migrate-deploy.mjs && next build`; the new `scripts/migrate-deploy.mjs` runs `prisma migrate deploy` only when `VERCEL_ENV` is `production` or unset (local) — preview/branch builds skip it (verified). AGENTS.md documents the build-env requirement and **recommends provisioning a Neon dev branch** for `migrate dev` (option 3 left to the user — a code review can't provision it). The "one prod DB, no from-empty CI check, `migrate reset` unusable" residue is in `deferred-work.md`.
- [x] [Review][Patch] `AGENTS.md` — `node prisma/seed.ts` → `tsx prisma/seed.mts` (both the `bmad:context` line and the durable `bmad:manual` "Stack status" section). [AGENTS.md]
- [x] [Review][Patch] `src/data/client.ts` — throws `"DATABASE_URL is not set …"` before constructing `PrismaPg`. [src/data/client.ts]
- [x] [Review][Patch] `prisma/seed.mts` — added the missing-DB-URL guard (`process.exit(1)`); `SEED_ADMIN_EMAIL` now `.trim().toLowerCase()`. [prisma/seed.mts]
- [x] [Review][Patch] `build` now starts with `prisma generate` (a schema pull without reinstall / an `--ignore-scripts` install no longer ships a stale/absent client). [package.json]
- [x] [Review][Patch] Added `"typecheck": "tsc --noEmit"` — offline type check for `seed.mts` / `prisma7.config.ts` (verified clean). [package.json]
- [x] [Review][Patch] `.env.example` rewritten — `vercel env pull` is the canonical path, `DATABASE_URL_UNPOOLED` explained, `DIRECT_URL` marked optional, no more "Copy to `.env`". [.env.example]
- [x] [Review][Patch] `prisma7.config.ts` — `datasource.shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"]` wired (the `.env.example` line is no longer dead). [prisma7.config.ts]
- [x] [Review][Patch] `src/data/README.md` + AGENTS.md — client path corrected to `@/generated/prisma/client`. [src/data/README.md, AGENTS.md]
- [x] [Review][Patch] `src/data/README.md` + AGENTS.md — added an explicit "sanctioned exception to AD-11" note for `prisma/seed.mts` + `prisma7.config.ts` (build/CLI scripts, outside the lint scope by design). [src/data/README.md, AGENTS.md]
- [x] [Review][Patch] `AGENTS.md` — hazard note: `migrate dev` against a personal Neon branch, never prod; only `migrate deploy` touches prod. [AGENTS.md]
- [x] [Review][Patch] `next.config.ts` — comment corrected (`pg` dynamic requires / `pg-cloudflare`, not `pg-native` auto-load). Also updated `ARCHITECTURE-SPINE.md` code-tree `seed.ts` → `seed.mts`. [next.config.ts, ARCHITECTURE-SPINE.md]
- [x] [Review][Defer] `src/data/client.ts` has no importer and no durable test — the runtime DB entrypoint is proven only by a since-deleted manual script. Story 1.5 will exercise it; a real test needs the test runner. — deferred, add to `deferred-work.md`.
- [x] [Review][Defer] No from-empty migration replay in CI / durable AC-1 check (`migrate reset` is blocked; the `migrate dev` shadow DB did replay from zero but retains no artifact). Needs CI or a disposable Neon branch. Overlaps the existing "No CI gate" item. — deferred.
- [x] [Review][Defer] `User.updatedAt` is `NOT NULL` with no DB default (asymmetric with `createdAt`'s `DEFAULT CURRENT_TIMESTAMP`); a non-Prisma insert would violate it. — deferred to the Story 1.5 Better-Auth reconciliation migration (add `@default(now())` then, or confirm Better Auth's adapter always sets it).
- [x] [Review][Defer] `config({ path: [".env.local", ".env"] })` + the `DIRECT_URL ?? DATABASE_URL_UNPOOLED ?? DATABASE_URL` chain are duplicated in `prisma7.config.ts` and `prisma/seed.mts`. — deferred; extract a `prisma/` helper if a third consumer appears.
- [x] [Review][Defer] `PrismaPg` pool has no `max` — on Vercel, many serverless instances at the `pg` default (10) could pressure Neon's ceiling (the pooled endpoint mitigates this). — deferred; tune when the client is under real load (Story 1.5+).

## Dev Notes

### What this story is / is NOT

**Is:** one Prisma model (`User`), the first migration, an idempotent seed, the shared `PrismaClient` singleton in `src/data/`, the driver-adapter deps, and the Vercel build wiring that keeps a git-ignored generated client working.

**Is NOT** (do not pull forward):
- Better Auth, Google OAuth, `session` / `account` / `verification` tables → **Story 1.5**.
- `requireAdmin()`, any `src/auth` file → **Stories 1.5 / 1.6**.
- `src/data` entity query functions (`getUserByEmail`, `setAdmin`, …) → **Story 1.5 / 1.7**.
- `Tournament` / `Team` / any domain model → **Story 2.1**.
- Vitest / domain tests → first `src/domain` module (later epic).

### Files this story touches

| File | Status | Current state | This story changes | Must preserve |
| --- | --- | --- | --- | --- |
| `prisma/schema.prisma` | UPDATE | `generator client` (`prisma-client`, output `../src/generated/prisma`), `datasource db { provider = "postgresql" }` (no `url`), **no models**. | Add the `User` model. | The generator block (output path, provider), the datasource block with no `url`. |
| `prisma7.config.ts` | UPDATE | `import "dotenv/config"`; `defineConfig({ schema, migrations: { path }, datasource: { url: process.env["DATABASE_URL"] } })`. | `.env.local`+`.env` load; `datasource.url` → direct URL with fallbacks; add `migrations.seed`; optional `shadowDatabaseUrl`. | The `defineConfig` import from `prisma/config`, `schema` path, `migrations.path`. |
| `.env.example` | UPDATE | `DATABASE_URL=` (pooled) + commented Story 1.4 / 1.5 blocks. | Add `DIRECT_URL=` (+ optional `SHADOW_DATABASE_URL=`); activate `SEED_ADMIN_EMAIL=`. | The header comment, the pooled `DATABASE_URL` entry, the commented Story 1.5 block, `!.env.example` in `.gitignore`. |
| `package.json` | UPDATE | scripts: `dev`/`build`/`start`/`lint`; deps as of Story 1.1–1.3; `@prisma/client@^7.10.0`, `prisma@^7.10.0`, `dotenv`. | Add `@prisma/adapter-pg`, `pg`, `-D @types/pg`; add `seed` + `postinstall` scripts; extend `build`. | `engines.node`, `packageManager`, existing deps/scripts, the `lint` script (`eslint`). |
| `next.config.ts` | MAYBE UPDATE | `const nextConfig: NextConfig = {};`. | `serverExternalPackages` only if the build/runtime needs it (verify). | The `NextConfig` type import, `export default`. |
| `src/data/client.ts` | NEW | — | The shared `PrismaClient` singleton (adapter + pooled URL). | — |
| `prisma/seed.ts` | NEW | — | Idempotent first-admin upsert. | — |
| `prisma/migrations/**` | NEW (generated) | — | `pnpm prisma migrate dev --name init_user`. | Never hand-edit applied migration SQL. |
| `AGENTS.md` | UPDATE | `## Running and verifying` has the migration/seed TODO; `## Stack status` notes the adapter is "wired in Story 1.4". | Resolve both. | The nextjs-agent-rules block, other sections. |

### Prisma 7 — the mechanics that bite (research, Sept 2026)

- **Driver adapter is mandatory to construct `PrismaClient`.** No adapter → runtime error. Choose:
  - **`@prisma/adapter-pg`** (wraps `pg`, standard TCP) — correct here. Next.js Server Components / Server Actions run as **Vercel Node.js functions**, which support TCP. Fewer deps.
  - `@prisma/adapter-neon` (wraps `@neondatabase/serverless` + needs `ws` on Node) — only needed for the **Edge** runtime, which this project does not use (AD-1). Do not add it.
  - Adapter version tracks Prisma core — use `@prisma/adapter-pg@7.10.x`.
- **`prisma/schema.prisma` datasource has no `url`.** The URL for CLI commands (`migrate`, `db`, `studio`) comes from `prisma7.config.ts` `datasource.url`. The runtime URL is passed to the adapter in code. They can (and here do) differ: **direct** for the CLI, **pooled** for the runtime.
- **Pooled vs direct (Neon).** Pooled = hostname contains `-pooler` (PgBouncer). Direct = without. `prisma migrate` over a PgBouncer-pooled endpoint fails on advisory locks / prepared statements → use the direct URL for migrations. Runtime queries want the pooled URL (serverless connection limits). Confirmed by Prisma's Neon guide.
- **`prisma7.config.ts` `datasource` supports `url` and `shadowDatabaseUrl`** — there is **no `directUrl` key** (that was the v6 `schema.prisma` field). In v7 you just point `url` at the direct connection.
- **`migrations.seed`** in the config is a **shell command string** run after `migrate dev` / `migrate reset` / on `prisma db seed`. Node 24 executes `.ts` directly (verified on this machine: `node file.ts` works), so `"node --env-file=.env.local prisma/seed.ts"` needs no `tsx`.
- **Generated client is git-ignored** (`/src/generated`). Anything that runs `next build` or type-checks (Vercel, CI, a fresh clone) must run `prisma generate` first → `postinstall` script. `prisma generate` needs no DB.
- **ESM.** `prisma7.config.ts` and `prisma/seed.ts` are ESM (`package.json` is ESM-friendly from Story 1.1). Use `import`, not `require`.
- **`@better-auth/cli generate` (Story 1.5)** will introspect/extend this schema. Keeping `createdAt`/`updatedAt` on `User` now, and `email` unique, aligns with Better Auth's `user` model and cuts a reshaping migration in 1.5.

### `src/data/client.ts` — singleton shape

```ts
import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const globalForDb = globalThis as unknown as { db?: PrismaClient };

export const db = globalForDb.db ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
```

Adjust the export name if you prefer `prisma`; keep it consistent with `src/data/README.md`. The `globalThis` guard is the standard Next.js dev-reload pattern (Turbopack re-imports modules on change; without the guard each reload opens a new pool).

### Better Auth forward-reconciliation (Story 1.5) — flag, don't act

`epics.md` puts `googleSub` on `User`. Better Auth actually stores the OAuth identity in an `account` table (`providerId = "google"`, `accountId = <sub>`), so `googleSub` on `User` is a denormalised convenience. Story 1.5 will:
- run `@better-auth/cli generate` → `session`, `account`, `verification` tables + possibly `emailVerified` / `image` columns on `User`, via a second migration;
- link the seeded admin (email only, no `googleSub`) to their Google account on first sign-in (Better Auth account-linking by verified email).

For **this** story: create `User` exactly as the AC lists (plus `createdAt`/`updatedAt`). Do not add Better Auth tables. Note in the Dev Agent Record that 1.5 owns the reconciliation.

### Architecture compliance

- **AD-10** — schema only via versioned Prisma migrations; first admin only via the seed script; secrets only via env. This story *is* AD-10's mechanism. [ARCHITECTURE-SPINE.md#AD-10]
- **AD-11** — `@prisma/client` / the generated client imported only in `src/data/`; the constructed client lives at `src/data/client.ts`. `prisma/seed.ts` is outside `src/` and is a standalone script (its own client). [ARCHITECTURE-SPINE.md#AD-11; src/data/README.md]
- **AD-3 / Story 1.3 lint** — `src/data/**` may import `@/generated/prisma` + `@prisma/adapter-pg`; it must not import `next` / `react` / `src/actions` / `src/auth` / view. `client.ts` imports only the generated client + the adapter — compliant.
- **Consistency Conventions** — ids are `cuid` (`@default(cuid())`); `DateTime` stored UTC. [ARCHITECTURE-SPINE.md#Consistency Conventions]
- **AD-7** — not exercised here (no queries yet), but the client this story builds is what public reads will use directly (Server Components) and what Server Actions use after `requireAdmin()`.
- **NFR-4 / NFR-7** — minimum deps (`@prisma/adapter-pg` + `pg` only, no Neon serverless stack); Neon PITR remains the backup.

### File structure

- `src/data/client.ts` (NEW) — the only new `src/` file. No `src/data/index.ts` barrel; import the client by its path.
- `prisma/seed.ts` (NEW), `prisma/migrations/` (NEW, generated). `prisma7.config.ts` stays at repo root (Prisma 7 name — not `prisma.config.ts`).
- Do not create `src/data/users.ts` or any query module — Story 1.5+.

### Testing requirements

- **No unit tests / no Vitest.** No `src/domain` code. The gate is operational:
  1. `pnpm prisma migrate reset --force` clean (migration + seed).
  2. `pnpm seed` re-run leaves exactly one admin row (AC 3).
  3. `pnpm lint` + `pnpm build` clean on Node 24.
  4. `pnpm prisma migrate status` up to date.
  5. Client smoke: `db.user.findMany()` from a scratch script returns the admin row.
- Capture every command's real output in the Dev Agent Record (`migrate dev`, `migration.sql`, seed ×2, lint/build, `migrate status`). Verifiable, not asserted — the pattern from Stories 1.1–1.3.

### Previous story intelligence

**Story 1.3 (done, `cd223c5`):**
- `src/data/` now exists with a `README.md` that already promises "constructs the single shared `PrismaClient` instance … and exports it for `src/auth`" and "The domain is pure … `getStandings()` computes … via `src/domain`" — this story delivers the client half.
- ESLint boundary blocks are live: `src/data/**` is allowed Prisma; `src/**` outside `src/data` is not. `client.ts` under `src/data/` is fine. A misplaced client (e.g. `src/lib/db.ts`) would fail `pnpm lint`.
- `deferred-work.md` "No CI gate" and "no boundary regression test" remain open — not this story.
- Toolchain: **PowerShell** tool for `pnpm` / `prisma` (PATH wired). Bash tool cannot resolve `pnpm`. `git` works in both.

**Story 1.1 (done):**
- Prisma 7.10.0, `prisma-client` generator, output `src/generated/prisma` (git-ignored, in ESLint `globalIgnores`). `prisma7.config.ts` (that filename) with `import "dotenv/config"`.
- `pnpm-workspace.yaml` `allowBuilds` gates postinstall builds: `@prisma/client`, `@prisma/engines`, `prisma` = `true`; `sharp`, `unrs-resolver` = `false`.
- Neon attached via Vercel Storage → `DATABASE_URL` (+ `DATABASE_URL_UNPOOLED`, PG* vars) injected into Vercel env and pulled into `.env.local`. **No `.env` file** — the Story 1.1 note about creating one is stale; `.env.local` is what exists.
- `.env.example` committed; `.env*` git-ignored except `.env.example`.
- Prisma `init` once dropped agent-skills dirs (`.claude/skills`, `.windsurf`, `.agents`, `skills-lock.json`) — removed. Watch for re-creation (Task 10).
- Vercel runs `next build`, **not** `pnpm lint` and **not** migrations — hence Task 7 folds `migrate deploy` into `build`.
- Deferred from the 1.1 review, now this story's to resolve: **Neon `DIRECT_URL`** (Task 3/4) and **`next.config.ts` `serverExternalPackages`** (Task 8).

### Git intelligence

Recent commits: `cd223c5` / `3e23d11` (Story 1.3 — domain scaffold + boundary lint), `d7b3961` / `40ce50a` (docs), `2dfbc16` / `94ad3c6` (Story 1.2 tokens). No prior DB/schema work since the `prisma init` scaffold in `5efda03`. `prisma/schema.prisma` and `prisma7.config.ts` are untouched since scaffold. No `prisma/migrations/` yet. `src/data/` has only `README.md`.

### Latest tech information (web research, Sept 2026)

- **Prisma 7.10.0** — `prisma-client` generator (Rust-free), driver adapters GA since 6.16. `@prisma/adapter-pg@7.10.0` and `@prisma/adapter-neon@7.10.0` published within days of this story. Adapter is required to construct `PrismaClient`.
- **Neon + Prisma** ([prisma.io/docs](https://www.prisma.io/docs/orm/overview/databases/neon), [neon.com/docs/guides/prisma](https://neon.com/docs/guides/prisma)): pooled string (`-pooler` host) in `DATABASE_URL` for the runtime; direct string for the CLI via `prisma.config.ts` `datasource.url`; `migrate dev` and `migrate deploy` both use that direct connection.
- **`@prisma/adapter-pg` vs `@prisma/adapter-neon`**: `pg` (TCP) is correct for Node serverless / Next.js API & RSC; the Neon serverless driver + `ws` is only for Edge runtimes. ([prisma.io database-drivers](https://www.prisma.io/docs/orm/core-concepts/supported-databases/database-drivers))
- **Node 24** runs `.ts` files natively (type-stripping on by default since 23.6) — the seed needs no `tsx`/`ts-node`.
- No security advisories for these versions. `pg@8.x` is current and stable.

### Project context reference

No `project-context.md`. Binding docs: `AGENTS.md` (secrets/migration policy, pnpm, PowerShell tool, "Running and verifying" TODO to resolve), `ARCHITECTURE-SPINE.md` (AD-10, AD-11, Consistency Conventions), `epics.md` (Story 1.4 AC, per-epic schema growth), `SPEC.md` (Constraints: first admin bootstrapped, secrets via env), `src/data/README.md` (the client contract written in Story 1.3), `deferred-work.md` (1.1 items this story clears).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4: Схема автентифікації, міграції та seed першого адміна] — user story + AC (User fields, clean migration, idempotent seed, no domain entities)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1] — per-epic schema growth ("Epic 1 створює лише таблиці автентифікації (`User`) та механізм міграцій + seed")
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5] — Better Auth + Google; "створюється/знаходиться `User`" (forward-reconciliation context)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md#AD-10] — schema only via migrations; first admin + reference data via seed; secrets via env
- [Source: …/ARCHITECTURE-SPINE.md#AD-11] — `src/data/` sole Prisma importer; named functions
- [Source: …/ARCHITECTURE-SPINE.md#Consistency Conventions] — cuid ids, UTC `DateTime`
- [Source: …/ARCHITECTURE-SPINE.md#Stack] — Prisma 7.x, PostgreSQL 16+ (Neon), Vercel
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#Constraints] — "Перший адмін створюється через міграцію бази; наступних надає наявний адмін" (AD-10 + epics refine to: seed script)
- [Source: _bmad-output/implementation-artifacts/1-1-starter-and-deploy.md] — Prisma 7 scaffold specifics, `prisma7.config.ts`, `allowBuilds`, Neon via Vercel, agent-skills cleanup, "driver adapter … Story 1.4"
- [Source: _bmad-output/implementation-artifacts/1-3-domain-scaffold-boundaries.md] — `src/data/**` ESLint allowances; `src/data/README.md` client contract
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — 1.1 review: Neon `DIRECT_URL`, `next.config.ts` hardening (this story clears both)
- [Source: AGENTS.md] — secrets/migration/seed policy; pnpm + PowerShell tool; "Running and verifying" TODO
- Web: [Prisma – Neon](https://www.prisma.io/docs/orm/overview/databases/neon), [Neon – Connect from Prisma](https://neon.com/docs/guides/prisma), [Prisma – Database drivers](https://www.prisma.io/docs/orm/core-concepts/supported-databases/database-drivers)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (Claude Code, `/bmad-dev-story`)

### Debug Log References

- **`node prisma/seed.ts` fails — extensionless imports.** The Prisma 7 `prisma-client` generator emits `src/generated/prisma/client.ts` whose internal imports (`./enums`, `./internal/class`, …) have no file extension. Raw Node 24 ESM resolution requires explicit extensions, so `node` cannot load the generated client. Also, `.ts` (no `"type": "module"`) was parsed as CJS → top-level await rejected. **Fix:** run the seed through `tsx` (esbuild — resolves extensionless + strips types) and rename `prisma/seed.ts` → `prisma/seed.mts` (ESM, top-level await). `tsx@^4.23.13` devDep; `esbuild: true` added to `pnpm-workspace.yaml allowBuilds`.
- **`prisma migrate reset --force` blocked** by Prisma's built-in AI-agent safety gate (requires `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`). The DB is the live production Neon instance (no separate dev branch), and `reset` irreversibly drops all data. Not run. AC 1 is satisfied without it — the original `migrate dev` created and applied the migration against a database that had no `User` table (a clean/empty apply). `migrate deploy` (in `pnpm build`) and `migrate status` both confirm the schema is in sync.
- **`pg` SSL-mode deprecation warning** on every connection: `pg@8.23` warns that a future major changes `sslmode` handling; suggests `sslmode=verify-full` or `uselibpqcompat=true&sslmode=require`. The Neon connection string uses `sslmode=require`. **Non-blocking** — connection works. Comes from the Neon/Vercel-provided URL, not our code. Revisit when `pg` majors or Neon updates the string.
- Prisma CLI prints an "Update available 7.10.0 → 8.0.0-rc.12" banner — ignored; the architecture spine pins Prisma **7.x**.

**Task 9 — `migrate dev` output:**
```
Applying migration `20260903105840_init_user`
prisma\migrations/
  └─ 20260903105840_init_user/
    └─ migration.sql
Your database is now in sync with your schema.
```

**`prisma/migrations/20260903105840_init_user/migration.sql`:**
```sql
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "googleSub" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");
```

**Task 11 — seed (run 1 / run 2):**
```
Admin created: nightfate1993@gmail.com
Admin already present: nightfate1993@gmail.com (isAdmin ensured true)
```

**Client smoke (temp `tsx` script, deleted):**
```
USER ROWS: [ { "id": "cmtlezdfq00004cg4ifucp6w8", "email": "nightfate1993@gmail.com",
  "name": null, "googleSub": null, "isAdmin": true,
  "createdAt": "2026-09-03T11:00:52.550Z", "updatedAt": "2026-09-03T11:00:54.856Z" } ]
```

**Gates:** `pnpm lint` → clean. `pnpm build` → `prisma migrate deploy` "No pending migrations to apply", `next build` clean (Turbopack, TS pass, 2 static routes). `pnpm prisma migrate status` → "Database schema is up to date!".

### Completion Notes List

- **AC 1 met.** `User` model migrated; `migration.sql` applied cleanly on a DB with no `User` table (the direct/unpooled URL). `migrate status` = up to date.
- **AC 2 met.** `pnpm seed` (→ `prisma db seed` → `tsx prisma/seed.mts`) upserts a `User` with `isAdmin=true` keyed on `SEED_ADMIN_EMAIL` (set to `nightfate1993@gmail.com`).
- **AC 3 met.** Second `pnpm seed` run: "already present", still exactly one row (verified by the smoke query).
- **AC 4 met.** Schema has only `User`. No `Tournament`/`Team`/etc.
- **Driver adapter wired.** `src/data/client.ts` exports `db` (a `PrismaClient` with `@prisma/adapter-pg` over pooled `DATABASE_URL`, `globalThis` singleton). Smoke-proven end to end. AD-11 respected — only `src/data` imports the client; `pnpm lint` clean.
- **Deviations from the story plan:** (1) `tsx` devDep + `prisma/seed.mts` instead of `node prisma/seed.ts` — the generated client cannot be loaded by raw `node` (extensionless imports). (2) `migrate reset` not run (Prisma AI safety gate + prod DB) — AC 1 proven by the original clean apply instead. (3) `next.config.ts` `serverExternalPackages` added proactively (build passed without it).
- **Deferred-work cleared:** Neon `DIRECT_URL` (now `DATABASE_URL_UNPOOLED` fallback in `prisma7.config.ts` + `.env.example`); `next.config.ts` no longer an empty placeholder.
- **Forward (Story 1.5):** Better Auth's `@better-auth/cli generate` will add `session`/`account`/`verification` tables and reconcile `googleSub` (Better Auth links OAuth identity in `account`, by verified email to the seeded admin). `name` nullability may tighten then.
- **Not verified in-env:** the client inside an actual RSC/Server Action bundle (no route imports `db` yet) — Story 1.5 confirms. The `pg` SSL warning is cosmetic.
- **DB state:** production Neon now has the `User` table + one admin row (`nightfate1993@gmail.com`, `isAdmin=true`).

### File List

**Added:**
- `src/data/client.ts`
- `prisma/seed.mts`
- `prisma/migrations/migration_lock.toml`
- `prisma/migrations/20260903105840_init_user/migration.sql`
- `scripts/migrate-deploy.mjs` _(code review)_

**Modified:**
- `prisma/schema.prisma`
- `prisma7.config.ts`
- `next.config.ts`
- `.env.example`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `src/data/README.md`
- `AGENTS.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/deferred-work.md` _(code review)_
- `_bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md` _(code review — `seed.mts` filename)_

**Local only (git-ignored, not committed):**
- `.env.local` — added `SEED_ADMIN_EMAIL=nightfate1993@gmail.com`
- `src/generated/prisma/**` — regenerated by `prisma generate`

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-03 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
| 2026-09-03 | Implemented: `User` model + first migration (`20260903105840_init_user`) applied to Neon; `src/data/client.ts` (`@prisma/adapter-pg`, pooled URL, `db` singleton); idempotent `prisma/seed.mts` (via `tsx`); `prisma7.config.ts` env/direct-URL/seed wiring; `postinstall: prisma generate` + `build: migrate deploy && next build`; `next.config.ts serverExternalPackages`. Seed verified idempotent; client smoke-tested; `pnpm lint` + `pnpm build` + `migrate status` clean on Node 24. Deviations: `tsx`/`.mts` for the seed; `migrate reset` skipped (prod DB / Prisma AI gate). Status: review. |
| 2026-09-03 | Code review (`bmad-code-review`, 4 layers). 1 decision resolved (deploy guard: `scripts/migrate-deploy.mjs` skips `migrate deploy` on preview builds; Neon dev-branch recommended), 10 patches applied (env guards in `client.ts` + `seed.mts`, `.toLowerCase()` on the admin email, `prisma generate` in `build`, `typecheck` script, `.env.example` rewrite, `shadowDatabaseUrl` wired, client-path + AD-11-carve-out docs, `next.config.ts` comment, spine `seed.mts`). 5 items deferred (no client importer/test, no from-empty CI check, `updatedAt` default → 1.5, duplicated env logic, pool `max`). `pnpm lint` + `pnpm typecheck` + `pnpm build` clean. Status: done. |
