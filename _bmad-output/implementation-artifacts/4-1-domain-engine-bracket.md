---
baseline_commit: 914c875
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/implementation-artifacts/3-1-domain-engine-scoring-tiebreak-schedule-validation.md
  - _bmad-output/implementation-artifacts/3-2-group-stage-schema.md
  - _bmad-output/implementation-artifacts/3-8-public-standings-table.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - AGENTS.md
---

# Story 4.1: Чистий двигун — сітка плейофа

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a розробник,
I want чисті функції посіву й просування сітки плейофа з юніт-тестами,
so that логіка плейофа однакова всюди й тестована (AD-2, AD-5).

## Acceptance Criteria

Translated from `epics.md` → Epic 4 → Story 4.1. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** the `src/domain` directory (Story 1.3) and the read path `getStandings` (Story 3.2/3.8)
**When** `bracket.ts` is implemented with `seedPlayoff(standings)` and `advanceBracket(matches)`
**Then**

1. `seedPlayoff` produces two semifinals — **seed 1 – seed 4** and **seed 2 – seed 3** — from the ordered group table.
2. `advanceBracket` derives the **final** participants (the two semifinal winners) and the **third-place-match** participants (the two semifinal losers) from the previous round's results.
3. Once a match has its own `SetScore`, its pairing is **frozen** — no longer recomputed.
4. Unit tests cover recomputation when a semifinal result changes **both before and after the final has been played**.

FR / AD / SPEC anchors (in context):

- **FR-19** (`prd.md` §4.8): "Посів = місце в Таблиці групи; у Плейоф виходять команди з місцями 1–4. Формуються два півфінали: посів 1 проти посіву 4, посів 2 проти посіву 3."
- **FR-20** (`prd.md` §4.8): "Після внесення Результатів обох півфіналів система створює Фінал (переможці півфіналів) і Матч за 3-тє місце (ті, хто програв). … До внесення обох Результатів півфіналів Фінал і Матч за 3-тє місце відображаються як «очікує суперників». Зміна Результату півфіналу після формування Фіналу оновлює склад пар Фіналу / Матчу за 3-тє місце."
- **FR-21** (`prd.md` §4.8): "Результат Фіналу визначає місця 1 і 2; Результат Матчу за 3-тє місце — місця 3 і 4."
- **FR-16** (`prd.md` §4.6): "Після зміни/видалення Таблиця групи та (за наявності) Плейоф-сітка перераховуються."
- **AD-5** (`ARCHITECTURE-SPINE.md`): "матчі плейофа (півфінали, фінал, за 3-тє місце) — рядки `Match` зі `stage ≠ GROUP` … `homeEntry/awayEntry` матчу наступного раунду обчислюються з результатів попереднього раунду **доки в самому матчі немає `SetScore`**; після внесення результату пара заморожена й не переобчислюється. Це обчислення виконує лише `domain/bracket.ts` (`advanceBracket`) — і на запис (Server Action), і на відображення (перед рендером сітки); `src/data` і компоненти не виводять учасників самостійно."
- **AD-2** (`ARCHITECTURE-SPINE.md`): "`src/domain/` не імпортує Next, Prisma, `src/data`, `src/actions`. Функції детерміновані, без IO."
- **AD-4** (`ARCHITECTURE-SPINE.md`): "Таблиця групи й фінальні місця **не зберігаються** — обчислюються при кожному читанні. Кеш/матеріалізація заборонені у v1."
- **SPEC Constraints**: "Плейоф — рівно сітка на 4 команди: півфінали 1–4 і 2–3, потім матч за 3-тє місце й фінал. Учасники фіналу й матчу за 3-тє місце заповнюються автоматично після півфіналів і заморожуються після внесення власного результату."
- **PRD §7 Не-цілі / SPEC Non-goals**: "**Не** підтримуємо плейоф іншого розміру, ніж 4 команди."
- **PRD §11 / SPEC Assumptions**: "Матчі Плейофа є одиночними іграми, не серіями."
- **EXPERIENCE.md** (Component Patterns → Bracket): "Пара «очікує суперників» (`bracket-pair-tbd`) доки немає результатів обох півфіналів. Після внесення результату півфіналу відповідна пара фіналу/матчу за 3-тє місце заповнюється при наступному завантаженні." KF-1 §6: "зʼявляється вкладка Плейоф із заповненими півфіналами (1–4, 2–3), фінал і матч за 3-тє місце — «очікує суперників»."

### Notes on AC interpretation

- **One new file, `src/domain/bracket.ts` (+ `bracket.test.ts`). Zero code in any other layer.** This mirrors Story 3.1 exactly: a pure new-file addition, no existing file edited except docs. The function names are fixed by the spine's naming convention (`ARCHITECTURE-SPINE.md` line 122: "доменні функції — `computeStandings`, `seedPlayoff`, `advanceBracket`, `validateMatchScore`") and by the AC — `seedPlayoff` and `advanceBracket`, spelled exactly. The spine's code tree already reserves the slot: `bracket.ts   # seedPlayoff, advanceBracket`.

- **`seedPlayoff` takes `OrderedStandingsRow[]` — the `src/domain/tiebreak.ts` type — not the `src/data` `StandingsView`.** The AC's "готовий `getStandings`" only means the read path exists; `getStandings` itself lives in `src/data` and returns `StandingsView[]` (`= OrderedStandingsRow & { teamName }`). Domain must not import from data (AD-3). `seedPlayoff` consumes the domain half: `OrderedStandingsRow[]`, **already ordered so index 0 = seed 1** — that is `orderStandings`'s contract (`tiebreak.ts`: points → head-to-head mini-table → sets won → name fallback, with `needsManualSeed`). Story 4.2's Server Action will call `getStandings` and hand the array straight to `seedPlayoff` (a `StandingsView[]` is a structural supertype of `OrderedStandingsRow[]` — assignable as-is). Team names are display-only and not needed for seeding.

- **`seedPlayoff` returns the full initial four-match bracket, not just the two semifinals.** The AC names only the semifinals, but EXPERIENCE.md (KF-1 §6, Bracket pattern) requires the final and third-place match to be visible as «очікує суперників» the instant the playoff is formed. Returning one `PlayoffBracket` object — `{ semifinals: [SF1, SF2], thirdPlace, final, needsManualSeed }` with `thirdPlace`/`final` participants `null` and status `"AWAITING"` — gives Story 4.2 a single value to persist and Story 4.6 a single value to render. Whether Story 4.2 persists 2 `Match` rows or 4 is Story 4.2's call; the engine only describes the shape. [decision]

- **Seeding: exactly the top `PLAYOFF_QUALIFIERS` (4) rows. SF1 = seed 1 vs seed 4; SF2 = seed 2 vs seed 3.** Verbatim FR-19 / AC / SPEC CAP-9. `PLAYOFF_QUALIFIERS` is already exported from `tiebreak.ts` with a doc comment that names this story ("Epic 4's `seedPlayoff` consumes the same rule") — import it, do not re-declare `4`. Rows beyond the top 4 are **ignored** (positions 5+ never enter the bracket; their final placement comes from the group table — Story 4.7, out of scope here).

- **Higher seed is `home`.** epics/PRD/UX are silent on the home/away side within a playoff pair. Pick the deterministic rule "the higher seed hosts": SF1 `home` = seed 1, `away` = seed 4; SF2 `home` = seed 2, `away` = seed 3. For the final and third-place match, `home` = the winner/loser coming from **SF1**, `away` = the winner/loser from **SF2** (SF1 feeds the "home" side of both downstream matches). Document this as an arbitrary-but-stable choice, the same way `tiebreak.ts` documents its ascending name collation and `schedule.ts` documents "no home/away swap between cycles". [decision]

- **Fewer than 4 ordered rows → throw `RangeError`.** Structurally impossible in production — `TEAM_COUNT_MIN = 4` (`tournamentForm.ts`) and FR-19 only enables "Сформувати плейоф" once every group match has a result, so a `GROUP_STAGE` tournament always has ≥ 4 seated entries — but fail loud rather than silently seeding a 3-team bracket. (Story 3.1 *deferred* most degenerate-input guards where the caller's guarantee was strong; here the guard is one cheap length check protecting an irreversible downstream write, so it is worth keeping.)

- **`needsManualSeed` propagates to the bracket.** If **any** of the top-4 `OrderedStandingsRow` has `needsManualSeed: true` (i.e. its rank was decided by the team-name fallback, not a sporting result), the returned `PlayoffBracket.needsManualSeed` is `true`. This is the signal that the seed order **at the 1–4 cut-line is provisional** — `deferred-work.md` (3.8 code review) explicitly assigns "the top-4 seed order is not final" to "the playoff-seeding story (4.1/4.2)". The engine only carries the flag; there is **no reseed UI** in v1 (`deferred-work.md`, Story 3.2 note: "nothing in Epic 3/4's stories asks for one"), and the UX docs specify no confirmation dialog before «Сформувати плейоф». Whether Story 4.2 surfaces the flag (e.g. a caption on the button) is Story 4.2's call.

- **`advanceBracket(matches)` is the AD-5 freeze engine, and the *sole* computer of next-round participants.** Input: the current state of the tournament's playoff matches, as a `src/domain`-local array (`PlayoffMatchState[]` — Story 4.2+ maps the persisted `Match` rows into it). Each element carries which of the four bracket slots it is (`"SF1" | "SF2" | "THIRD_PLACE" | "FINAL"`), its currently-stored `home`/`away` participants (nullable), and its `SetScore[]`. Output: a `PlayoffBracket` with the third-place and final participants resolved. Rules, verbatim from AD-5:
  1. A slot whose **own** `PlayoffMatchState` has `sets.length > 0` → **frozen**: its `home`/`away` are returned exactly as stored, never recomputed; status `"PLAYED"`.
  2. A slot with no own sets **and both semifinals resulted** → recompute: `final.home` = SF1 winner, `final.away` = SF2 winner; `thirdPlace.home` = SF1 loser, `thirdPlace.away` = SF2 loser; status `"READY"`.
  3. A slot with no own sets **and either semifinal unresulted** → `home`/`away` = `null`; status `"AWAITING"` (render as `bracket-pair-tbd`).
  4. A semifinal's winner/loser is derived from its `SetScore[]` via the existing `matchSetSummary` primitive (`scoring.ts`) — AD-4, there is no winner column. A semifinal whose set tally is **level or empty** counts as *unresulted* (not an error). `bracket.ts` does **not** re-validate set scores (no completeness / win-by-2 / set-count checks) — that is `validation.ts`'s `validateMatchScore` at result-entry time (Story 4.4), exactly as `scoring.ts` "trusts `sets` already passed `validateMatchScore`". A stored tally is taken at face value and the winner is the majority side, as `computeStandings` does.

- **The "both semifinals" gate is literal (FR-20: "обох").** If only one semifinal has a result, the final and third-place match stay **fully** `AWAITING` (both participants `null`) — never half-filled with just the one known team. [decision, matches FR-20]

- **`advanceBracket` accepts 2, 3, or 4 input matches.** Story 4.2 may persist only the two semifinal `Match` rows at formation and create the final / third-place rows later (Story 4.3), or persist all four up front. `advanceBracket` must handle both: a slot absent from `matches` is synthesized as `AWAITING`/`READY` per rules 2–3; a slot present in `matches` uses its stored state and rules 1–3. It must **not** require the semifinals to be `"SF1"`/`"SF2"` in array order — key off the `slot` field.

- **Once the final is frozen, editing a semifinal can leave the frozen final "wrong" — this is intended.** Example: SF1 = A vs B; A wins; `advanceBracket` puts A in the final; the final is played; then SF1's result is corrected so B won. The final stays A-vs-... (rule 1, frozen). AD-5's whole purpose is to prevent a "застрягла" bracket *and* to not silently rewrite a match that already happened — re-litigating a semifinal after its next round is played does not retro-swap the finalist. The third-place match, if it has no own result yet, **does** re-derive (rule 2). Tests must pin both behaviours (AC 4).

- **`playoffPlacements(matches)` — a third small pure function, added proactively; Story 4.4 consumes it.** FR-21 ("Результат Фіналу визначає місця 1 і 2; Результат Матчу за 3-тє місце — місця 3 і 4") is domain logic, and AD-4 says placements are computed on read, never stored. Putting it in `bracket.ts` now — rather than letting Story 4.4 grow it inside an action or component (an AD-2 risk) — follows the codebase's established pattern of proactively closing a rule class (`teamEnrollment.ts`'s `checkCan*`, `tournamentForm.ts`'s `resolveGroupStageFields`). It returns `{ first, second, third, fourth }` as `entryId | null` — `null` where the deciding match has no result yet. `first` = final winner, `second` = final loser, `third` = third-place winner, `fourth` = third-place loser. Places 5+ (group-table order — Story 4.7) are out of scope. If review judges this over-reach it can be dropped to Story 4.4 without touching `seedPlayoff`/`advanceBracket`.

- **Domain-local `stage` spelling stays identical to the Prisma `MatchStage` enum.** `MatchStage` (`GROUP | SEMIFINAL | THIRD_PLACE | FINAL`) has existed since Story 3.2's migration — **no migration in this story**. `bracket.ts` must not import the generated enum (that is a Prisma-client import, lint-banned in `src/domain`); instead declare a domain-local `BracketStage = "SEMIFINAL" | "THIRD_PLACE" | "FINAL"` union with matching string literals, exactly as `tournamentState.ts` mirrors `TournamentState` with the comment "Must stay identical to the enum in `prisma/schema.prisma`". This lets `src/data` (Story 4.2) map `BracketPair.stage` ↔ `Match.stage` with no lookup table.

- **Two semifinals share `MatchStage.SEMIFINAL` in the DB.** The schema has a single `SEMIFINAL` value. The domain distinguishes them with a `slot: "SF1" | "SF2"` discriminator. Story 4.2 will need a way to tell the two persisted `SEMIFINAL` `Match` rows apart when mapping them back into `PlayoffMatchState` (e.g. by `createdAt` order, or a small schema addition). That is **Story 4.2's problem, not this story's** — but flag it in `deferred-work.md` so 4.2 doesn't rediscover it.

- **Single game, not a series (PRD §11).** Each `BracketPair` is one match; the winner is `matchSetSummary`'s majority. No aggregate/best-of-N logic.

- **No worked bracket examples exist in `prd.md` or `epics.md`.** As in Story 3.1, this story constructs its own fixtures (a 4-entry ordered table; semifinal results; a played final) matching the documented rules — there is nothing to transcribe from source.

## Tasks / Subtasks

- [x] **Task 1 — `src/domain/bracket.ts` (NEW): types + `seedPlayoff`** (AC: 1)
  - [x] Declare the domain-local types (no Prisma imports): `BracketSlot = "SF1" | "SF2" | "THIRD_PLACE" | "FINAL"`, `BracketStage = "SEMIFINAL" | "THIRD_PLACE" | "FINAL"` (comment: keep identical to `prisma/schema.prisma` `MatchStage`), `BracketParticipant = { entryId: string; seed: number | null }`, `BracketPairStatus = "AWAITING" | "READY" | "PLAYED"`, `BracketPair = { slot; stage; home: BracketParticipant | null; away: BracketParticipant | null; status }`, `PlayoffBracket = { semifinals: [BracketPair, BracketPair]; thirdPlace: BracketPair; final: BracketPair; needsManualSeed: boolean }`.
  - [x] `import { PLAYOFF_QUALIFIERS, type OrderedStandingsRow } from "@/domain/tiebreak"` — do not re-declare `4`.
  - [x] `seedPlayoff(standings: OrderedStandingsRow[]): PlayoffBracket` — take the first `PLAYOFF_QUALIFIERS` rows; `SF1` = `{ home: seed 1, away: seed 4 }`, `SF2` = `{ home: seed 2, away: seed 3 }`, each participant `{ entryId: row.row.entryId, seed: 1..4 }`, status `"READY"`; `thirdPlace` + `final` both `{ home: null, away: null, status: "AWAITING" }` with the right `slot`/`stage`; `needsManualSeed` = OR of the top-4 rows' `needsManualSeed`.
  - [x] Guard: `standings.length < PLAYOFF_QUALIFIERS` → `throw new RangeError("seedPlayoff: need at least 4 ordered standings rows")`.
  - [x] Doc comment: cite FR-19 + AD-5; note it consumes `orderStandings`'s ordering (index 0 = seed 1) and `PLAYOFF_QUALIFIERS`; note the "higher seed hosts" choice.
  - [x] `pnpm typecheck` / `pnpm lint` clean (no `next`/Prisma/`react`/other-layer import).

- [x] **Task 2 — `src/domain/bracket.ts`: `advanceBracket` + `playoffPlacements`** (AC: 2, 3)
  - [x] `PlayoffMatchState = { slot: BracketSlot; home: BracketParticipant | null; away: BracketParticipant | null; sets: SetScore[] }` (`SetScore` from `@/domain/scoring`).
  - [x] Private helper `matchOutcome(match): { winner: BracketParticipant; loser: BracketParticipant } | null` — uses `matchSetSummary(match.sets)`; `null` when `sets` empty, tally level, or a participant missing. (Named `matchOutcome`, not `semifinalOutcome` — reused by `playoffPlacements`.)
  - [x] `advanceBracket(matches: PlayoffMatchState[]): PlayoffBracket` — resolve by `slot`:
    - semifinals pass through from `matches` (participants as stored; status `"PLAYED"` if `sets.length > 0`, else `"READY"`).
    - `thirdPlace` / `final`: if the slot's own match in `matches` has `sets.length > 0` → return its stored `home`/`away` unchanged, status `"PLAYED"` (**freeze**, AD-5 rule 1). Else if **both** `SF1` and `SF2` have a non-`null` `matchOutcome` → `final = { home: SF1.winner, away: SF2.winner }`, `thirdPlace = { home: SF1.loser, away: SF2.loser }`, status `"READY"`. Else → `home`/`away` `null`, status `"AWAITING"`.
    - `advanceBracket` always returns `needsManualSeed: false` — the seed-time flag is `seedPlayoff`'s output; documented in the `PlayoffBracket` doc comment.
  - [x] Handle 2–4 input matches: a slot absent from `matches` is synthesized per the rules above; key off `slot` via an `indexBySlot` map, never array order.
  - [x] `playoffPlacements(matches: PlayoffMatchState[]): PlayoffPlacements` — FR-21: from the `FINAL` match's `matchOutcome`, `first` = winner `entryId`, `second` = loser; from `THIRD_PLACE`, `third` = winner, `fourth` = loser; `null` where that match has no usable result.
  - [x] Doc comments cite AD-5 (freeze), FR-20, FR-21, AD-4 (never stored).
  - [x] `pnpm typecheck` / `pnpm lint` clean.

- [x] **Task 3 — `src/domain/bracket.test.ts` (NEW)** (AC: 3, 4)
  - [x] Vitest conventions: `import { describe, expect, it } from "vitest";` then `./bracket`, `type SetScore` from `./scoring`, `type OrderedStandingsRow` from `./tiebreak`. Local fixture helpers: `sets(...pairs)`, `orderedRow(entryId, needsManualSeed?)`, `HOME_WIN` / `AWAY_WIN` set fixtures, `playedSemifinals(sf1Sets, sf2Sets)`. No mocks.
  - [x] `describe("seedPlayoff")` — 8 cases: pairings + hosting; final/third `AWAITING`; rows past top-4 ignored; exactly-4 works; `< 4` throws `RangeError`; `needsManualSeed` propagates from a top-4 row, ignores a row outside the top-4, `false` on a clean table.
  - [x] `describe("advanceBracket")` — 9 cases: both semifinals → final/third `READY`; one semifinal → both fully `AWAITING`; level/empty tally → unresulted; **semifinal changed before the final is played → re-derives** (AC 4); **semifinal changed after the final is played → final frozen, third-place still re-derives** (AC 4); third-place with own result → frozen; semifinals-only input synthesises downstream; arbitrary input order → identical; `needsManualSeed` reported `false`.
  - [x] `describe("playoffPlacements")` — 3 cases: full bracket → 1–4 from final + third-place; missing deciding match → `null`; empty input → all `null`.
  - [x] Run `pnpm test` — **155/155** (baseline 135, +20).

- [x] **Task 4 — Docs**
  - [x] `src/domain/README.md` — new `bracket.ts` bullet (`seedPlayoff` top-4 / SF1 1v4 / SF2 2v3 / higher seed home / `needsManualSeed` / `RangeError`; `advanceBracket` AD-5 freeze + both-semifinals gate + `AWAITING`/`READY`/`PLAYED`; `playoffPlacements` FR-21 proactive); intro line updated.
  - [x] `AGENTS.md` — Stack-status bullet for Story 4.1.
  - [x] `deferred-work.md` — 3.8-review "top-4 provisional" item marked engine-half-addressed; NEW section "Story 4.1 implementation" with the SEMIFINAL discriminator, the `advanceBracket` call-site, `playoffPlacements` unused, `needsManualSeed: false`, and no-persistence items.

- [x] **Task 5 — Verification gate** (AC: all)
  - [x] `pnpm build` (routes unchanged) → `pnpm typecheck` (clean) → `pnpm lint` (clean) → `pnpm test` (**155/155**).
  - [x] Import-boundary check: `bracket.ts` imports only `@/domain/scoring` + `@/domain/tiebreak`; `bracket.test.ts` only `vitest` + `./bracket` + `./scoring` + `./tiebreak`. `pnpm lint`'s `src/domain/**` block enforces it.
  - [x] **No verify script** — nothing touches the database. No browser walkthrough — no surface yet.
  - [x] `git diff HEAD -- prisma/schema.prisma src/domain/tournamentState.ts` is empty — both untouched.
  - [x] Command output recorded in the Dev Agent Record.

- [x] **Task 6 — Commit(s)** — `feat(domain): playoff bracket engine …` (Tasks 1–3) + `docs: …` (Tasks 4–5), each `git push origin main`, `build`/`typecheck`/`lint`/`test` gated.

## Dev Notes

### What this story is / is NOT

**Is:** two pure functions (`seedPlayoff`, `advanceBracket`) plus a small proactive `playoffPlacements`, all in a single new `src/domain/bracket.ts`, with exhaustive deterministic Vitest coverage. `seedPlayoff` maps the ordered group table to the fixed 4-team bracket (SF1 = 1v4, SF2 = 2v3); `advanceBracket` resolves the final and third-place participants from the semifinal results and **freezes** any pairing whose own match already has a `SetScore` (AD-5). No IO, no framework, no Prisma types.

**Is NOT** (do not pull forward):
- **Any schema change or migration.** `MatchStage` (`GROUP | SEMIFINAL | THIRD_PLACE | FINAL`) and the nullable `Match.homeEntryId`/`awayEntryId` already exist from Story 3.2 — created for exactly this purpose.
- **`Match`-row creation / persistence.** Forming the playoff (`SEMIFINAL` rows, `state → PLAYOFF`) is **Story 4.2**; auto-creating the `FINAL` / `THIRD_PLACE` rows is **Story 4.3**.
- **Server Actions.** No `src/actions/playoff`. The `advanceBracket`-on-write and `advanceBracket`-on-render call sites are Stories 4.2 / 4.3 / 4.6.
- **State-machine wiring.** `tournamentState.ts`'s `PLAYOFF` / `COMPLETED` predicates stay fail-closed stubs (`ctx.allGroupMatchesPlayed`, `ctx.finalAndThirdPlacePlayed`). Story 4.2 wires the first; Story 4.5 the second.
- **The Bracket component / «Плейоф» tab content.** Story 4.6. The tab is already hidden until `PLAYOFF`+ (Story 3.8's `tournament-tabs.tsx`).
- **`getStandings` changes.** It already returns everything `seedPlayoff` needs (`OrderedStandingsRow` fields).
- **A manual-reseed UI.** `needsManualSeed` is a read-only flag here; no reseed screen is in any Epic 4 AC.
- **Places 5+ / the archive.** Story 4.7 (`playoffPlacements` covers 1–4 only).
- **Multi-group seeding.** v1 has exactly one `Group` (FR-4 / AD-9); multi-group playoff distribution is PRD Open Question #1, explicitly deferred.
- **BEACH / Cup (knockout) formats.** Enum values exist without logic (AD-9); not this story.

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/domain/bracket.ts` | NEW | `seedPlayoff`, `advanceBracket`, `playoffPlacements` + the `Bracket*` / `PlayoffBracket` / `PlayoffMatchState` types. |
| `src/domain/bracket.test.ts` | NEW | Vitest — the entire correctness gate for this story. |
| `src/domain/README.md` | UPDATE | `bracket.ts` module entry; intro line. |
| `AGENTS.md` | UPDATE | Stack-status bullet for Story 4.1. |
| `_bmad-output/implementation-artifacts/deferred-work.md` | UPDATE | 1 item addressed, 4 new. |
| `prisma/schema.prisma` | DO NOT TOUCH | `MatchStage` + nullable playoff entries already landed (Story 3.2); placements never stored (AD-4). |
| `src/domain/tournamentState.ts` | DO NOT TOUCH | `PLAYOFF` / `COMPLETED` stubs stay — Stories 4.2 / 4.5 wire them. |
| `src/data/**`, `src/actions/**`, `src/components/**` | DO NOT TOUCH | No persistence, action, or UI in this story. |

### Architecture compliance

- **AD-2** — `bracket.ts` is pure: deterministic `(input) → output`, no `next` / Prisma / `react` / `src/data` / `src/actions` imports, no IO, no `Date.now`, no randomness. [ARCHITECTURE-SPINE.md#AD-2]
- **AD-3** — `bracket.ts` imports only other `src/domain` modules (`tiebreak`, `scoring`). No layer depends on it yet. [ARCHITECTURE-SPINE.md#AD-3]
- **AD-4** — the bracket and final placements are a pure function of match results, recomputed on read, never stored; `computeStandings` / `orderStandings` (upstream) and `advanceBracket` / `playoffPlacements` (here) all follow the same "compute, don't persist" rule. [ARCHITECTURE-SPINE.md#AD-4, PRD NFR-3]
- **AD-5** — `advanceBracket` is the single implementation of next-round participant derivation; the freeze-after-own-`SetScore` rule is its core. Call sites (write + render) are later stories. [ARCHITECTURE-SPINE.md#AD-5]
- **AD-9** — `MatchStage` knockout values are used as domain-local string unions only; v1 logic stays CLASSIC / single-group. [ARCHITECTURE-SPINE.md#AD-9]
- **Naming** — `seedPlayoff`, `advanceBracket` exactly, per the spine's Consistency Conventions table. [ARCHITECTURE-SPINE.md#Consistency]
- **Testing** — `bracket` is on the spine's mandatory-unit-test list ("scoring, tiebreak, bracket, validation"); deterministic, no mocks. [ARCHITECTURE-SPINE.md#Тести, epics.md line 75]

### Testing requirements

- **`pnpm test` is the entire correctness gate.** One new domain file, zero UI / data / action surface — as in Story 3.1, there is no verify script and no browser walkthrough (nothing is wired to a call site yet). SM-2's target is **0** manual bracket corrections, so every rule in "Notes on AC interpretation" needs at least one test case.
- **The AC's named case is non-negotiable:** a semifinal result changes, and `advanceBracket` is asserted **twice** — once while the final has no `SetScore` (participants re-derive) and once after the final has been played (participants frozen). Both in `bracket.test.ts`.
- **Vitest setup is already there** (`vitest.config.mts`, `environment: node`, `src/**/*.test.ts`). No new dev dependency.
- **No regression risk** — pure new-file addition, zero edits to any existing `.ts` (only `README.md` / `AGENTS.md` / `deferred-work.md`). Re-run the full `pnpm test` to confirm the prior 135 still pass.

### Project Structure Notes

- `src/domain/bracket.ts` is the exact path reserved in `ARCHITECTURE-SPINE.md`'s Structural Seed (line 184) and named in `src/domain/README.md`'s intro. No structural variance.
- The `bracket.ts` ↔ `MatchStage` string-literal alignment mirrors the existing `tournamentState.ts` ↔ `TournamentState` convention (domain-local union kept identical to a Prisma enum, by comment not by import). Consistent, not a new pattern.
- `OrderedStandingsRow` flows `tiebreak.ts` → `bracket.ts` (domain → domain, allowed). `getStandings` (`src/data`) already returns a structural supertype, so Story 4.2's `data → domain` value-call needs no adapter.

### Previous story intelligence

- **Story 3.1 (done, code-reviewed)** is the direct precedent — the only other "pure `src/domain` engine, nothing else" story. It shipped 4 modules, 99 tests at first green / 103 after review. Its review found two real bugs from *insufficiently adversarial fixtures* (a circle-method anchor always "home"; an index-vs-`setNo` mismatch in `validateMatchScore`) — both cases where the tests normalised away the thing under test. **Lesson for 4.1:** do not let `bracket.test.ts` assert only on sorted/normalised participant sets — assert on the concrete `home`/`away` sides and the exact `status`, and test the freeze rule by *mutating a result and re-calling*, not just by constructing the frozen state directly.
- **Story 3.2 (done)** made `Match.homeEntryId`/`awayEntryId` nullable **specifically for this story** and left a schema comment saying so — do not "fix" them to `NOT NULL`, and do not add a migration. `SetScore` is the only result store (no winner column) — `advanceBracket` must derive winners from `sets`.
- **Story 3.8 (done, code-reviewed)** added `PLAYOFF_QUALIFIERS = 4` to `tiebreak.ts` with a comment naming `seedPlayoff`. Import it. Its review deferred "top-4 order shown as definitive" to 4.1/4.2 — `PlayoffBracket.needsManualSeed` is the engine's half of that.
- **Pattern for pure predicate/among-domain helpers:** `redraw.ts` `checkCanRedraw`, `teamEnrollment.ts` `checkCan*` — discriminated result objects, state checked first, dual-use (action + view), unit-tested. `playoffPlacements` follows the same "proactively give the rule a home in `src/domain`" instinct those embody.

### Git intelligence

Recent: `914c875` (Story 3.8 review-fix, done) ← `531e695` ← `e904141` (Story 3.8) ← the 3.7 / 3.6 chain. Epic 3 is fully `done`; `epic-4` is now `in-progress` in `sprint-status.yaml`. `src/domain/` currently holds `scoring / tiebreak / schedule / validation / tournamentState / tournamentForm / teamForm / teamEnrollment / playerForm / matchSchedule / redraw` (+ a `.test.ts` each) and `README.md`. `bracket.ts` does not exist yet. `prisma/schema.prisma` already has `MatchStage` and nullable `Match` entries (migrations `20260905125839` / `20260905161412`). No playoff `Match` row is created anywhere in the repo — schema supports it, no writer exists.

### Latest tech information

- **No new library.** Plain TypeScript + Vitest, the same `vitest.config.mts` (`environment: node`). `bracket.ts` has at most two imports, both `@/domain/*`.
- **Next 16 / Prisma 7** — irrelevant to this story; nothing here touches a route, a Server Action, or the client.
- **No `.next/types` regen needed** — no new route.

### Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 4.1 AC, Epic 4 framing, FR-19/20/21 coverage map), `prd.md` §4.8 (FR-19/20/21) + §7 (non-goals) + §11 (single games), `ARCHITECTURE-SPINE.md` (AD-2/AD-3/AD-4/AD-5/AD-9, Consistency Conventions, Structural Seed, Capability Map), `SPEC.md` (CAP-9, Constraints, Non-goals, Assumptions, Open Questions), `EXPERIENCE.md` (Bracket pattern, KF-1, IA — «Плейоф» tab appears in `PLAYOFF`+, `bracket-pair-tbd` state), `DESIGN.md` (Bracket pair / Bracket pair tbd tokens), `3-1-…md` (the pure-engine story template + its review lessons), `3-2-group-stage-schema.md` (`MatchStage`, nullable playoff entries, `SetScore` as sole result store), `3-8-public-standings-table.md` (`PLAYOFF_QUALIFIERS`, `needsManualSeed`, tab visibility), `deferred-work.md` (the 3.8/3.7/3.2 items this story's engine addresses or hands forward).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1: Чистий двигун — сітка плейофа] — user story + 4 AC lines; AD-2 / AD-5 refs
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4: Плейоф і річний архів] — "Перша історія — чистий двигун: `src/domain/bracket.ts` (`seedPlayoff`, `advanceBracket`)"; FR coverage map (FR-20 → Story 4.1, 4.3); line 75 (bracket on the mandatory-test list)
- [Source: _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md#4.8] — FR-19 (seed = group position, top 4, SF 1v4 / 2v3), FR-20 (auto final + third-place, "очікує суперників", recompute on semifinal edit), FR-21 (final → places 1–2, third-place → places 3–4); §4.6 FR-16 (bracket recomputes on result edit)
- [Source: _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md#7] · [#11] — no playoff size other than 4; playoff matches are single games
- [Source: …/ARCHITECTURE-SPINE.md#AD-5] — playoff persisted; next-round pairs derived by `domain/bracket.ts` only, on write and render, frozen after own `SetScore`
- [Source: …/ARCHITECTURE-SPINE.md#AD-2] · [#AD-3] · [#AD-4] · [#AD-9] · [#Consistency Conventions] · [#Structural Seed] — pure-core boundary; dependency direction; compute-don't-store; enum leaves room for knockout; `seedPlayoff`/`advanceBracket` naming; `bracket.ts` slot in the tree
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#CAP-9] · [#Constraints] · [#Non-goals] · [#Assumptions] · [#Open Questions] — 4-team bracket exactly; auto-fill + freeze; places 5+ from group table; multi-group deferred
- [Source: …/ux-designs/…/EXPERIENCE.md#Component Patterns — Bracket] · [#Key Flows — KF-1] · [#Information Architecture] — `bracket-pair-tbd` until both semifinals resulted; «Плейоф» tab appears in `PLAYOFF`+; final + third-place shown "очікує суперників" at formation
- [Source: …/ux-designs/…/DESIGN.md#Components — Bracket pair] — `bracket-pair` vs `bracket-pair-tbd` (dashed) — the engine's `status` field feeds this
- [Source: _bmad-output/implementation-artifacts/3-1-domain-engine-scoring-tiebreak-schedule-validation.md] — pure-engine story structure; Notes-on-AC-interpretation style; review lessons (adversarial fixtures)
- [Source: _bmad-output/implementation-artifacts/3-2-group-stage-schema.md] — `MatchStage`, nullable `Match` playoff entries (created for Epic 4), `SetScore` sole result store
- [Source: _bmad-output/implementation-artifacts/3-8-public-standings-table.md] — `PLAYOFF_QUALIFIERS`, `needsManualSeed`, «Плейоф» tab gating
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — "top-4 seed order not final" → 4.1/4.2; nullable `Match` entries rationale; "nothing asks for a reseed UI"

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (bmad-dev-story)

### Debug Log References

- `bracket.test.ts` first run: one failing assertion (`freezes the final …`) — my test expectation for the re-deriving third-place match named the wrong entry (`t4` instead of the corrected SF1 loser `t1`); the implementation was correct. Fixed the expectation. Second run: 155/155.

### Completion Notes List

- Task 1: `src/domain/bracket.ts` — domain-local types (`BracketSlot`, `BracketStage` kept identical to the Prisma `MatchStage` spelling by comment, `BracketParticipant`, `BracketPairStatus`, `BracketPair`, `PlayoffBracket`). `seedPlayoff(standings)` takes the top `PLAYOFF_QUALIFIERS` rows (imported from `tiebreak.ts`, not re-declared), pairs `SF1` = seed 1 (home) v seed 4, `SF2` = seed 2 (home) v seed 3, both `READY`; `thirdPlace`/`final` come back `AWAITING` with `null` participants; `needsManualSeed` = OR over the top-4 rows. Guards `< PLAYOFF_QUALIFIERS` with a `RangeError`.
- Task 2: `advanceBracket(matches)` — indexes the input by `slot`, passes the semifinals through (`PLAYED` when they carry sets, else `READY`), and for the final / third-place match applies AD-5: a slot whose own match has sets is frozen and returned as stored; otherwise, once both semifinals have a `matchOutcome`, the final gets the two winners and the third-place match the two losers (`READY`); otherwise `AWAITING`. Accepts 2–4 matches. `matchOutcome` derives winner/loser from `matchSetSummary` (no winner column — AD-4); a level or empty tally counts as no result. `playoffPlacements(matches)` maps the final → places 1/2 and the third-place match → places 3/4, `null` where undecided. `advanceBracket` returns `needsManualSeed: false` (seed-time flag, `seedPlayoff`'s job).
- Task 3: `bracket.test.ts` — 20 cases across the three functions, asserting concrete `home`/`away` sides and exact `status` (not normalised sets), and exercising the freeze rule by mutating a result and re-calling `advanceBracket` (the Story 3.1 review lesson). `pnpm test` 155/155.
- `pnpm typecheck` / `pnpm lint` clean. `bracket.ts` imports only `@/domain/scoring` and `@/domain/tiebreak`. No existing `.ts` touched.

### File List

- `src/domain/bracket.ts` (NEW)
- `src/domain/bracket.test.ts` (NEW)
- `src/domain/README.md` (UPDATE)
- `AGENTS.md` (UPDATE)
- `_bmad-output/implementation-artifacts/deferred-work.md` (UPDATE)

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-07 | Story drafted (`bmad-create-story`, 4 research subagents: epics / architecture+PRD+SPEC / UX / 3.1-precedent+`src/domain`). Status: ready-for-dev. |
| 2026-09-07 | Implementation complete (`bmad-dev-story`) — all 6 tasks. `src/domain/bracket.ts` (`seedPlayoff` / `advanceBracket` / `playoffPlacements`) + `bracket.test.ts` (20 cases). `pnpm build`/`typecheck`/`lint` clean, `pnpm test` 155/155 (+20). No schema / action / UI / route change; `MatchStage` enum and the `PLAYOFF`/`COMPLETED` transition stubs untouched. Status: review. |
