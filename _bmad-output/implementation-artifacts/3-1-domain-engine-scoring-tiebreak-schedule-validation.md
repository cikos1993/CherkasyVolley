---
baseline_commit: 1b20a7a
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - _bmad-output/specs/spec-cherkasy-volley/glossary.md
  - _bmad-output/implementation-artifacts/2-3-tournament-state-machine.md
  - AGENTS.md
---

# Story 3.1: Domain engine — scoring, tiebreak, schedule, validation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a розробник,
I want pure domain functions for group-stage scoring, tiebreaks, schedule generation, and set-score validation, with unit tests,
so that the counting rules are identical everywhere and testable (AD-2, AD-4, NFR-3).

## Acceptance Criteria

Translated from `epics.md` → Epic 3 → Story 3.1. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** the `src/domain` directory from Story 1.3
**When** `scoring.ts` (match points per preset), `tiebreak.ts` (points → head-to-head via a mini-table → sets won → name + manual-seed flag), `schedule.ts` (round-robin, given number of cycles, bye rounds for an odd team count), `validation.ts` (set score per preset: to 25/15, 2-point margin, Veteran → 15) are implemented
**Then**

1. Unit tests cover both presets, the tiebreak chain with worked examples, and the schedule for 4/5/6 teams.
2. PRD Open Question #5 (a separate "target set score" field) is either resolved or the hardcoded rule is fixed with a documented rationale in code.
3. No function imports Next, Prisma, or `src/data`.

### Notes on AC interpretation

- **PRD Open Question #5 is already resolved for v1 — not actually open.** `prd.md` §10 lists it as an open question in the abstract, but its own §11 "Index of Assumptions" and FR-5's "Наслідки" already fix the rule: target score is **15 for every set when `Tournament.type === "VETERAN"`**, otherwise **25**, with the **CLASSIC preset's decisive 5th set always 15** regardless of type (a Veteran match's 5th set is still 15 — no double-counting needed, the two rules agree). `validation.ts` implements this as the fixed rule with a doc comment citing FR-5's own `[NOTE FOR PM]` ("якщо трапляться інші відхилення — винести в поле Правил турніру") — a comment explaining *why* it's hardcoded, not a literal `TODO`, since PRD does not leave this open for v1.
- **The PRD gives the tiebreak chain only in the abstract — no worked numeric examples exist anywhere in `prd.md` or `epics.md`.** The AC's "з прикладами з PRD" overstates what's actually there. This story must construct its own worked fixtures (e.g. a 4-team mini-league with a real 3-way points tie) matching the documented chain — there is nothing to transcribe from source.
- **Tiebreak chain, exact algorithm (`epics.md`'s wording is more precise than `prd.md`'s and is authoritative for the mechanism):** (1) sum of points across all group matches; (2) among teams still tied on points, a **mini-standings table built only from the matches played among those tied teams** (not the full group), ranked by points within that subset — `epics.md`: "особиста зустріч через міні-таблицю"; (3) total sets won (across all group matches, not just the tied subset); (4) deterministic fallback — team name (Ukrainian collation), flagged `needsManualSeed: true` for the admin, per FR-17's `[ПРИПУЩЕННЯ]`. A genuine 3+-way tie that the mini-table itself doesn't break (e.g. a perfect points cycle A>B>C>A within the subset) falls through to step 3, then step 4 — the mini-table step does not recurse into its own tiebreak chain.
- **The win-by-2 margin rule applies to both presets, not just `CLASSIC`.** `prd.md`'s explicit "різниця у 2 м'ячі" note sits under `CLASSIC` in FR-15's "Наслідки" and its own Index of Assumptions entry, but `CUSTOM`'s "рівно 3 партії, кожна виграна партія = 1 очко" doesn't redefine what winning a *set* means — both presets are still real volleyball sets, and win-by-2 is a property of the sport, not the points-per-match preset. **Decision: `validation.ts` applies win-by-2 uniformly.** No PRD line contradicts this; documented here so a future reader doesn't read the preset-scoped placement as scoping the rule itself.
- **Set score validated as "first to target with a ≥2-point lead," no upper cap.** Standard volleyball scoring — e.g. 27:25 is a legal decisive-set-adjacent score at target 25 if the leading team just reached the 2-point margin; there is no stated ceiling in PRD, so none is implemented.
- **`schedule.ts`'s "коло" (cycle) repeats the same round-robin pairing set, no home/away swap.** `epics.md`/PRD never mention reversing home/away between cycles (unlike some sports' true double round-robin), and volleyball has no codified home-advantage stat this app tracks (AD-4 — no stored standings beyond points/sets). **Decision: `rounds` cycles each generate the identical set of pairings** (only the *order* of pairs within a tour is randomized per FR-11, independently per cycle) — home/away assignment within a pairing is arbitrary but stable across cycles for the same pair. A future story can revisit this if a real regulation requires alternating home/away.
- **Bye handling for an odd team count uses the standard circle method.** For an odd number of teams, add one placeholder "bye" slot so every real team sits out exactly one tour per cycle; `schedule.ts` never emits a real match against the bye slot. This is the conventional round-robin scheduling algorithm — not separately specified in PRD/epics beyond "тури-пропуски для непарної кількості," which just names the requirement.
- **Every function takes plain, `src/domain`-local input shapes — no Prisma types.** `Match`/`SetScore`/`Group`/`GroupSlot` don't exist yet (Story 3.2 adds them); this story's functions accept/return interfaces defined in `src/domain` itself (e.g. a `MatchResult` shape with `homeEntryId`/`awayEntryId`/an array of set scores), so Story 3.2's `src/data` layer maps its Prisma rows into these shapes before calling in — the same `data → domain` type-only import pattern already established (`NewTournamentInput`, `PlayerInput`, etc.), just in the other direction (domain types consumed by data, not exported *from* domain into data — domain still exports the types, data imports them).
- **`computeStandings` lives in `scoring.ts`, per `ARCHITECTURE-SPINE.md`'s own file map** ("scoring.ts — computeStandings, points-per-match за пресетом"); `tiebreak.ts` exports the ordering/comparator logic `scoring.ts` calls internally, not a second public entry point competing with it.

## Tasks / Subtasks

- [x] **Task 1 — `src/domain/scoring.ts` (NEW) + Vitest spec** (AC: 1, 3)
  - [x] `MatchResult` type: `{ homeEntryId: string; awayEntryId: string; sets: { setNo: number; homePoints: number; awayPoints: number }[] }`.
  - [x] `matchPoints(sets, preset): { home: number; away: number }` — `CLASSIC`: winner determined by sets won (first to 3); 3:0/3:1 → 3/0, 3:2 → 2/1. `CUSTOM`: exactly 3 sets, 1 point per set won each side (independent of who "wins" the match).
  - [x] `computeStandings(entryIds, matches, preset): StandingsRow[]` — `{ entryId, played, wins, losses, points, setsWon, setsLost }` per entry, aggregated from every match involving that entry; wins/losses derived from sets-won majority (`CLASSIC`: first to 3; `CUSTOM`: majority of 3). Ordering delegated to `tiebreak.ts`.
  - [x] Vitest: both presets' point allocation for every legal set-count outcome (3:0, 3:1, 3:2 for `CLASSIC`; each of the 4 possible 3-set outcomes for `CUSTOM`), `computeStandings` aggregation across a small multi-match fixture. `pnpm test` → 6 files, 78/78.
- [x] **Task 2 — `src/domain/tiebreak.ts` (NEW) + Vitest spec** (AC: 1, 3)
  - [x] `orderStandings(rows, matches, preset, teamNames): { row: StandingsRow; needsManualSeed: boolean }[]` — sorts by points desc, then (for ties) the head-to-head mini-table among just the tied entries (via `computeStandings` restricted to their shared matches), then total sets won desc, then team name (`teamNames: Record<entryId, name>`), flagging `needsManualSeed: true` only on rows that reached the name fallback.
  - [x] Vitest: a clean points-only ordering (no ties); a 2-team tie broken by the head-to-head mini-table; a 3-team tie broken by the mini-table where one team clearly dominates the subset; a constructed 3-way tie that survives the mini-table (a stats cycle) and falls through to sets-won, then to name + `needsManualSeed`. `pnpm test` → 7 files, 82/82.
- [x] **Task 3 — `src/domain/schedule.ts` (NEW) + Vitest spec** (AC: 1, 3)
  - [x] `generateSchedule(entryIds: string[], rounds: number, shuffle?): { round: number; tour: number; homeEntryId: string; awayEntryId: string }[]` — circle-method round-robin; odd `entryIds.length` gets a synthetic bye slot that never appears in an emitted pairing; `rounds` cycles repeat the same pairing set (see Notes — no home/away swap); pair order within each tour is randomized independently per cycle via an injectable `shuffle` (defaults to a `Math.random`-based Fisher–Yates).
  - [x] Vitest: 4 teams (even, no bye) — every pair appears exactly once per cycle, `rounds=2` doubles every pairing; 5 teams (odd) — exactly one bye per tour per team over the cycle, never a match with the bye slot; 6 teams — same even-count assertions as 4. Asserted with a deterministic identity shuffle (not `Math.random`). `pnpm test` → 8 files, 86/86.
- [x] **Task 4 — `src/domain/validation.ts` (NEW) + Vitest spec** (AC: 1, 2, 3)
  - [x] `targetScore(preset, tournamentType, setNo): number` — `tournamentType === "VETERAN"` → `15` always; else `preset === "CLASSIC" && setNo === 5` → `15`; else `25`. Doc comment cites FR-5's `[NOTE FOR PM]` — hardcoded intentionally, not a gap (AC 2).
  - [x] `validateSetScore(homePoints, awayPoints, target): { ok: true } | { ok: false; message: string }` — winner must reach `>= target` with a lead `>= 2`; the loser's score has no independent ceiling beyond what the margin rule implies; reject negative/non-integer inputs.
  - [x] `validateMatchScore(sets, preset, tournamentType): { ok: true } | { ok: false; message: string }` — `CLASSIC`: 3 to 5 sets, ends the instant one side reaches 3 set-wins (any set played after that point is invalid), each set validated via `validateSetScore` with the right `targetScore` per `setNo`; `CUSTOM`: exactly 3 sets, no early-stop rule (all 3 always played per FR-5).
  - [x] Vitest: `targetScore` for every `(preset, type, setNo)` combination that matters; `validateSetScore` legal scores at the boundary (25:23, 26:24, 27:25), illegal margin-1 (25:24), illegal below-target; `validateMatchScore` a complete legal `CLASSIC` 3:2 match, an illegal `CLASSIC` match with a 4th set played after a 3:0 sweep, an incomplete `CLASSIC` match, a complete legal `CUSTOM` match, an illegal `CUSTOM` match with only 2 sets, a `CLASSIC` 5th set failing the 15-point target. `pnpm test` → 9 files, 99/99.
- [x] **Task 5 — Docs**
  - [x] `src/domain/README.md` — four new module entries (`scoring.ts`, `tiebreak.ts`, `schedule.ts`, `validation.ts`), each summarizing its exported functions and the one non-obvious rule (win-by-2 applies to both presets; no home/away swap across cycles; the mini-table tiebreak step).
  - [x] `AGENTS.md` — Stack-status bullet for Story 3.1 (the epic's own convention: "Перша історія — чистий двигун").
  - [x] No `ARCHITECTURE-SPINE.md` edit — this story implements AD-2/AD-4/NFR-3 exactly as already specified, no new invariant.
- [ ] **Task 6 — `deferred-work.md` (UPDATE)**
  - [ ] New "Story 3.1 implementation" section: no from-empty integration test yet (no `src/data`/`Match`/`SetScore` schema until Story 3.2 — this story is 100% unit-testable in isolation, unlike every prior story); the win-by-2-applies-to-both-presets decision flagged as a judgment call worth revisiting if a real regulation ever states otherwise; the no-home/away-swap decision flagged the same way.
- [ ] **Task 7 — Verification gate** (AC: all)
  - [ ] `pnpm test` — 4 new domain files (this story adds no component/action/page code, so this is the *entire* verification surface); `pnpm typecheck` · `pnpm lint` clean. No `pnpm build` needed (no new route, no route-table check) — still run once to confirm nothing broke.
  - [ ] Import-boundary greps: confirm `src/domain/{scoring,tiebreak,schedule,validation}.ts` import nothing from `next`, `@prisma/client`/`@/generated/prisma`, `react`, or any other `src/` layer.
  - [ ] No verify script needed — nothing touches the database. This is the first story since 1.3 with zero `src/data` involvement.
  - [ ] Real command output + notes captured in the Dev Agent Record.
- [ ] **Task 8 — Commit(s)** — one commit + `git push origin main` per completed task. No `build` gate to wait on (no new route), but still run it once at the end per the verification gate.

## Dev Notes

### What this story is / is NOT

**Is:** four pure `src/domain` modules — `scoring.ts`, `tiebreak.ts`, `schedule.ts`, `validation.ts` — covering every group-stage counting/validation rule the PRD specifies, each with exhaustive Vitest coverage using hand-constructed fixtures (since PRD supplies no worked examples).

**Is NOT** (do not pull forward):
- **Any `Match`/`SetScore`/`Group`/`GroupSlot` schema or migration** — Story 3.2.
- **The draw Server Action, or any wiring of `generateSchedule` into a real database write** — Story 3.3.
- **Any UI** — no components, no pages, no Server Actions this story.
- **`bracket.ts` (playoff seeding/advancement)** — Epic 4, a separate module.
- **Storing standings or schedule anywhere** — AD-4 forbids it; these functions are called at read time, always from `Match`/`SetScore` rows, starting in Story 3.2.

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/domain/scoring.ts` | NEW | `matchPoints`, `computeStandings`. |
| `src/domain/scoring.test.ts` | NEW | Both presets, every legal set-count outcome. |
| `src/domain/tiebreak.ts` | NEW | `orderStandings` — the mini-table tiebreak chain. |
| `src/domain/tiebreak.test.ts` | NEW | Worked fixtures, since PRD has none. |
| `src/domain/schedule.ts` | NEW | `generateSchedule` — round-robin, bye handling. |
| `src/domain/schedule.test.ts` | NEW | 4/5/6-team fixtures, deterministic shuffle injected. |
| `src/domain/validation.ts` | NEW | `targetScore`, `validateSetScore`, `validateMatchScore`. |
| `src/domain/validation.test.ts` | NEW | Every `(preset, type, setNo)` combination; margin edge cases. |
| `src/domain/README.md` · `AGENTS.md` · `deferred-work.md` | UPDATE | Module entries, Stack status, new deferred section. |
| `prisma/schema.prisma` | DO NOT TOUCH | Story 3.2's job. |
| `src/data/**`, `src/actions/**`, `src/components/**`, `src/app/**` | DO NOT TOUCH | This story is 100% `src/domain`. |

### Architecture compliance

- **AD-2 — domain logic lives only in `src/domain`, pure.** All four modules: deterministic `(input) → output`, no IO. [ARCHITECTURE-SPINE.md#AD-2]
- **AD-4 — standings/placements never stored, always computed from match results.** `computeStandings`/`orderStandings` are the functions Story 3.2's `getStandings(tournamentId)` will call — this story builds the compute side in isolation, ahead of having real rows to feed it. [ARCHITECTURE-SPINE.md#AD-4]
- **NFR-3 — counting integrity.** Impossible for a stored standings row to drift from match results, because none is ever stored — enforced structurally by AD-4, not by a runtime check.
- **AD-3 — dependency direction.** `src/domain` imports nothing (`domain → *` forbidden except other domain modules) — `tiebreak.ts` may import from `scoring.ts` if it needs `StandingsRow`'s shape (a same-layer import, always allowed). [ARCHITECTURE-SPINE.md#AD-3]
- **Consistency Conventions** — `computeStandings` is the exact function name the spine's own file-tree comment already names; Vitest is "обов'язково" for every domain function, deterministic, no mocks. [ARCHITECTURE-SPINE.md#Consistency Conventions]

### Testing requirements

- **This is the most heavily unit-tested story in the project so far** — 4 new domain files, no UI/data/action surface at all, so `pnpm test`'s pass/fail is the entire correctness gate (no verify script, no browser walkthrough is even meaningful — there's nothing running yet).
- Every numeric edge case named in Notes on AC interpretation needs its own test case: the win-by-2 boundary (25:23 legal, 25:24 illegal), the decisive-5th-set target (15 regardless of preset-implied 25), the 3-way-tie-survives-the-mini-table fixture, the bye-never-matched assertion for odd team counts.
- No regression risk to any other story — this is pure new-file addition with zero existing-file edits.

### Previous story intelligence

**Story 2.3 (tournament state machine, done)** is the closest precedent for a domain-only story: `src/domain/tournamentState.ts` + `.test.ts`, `TRANSITIONS`/`LABELS` as plain exported consts, `checkTransition` as the single authoritative gate function others call. This story follows the identical shape — one file per concern, one exported "authoritative" function per file, a Vitest file alongside each.

**Epic 2 (done):** every prior domain module (`tournamentForm.ts`, `teamForm.ts`, `teamEnrollment.ts`, `playerForm.ts`) took/returned plain interfaces, never Prisma types, and was consumed by `src/data`/`src/actions` via a type-only import. This story is the first domain module written *before* its consuming `src/data` functions exist (Story 3.2 hasn't landed yet) — the shapes defined here become the contract Story 3.2 must map its Prisma rows into, not the other way around.

### Git intelligence

Recent: `1b20a7a` (2.9 code-review complete) ← `2023076` (2.9 AGENTS.md note) ← `74aeb08` (2.9 fix pass) ← `b31c471` (2.9 findings) ← `90a5528` (2.9 → review). `src/domain/` currently has: `README.md`, `tournamentState.ts`(+spec), `tournamentForm.ts`(+spec), `teamForm.ts`(+spec), `teamEnrollment.ts`(+spec), `playerForm.ts`(+spec) — no `scoring.ts`/`tiebreak.ts`/`schedule.ts`/`validation.ts` yet. `prisma/schema.prisma` has no `Match`/`SetScore`/`GroupSlot` models yet (`Group` is a bare structural anchor from Story 2.4, unchanged since). Epic 2 is fully `done`; this is the first Epic 3 story.

### Latest tech information

- No new library. Pure TypeScript + Vitest, same `vitest.config.mts` (`environment: node`) every prior domain module already uses.
- Node's `crypto.randomInt` (stdlib, already available — no new dependency) is a reasonable default shuffle-source if `schedule.ts` needs one beyond a test-injected deterministic function; `Math.random` is also acceptable and matches the codebase's existing zero-dependency preference.

### Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 3.1 AC), `prd.md` (FR-5, FR-15, FR-16, FR-17, §10 Відкриті питання #5, §11 Індекс припущень — the actual source of the "already resolved" and "win-by-2" facts, more detailed than epics.md alone), `SPEC.md` (CAP-3), `glossary.md` (Партія, Результат матчу, Таблиця групи, Жеребкування), `ARCHITECTURE-SPINE.md` (AD-2, AD-3, AD-4, NFR-3, the `src/domain` file-tree comment naming `computeStandings`/`tiebreak.ts`), `2-3-tournament-state-machine.md` (the closest prior domain-only-story precedent for shape/rigor).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1: Чистий двигун — підрахунок, тай-брейки, календар, валідація] — user story + AC
- [Source: _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md#FR-5] — scoring presets, target score rule, `[NOTE FOR PM]`
- [Source: _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md#FR-15, FR-16, FR-17] — set validation (win-by-2), result correction, tiebreak chain
- [Source: _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md#10 Відкриті питання, #11 Індекс припущень] — Open Question #5 is already resolved; win-by-2 is a fixed v1 assumption
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#CAP-3] — scoring-engine capability
- [Source: …/ARCHITECTURE-SPINE.md#AD-2, #AD-3, #AD-4, #NFR-3, #Дерево коду] — pure domain, dependency direction, derived-not-stored standings, `computeStandings`/`tiebreak.ts` naming
- [Source: _bmad-output/implementation-artifacts/2-3-tournament-state-machine.md] — the shape/rigor precedent this story follows

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-05 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
