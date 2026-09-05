---
baseline_commit: 7acfa77
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/implementation-artifacts/2-7-enroll-remove-team.md
  - _bmad-output/implementation-artifacts/3-1-domain-engine-scoring-tiebreak-schedule-validation.md
  - _bmad-output/implementation-artifacts/3-2-group-stage-schema.md
  - _bmad-output/implementation-artifacts/3-3-draw.md
  - AGENTS.md
---

# Story 3.4: Redraw

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an адмін,
I want перезапустити жеребкування, поки не внесено результатів,
so that я можу виправити випадковий розклад (FR-12).

## Acceptance Criteria

Translated from `epics.md` → Epic 3 → Story 3.4. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** a tournament in state `GROUP_STAGE`, with no `SetScore` yet
**When** I press "Пережеребкувати" and confirm
**Then**

1. The previous calendar (every generated `Match`) is deleted; a new one is created.
2. After the first result is entered, the redraw button disappears/is blocked.

PRD FR-12 (`prd.md` §4.4, cited in the story's context) adds two checkable consequences that narrow the AC's wording precisely: "Пережеребкування видаляє попередній календар (усі згенеровані Матчі) і створює новий" and "Після внесення першого Результату матчу пережеребкування заблоковане" — i.e. PRD resolves the AC's "зникає/блокується" ("disappears/is blocked") ambiguity in favor of **blocked** (disabled, not hidden).

### Notes on AC interpretation

- **This is Story 3.3's exact pipeline, run a second time, minus the seating step.** Everything Story 3.3 built — `generateSchedule`, `defaultShuffle` (now exported after 3.3's own code-review fix), the `Match` schema — gets reused verbatim. The only genuinely new pieces are: the precondition (`GROUP_STAGE` + zero results, not `DRAFT` + entry count), and that team membership (`GroupSlot`) does **not** change — only the `Match` calendar is deleted and regenerated. Re-seating `GroupSlot` would be wrong: the teams already in the group stay exactly the same; only which pairs face each other and when is being re-rolled.
- **A new pure precondition module, `src/domain/redraw.ts`, exports `checkCanRedraw(state, hasResults)`** — the exact same shape and reuse pattern as Story 2.7's `checkCanEnroll`/`checkCanRemoveEntry` (`src/domain/teamEnrollment.ts`): one function, called from both the Server Action and the client button for a consistent disabled+captioned message. This is **not** `checkTransition` — nothing about `Tournament.state` changes during a redraw (it stays `GROUP_STAGE` before and after), so the transition-gate module doesn't apply here; this is a same-state, repeatable-until-a-condition-flips precondition, structurally closer to `checkCanEnroll` than to a lifecycle edge.
- **The confirmation dialog is required here, unlike Story 3.3's draw button.** Story 3.3 deliberately skipped `ConfirmDialog` because `EXPERIENCE.md`'s closed list of actions requiring one (delete result, delete tournament, revoke role, finish tournament) doesn't name the draw, and the draw's own AC never mentioned confirming. **This story's AC is different**: its own `epics.md` "When" clause literally reads "тисну «Пережеребкувати» **й підтверджую**" — confirmation is part of the acceptance criterion itself, not just a UX-flow-narrative aside. `EXPERIENCE.md`'s admin-action-bar summary (line ~94-96: "Груповий етап → (жодної глобальної, лише введення результатів) + «Сформувати плейоф»...") and its closed confirmation list also don't mention redraw at all — both read as an incomplete high-level summary that predates or omits this narrower, time-limited action, not as evidence against confirming. **Decision: `RedrawTournamentButton` gets a `ConfirmDialog`** (`destructive` variant — it deletes real data), following `DeleteTournamentButton`'s exact wiring pattern, because the AC's own text is the most specific and most binding source here.
- **Data flow for the redraw itself**: entry ids come from `GroupSlot` (who's actually seated in the group), **not** `TournamentEntry`/`listEntriesForTournament` (which Story 3.3's draw used, before any `GroupSlot` existed). A new `listGroupEntryIds(groupId)` query in `src/data/draw.ts` reads them. Re-using `listEntriesForTournament` here would be a subtle correctness bug if it and `GroupSlot` ever diverge (they shouldn't in v1, since nothing removes entries after `DRAFT` — `checkCanRemoveEntry` already gates removal to `DRAFT`-only, Story 2.7 — but `GroupSlot` is the schema's own documented source of truth for "who's in this group," so reading it directly is both correct and self-documenting).
- **`saveRedraw` is a new, separate function from `saveDraw`** (`src/data/draw.ts`), not a parameterized variant of it: `saveDraw` creates `GroupSlot` rows and transitions `Tournament.state`; `saveRedraw` does neither — it only deletes and recreates `GROUP`-stage `Match` rows for a tournament, in one transaction. Sharing one function with conditional seeding logic would make both harder to read for no real code reuse (the only line they'd actually share is the final `match.createMany` call).
- **The "no results yet" check needs a new data read**: `hasAnyGroupResult(tournamentId)` in `src/data/matches.ts` (the file that already owns every `Match`/`SetScore` read — `getStandings` lives there). Returns whether any `SetScore` row exists for any `GROUP`-stage `Match` of the tournament — the precise negation of AC 2's "no result yet" gate.
- **The redraw section renders whenever `tournament.state === "GROUP_STAGE"`** (mirroring Story 3.3's review-fixed pattern of gating the whole section by state, not just disabling the inner button) — but stays visible and disabled+captioned once a result exists, per PRD's "заблоковане" (blocked), not "зникає" (disappears). The message: reuse `checkCanRedraw`'s own returned string, computed client-side exactly like `checkCanEnroll`/`checkTransition` already are in `TeamEnrollment`/`DrawTournamentButton`.
- **No changes to `Match.scheduledAt`/`venueText` handling.** Story 3.5 (match scheduling) hasn't landed yet, so no production data can exist in those columns at this point — but for correctness and future-proofing once it does, `saveRedraw`'s `match.deleteMany` intentionally deletes the **entire** old `Match` row set (including any `scheduledAt`/`venueText` a future Story 3.5 might have set), matching PRD's literal "видаляє попередній календар" (deletes the previous calendar) — a redraw is a full calendar reset, not a pairing-only patch.
- **No atomic guard against two concurrent redraw calls.** Same accepted risk class Story 3.3's code review deferred for `drawTournament` (TOCTOU between the precondition read and the write) — lower stakes here even than there, since a redraw requires an explicit `ConfirmDialog` click by a trusted admin and only matters in the narrow pre-first-result window. Not addressed by this story; consistent with the project's established tolerance at 2-5-admin scale.

## Tasks / Subtasks

- [ ] **Task 1 — `src/domain/redraw.ts` (NEW): `checkCanRedraw`** (AC: 1, 2)
  - [ ] `export type RedrawCheck = { ok: true } | { ok: false; message: string }` (same shape as `teamEnrollment.ts`'s `EnrollmentCheck`).
  - [ ] `checkCanRedraw(state: TournamentState, hasResults: boolean): RedrawCheck` — `state !== "GROUP_STAGE"` → `{ ok: false, message: "Пережеребкування можливе лише у стані «Груповий етап»." }`; `hasResults` → `{ ok: false, message: "Пережеребкування недоступне: уже внесено результат матчу." }`; else `{ ok: true }`.
  - [ ] Vitest: both false branches, the true branch, and that the state check is evaluated before the results check (matches `checkCanEnroll`'s ordering precedent — state gate first).
  - [ ] `pnpm test` green; `typecheck`/`lint` clean.
- [ ] **Task 2 — `src/data/matches.ts` (UPDATE): `hasAnyGroupResult`** (AC: 1, 2)
  - [ ] `hasAnyGroupResult(tournamentId: string): Promise<boolean>` — `db.setScore.findFirst({ where: { match: { tournamentId, stage: "GROUP" } }, select: { id: true } })` mapped to `!== null`. Doc comment: the sole read backing `checkCanRedraw`'s "no results yet" gate.
  - [ ] `typecheck`/`lint` clean.
- [ ] **Task 3 — `src/data/draw.ts` (UPDATE): `listGroupEntryIds` + `saveRedraw`** (AC: 1)
  - [ ] `listGroupEntryIds(groupId: string): Promise<string[]>` — `db.groupSlot.findMany({ where: { groupId }, select: { entryId: true } })`, mapped to the id array.
  - [ ] `saveRedraw(tournamentId: string, groupId: string, pairings: DrawPairing[]): Promise<void>` — one `db.$transaction`: `tx.match.deleteMany({ where: { tournamentId, stage: "GROUP" } })` (cascades away any `SetScore`, though the precondition guarantees none exist) → `tx.match.createMany({ data: pairings.map((p) => ({ tournamentId, groupId, stage: "GROUP", ...p })) })`. Doc comment: performs no validation itself, same convention as `saveDraw`; never seats/unseats `GroupSlot`; the caller (`redrawTournament`) must already have confirmed `checkCanRedraw`.
  - [ ] `typecheck`/`lint` clean.
- [ ] **Task 4 — `src/actions/draw.ts` (UPDATE): `redrawTournament`** (AC: 1, 2)
  - [ ] `redrawTournament(tournamentId): Promise<ActionResult<undefined>>` — `requireAdmin()` → `getTournamentForAdmin` (not found, or no `group` → `NOT_FOUND`) → `hasAnyGroupResult(tournamentId)` → `checkCanRedraw(tournament.state, hasResults)` (not ok → `{ ok: false, code: "PRECONDITION_FAILED", message: check.message }`) → `listGroupEntryIds(tournament.group.id)` → `defaultShuffle` (`src/domain/schedule`) → `generateSchedule(shuffled, tournament.rounds)` → map to pairings (drop `round`/`tour`, same as `drawTournament`) → `saveRedraw(tournamentId, tournament.group.id, pairings)` → `revalidatePath` (discipline route, `/admin/tournaments/${tournamentId}`; **not** `/admin/tournaments` — `state` doesn't change, so the list page's displayed state is already correct) → `{ ok: true, data: undefined }`.
  - [ ] Add `"PRECONDITION_FAILED"` reuse (already an `ActionErrorCode` — no new code needed).
  - [ ] `typecheck`/`lint` clean.
- [ ] **Task 5 — `src/components/tournament-actions.tsx` (UPDATE): `RedrawTournamentButton`** (AC: 1, 2)
  - [ ] `RedrawTournamentButton({ tournamentId, state, hasResults })` — `ConfirmDialog` wrapping a call to `redrawTournament`, `DeleteTournamentButton`'s exact shape (`onConfirm` returns `false`/throws on failure so the dialog stays open, per `ConfirmDialog`'s own contract; success toasts and calls `router.refresh()` instead of `router.push` — this story stays on the same page, unlike delete's navigate-away). `title="Пережеребкувати?"`, `description` matching `EXPERIENCE.md`'s destructive-confirmation voice (a direct-speech sentence naming the consequence, e.g. "Поточний календар матчів буде видалено і згенеровано новий."), `confirmLabel="Пережеребкувати"`, `destructive`.
  - [ ] Disabled + captioned via `checkCanRedraw(state, hasResults)` (`src/domain/redraw`) computed in the component — the same `view → domain` edge already established by `checkCanEnroll`/`checkTransition`.
  - [ ] `typecheck`/`lint` clean.
- [ ] **Task 6 — `src/app/admin/tournaments/[id]/page.tsx` (UPDATE): render the redraw button** (AC: 1, 2)
  - [ ] Fetch `hasResults` via `hasAnyGroupResult(tournament.id)` alongside the existing `Promise.all` reads.
  - [ ] New section, gated `tournament.state === "GROUP_STAGE"` (mirrors the existing `DRAFT`-gated draw section — mutually exclusive, both under a "Жеребкування" heading), rendering `<RedrawTournamentButton tournamentId={tournament.id} state={tournament.state} hasResults={hasResults} />`.
  - [ ] `typecheck`/`lint` clean.
- [ ] **Task 7 — Docs**
  - [ ] `src/domain/README.md` — new `redraw.ts` entry.
  - [ ] `src/data/README.md` — `matches.ts`'s entry gains `hasAnyGroupResult`; `draw.ts`'s entry gains `listGroupEntryIds`/`saveRedraw`.
  - [ ] `src/actions/README.md` — `draw.ts`'s entry gains `redrawTournament`.
  - [ ] `src/components/README.md` — `RedrawTournamentButton` entry (extend the `tournament-actions.tsx` section).
  - [ ] `AGENTS.md` — Stack-status bullet for Story 3.4.
- [ ] **Task 8 — `deferred-work.md` (UPDATE)**
  - [ ] New "Story 3.4 implementation" section: no automated action-level test for `redrawTournament` beyond the verify script; no atomic guard against two concurrent redraws (same accepted-risk class as `drawTournament`'s already-deferred TOCTOU item — lower stakes here given the explicit `ConfirmDialog`).
- [ ] **Task 9 — Verification gate** (AC: all)
  - [ ] `pnpm test` (new `redraw.test.ts` cases included) · `pnpm typecheck` · `pnpm lint` · `pnpm build` clean (no new route).
  - [ ] Import-boundary grep: no new Prisma-client import site outside `src/data/**`.
  - [ ] `scripts/verify-redraw.mts` (NEW, self-cleaning): create a throwaway `DRAFT` tournament with `teamCount = 4`, enter 4 teams, draw it (via the same direct `checkTransition`/`generateSchedule`/`saveDraw` sequence `verify-draw.mts` uses) → assert `checkCanRedraw("GROUP_STAGE", false).ok` → capture the original `Match` ids → run the redraw pipeline (`listGroupEntryIds` → shuffle → `generateSchedule` → `saveRedraw`) → assert: the original `Match` ids are all gone; a fresh set of `Match` rows exists with the same count (`C(4,2) × rounds`), all `stage: "GROUP"`, `groupId` set, both entries set; `GroupSlot` rows are **unchanged** (same 4 rows, same entry ids — redraw never touches seating); `Tournament.state` is still `GROUP_STAGE` → create one `SetScore` on one of the new matches → assert `hasAnyGroupResult(tournamentId)` is now `true` and `checkCanRedraw("GROUP_STAGE", true).ok` is `false` → full teardown.
  - [ ] Re-run all 8 prior verify scripts — no regression.
  - [ ] Real command output + notes captured in the Dev Agent Record.
- [ ] **Task 10 — Commit(s)** — one commit + `git push origin main` per completed task. `build` gated each.

## Dev Notes

### What this story is / is NOT

**Is:** re-running Story 3.3's schedule-generation step for an already-drawn `GROUP_STAGE` tournament, deleting and replacing its `Match` calendar, gated on "no result yet," with a confirmed, destructive admin action.

**Is NOT** (do not pull forward):
- **Re-seating `GroupSlot`.** Team membership in the group never changes here — only which pairs play each other and in what tour.
- **Any change to `Tournament.state`.** It's `GROUP_STAGE` before and after; no `checkTransition` call, no `setTournamentState` call.
- **Match scheduling (`scheduledAt`/`venueText`)** — still Story 3.5, untouched here (and structurally can't have any data yet, since 3.5 hasn't shipped).
- **A public "history of redraws" or audit log** — not in any AC/PRD text for this story.

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/domain/redraw.ts` | NEW | `checkCanRedraw`. |
| `src/data/matches.ts` | UPDATE | `hasAnyGroupResult` added alongside `getStandings`. |
| `src/data/draw.ts` | UPDATE | `listGroupEntryIds` + `saveRedraw` added alongside `saveDraw`. |
| `src/actions/draw.ts` | UPDATE | `redrawTournament` added alongside `drawTournament`. |
| `src/components/tournament-actions.tsx` | UPDATE | `RedrawTournamentButton` added alongside `DrawTournamentButton`/`DeleteTournamentButton`. |
| `src/app/admin/tournaments/[id]/page.tsx` | UPDATE | Renders the new button; fetches `hasResults`. |
| `scripts/verify-redraw.mts` | NEW | Self-cleaning DB round-trip. |
| `src/domain/README.md` · `src/data/README.md` · `src/actions/README.md` · `src/components/README.md` · `AGENTS.md` · `deferred-work.md` | UPDATE | Module entries, Stack status, new deferred section. |
| `prisma/schema.prisma` | DO NOT TOUCH | No schema change — `Match`/`SetScore`/`GroupSlot` already fully support this. |

### Architecture compliance

- **AD-6 — every mutation is a Server Action under `requireAdmin()`.** `redrawTournament` calls it first. [ARCHITECTURE-SPINE.md#AD-6]
- **AD-11 — `src/data` is the sole Prisma owner.** No new import site — `matches.ts`/`draw.ts` already import the client. [ARCHITECTURE-SPINE.md#AD-11]
- **AD-3 — dependency direction.** `view → shell` (`RedrawTournamentButton` → `redrawTournament`), `shell → domain` (`redrawTournament` → `checkCanRedraw`/`generateSchedule`/`defaultShuffle`), `shell → data` (→ `saveRedraw`/`listGroupEntryIds`/`hasAnyGroupResult`/`getTournamentForAdmin`), `view → domain` (`RedrawTournamentButton` → `checkCanRedraw`, the established edge). [ARCHITECTURE-SPINE.md#AD-3]
- **AD-4 — standings never stored.** Untouched by this story; `saveRedraw` only ever writes `Match` rows with zero `SetScore` children (deleted and recreated fresh), so `getStandings`'s "unplayed match" handling (Story 3.2's review fix) already covers a freshly-redrawn tournament correctly with no further change needed.
- **Consistency Conventions** — verb-named action (`redrawTournament`); `revalidatePath` after the write; UA-only copy; `ConfirmDialog` for a destructive/irreversible action. [ARCHITECTURE-SPINE.md#Consistency Conventions]

### Existing code being modified — current state → change → what must be preserved

**`src/data/matches.ts`** (Story 3.2, `getStandings` only)
- *Current:* one export, `getStandings(tournamentId)`.
- *Change:* add `hasAnyGroupResult(tournamentId)` as a second export.
- *Must preserve:* `getStandings` verbatim, including its `sets.length > 0` filter (the Story 3.2 review's critical fix) — do not touch it.

**`src/data/draw.ts`** (Story 3.3, `saveDraw` only)
- *Current:* one export, `saveDraw(tournamentId, groupId, entryIds, pairings)`, plus the `DrawPairing` interface.
- *Change:* add `listGroupEntryIds(groupId)` and `saveRedraw(tournamentId, groupId, pairings)` as new exports; reuse the existing `DrawPairing` type for `saveRedraw`'s `pairings` parameter (do not redeclare it).
- *Must preserve:* `saveDraw` verbatim — `saveRedraw` is a sibling, not a refactor of it.

**`src/actions/draw.ts`** (Story 3.3, `drawTournament` only)
- *Current:* one export, `drawTournament(tournamentId)`.
- *Change:* add `redrawTournament(tournamentId)` as a second export in the same file (same feature domain — both are "the draw").
- *Must preserve:* `drawTournament` verbatim, including its post-3.3-review `defaultShuffle` call — import `defaultShuffle` once, use it in both functions.

**`src/components/tournament-actions.tsx`** (Story 2.5/3.3, `DeleteTournamentButton` + `DrawTournamentButton`)
- *Current:* two exports.
- *Change:* add `RedrawTournamentButton` as a third export — `DeleteTournamentButton`'s `ConfirmDialog` shape, not `DrawTournamentButton`'s no-dialog shape (see Notes on AC interpretation for why the two buttons differ here).
- *Must preserve:* both existing exports verbatim.

**`src/app/admin/tournaments/[id]/page.tsx`** (Story 2.5/2.7/3.3)
- *Current:* fetches `tournament`, `teams`, `entries` in parallel; renders edit form, "Команди" section, `DRAFT`-gated "Жеребкування"/draw section, delete button.
- *Change:* add `hasAnyGroupResult(tournament.id)` to the parallel fetch; add a `GROUP_STAGE`-gated redraw section (sibling to the existing `DRAFT`-gated draw section — the two are mutually exclusive by construction, since a tournament is never both states at once).
- *Must preserve:* the existing four sections and their exact data flow, verbatim.

### Testing requirements

- **New `src/domain/redraw.test.ts`** — the only new Vitest surface this story needs (mirrors `teamEnrollment.test.ts`'s structure/coverage level). `pnpm test`'s count grows from 103.
- **`scripts/verify-redraw.mts`** is the real correctness check — first script to exercise a *second* draw-pipeline run against already-seated `GroupSlot` data, and the first to prove old `Match` rows are actually gone (not just that new ones exist).
- **Regression:** all 8 prior verify scripts re-run unchanged (`verify-admin-roles`, `verify-tournament-create`, `verify-tournament-edit-delete`, `verify-team-create`, `verify-team-enrollment`, `verify-roster`, `verify-public-tournament`, `verify-group-stage-schema`, `verify-draw`); route table unaffected (no new route).

### Previous story intelligence

**Story 3.3 (done, code-reviewed):** three lessons directly apply here:
1. **The entry-id shuffle bug.** Story 3.3's own code review found that passing entries to `generateSchedule` in an unshuffled (alphabetical) order makes the matchup structure fully deterministic, not random — fixed by exporting `defaultShuffle` from `schedule.ts` and shuffling before calling `generateSchedule`. This story's redraw **must** apply the same shuffle to `listGroupEntryIds`'s result — the whole point of a redraw is a genuinely different random schedule; skipping the shuffle here would silently reproduce the exact same "not actually random" bug in a brand-new function.
2. **The state-gated section pattern.** Story 3.3's code review also found that rendering an action's section unconditionally (regardless of tournament state) produces a permanently-visible, confusing UI once the state moves on. This story's redraw section must be gated by `state === "GROUP_STAGE"` from the start — not left to a follow-up review to catch.
3. **The transaction-rollback test gap.** Story 3.3's review flagged that `saveDraw`'s atomicity was asserted by a doc comment but never proven by a forced-failure test; `verify-draw.mts` was extended to prove it. This story's `verify-redraw.mts` doesn't need an equivalent forced-failure assertion (there's no unique-constraint collision risk analogous to `GroupSlot`'s `@@unique` here — `saveRedraw` never inserts against a uniqueness constraint tied to prior data), but should still assert the delete-then-create both happened correctly (old ids gone, new ids present, right count) as its core correctness check.

**Story 2.7 (done, code-reviewed):** `checkCanEnroll`/`checkCanRemoveEntry`'s pattern (pure precondition, dual-purpose in action + view) is the direct template `checkCanRedraw` follows.

### Git intelligence

Recent: `7acfa77` (3.3 review-fix pass, done) ← `11e9fa7` (3.3 findings written) ← `0c35e4c` (3.3 review, verify-draw.mts added) ← `9e46bb7`/`da51c17`/`61fdc22`/`5d2aab8`/`bbfb61f`/`87252bd` (3.3 Tasks 1-6). `src/data/draw.ts` currently exports only `saveDraw` + `DrawPairing`. `src/actions/draw.ts` currently exports only `drawTournament`. `src/domain/schedule.ts`'s `defaultShuffle` is exported (as of 3.3's review fix) and ready to reuse directly — no further schedule.ts change needed.

### Latest tech information

No new library. Same Prisma 7 `db.$transaction(async (tx) => ...)` pattern `saveDraw` already established.

### Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 3.4 AC, FR-12), `prd.md` §4.4 (FR-12's precise "blocked not disappeared" + "deletes then recreates" wording), `ARCHITECTURE-SPINE.md` (AD-3, AD-6, AD-11), `EXPERIENCE.md` (destructive-confirmation voice example, admin-action-bar summary — read as incomplete for this narrow action, see Notes), `2-7-enroll-remove-team.md` (the `checkCanEnroll`/`checkCanRemoveEntry` pattern `checkCanRedraw` follows), `3-3-draw.md` (the exact pipeline this story re-runs, plus its own review's three directly-applicable lessons).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4: Пережеребкування] — user story + AC; FR-12
- [Source: _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md#4.4 FR-12] — precise checkable consequences ("видаляє... і створює новий", "заблоковане" not "зникає")
- [Source: …/ARCHITECTURE-SPINE.md#AD-3, #AD-6, #AD-11] — dependency direction; Server Action + requireAdmin; sole Prisma owner
- [Source: …/EXPERIENCE.md#Voice and Tone "Підтвердження руйнівних дій"] — destructive-confirmation phrasing style
- [Source: …/EXPERIENCE.md#Interaction Primitives "Підтвердження"] — the closed list (doesn't name redraw — see Notes for why this story still adds one, per its own AC text)
- [Source: _bmad-output/implementation-artifacts/2-7-enroll-remove-team.md] — `checkCanEnroll`/`checkCanRemoveEntry` pattern
- [Source: _bmad-output/implementation-artifacts/3-3-draw.md] — `generateSchedule`, `defaultShuffle`, `saveDraw`, `drawTournament`, `DrawTournamentButton`, and that story's own three review lessons (shuffle bug, state-gating, rollback-test gap)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-05 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
