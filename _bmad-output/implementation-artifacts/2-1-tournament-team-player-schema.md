---
baseline_commit: ac118f7
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - _bmad-output/specs/spec-cherkasy-volley/glossary.md
  - AGENTS.md
---

# Story 2.1: Tournament / Team / Player schema

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the tournament and team entities added by their own migration,
so that the rest of Epic 2 has something to build on (AD-11).

## Acceptance Criteria

Translated from `epics.md` → Epic 2 → Story 2.1. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** the schema in its post-Epic-1 state
**When** a migration is applied adding `Tournament` (`discipline`, `type`, `name`, `year`, `state`, `scoringPreset`, `teamCount`, `rounds`), `Team`, `TournamentEntry` (unique on `tournament` + `team`), `Player` (only `fullName` required)
**Then**

1. `discipline` is an enum `CLASSIC | BEACH`; `state` is an enum `DRAFT | GROUP_STAGE | PLAYOFF | COMPLETED`.
2. All reads and writes of these entities go through named functions in `src/data`.
3. A direct Prisma import outside `src/data` fails lint.

### Notes on AC interpretation

- **This is the Epic 2 sibling of Story 1.4** — a schema + migration story, no feature UI, no Server Actions. It adds the four entities and their enums, regenerates the Prisma client, and updates the boundary docs. The CRUD **functions** in `src/data` are written by the feature stories that need them (`createTournament` → 2.4, team directory → 2.6, entries → 2.7, players → 2.8). AC 2 and AC 3 are *rules that must hold from now on*, already enforced for AC 3 by the Story 1.3 ESLint block; AC 2 is a convention documented in `src/data/README.md`. Do **not** speculatively implement CRUD here.
- **Enums** (Prisma `enum`, Postgres native enum types):
  - `Discipline { CLASSIC BEACH }` — AD-9: `BEACH` exists in the type, no UI/actions in v1.
  - `TournamentType { CHAMPIONSHIP VETERAN WOMEN YOUTH }` — glossary "Тип турніру": Чемпіонат / Ветеранський чемпіонат / Жіночий чемпіонат / Юнаки і дівчата. English identifiers in the enum; the UA label mapping lives in the view layer (Story 2.4 builds the select).
  - `TournamentState { DRAFT GROUP_STAGE PLAYOFF COMPLETED }` — `@default(DRAFT)`. Changed only by `transitionTournament` (Story 2.3 / AD-8); never assigned directly. No transition Server Action in this story.
  - `ScoringPreset { CLASSIC CUSTOM }` — glossary "Система очок": пресет Класичний / Кастомний.
  - `MatchStage` and the `Match` / `SetScore` / `Group` / `GroupSlot` entities are **Epic 3** (Story 3.2) — not here (`epics.md` Epic 3: "Додає сутності `Group`, `GroupSlot`, `Match` (stage=GROUP), `SetScore` власною міграцією").
- **`Group` is NOT added here** even though Story 2.4's AC says "створюється турнір … з рівно однією `Group`". `epics.md` Epic 3 explicitly owns the `Group` migration. This tension is real: **Story 2.4 must resolve it** — either add a minimal `Group` model in 2.4's own migration when it implements `createTournament`, or read "one group" as the `teamCount` + the v1 single-group invariant with the `Group` row created at draw time (Epic 3). Flag it there; do not pre-empt here.
- **`Player` optional fields are free text** (PRD §4.3: "Опційні поля (вільний текст …): дата народження, місце народження, спортивний розряд, амплуа, зріст, вага"). So `birthDate` etc. are `String?`, **not** `DateTime?` / `Int?`.
- **`Team.name` uniqueness** — glossary: "Команда — багаторазова ідентичність (**назва**)". Make `name` `@unique` (a directory keyed by name). If Story 2.6 later needs same-name teams from different cities, it can relax this in its own migration — flag it as a decision. `TournamentEntry`'s `@@unique([tournamentId, teamId])` is mandated by the AC ("унікально `tournament`+`team`"), not optional.
- **Cascade / restrict:**
  - `TournamentEntry.tournament` → `onDelete: Cascade` (FR-6: "Видалення Турніру видаляє всі його Заявки … Склади").
  - `TournamentEntry.team` → `onDelete: Restrict` (you cannot delete a `Team` that is entered in a tournament; Story 2.6 owns team deletion rules).
  - `Player.entry` → `onDelete: Cascade` (FR-9: "Скасування Заявки видаляє Склад цієї заявки").
- **Table names** — lowercase `snake_case` `@@map` (Story 1.5 convention: `user`, `session`, …). `tournament`, `team`, `tournament_entry`, `player`. Models stay `PascalCase`. Fields `camelCase`. Ids `@default(cuid())`.
- **The migration touches the one production Neon database** (there is no dev branch — Story 1.4/1.5). It is **additive only** (`CREATE TYPE`, `CREATE TABLE`) — non-destructive. Still: **HALT and confirm with the user before running `prisma migrate dev`** (it applies to prod on this setup), per AGENTS.md policy.
- **Scope guard. In scope:** the four models + four enums in `schema.prisma`, one additive migration, `prisma generate`, `src/data/README.md` + `AGENTS.md` doc updates, a verification that the migration applies clean and the client types are right. **Not in scope:** any `src/data` CRUD function; any Server Action; any page or component; `Group` / `GroupSlot` / `Match` / `SetScore` / `MatchStage` (Epic 3); `transitionTournament` / the state machine (Story 2.3); the reusable UX components (Story 2.2); seed data (there is no Epic 2 reference data — the types are enums).

## Tasks / Subtasks

- [x] **Task 1 — Enums in `prisma/schema.prisma`** (AC: 1)
  - [x] `enum Discipline { CLASSIC BEACH }`
  - [x] `enum TournamentType { CHAMPIONSHIP VETERAN WOMEN YOUTH }`
  - [x] `enum TournamentState { DRAFT GROUP_STAGE PLAYOFF COMPLETED }`
  - [x] `enum ScoringPreset { CLASSIC CUSTOM }`
- [x] **Task 2 — `Tournament` model** (AC: 1, 2)
  - [x] Fields: `id String @id @default(cuid())`; `discipline Discipline`; `type TournamentType`; `name String`; `year Int`; `state TournamentState @default(DRAFT)`; `scoringPreset ScoringPreset`; `teamCount Int`; `rounds Int`; `createdAt DateTime @default(now())`; `updatedAt DateTime @default(now()) @updatedAt` (the `@default(now())` covers non-Prisma inserts — the recurring deferred item from Stories 1.4/1.5).
  - [x] Relation: `entries TournamentEntry[]`.
  - [x] `@@index([discipline, state])` — the public list query (`discipline = CLASSIC AND state != DRAFT`) hits this in Epic 2 / 3.
  - [x] `@@map("tournament")`.
- [x] **Task 3 — `Team` model** (AC: 1, 2)
  - [x] `id` cuid; `name String @unique` (see AC note); `createdAt` / `updatedAt` as above.
  - [x] Relation: `entries TournamentEntry[]`.
  - [x] `@@map("team")`.
- [x] **Task 4 — `TournamentEntry` model** (AC: 1, 2)
  - [x] `id` cuid; `tournamentId String`; `teamId String`; `createdAt` / `updatedAt`.
  - [x] `tournament Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)`.
  - [x] `team Team @relation(fields: [teamId], references: [id], onDelete: Restrict)`.
  - [x] Relation: `players Player[]`.
  - [x] `@@unique([tournamentId, teamId])` (AC), `@@index([teamId])`.
  - [x] `@@map("tournament_entry")`.
- [x] **Task 5 — `Player` model** (AC: 1, 2)
  - [x] `id` cuid; `entryId String`; `fullName String` (the only required domain field); optional free-text `birthDate String?`, `birthPlace String?`, `sportRank String?`, `position String?`, `height String?`, `weight String?`; `createdAt` / `updatedAt`.
  - [x] `entry TournamentEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)`.
  - [x] `@@index([entryId])`, `@@map("player")`.
- [x] **Task 6 — Generate & migrate** (AC: 1, 3)
  - [x] `pnpm prisma generate` — new types compile (`Tournament`, `Discipline`, … in `@/generated/prisma/client`).
  - [x] **Confirm with the user**, then `pnpm prisma migrate dev --name tournament_schema` (direct URL from `prisma7.config.ts`; Neon role has `CREATEDB` for the shadow DB — Story 1.4). Additive only, no `--force`, no reset. If `migrate dev` proposes anything destructive, **STOP** and hand-write the additive `CREATE TYPE` + `CREATE TABLE` migration, then `pnpm prisma migrate deploy` (the Story 1.5 fallback).
  - [x] Inspect the generated `prisma/migrations/<ts>_tournament_schema/migration.sql` — it must be only `CREATE TYPE` / `CREATE TABLE` / `CREATE INDEX` / `ALTER TABLE … ADD CONSTRAINT`. No `DROP`. Commit it (never hand-edit an applied migration afterwards).
  - [x] `pnpm prisma migrate status` → "Database schema is up to date!". `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → "No difference detected." (Prisma 7 renamed `--to-schema-datamodel` → `--to-schema`; `--from-migrations` needs a shadow DB, so diff the live datasource instead).
- [x] **Task 7 — Docs** (AC: 2)
  - [x] `src/data/README.md` — add a line under `## Modules`: the `Tournament` / `Team` / `TournamentEntry` / `Player` entities are owned here; their query/write functions arrive with the feature stories (2.4 / 2.6 / 2.7 / 2.8). Public-read tournament queries filter `state != DRAFT` **and** `discipline = CLASSIC` (AD-7, AD-9); admin queries (with drafts) are separate functions called only under `requireAdmin()`.
  - [x] `AGENTS.md` — under "Stack status", one line: Epic 2 schema landed (`tournament` / `team` / `tournament_entry` / `player` + `Discipline` / `TournamentType` / `TournamentState` / `ScoringPreset` enums), migration `<ts>_tournament_schema`. `Group` / `Match` / `SetScore` still to come in Epic 3.
  - [x] No `ARCHITECTURE-SPINE.md` edit — the entity list and ER diagram there already name all of these.
- [x] **Task 8 — Verification gate** (AC: all)
  - [x] `pnpm prisma generate` clean; `pnpm typecheck` (`tsc --noEmit`) + `pnpm lint` + `pnpm build` clean on Node 24 (`build` runs `prisma generate && migrate-deploy.mjs && next build` — `migrate deploy` should report "No pending migrations" since `migrate dev` already applied it).
  - [x] `migrate status` up to date; `migrate diff` empty (Task 6).
  - [x] Extended the committed `scripts/db-check.mts` with the four new `count()`s + a `db.tournament.findMany({ where: { discipline: "CLASSIC" } })` — all return `0`, the enum-typed query compiles and runs.
  - [x] `grep -rn "@prisma/client\|generated/prisma" src/ --include=*.ts --include=*.tsx` shows imports only under `src/data/` and `src/generated/` (AC 3 — nothing new leaked).
  - [x] Capture every command's real output (`migrate dev`, `migration.sql`, `migrate status`, `migrate diff`, `generate`, `typecheck`/`lint`/`build`, the count smoke) in the Dev Agent Record.
- [x] **Task 9 — Commit** — `feat(db): tournament / team / entry / player schema (Story 2.1)`. Includes `prisma/migrations/**` + the regenerated client is git-ignored (`src/generated/` — regenerated by `postinstall` / `build`). Commit to `main`; push triggers Vercel `build` → `prisma migrate deploy` applies the migration to prod (already applied by `migrate dev`, so a no-op — confirm in the deploy log).

### Review Findings

Code review 2026-09-03 (`bmad-code-review`, all 4 layers ran). Acceptance Auditor: no AC violations. 7 patch, 10 defer, ~11 dismissed.

- [x] [Review][Patch] All `createdAt` / `updatedAt` land as `timestamp(3)` **without time zone** (Prisma's Postgres default). Contradicts "час зберігається в UTC" and is a known `@prisma/adapter-pg` / `pg` offset trap (a `timestamp`-without-tz column reads back as a `Date` in the process TZ). Add `@db.Timestamptz(3)` to every timestamp on the four new models; the tables are empty so the `ALTER COLUMN ... TYPE timestamptz(3)` is instant. [prisma/schema.prisma + follow-up migration]
- [x] [Review][Patch] No DB-level guards on `Tournament.year` / `teamCount` / `rounds`. Add `CHECK` constraints in the follow-up migration: `year BETWEEN 2000 AND 2100`, `"teamCount" > 0`, `rounds > 0` (Prisma 7 has no `CHECK` in the schema — raw SQL in the migration; `migrate diff` ignores CHECKs so no drift). [follow-up migration]
- [x] [Review][Patch] `@@index([discipline, state])` — the known public query is `discipline = CLASSIC AND state != DRAFT` ordered newest-first (Story 2.9). Widen to `@@index([discipline, state, year])`. [prisma/schema.prisma + migration]
- [x] [Review][Patch] No `///` doc comments — the models encode non-obvious invariants (AD-4 standings never stored; AD-8 `state` transition-only; AD-9 `CLASSIC`-only; `rounds` = round-robin passes; `teamCount` = planned capacity; `Player.birthDate`… are free text by PRD §4.3; `ScoringPreset.CUSTOM` = the fixed 3-set / 1-point-per-set rule, not "customizable"). Add `///` comments so they reach the generated client and future readers. [prisma/schema.prisma, no SQL]
- [x] [Review][Patch] `scripts/db-check.mts` — the new `findMany({ where: { discipline: "CLASSIC" } })` has no `take` (unbounded as data grows) and uses a bare string literal instead of the generated `Discipline.CLASSIC`, so an enum rename would not fail typecheck. Add `take` + import the enum value. [scripts/db-check.mts]
- [x] [Review][Patch] `scripts/db-check.mts` reads entities with raw `db.tournament.count()` etc., which the "named `src/data` functions" convention (AC 2) does not cover. It imports the shared `db` (not the Prisma client, so AC 3 is fine) and is a diagnostic CLI outside `src/` — document the exemption (like `prisma/seed.mts`) in `src/data/README.md` + `AGENTS.md`. [docs]
- [x] [Review][Patch] `AGENTS.md` "Known pitfalls" — add an enum-migration hygiene note: `ALTER TYPE … ADD VALUE` must be its own migration (a new label can't be used in the same transaction that adds it); Postgres cannot `DROP` an enum value that is in use. [AGENTS.md]
- [x] [Review][Defer] No `Tournament` natural-key uniqueness (`@@unique([discipline, type, year, name])`) — Story 2.4's create action decides: enforce it or stay permissive (FR-8 spirit: "коректність — дисципліна адміна").
- [x] [Review][Defer] No soft-delete / archival concept; deleting a `Tournament` cascades entries + players, deleting a `TournamentEntry` erases its roster, and nothing restricts delete to `DRAFT`. The public archive shows `COMPLETED` tournaments indefinitely. — Story 2.5 (tournament delete + `ConfirmDialog`) + an archival-policy decision.
- [x] [Review][Defer] `discipline` + `type` combination is unconstrained (`BEACH` + `VETERAN` is representable). Unreachable in v1 (no `BEACH` create path, AD-9). — Story 2.4 (`allowedTypes(discipline)` in the create form).
- [x] [Review][Defer] `Team.name @unique` is case- and whitespace-sensitive with no normalized key — "Спартак" / "спартак" / "Спартак " become three teams. — Story 2.6 (the team directory owns dedup UX; a normalized `nameKey` or `citext`).
- [x] [Review][Defer] `P2002` (unique) / `P2003` (FK restrict) have no `{ ok: false, code }` mapping — belongs to the feature stories that write the create/delete actions (2.4 / 2.6 / 2.7).
- [x] [Review][Defer] Nothing prevents more `TournamentEntry` rows than `Tournament.teamCount` — Story 2.7 (the enroll action asserts `count < teamCount`).
- [x] [Review][Defer] The schema permits `db.tournament.update({ data: { state } })` directly, bypassing `transitionTournament` — Story 2.3 (no data-layer function takes a `state` arg; illegal transitions rejected in `src/domain/tournamentState.ts`).
- [x] [Review][Defer] Tournaments/teams will be addressed by raw `cuid` on the public site — a `slug` or natural key — Story 2.9 (public tournament page) decides if it needs one.
- [x] [Review][Defer] The auth tables (`user` / `session` / `account` / `verification`) are still `timestamp` without tz — a maintenance migration converts them (low impact: audit fields, Vercel runs UTC).
- [x] [Review][Defer] The migration was never replayed from an empty DB (`migrate reset` blocked, no CI) — "applies cleanly on an empty database" is argued, not run. Already in `deferred-work.md`. A disposable Neon branch + CI, or the Vitest integration spec, closes it.
- [x] [Review][Defer] No runtime test of the `@unique` / cascade / `Restrict` / `@default(now())` behaviour — `db-check` only `count()`s empty tables. When Vitest lands (Epic 3), a disposable-branch integration spec should round-trip `Tournament → Entry → Player` and assert the constraints.

## Dev Notes

### What this story is / is NOT

**Is:** four models (`Tournament`, `Team`, `TournamentEntry`, `Player`) + four enums in `schema.prisma`, one additive Prisma migration applied to Neon, `prisma generate`, and the boundary-doc updates. The Epic 2 analogue of Story 1.4.

**Is NOT** (do not pull forward):
- Any `src/data` CRUD function, any Server Action, any page/component. Those land with the feature stories.
- `Group` / `GroupSlot` / `Match` / `SetScore` / `MatchStage` → **Epic 3 (Story 3.2)**.
- `transitionTournament` / `src/domain/tournamentState.ts` → **Story 2.3**.
- `createTournament` and the `/admin/tournaments/new` form → **Story 2.4** (which also resolves the `Group` question).
- The reusable `ConfirmDialog` / `Toast` / `Skeleton` / `EmptyState` → **Story 2.2**.
- Seed / reference data — there is none for Epic 2 (types are enums).
- A `Cup` / multi-group / knockout `discipline=BEACH` model — out of v1 (`epics.md`, AD-9).

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `prisma/schema.prisma` | UPDATE | + 4 enums, + 4 models. `generator` / `datasource` blocks unchanged. |
| `prisma/migrations/<ts>_tournament_schema/migration.sql` | NEW (generated) | `pnpm prisma migrate dev --name tournament_schema`. Additive only. Never hand-edit after apply. |
| `src/data/README.md` | UPDATE | new entities owned here; public-read filter rule (AD-7 + AD-9). |
| `AGENTS.md` | UPDATE | one line under "Stack status" — Epic 2 schema landed. |
| `src/generated/prisma/**` | REGENERATED | git-ignored; `postinstall` / `build` regenerate. Do not hand-edit. |
| `src/data/**` (functions), `src/actions/**`, `src/app/**`, `src/domain/**` | DO NOT TOUCH | feature stories. |
| `prisma/seed.mts` | DO NOT TOUCH | no Epic 2 reference data. |

### Architecture compliance

- **AD-11** — `src/data/` is the sole Prisma importer and the sole read/write path per entity. This story only adds the schema; the ESLint block (Story 1.3: `@prisma/client` / `@/generated/prisma` allowed only under `src/data/**`) already enforces AC 3. [ARCHITECTURE-SPINE.md#AD-11]
- **AD-10** — schema changes only via versioned Prisma migrations; secrets via env. No hand-run SQL against prod outside a migration file. [ARCHITECTURE-SPINE.md#AD-10]
- **AD-9** — `discipline` enum with `BEACH` present but inert; every v1 query filters `CLASSIC`. Documented in `src/data/README.md` for the future query functions. [ARCHITECTURE-SPINE.md#AD-9]
- **AD-8** — `state` is an enum with `@default(DRAFT)`; only `transitionTournament` (Story 2.3) changes it. This story adds the field, not the transition. [ARCHITECTURE-SPINE.md#AD-8]
- **AD-7** — public reads filter `state != DRAFT`; the admin (draft-including) queries are separate `src/data` functions called only under `requireAdmin()`. A rule for the feature stories, noted in the README. [ARCHITECTURE-SPINE.md#AD-7]
- **AD-4 / AD-5** — the standings table and playoff placements are **never stored** — computed on read. So there is deliberately **no** `Standings` / `Placement` / `points` column anywhere in this schema. [ARCHITECTURE-SPINE.md#AD-4]
- **Consistency Conventions** — Prisma models `PascalCase` singular; fields `camelCase`; ids `cuid`; `DateTime` stored UTC; table names lowercase `snake_case` via `@@map` (Story 1.5 decision). [ARCHITECTURE-SPINE.md#Consistency Conventions]

### The one production database (Story 1.4 / 1.5 carried this)

- There is a **single Neon Postgres** (`DATABASE_URL` pooled, `DATABASE_URL_UNPOOLED` direct). No dev/staging branch. `prisma7.config.ts` points the CLI at the direct URL (`DIRECT_URL ?? DATABASE_URL_UNPOOLED ?? DATABASE_URL`); `shadowDatabaseUrl` falls back to `SHADOW_DATABASE_URL` if set (it is not — the Neon role has `CREATEDB`, so `migrate dev` makes its own shadow DB, verified in Story 1.4).
- `pnpm prisma migrate dev --name tournament_schema` **applies the migration to the production DB** on this setup. It is additive (`CREATE TYPE` / `CREATE TABLE`) so it adds empty tables — non-destructive — but **get the user's OK first** (AGENTS.md: "Схему БД змінювати лише міграціями Prisma"; the prod-DB hazard note).
- `pnpm prisma migrate reset` is **blocked** — Prisma's AI-agent safety gate (`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`) plus it would wipe the prod DB. AC "applies cleanly" is satisfied by `migrate dev` creating the migration against a DB with no `tournament` table (a clean apply) — the same argument Story 1.4 used.
- `build` = `prisma generate && node scripts/migrate-deploy.mjs && next build`. `scripts/migrate-deploy.mjs` runs `migrate deploy` only when `VERCEL_ENV` is `production` or unset. After `migrate dev` locally + push, the prod deploy's `migrate deploy` finds the migration already applied → no-op.
- **`deferred-work.md` already tracks:** no from-empty replay in CI, `migrate reset` unusable, one prod DB. This story does not resolve those; a Neon dev branch is still the recommended fix (left to the user).

### Data model rationale (per-field)

- `Tournament.teamCount` / `rounds` — the group-stage parameters (glossary "Правила турніру"). Editable only in `DRAFT` (FR-6) — enforced by Story 2.5's action, not the schema.
- `Tournament.scoringPreset` — the engine reads the rule from here, "не з константи" (FR-5). The per-set target (25 / 15, veteran = 15, decider = 15) is a **hard-coded rule** in `src/domain/validation.ts` (Epic 3) keyed on `preset` + `type` — PRD §4.2 open question, resolved as "зашите правило" for v1. No `setTarget` column.
- `Tournament.year` — `Int` (e.g. `2026`). App-level range check in Story 2.4.
- `Team.name @unique` — see AC note; a directory of reusable identities.
- `TournamentEntry` — the join with its own identity (it owns the `Player` roster, glossary "Склад, специфічний для цього Турніру"). `@@unique([tournamentId, teamId])` = "у межах одного Турніру Команда присутня один раз" (FR-8).
- `Player.entryId` (not `teamId`) — "Один Гравець належить одній Заявці команди одного Турніру (глобального довідника гравців немає)" (PRD §4.3). No cross-entry link, no dup check (FR-10).
- Deleting: tournament → cascades entries → cascades players. Team deletion is `Restrict`-blocked while entered (Story 2.6 handles the UX).

### Prisma 7 specifics (Story 1.4 landed the adapter)

- `generator client { provider = "prisma-client"; output = "../src/generated/prisma" }`; import path `@/generated/prisma/client`. The custom generator (not `prisma-client-js`).
- Native Postgres enums: `enum X { A B }` in `schema.prisma` → `CREATE TYPE "X" AS ENUM (...)` in the migration. Prisma maps them to a TS union.
- `@default(now()) @updatedAt` on one field is valid — `now()` for the initial insert (and non-Prisma inserts), `@updatedAt` for subsequent updates.
- `pnpm prisma migrate dev` uses the **direct** URL via `prisma7.config.ts` `datasource.url`. `migrate deploy` (in `build`) uses the same.
- After the schema change, `pnpm prisma generate` must run before `tsc` sees the new types (`postinstall` does it on install; run it explicitly here).

### Testing requirements

- **No unit tests / no Vitest** — no `src/domain` code (Story 2.3 is the first Epic-2 domain module). The gate is operational (Task 8): `migrate dev` applies clean; `migrate status` + `migrate diff` confirm sync; `prisma generate` + `typecheck` + `lint` + `build` clean; a `count()` smoke against the live DB shows four new empty tables and the enum-typed query compiles.
- Capture real command output in the Dev Agent Record — verifiable, not asserted (the Stories 1.1–1.8 pattern; Story 1.4 in particular for the migration commands).

### Previous story intelligence

**Story 1.4 (done) — the schema/migration template:**
- `pnpm prisma migrate dev --name init_user` worked against Neon directly (role has `CREATEDB`; no shadow-DB error). Same command shape here.
- `migrate reset` **not run** (Prisma AI gate + prod DB); AC "applies cleanly" argued from the clean `migrate dev` apply.
- `build` folds in `migrate deploy` via `scripts/migrate-deploy.mjs` (skips preview builds).
- Deferred to 1.5 and done there: `updatedAt` had no DB default — **this story adds `@default(now())`** to avoid re-deferring it.
- `prisma7.config.ts` has no `directUrl` key (v6-ism) — `datasource.url` is the direct connection; `shadowDatabaseUrl` wired to `SHADOW_DATABASE_URL`.

**Story 1.5 (done):**
- Table naming went lowercase `@@map` (`user`, `session`, `account`, `verification`). Continue: `tournament`, `team`, `tournament_entry`, `player`.
- `@better-auth/cli` lag caused a schema/runtime mismatch — **not relevant here** (no Better Auth tables change).
- Hand-written migration + `migrate deploy` was the fallback when `migrate dev` planned a destructive change (the `User` → `user` rename). For 2.1 (all-new tables) `migrate dev` should be clean — but keep the fallback in mind (Task 6).

**Story 1.7 (done):** `src/data/users.ts` is the first real entity module (`listAuthenticatedUsers`, `promoteToAdmin`, …) — the pattern the 2.x feature stories follow for tournaments/teams. `src/data/README.md` has a `## Modules` section to extend.

**Story 1.8 (done):** `/classic` / `/beach` / `/archive` are static shells with `EmptyState` placeholders — Story 2.9 replaces `/classic`'s content with the tournament list once this schema + `getPublicTournaments` exist.

### Git intelligence

Recent: `ac118f7` (1.8 review) ← `91708cc` (1.8) ← Epic 1 complete. `prisma/schema.prisma` = `User` / `Session` / `Account` / `Verification` only. `prisma/migrations/` = `20260903105840_init_user`, `20260903115000_add_better_auth`, `20260903120000_account_issuer`. `src/data/` = `client.ts` + `users.ts` + `README.md`. `src/domain/` = `README.md` only (still empty). No `Tournament` anywhere.

### Latest tech information

- **Prisma 7.10** — `prisma-client` generator, `prisma7.config.ts` (`prisma/config` `defineConfig`), driver adapter `@prisma/adapter-pg` required to construct `PrismaClient`. Native enums supported. `migrate dev` / `migrate deploy` / `migrate status` / `migrate diff` all via the config's `datasource.url`.
- **Neon** — pooled string for the app runtime; direct string for the CLI. `migrate dev` needs `CREATEDB` (present) or an explicit `shadowDatabaseUrl`.
- No new dependency. No security advisories.

### Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 2.1 AC + Epic 2 intro "додає власною міграцією сутності `Tournament`, `Team`, `TournamentEntry`, `Player`" + the per-epic-schema principle + Stories 2.3/2.4/3.2 boundaries), `glossary.md` (Тип турніру / Стан турніру / Система очок / Команда / Заявка команди / Склад / Гравець / Група — exact terms and their fields), PRD §4.2 (FR-4/FR-5 — types, presets, one group, DRAFT), §4.3 (FR-8/FR-9/FR-10 — team directory, entry uniqueness, player free-text optional fields, no dup check), `SPEC.md` (CAP-2/CAP-3/CAP-4, Constraints), `ARCHITECTURE-SPINE.md` (AD-4, AD-7, AD-8, AD-9, AD-10, AD-11, Consistency Conventions, entity list + ER diagram), `AGENTS.md` (pnpm + PowerShell; migrations only via Prisma; prod-DB hazard; lowercase `@@map`; `src/data` sole Prisma importer), `1-4-auth-schema-migrations-seed.md` (the migration workflow, `migrate reset` blocked, `updatedAt` default), `1-5-google-sign-in.md` (lowercase `@@map` decision, hand-written-migration fallback), `1-7-admin-management.md` (`src/data` entity-module pattern), `deferred-work.md` (one prod DB / no CI replay).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1: Схема турнірів, команд і гравців] — user story + AC (entities, enums, `src/data` functions, lint)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2] — "Додає власною міграцією сутності `Tournament`, `Team`, `TournamentEntry`, `Player`"
- [Source: _bmad-output/planning-artifacts/epics.md#Перелік епіків — Наскрізні принципи] — "Схема БД росте поепічно … Кожен наступний епік додає свої сутності власною міграцією"
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3] — `Group` / `GroupSlot` / `Match` / `SetScore` are Epic 3's migration
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4] — "створюється турнір … з рівно однією `Group`" — the tension this story flags for 2.4
- [Source: _bmad-output/specs/spec-cherkasy-volley/glossary.md] — Тип турніру, Стан турніру, Правила турніру, Система очок, Команда, Заявка команди, Склад, Гравець, Група
- [Source: _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md#FR-4] — types list, one group, DRAFT on create
- [Source: …/prd.md#FR-5] — two scoring presets; engine reads the rule from tournament rules; per-set target 25/15 hard-coded for v1
- [Source: …/prd.md#FR-8] — team is a reusable identity; ≤ 1 entry per team per tournament
- [Source: …/prd.md#FR-9] — entry only in DRAFT; cancelling an entry deletes its roster
- [Source: …/prd.md#FR-10] — only `fullName` required; optional fields are free text; no cross-entry dup check
- [Source: _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md#AD-9] — `discipline` enum; v1 filters `CLASSIC`; `BEACH` inert
- [Source: …/ARCHITECTURE-SPINE.md#AD-8] — `state` changed only by explicit transitions
- [Source: …/ARCHITECTURE-SPINE.md#AD-7] — public reads filter `state != DRAFT`; draft-including queries under `requireAdmin()`
- [Source: …/ARCHITECTURE-SPINE.md#AD-4] — standings / placements never stored — no such columns
- [Source: …/ARCHITECTURE-SPINE.md#AD-10, #AD-11] — schema only via migrations; `src/data` sole Prisma owner
- [Source: …/ARCHITECTURE-SPINE.md#Ключові сутності] — the ER diagram already lists Tournament / Team / TournamentEntry / Player / Group / Match / SetScore
- [Source: AGENTS.md] — pnpm + PowerShell; `migrate dev` against a personal Neon branch not prod; lowercase `@@map`; `src/data` sole Prisma importer
- [Source: _bmad-output/implementation-artifacts/1-4-auth-schema-migrations-seed.md] — the migration workflow, `migrate reset` blocked, build-folded `migrate deploy`, `updatedAt` default deferral
- [Source: _bmad-output/implementation-artifacts/1-5-google-sign-in.md] — lowercase `@@map`; hand-written-migration fallback
- Web: [Prisma 7 — schema / enums](https://www.prisma.io/docs/orm/prisma-schema/data-model/models), [Prisma + Neon](https://www.prisma.io/docs/orm/overview/databases/neon), [Prisma Migrate — migrate dev vs deploy](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

**Pre-flight `migrate diff` (live DB → new schema)** — confirmed additive-only before applying:
`4× CREATE TYPE`, `4× CREATE TABLE`, `5× CREATE INDEX`, `3× ADD CONSTRAINT`. No `DROP`, no `ALTER` on
`user` / `session` / `account` / `verification`. User confirmed → applied.

**`pnpm prisma migrate dev --name tournament_schema`:**
```
Datasource "db": PostgreSQL database "neondb" at ep-dawn-scene-b2xraxmr...neon.tech
Applying migration `20260903174727_tournament_schema`
  └─ 20260903174727_tournament_schema/migration.sql
Your database is now in sync with your schema.
```

**Post-checks:**
```
$ pnpm prisma migrate status
4 migrations found in prisma/migrations
Database schema is up to date!

$ pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
No difference detected.   (exit 0)

$ pnpm exec tsx scripts/db-check.mts
{ users: 2, sessions: 3, accounts: 2, verifications: 0,
  tournaments: 0, teams: 0, entries: 0, players: 0, classicTournaments: 0 }
```

**Gates:** `pnpm prisma generate` clean · `pnpm typecheck` exit 0 · `pnpm lint` exit 0 ·
`pnpm build` clean (`migrate deploy` step → "No pending migrations to apply"; `next build` OK).
`grep "@prisma/client|generated/prisma" src/**/*.ts(x)` → only `src/data/client.ts`.

### Completion Notes List

- **Additive migration, prod DB.** No dev Neon branch exists, so `migrate dev` applied
  `20260903174727_tournament_schema` directly to production — but it is `CREATE TYPE` /
  `CREATE TABLE` / `CREATE INDEX` / FK only, adding four empty tables; existing rows untouched
  (`db-check` still shows `users: 2`, `sessions: 3`, `accounts: 2`). Confirmed with the user
  before running, per AGENTS.md policy.
- **4 models + 4 enums** in `schema.prisma`. `updatedAt DateTime @default(now()) @updatedAt` on
  every new model — closes the recurring "no DB default on updatedAt" deferral from Stories
  1.4/1.5 for the new tables.
- **`Team.name @unique`** and **`TournamentEntry @@unique([tournamentId, teamId])`** per the AC.
  `Player` has only `fullName` required; `birthDate`/`birthPlace`/`sportRank`/`position`/`height`/
  `weight` are optional `String?` (free text, PRD §4.3).
- **Deletes:** tournament → entries → players cascade; `team` with entries is `onDelete: Restrict`.
- **No `Group`** — `epics.md` gives it to Epic 3, and Story 2.4's "one Group" wording is flagged
  in this story's AC notes for 2.4 to resolve. **No CRUD functions** — feature stories add them.
  **No `MatchStage` / `Match` / `SetScore`** (Epic 3). **No standings column** (AD-4 — computed).
- **`scripts/db-check.mts`** extended (committed) with the four new counts + an enum-typed
  `findMany` — now a durable schema smoke, not a throwaway.
- `prisma migrate diff` flag change in Prisma 7: `--to-schema-datamodel` → `--to-schema`;
  `--from-migrations` needs a shadow DB (not set) so diff `--from-config-datasource` instead.
  `AGENTS.md` "DB conformance check" line already uses the right form.
- Prod deploy on push: `scripts/migrate-deploy.mjs` runs `migrate deploy`, which finds the
  migration already applied → no-op.

### File List

**Modified**
- `prisma/schema.prisma` — +4 enums, +4 models
- `scripts/db-check.mts` — +4 counts + enum-typed query
- `src/data/README.md` — new entities owned here; public/admin query flavours
- `AGENTS.md` — Epic 2 schema line

**New (generated)**
- `prisma/migrations/20260903174727_tournament_schema/migration.sql`
- `prisma/migrations/20260903204803_tournament_schema_constraints/migration.sql` (review — timestamptz + CHECK + wider index)

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-03 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
| 2026-09-03 | Implemented: `Tournament` / `Team` / `TournamentEntry` / `Player` + `Discipline` / `TournamentType` / `TournamentState` / `ScoringPreset` enums in `schema.prisma`; migration `20260903174727_tournament_schema` (additive only) applied to Neon after user confirmation; `db-check.mts` extended; docs. `migrate status` / `diff` in sync; `generate` / `typecheck` / `lint` / `build` clean; four new tables empty, existing data intact. Status: in-progress → review. |
| 2026-09-03 | `bmad-code-review` (4 layers; Acceptance Auditor: no AC violations). Applied 7 patches in migration `20260903204803_tournament_schema_constraints`: all 8 new timestamp columns → `@db.Timestamptz(3)` (verified `timestamp with time zone` live — "час в UTC" rule); CHECK `year 2000–2100` / `teamCount > 0` / `rounds > 0` (verified — a `year: 1999` insert is rejected, no row persists); index widened to `[discipline, state, year]`; `///` doc comments on the four models + key fields; `db-check.mts` now imports `Discipline` from the generated enums + `take: 100`; `src/data/README.md` + `AGENTS.md` note the `scripts/*.mts` exemption + enum-migration hygiene. 10 deferred → `deferred-work.md`. `generate` / `typecheck` / `lint` / `build` clean; `migrate status` / `diff` in sync. Status: review → done. |
