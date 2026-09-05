---
baseline_commit: 42ec6e9
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - _bmad-output/specs/spec-cherkasy-volley/glossary.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/implementation-artifacts/2-1-tournament-team-player-schema.md
  - _bmad-output/implementation-artifacts/2-3-tournament-state-machine.md
  - _bmad-output/implementation-artifacts/2-5-edit-delete-tournament.md
  - _bmad-output/implementation-artifacts/2-6-team-directory.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - AGENTS.md
---

# Story 2.7: Enroll and remove a team from a tournament

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to add a team to a tournament and remove it if needed,
so that the list of participants forms (FR-9).

## Acceptance Criteria

Translated from `epics.md` → Epic 2 → Story 2.7. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** a tournament in state `DRAFT`, I am an admin
**When** I enroll a team from the directory
**Then**

1. A `TournamentEntry` is created; one team has at most one entry in this tournament.
2. Enrolling a new team is not possible outside state `DRAFT`.
3. Canceling an entry (via `ConfirmDialog`) deletes that entry's roster.

### Notes on AC interpretation

- **Cancellation is also restricted to `DRAFT`, even though AC 2's text only names enrollment.** FR-9's own wording frames the boundary as "після Жеребкування заявити нову Команду не можна" (after the draw, a *new* team can't be enrolled) — but removing an already-enrolled team once the group calendar exists (Epic 3's `GroupSlot`/`Match`, seeded from the draw) would corrupt that structure. **Decision: lock both enroll and cancel to `DRAFT`.** Symmetric, matches the product intent, and avoids a state where an admin can create entries but never undo one outside `DRAFT`. No further state-based nuance needed until Epic 3 models what "removing a drawn team" even means.
- **Two more preconditions on enroll, beyond AC 1's literal "one entry per team":** (a) **the field is full** — `TournamentEntry` count reaching `Tournament.teamCount` blocks further enrollment. This is the deferred-work.md item explicitly assigned here: *"The schema allows more entries than the configured field size … Story 2.7's enroll action asserts `count < teamCount` before insert."* (b) **the team is already enrolled** — the DB's own `@@unique([tournamentId, teamId])` (Story 2.1, index `tournament_entry_tournamentId_teamId_key`) is the enforcement; the action maps its `P2002` to a duplicate-entry message rather than a raw 500.
- **Both preconditions (state, capacity) extracted to a pure `src/domain` function, unit-tested — not left inline in the Server Action.** This directly avoids repeating the exact gap three of the last four code reviews converged on (`resolveGroupStageFields`, Story 2.5's fix for the identical class of issue: business-rule logic embedded in an untestable action). `src/domain/teamEnrollment.ts` — `checkCanEnroll(state, currentEntryCount, teamCount)` and `checkCanRemoveEntry(state)` — both pure, both return `{ ok: true } | { ok: false; message }`.
- **No new page, no new route.** EXPERIENCE.md's IA already places this on the existing tournament management surface: `/admin/tournaments/[t] — Ведення: команди, жеребкування, розклад, результати, плейоф, «завершити турнір»`. **Decision: extend the existing `/admin/tournaments/[id]` page** (Story 2.4 stub → Story 2.5 edit/delete form) with a "Команди" section between the edit form and the delete button — the same "shared surface, extended not rebuilt" principle both prior stories already followed there.
- **`countTournamentEntries` relocates from `src/data/tournaments.ts` to the new `src/data/entries.ts`.** It's `TournamentEntry`-owned, not `Tournament`-owned, and was only ever in `tournaments.ts` because no entry-specific data module existed yet (Story 2.3). Same relocation reasoning Story 2.6 already applied to `isUniqueViolation`/`isRecordNotFound` → `src/data/errors.ts`. Its one caller (`transitionTournament`'s `DRAFT → GROUP_STAGE` precondition, Story 2.3) updates its import path only — zero behavior change.
- **Enrollment UI uses the `useTransition` + direct-call pattern (`GrantAdminButton`/`RevokeAdminButton`, Story 1.7/2.2), not `useActionState`.** Picking a team from a `<select>` and clicking "Заявити" is a single-value action, not a multi-field form needing per-field errors — the same reasoning that put `createTeam`/`createTournament` on `useActionState` (many fields) doesn't apply here.
- **Empty team directory is a real, specified empty state, not an edge case to shrug off.** If `listTeams()` returns nothing, the `<select>` has no options to enroll. The picker area shows a message directing the admin to `/admin/teams` instead of rendering a non-functional empty dropdown.

## Tasks / Subtasks

- [x] **Task 1 — `src/domain/teamEnrollment.ts` (NEW) + Vitest spec** (AC: 1, 2, 3)
  - [x] Pure module. Imports `type { TournamentState } from "@/domain/tournamentState"` (domain→domain sibling import).
  - [x] `checkCanEnroll(state, currentEntryCount, teamCount)` — DRAFT + under-capacity gate, state checked before capacity.
  - [x] `checkCanRemoveEntry(state)` — DRAFT-only gate.
  - [x] `src/domain/teamEnrollment.test.ts` — 6 tests: DRAFT + under-capacity passes; every non-DRAFT state rejected; at/over capacity rejected; state takes priority over capacity in the message; Ukrainian message assertion.
  - [x] `pnpm test` → 4 files, 59/59.
- [x] **Task 2 — `src/data/entries.ts` (NEW): reads, writers, relocated `countTournamentEntries`** (AC: 1, 2, 3)
  - [x] `listEntriesForTournament(tournamentId)` — joined `team: { id, name }` select, ordered by team name.
  - [x] `countTournamentEntries(tournamentId)` — moved from `src/data/tournaments.ts`.
  - [x] `createEntry(tournamentId, teamId)` — sole creator.
  - [x] `deleteEntry(entryId)` — sole canceler; cascade handles `Player` removal.
  - [x] `TOURNAMENT_ENTRY_NATURAL_KEY_INDEX = "tournament_entry_tournamentId_teamId_key"` — matches the migration file verbatim.
  - [x] `src/data/tournaments.ts` — `countTournamentEntries` removed; `src/actions/tournaments.ts` imports it from `@/data/entries`. `typecheck`/`lint` clean.
- [x] **Task 3 — `src/actions/entries.ts` (NEW): `enrollTeam` + `removeTeamEntry`** (AC: 1, 2, 3)
  - [x] `enrollTeam(tournamentId, teamId)` — `requireAdmin` → `getTournamentForAdmin` (not found → `NOT_FOUND`) → `checkCanEnroll` (not ok → `PRECONDITION_FAILED`) → `createEntry` (`P2002` → `PRECONDITION_FAILED` "вже заявлена") → `revalidatePath` → `{ ok: true }`.
  - [x] `removeTeamEntry(tournamentId, entryId)` — `requireAdmin` → `getTournamentForAdmin` (not found → `NOT_FOUND`) → `checkCanRemoveEntry` (not ok → `PRECONDITION_FAILED`) → `deleteEntry` (`P2025` → `NOT_FOUND` "вже видалено") → `revalidatePath` → `{ ok: true }`.
  - [x] No new `ActionErrorCode` — reuses `PRECONDITION_FAILED`/`NOT_FOUND`. `typecheck`/`lint` clean.
- [x] **Task 4 — `src/components/team-enrollment.tsx` (NEW, Client Component)** (AC: 1, 2, 3)
  - [x] Props as specified: `tournamentId`, `state`, `teamCount`, `entries`, `availableTeams`.
  - [x] **Enroll control** — native `<select>` + `Button` ("Заявити"), `useTransition` + direct call to `enrollTeam(tournamentId, teamId)`. Disabled via `checkCanEnroll(state, entries.length, teamCount)` (client-side UI hint, not an authorization boundary — the server re-checks) or when the directory is exhausted.
  - [x] **Empty-directory case** — `availableTeams.length === 0 && entries.length === 0` → a line + link to `/admin/teams`. Exhausted (`availableTeams.length === 0` but entries exist) → keep the control, disable with a caption.
  - [x] **Entries list** — team name + (DRAFT only) a `ConfirmDialog`-gated "Зняти" button; outside DRAFT, plain text row (matches the AC-interpretation decision that removal is DRAFT-only — no disabled button needed since the section's own caption already explains why).
  - [x] Empty entries (`entries.length === 0`) → `<EmptyState {...NO_TEAMS} />` — its first genuinely correct use site.
  - [x] **Fix during implementation:** guarded against a stale `selectedTeamId` surviving a `router.refresh()` that removes it from `availableTeams` (e.g. the just-enrolled team) — derived an `effectiveTeamId` that falls back to the current first available team instead of rendering a `<select>` with no matching `<option>`.
  - [x] `typecheck`/`lint` clean.
- [x] **Task 5 — `src/app/admin/tournaments/[id]/page.tsx` (UPDATE): the "Команди" section** (AC: 1, 2, 3)
  - [x] Fetches `listTeams()` and `listEntriesForTournament(id)` alongside `getTournamentForAdmin(id)` in one `Promise.all`. `availableTeams` computed via a `Set` of enrolled `teamId`s.
  - [x] Inserted the "Команди" section between the edit form and the `DeleteTournamentButton` section (primary edit → participants → destructive delete).
  - [x] Edit form, delete button, back-link, and `metadata` untouched. `typecheck`/`lint` clean.
- [ ] **Task 6 — Docs**
  - [ ] `src/domain/README.md` — `teamEnrollment.ts` entry (`checkCanEnroll`, `checkCanRemoveEntry`).
  - [ ] `src/data/README.md` — new `entries.ts` module entry (`listEntriesForTournament`, `countTournamentEntries` — relocated, `createEntry`, `deleteEntry`, `TOURNAMENT_ENTRY_NATURAL_KEY_INDEX`); update the `tournaments.ts` entry to drop `countTournamentEntries`.
  - [ ] `src/actions/README.md` — `entries.ts` entry (`enrollTeam`, `removeTeamEntry` — `ActionResult` shape, preconditions via `teamEnrollment.ts`).
  - [ ] `src/components/README.md` — `team-enrollment.tsx` entry (enroll picker + entries list, `useTransition` pattern, the one legitimate `NO_TEAMS` use site).
  - [ ] `AGENTS.md` — Stack-status bullet for Story 2.7.
  - [ ] No `ARCHITECTURE-SPINE.md` / `EXPERIENCE.md` / `epics.md` / `SPEC.md` edit — no new invariant, no new route.
- [ ] **Task 7 — `deferred-work.md` (UPDATE)**
  - [ ] Mark **resolved**: 2-1-review "`TournamentEntry` count vs `Tournament.teamCount`" (this story's `checkCanEnroll` capacity check).
  - [ ] Add a **"Story 2.7 implementation"** section: `enrollTeam`/`removeTeamEntry` have no automated action-level test (same class of gap as every prior action; the domain preconditions **are** unit-tested this time, narrowing what's actually untested to the `requireAdmin` gate and the DB round-trip); `team-enrollment.tsx` untested at the component layer; no UI yet for "field full" vs "team already enrolled" visual distinction beyond the toast message (both currently surface identically as a `notify.error`).
- [ ] **Task 8 — Verification gate** (AC: all)
  - [ ] `pnpm test` (existing 3 domain files + the new `teamEnrollment.test.ts`) · `pnpm typecheck` · `pnpm lint` · `pnpm build` clean.
  - [ ] Route table unchanged (no new route — `/admin/tournaments/[id]` already exists).
  - [ ] Import-boundary greps: no new Prisma import site outside `src/data/**`; `src/domain/**` free of `next`/`react`.
  - [ ] `scripts/verify-team-enrollment.mts` (NEW, self-cleaning, same style as the Story 2.4/2.5/2.6 scripts): create a throwaway tournament (`teamCount: 2`) and two throwaway teams → `createEntry` both → assert exactly 2 entries, `countTournamentEntries` returns 2 → assert a third enroll attempt's precondition (`checkCanEnroll` with `currentEntryCount: 2, teamCount: 2`) reports not-ok → assert a duplicate `createEntry` (same tournament+team pair) rejects as `P2002` via `isUniqueViolation(error, TOURNAMENT_ENTRY_NATURAL_KEY_INDEX)` → `deleteEntry` one → assert its `Player` roster (add one throwaway player first) cascades away → delete the tournament (cascades the rest) and both teams, confirm nothing orphaned.
  - [ ] **Browser walkthrough — expect not run** (no automated Google OAuth in this environment, the same residual gap carried since Story 2.4). Coverage instead: `typecheck`/`lint`/`build` + the verify script (the real AC-1/AC-2/AC-3 check) + code review.
  - [ ] Capture real command output + notes in the Dev Agent Record.
- [ ] **Task 9 — Commit(s)** — one commit + `git push origin main` per completed task. `build` gated each.

## Dev Notes

### What this story is / is NOT

**Is:** enrolling a team from the directory into a `DRAFT` tournament (capacity- and duplicate-checked), canceling an entry (`DRAFT`-only, cascades its roster), both preconditions as a pure unit-tested `src/domain/teamEnrollment.ts`, `src/data/entries.ts` (+ the relocated `countTournamentEntries`), `src/actions/entries.ts` (`enrollTeam`/`removeTeamEntry`), and a new "Команди" section on the existing `/admin/tournaments/[id]` page.

**Is NOT** (do not pull forward):
- **Roster / players within an entry** → **Story 2.8**. This story creates and deletes `TournamentEntry` rows; it does not touch `Player`.
- **The public Teams tab** → **Story 2.9**. `listEntriesForTournament` is admin-only in this story; a public roster read is a later decision.
- **The draw, `GroupSlot`/`Match`** → **Epic 3**. Entries are the *input* to the eventual draw, not wired to it yet.
- **Any change to `Team` itself** (edit/delete/normalization) — that's Story 2.6's surface, untouched here.
- **A visual distinction between "field full" and "team already enrolled"** — both currently produce a `notify.error` toast with different text but identical presentation; a richer inline treatment is deferred.

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/domain/teamEnrollment.ts` | NEW | Pure. `checkCanEnroll`, `checkCanRemoveEntry`. |
| `src/domain/teamEnrollment.test.ts` | NEW | Vitest — state gate + capacity boundary for both functions. |
| `src/data/entries.ts` | NEW | `listEntriesForTournament`, `countTournamentEntries` (relocated), `createEntry`, `deleteEntry`, `TOURNAMENT_ENTRY_NATURAL_KEY_INDEX`. |
| `src/data/tournaments.ts` | UPDATE | `countTournamentEntries` removed (moved). No other change. |
| `src/actions/tournaments.ts` | UPDATE | `transitionTournament`'s `countTournamentEntries` import path updated only. |
| `src/actions/entries.ts` | NEW | `enrollTeam`, `removeTeamEntry`. |
| `src/components/team-enrollment.tsx` | NEW | Enroll picker + entries list, `useTransition`. |
| `src/app/admin/tournaments/[id]/page.tsx` | UPDATE | + "Команди" section between the edit form and delete button. |
| `scripts/verify-team-enrollment.mts` | NEW | Self-cleaning DB round-trip. |
| `src/{domain,data,actions,components}/README.md` · `AGENTS.md` · `deferred-work.md` | UPDATE | Module entries, Stack status, resolved deferred item. |
| `prisma/schema.prisma` | DO NOT TOUCH | `TournamentEntry`'s `@@unique`/cascade FKs already correct (Story 2.1) — no migration this story. |
| `src/domain/tournamentForm.ts`, `src/domain/tournamentState.ts` | DO NOT TOUCH | Reused (`TournamentState` type import), not modified. |
| `src/actions/result.ts` | DO NOT TOUCH | `enrollTeam`/`removeTeamEntry` reuse the existing `ActionResult`/`PRECONDITION_FAILED`/`NOT_FOUND` — no new code needed. |
| `src/lib/empty-states.ts` | DO NOT TOUCH | `NO_TEAMS` reused as-is — this story is its correct first real consumer. |

### Architecture compliance

- **AD-1 / layers** — `team-enrollment.tsx`/the page section are View; `enrollTeam`/`removeTeamEntry` are Shell (`src/actions`); `listEntriesForTournament`/`countTournamentEntries`/`createEntry`/`deleteEntry` are Data; `checkCanEnroll`/`checkCanRemoveEntry` are Domain (pure). [ARCHITECTURE-SPINE.md#Design Paradigm]
- **AD-3 — dependency direction.** `view → shell` (`team-enrollment.tsx` → `@/actions/entries`), `shell → domain` (`enrollTeam` → `@/domain/teamEnrollment`), `shell → data` (→ `@/data/entries`, `@/data/tournaments`, `@/data/errors`). No new `data → domain` edge — `src/data/entries.ts` takes no domain types (unlike `createTeamRecord`/`createTournamentRecord`, its inputs are plain `string`s).
- **AD-6 — every mutation is a Server Action under `requireAdmin()`.** Both `enrollTeam` and `removeTeamEntry` call it first. [ARCHITECTURE-SPINE.md#AD-6]
- **AD-8 — `state` changes only via `transitionTournament`.** Neither new action touches `Tournament.state`; they only *read* it (via `getTournamentForAdmin`) to gate their own preconditions. [ARCHITECTURE-SPINE.md#AD-8]
- **AD-11 — `src/data` is the sole Prisma owner.** All new Prisma access lives in `src/data/entries.ts`; the domain module and action never import Prisma. [ARCHITECTURE-SPINE.md#AD-11]
- **Consistency Conventions** — verb-named actions (`enrollTeam`, `removeTeamEntry`); `revalidatePath` after every write; the delete confirmation uses `ConfirmDialog`, never `confirm()`; UA-only copy. [ARCHITECTURE-SPINE.md#Consistency Conventions]
- **EXPERIENCE.md** — §Component Patterns "Admin action bar … Чернетка → «Заявити команду»" (the exact verb, the exact state gate); §Interaction Primitives ("Підтвердження: руйнівні й незворотні дії … shadcn Dialog"); §Voice (verb buttons, plain Ukrainian). [EXPERIENCE.md]
- **DESIGN.md** — same `Button`/native-`<select>` primitives as every prior admin form; no new components. [DESIGN.md#Components]

### Existing code being modified — current state → change → what must be preserved

**`src/data/tournaments.ts`** (Story 2.3/2.4/2.5)
- *Current:* `getTournamentForAdmin`, `listTournamentsForAdmin`, `countTournamentEntries`, `setTournamentState`, `createTournamentRecord`, `updateTournamentRecord`, `deleteTournamentRecord`, `TOURNAMENT_NATURAL_KEY_INDEX`.
- *Change:* remove `countTournamentEntries` (moves to `entries.ts`). Every other export unchanged.
- *Must preserve:* `setTournamentState` remains the sole `state` writer (AD-8, untouched).

**`src/actions/tournaments.ts`** (Story 2.3/2.4/2.5)
- *Current:* `transitionTournament`, `createTournament`, `updateTournament`, `deleteTournament`.
- *Change:* import `countTournamentEntries` from `@/data/entries` instead of `@/data/tournaments`. No other line changes.
- *Must preserve:* `transitionTournament`'s exact behavior — this is purely an import-path edit, not a logic change.

**`src/app/admin/tournaments/[id]/page.tsx`** (Story 2.4 stub → Story 2.5 edit/delete)
- *Current:* back-link, `<h1>`, state label, `<TournamentForm mode="edit">`, a bordered `<DeleteTournamentButton>` section.
- *Change:* insert the "Команди" section between the form and the delete section; fetch two more reads in parallel with the existing one.
- *Must preserve:* the edit form and delete button exactly as Story 2.5 shipped them — this story only adds a section, touches nothing else on the page.

**`prisma/schema.prisma`** — unchanged. `TournamentEntry`'s `@@unique([tournamentId, teamId])`, `onDelete: Cascade` (from `Tournament` and to `Player`), and `onDelete: Restrict` (to `Team`) already landed in Story 2.1.

### Testing requirements

- **Unit (Vitest):** `src/domain/teamEnrollment.test.ts` — the deterministic core (state gate for both functions, the capacity boundary). This is the primary automated proof for AC 1/2/3's business rules — narrower than prior stories' gaps, since the exact class of "untested action-embedded logic" finding from Stories 2.4/2.5's reviews is closed by construction this time.
- **Not unit-tested (no infra, same class as every prior action):** `enrollTeam`/`removeTeamEntry` themselves (the `requireAdmin` gate, the `P2002`/`P2025` catches, the DB writes). Gate = `typecheck` + `lint` + the **DB round-trip script** (`verify-team-enrollment.mts`) + code review.
- **Regression:** `pnpm test` (4 files after this story), route table unchanged, import-boundary greps clean, `verify-tournament-create.mts`/`verify-tournament-edit-delete.mts`/`verify-team-create.mts` re-run unchanged (proving the `countTournamentEntries` relocation didn't regress `transitionTournament`).

### Previous story intelligence

**Story 2.6 (done, `42ec6e9`):** the `src/data/errors.ts` extraction (moving generic Prisma-error predicates to their natural shared home once a second/third consumer exists) is the exact precedent this story applies to `countTournamentEntries` (moving an entity-owned reader to its natural entity module). `listTeams()` (no draft/privacy split, `select: { id, name }` after its own code-review fix) is reused as-is for the enroll picker's team source. The `TeamForm`/`DeleteTournamentButton` `useTransition`/`useActionState` split (form-state for multi-field forms, `useTransition`+direct-call for single-action buttons) is the direct model for `team-enrollment.tsx`'s two halves (the picker is single-value → `useTransition`; there is no multi-field form here at all).

**Story 2.5 (done):** `resolveGroupStageFields` — the pure-domain-precondition-instead-of-inline-action-logic pattern this story's `checkCanEnroll`/`checkCanRemoveEntry` directly copies, precisely because the code review that added it flagged the *absence* of exactly this pattern as the most severe finding across two consecutive stories. The `/admin/tournaments/[id]` page's section layout (edit form, then a bordered section, top-to-bottom primary→destructive ordering) is the shape this story's new "Команди" section slots into.

**Story 2.3 (done):** `countTournamentEntries` and `getTournamentForAdmin` already exist and are reused verbatim (the former relocated, the latter imported as-is) — no new admin read needed beyond `listEntriesForTournament`.

**Story 2.1 (done):** `TournamentEntry`'s `@@unique([tournamentId, teamId])` (index `tournament_entry_tournamentId_teamId_key`, confirmed live in the migration file — no discovery step needed this time) and the `Player.entryId onDelete: Cascade` FK are exactly what AC 1 and AC 3 need; both already exist, zero schema work this story.

### Git intelligence

Recent: `42ec6e9` (2.6 code-review fixes) ← `615f4bc` (Neon dev-branch docs, unrelated infra) ← `6937dc0` (2.6 verification gate) ← `758eee8` (2.6 deferred-work) ← `761cd2d` (2.6 docs). `src/data/` = `client.ts`, `users.ts`, `errors.ts`, `tournaments.ts`, `teams.ts`, `README.md` — no `entries.ts`. `src/actions/` = `result.ts`, `admin-roles.ts`, `tournaments.ts`, `teams.ts`, `README.md` — no `entries.ts`. `src/domain/` = `README.md`, `tournamentState.ts`(+spec), `tournamentForm.ts`(+spec), `teamForm.ts`(+spec) — no `teamEnrollment.ts`. `src/components/` has `tournament-form.tsx`, `tournament-actions.tsx`, `team-form.tsx`, `confirm-dialog.tsx`, `admin-role-controls.tsx` — no `team-enrollment.tsx`. `.claude/` + `_bmad/` are git-ignored.

### Latest tech information

- No new library. Same React 19.2 `useTransition` pattern as `admin-role-controls.tsx` (Story 1.7/2.2); same Prisma 7 / `@prisma/adapter-pg` P2002 shape as every prior story (`isUniqueViolation` already handles it generically via `src/data/errors.ts`, Story 2.6 — no new discovery needed).
- **Postgres cascade delete** on `TournamentEntry → Player` (`onDelete: Cascade`, Story 2.1) removes the roster in the same statement as `deleteEntry` — no explicit `Player` cleanup code needed in `src/data/entries.ts`.

### Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 2.7 AC, FR-9), `glossary.md` ("Заявка команди" — "участь Команди в конкретному Турнірі разом зі Складом"), `SPEC.md` (CAP-4, CAP-5's "Жеребкування недоступне, поки кількість заявок не дорівнює заданій кількості команд" — the flip side of this story's capacity cap), `ARCHITECTURE-SPINE.md` (AD-1, AD-3, AD-6, AD-8, AD-11, Consistency Conventions), `EXPERIENCE.md` (admin action bar's exact "Заявити команду" verb + `DRAFT`-only gating; confirm-dialog pattern), `2-1-tournament-team-player-schema.md` (the `TournamentEntry` schema, its unique index, the cascade FKs, the deferred capacity-check item this story resolves), `2-3-tournament-state-machine.md` (`countTournamentEntries`'s original home and its one caller), `2-5-edit-delete-tournament.md` (`resolveGroupStageFields` — the pure-domain-precondition precedent), `2-6-team-directory.md` (`listTeams()`, the `errors.ts` relocation precedent, `NO_TEAMS`'s real intended context), `deferred-work.md` (the capacity-check item this story resolves).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.7: Заявити та зняти команду з турніру] — user story + AC (DRAFT-only enroll, one entry per team, ConfirmDialog cancel deletes roster); FR-9
- [Source: _bmad-output/planning-artifacts/epics.md#FR-9] — "Адмін заявляє Команду в Турнір (у Стані Чернетка) і скасовує Заявку; після Жеребкування заявити нову Команду не можна; скасування видаляє Склад Заявки"
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#CAP-4, #CAP-5] — team/roster capability; the draw's "заявок == teamCount" precondition, the mirror of this story's capacity cap
- [Source: _bmad-output/specs/spec-cherkasy-volley/glossary.md] — Заявка команди, Склад
- [Source: …/ARCHITECTURE-SPINE.md#AD-6, #AD-8, #AD-11, #Consistency Conventions] — Server Action + requireAdmin; state via transitions only; src/data sole Prisma owner; revalidatePath after every write
- [Source: …/EXPERIENCE.md#Component Patterns, #Interaction Primitives] — admin action bar's DRAFT-state "Заявити команду"; ConfirmDialog for destructive actions
- [Source: _bmad-output/implementation-artifacts/2-1-tournament-team-player-schema.md] — `TournamentEntry` schema, unique index, cascade FKs, the capacity-check deferred item
- [Source: _bmad-output/implementation-artifacts/2-3-tournament-state-machine.md] — `countTournamentEntries`'s origin, its one caller
- [Source: _bmad-output/implementation-artifacts/2-5-edit-delete-tournament.md] — `resolveGroupStageFields` precedent
- [Source: _bmad-output/implementation-artifacts/2-6-team-directory.md] — `listTeams()`, the `errors.ts` relocation precedent, `NO_TEAMS`'s real context
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — the capacity-check item this story resolves
- [Source: src/components/admin-role-controls.tsx · src/components/confirm-dialog.tsx · src/components/tournament-actions.tsx · src/app/admin/tournaments/[id]/page.tsx] — the exact patterns this story reuses

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-05 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
