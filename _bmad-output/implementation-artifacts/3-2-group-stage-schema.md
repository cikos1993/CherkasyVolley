---
baseline_commit: 9e53089
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - _bmad-output/specs/spec-cherkasy-volley/glossary.md
  - _bmad-output/implementation-artifacts/2-1-tournament-team-player-schema.md
  - _bmad-output/implementation-artifacts/2-4-create-tournament.md
  - _bmad-output/implementation-artifacts/3-1-domain-engine-scoring-tiebreak-schedule-validation.md
  - AGENTS.md
---

# Story 3.2: Group stage schema

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a розробник,
I want the group-stage entities added by their own migration,
so that there is somewhere to store the calendar and results (AD-11).

## Acceptance Criteria

Translated from `epics.md` → Epic 3 → Story 3.2. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** the schema as it stands after Epic 2
**When** a migration adds `Group` (already exists as a structural anchor since Story 2.4 — extended here, not recreated), `GroupSlot`, `Match` (`stage` enum, `groupId?`, `homeEntryId`, `awayEntryId`, `scheduledAt?`, `venueText?`), `SetScore` (`matchId`, `setNo`, `homePoints`, `awayPoints`)
**Then**

1. `src/data`'s `getStandings(tournamentId)` computes the table from `Match` + `SetScore` through `src/domain`.
2. The group standings table is never stored as a separate DB row anywhere.

### Notes on AC interpretation

- **`Group` already exists (Story 2.4) — this story extends the schema around it, doesn't recreate it.** Story 2.4's migration `20260904160000_tournament_group_and_natural_key` added a minimal `Group` (`id`, `tournamentId @unique`, timestamps, `onDelete: Cascade`) with the explicit comment "слоти/матчі — Epic 3." That comment is this story. **`Group` itself needs no new column** — `GroupSlot`/`Match` both reference it by id; nothing about "one group per tournament in v1" changes.
- **`Match.homeEntryId`/`awayEntryId` must be nullable — a deliberate deviation from the epics AC's literal notation.** The epics.md line lists `groupId?` and `scheduledAt?` with a `?` but writes `homeEntryId`, `awayEntryId` without one. `ARCHITECTURE-SPINE.md`'s AD-5 (more detailed, and the acknowledged source of truth for invariants over `epics.md`'s shorthand) requires the opposite for playoff matches: "`homeEntry`/`awayEntry` матчу наступного раунду обчислюються з результатів попереднього раунду **доки в самому матчі немає `SetScore`**" — i.e. a `FINAL`/`THIRD_PLACE` match row is created with **both entries unknown** (`bracket-pair-tbd` in `DESIGN.md`) until the semifinals decide them, computed live by `domain/bracket.ts` (Epic 4) rather than written until a real result exists. **Decision: `homeEntryId String?` / `awayEntryId String?`.** For `GROUP`-stage matches this story actually creates data for, both are always set at creation time (Story 3.3's draw knows every pairing upfront) — nullability is structurally required for Epic 4's playoff rows, unused (never actually null) for this story's own `GROUP` rows.
- **`Match.stage` enum is `GROUP | SEMIFINAL | THIRD_PLACE | FINAL` — no speculative extra values.** These are the exact four stages `glossary.md`'s "Плейоф" entry and AD-5 name for v1's fixed 4-team bracket. `ARCHITECTURE-SPINE.md`'s Deferred section notes a future Cup/knockout format "лишає місце" in the enum/type system generally — that means "don't design the schema in a way that forecloses it," not "add unused enum values now." A knockout format's own migration adds its own values when that story actually gets built (same enum-migration-hygiene rule already in `AGENTS.md`: a new label needs its own migration anyway).
- **CHECK: a `GROUP`-stage match has a non-null `groupId`; every other stage has a null one.** `stage = 'GROUP' AND "groupId" IS NOT NULL) OR (stage != 'GROUP' AND "groupId" IS NULL` — a raw-SQL `CHECK`, Prisma 7 doesn't model these (same pattern as `tournament`'s year/teamCount/rounds checks, Story 2.4's migration).
- **CHECK: a match's two entries, once both known, must differ.** `("homeEntryId" IS NULL OR "awayEntryId" IS NULL OR "homeEntryId" != "awayEntryId")` — a team cannot play itself. Same raw-SQL-CHECK pattern.
- **CHECK: `SetScore.homePoints`/`awayPoints` are non-negative.** `src/domain/validation.ts` (Story 3.1) already enforces this at the application layer (`validateSetScore` rejects negative/non-integer scores) — the DB check is defense-in-depth, matching the existing "app validates, DB also checks the same numeric bound" pattern already used for `tournament.year`/`teamCount`/`rounds`.
- **`GroupSlot` is a membership bridge, not a duplicate of `TournamentEntry`.** `ARCHITECTURE-SPINE.md`'s ER diagram draws `Group ||--o{ GroupSlot` and `TournamentEntry ||--o{ GroupSlot` as two separate edges — `GroupSlot` records *which* entries were placed into *which* group at draw time, distinct from `TournamentEntry` (which only records a team's participation in the tournament as a whole). In v1 (exactly one group, per Story 2.4) every entered team ends up in the one `GroupSlot` set after the draw, so the two lists are equivalent in practice today — but `getStandings` reads entry ids from `GroupSlot`, not `TournamentEntry`, because `GroupSlot` is the schema's actual model of group membership and the one that survives cleanly if a future story ever allows multiple groups (deferred, not this story's problem to solve, just not to structurally block). Minimal shape: `id`, `groupId`, `entryId`, `@@unique([groupId, entryId])` — no seed/position field; nothing in Epic 3/4's stories asks for one.
- **Story 3.3 (Жеребкування) populates `GroupSlot` and creates the `GROUP`-stage `Match` rows together, in one Server Action — not this story's job.** This story only adds the tables; nothing here writes to them yet (no Server Action, no domain wiring beyond `getStandings` reading, which tolerates an empty/undrawn group by returning `[]`).
- **Story 3.4 (Пережеребкування/redraw) deletes and recreates `Match` rows, but never touches `GroupSlot`.** Redraw only changes the calendar (which pairs play in which tour), never which entries belong to the group — v1 has exactly one group and redraw doesn't move entries between groups. Documented here so Story 3.4 doesn't have to re-derive this from the schema.
- **`getStandings(tournamentId)` returns the *ordered* table (`tiebreak.ts`'s `orderStandings` output), not raw `scoring.ts` aggregation.** AD-4 calls this function "the table" — a table has an order. `getStandings` composes: resolve the tournament's `Group` → its `GroupSlot`s (→ `entryIds` + a `teamId → name` map via each slot's `TournamentEntry.team`) → every `GROUP`-stage `Match` (+ `SetScore`s) for the tournament → `computeStandings` (Story 3.1, `scoring.ts`) → `orderStandings` (Story 3.1, `tiebreak.ts`). Returns `[]` for a tournament with no `Group` row (shouldn't happen — every `Tournament` gets one at creation, Story 2.4) or an empty `GroupSlot` set (a `DRAFT` tournament pre-draw — the real, expected empty case).
- **This story wires `src/data → src/domain` for the first time with a *value* import, not just types.** Every prior `data → domain` edge (`NewTournamentInput`, `PlayerInput`, etc.) was type-only. `getStandings` calls `computeStandings`/`orderStandings` as real functions — still the exact same sanctioned edge (already an open item tracked in `src/README.md`/`AGENTS.md`, Story 2.4 onward; this doesn't newly violate anything, just exercises the value-import half of it for the first time).
- **Migration technique: the standard fallback, not `prisma migrate dev` directly.** `AGENTS.md`'s carried caveat — `migrate dev` is non-interactive-blocked in this tool for a schema change with an advisory warning (a new enum, several new tables). Use `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` → hand-write the migration folder/`migration.sql` → append the three `CHECK` constraints (same style as Story 2.4's migration) → `prisma migrate deploy` → verify with `migrate status` + `migrate diff --exit-code`.

## Tasks / Subtasks

- [x] **Task 1 — `prisma/schema.prisma` (UPDATE): `MatchStage` enum, `GroupSlot`, `Match`, `SetScore` models** (AC: 1, 2)
  - [x] `enum MatchStage { GROUP SEMIFINAL THIRD_PLACE FINAL }`.
  - [x] `model GroupSlot` — `id`, `groupId` (FK → `Group`, `onDelete: Cascade`), `entryId` (FK → `TournamentEntry`, `onDelete: Cascade`), `createdAt`. `@@unique([groupId, entryId])`.
  - [x] `model Match` — `id`, `tournamentId` (FK → `Tournament`, `onDelete: Cascade`), `stage: MatchStage @default(GROUP)`, `groupId: String?` (FK → `Group`, `onDelete: Cascade`), `homeEntryId: String?` / `awayEntryId: String?` (two named-relation FKs → `TournamentEntry`, `onDelete: Cascade`), `scheduledAt: DateTime? @db.Timestamptz(3)`, `venueText: String?`, `createdAt`/`updatedAt @db.Timestamptz(3)`. `@@index([tournamentId, stage])`.
  - [x] `model SetScore` — `id`, `matchId` (FK → `Match`, `onDelete: Cascade`), `setNo: Int`, `homePoints: Int`, `awayPoints: Int`, `createdAt`/`updatedAt @db.Timestamptz(3)`. `@@unique([matchId, setNo])`, `@@index([matchId])`.
  - [x] `Group` gains back-relations (`slots GroupSlot[]`, `matches Match[]`) — the model's own fields are otherwise untouched.
  - [x] `Tournament` gains a `matches Match[]` back-relation.
  - [x] `TournamentEntry` gains `groupSlots GroupSlot[]`, `homeMatches Match[] @relation("MatchHomeEntry")`, `awayMatches Match[] @relation("MatchAwayEntry")` back-relations.
  - [x] `pnpm exec prisma format` + `pnpm exec prisma generate` clean; `typecheck`/`lint` clean.
- [x] **Task 2 — Migration (fallback technique, non-interactive tool)** (AC: 1, 2)
  - [x] Pre-flight: `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` → reviewed the generated SQL.
  - [x] Hand-wrote `prisma/migrations/20260905125839_group_stage_schema/migration.sql` from that diff, verbatim plus the three `CHECK` constraints from Notes on AC interpretation appended at the end (matching Story 2.4's migration file's own append style).
  - [x] `pnpm exec prisma migrate deploy` (non-interactive-safe) against the `dev` Neon branch — applied cleanly.
  - [x] Verify: `pnpm exec prisma migrate status` → "Database schema is up to date!"; `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` → "This is an empty migration." (schema and DB agree, `CHECK`s excluded from drift detection as already established).
- [x] **Task 3 — `src/data/matches.ts` (NEW): `getStandings`** (AC: 1, 2)
  - [x] `getStandings(tournamentId: string): Promise<OrderedStandingsRow[]>` (the `src/domain/tiebreak.ts` return type) — resolves the tournament's `Group` → its `GroupSlot`s (with each slot's `TournamentEntry.team.name` for the `teamNames` map) → every `GROUP`-stage `Match` for the tournament with its `SetScore`s (mapped into `src/domain/scoring.ts`'s `MatchResult` shape) → `computeStandings` → `orderStandings` (both from `src/domain`, the tournament's `scoringPreset` read alongside). Returns `[]` if the group has no slots yet (pre-draw).
  - [x] Doc comment: the sole `src/data → src/domain` **value** import for standings — pure computation only, no write, no storage (AD-4). `typecheck`/`lint` clean.
- [ ] **Task 4 — Docs**
  - [ ] `src/data/README.md` — new `matches.ts` entry; note `Group`/`GroupSlot`/`Match`/`SetScore` under the existing "entities owned here" paragraph (already anticipates this: "Group landed in Story 2.4... GroupSlot / Match / SetScore come in Epic 3").
  - [ ] `AGENTS.md` — Stack-status bullet for Story 3.2 (schema/migration details, `getStandings`).
  - [ ] No `ARCHITECTURE-SPINE.md` edit — AD-4/AD-5/AD-11 are implemented exactly as already specified.
- [ ] **Task 5 — `deferred-work.md` (UPDATE)**
  - [ ] New "Story 3.2 implementation" section: no automated action-level test for `getStandings` beyond the verify script (Task 6) — same class as every prior `src/data` function; `GroupSlot`'s "no seed/position field" decision flagged for revisit if a future story needs manual reseeding beyond the `needsManualSeed` display flag; the `homeEntryId`/`awayEntryId` nullability (needed for Epic 4, unused by this story) flagged so Epic 4's bracket story doesn't have to rediscover why it's already nullable.
- [ ] **Task 6 — Verification gate** (AC: all)
  - [ ] `pnpm test` unchanged (no new `src/domain` module this story — reuses Story 3.1's engine as-is) · `pnpm typecheck` · `pnpm lint` · `pnpm build` clean (no new route).
  - [ ] Import-boundary greps: `src/data/matches.ts` is the only new Prisma-client import site; confirm it's under `src/data/**`.
  - [ ] `scripts/verify-group-stage-schema.mts` (NEW, self-cleaning): create a throwaway tournament + 3 entered teams, manually seat all 3 into the tournament's `Group` via `GroupSlot` (simulating what Story 3.3's draw will later automate) → create a few `GROUP`-stage `Match` rows + `SetScore`s by hand (a small round-robin, reusing `generateSchedule`/fixture shapes from Story 3.1's own tests for realism) → call `getStandings(tournamentId)` → assert it returns the correctly ordered table matching a hand-computed expectation → assert the two new `CHECK` constraints reject a bad insert each (a `GROUP` match with `groupId: null`, and a match with `homeEntryId === awayEntryId`) → full teardown.
  - [ ] Re-run all six prior verify scripts — no regression.
  - [ ] Real command output + notes captured in the Dev Agent Record.
- [ ] **Task 7 — Commit(s)** — one commit + `git push origin main` per completed task. `build` gated each.

## Dev Notes

### What this story is / is NOT

**Is:** the `Match`/`SetScore`/`GroupSlot` schema (via migration) plus the first real `src/data` read that calls Story 3.1's domain engine as actual functions (not just types) — `getStandings(tournamentId)`.

**Is NOT** (do not pull forward):
- **The draw itself** (populating `GroupSlot`/creating `GROUP` matches) — Story 3.3.
- **Redraw** — Story 3.4.
- **Match scheduling** (`scheduledAt`/`venueText` writes) — Story 3.5.
- **Result entry/correction** (`SetScore` writes) — Story 3.6/3.7.
- **The public standings page** (rendering `getStandings`'s output) — Story 3.8.
- **Any playoff (`SEMIFINAL`/`THIRD_PLACE`/`FINAL`) row creation or `bracket.ts`** — Epic 4. The enum values and nullable `homeEntryId`/`awayEntryId` exist now purely so Epic 4 doesn't need its own schema migration for them.

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `prisma/schema.prisma` | UPDATE | `MatchStage` enum, `GroupSlot`, `Match`, `SetScore` models + back-relations on `Group`/`Tournament`/`TournamentEntry`. |
| `prisma/migrations/<timestamp>_group_stage_schema/` | NEW | Hand-written from `migrate diff`, plus 3 `CHECK` constraints. |
| `src/data/matches.ts` | NEW | `getStandings(tournamentId)`. |
| `scripts/verify-group-stage-schema.mts` | NEW | Self-cleaning DB round-trip + `CHECK` constraint assertions. |
| `src/data/README.md` · `AGENTS.md` · `deferred-work.md` | UPDATE | Module entry, Stack status, new deferred section. |
| `src/domain/**` | DO NOT TOUCH | Story 3.1's engine is consumed as-is, no changes. |
| `src/actions/**`, `src/components/**`, `src/app/**` | DO NOT TOUCH | No Server Action, no UI this story. |

### Architecture compliance

- **AD-4 — `Match` + `SetScore` are the sole source of truth for results; standings never stored.** `getStandings` computes fresh every call, no cache/materialization. [ARCHITECTURE-SPINE.md#AD-4]
- **AD-5 — playoff matches get schedule + result rows; `homeEntry`/`awayEntry` for an as-yet-undecided playoff match are computed by `bracket.ts`, not read from a stored (necessarily null, pre-Epic-4) column.** This story's schema makes that possible (`homeEntryId`/`awayEntryId` nullable) without implementing the computation — Epic 4's job. [ARCHITECTURE-SPINE.md#AD-5]
- **AD-11 — `src/data` is the sole Prisma owner.** `matches.ts` is the only new file importing the client; `Group`/`GroupSlot`/`Match`/`SetScore` join the entities already owned there. [ARCHITECTURE-SPINE.md#AD-11]
- **AD-3 — dependency direction; the `data → domain` open item.** `getStandings` is the first `src/data → src/domain` **value** call (not just a type import) — already an acknowledged, tracked tension (`src/README.md`'s open item, Story 2.4 onward established the type-only precedent), not a new violation; this story is explicitly named as one of the two places (`epics.md` Story 3.2's own AC) this edge was always meant to land. [ARCHITECTURE-SPINE.md#AD-3, src/README.md]
- **AD-9 — discipline filtering.** `getStandings` takes a `tournamentId` already known to be a real, existing tournament (callers — Story 3.8's public page, admin match-entry screens — resolve that separately); it does not itself filter `discipline`/`state`, matching `getEntryForAdmin`/`getEntryByTeam`'s "scoping ≠ visibility" precedent from Story 2.7/2.8/2.9.

### Existing code being modified — current state → change → what must be preserved

**`prisma/schema.prisma`** (`Group` from Story 2.4)
- *Current:* `Group` has only `id`, `tournamentId @unique`, timestamps — no back-relations to anything.
- *Change:* add `slots GroupSlot[]` and `matches Match[]` back-relations; no change to `Group`'s own scalar fields or its `@@unique`.
- *Must preserve:* `tournamentId @unique` (one group per tournament, v1's structural decision) — untouched.

### Testing requirements

- **No new `src/domain` module** — this story reuses Story 3.1's engine unchanged. `pnpm test`'s count stays at 103.
- **`scripts/verify-group-stage-schema.mts`** is the real correctness check — a full hand-seeded group (slots + matches + set scores) through `getStandings`, asserting the computed table matches a hand-worked expectation (same rigor as Story 3.1's own domain tests, now proven through a real Prisma round-trip for the first time).
- **The two new `CHECK` constraints need their own assertions** in the verify script — a raw insert attempt that violates each, asserting Postgres rejects it (matching how Story 2.4's `tournament` checks would be verified, if a verify script had covered them — this story is a chance to establish that pattern for a `CHECK`, not just `P2002`/`P2025`).
- **Regression:** all six prior verify scripts re-run unchanged; route table unaffected (no new route).

### Previous story intelligence

**Story 3.1 (done, code-reviewed):** `computeStandings`/`orderStandings`'s exact signatures and the `MatchResult`/`StandingsRow`/`OrderedStandingsRow` shapes this story's `getStandings` must map Prisma rows into. The code review there fixed a real bug in `schedule.ts` (home/away bias) — irrelevant to this story's own code, but a reminder that "the domain engine is correct" was hard-won and this story must map into it faithfully (e.g. don't accidentally swap `home`/`away` when building `MatchResult` from a `Match` row).

**Story 2.4 (done):** `Group`'s exact existing shape and the "слоти/матчі — Epic 3" comment this story fulfills; the raw-SQL `CHECK`-constraint-append pattern (`tournament`'s year/teamCount/rounds) this story's own three `CHECK`s follow.

**Story 2.1 (done):** the original schema/migration story — `@db.Timestamptz(3)` on every timestamp column, `cuid()` ids, `@@map` snake_case table names — conventions this story's four new/touched models follow without deviation.

### Git intelligence

Recent: `9e53089` (3.1 code-review done) ← `7dcae48` (3.1 fix pass) ← `84fed1e` (3.1 findings) ← `783c4f7` (3.1 → review). `prisma/schema.prisma` has no `MatchStage` enum, no `GroupSlot`/`Match`/`SetScore` models yet. `src/data/` has no `matches.ts`. Migrations: 4 exist (`tournament_schema`, `tournament_schema_constraints`, `tournament_group_and_natural_key`, `team_name_key`) — none touch `Match`/`SetScore`/`GroupSlot`.

### Latest tech information

- No new library. Same Prisma 7 driver-adapter setup, same migration-fallback technique (`migrate diff` → hand-write → `migrate deploy`) every schema story since 1.5 has used.
- Two FKs from `Match` to `TournamentEntry` (`homeEntryId`/`awayEntryId`) need Prisma's named-relation syntax (`@relation("MatchHomeEntry", ...)` / `@relation("MatchAwayEntry", ...)`) since there are two distinct edges between the same pair of models — first time this schema needs it (every prior FK pair has been 1:1 between distinct model pairs).

### Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 3.2 AC), `ARCHITECTURE-SPINE.md` (AD-4, AD-5, AD-11, AD-3's open item, the ER diagram naming `GroupSlot`/`Match`/`SetScore`'s edges), `glossary.md` ("Матч", "Партія", "Плейоф"), `2-4-create-tournament.md` (`Group`'s original shape + the CHECK-constraint pattern), `3-1-domain-engine-scoring-tiebreak-schedule-validation.md` (the exact function signatures/types this story's `getStandings` consumes).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2: Схема групового етапу] — user story + AC
- [Source: …/ARCHITECTURE-SPINE.md#AD-4, #AD-5, #AD-11, #AD-3, #Дерево коду, #Ключові сутності] — standings never stored; playoff TBD-participant computation; sole Prisma owner; the `data → domain` open item; ER diagram
- [Source: _bmad-output/implementation-artifacts/2-4-create-tournament.md] — `Group`'s original shape; the raw-SQL CHECK-constraint pattern
- [Source: _bmad-output/implementation-artifacts/3-1-domain-engine-scoring-tiebreak-schedule-validation.md] — `computeStandings`/`orderStandings`/`MatchResult`/`StandingsRow`/`OrderedStandingsRow` — the exact contract `getStandings` maps into
- [Source: AGENTS.md] — the non-interactive `migrate dev` fallback technique; enum-migration hygiene

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-05 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
