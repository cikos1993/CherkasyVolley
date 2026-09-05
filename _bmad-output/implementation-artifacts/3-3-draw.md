---
baseline_commit: 02979c0933b5d2e877d23873aee91fe92551e3cf
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/implementation-artifacts/2-3-tournament-state-machine.md
  - _bmad-output/implementation-artifacts/2-7-enroll-remove-team.md
  - _bmad-output/implementation-artifacts/3-1-domain-engine-scoring-tiebreak-schedule-validation.md
  - _bmad-output/implementation-artifacts/3-2-group-stage-schema.md
  - AGENTS.md
---

# Story 3.3: Draw

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an адмін,
I want to run the draw for a fully-entered tournament,
so that groups and the match calendar are formed (FR-11).

## Acceptance Criteria

Translated from `epics.md` → Epic 3 → Story 3.3. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** a tournament in state `DRAFT`, with entries equal to `teamCount`
**When** I press "Провести жеребкування"
**Then**

1. Entries are distributed into the single group; a calendar is generated (round-robin, `rounds` cycles) with random pair order within tours.
2. The tournament's state moves to `GROUP_STAGE`; the calendar becomes visible to every viewer.
3. The button is unavailable, with an explanation, while the entry count ≠ `teamCount`.

### Notes on AC interpretation

- **This is the first story to wire Story 3.1's domain engine and Story 3.2's schema into an actual write path.** Everything both stories built (`generateSchedule`, the `Match`/`GroupSlot` tables, `checkTransition`'s already-built `DRAFT → GROUP_STAGE` precondition) has existed unused since it landed — this story is where it all gets called for real, for the first time.
- **`drawTournament` is a new, dedicated Server Action — not routed through the existing generic `transitionTournament`.** `ARCHITECTURE-SPINE.md`'s AD-8 literally says lifecycle transitions are "окремі Server Actions, кожна перевіряє передумови" (separate Server Actions, each checking its own precondition) — Story 2.3's `transitionTournament(id, targetState)` is a single parameterized action instead, an already-acknowledged deviation from that wording (tracked in `deferred-work.md` since the 2.3 review). This story's `drawTournament` is, in effect, the first genuinely "окрема Server Action" AD-8 describes — and it needs to be its own action regardless, because pressing "Провести жеребкування" does domain work (seating entries, generating matches) that has nothing to do with `transitionTournament`'s generic shape and can't be bolted onto it without special-casing one target state inside a supposedly generic function. **Decision: `drawTournament` reuses `checkTransition` directly** (the same domain gate `transitionTournament` calls) rather than calling `transitionTournament` as a nested action — avoiding both a duplicate precondition implementation and a second, non-atomic `requireAdmin()`/DB round trip.
- **Seating entries, creating matches, and writing `state` all happen in one `db.$transaction`.** A partial failure (e.g. matches created but the state write fails) would leave `GROUP_STAGE`-shaped data on a `DRAFT` tournament — a genuinely broken state, unlike the already-accepted low-stakes TOCTOU races this project tolerates elsewhere (e.g. `enrollTeam`'s capacity check). **`src/data/tournaments.ts`'s `setTournamentState` gains an optional transaction-client parameter** (defaulting to the shared `db`, so every existing caller — `transitionTournament` — is unaffected) so it can participate in this story's transaction while remaining the sole function that ever writes `Tournament.state` (AD-8) — the invariant is about *which function* issues the write, not which action calls it or what transaction wraps it.
- **`generateSchedule`'s `round`/`tour` fields are not persisted anywhere.** They exist purely to make the circle-method algorithm produce a valid round-robin (ensuring no team plays twice in one tour, and distributing byes correctly) — `Match` has no `round`/`tour` column (Story 3.2 didn't add one, deliberately: nothing in FR-13/FR-14/the "Розклад" tab's AC groups matches by tour, only by date/time, which the admin sets by hand in Story 3.5). This story creates one flat `Match` row per pairing and discards the `round`/`tour` metadata once the pairing list is built — not a missed field, a generation-time-only concept.
- **`getTournamentForAdmin` gains the tournament's `Group` id** (`group: { select: { id: true } }`) — a minimal, backward-compatible addition (existing callers reading scalar fields are unaffected) needed because no `src/data` function currently exposes a tournament's group id outside `matches.ts`'s own internal query, and `drawTournament` needs it to seat `GroupSlot` rows.
- **No `ConfirmDialog` for the draw button.** `EXPERIENCE.md`'s "Підтвердження" section names a specific, closed list of actions requiring one (delete result, delete tournament, revoke admin role, finish tournament) — "провести жеребкування" isn't among them, and it's the natural, single primary action on a fully-entered `DRAFT` tournament (matching `EXPERIENCE.md`'s own admin-action-bar description: "Чернетка → «Заявити команду», «Провести жеребкування»"). **Decision: the button follows the `TeamEnrollment.enroll()` shape** (`useTransition` + a direct action call, `try`/`catch`, `notify` + `router.refresh()` on completion) — no confirmation step, same as every other single-action button in this pattern family that isn't independently listed as destructive.
- **No new UI is needed to lock `teamCount`/`rounds` editing or hide "Заявити"/"Зняти" once the draw succeeds.** `tournament-form.tsx`'s `locked` prop (Story 2.5) already keys off `state !== "DRAFT"`; `team-enrollment.tsx`'s enroll/remove gates (Story 2.7, via `checkCanEnroll`/`checkCanRemoveEntry`) already key off the same. A successful draw's `router.refresh()` re-fetches the tournament at its new `GROUP_STAGE` state, and every downstream lock this story needs already exists from prior stories — nothing here changes those files' logic, only what section renders alongside them.
- **No public route or display work this story.** "Календар видно всім глядачам" (AC 2) describes an *invariant* the draw's write must not violate (once `state = GROUP_STAGE`, the tournament is already publicly visible per AD-7/Story 2.9 — nothing in this story adds new admin-only gating on `Match` rows that would block that), not a new public page this story must build. The actual schedule/standings displays are Story 3.5 ("Розклад" tab) and Story 3.8 ("Таблиця" tab) — explicitly out of scope here.
- **The draw button's disabled state and caption reuse `checkTransition` directly in the client component** (`src/components/tournament-actions.tsx` or a new sibling file), the same `view → domain` type/logic import pattern `team-enrollment.tsx`'s `checkCanEnroll` already established (Story 2.7) — not a new sanctioned edge, an application of the existing one.

## Tasks / Subtasks

- [x] **Task 1 — `src/data/tournaments.ts` (UPDATE): `setTournamentState` gains an optional transaction client; `getTournamentForAdmin` gains `group.id`** (AC: 1, 2)
  - [x] `setTournamentState(id, state, client = db)` — `client` typed as the Prisma transaction-client type (same shape as `db`, minus the top-level `$transaction`/`$connect`/etc. methods); every existing call site (`transitionTournament`) is unaffected since the parameter defaults to `db`.
  - [x] `getTournamentForAdmin(id)` — add `group: { select: { id: true } }` to the query; existing callers reading only scalar fields are unaffected (Prisma widens the return type, doesn't narrow it).
  - [x] `typecheck`/`lint` clean; re-run `pnpm exec tsx scripts/verify-tournament-edit-delete.mts` (touches `getTournamentForAdmin`-adjacent code) to confirm no regression.
- [x] **Task 2 — `src/data/draw.ts` (NEW): `saveDraw`** (AC: 1, 2)
  - [x] `saveDraw(tournamentId, groupId, entryIds, pairings): Promise<void>` — `pairings: { homeEntryId: string; awayEntryId: string }[]`. Inside one `db.$transaction`: `tx.groupSlot.createMany({ data: entryIds.map((entryId) => ({ groupId, entryId })) })`, `tx.match.createMany({ data: pairings.map((p) => ({ tournamentId, groupId, stage: "GROUP", ...p })) })`, then `setTournamentState(tournamentId, "GROUP_STAGE", tx)`.
  - [x] Doc comment: performs no validation itself — the caller (`drawTournament`) must have already confirmed the precondition via `checkTransition`. Sole writer of a draw's initial data; never called again for the same tournament (Story 3.4's redraw is a separate, later data function that only replaces `Match` rows).
  - [x] `typecheck`/`lint` clean.
- [x] **Task 3 — `src/actions/draw.ts` (NEW): `drawTournament`** (AC: 1, 2, 3)
  - [x] `drawTournament(tournamentId): Promise<ActionResult<undefined>>` — `requireAdmin()` → `getTournamentForAdmin` (not found → `NOT_FOUND`; no `group` → `NOT_FOUND`, defense-in-depth for the "shouldn't happen" case) → `listEntriesForTournament(tournamentId)` for the entry-id list and count → `checkTransition(tournament.state, "GROUP_STAGE", { entryCount, teamCount: tournament.teamCount })` (not ok → `{ ok: false, code: check.code, message: check.message }`) → `generateSchedule(entryIds, tournament.rounds)` (Story 3.1) → map the result's `{ homeEntryId, awayEntryId }` pairs (dropping `round`/`tour`) → `saveDraw(tournamentId, tournament.group.id, entryIds, pairings)` → `revalidatePath` (the tournament's public discipline section per `transitionTournament`'s exact precedent, plus `/admin/tournaments/${tournamentId}`) → `{ ok: true, data: undefined }`.
  - [x] `ActionResult<undefined>` shape (the `admin-roles.ts`/`entries.ts` family), not `useActionState` — a single-action button, not a form.
  - [x] `typecheck`/`lint` clean.
- [x] **Task 4 — `src/components/tournament-actions.tsx` (UPDATE): `DrawTournamentButton`** (AC: 1, 2, 3)
  - [x] `DrawTournamentButton({ tournamentId, state, entryCount, teamCount })` — `useTransition` + direct `drawTournament` call, the `team-enrollment.tsx`'s `enroll()` shape (`try`/`catch` around the call, `notify.success` + `router.refresh()` on `{ ok: true }`, `notify.error(res.message)` on `{ ok: false }`, a caught-exception fallback message). No `ConfirmDialog` (see Notes).
  - [x] Disabled + captioned via `checkTransition(state, "GROUP_STAGE", { entryCount, teamCount })` computed in the component (mirrors `team-enrollment.tsx`'s `checkCanEnroll` usage) — the exact same message the Server Action itself would produce if called anyway.
  - [x] `typecheck`/`lint` clean.
- [x] **Task 5 — `src/app/admin/tournaments/[id]/page.tsx` (UPDATE): render the draw button** (AC: 1, 2, 3)
  - [x] New section (below "Команди", above the delete button) rendering `<DrawTournamentButton tournamentId={tournament.id} state={tournament.state} entryCount={entries.length} teamCount={tournament.teamCount} />` — only `entries.length` is new data the page needs to pass down; `entries` itself is already fetched here (Story 2.7).
  - [x] No changes to `tournament-form.tsx`'s or `team-enrollment.tsx`'s own logic — their existing state-based locks already do the right thing once `router.refresh()` picks up `GROUP_STAGE` (see Notes).
  - [x] `typecheck`/`lint` clean.
- [x] **Task 6 — Docs**
  - [x] `src/data/README.md` — `tournaments.ts`'s entry notes `setTournamentState`'s new transaction-client parameter; new `draw.ts` entry.
  - [x] `src/actions/README.md` — new `draw.ts` entry (`drawTournament`).
  - [x] `src/components/README.md` — `DrawTournamentButton` entry (extend the existing `tournament-actions.tsx` section).
  - [x] `AGENTS.md` — Stack-status bullet for Story 3.3.
  - [x] `deferred-work.md`'s Story 2.3-review AD-8-wording item — note that this story is the first "окрема Server Action" per transition AD-8 originally described, without resolving the spine-wording tension itself (still an open item, just partially addressed in practice).
- [x] **Task 7 — `deferred-work.md` (UPDATE)**
  - [x] New "Story 3.3 implementation" section: no automated action-level test for `drawTournament` beyond the verify script (Task 8); the transaction's atomicity is asserted by the verify script but not stress-tested under real concurrency (same accepted-risk class as every other TOCTOU item already tracked); `generateSchedule`'s default `Math.random`-based shuffle means the draw's actual pairing order is non-deterministic in production — expected and desired (FR-11's "випадковий порядок"), noted so a future reader doesn't mistake it for a bug.
- [x] **Task 8 — Verification gate** (AC: all)
  - [x] `pnpm test` unchanged (no new `src/domain` module) · `pnpm typecheck` · `pnpm lint` · `pnpm build` clean (no new route).
  - [x] Import-boundary greps: `src/data/draw.ts` is the only new Prisma-client import site. (Confirmed: grepping `@/generated/prisma|@prisma/client` across `src/` returns only `src/data/**` files plus module READMEs.)
  - [x] `scripts/verify-draw.mts` (NEW, self-cleaning): create a throwaway `DRAFT` tournament with `teamCount = 4`, enter exactly 4 teams → call the same logic `drawTournament` would (via `checkTransition` + `generateSchedule` + `saveDraw`, exercised directly at the `src/data`/`src/domain` level, the same style every prior verify script uses to bypass `requireAdmin()`) → assert: `GroupSlot` has exactly 4 rows, one per entry; `Match` has exactly `C(4,2) × rounds` rows, all `stage: "GROUP"`, `groupId` set, both entries set; `Tournament.state` is now `GROUP_STAGE`; `getStandings(tournamentId)` (Story 3.2) returns all 4 entries with `played: 0` (no `SetScore` yet) → also assert `checkTransition` correctly refuses the draw when entry count ≠ `teamCount` (no DB writes attempted) → full teardown.
  - [x] Re-run all seven prior verify scripts — no regression.
  - [x] Real command output + notes captured in the Dev Agent Record.
- [x] **Task 9 — Commit(s)** — one commit + `git push origin main` per completed task. `build` gated each.

### Review Findings

_Code review (`bmad-code-review`, 4 layers: Blind Hunter, Edge Case Hunter, Verification Gap Reviewer, Acceptance Auditor) over `git diff 02979c09..0c35e4c`. All 4 layers completed. 1 decision-needed, 3 patched, 3 deferred, 10 dismissed._

#### Decision Needed

- [x] [Review][Decision] `entryIds` reach `generateSchedule` in the exact order `listEntriesForTournament` returns them (alphabetical by team name) and are never shuffled — `generateSchedule`'s injectable `shuffle` (Story 3.1) only reorders pairs *within* a tour and each pair's home/away side; `circleMethodTours`'s fixed anchor (`ids[0]`) and rotation mean the actual pairing structure (which team plays whom, in which tour) is a pure, deterministic function of `entryIds`' input order. In production this means the *matchup* pattern for a given set of team names is identical every time — not random at all, only its cosmetic listing order and home/away side are. [`src/actions/draw.ts:34-45`] — **Resolved by user: shuffle `entryIds` before `generateSchedule`.** Fixed by exporting `defaultShuffle` from `src/domain/schedule.ts` and calling it on `entryIds` in `drawTournament` before both `generateSchedule` and `saveDraw`.

#### Patch

- [x] [Review][Patch] "Жеребкування" section rendered unconditionally regardless of `tournament.state`, producing a confusing, self-referential message once already drawn (`checkTransition("GROUP_STAGE", "GROUP_STAGE", ...)` → "Неможливий перехід зі стану «Груповий етап» до «Груповий етап»."), and persisting forever through `PLAYOFF`/`COMPLETED`. [`src/app/admin/tournaments/[id]/page.tsx`] — 3-way convergence (Blind Hunter, Verification Gap Reviewer, Acceptance Auditor citing `EXPERIENCE.md`'s admin-action-bar spec, which scopes this button to the `DRAFT` bar only). **Fixed:** the whole "Жеребкування" section is now gated by `tournament.state === "DRAFT"`, matching `team-enrollment.tsx`'s "Зняти" button precedent.
- [x] [Review][Patch] `drawTournament` never revalidates `/admin/tournaments` — the tournament list page keeps showing "Чернетка" after a successful draw until an unrelated cache expiry. [`src/actions/draw.ts:53-54`] — 2-way convergence (Blind Hunter, Edge Case Hunter). **Fixed:** added `revalidatePath("/admin/tournaments")`.
- [x] [Review][Patch] `saveDraw`'s transaction-atomicity/rollback guarantee (stated in its own doc comment) is asserted but never verified by any test — `scripts/verify-draw.mts` only exercises the happy path. [`scripts/verify-draw.mts`, `src/data/draw.ts`] — Verification Gap Reviewer; fix is test-only (assert a second `saveDraw` call against an already-seated group throws and leaves row counts/state unchanged), no production-code change needed. **Fixed:** extended `verify-draw.mts` with 4 new assertions proving a second `saveDraw` call throws and leaves `GroupSlot`/`Match` row counts and `Tournament.state` unchanged.

#### Defer

- [x] [Review][Defer] No atomic guard against two truly concurrent `drawTournament` calls (TOCTOU between `checkTransition`'s read and `saveDraw`'s write) [`src/actions/draw.ts`, `src/data/draw.ts`] — deferred, pre-existing risk class. Traced the transaction manually: a genuine race hits `GroupSlot`'s `@@unique([groupId, entryId])` inside `saveDraw`'s transaction, which rolls back cleanly (no data corruption) but surfaces to the losing caller as an unhandled exception / generic "Спробуйте ще раз" toast instead of a precise "вже проведено" message. Same accepted-risk class as `enrollTeam`/`transitionTournament`/`updateTournament`'s already-deferred TOCTOU gaps at this project's 2–5-admin scale.
- [x] [Review][Defer] `drawTournament` does not map Prisma errors (the race above, or a `P2025` if the tournament is deleted mid-request) to a friendly `ActionResult` before `toActionError` re-throws them [`src/actions/draw.ts`] — deferred, pre-existing pattern identical to `setTournamentState`'s already-tracked `P2025` gap (deferred since the 2.3/2.7 reviews); `admin-roles.ts` has the same shape.
- [x] [Review][Defer] Transaction timeout risk at the extreme of allowed input (`teamCount = 64`, `rounds = 10` → up to 20,160 `Match` rows in one `$transaction`) [`src/data/draw.ts`] — deferred, low probability at this project's real usage scale; a one-line `{ timeout }` option fixes it if ever hit.



### What this story is / is NOT

**Is:** the Server Action + data-layer wiring that turns a fully-entered `DRAFT` tournament into a `GROUP_STAGE` one with a real group roster (`GroupSlot`) and match calendar (`Match`), plus the admin button that triggers it. The first real caller of `generateSchedule` (Story 3.1) and the first real writer of `GroupSlot`/`Match` (Story 3.2).

**Is NOT** (do not pull forward):
- **Redraw** — Story 3.4, a separate action that replaces `Match` rows (not `GroupSlot`) while no `SetScore` exists yet.
- **Match scheduling** (`scheduledAt`/`venueText` writes) — Story 3.5.
- **Any public "Розклад"/"Таблиця" tab** — Story 3.5/3.8. This story's matches exist in the DB and are already reachable by `getStandings`, but nothing renders them publicly yet.
- **Changes to `tournament-form.tsx`/`team-enrollment.tsx`'s own logic** — their existing state-gates already do the right thing; this story only adds a new section alongside them.
- **A generic "run any transition" UI** — `transitionTournament` stays unused by any UI until whichever future story (Epic 3/4) needs a non-draw transition button.

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/data/tournaments.ts` | UPDATE | `setTournamentState` gains an optional tx-client param; `getTournamentForAdmin` gains `group.id`. |
| `src/data/draw.ts` | NEW | `saveDraw` — the one-transaction write. |
| `src/actions/draw.ts` | NEW | `drawTournament`. |
| `src/components/tournament-actions.tsx` | UPDATE | `DrawTournamentButton` added alongside `DeleteTournamentButton`. |
| `src/app/admin/tournaments/[id]/page.tsx` | UPDATE | Renders the new button; passes `entries.length` down. |
| `scripts/verify-draw.mts` | NEW | Self-cleaning DB round-trip. |
| `src/data/README.md` · `src/actions/README.md` · `src/components/README.md` · `AGENTS.md` · `deferred-work.md` | UPDATE | Module entries, Stack status, new deferred section. |
| `src/domain/**` | DO NOT TOUCH | `generateSchedule`/`checkTransition` consumed as-is. |
| `prisma/schema.prisma` | DO NOT TOUCH | Story 3.2's schema already has everything this story needs. |

### Architecture compliance

- **AD-6 — every mutation is a Server Action under `requireAdmin()`.** `drawTournament` calls it first. [ARCHITECTURE-SPINE.md#AD-6]
- **AD-8 — `Tournament.state` changes only via a validated transition; `setTournamentState` is the sole writer.** `drawTournament` validates via `checkTransition` (the same domain gate `transitionTournament` uses) before `saveDraw` calls `setTournamentState` inside the transaction — no other function ever assigns `state`. [ARCHITECTURE-SPINE.md#AD-8]
- **AD-11 — `src/data` is the sole Prisma owner.** `draw.ts` is the only new Prisma-client import site. [ARCHITECTURE-SPINE.md#AD-11]
- **AD-3 — dependency direction.** `view → shell` (`DrawTournamentButton` → `drawTournament`), `shell → domain` (`drawTournament` → `checkTransition`/`generateSchedule`), `shell → data` (→ `saveDraw`/`getTournamentForAdmin`/`listEntriesForTournament`), `view → domain` (`DrawTournamentButton` → `checkTransition`, the `team-enrollment.tsx`-established edge). [ARCHITECTURE-SPINE.md#AD-3]
- **Consistency Conventions** — verb-named action (`drawTournament`); `revalidatePath` after the write; UA-only copy. [ARCHITECTURE-SPINE.md#Consistency Conventions]

### Existing code being modified — current state → change → what must be preserved

**`src/data/tournaments.ts`** (Story 2.3/2.4/2.5, unchanged since)
- *Current:* `setTournamentState(id, state)` — a bare `db.tournament.update`. `getTournamentForAdmin(id)` — a bare `db.tournament.findUnique`, no relations included.
- *Change:* `setTournamentState` gains a third, defaulted parameter for transaction participation. `getTournamentForAdmin` adds `group: { select: { id: true } }` to its select.
- *Must preserve:* `transitionTournament`'s existing call to `setTournamentState(tournamentId, targetState)` — the two-argument call must keep working unchanged (default parameter, not a breaking signature change).

**`src/actions/tournaments.ts`** (Story 2.3, `transitionTournament` — never called from any UI until now)
- *Current:* `transitionTournament(tournamentId, targetState)` handles all four transitions generically.
- *Change:* none. `drawTournament` (new file) does not call it and does not modify it.
- *Must preserve:* verbatim — this story adds a sibling action, not a change to this one.

**`src/components/tournament-actions.tsx`** (Story 2.5, `DeleteTournamentButton`)
- *Current:* one export, `DeleteTournamentButton`, a `ConfirmDialog`-wrapped destructive action.
- *Change:* add a second export, `DrawTournamentButton` — a different shape (no `ConfirmDialog`, disabled+captioned state), not a variant of the existing component.
- *Must preserve:* `DeleteTournamentButton` verbatim.

**`src/app/admin/tournaments/[id]/page.tsx`** (Story 2.5/2.7, tournament form + "Команди" section + delete button)
- *Current:* fetches `tournament`, `teams`, `entries` in parallel; renders the edit form, the "Команди" section, then the delete button.
- *Change:* add a new section between "Команди" and the delete button, rendering `DrawTournamentButton` with `entries.length` passed down (no new data fetch — `entries` is already loaded here).
- *Must preserve:* the existing three sections and their exact data flow, verbatim.

### Testing requirements

- **No new `src/domain` module** — this story reuses Story 3.1's `generateSchedule`/Story 2.3's `checkTransition` unchanged. `pnpm test`'s count stays at 103.
- **`scripts/verify-draw.mts`** is the real correctness check — the first script to exercise the full draw pipeline (`GroupSlot` seeding, `Match` creation, `state` write, all atomic) and to feed real output into `getStandings` (Story 3.2) for the first time from data this story itself wrote.
- **Regression:** `verify-tournament-edit-delete.mts` re-run (touches `getTournamentForAdmin`); all seven prior verify scripts re-run unchanged; route table unaffected (no new route).

### Previous story intelligence

**Story 3.2 (done, code-reviewed):** `getStandings`'s hard-won lesson — a `Match` with zero `SetScore` rows must not be scored as a decided result — is directly relevant here: every `Match` this story creates has zero `SetScore` rows at creation time (results arrive in Story 3.6/3.7), so `getStandings` called right after a draw must show every entry at `played: 0`. The verify script's own assertion on this point is this story's most important regression check against that exact class of bug recurring.

**Story 3.1 (done, code-reviewed):** `generateSchedule`'s own code-review fix (home/away bias) means the pairing order this story persists is genuinely balanced — no extra work needed here, just correct consumption of its output.

**Story 2.7 (done, code-reviewed):** `checkCanEnroll`/`checkCanRemoveEntry`'s pattern (a pure domain precondition function, called from both the Server Action and the client component for the disabled+captioned button) is the exact template `checkTransition`'s reuse here follows — already established, not a new pattern.

### Git intelligence

Recent: `d91463b` (3.2 done, all 4 review layers) ← `1a79c3f` (3.2 unplayed-match fix) ← `f3837b8` (3.2 fix pass) ← `53dbd76` (3.2 findings). `src/data/` has no `draw.ts`. `src/actions/` has no `draw.ts`. `src/components/tournament-actions.tsx` has only `DeleteTournamentButton`. `transitionTournament` (`src/actions/tournaments.ts`) exists since Story 2.3 but has never been called from any UI — this story's `drawTournament` is a sibling, not its first caller.

### Latest tech information

- No new library. Prisma 7's interactive `$transaction(async (tx) => ...)` — same driver-adapter setup (`@prisma/adapter-pg`) already in use; the transaction-client type is exported from the generated client module (`@/generated/prisma/client`) alongside `PrismaClient` itself — confirm the exact type name there when implementing `setTournamentState`'s new parameter.

### Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 3.3 AC, FR-11), `ARCHITECTURE-SPINE.md` (AD-3, AD-6, AD-8, AD-11), `EXPERIENCE.md` (the admin action bar's "Чернетка → «Заявити команду», «Провести жеребкування»" line, the closed list of `ConfirmDialog`-requiring actions), `2-3-tournament-state-machine.md` (`checkTransition`'s existing `DRAFT → GROUP_STAGE` precondition, `transitionTournament`'s shape), `2-7-enroll-remove-team.md` (the domain-precondition-reused-in-both-layers pattern), `3-1-...md` / `3-2-...md` (the exact engine/schema this story wires together for the first time).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3: Жеребкування] — user story + AC; FR-11
- [Source: …/ARCHITECTURE-SPINE.md#AD-3, #AD-6, #AD-8, #AD-11] — dependency direction; Server Action + requireAdmin; sole state writer; sole Prisma owner
- [Source: …/EXPERIENCE.md#Component Patterns "Admin action bar"] — "Чернетка → «Заявити команду», «Провести жеребкування»"
- [Source: …/EXPERIENCE.md#Interaction Primitives "Підтвердження"] — the closed list of actions requiring `ConfirmDialog` (draw isn't one)
- [Source: _bmad-output/implementation-artifacts/2-3-tournament-state-machine.md] — `checkTransition`, `transitionTournament`'s existing shape
- [Source: _bmad-output/implementation-artifacts/3-1-domain-engine-scoring-tiebreak-schedule-validation.md, 3-2-group-stage-schema.md] — `generateSchedule`, `Match`/`GroupSlot`, `getStandings`'s unplayed-match lesson

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (bmad-dev-story)

### Debug Log References

### Completion Notes List

- Task 1: `setTournamentState` now accepts an optional `Prisma.TransactionClient | typeof db` third parameter (defaults to `db`); `getTournamentForAdmin` now includes `group: { select: { id: true } }`. `typecheck`/`lint` clean; `verify-tournament-edit-delete.mts` re-run with no regression.
- Task 2: `src/data/draw.ts` created with `saveDraw` — one `db.$transaction` seating `GroupSlot` rows, creating `GROUP`-stage `Match` rows, and calling `setTournamentState(..., tx)`. `typecheck`/`lint` clean.
- Task 3: `src/actions/draw.ts` created with `drawTournament` — reuses `checkTransition` directly (not `transitionTournament`), calls `generateSchedule` then `saveDraw`. `typecheck`/`lint` clean.
- Task 4: `DrawTournamentButton` added to `src/components/tournament-actions.tsx` — `useTransition` + `checkTransition` for disabled+captioned state, `team-enrollment.tsx`'s `enroll()` shape, no `ConfirmDialog`. `typecheck`/`lint` clean.
- Task 5: `/admin/tournaments/[id]` renders a new "Жеребкування" section with `DrawTournamentButton`, passing `entries.length` (already-fetched `entries`). `typecheck`/`lint` clean.
- Tasks 6-7: updated `src/data/README.md`, `src/actions/README.md`, `src/components/README.md`, `AGENTS.md` (Stack-status bullet), and `deferred-work.md` (new Story 3.3 section + annotated the existing AD-8-wording item).
- Task 8: `pnpm test` 103/103 unchanged, `pnpm typecheck`/`pnpm lint` clean, `pnpm build` clean (no new route — `/admin/tournaments/[id]` is existing). Import-boundary grep confirms `src/data/**` is the only place importing the Prisma client. New `scripts/verify-draw.mts` — all 14 assertions pass (precondition refusal, `GroupSlot`/`Match` row counts and shape, `Tournament.state` transition, post-draw `getStandings` all-zero-played, full teardown). Re-ran all 7 prior verify scripts (`verify-admin-roles`, `verify-tournament-create`, `verify-tournament-edit-delete`, `verify-team-create`, `verify-team-enrollment`, `verify-roster`, `verify-public-tournament`, `verify-group-stage-schema`) — no regression.
- Review fix pass: exported `defaultShuffle` from `src/domain/schedule.ts`; `drawTournament` now shuffles `entryIds` before `generateSchedule`/`saveDraw` (closes the decision-needed matchup-determinism finding); `/admin/tournaments/[id]` gates the "Жеребкування" section behind `state === "DRAFT"`; `drawTournament` adds `revalidatePath("/admin/tournaments")`; `verify-draw.mts` extended with 4 assertions proving `saveDraw`'s transaction rolls back cleanly on a second, conflicting call. `pnpm test` 103/103, `typecheck`/`lint`/`build` clean, all 8 verify scripts (including the extended `verify-draw.mts`, now 18 assertions) pass with no regression.

### File List

- `src/data/tournaments.ts` (UPDATE)
- `src/data/draw.ts` (NEW)
- `src/actions/draw.ts` (NEW)
- `src/components/tournament-actions.tsx` (UPDATE)
- `src/app/admin/tournaments/[id]/page.tsx` (UPDATE)
- `src/data/README.md` (UPDATE)
- `src/actions/README.md` (UPDATE)
- `src/components/README.md` (UPDATE)
- `AGENTS.md` (UPDATE)
- `_bmad-output/implementation-artifacts/deferred-work.md` (UPDATE)
- `scripts/verify-draw.mts` (NEW, extended in review-fix pass)
- `src/domain/schedule.ts` (UPDATE — exported `defaultShuffle`)

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-05 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
| 2026-09-05 | Implementation complete (`bmad-dev-story`) — all 9 tasks done, `pnpm test`/`typecheck`/`lint`/`build` clean, all 8 verify scripts (7 prior + new `verify-draw.mts`) pass. Status: review. |
| 2026-09-05 | Code review (`bmad-code-review`, 4 layers) — 1 decision-needed (entryIds unshuffled) resolved by user and patched, 3 patches applied (DRAFT-only gating, `/admin/tournaments` revalidation, transaction-rollback test), 3 deferred, 10 dismissed. All checks green post-fix. |
