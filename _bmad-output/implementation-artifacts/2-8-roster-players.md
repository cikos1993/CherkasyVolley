---
baseline_commit: 2c6517e
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
  - _bmad-output/implementation-artifacts/2-6-team-directory.md
  - _bmad-output/implementation-artifacts/2-7-enroll-remove-team.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - AGENTS.md
---

# Story 2.8: Team roster — players

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to maintain the list of players on a team's entry,
so that the tournament has roster data (FR-10).

## Acceptance Criteria

Translated from `epics.md` → Epic 2 → Story 2.8. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** a team's entry in a tournament, I am an admin
**When** I add a player, specifying only the full name
**Then**

1. The player is saved.
2. Optional fields (date of birth, place of birth, sport rank, position, height, weight) are saved when filled, and not shown when empty.
3. The system does not forbid the same full name across different entries.
4. A player can be edited and deleted.

### Notes on AC interpretation

- **No tournament-state restriction on player CRUD — a deliberate contrast with Story 2.7.** FR-10's own wording ("Адмін додає/редагує/видаляє Гравця у Складі…") names no state gate, unlike FR-9's explicit "після Жеребкування заявити нову Команду не можна" that grounded Story 2.7's `DRAFT`-only lock. **Decision: add/edit/delete a player in any tournament state.** A roster correction (a birth date typo, a late-joining player) is a data-quality concern independent of match/draw state, and the AC gives no reason to couple it to `Tournament.state`. No `src/domain` precondition module is needed for this story — a deliberate absence, not an oversight (contrast Story 2.7's `teamEnrollment.ts`).
- **New admin route: `/admin/tournaments/[id]/entries/[entryId]`.** Story 2.7's "Команди" section lists entries but has no room for full 7-field roster CRUD (potentially a dozen-plus players per team) without overloading the tournament management page. EXPERIENCE.md's public IA already establishes the precedent of a dedicated roster sub-route (`/classic/[tournament]/teams/[team]` — "Склад команди"); this story's admin equivalent is `/admin/tournaments/[id]/entries/[entryId]`, keyed by the entry's own id (not `teamId`) since `Player` belongs to `TournamentEntry`, not `Team`, directly. Story 2.7's `team-enrollment.tsx` gets a "Склад" link per entry row pointing here.
- **Scope every read/write by `(tournamentId, entryId)` together, never `entryId` alone — a direct, deliberate application of the Story 2.7 code-review finding.** That review found `removeTeamEntry` deleting by `entryId` alone let a mismatched `tournamentId` cancel an entry belonging to a *different* tournament. This story's admin route takes both ids from the URL (`/admin/tournaments/[id]/entries/[entryId]`) and **every** data access — the page's own entry lookup, `updatePlayer`, `deletePlayer` — must verify the entry actually belongs to that tournament, not just that the entry exists. `getEntryForAdmin(tournamentId, entryId)` (new, in `src/data/entries.ts`) is the single scoped lookup the page and every action call first.
- **`birthDate` stays a free-text `String?`, not a date input.** Story 2.1 already decided this ("optional free-text `String?` … not a real date type") — this story's form uses a plain text `Input` for it, same as every other optional field, not `<input type="date">`.
- **One `PlayerForm` component, `mode: "create" | "edit"` — the `TournamentForm`/`TeamForm` precedent, not a new pattern.** Same reasoning Story 2.4/2.5 established: one component, a `mode` prop, a bound action per mode, avoids duplicating the 7-field layout.
- **AC 3 ("не забороняє однакове ПІБ") needs no code — it's an absence, already true.** There is no unique constraint on `Player.fullName` (schema unchanged since Story 2.1: `@@index([entryId])` only) and this story adds none. Worth stating explicitly so a future reader doesn't "fix" a duplicate name as a bug.

## Tasks / Subtasks

- [x] **Task 1 — `src/domain/playerForm.ts` (NEW) + Vitest spec** (AC: 1, 2, 3)
  - [x] Pure module. `FULL_NAME_MAX = 120`; `FREE_TEXT_MAX = 60` for the six optional fields.
  - [x] `PlayerInput` — `null` is the "empty" sentinel for optional fields.
  - [x] `PlayerField = keyof PlayerInput`; `FieldErrors = Partial<Record<PlayerField, string>>`.
  - [x] `validatePlayer(raw)` — trims every field; collects every failing field at once.
  - [x] `src/domain/playerForm.test.ts` — 9 tests: all-filled, name-only (others null), whitespace-only optional → null, exact-max accepted, empty/whitespace `fullName` rejected (message content asserted), over-max `fullName` (message content asserted), each optional field over max independently, multi-error, Ukrainian message assertion.
  - [x] `pnpm test` → 5 files, 68/68.
- [x] **Task 2 — `src/data/entries.ts` (UPDATE): `getEntryForAdmin`** (AC: 1, 2, 3, 4)
  - [x] `getEntryForAdmin(tournamentId, entryId)` — scoped `findFirst`, returns `null` when the ids don't pair up. `typecheck`/`lint` clean.
- [x] **Task 3 — `src/data/players.ts` (NEW)** (AC: 1, 2, 3, 4)
  - [x] `listPlayersForEntry(entryId)`, `createPlayer(entryId, input)` (sole creator), `updatePlayer(entryId, playerId, input)` (sole updater, scoped `updateMany`), `deletePlayer(entryId, playerId)` (sole deleter, scoped `deleteMany`). `typecheck`/`lint` clean.
- [x] **Task 4 — `src/actions/players.ts` (NEW): `addPlayer` / `editPlayer` / `removePlayer`** (AC: 1, 2, 3, 4)
  - [x] `addPlayer(tournamentId, entryId, _prev, formData)` — `requireAdmin` (narrowed to `AdminRequiredError`, matching `createTournament`/`createTeam`) → `getEntryForAdmin` (not found → `formError`) → `validatePlayer` → `!ok` → `{ fieldErrors }` → `createPlayer` → `revalidatePath` → `{}`.
  - [x] `editPlayer(tournamentId, entryId, playerId, _prev, formData)` — same shape → `updatePlayer` (`count === 0` → `formError` "Гравця не знайдено.") → `revalidatePath` → `{}`.
  - [x] `removePlayer(tournamentId, entryId, playerId)` — `ActionResult<undefined>` → `getEntryForAdmin` (not found → `NOT_FOUND`) → `deletePlayer` (`count === 0` → `NOT_FOUND`) → `revalidatePath` → `{ ok: true }`.
  - [x] No new `ActionErrorCode`. `typecheck`/`lint` clean.
- [x] **Task 5 — `src/components/player-form.tsx` (NEW, Client Component)** (AC: 1, 2, 3, 4)
  - [x] Discriminated union props (the Story 2.5-review-fixed `TournamentFormProps` shape). Create: `{ mode?: "create"; tournamentId; entryId }`. Edit: `{ mode: "edit"; tournamentId; entryId; playerId; initial; onCancel }`.
  - [x] `useActionState` bound per mode. Seven controlled fields, UX-DR11 rationale.
  - [x] `formError` → `notify.error`. Success (falling edge of `pending`): create mode clears fields — **guarded against wiping in-progress typing of the next player** via the `team-form.tsx`/Story 2.7-review `submitted`-ref-comparison technique (proactively applied here, not left for a future review to catch) — + `notify.success` + `router.refresh()`; edit mode calls `onCancel()` + `notify.success` + `router.refresh()`.
  - [x] Submit label: "Додати гравця" / "Зберегти" + "Скасувати" in edit mode. **Lint-driven fixes during implementation:** `react-hooks/set-state-in-effect` required the clear-on-success `setForm` call to be an updater function that references prior state (not a bare `setForm(emptyValues())`); `react-hooks/refs` forbade writing to a ref during render (an `onCancelRef` sync-on-render attempt), resolved by putting the whole `props` object in the effect's dependency array instead. `typecheck`/`lint` clean.
- [x] **Task 6 — `src/components/roster.tsx` (NEW, Client Component)** (AC: 2, 4)
  - [x] Props: `{ tournamentId; entryId; players }` (a local `Player` type matching `listPlayersForEntry`'s shape — not a Prisma-generated import, matching the `team-enrollment.tsx` precedent).
  - [x] Local state: `editingPlayerId`. Editing row swaps in `<PlayerForm mode="edit" ... onCancel={...} />`.
  - [x] **Read row** — optional fields rendered only when non-null; "Редагувати" + `ConfirmDialog`-gated "Видалити" (with `try`/`catch` around the confirm call, matching `TeamEnrollment`'s remove).
  - [x] Empty list → plain paragraph. Always renders `<PlayerForm mode="create">` below. `typecheck`/`lint` clean.
- [x] **Task 7 — `src/app/admin/tournaments/[id]/entries/[entryId]/page.tsx` (NEW)** (AC: 1, 2, 3, 4)
  - [x] Server Component. `getEntryForAdmin(id, entryId)` → `notFound()` if null. `listPlayersForEntry(entryId)` → `<Roster>`.
  - [x] Back-link, `<h1>{entry.team.name}</h1>`, "Склад команди" label. Static `metadata`.
  - [x] `pnpm build` regenerated `.next/types` for the new nested route (the Story 2.4-carried caveat) — route table confirms `/admin/tournaments/[id]/entries/[entryId]` (`ƒ`). `typecheck`/`lint` clean.
- [x] **Task 8 — `src/components/team-enrollment.tsx` (UPDATE): link to the roster page** (AC: reachability)
  - [x] "Склад" link per entry row, unconditional on `state`. No other change. `typecheck`/`lint` clean.
- [x] **Task 9 — Docs**
  - [x] `src/domain/README.md` — `playerForm.ts` entry.
  - [x] `src/data/README.md` — `entries.ts`'s entry gains `getEntryForAdmin`; new `players.ts` entry.
  - [x] `src/actions/README.md` — `players.ts` entry. (Also corrected an outdated line: `removeTeamEntry` was documented as catching `P2025`, but the actual Story 2.7 fix checks `deleteEntry`'s `{count}` — fixed while touching this file.)
  - [x] `src/components/README.md` — `player-form.tsx` + `roster.tsx` entries.
  - [x] `AGENTS.md` — Stack-status bullet for Story 2.8.
  - [x] No `ARCHITECTURE-SPINE.md` / `EXPERIENCE.md` / `epics.md` / `SPEC.md` edit — the new route extends the documented `/admin/tournaments/**` prefix; no new invariant.
- [x] **Task 10 — `deferred-work.md` (UPDATE)**
  - [x] Add a **"Story 2.8 implementation"** section: `addPlayer`/`editPlayer`/`removePlayer` have no automated action-level test (same class as every prior action); `player-form.tsx`/`roster.tsx` untested at the component layer; no roster-size cap (SPEC gives none, not required); no public roster read yet (`listPlayersForEntry` is admin-only in this story — Story 2.9's decision).
- [x] **Task 11 — Verification gate** (AC: all)
  - [x] `pnpm test` (existing 4 domain files + the new `playerForm.test.ts`) · `pnpm typecheck` · `pnpm lint` · `pnpm build` clean. `pnpm test`: 5 test files, 68/68 passed.
  - [x] Route table — `/admin/tournaments/[id]/entries/[entryId]` (NEW, `ƒ`) added; rest unchanged (confirmed against Task 7's build output).
  - [x] Import-boundary greps: no new Prisma import site outside `src/data/**` (only the generated client's own self-imports under `src/generated/prisma/**` match); `src/domain/**` free of `next`/`react`.
  - [x] `scripts/verify-roster.mts` (NEW, self-cleaning) — 15/15 checks passed: `createPlayer` with only `fullName` → every optional field `null`; a second player with every field filled → stored verbatim; `updatePlayer` one field → updated, others untouched; **`updatePlayer`/`deletePlayer` scoped to a different, throwaway entry's id → `{count: 0}`, nothing changed** (the Story 2.7 lesson's direct regression test); `deletePlayer` one player → gone, the other survives; full teardown, no orphans.
  - [x] Re-ran all four prior verify scripts (`verify-tournament-create.mts`, `verify-tournament-edit-delete.mts`, `verify-team-create.mts`, `verify-team-enrollment.mts`) — all green, no cross-story regression.
  - [x] **Browser walkthrough — not run** (no automated Google OAuth in this environment, the same residual gap carried since Story 2.4). Coverage instead: `typecheck`/`lint`/`build` + the verify script (the real AC-1/AC-2/AC-4 check) + code review.
  - [x] Real command output + notes captured in the Dev Agent Record.
- [ ] **Task 12 — Commit(s)** — one commit + `git push origin main` per completed task. `build` gated each.

## Dev Notes

### What this story is / is NOT

**Is:** full CRUD for `Player` rows scoped to one `TournamentEntry` — add (name required, 6 optional fields), edit (same 7 fields), delete (`ConfirmDialog`), on a new `/admin/tournaments/[id]/entries/[entryId]` page linked from Story 2.7's "Команди" section. Every read/write scoped by `(tournamentId, entryId)` together.

**Is NOT** (do not pull forward):
- **Any tournament-state restriction on player CRUD** — explicitly decided against (see AC-interpretation notes).
- **The public roster page** (`/classic/[tournament]/teams/[team]`) → **Story 2.9**. `listPlayersForEntry` is admin-only in this story.
- **Any change to `Team` or `TournamentEntry` themselves** — this story only adds `Player` CRUD; entry enrollment/cancellation (Story 2.7) is untouched.
- **A roster size cap** — SPEC specifies none; not built.
- **`birthDate` as a real date type** — stays `String?`, decided in Story 2.1.

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/domain/playerForm.ts` | NEW | Pure. `validatePlayer`, `FULL_NAME_MAX`, `FREE_TEXT_MAX`. |
| `src/domain/playerForm.test.ts` | NEW | Vitest — valid/partial input, every bound, multi-error, message content. |
| `src/data/entries.ts` | UPDATE | + `getEntryForAdmin(tournamentId, entryId)`. |
| `src/data/players.ts` | NEW | `listPlayersForEntry`, `createPlayer`, `updatePlayer`, `deletePlayer` — all scoped by `(entryId, playerId)` where applicable. |
| `src/actions/players.ts` | NEW | `addPlayer`, `editPlayer`, `removePlayer`. |
| `src/components/player-form.tsx` | NEW | `mode: "create" \| "edit"`, discriminated union props. |
| `src/components/roster.tsx` | NEW | Read rows + inline edit-swap + add form. |
| `src/app/admin/tournaments/[id]/entries/[entryId]/page.tsx` | NEW | Roster page. |
| `src/components/team-enrollment.tsx` | UPDATE | + "Склад" link per entry row. |
| `scripts/verify-roster.mts` | NEW | Self-cleaning DB round-trip, includes the cross-entry-scoping regression check. |
| `src/{domain,data,actions,components}/README.md` · `AGENTS.md` · `deferred-work.md` | UPDATE | Module entries, Stack status, new deferred section. |
| `prisma/schema.prisma` | DO NOT TOUCH | `Player` already fully modeled (Story 2.1) — no migration this story. |
| `src/actions/result.ts` | DO NOT TOUCH | `removePlayer` reuses the existing `NOT_FOUND` code. |
| `src/lib/empty-states.ts` | DO NOT TOUCH | No constant fits "no players yet"; a plain paragraph is used instead, matching precedent. |

### Architecture compliance

- **AD-1 / layers** — `player-form.tsx`/`roster.tsx`/the page are View; `addPlayer`/`editPlayer`/`removePlayer` are Shell; `listPlayersForEntry`/`createPlayer`/`updatePlayer`/`deletePlayer`/`getEntryForAdmin` are Data; `validatePlayer` is Domain (pure). [ARCHITECTURE-SPINE.md#Design Paradigm]
- **AD-3 — dependency direction.** `view → shell` (`player-form.tsx` → `@/actions/players`), `shell → domain` (`addPlayer`/`editPlayer` → `@/domain/playerForm`), `shell → data` (→ `@/data/players`, `@/data/entries`), `data → domain` (`createPlayer`/`updatePlayer` take the `PlayerInput` type from `src/domain/playerForm` — a type-only import, the same sanctioned edge `createTeamRecord`/`createTournamentRecord` already established, Story 2.4).
- **AD-6 — every mutation is a Server Action under `requireAdmin()`.** All three actions call it first. [ARCHITECTURE-SPINE.md#AD-6]
- **AD-11 — `src/data` is the sole Prisma owner.** All new Prisma access lives in `src/data/players.ts` (+ the `entries.ts` addition); the domain module and actions never import Prisma. [ARCHITECTURE-SPINE.md#AD-11]
- **Consistency Conventions** — verb-named actions (`addPlayer`, `editPlayer`, `removePlayer`); `revalidatePath` after every write; `ConfirmDialog` for the destructive action; UA-only copy. [ARCHITECTURE-SPINE.md#Consistency Conventions]
- **EXPERIENCE.md** — the public `/classic/[tournament]/teams/[team]` route is the precedent this story's admin route structurally mirrors (different tree, same "one team's roster, one page" shape); §Voice (verb buttons: "Додати гравця", "Зберегти", "Видалити"); §Interaction Primitives (`ConfirmDialog` for the destructive action, synchronous edits with revalidation). [EXPERIENCE.md]
- **DESIGN.md** — same `Input`/`Label`/`Button` primitives as every prior admin form; no new components. [DESIGN.md#Components]

### Existing code being modified — current state → change → what must be preserved

**`src/data/entries.ts`** (Story 2.7, code-review-fixed)
- *Current:* `listEntriesForTournament`, `countTournamentEntries`, `createEntry`, `deleteEntry(tournamentId, entryId)` (scoped via `deleteMany`, the Story 2.7 review fix), `TOURNAMENT_ENTRY_NATURAL_KEY_INDEX`.
- *Change:* add `getEntryForAdmin(tournamentId, entryId)` — a scoped single-entry read, same `(tournamentId, entryId)`-together discipline `deleteEntry` already established.
- *Must preserve:* `deleteEntry`'s existing scoped-delete behavior verbatim — this story does not touch it.

**`src/components/team-enrollment.tsx`** (Story 2.7, code-review-fixed)
- *Current:* enroll picker (`useTransition`, `try`/`catch`-wrapped since the review fix) + entries list with `ConfirmDialog`-gated "Зняти" (`DRAFT`-only).
- *Change:* add a "Склад" link per entry row, unconditional on `state`.
- *Must preserve:* every existing behavior verbatim, including the review-fixed `try`/`catch` in `enroll()` and the stale-`selectedTeamId` guard (`effectiveTeamId`) — this story only adds a `<Link>`, touches no logic.

**`prisma/schema.prisma`** — unchanged. `Player`'s shape (`fullName` required, six optional `String?` fields, `entryId onDelete: Cascade`) already landed in Story 2.1.

### Testing requirements

- **Unit (Vitest):** `src/domain/playerForm.test.ts` — the deterministic core (required/optional field handling, every bound, multi-error, message content per the Story 2.7 review's lesson about weak content-free assertions).
- **Not unit-tested (no infra, same class as every prior action):** `addPlayer`/`editPlayer`/`removePlayer` themselves. Gate = `typecheck` + `lint` + the **DB round-trip script** (`verify-roster.mts`, which directly proves the `(entryId, playerId)` scoping this story is built around) + code review.
- **Regression:** `pnpm test` (5 files after this story), route table (`/admin/tournaments/[id]/entries/[entryId]` new `ƒ`, rest unchanged), import-boundary greps clean, all four prior verify scripts re-run unchanged.

### Previous story intelligence

**Story 2.7 (done, `2c6517e`):** the single most load-bearing lesson for this story — its code review found `removeTeamEntry` deleting a `TournamentEntry` by `entryId` alone, with no check that it belonged to the named `tournamentId`, letting a mismatched pair cancel an entry in the wrong tournament. Fixed via `deleteMany({ where: { id, tournamentId } })` returning `{ count }`. **This story's `updatePlayer`/`deletePlayer` apply the identical scoping discipline from the start** (`(entryId, playerId)` together), and `getEntryForAdmin(tournamentId, entryId)` extends the same discipline one level up (the page and every action verify the entry belongs to the tournament in the URL before doing anything else). Also reused: the `useTransition`+`try`/`catch` pattern for the delete button (`enroll()`'s missing catch was itself a review finding — don't repeat it), `ConfirmDialog`'s exact usage shape, and `TeamForm`'s clear-on-success / `router.refresh()` technique.

**Story 2.5 (done):** the `mode: "create" | "edit"` discriminated-union component pattern (`TournamentForm`, `TournamentFormProps`) — that story's own code review found and fixed a non-discriminated version of this exact prop shape (`tournamentId!` non-null assertion); `player-form.tsx` starts from the corrected shape directly, no such assertion needed here.

**Story 2.1 (done):** `Player`'s schema decisions this story builds on verbatim — `fullName` the only required field, six optional `String?` fields (including `birthDate` as free text, not a date type), `@@index([entryId])`, `onDelete: Cascade` from `TournamentEntry`, no dedup across entries (AC 3 needs no code).

### Git intelligence

Recent: `2c6517e` (2.7 code-review fixes) ← `c6aef62` (2.7 verification gate) ← `200846d` (2.7 deferred-work) ← `a418bbd` (2.7 docs) ← `716d2bd` (2.7 Команди section). `src/data/` = `client.ts`, `users.ts`, `errors.ts`, `tournaments.ts`, `teams.ts`, `entries.ts`, `README.md` — no `players.ts`. `src/actions/` = `result.ts`, `admin-roles.ts`, `tournaments.ts`, `teams.ts`, `entries.ts`, `README.md` — no `players.ts`. `src/domain/` = `README.md`, `tournamentState.ts`(+spec), `tournamentForm.ts`(+spec), `teamForm.ts`(+spec), `teamEnrollment.ts`(+spec) — no `playerForm.ts`. `src/components/` has `tournament-form.tsx`, `tournament-actions.tsx`, `team-form.tsx`, `team-enrollment.tsx`, `confirm-dialog.tsx`, `empty-state.tsx` — no `player-form.tsx`/`roster.tsx`. `src/app/admin/tournaments/[id]/` has only `page.tsx` — no `entries/` subdirectory. `.claude/` + `_bmad/` are git-ignored.

### Latest tech information

- No new library. Same React 19.2 `useActionState`/controlled-form pattern as every prior multi-field form; same `useTransition`+direct-call pattern as every prior single-action button.
- **Nested dynamic route params in Next 16** — `/admin/tournaments/[id]/entries/[entryId]/page.tsx` receives `params` as `Promise<{ id: string; entryId: string }>`; `const { id, entryId } = await params;`, same async-params convention already used by `/admin/tournaments/[id]/page.tsx`. **New-route `tsc` caveat carried since Story 2.4:** `PageProps<"/admin/tournaments/[id]/entries/[entryId]">` needs `.next/types`, which only exists after `next build` (or `next dev`) — run `pnpm build` before `pnpm typecheck` reports clean on this new route.

### Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 2.8 AC, FR-10), `glossary.md` ("Гравець", "Склад"), `SPEC.md` (CAP-4), `ARCHITECTURE-SPINE.md` (AD-1, AD-3, AD-6, AD-11, Consistency Conventions), `EXPERIENCE.md` (the public roster-route precedent, `ConfirmDialog`/synchronous-edit patterns, Voice), `2-1-tournament-team-player-schema.md` (`Player`'s exact schema and its "no dedup, free-text birthDate" decisions), `2-5-edit-delete-tournament.md` (the discriminated-union component-props fix this story's `PlayerForm` starts from), `2-7-enroll-remove-team.md` (the `(tournamentId, entryId)` scoping lesson this entire story is built around, the `try`/`catch`-on-delete lesson), `deferred-work.md` (nothing this story resolves — a fresh "Story 2.8 implementation" section instead).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.8: Склад команди — гравці] — user story + AC; FR-10
- [Source: _bmad-output/planning-artifacts/epics.md#FR-10] — "Адмін додає/редагує/видаляє Гравця у Складі; єдине обовʼязкове поле — ПІБ; решта полів опційні… унікальність гравців між Заявками система не контролює"
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#CAP-4] — team/roster capability
- [Source: _bmad-output/specs/spec-cherkasy-volley/glossary.md] — Гравець, Склад
- [Source: …/ARCHITECTURE-SPINE.md#AD-6, #AD-11, #Consistency Conventions] — Server Action + requireAdmin; src/data sole Prisma owner; revalidatePath after every write
- [Source: …/EXPERIENCE.md#Information Architecture] — `/classic/[tournament]/teams/[team]` — the public roster-route precedent
- [Source: _bmad-output/implementation-artifacts/2-1-tournament-team-player-schema.md] — `Player` schema, its free-text/no-dedup decisions
- [Source: _bmad-output/implementation-artifacts/2-5-edit-delete-tournament.md] — the discriminated-union component-props fix
- [Source: _bmad-output/implementation-artifacts/2-7-enroll-remove-team.md] — the `(tournamentId, entryId)` scoping lesson and the delete-button `try`/`catch` lesson
- [Source: src/components/team-enrollment.tsx · src/components/tournament-actions.tsx · src/components/confirm-dialog.tsx · src/app/admin/tournaments/[id]/page.tsx] — the exact patterns this story reuses

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

**Task 4 — deviation from the established `requireAdmin` pattern caught in review of my own draft.** First pass wrote `addPlayer`/`editPlayer` with a bare `catch { return { formError: "..." } }` around `requireAdmin()`, which would mask any unexpected non-auth error as "Потрібні права адміністратора." Fixed by importing `AdminRequiredError` and narrowing: `catch (error) { if (error instanceof AdminRequiredError) return {formError}; throw error; }` — matching `createTournament`/`createTeam`.

**Task 5 — two ESLint rules new to this story, both in `player-form.tsx`.** `react-hooks/set-state-in-effect`: `setForm(emptyValues())` (even wrapped as `setForm(() => emptyValues())`) directly inside a `useEffect` errors — fixed by adopting `team-form.tsx`'s `submitted`-ref-comparison updater (`setForm((current) => submitted.current && current === submitted.current ? emptyValues() : current)`), which reads prior state instead of ignoring it, and as a side benefit preserves in-progress typing for the next player (the exact gap Story 2.7's own review flagged, applied here proactively). `react-hooks/refs`: an early draft synced `onCancelRef.current` in the component body during render — errors. Fixed by removing the ref and calling `props.onCancel()` directly inside the effect, with `props` added to its dependency array (a "wasteful but correct" extra re-run, same precedent as `team-enrollment.tsx`).

**Task 7 — expected `tsc` failure on the new nested route, handled proactively.** Per the story's own Dev Notes caveat (carried since Story 2.4), `PageProps<"/admin/tournaments/[id]/entries/[entryId]">` needs `.next/types`, which doesn't exist for a brand-new route until a build runs. Ran `pnpm build` before `pnpm typecheck` — avoided a false failure; route table confirmed the new route as `ƒ`.

**Task 9 — pre-existing doc bug found and fixed while touching `src/actions/README.md`.** The `entries.ts` entry still described `removeTeamEntry` as mapping a caught `P2025` to `NOT_FOUND` — stale since the Story 2.7 review fix changed it to scope `deleteEntry` by `(tournamentId, entryId)` and check the returned `count === 0` instead. Corrected while adding this story's `players.ts` entry.

**Task 11 — script run.** `pnpm exec tsx scripts/verify-roster.mts` — 15/15 checks pass against the live Neon dev branch (self-cleaning: throwaway tournament + 2 teams + 2 entries + 2 players, all removed by the end), including the direct regression test for the Story 2.7 lesson applied to players (`updatePlayer`/`deletePlayer` scoped to a different entry's id → `{count: 0}`, nothing changed). Re-ran all four prior verify scripts immediately after — 13/13, 15/15, 5/5, 12/12, confirming no regression.

### Completion Notes List

- **Task 1:** `src/domain/playerForm.ts` (NEW) — `FULL_NAME_MAX`/`FREE_TEXT_MAX`, `validatePlayer(raw)` (trims every field, empty optional → `null`). 9 Vitest cases.
- **Task 2:** `src/data/entries.ts` (UPDATE) — `getEntryForAdmin(tournamentId, entryId)`, `findFirst` scoped by both ids, `null` on mismatch.
- **Task 3:** `src/data/players.ts` (NEW) — `listPlayersForEntry`, `createPlayer`, `updatePlayer`/`deletePlayer` (both `(entryId, playerId)`-scoped via `updateMany`/`deleteMany` → `{count}`, applying the Story 2.7 lesson from the start).
- **Task 4:** `src/actions/players.ts` (NEW) — `addPlayer`/`editPlayer` (`PlayerFormState`) and `removePlayer` (`ActionResult<undefined>`); the `requireAdmin` narrowing fix (see Debug Log).
- **Task 5:** `src/components/player-form.tsx` (NEW) — `mode: "create" | "edit"` discriminated union; the two new ESLint-rule fixes (see Debug Log).
- **Task 6:** `src/components/roster.tsx` (NEW) — `PlayerRow` (filters null optional fields, `ConfirmDialog`-gated delete) + inline edit swap + always-rendered create form.
- **Task 7:** `/admin/tournaments/[id]/entries/[entryId]/page.tsx` (NEW) — `getEntryForAdmin` → `notFound()`; the `.next/types` build-before-typecheck caveat (see Debug Log).
- **Task 8:** `src/components/team-enrollment.tsx` (UPDATE) — "Склад" link per entry row, unconditional on `state`.
- **Task 9:** README updates in `src/{domain,data,actions,components}` + `AGENTS.md`; fixed the stale `removeTeamEntry`/`P2025` line in `src/actions/README.md` (see Debug Log).
- **Task 10:** `deferred-work.md` — new "Story 2.8 implementation" section (4 items).
- **Task 11:** `pnpm test` 5/5 files (68/68) · `typecheck` · `lint` · `build` (route table unchanged) — all clean. New `scripts/verify-roster.mts`: 15/15 live. All five verify scripts re-run together: 13/13 + 15/15 + 5/5 + 12/12 + 15/15, no regression. Browser walkthrough not run (no OAuth automation) — same residual gap as every prior story.

### File List

**New**
- `src/domain/playerForm.ts`
- `src/domain/playerForm.test.ts`
- `src/data/players.ts`
- `src/actions/players.ts`
- `src/components/player-form.tsx`
- `src/components/roster.tsx`
- `src/app/admin/tournaments/[id]/entries/[entryId]/page.tsx`
- `scripts/verify-roster.mts`

**Modified**
- `src/data/entries.ts` — `getEntryForAdmin` added
- `src/components/team-enrollment.tsx` — "Склад" link per entry
- `src/domain/README.md` · `src/data/README.md` · `src/actions/README.md` · `src/components/README.md` · `AGENTS.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-05 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
