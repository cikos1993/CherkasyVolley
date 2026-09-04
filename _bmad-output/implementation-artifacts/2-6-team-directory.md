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

Status: in-progress

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
- **`Team.name` normalization — resolved here, per the standing deferred item.** `deferred-work.md` (2-1 review) explicitly assigns this: *"`Team.name @unique` has no normalization … Story 2.6 (team directory) owns dedup — add a normalized `nameKey` (trim + case-fold) or a `citext` column, and handle the `P2002` on create."* **Decision: add `nameKey`.** The `team` table is empty (first story to write to it — no backfill risk). Schema change: `name` keeps its trimmed + whitespace-collapsed **display** value but drops its own `@unique`; a new `nameKey String @unique` (case-folded `name`) becomes the real dedup anchor. `src/domain/teamForm.ts` computes both from the same input — `createTeamRecord` never receives a caller-supplied `nameKey`.
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
  - [x] `NewTeamInput = { name: string }`; `TeamField = "name"`; `FieldErrors = Partial<Record<TeamField, string>>`.
  - [x] `validateNewTeam(raw: { name: RawValue }): { ok: true; value: NewTeamInput } | { ok: false; fieldErrors: FieldErrors }` — normalizes via `normalizeTeamName`; empty → `"Вкажіть назву команди."`; over `TEAM_NAME_MAX` → a length message (mirror `tournamentForm.ts`'s wording style). Returns the **normalized** name in `value.name` (not the raw input) so the caller never has to re-normalize.
  - [x] `src/domain/teamForm.test.ts` — empty/whitespace-only input; trims + collapses internal whitespace; over-length rejected; `teamNameKey` case-folds and is stable under repeated whitespace collapse; message is a non-empty Ukrainian string. 9 tests.
  - [x] `pnpm test` → 3 files, 51/51. **Side effect discovered:** `scripts/verify-tournament-edit-delete.mts`'s raw `db.team.create` (Story 2.5) needed a `nameKey` value now that the column is `NOT NULL` — fixed (`teamName.toLowerCase()`), unrelated to this task's own logic but required for `typecheck` to pass after Task 1's migration.
- [ ] **Task 3 — `src/data/errors.ts` (NEW): extract the shared Prisma-error predicates** (AC: 1)
  - [ ] Move `isUniqueViolation(error, indexName?)` and `isRecordNotFound(error)` from `src/data/tournaments.ts` verbatim (same doc comments, same `driverAdapterError.cause.constraint.index` shape check).
  - [ ] `src/data/tournaments.ts` — remove the two functions, `import { isUniqueViolation, isRecordNotFound } from "@/data/errors"`, re-export nothing extra (callers of `tournaments.ts` already import these by name from `@/data/tournaments` — **check every call site** in `src/actions/tournaments.ts` and update its import to `@/data/errors` instead, or keep `tournaments.ts` re-exporting them for backward compatibility; prefer updating the action's import — cleaner, and there are only two call sites in the whole repo). `TOURNAMENT_NATURAL_KEY_INDEX` stays in `tournaments.ts` (entity-specific, not a generic predicate).
  - [ ] `typecheck` + `lint` clean; `pnpm test` unaffected (no domain change here — this is a `src/data` move).
- [ ] **Task 4 — `src/data/teams.ts` (NEW)** (AC: 1, 2, 3)
  - [ ] `listTeams()` — `db.team.findMany({ orderBy: { name: "asc" } })`.
  - [ ] `createTeamRecord(input: NewTeamInput): Promise<{ id: string }>` — computes `nameKey = teamNameKey(input.name)` (import from `@/domain/teamForm` — a second `data → domain` type/const import, same sanctioned edge Story 2.4 established), `db.team.create({ data: { name: input.name, nameKey }, select: { id: true } })`.
  - [ ] `export const TEAM_NAME_KEY_INDEX = "team_nameKey_key";` — the Postgres index name backing the new unique constraint (verify live against the actual migration, same discovery method as `TOURNAMENT_NATURAL_KEY_INDEX`, Story 2.4).
  - [ ] Doc comments matching the file style already established in `tournaments.ts`.
- [ ] **Task 5 — `src/actions/teams.ts` (NEW): `createTeam`** (AC: 1, 2, 3)
  - [ ] `export type TeamFormState = { fieldErrors?: Partial<Record<TeamField, string>>; formError?: string };`
  - [ ] `createTeam(_prev: TeamFormState, formData: FormData): Promise<TeamFormState>` — `requireAdmin()` (narrowed try → `AdminRequiredError` → `formError`, else re-throw — same shape as `createTournament`) → `validateNewTeam({ name: formData.get("name") })` → `!ok` → `{ fieldErrors }` → `createTeamRecord(parsed.value)` in a narrowed try: `isUniqueViolation(error, TEAM_NAME_KEY_INDEX)` → `{ formError: "Команда з такою назвою вже існує." }`; else re-throw → `revalidatePath("/admin/teams")` → `return {}` (no redirect — AC 1's "appears in the list" is satisfied by staying on the page and revalidating).
  - [ ] Imports: `requireAdmin`/`AdminRequiredError` from `@/auth/requireAdmin`; `createTeamRecord`, `TEAM_NAME_KEY_INDEX` from `@/data/teams`; `isUniqueViolation` from `@/data/errors`; `validateNewTeam`, `TeamField` from `@/domain/teamForm`; `revalidatePath` from `next/cache`.
- [ ] **Task 6 — `src/components/team-form.tsx` (NEW, Client Component)** (AC: 1)
  - [ ] `"use client"`; `const [state, formAction, pending] = useActionState(createTeam, {})`; a single controlled `name` field (`useState<string>("")`, `value`/`onChange` — same UX-DR11 controlled-state rationale as `tournament-form.tsx`: a rejected submit must not lose what the admin typed).
  - [ ] `<form action={formAction} className="flex items-end gap-3">` — a `Label`+`Input` (`name="name"`, `maxLength={TEAM_NAME_MAX}`, `aria-invalid`/`aria-describedby` wired to `state.fieldErrors?.name`) plus a submit `Button` ("Додати команду" — verb-first, Voice guide), inline pending spinner (`Loader2Icon`, the established `GrantAdminButton` pattern), `disabled={pending}`.
  - [ ] `useEffect` on `[state]`: `formError` → `notify.error(state.formError)` (the established pattern). On a **clean success** (submit completed, no `formError`, no `fieldErrors`) — detected via the same falling-edge-of-`pending` technique as `tournament-form.tsx`'s edit-mode success effect (`useRef` tracking the previous `pending` value; never fires on mount) — clear the input to `""`, `notify.success("Команду додано")`, and `router.refresh()` (pulls the freshly revalidated list into the Server Component below without a full reload).
  - [ ] `typecheck` + `lint` clean.
- [ ] **Task 7 — `src/app/admin/teams/page.tsx` (NEW)** (AC: 1, 2, 3)
  - [ ] Server Component. Back-link to `/admin`, `<h1>Команди</h1>`, `<TeamForm />`, then the list from `listTeams()`.
  - [ ] Empty (`length === 0`): a plain paragraph — `Ще немає команд.` (do **not** reuse `NO_TEAMS` from `@/lib/empty-states` — that copy, "Ще немає заявлених команд.", is for a tournament's *Teams tab* with zero entries, Story 2.9, a different context; same reasoning the `/admin/tournaments` list already applied to `NO_TOURNAMENTS`).
  - [ ] Non-empty: a `<ul className="divide-y">` of plain rows (name only — no per-row link; there is no team detail/edit page in v1).
  - [ ] `export const metadata = { title: "Команди" }`.
- [ ] **Task 8 — `/admin` dashboard link** (AC: reachability)
  - [ ] `src/app/admin/page.tsx` — add a "Команди" link (`/admin/teams`) to the existing `<nav>`, alongside "Турніри" and "Керування адмінами".
- [ ] **Task 9 — Docs**
  - [ ] `src/domain/README.md` — `teamForm.ts` entry (`normalizeTeamName`, `teamNameKey`, `validateNewTeam`).
  - [ ] `src/data/README.md` — new `errors.ts` module entry (the extracted predicates, now shared); `teams.ts` entry (`listTeams`, `createTeamRecord`, `TEAM_NAME_KEY_INDEX`); update the `tournaments.ts` entry to say `isUniqueViolation`/`isRecordNotFound` now live in `errors.ts`.
  - [ ] `src/actions/README.md` — `teams.ts` entry (`createTeam`, `TeamFormState` — form-state shape, no redirect, revalidates `/admin/teams`).
  - [ ] `src/components/README.md` — `team-form.tsx` entry (single controlled field, clear-on-success + `router.refresh()`, modeled on `tournament-form.tsx`'s edit-mode success effect).
  - [ ] `AGENTS.md` — Stack-status bullet for Story 2.6 (`Team.nameKey`, the `src/data/errors.ts` extraction, `/admin/teams`).
  - [ ] No `ARCHITECTURE-SPINE.md` / `EXPERIENCE.md` / `epics.md` / `SPEC.md` edit — `/admin/teams` is already in the documented IA; `src/actions/team` (spine) vs. the shipped `src/actions/teams.ts` (plural, matching `tournaments.ts`/`users.ts`) is a pre-existing naming-convention gap the spine itself doesn't reconcile — not new to this story, not worth a spine edit for a filename.
- [ ] **Task 10 — `deferred-work.md` (UPDATE)**
  - [ ] Mark **resolved**: 2-1-review "`Team.name @unique` has no normalization" (this story's `nameKey`).
  - [ ] Update the "P2002 / P2003 / P2025 mapping" item: note the `src/data/errors.ts` extraction (three consumers now: `tournaments.ts` via re-import, `teams.ts`); `P2003` (deleting an entered `Team`) still has no code path to hit it — there is no team-delete action in this story — so it stays open, unchanged.
  - [ ] Add a **"Story 2.6 implementation"** section: no team edit/delete (future scope, FK `Restrict` implications noted); `createTeam` has no automated action-level test (same class of gap as every prior `useActionState` action); the success-detection/clear-on-submit mechanism in `team-form.tsx` has no component test (same "no component-test toolchain" gap).
- [ ] **Task 11 — Verification gate** (AC: all)
  - [ ] `pnpm test` (existing 2 domain files + the new `teamForm.test.ts`) · `pnpm typecheck` · `pnpm lint` · `pnpm build` clean.
  - [ ] Route table — `/admin/teams` (NEW, `ƒ`) added; rest unchanged from Story 2.5's table.
  - [ ] Import-boundary greps: Prisma client only in `src/data/**`; no new `next`/`react` import in `src/domain/**`.
  - [ ] `scripts/verify-team-create.mts` (NEW, self-cleaning, same style as `verify-tournament-create.mts`): create a throwaway team → assert `name` stored (trimmed/collapsed) and `nameKey` case-folded correctly → attempt a case/whitespace-different duplicate (`"  спартак  черкаси  "` vs. the original `"Спартак Черкаси"`) → assert it is rejected as `P2002` via `isUniqueViolation(error, TEAM_NAME_KEY_INDEX)` → delete the throwaway team, confirm gone.
  - [ ] **Browser walkthrough — expect not run** (no automated Google OAuth in this environment, the same residual gap carried since Story 2.4). Coverage instead: `typecheck`/`lint`/`build` (full route tree including `/admin/teams`) + the verify script (the real AC-1/AC-2 check) + code review.
  - [ ] Capture real command output + notes in the Dev Agent Record.
- [ ] **Task 12 — Commit(s)** — one commit + `git push origin main` per completed task. `build` gated each.

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

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-04 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
