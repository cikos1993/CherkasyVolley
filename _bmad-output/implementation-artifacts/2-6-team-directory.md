---
baseline_commit: 0e485ae
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - _bmad-output/specs/spec-cherkasy-volley/glossary.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/implementation-artifacts/2-1-tournament-team-player-schema.md
  - _bmad-output/implementation-artifacts/2-4-create-tournament.md
  - _bmad-output/implementation-artifacts/2-5-edit-delete-tournament.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - AGENTS.md
---

# Story 2.6: Team directory

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to set up a team once and reuse it across tournaments,
so that I don't have to type the same name every time (FR-8).

## Acceptance Criteria

Translated from `epics.md` → Epic 2 → Story 2.6. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** I am an admin on `/admin/teams`
**When** I create a team by entering a name
**Then**

1. The team appears in the list.
2. It is available for enrollment ("заявка") in any tournament.
3. One team can be entered into multiple different tournaments (no per-tournament restriction at the `Team` level — enforced at the `TournamentEntry` layer in Story 2.7).

### Notes on AC interpretation

- **Single page, no separate `/admin/teams/new` route.** The AC's phrasing — "on `/admin/teams` … I create a team … it appears in the list" — describes one page where creating and seeing the result happen together, unlike Story 2.4's tournament form (6 fields, its own AC step "мене перекидає на сторінку турніру"). A team is one field. **Decision: `/admin/teams` is a single Server Component page with an inline create form at the top and the list below it**, mirroring `/admin/people`'s single-page shape (list + inline actions) more than `/admin/tournaments`' list-plus-detail-route shape.
- **`Team.name` normalization — resolved here, per the standing deferred item.** `deferred-work.md` (2-1 review) explicitly assigns this: *"`Team.name @unique` has no normalization … Story 2.6 (team directory) owns dedup — add a normalized `nameKey` (trim + case-fold) or a `citext` column, and handle the `P2002` on create."* **Decision: add `nameKey`.** The `team` table is empty (first story to write to it — no backfill risk). Schema change: `name` keeps its trimmed + whitespace-collapsed **display** value but drops its own `@unique`; a new `nameKey String @unique` (case-folded `name`) becomes the real dedup anchor. `src/domain/teamForm.ts` computes both from the same input — `nameKey` is never independently supplied by the caller of `validateNewTeam`; it rides along on `NewTeamInput` (`{ name, nameKey }`) from there through to `createTeamRecord`, which only writes it, never re-derives it (see the Task 2/4 design refinement below).
- **`isUniqueViolation` / `isRecordNotFound` move to a shared `src/data/errors.ts`.** They currently live in `src/data/tournaments.ts` (Story 2.4/2.5) but check nothing tournament-specific — both are generic Prisma-error-code predicates. `deferred-work.md`'s own P2002/P2003/P2025 item names the trigger: *"a shared `src/data/errors.ts` is a candidate once a third distinct error-code consumer appears"* — `src/data/teams.ts` is that third consumer. `tournaments.ts` keeps its own `TOURNAMENT_NATURAL_KEY_INDEX` constant (entity-specific) but imports the two predicates from the new shared module; no behavior change to Story 2.4/2.5 code, pure extraction.
- **No team edit or delete in this story.** FR-8 / the epics AC only cover create-and-reuse. Editing a mistyped name or deleting an unused team is real future work but out of scope here — no AC asks for it, and `TournamentEntry.team` is `onDelete: Restrict`, so a delete story would need its own `P2003` handling (still an open `deferred-work.md` item, untouched by this story).
- **`listTeams()` (not `listTeamsForAdmin`).** Unlike `Tournament`, `Team` has no `DRAFT`/privacy concept — every team is equally visible to any admin, and there is no separate "public" team read in v1 (teams only ever surface *through* a tournament's roster, which is Story 2.9). One read function, admin-gated only because it currently has one caller (`/admin/teams`, under `requireAdminPage()`); Story 2.7's team-picker and Story 2.9's public roster will call the same function later, from their own auth contexts.
- **`createTeam` follows the no-redirect, revalidate-in-place pattern (like `updateTournament`, Story 2.5), not the redirect pattern (`createTournament`, Story 2.4).** The AC's "appears in the list" implies staying on `/admin/teams`, not navigating away. Success clears the input (ready for the next team) and shows a `notify.success` toast; `revalidatePath("/admin/tournaments")` is not relevant here — only `/admin/teams` needs it (`TournamentEntry`/roster surfaces that would care about the team list arrive in later stories).

## Tasks / Subtasks

- [x] **Task 1 — Prisma: `Team.nameKey` migration** (AC: 1, 2, 3)
  - [x] `prisma/schema.prisma` — `Team.name` drops `@unique`; add `nameKey String @unique` with doc comments (display value vs. normalized dedup key, computed in `src/domain/teamForm.ts`). `entries`/timestamps/`@@map` unchanged.
  - [x] `pnpm prisma generate` — confirms `Team.nameKey` compiles into the generated client.
  - [x] User confirmed. `pnpm prisma migrate dev` **non-interactive-blocked** exactly as predicted (constraint-change warning). Fallback used: pre-flight `migrate diff --script` → hand-wrote `prisma/migrations/20260904200627_team_name_key/migration.sql` verbatim (`DROP INDEX "team_name_key"`, `ALTER TABLE "team" ADD COLUMN "nameKey" TEXT NOT NULL`, `CREATE UNIQUE INDEX "team_nameKey_key" ON "team"("nameKey")`) → `pnpm prisma migrate deploy` (non-interactive) — applied clean.
  - [x] `pnpm prisma migrate status` → "Database schema is up to date!"; `migrate diff --exit-code` → "No difference detected."
  - [x] `scripts/db-check.mts` → `teams: 0`, all tables still 0/expected — no code change needed.
- [x] **Task 2 — `src/domain/teamForm.ts` (NEW) + Vitest spec** (AC: 1, 2)
  - [x] Pure module. `TEAM_NAME_MAX = 120` (matches `tournamentForm.ts`'s `NAME_MAX` — no reason for a different bound).
  - [x] `normalizeTeamName(raw: string): string` — trim + collapse internal whitespace runs to one space (`raw.trim().replace(/\s+/g, " ")`). This is the **display** value stored in `name`.
  - [x] `teamNameKey(normalizedName: string): string` — case-fold (`.toLowerCase()`) the already-normalized name. This is the value stored in `nameKey`.
  - [x] `TeamField = "name"` (the one form field — kept independent of `NewTeamInput`, not derived via `keyof`, so `nameKey` can never leak into `FieldErrors`); `FieldErrors = Partial<Record<TeamField, string>>`; `NewTeamInput = { name: string; nameKey: string }` (both computed together in `validateNewTeam` — see Task 4's design note).
  - [x] `validateNewTeam(raw: { name: RawValue }): { ok: true; value: NewTeamInput } | { ok: false; fieldErrors: FieldErrors }` — normalizes via `normalizeTeamName`; empty → `"Вкажіть назву команди."`; over `TEAM_NAME_MAX` → a length message (mirror `tournamentForm.ts`'s wording style). Returns the **normalized** name and its `teamNameKey` in `value` so the caller never has to re-derive either.
  - [x] `src/domain/teamForm.test.ts` — empty/whitespace-only input; trims + collapses internal whitespace; over-length rejected; `teamNameKey` case-folds and is stable under repeated whitespace collapse; message is a non-empty Ukrainian string. 9 tests.
  - [x] `pnpm test` → 3 files, 51/51. **Side effect discovered:** `scripts/verify-tournament-edit-delete.mts`'s raw `db.team.create` (Story 2.5) needed a `nameKey` value now that the column is `NOT NULL` — fixed (`teamName.toLowerCase()`), unrelated to this task's own logic but required for `typecheck` to pass after Task 1's migration.
- [x] **Task 3 — `src/data/errors.ts` (NEW): extract the shared Prisma-error predicates** (AC: 1)
  - [x] Moved `isUniqueViolation(error, indexName?)` and `isRecordNotFound(error)` from `src/data/tournaments.ts` — identical logic and the same `driverAdapterError.cause.constraint.index` shape check; the doc comment carried over with one wording trim (dropped the `group_tournamentId_key` example, since that constraint is no longer local to this file once the predicate is shared).
  - [x] `src/data/tournaments.ts` — the two functions removed (and the now-unused `Prisma` import); `src/actions/tournaments.ts` updated to `import { isRecordNotFound, isUniqueViolation } from "@/data/errors"`. `TOURNAMENT_NATURAL_KEY_INDEX` stays in `tournaments.ts`. Also updated the two `scripts/verify-tournament-*.mts` scripts, which imported the predicates directly from `../src/data/tournaments` — same move.
  - [x] `typecheck` + `lint` clean. `pnpm test` unaffected (51/51, no domain change). Both verify scripts re-run: 13/13 + 15/15, no regression.
- [x] **Task 4 — `src/data/teams.ts` (NEW)** (AC: 1, 2, 3)
  - [x] `listTeams()` — `db.team.findMany({ orderBy: { name: "asc" } })`.
  - [x] `createTeamRecord(input: NewTeamInput): Promise<{ id: string }>` — `db.team.create({ data: { name: input.name, nameKey: input.nameKey }, select: { id: true } })`. **Design refinement during implementation:** `nameKey` is computed once in `validateNewTeam` (Task 2) and carried on `NewTeamInput` itself, rather than `createTeamRecord` re-deriving it via a `teamNameKey()` call — keeps the `data → domain` edge a **type-only** import, exactly matching the `NewTournamentInput` precedent (Story 2.4), instead of also pulling a domain function into the data layer.
  - [x] `export const TEAM_NAME_KEY_INDEX = "team_nameKey_key";` — the Postgres index name backing the new unique constraint (matches the migration's `CREATE UNIQUE INDEX "team_nameKey_key"`, same discovery method as `TOURNAMENT_NATURAL_KEY_INDEX`, Story 2.4).
  - [x] Doc comments matching the file style already established in `tournaments.ts`.
- [x] **Task 5 — `src/actions/teams.ts` (NEW): `createTeam`** (AC: 1, 2, 3)
  - [x] `export type TeamFormState = { fieldErrors?: Partial<Record<TeamField, string>>; formError?: string };`
  - [x] `createTeam(_prev: TeamFormState, formData: FormData): Promise<TeamFormState>` — `requireAdmin()` (narrowed try → `AdminRequiredError` → `formError`, else re-throw — same shape as `createTournament`) → `validateNewTeam({ name: formData.get("name") })` → `!ok` → `{ fieldErrors }` → `createTeamRecord(parsed.value)` in a narrowed try: `isUniqueViolation(error, TEAM_NAME_KEY_INDEX)` → `{ formError: "Команда з такою назвою вже існує." }`; else re-throw → `revalidatePath("/admin/teams")` → `return {}` (no redirect).
  - [x] Imports: `requireAdmin`/`AdminRequiredError` from `@/auth/requireAdmin`; `createTeamRecord`, `TEAM_NAME_KEY_INDEX` from `@/data/teams`; `isUniqueViolation` from `@/data/errors`; `validateNewTeam`, `TeamField` from `@/domain/teamForm`; `revalidatePath` from `next/cache`. `typecheck`/`lint` clean.
- [x] **Task 6 — `src/components/team-form.tsx` (NEW, Client Component)** (AC: 1)
  - [x] `"use client"`; `const [state, formAction, pending] = useActionState(createTeam, {})`; a single controlled `name` field (`useState<string>("")`, `value`/`onChange` — same UX-DR11 controlled-state rationale as `tournament-form.tsx`).
  - [x] `<form action={formAction} className="flex items-end gap-3">` — `Label`+`Input` (`maxLength={TEAM_NAME_MAX}`, `aria-invalid`/`aria-describedby`) plus a submit `Button` ("Додати команду"), inline pending spinner (`Loader2Icon`), `disabled={pending}`.
  - [x] `useEffect` on `[state]`: `formError` → `notify.error`. A second effect, keyed off the falling edge of `pending` (`useRef`, never fires on mount): on a clean success, clears the field, `notify.success("Команду додано")`, `router.refresh()`.
  - [x] `typecheck` + `lint` clean.
- [x] **Task 7 — `src/app/admin/teams/page.tsx` (NEW)** (AC: 1, 2, 3)
  - [x] Server Component. Back-link to `/admin`, `<h1>Команди</h1>`, `<TeamForm />`, then the list from `listTeams()`.
  - [x] Empty (`length === 0`): a plain paragraph — `Ще немає команд.` (not the viewer-voiced `NO_TEAMS` empty-state copy).
  - [x] Non-empty: a `<ul className="divide-y">` of plain rows (name only — no per-row link).
  - [x] `export const metadata = { title: "Команди" }`. `typecheck`/`lint` clean.
- [x] **Task 8 — `/admin` dashboard link** (AC: reachability)
  - [x] `src/app/admin/page.tsx` — added "Команди" link (`/admin/teams`) between "Турніри" and "Керування адмінами".
- [x] **Task 9 — Docs**
  - [x] `src/domain/README.md` — `teamForm.ts` entry; also filled a gap left by Story 2.5 (`resolveGroupStageFields` was never added to the `tournamentForm.ts` entry there).
  - [x] `src/data/README.md` — new `errors.ts` module entry; `teams.ts` entry; `tournaments.ts` entry updated (predicates removed, `TOURNAMENT_NATURAL_KEY_INDEX` note kept).
  - [x] `src/actions/README.md` — `teams.ts` entry.
  - [x] `src/components/README.md` — `team-form.tsx` entry.
  - [x] `AGENTS.md` — Stack-status bullet for Story 2.6.
  - [x] No `ARCHITECTURE-SPINE.md` / `EXPERIENCE.md` / `epics.md` / `SPEC.md` edit.
- [x] **Task 10 — `deferred-work.md` (UPDATE)**
  - [x] Marked **resolved**: 2-1-review "`Team.name @unique` has no normalization".
  - [x] Updated the "P2002 / P2003 / P2025 mapping" item: the `src/data/errors.ts` extraction, `Team.nameKey` now using `isUniqueViolation`; `P2003` stays open (no team-delete action exists).
  - [x] Added a **"Story 2.6 implementation"** section: no team edit/delete; `createTeam` untested at the action layer; `team-form.tsx`'s success effect untested at the component layer.
- [x] **Task 11 — Verification gate** (AC: all)
  - [x] `pnpm test` → 3 files, 51/51 · `pnpm typecheck` · `pnpm lint` · `pnpm build` — all clean.
  - [x] Route table — `/admin/teams` (NEW, `ƒ`) added; rest unchanged from Story 2.5's table.
  - [x] Import-boundary greps: no Prisma import outside `src/data/**`; `src/domain/**` free of `next`/`react`.
  - [x] `scripts/verify-team-create.mts` (NEW, self-cleaning): create a throwaway team → assert `name` trimmed/collapsed and `nameKey` case-folded → a re-cased, re-whitespaced "duplicate" rejected as `P2002` via `isUniqueViolation(error, TEAM_NAME_KEY_INDEX)` → delete, confirm gone. 5/5 live.
  - [x] All three verify scripts re-run together: `verify-tournament-create.mts` 13/13, `verify-tournament-edit-delete.mts` 15/15, `verify-team-create.mts` 5/5 — no regression from the `errors.ts` extraction or the `Team.nameKey` migration.
  - [x] **Browser walkthrough — not run** (no automated Google OAuth in this environment, same residual gap carried since Story 2.4). Coverage instead: `typecheck`/`lint`/`build` (full route tree including `/admin/teams`) + the verify scripts (the real AC-1/AC-2 check) + code review.
  - [x] Real command output captured in the Dev Agent Record.
- [x] **Task 12 — Commit(s)** — one commit + `git push origin main` per completed task. `build` gated each.

### Review Findings

Implementation review 2026-09-04 (`bmad-code-review`, 4 layers: Blind Hunter, Edge Case Hunter, Verification Gap, Acceptance Auditor) over `git diff 0e485ae..HEAD`. Acceptance Auditor: all 3 ACs met, no architecture-invariant violations. Verification Gap: clean. 0 decision-needed, 7 patch, 2 defer, 6 dismissed.

#### Patch

- [x] [Review][Patch] `normalizeTeamName`/`teamNameKey` don't NFKC-normalize or strip zero-width characters — two visually identical team names can produce different `nameKey` values and both pass the unique constraint, defeating the exact dedup guarantee this story exists to deliver [src/domain/teamForm.ts]
- [x] [Review][Patch] `TeamForm`'s clear-on-success effect can wipe in-progress typing — the `name` input isn't `disabled` while `pending`, so an admin who starts typing the next team's name before the previous submit resolves has it silently cleared [src/components/team-form.tsx]
- [x] [Review][Patch] `listTeams()` has no `select`, fetching `nameKey`/`createdAt`/`updatedAt` on every `/admin/teams` load even though the page only renders `id`/`name` — inconsistent with `createTeamRecord`'s own `select: { id: true }` in the same file [src/data/teams.ts]
- [x] [Review][Patch] `scripts/verify-team-create.mts`: the duplicate-cleanup delete sits inside the same `try` whose `catch` computes the check result, so a delete failure gets misattributed as a dedup failure and can leak the duplicate row; separately, the original team's `createTeamRecord` call is outside the `try`/`finally`, so a throw there skips `db.$disconnect()` [scripts/verify-team-create.mts]
- [x] [Review][Patch] Story's "Notes on AC interpretation" says `createTeamRecord` "never receives a caller-supplied `nameKey`," contradicting the later "Task 2/4 — design refinement" note, which correctly describes `NewTeamInput` carrying both `name` and `nameKey` through to `createTeamRecord` [2-6-team-directory.md — Notes on AC interpretation]
- [x] [Review][Patch] Task 3's "moved verbatim" claim for the `isUniqueViolation`/`isRecordNotFound` doc comment is inaccurate — the moved comment drops a parenthetical example (`e.g. group_tournamentId_key`) present in the original [2-6-team-directory.md — Task 3]

#### Defer

- [x] [Review][Defer] Duplicate-name rejection surfaces only as a transient toast (`formError`), never attached to `fieldErrors.name`/`aria-invalid` the way every other validation error on this form is [src/components/team-form.tsx] — deferred, matches `createTournament`'s identical, already-established pattern (Story 2.4); a fix belongs to a cross-cutting pass over both forms, not a one-off patch here
- [x] [Review][Defer] `/admin/teams` has no pagination/search/filter and `listTeams()` is unbounded [src/app/admin/teams/page.tsx, src/data/teams.ts] — deferred, same class as the already-tracked `/admin/tournaments`/`/admin/people` unbounded-list items

#### Dismissed as noise / by design / pre-existing (6)

A forged POST could submit a `File` blob as `name`, coercing to `"[object File]"` — same class already dismissed in the Story 2.4 review (not exploitable, no crash, requires bypassing the real form) · empty-state copy bypasses `EmptyState`/`NO_TEAMS` — already explicitly justified in this story's own notes and matches the `/admin/tournaments` (Story 2.5) precedent · `src/actions/team` (spine, singular) vs. the shipped `teams.ts` (plural) — already explicitly acknowledged and decided in this story's own Dev Notes · "Team is `довідник`, should be seed-script-only per `AGENTS.md` Policy" — misapplies the bootstrap/reference-schema-data policy line to a product-spec-mandated admin-managed catalog (FR-8/CAP-4 explicitly define `/admin/teams`) · no index/collation tuning for `orderBy: name asc` — negligible at SPEC's stated ~2–5-admin/small-dataset scale · the "type-only `data → domain` edge" isn't lint-enforced — matches the codebase's existing convention-not-enforced pattern for several other invariants (e.g. AD-8's state-writer rule).

## Dev Notes

### What this story is / is NOT

**Is:** a one-field team directory — `Team.nameKey` (normalized dedup) migration, `src/domain/teamForm.ts` (pure, unit-tested), a shared `src/data/errors.ts` (extracted from `tournaments.ts`, zero behavior change there), `src/data/teams.ts` (`listTeams`, `createTeamRecord`), the `createTeam` Server Action (form-state shape, no redirect, revalidates in place), `<TeamForm>`, and the single-page `/admin/teams` (create form + list), linked from the `/admin` dashboard.

**Is NOT** (do not pull forward):
- **Editing or deleting a team** — no AC asks for it; `TournamentEntry.team` is `onDelete: Restrict`, so a delete story owes its own `P2003` mapping (tracked, untouched).
- **Enrolling/removing a team from a tournament** (`TournamentEntry`) → **Story 2.7**. `listTeams()` is built to be the read Story 2.7's team-picker will call, but the picker UI itself is not this story.
- **Roster / players** → **Story 2.8**.
- **The public Teams tab / any public team read** → **Story 2.9**. `listTeams()` is currently only called from an admin-gated page; a public caller is a later story's decision, not this one's.
- **Any change to `Tournament`, `Group`, or `TournamentEntry`** beyond what already exists.

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `prisma/schema.prisma` | UPDATE | `Team.name` drops `@unique`; + `Team.nameKey String @unique`. |
| `prisma/migrations/<ts>_team_name_key/migration.sql` | NEW (generated) | Drop old unique, add `nameKey` column + unique index. Empty table — no backfill. |
| `src/domain/teamForm.ts` | NEW | Pure. `normalizeTeamName`, `teamNameKey`, `validateNewTeam`, `TEAM_NAME_MAX`. |
| `src/domain/teamForm.test.ts` | NEW | Vitest — normalization, case-fold key, bounds, message language. |
| `src/data/errors.ts` | NEW | `isUniqueViolation`, `isRecordNotFound` — moved from `tournaments.ts`. |
| `src/data/tournaments.ts` | UPDATE | Removes the two predicates; imports them from `@/data/errors` instead. `TOURNAMENT_NATURAL_KEY_INDEX` stays. |
| `src/data/teams.ts` | NEW | `listTeams`, `createTeamRecord`, `TEAM_NAME_KEY_INDEX`. |
| `src/actions/tournaments.ts` | UPDATE | Import site change only (`isUniqueViolation`/`isRecordNotFound` now from `@/data/errors`) — no behavior change. |
| `src/actions/teams.ts` | NEW | `createTeam`, `TeamFormState`. |
| `src/components/team-form.tsx` | NEW | `"use client"`, single controlled field, clear-on-success. |
| `src/app/admin/teams/page.tsx` | NEW | Create form + list, single page. |
| `src/app/admin/page.tsx` | UPDATE | + "Команди" link. |
| `src/{domain,data,actions,components}/README.md` · `AGENTS.md` · `deferred-work.md` | UPDATE | Module entries, Stack status, resolved deferred item. |
| `scripts/verify-team-create.mts` | NEW | Self-cleaning DB round-trip. |
| `src/app/admin/layout.tsx` | DO NOT TOUCH | Already `requireAdminPage()` + `force-dynamic` — covers `/admin/teams`. |
| `src/actions/result.ts` | DO NOT TOUCH | `createTeam` uses its own form-state shape, same reasoning as `createTournament`. |

### Architecture compliance

- **AD-1 / layers** — `team-form.tsx`/the page are View; `createTeam` is Shell; `listTeams`/`createTeamRecord` are Data; `normalizeTeamName`/`teamNameKey`/`validateNewTeam` are Domain (pure). [ARCHITECTURE-SPINE.md#Design Paradigm]
- **AD-2 — domain is pure.** `teamForm.ts` imports nothing internal, no `next`/Prisma/`react`. [ARCHITECTURE-SPINE.md#AD-2]
- **AD-3 — dependency direction.** `view → shell` (`team-form.tsx` → `@/actions/teams`), `shell → data` (`createTeam` → `@/data/teams`, `@/data/errors`), `data → domain` (`createTeamRecord` takes `NewTeamInput`/calls `teamNameKey` — the second sanctioned edge of this kind, after Story 2.4's `NewTournamentInput`). [src/README.md · eslint.config.mjs]
- **AD-6 — every mutation is a Server Action under `requireAdmin()`.** `createTeam`'s first line is `await requireAdmin()`. [ARCHITECTURE-SPINE.md#AD-6]
- **AD-11 — `src/data` is the sole Prisma owner.** `createTeamRecord`/`listTeams` in `src/data/teams.ts`; the new `src/data/errors.ts` also stays within `src/data` (it types `Prisma.PrismaClientKnownRequestError`). [ARCHITECTURE-SPINE.md#AD-11]
- **AD-10 — schema only via migrations.** `Team.nameKey` lands in one migration, `migrate dev` **after user confirmation** (no dev DB branch — AGENTS.md policy). [ARCHITECTURE-SPINE.md#AD-10]
- **Consistency Conventions** — verb-named action (`createTeam`); `revalidatePath` after the write; UA-only copy; `cuid` id (unchanged, `Team.id` already `cuid`). [ARCHITECTURE-SPINE.md#Consistency Conventions]
- **EXPERIENCE.md** — IA: `/admin/teams` "Довідник команд" (already documented, unchanged); §Voice ("Створити турнір" precedent → "Додати команду", verb-first); §State Patterns ("Помилка Server Action → Toast destructive; форма лишає введені дані" for the error path — the success path here intentionally clears the field, a deliberate, documented deviation for a repeated-entry form, not a UX-DR11 violation, since UX-DR11 is specifically about *rejected* submits). [EXPERIENCE.md]
- **DESIGN.md** — same `Input`/`Label`/`Button` primitives as the tournament form, no new components. [DESIGN.md#Components]

### Existing code being modified — current state → change → what must be preserved

**`src/data/tournaments.ts`** (Story 2.3/2.4/2.5)
- *Current:* `getTournamentForAdmin`, `listTournamentsForAdmin`, `countTournamentEntries`, `setTournamentState`, `createTournamentRecord`, `updateTournamentRecord`, `deleteTournamentRecord`, `TOURNAMENT_NATURAL_KEY_INDEX`, `isUniqueViolation`, `isRecordNotFound`.
- *Change:* remove `isUniqueViolation`/`isRecordNotFound`'s definitions, import them from `@/data/errors` instead. Every other export, and every call site's behavior, is unchanged — this is a pure move, verify with a diff that no call site's *logic* changed, only its import line.
- *Must preserve:* `TOURNAMENT_NATURAL_KEY_INDEX` stays here (not generic). `setTournamentState` remains the sole `state` writer (AD-8, untouched by this story).

**`src/actions/tournaments.ts`** (Story 2.3/2.4/2.5)
- *Current:* imports `isUniqueViolation`, `isRecordNotFound` from `@/data/tournaments`.
- *Change:* import them from `@/data/errors` instead (still also imports `TOURNAMENT_NATURAL_KEY_INDEX` from `@/data/tournaments`, unchanged). No other change — `transitionTournament`/`createTournament`/`updateTournament`/`deleteTournament` logic is untouched.
- *Must preserve:* every existing behavior verbatim; this file's tests (the verify scripts) must still pass unchanged.

**`src/app/admin/page.tsx`** (Story 2.4/2.5)
- *Current:* two links — "Турніри" (`/admin/tournaments`), "Керування адмінами" (`/admin/people`).
- *Change:* add "Команди" (`/admin/teams`).
- *Must preserve:* the page shell, `metadata`, the existing two links.

**`prisma/schema.prisma`** — `Team` model only. `Tournament`/`Group`/`TournamentEntry`/`Player` and the four enums are unchanged.

### Migration against the one production database (carried since 1.4/2.1/2.4)

- Single Neon Postgres, no dev/staging branch. Additive-but-constraint-changing (drop one unique, add another) — the `team` table is **empty**, so this cannot fail on existing data. **HALT and get the user's OK before `migrate dev`** (established policy).
- `pnpm prisma migrate dev` will very likely hit the same non-interactive block Stories 1.5/2.1/2.4 did (a constraint-change warning needs interactive confirmation). Use the documented fallback: `migrate diff --script` → hand-write `migration.sql` → `migrate deploy`.
- `migrate status` / `migrate diff --exit-code` are the two commands that prove the migration matches the schema — run both after applying.

### Testing requirements

- **Unit (Vitest):** `src/domain/teamForm.test.ts` — the deterministic core (normalization, case-folding, bounds). This is the primary automated proof for AC 1/2 (a case/whitespace-different "duplicate" must resolve to the same `nameKey`).
- **Not unit-tested (no infra, same class as every prior action):** `createTeam` (the `requireAdmin` gate, the `P2002` catch, the revalidate). Gate = `typecheck` + `lint` + the **DB round-trip script** (`verify-team-create.mts`) + code review. No browser walkthrough (no OAuth automation) — same residual gap carried since Story 2.4.
- **Regression:** `pnpm test` (3 files total after this story), route table (`/admin/teams` new `ƒ`, rest unchanged), import-boundary greps clean, `verify-tournament-create.mts` **and** `verify-tournament-edit-delete.mts` re-run unchanged (proving the `src/data/errors.ts` extraction didn't regress Story 2.4/2.5's behavior).

### Previous story intelligence

**Story 2.5 (done, `0e485ae`):** the no-redirect / revalidate-in-place / `router.refresh()` pattern (`updateTournament` + `tournament-form.tsx`'s edit-mode success effect) is the direct model for `createTeam` + `team-form.tsx` here — same falling-edge-of-`pending` success detection, same reasoning (no redirect, so `state`'s object identity alone can't distinguish "just mounted" from "just submitted successfully"). The code review that closed that story also named the exact trigger for extracting `src/data/errors.ts` ("a shared errors.ts is a candidate once a third distinct error-code consumer appears") — this story is that third consumer, landing the extraction as originally anticipated rather than deferring it again.

**Story 2.4 (done):** `createTournamentRecord`'s `data → domain` type import (`NewTournamentInput`) is the precedent `createTeamRecord`'s `NewTeamInput` import follows; the `isUniqueViolation(error, indexName)` narrowing-by-constraint-name design (and the `@prisma/adapter-pg` P2002 shape discovery — `error.meta.driverAdapterError.cause.constraint.index`, not `error.meta.target`) is exactly what `TEAM_NAME_KEY_INDEX` plugs into, unchanged, after the `src/data/errors.ts` move. The non-interactive `migrate dev` fallback workflow is identical.

**Story 2.1 (done):** raised the `Team.name` normalization gap this story resolves, and the `P2002`/`P2003` mapping item this story partially advances (P2002 now has three consumers via the shared predicate; P2003 stays open, no team-delete path exists yet).

### Git intelligence

Recent: `0e485ae` (2.5 code-review fixes) ← `d9d3774` (2.5 verification gate) ← `bdd7f29` (2.5 dashboard link) ← `bf9306e` (2.5 tournament list) ← `667a827` (2.5 inline edit/delete). `src/data/` = `client.ts`, `users.ts`, `tournaments.ts` (10 exports incl. the two predicates this story extracts), `README.md` — no `teams.ts`, no `errors.ts`. `src/actions/` = `result.ts`, `admin-roles.ts`, `tournaments.ts`, `README.md` — no `teams.ts`. `src/domain/` = `README.md`, `tournamentState.ts`(+spec), `tournamentForm.ts`(+spec, now includes `resolveGroupStageFields`) — no `teamForm.ts`. `src/components/` has no `team-form.tsx`. `src/app/admin/` has `page.tsx`, `people/`, `tournaments/` — no `teams/`. `.claude/` + `_bmad/` are git-ignored.

### Latest tech information

- No new library. Same React 19.2 `useActionState` + controlled-field pattern as every prior tournament form; same Prisma 7 / `@prisma/adapter-pg` P2002 shape as Story 2.4 discovered.
- **Postgres unique-constraint drop-and-add on an empty table** is a cheap, safe, single-transaction DDL change (`DROP CONSTRAINT` + `ADD COLUMN ... NOT NULL` + `CREATE UNIQUE INDEX`) — no lock contention concern at this table's size (zero rows).

### Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 2.6 AC, FR-8), `glossary.md` ("Команда" — "багаторазова ідентичність … Може заявлятися в різні Турніри"), `SPEC.md` (CAP-4), `ARCHITECTURE-SPINE.md` (AD-1, AD-2, AD-3, AD-6, AD-10, AD-11, `src/actions/team` — spine's singular filename, this story ships `teams.ts` for consistency with `tournaments.ts`), `EXPERIENCE.md` (IA `/admin/teams`; §Voice verb-button convention), `2-1-tournament-team-player-schema.md` (`Team` schema, the normalization + P2002/P2003 deferred items), `2-4-create-tournament.md` (the `data → domain` import precedent, the P2002 shape discovery, the non-interactive-migrate fallback), `2-5-edit-delete-tournament.md` (the no-redirect/revalidate-in-place pattern, the `src/data/errors.ts` trigger), `deferred-work.md` (the items this story resolves/advances).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6: Довідник команд] — user story + AC; FR-8
- [Source: _bmad-output/planning-artifacts/epics.md#FR-8] — "Адмін створює Команду (назву) й використовує її в кількох Турнірах; у межах одного Турніру Команда має не більше однієї Заявки"
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#CAP-4] — "Адмін заводить команди, заявляє їх у турнір і наповнює склад"
- [Source: _bmad-output/specs/spec-cherkasy-volley/glossary.md] — Команда, Заявка команди
- [Source: …/ARCHITECTURE-SPINE.md#AD-6, #AD-10, #AD-11] — Server Action + requireAdmin; migrations only; src/data sole Prisma owner
- [Source: …/EXPERIENCE.md#Information Architecture, #Voice and Tone] — `/admin/teams`; verb buttons
- [Source: _bmad-output/implementation-artifacts/2-1-tournament-team-player-schema.md] — `Team` schema, normalization + P2002/P2003 deferred items
- [Source: _bmad-output/implementation-artifacts/2-4-create-tournament.md] — data→domain import precedent, P2002 shape discovery, migrate-dev fallback
- [Source: _bmad-output/implementation-artifacts/2-5-edit-delete-tournament.md] — no-redirect/revalidate-in-place pattern, the errors.ts extraction trigger
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — items resolved/advanced by this story
- [Source: src/domain/tournamentForm.ts · src/data/tournaments.ts · src/actions/tournaments.ts · src/components/tournament-form.tsx · src/app/admin/people/page.tsx] — the exact patterns this story reuses

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

**Task 1 — migration.** `pnpm prisma migrate dev` non-interactive-blocked as predicted (drop-unique/add-unique warning). Fallback: `migrate diff --script` → hand-wrote `20260904200627_team_name_key/migration.sql` → `migrate deploy`. Clean apply; `migrate status`/`diff` in sync.

**Task 2 — side effect.** `scripts/verify-tournament-edit-delete.mts` (Story 2.5) creates a throwaway `Team` via a raw `db.team.create` (not `createTeamRecord`) — Task 1's `nameKey NOT NULL` column broke its `typecheck`. Fixed by supplying `nameKey: teamName.toLowerCase()` at that one call site; unrelated to this story's own domain logic, required for the build to stay green.

**Task 2/4 — design refinement.** Originally planned `NewTeamInput = { name: string }` with `createTeamRecord` calling `teamNameKey()` itself (a `data → domain` function-call edge, not just a type). Switched `NewTeamInput` to `{ name, nameKey }`, both computed once in `validateNewTeam`, so `createTeamRecord` only needs a type-only import — matches the `NewTournamentInput` precedent (Story 2.4) exactly rather than introducing a wider edge. `TeamField` stays `"name"` (not `keyof NewTeamInput`) so `nameKey` can never appear in `FieldErrors`.

**Task 11 — verification.** `verify-team-create.mts` (5/5), plus both Story 2.5 scripts re-run unchanged (13/13, 15/15) to confirm the `errors.ts` extraction and the `Team.nameKey` migration caused no regression. `pnpm build` route table: `/admin/teams` new `ƒ`, rest identical to Story 2.5's table.

### Completion Notes List

- **Task 1:** `Team.name` drops `@unique`; `Team.nameKey String @unique` added. Migration `20260904200627_team_name_key` (hand-written + `migrate deploy`). `db-check.mts` unaffected (`teams: 0`).
- **Task 2:** `src/domain/teamForm.ts` — `normalizeTeamName`, `teamNameKey`, `validateNewTeam` (`NewTeamInput = { name, nameKey }`). 9 Vitest cases. Fixed a Story 2.5 script's raw `db.team.create` for the new `NOT NULL` column.
- **Task 3:** `src/data/errors.ts` (NEW) — `isUniqueViolation`, `isRecordNotFound` moved from `tournaments.ts`; both `src/actions/tournaments.ts` and the two `scripts/verify-tournament-*.mts` updated to the new import path. Zero behavior change (13/13 + 15/15 unchanged).
- **Task 4:** `src/data/teams.ts` (NEW) — `listTeams`, `createTeamRecord`, `TEAM_NAME_KEY_INDEX`.
- **Task 5:** `src/actions/teams.ts` (NEW) — `createTeam` + `TeamFormState`. `requireAdmin` → `validateNewTeam` → `createTeamRecord` → `revalidatePath("/admin/teams")` → `{}` (no redirect).
- **Task 6:** `src/components/team-form.tsx` (NEW) — single controlled field, `formError` toast, clear-on-success + `notify.success` + `router.refresh()` via the falling-edge-of-`pending` technique.
- **Task 7:** `src/app/admin/teams/page.tsx` (NEW) — create form + list, single page. Plain-paragraph empty state (not `NO_TEAMS`).
- **Task 8:** `/admin` dashboard gained a "Команди" link.
- **Task 9:** README updates in `src/{domain,data,actions,components}` + `AGENTS.md`; also backfilled a Story 2.5 documentation gap (`resolveGroupStageFields` was missing from `src/domain/README.md`).
- **Task 10:** `deferred-work.md` — resolved the `Team.name` normalization item, updated the P2002/P2003/P2025 mapping item, added a "Story 2.6 implementation" section (no team edit/delete, 2 untested-layer gaps).
- **Task 11:** `pnpm test` 3/3 files (51/51) · `typecheck` · `lint` · `build` (route table: `/admin/teams` new `ƒ`) — all clean. New `scripts/verify-team-create.mts` 5/5 live. All three verify scripts re-run together: 13/13 + 15/15 + 5/5, no regression. Browser walkthrough not run (no OAuth automation) — same residual gap as every prior story.

### File List

**New**
- `prisma/migrations/20260904200627_team_name_key/migration.sql`
- `src/domain/teamForm.ts`
- `src/domain/teamForm.test.ts`
- `src/data/errors.ts`
- `src/data/teams.ts`
- `src/actions/teams.ts`
- `src/components/team-form.tsx`
- `src/app/admin/teams/page.tsx`
- `scripts/verify-team-create.mts`

**Modified**
- `prisma/schema.prisma` — `Team.name` drops `@unique`; `Team.nameKey` added
- `src/data/tournaments.ts` — `isUniqueViolation`/`isRecordNotFound` removed (moved to `errors.ts`), unused `Prisma` import removed
- `src/actions/tournaments.ts` — import path for the two predicates updated
- `scripts/verify-tournament-create.mts` — import path for `isUniqueViolation` updated
- `scripts/verify-tournament-edit-delete.mts` — import path for `isRecordNotFound` updated; raw `db.team.create` supplies `nameKey`
- `src/app/admin/page.tsx` — "Команди" link
- `src/domain/README.md` · `src/data/README.md` · `src/actions/README.md` · `src/components/README.md` · `AGENTS.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Modified (review fix pass only)**
- `src/domain/teamForm.ts` — `normalizeTeamName` now NFKC-normalizes and strips zero-width/BOM characters before dedup
- `src/domain/teamForm.test.ts` — 2 new tests (zero-width stripping, NFKC collapse)
- `src/components/team-form.tsx` — clear-on-success no longer wipes in-progress typing of a new name during a pending submit
- `src/data/teams.ts` — `listTeams()` narrowed to `select: { id, name }`
- `scripts/verify-team-create.mts` — duplicate-cleanup delete moved out of the check-computing `try`/`catch`, both teams cleaned up in one `finally`, `$disconnect()` moved to run after the final DB check

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-04 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
| 2026-09-04 | Task 1 — `Team.nameKey` migration (hand-written + `migrate deploy`, non-interactive `migrate dev` blocked as expected). `bmad-dev-story`. |
| 2026-09-04 | Task 2 — `src/domain/teamForm.ts` (`normalizeTeamName`, `teamNameKey`, `validateNewTeam`) + 9 Vitest cases. Design refinement: `NewTeamInput` carries `name`+`nameKey` together (type-only `data → domain` edge). |
| 2026-09-04 | Task 3 — `src/data/errors.ts`: `isUniqueViolation`/`isRecordNotFound` extracted from `tournaments.ts`. Zero behavior change (verify scripts unchanged). |
| 2026-09-04 | Task 4 — `src/data/teams.ts`: `listTeams`, `createTeamRecord`, `TEAM_NAME_KEY_INDEX`. |
| 2026-09-04 | Task 5 — `src/actions/teams.ts`: `createTeam` Server Action. |
| 2026-09-04 | Task 6 — `src/components/team-form.tsx`: single controlled field, clear-on-success. |
| 2026-09-04 | Task 7 — `/admin/teams` (NEW): create form + list, single page. |
| 2026-09-04 | Task 8 — `/admin` dashboard links to "Команди". |
| 2026-09-04 | Task 9 — README + `AGENTS.md` updates; backfilled a Story 2.5 doc gap. |
| 2026-09-04 | Task 10 — `deferred-work.md`: resolved the `Team.name` normalization item, updated P2002/P2003/P2025 mapping, new "Story 2.6 implementation" section. |
| 2026-09-04 | Task 11 — verification gate green; new `scripts/verify-team-create.mts` (5/5). All three verify scripts re-run together, no regression. |
| 2026-09-04 | `bmad-code-review` (4 layers) over `git diff 0e485ae..HEAD`. 0 decision-needed, 7 patch, 2 defer, 6 dismissed. Fixed: `normalizeTeamName` NFKC-normalizes + strips zero-width/BOM characters (2 new Vitest cases — closes the dedup gap Blind Hunter and Edge Case Hunter independently converged on); `TeamForm`'s clear-on-success no longer wipes an admin's in-progress typing of the next name; `listTeams()` narrowed to `select: { id, name }`; `verify-team-create.mts`'s duplicate-cleanup and `$disconnect()` ordering made robust to partial failures; two story-doc wording contradictions fixed (the `nameKey`-passthrough note, the "verbatim" comment-move claim). 2 items added to `deferred-work.md` (duplicate-name errors lack a persistent field indicator — matches `createTournament`'s existing pattern; `/admin/teams` has no pagination — matches the existing `/admin/tournaments`/`/admin/people` items). Gate re-run clean: `test` 53/53, `typecheck`, `lint`, `build`; all three verify scripts green (13/13, 15/15, 5/5). Status → done. |
