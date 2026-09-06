---
baseline_commit: 83fb8f5
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/implementation-artifacts/4-1-domain-engine-bracket.md
  - _bmad-output/implementation-artifacts/4-2-generate-playoff.md
  - _bmad-output/implementation-artifacts/4-3-auto-advance-final-third-place.md
  - _bmad-output/implementation-artifacts/3-6-enter-match-result.md
  - _bmad-output/implementation-artifacts/3-7-edit-delete-result.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - AGENTS.md
---

# Story 4.4: Результати плейофа й фінальні місця

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an адмін,
I want вносити результати матчів плейофа і бачити фінальні місця 1–4,
so that місця 1–4 визначаються результатами фіналу й матчу за 3-тє місце (FR-21), і виправлення півфіналу не може поставити команду одразу на два місця (FR-16).

## Acceptance Criteria

Translated from `epics.md` → Epic 4 → Story 4.4. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** матч плейофа з відомими суперниками, стан `PLAYOFF`
**When** адмін вносить результат так само, як груповий (Story 3.6 механізм — уже ввімкнено для плейофа в Story 4.3)
**Then** результат Фіналу визначає місця 1 і 2
**And** результат Матчу за 3-тє місце визначає місця 3 і 4
**And** доки відповідний вирішальний матч не зіграно, місце `null` (не показується як визначене)

**Given** зіграно Фінал або Матч за 3-тє місце (downstream-матч має власний `SetScore`)
**When** адмін намагається виправити або видалити результат півфіналу
**Then** дія заблокована з поясненням (правка створила б суперечність — «команда у двох місцях»)
**And** доки жоден downstream-матч не зіграно, правка/видалення результату півфіналу лишається дозволеною (FR-20: оновлює пари)

FR / AD / SPEC anchors (in context):

- **FR-21** (`prd.md` §4.8): «Адмін вносить Результати Матчів Плейофа так само, як групових (FR-15). **Наслідки (перевірювані):** — Результат Фіналу визначає місця 1 і 2; Результат Матчу за 3-тє місце — місця 3 і 4. — Плейоф-сітка з усіма парами й рахунками доступна Глядачу без входу.» _(Публічна сітка — Story 4.6; ця історія не рендерить публічне.)_
- **FR-16** (`prd.md` §4.6): «Адмін змінює чи видаляє раніше внесений Результат; після зміни/видалення перераховуються Таблиця групи та (за наявності) Плейоф-сітка; видалення повертає Матч у стан «не зіграно».» — FR-16 буквально не має винятку «крім випадку зіграного наступного матчу». Гейт правки півфіналу — це **інваріантна вимога AD-5 / SPEC (заморожування)**, а не буквальний перевірюваний наслідок FR-16. Історія свідомо вводить це обмеження — обґрунтування нижче.
- **AD-5** (`ARCHITECTURE-SPINE.md`): «`homeEntry/awayEntry` матчу наступного раунду обчислюються з результатів попереднього раунду **доки в самому матчі немає `SetScore`**; після внесення результату пара заморожена й не переобчислюється. Це обчислення виконує лише `domain/bracket.ts` (`advanceBracket`).»
- **AD-4** (`ARCHITECTURE-SPINE.md`): «Таблиця групи й **фінальні місця** не зберігаються — обчислюються при кожному читанні.» — жодної колонки місця/переможця в `Match`/`Group`, ніколи.
- **SPEC Constraints** (`SPEC.md`): «Учасники фіналу й матчу за 3-тє місце заповнюються автоматично після півфіналів і **заморожуються після внесення власного результату**.» **NFR-3**: «неможливий стан, коли таблиця не відповідає внесеним результатам.»
- **AD-2 / AD-3 / AD-6 / AD-11**: derivation only in `src/domain/bracket.ts`; every write via a Server Action, first line `await requireAdmin()`; every read/write via a named `src/data` function; Prisma only in `src/data`.
- **EXPERIENCE.md** (State Patterns): дію, недоступну зараз, показуємо як **видиму, але неактивну кнопку + муніципальний підпис-причину** («Кнопка «Сформувати плейоф» неактивна + підпис «доступно коли всі матчі груп зіграно»»), а не ховаємо. Повне зникнення кнопок редагування — лише в стані `COMPLETED` (Story 4.5). §Accessibility Floor: «Стан («зіграно», «завершено», **позиція плейоф**) ніколи не передається лише кольором.»

### Notes on AC interpretation

- **Story 4.4 was re-scoped during Story 4.3 — read this first.** `epics.md` still describes Story 4.4 as «вносити результати матчів плейофа». **That work is already done.** Story 4.3 (`4-3-auto-advance-final-third-place.md#Notes`, `deferred-work.md` §"Story 4.3 implementation") un-scoped `createMatchResult` / `replaceMatchResult` / `deleteMatchResult` / `updateMatchSchedule` (`src/data/matches.ts`) and `enterMatchResult` / `editMatchResult` / `removeMatchResult` (`src/actions/matches.ts`) and the match screen (`/admin/tournaments/[id]/matches/[matchId]/page.tsx`) from `stage: "GROUP"` for **all** playoff stages, and wired `advanceBracket` on write (`savePlayoffAdvancement`) and read (`getPlayoffBracket`). **Entering a playoff result already works end to end.** Story 4.4 is exactly two remaining pieces:
  1. **Final placements 1–4** — wire `playoffPlacements` (`src/domain/bracket.ts`, Story 4.1, 161 Vitest, currently **unused**) into the read path and show places 1–4 on the **admin** surface.
  2. **The edit-gate** — block editing/deleting a **semifinal** result once a downstream playoff match (`FINAL` or `THIRD_PLACE`) has its own `SetScore` (the "team in two places" hazard — `deferred-work.md`, 4.1 review + 4.3 Notes). This ambiguity («4.4 or 4.5») is now **settled as 4.4**.

- **No new `src/domain` module, no migration, no new route.** `playoffPlacements` exists. `Match.slot` + nullable entries + `match_slot_stage_check` (per-stage) all exist (Stories 3.2 / 4.2 / 4.3). The result-entry route exists. Story 4.4 = **one new pure predicate in `bracket.ts` + data-layer wiring + one action guard + one admin surface + docs + a verify-script extension.**

- **Placements display surface — decided: admin only.** `epics.md` / PRD / EXPERIENCE / DESIGN define **no** dedicated «місця 1–4» panel for Story 4.4. Places 1–4 are shown in the public archive (**Story 4.7** / FR-23 / CAP-10) and read implicitly from the public bracket scores (**Story 4.6** / FR-22). Story 4.4's AC says the results *«визначають»* (determine) the places — a **computation** requirement, not a public-render one. Per the user's decision, Story 4.4 renders places 1–4 **only in the admin «Плейоф» section of the schedule page** (`/admin/tournaments/[id]/schedule`) — the surface an admin looks at right before pressing «Завершити турнір» (Story 4.5). **The public «Плейоф» tab stays the one-line placeholder** (`src/app/classic/[tournament]/page.tsx`) — Story 4.6 owns it. `/archive` — Story 4.7.

- **`playoffPlacements` wiring — fold into `getPlayoffBracket`.** `getPlayoffBracket` (`src/data/playoff.ts`, Story 4.3) already: reads the up-to-four playoff `Match` rows via `readPlayoffRows`, maps them with `toMatchState`, builds a `teamNames: Map<entryId, string>`, and runs `advanceBracket`. Add a `placements` field to `PlayoffBracketView`:
  ```ts
  export interface PlayoffPlacementView {
    entryId: string;
    teamName: string;
  }
  export interface PlayoffPlacementsView {
    first: PlayoffPlacementView | null;
    second: PlayoffPlacementView | null;
    third: PlayoffPlacementView | null;
    fourth: PlayoffPlacementView | null;
  }
  // PlayoffBracketView gains:  placements: PlayoffPlacementsView;
  ```
  Computed as `playoffPlacements(rows.map(toMatchState))` (returns `{ first, second, third, fourth: string | null }` entryIds), each non-null entryId resolved through the **same `teamNames` map** — **zero new query**. A `null` placement stays `null` (its deciding match has no usable result yet). `getPlayoffBracket` is documented as "the shared read for this story's admin schedule section and Story 4.6's public bracket" — keeping placements there means 4.6 / 4.7 reuse it. `needsManualSeed` still comes back `false` (unchanged; not this story's concern — Story 4.6).

- **The edit-gate — a new pure predicate `checkCanEditSemifinalResult` in `src/domain/bracket.ts`.** Mirror `checkCanRedraw` (`src/domain/redraw.ts`) exactly — pure, no framework, returns a ready-to-show Ukrainian message:
  ```ts
  export type PlayoffResultEditCheck = { ok: true } | { ok: false; message: string };

  /**
   * Whether a SEMIFINAL result may still be corrected or removed. Blocked once
   * the final OR the third-place match has its own recorded set: the final is
   * frozen (AD-5) but the third-place match would re-derive from the corrected
   * semifinal (or vice versa), which can place one team in two final positions
   * (FR-16 / the "team in two places" hazard).
   */
  export function checkCanEditSemifinalResult(matches: PlayoffMatchState[]): PlayoffResultEditCheck {
    const downstreamPlayed = matches.some(
      (m) => (m.slot === "FINAL" || m.slot === "THIRD_PLACE") && m.sets.length > 0,
    );
    if (downstreamPlayed) {
      return {
        ok: false,
        message:
          "Виправлення недоступне: результат наступного матчу плейофа вже внесено. Спершу приберіть його.",
      };
    }
    return { ok: true };
  }
  ```
  Notes:
  - **Do not use `indexBySlot`** here — a plain `.some(...)` over `slot` is duplicate-slot-safe and needs no `try/catch` (`indexBySlot` throws on a duplicate slot; the `@@unique([tournamentId, slot])` gap is `deferred-work.md`, not this story).
  - The predicate is **slot-agnostic** (takes the whole `PlayoffMatchState[]`, not the edited match's slot) — the caller gates on `match.stage === "SEMIFINAL"` first, so the predicate only ever runs for a semifinal edit. This keeps it independent of `getMatchForResult` (which returns `stage` but **not `slot`** — do not widen that select for this).
  - Message must **not** start with `"Партія N: "` — `parseAndValidate` (`src/actions/matches.ts`) maps that prefix to `setErrors[N]`. Plain sentence only.

- **Exact gate rule (traced against `advanceBracket`'s freeze logic — `src/domain/bracket.ts`):**

  | Editing / deleting… | when… | Gate? |
  | --- | --- | --- |
  | `SEMIFINAL` (SF1 / SF2) result | `FINAL` has a `SetScore` | **BLOCK** — final frozen on the old winner, but `THIRD_PLACE` re-derives losers from the corrected SF → a frozen finalist can also land 3rd. |
  | `SEMIFINAL` result | `THIRD_PLACE` has a `SetScore` | **BLOCK** — symmetric: third-place frozen, `FINAL` still re-derives winners. |
  | `SEMIFINAL` result | neither downstream has a `SetScore` | **ALLOW** — `advanceBracket` re-derives both downstream pairings cleanly (FR-20; `bracket.test.ts` already covers this). |
  | `FINAL` result | anything | **ALLOW** — nothing downstream of the final in a 4-team bracket; affects only places 1–2. |
  | `THIRD_PLACE` result | anything | **ALLOW** — independent; affects only places 3–4. |
  | `GROUP` result | anything | **ALLOW** — not this gate. A group-result edit during `PLAYOFF` only changes `getStandings` (group table / places 5+) — it never re-seeds the bracket (`seedPlayoff` is called only by `savePlayoffFormation` at formation; `getPlayoffBracket` / `savePlayoffAdvancement` use `advanceBracket` only). The `COMPLETED` blanket result-lock is Story 4.5 / FR-7. |

  Net: **block iff `match.stage === "SEMIFINAL"` AND (`FINAL` row has a `SetScore` OR `THIRD_PLACE` row has a `SetScore`)**.

- **The data read the gate needs — a lean `readPlayoffMatchStates` in `src/data/playoff.ts`.** `getMatchForResult` returns only the one match — no visibility into sibling playoff results. Export:
  ```ts
  /** The playoff matches as PlayoffMatchState[] — the input the bracket engine + edit-gate take. Flat select (no relations). */
  export async function readPlayoffMatchStates(tournamentId: string): Promise<PlayoffMatchState[]> {
    const rows = await db.match.findMany({
      where: { tournamentId, stage: { in: [...PLAYOFF_STAGES] } },
      select: {
        slot: true,
        homeEntryId: true,
        awayEntryId: true,
        sets: { select: { setNo: true, homePoints: true, awayPoints: true }, orderBy: { setNo: "asc" } },
      },
    });
    return rows.map((row) => ({
      slot: row.slot!,
      home: row.homeEntryId ? { entryId: row.homeEntryId, seed: null } : null,
      away: row.awayEntryId ? { entryId: row.awayEntryId, seed: null } : null,
      sets: row.sets,
    }));
  }
  ```
  Flat select (not the nested-relation `readPlayoffRows`) — the gate needs no names, and this matches `savePlayoffAdvancement`'s flat-query style. It is a **plain action-level read, not inside a transaction** → the `pg` "client already executing a query" warning (`deferred-work.md`) does not apply. Do **not** call this inside `savePlayoffAdvancement`'s transaction.

  _(Alternative the dev may pick if it reads cleaner: reuse `readPlayoffRows` + `toMatchState` — both already private in `playoff.ts` — and export a thin wrapper. Either is fine; the flat helper is preferred for cost.)_

- **Wiring the gate into `src/actions/matches.ts`.** In **`editMatchResult`** and **`removeMatchResult`**, after the `getMatchForResult` null-check (and, for `editMatchResult`, after the `match.sets.length === 0` check), before the write:
  ```ts
  if (match.stage === "SEMIFINAL") {
    const gate = checkCanEditSemifinalResult(await readPlayoffMatchStates(tournamentId));
    if (!gate.ok) {
      // editMatchResult:
      return { formError: gate.message };
      // removeMatchResult:
      return { ok: false, code: "PRECONDITION_FAILED", message: gate.message };
    }
  }
  ```
  - `PRECONDITION_FAILED` is the established `ActionErrorCode` for a `checkCanX` failure (`formPlayoff`, `enrollTeam`, `removeTeamEntry`) — **no new code**.
  - `removeMatchResult` currently deletes *then* calls `advancePlayoffAfterSemifinal`. The gate check must be **before `deleteMatchResult`** (insert right after the `!match` check).
  - **`enterMatchResult` stays UNGATED.** First-entry only (`match.sets.length > 0 → formError`); a semifinal entered for the first time cannot have a played downstream (downstream rows only become `READY` after *both* semifinals are resulted, and can't be `PLAYED` before being created). The hazard is strictly about *correcting* a semifinal. `deferred-work.md` phrases it as "gate a semifinal-result **edit**". [decision — noted; applying the same guard to `enterMatchResult` would be harmless but is unnecessary and adds a read to the common path.]
  - `parseAndValidate` / `revalidateMatchSurfaces` / the `requireAdmin` narrow-catch / `advancePlayoffAfterSemifinal` — all unchanged.
  - **TOCTOU:** the gate is check-then-act (read playoff state → predicate → `replaceMatchResult` / `deleteMatchResult`). A downstream result landing in the sub-second window slips past — the same accepted 2–5-admin-scale race class as every other `checkCanX` in the repo (`checkCanRedraw`, `checkCanEnroll`). **Do not** build a transactional guard for it. _(If the dev wants the cheap tightening: `readPlayoffMatchStates` could take an optional `Prisma.TransactionClient` and be re-checked inside `replaceMatchResult` / `deleteMatchResult`'s existing transaction — the `hasAnyGroupResult` pattern. Optional, not required.)_

- **Admin surface — places 1–4 in the «Плейоф» section (`src/app/admin/tournaments/[id]/schedule/page.tsx`).** The `inPlayoff` section already awaits `getPlayoffBracket(id)`. Pass `bracket.placements` to a small new read-only server component `src/components/playoff-placements.tsx` (the `playoff-schedule.tsx` precedent — server, read-only, no client state):
  - Render an ordered list: «1-е місце — {teamName}», «2-е місце — {teamName}», «3-є місце — {teamName}», «4-е місце — {teamName}».
  - A `null` place → «— (матч не зіграно)» in `text-muted-foreground`.
  - **Number + text always** — never rely on colour or position alone (EXPERIENCE §Accessibility Floor). The winner may get `font-medium` / a `TrophyIcon` (lucide) but the ordinal text is the primary cue.
  - Render the block **only when at least one placement is non-null** (i.e. the final or the third-place match has a result). Before that, the section shows just the schedule list (unchanged). Put it above or below the `PlayoffSchedule` list inside the existing `<section>` with a small `<h3>` «Місця».
  - `getPlayoffBracket`'s `.then(...)`-in-a-ternary shape stays; just also read `bracket.placements` in that block (or refactor the ternary to an `await` — dev's call, keep it lint-clean).

- **`Tournament.state` is NOT touched.** Story 4.4 operates entirely within `PLAYOFF`. The `PLAYOFF → COMPLETED` transition, the «Завершити турнір» button, wiring `tournamentState.ts`'s `finalAndThirdPlacePlayed` predicate, and the blanket `COMPLETED` result-edit lock (PRD Open Question #3) are **all Story 4.5**. `tournamentState.ts` stays untouched.

- **No public rendering.** The public «Плейоф» tab placeholder, the `Bracket` component, `bracket-pair` / `bracket-pair-tbd` styling, `needsManualSeed` render-path persistence — **Story 4.6**. The `/archive` places-1–4 list — **Story 4.7**. If a `verify-*` change or the schedule page touches `src/data/playoff.ts`, do not absorb the `@@unique([tournamentId, slot])` gap or the stale-standings/SF-pairing-lag window — those are tracked elsewhere.

- **No worked fixtures in the planning docs** — extend the existing 4-team scenario in `scripts/verify-advance-bracket.mts`.

## Tasks / Subtasks

- [x] **Task 1 — `src/domain/bracket.ts` (UPDATE): `checkCanEditSemifinalResult` + `PlayoffResultEditCheck`** (AC: 2)
  - [x] `PlayoffResultEditCheck = { ok: true } | { ok: false; message: string }` + `checkCanEditSemifinalResult(matches)` — a `.some(...)` over `slot IN (FINAL, THIRD_PLACE) && sets.length > 0`, no `indexBySlot`. Doc comment cites the freeze rule / the "two places" hazard.
  - [x] No change to any existing export.
  - [x] `typecheck` / `lint` clean.

- [x] **Task 2 — `src/domain/bracket.test.ts` (UPDATE): predicate cases** (AC: 2)
  - [x] `describe("checkCanEditSemifinalResult", …)` — 6 cases: `[]` → ok; semifinals only → ok; downstream row with `sets: []` → ok; `FINAL` with sets → not ok (message non-empty); `THIRD_PLACE` with sets → not ok; both downstream with sets → not ok.
  - [x] `pnpm test` **161 → 167**.

- [x] **Task 3 — `src/data/playoff.ts` (UPDATE): `placements` on `PlayoffBracketView` + `readPlayoffMatchStates`** (AC: 1, 2)
  - [x] Imported `playoffPlacements` (value).
  - [x] `PlayoffPlacementView` (`{ entryId, teamName }`) + `PlayoffPlacementsView` (`{ first,second,third,fourth: … | null }`); `placements` added to `PlayoffBracketView`.
  - [x] `getPlayoffBracket`: `playoffPlacements(states)` resolved through the existing `teamNames` map via a `resolvePlacement` helper (fallback `"—"`). No new query — `states` is `rows.map(toMatchState)`, computed once and shared with `advanceBracket`.
  - [x] `readPlayoffMatchStates(tournamentId)` — flat select (`slot`, `homeEntryId`, `awayEntryId`, `sets`), non-transactional.
  - [x] `typecheck` / `lint` clean.

- [x] **Task 4 — `src/actions/matches.ts` (UPDATE): the edit-gate** (AC: 2)
  - [x] Imported `checkCanEditSemifinalResult` + `readPlayoffMatchStates`.
  - [x] New shared helper `checkSemifinalResultEditable(stage, tournamentId)` — no-op for non-`SEMIFINAL`, else `checkCanEditSemifinalResult(await readPlayoffMatchStates(...))`.
  - [x] `editMatchResult`: after the `sets.length === 0` check → gate → `{ formError }` on block.
  - [x] `removeMatchResult`: after the `!match` check, before `deleteMatchResult` → gate → `{ ok: false, code: "PRECONDITION_FAILED", message }` on block.
  - [x] `enterMatchResult` unchanged; `advancePlayoffAfterSemifinal` / `revalidateMatchSurfaces` / guards untouched; doc comments updated.
  - [x] `typecheck` / `lint` clean (no Prisma in `src/actions`).

- [x] **Task 5 — `src/components/playoff-placements.tsx` (NEW) + schedule page wiring** (AC: 1)
  - [x] `playoff-placements.tsx` — server, read-only. Prop is `rows: PlayoffPlacementRow[]` (`{ label, teamName: string | null }`) — a component-local type + page mapping, the `playoff-schedule.tsx` precedent (no component imports from `@/data`). Ordered list «1-е / 2-е / 3-є / 4-е місце — {team}»; `null` → «матч не зіграно» muted. Ordinal label is the cue; `TrophyIcon` on 1st is `aria-hidden`.
  - [x] `schedule/page.tsx` — the `inPlayoff` ternary refactored to `const bracket = inPlayoff ? await getPlayoffBracket(id) : null`; `playoffSlots` + `placementRows` both derived from it; `<PlayoffPlacements>` renders under an `<h3>Місця</h3>` only when `hasPlacements` (any place non-null). Group list / `DRAFT` / `PlayoffSchedule` unchanged.
  - [x] `pnpm build` → `typecheck` clean.

- [x] **Task 6 — `scripts/verify-advance-bracket.mts` (UPDATE): gate + placements assertions** (AC: 1, 2)
  - [x] Imported `checkCanEditSemifinalResult` + `readPlayoffMatchStates`.
  - [x] Both semifinals resulted, no downstream result: `checkCanEditSemifinalResult` → ok; `placements` all null.
  - [x] Final played: `checkCanEditSemifinalResult` → not ok (message non-empty); `placements` 1 & 2 resolve to team names, 3 & 4 null.
  - [x] Re-enter SF1 + play the third-place match: `placements` 1–4 all resolve to the right team names.
  - [x] Header comment updated. Green; all other verify scripts green.

- [x] **Task 7 — Docs** — `src/domain/README.md`, `src/data/README.md`, `src/actions/README.md`, `src/components/README.md`, `AGENTS.md` (new Story 4.4 Stack bullet + verify catalogue line), `deferred-work.md` (new Story 4.4 section; "team in two places" + "`playoffPlacements` unwired" struck through and marked done; TOCTOU / admin-only-display / no-component-test noted).

- [x] **Task 8 — Verification gate** (AC: all)
  - [x] `pnpm build` ✓ · `pnpm typecheck` ✓ · `pnpm lint` ✓ · `pnpm test` **167/167**.
  - [x] Import-boundary: `bracket.ts` imports unchanged (`@/domain/scoring` + `@/domain/tiebreak`); `playoff.ts → @/domain/bracket` value call on the established edge; `src/actions/matches.ts` imports `@/data/playoff` + `@/domain/bracket`, no Prisma.
  - [x] `verify-advance-bracket.mts` green; all 10 verify scripts green; `prisma migrate status` up to date, no drift (no migration this story).
  - [x] Command output in the Dev Agent Record.
  - _Residual (matches every prior admin story): no manual signed-in browser pass (no seeded `PLAYOFF` tournament). Mitigated by the verify script + full gate. Recommended with code review: form a playoff, enter both semifinal results, then the final and third-place results → the admin «Плейоф» section shows «Місця» 1–4 with the right teams; then open a semifinal and confirm «Виправити» / «Видалити результат» are blocked with the explanatory message._

- [x] **Task 9 — Commit(s)** — one commit + `git push origin main` per task group (domain predicate + tests; data; action gate; component + page; verify script; docs).

## Dev Notes

### What this story is / is NOT

**Is:** the last two pieces of playoff result handling. (1) `playoffPlacements` (Story 4.1, unused until now) is folded into `getPlayoffBracket`'s `PlayoffBracketView` as a name-resolved `placements` field — computed on read from the `Match` + `SetScore` rows, never stored (AD-4) — and rendered in the **admin** «Плейоф» section of the schedule page. (2) A new pure predicate `checkCanEditSemifinalResult` (`bracket.ts`, `checkCanRedraw` shape) blocks correcting/deleting a semifinal result once the final or the third-place match has its own `SetScore`, enforced in `editMatchResult` / `removeMatchResult` — closing the "team in two places" hazard that `advanceBracket` explicitly does not guard against.

**Is NOT** (do not pull forward):
- **Playoff result entry wiring.** Done in Story 4.3 (un-scoped CRUD + actions + match screen + `advanceBracket` on write/read).
- **The public «Плейоф» tab / the `Bracket` component / `bracket-pair-tbd` / a public placements block.** Story 4.6. The public tab stays a one-line placeholder.
- **The `/archive` view and its «тип, рік, назва, місця 1–4» list.** Story 4.7.
- **«Завершити турнір» / `PLAYOFF → COMPLETED` / `finalAndThirdPlacePlayed` / the blanket `COMPLETED` result-edit lock (PRD Open Question #3).** Story 4.5. `tournamentState.ts` untouched.
- **Gating `GROUP`-result edits during `PLAYOFF`.** Not needed — a group-result edit never re-seeds the bracket (`seedPlayoff` runs only at formation). Over-scoping.
- **Gating schedule edits (`updateMatchSchedule` / `scheduleMatch`) on a semifinal.** Out of scope — the gate is about the *result*; changing a semifinal's date/venue does not affect placements (FR-13: «не впливає на результат»).
- **`needsManualSeed` on the derived bracket / persisting it.** Story 4.6.
- **A migration.** No schema change. `Match.slot`, nullable entries, per-stage `match_slot_stage_check` all exist.
- **A new route / a new `src/domain` module.** New function in `bracket.ts`; new component + data function only.
- **`@@unique([tournamentId, slot])` on `Match`, the stale-standings/SF-pairing window.** Tracked in `deferred-work.md` for Story 4.6 / a schema follow-up.
- **BEACH.** `discipline = CLASSIC` only.

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/domain/bracket.ts` | UPDATE | `checkCanEditSemifinalResult` + `PlayoffResultEditCheck`. No change to existing exports. |
| `src/domain/bracket.test.ts` | UPDATE | ~6 new cases for the predicate. |
| `src/data/playoff.ts` | UPDATE | `placements` on `PlayoffBracketView` (folded into `getPlayoffBracket`, no new query); `readPlayoffMatchStates` (flat, non-transactional). |
| `src/actions/matches.ts` | UPDATE | `SEMIFINAL` edit-gate in `editMatchResult` / `removeMatchResult` (`PRECONDITION_FAILED`). `enterMatchResult` unchanged. |
| `src/app/admin/tournaments/[id]/schedule/page.tsx` | UPDATE | Render `<PlayoffPlacements>` in the `inPlayoff` section when any place is decided. |
| `src/components/playoff-placements.tsx` | NEW | Read-only server component, `playoff-schedule.tsx` shape. |
| `scripts/verify-advance-bracket.mts` | UPDATE | Gate + placements assertions. |
| `src/domain/README.md` · `src/data/README.md` · `src/actions/README.md` · `src/components/README.md` · `AGENTS.md` · `_bmad-output/implementation-artifacts/deferred-work.md` | UPDATE | Module entries, Stack status, verify catalogue, closed deferred items. |
| `src/app/admin/tournaments/[id]/matches/[matchId]/page.tsx` | DO NOT TOUCH | Match screen already un-scoped (4.3). The gate lives in the actions, not the page. UI pre-disable of the edit/delete buttons in `MatchResultPanel` is **out of scope** (would need the panel to receive downstream-played state as a prop; the server guard is the real enforcement; the admin «Плейоф» section is where an admin sees the placements before finishing). |
| `src/domain/bracket.ts` `advanceBracket` / `seedPlayoff` / `playoffPlacements` | DO NOT MODIFY | Used as-is. |
| `src/domain/tournamentState.ts` | DO NOT TOUCH | `COMPLETED` stub is Story 4.5. |
| `src/data/playoff.ts` `savePlayoffFormation` / `savePlayoffAdvancement` | DO NOT MODIFY | Story 4.2 / 4.3. |
| `prisma/**` | DO NOT TOUCH | No schema change. |

### Architecture compliance

- **AD-4** — placements 1–4 are computed by `playoffPlacements` from `Match` + `SetScore` on every `getPlayoffBracket` read; no placement/winner column anywhere. [ARCHITECTURE-SPINE.md#AD-4]
- **AD-5** — the edit-gate *is* the consistency-trust boundary `advanceBracket` documents it assumes ("does not detect a team appearing in two slots — trusts a self-consistent set"). The freeze rule (a downstream row with its own `SetScore` is not re-derived) is unchanged; the gate stops the *upstream* edit that would break the invariant. [ARCHITECTURE-SPINE.md#AD-5]
- **AD-2 / AD-3** — `checkCanEditSemifinalResult` and `playoffPlacements` are pure `src/domain`; `src/data/playoff.ts` makes the `data → domain` value call (the established edge, same as `getStandings` / `advanceBracket`). `bracket.ts` imports stay `@/domain/scoring` + `@/domain/tiebreak` only. [ARCHITECTURE-SPINE.md#AD-2, #AD-3]
- **AD-6 / AD-11** — the gate is enforced in the Server Actions (`editMatchResult` / `removeMatchResult`, first line `await requireAdmin()`); the new read is a named `src/data` function; no Prisma in `src/actions` / `src/app`. [ARCHITECTURE-SPINE.md#AD-6, #AD-11]
- **AD-8** — no `Tournament.state` transition. [ARCHITECTURE-SPINE.md#AD-8]
- **NFR-3 / FR-16** — with the gate, there is no sequence that leaves `playoffPlacements` naming one team in two positions; the bracket + placements are a pure derivation re-run on every read. [PRD NFR-3, FR-16]
- **Consistency Conventions** — every new domain function has Vitest cases; the verify script covers the new data paths; `revalidatePath` unchanged (already covers the admin schedule page). [ARCHITECTURE-SPINE.md#Consistency]

### Existing code being modified — current state → change → what must be preserved

**`src/domain/bracket.ts`** (Story 4.1, untouched since)
- *Current:* `seedPlayoff`, `advanceBracket`, `playoffPlacements` (returns `{first,second,third,fourth: string|null}` entryIds), private `hasOwnResult` / `matchOutcome` / `indexBySlot` (throws on dup slot), types `BracketSlot` / `PlayoffMatchState` / `PlayoffBracket` / `PlayoffPlacements`. 161 Vitest (26 in `bracket.test.ts`). Imports `@/domain/scoring` + `@/domain/tiebreak` only.
- *Change:* add `PlayoffResultEditCheck` + `checkCanEditSemifinalResult(matches)` — a `.some(...)` over `slot`; no `indexBySlot`.
- *Must preserve:* every existing export and its signature; the imports list; `advanceBracket`'s "trusts a consistent set" contract text (the gate is what makes that trust safe — you may add a sentence noting the gate, don't change the behaviour).

**`src/data/playoff.ts`** (Stories 4.2 + 4.3)
- *Current:* `savePlayoffFormation`, `getPlayoffBracket` (→ `PlayoffBracketView` `{ semifinals, thirdPlace, final }`, decorates each pair via `teamNames` map, runs `advanceBracket`), `savePlayoffAdvancement` (transactional, flat queries), private `readPlayoffRows` / `toMatchState`, consts `PLAYOFF_STAGES` / `DOWNSTREAM_SLOTS`. Imports `advanceBracket` (value) from `@/domain/bracket`, `matchScoreLabel` from `@/domain/scoring`.
- *Change:* import `playoffPlacements` too; add `placements` to `PlayoffBracketView` (computed in `getPlayoffBracket` from the rows already read); export `readPlayoffMatchStates`.
- *Must preserve:* `savePlayoffFormation` and `savePlayoffAdvancement` verbatim (the `FOR UPDATE`, the flat-query workaround, the `{ ok, reason }` returns); `getPlayoffBracket`'s existing pair decoration and return shape (only *add* a field); the nested `readPlayoffRows` for `getPlayoffBracket` (do not switch it to flat — it needs names).

**`src/actions/matches.ts`** (Stories 3.5–3.7 + 4.3)
- *Current:* `enterMatchResult` / `editMatchResult` (`MatchResultFormState`) / `removeMatchResult` (`ActionResult`), `advancePlayoffAfterSemifinal` (log-and-swallow, `stage === "SEMIFINAL"` only), `parseAndValidate` (the `"Партія N:"` regex), `revalidateMatchSurfaces` (4 paths), the `requireAdmin` `AdminRequiredError`-narrow catch. No `stage` rejection anymore (4.3 removed it).
- *Change:* add the `checkCanEditSemifinalResult` gate to `editMatchResult` + `removeMatchResult` for `SEMIFINAL` matches, using `readPlayoffMatchStates`.
- *Must preserve:* `enterMatchResult` untouched; the `sets.length` guards; `parseAndValidate` unchanged (keep the gate message free of the `"Партія N:"` prefix); `advancePlayoffAfterSemifinal` + `revalidateMatchSurfaces` calls and their order; the two different return shapes.

**`src/app/admin/tournaments/[id]/schedule/page.tsx`** (Stories 3.5 + 4.3)
- *Current:* `DRAFT` → `GROUP_NOT_DRAWN` empty state; else group `MatchScheduleList`; `inPlayoff` (`PLAYOFF` | `COMPLETED`) → `getPlayoffBracket(id)` → `PlayoffSchedule` section.
- *Change:* also read `bracket.placements`; render `<PlayoffPlacements>` in the same `<section>` when a place is decided.
- *Must preserve:* the back link, the `DRAFT` branch, the group-match list + its VM shaping, the `PlayoffSchedule` list.

### Testing requirements

- **New Vitest** — `checkCanEditSemifinalResult` gets ~6 cases in `bracket.test.ts` (every `src/domain` function must have unit tests — AGENTS.md). `pnpm test` **161 → ~167**; state the exact number in the Dev Agent Record.
- **`playoffPlacements`** is already covered (4 cases) — no new domain test for it; the *wiring* (name resolution, null passthrough) is covered by the verify script.
- **`scripts/verify-advance-bracket.mts`** is the integration gate — it already builds the 4-team playoff fixture and drives semifinal result edit/delete + `savePlayoffAdvancement`. Add: the gate predicate rejects once the final has a `SetScore`; `getPlayoffBracket().placements` resolves the right team names and returns `null` for an unplayed deciding match.
- **No action-level test** for the gated `editMatchResult` / `removeMatchResult` (standing "no `requireAdmin` / session-mock harness" gap — every prior story). The domain predicate + the verify script cover the logic.
- **No migration** — `prisma migrate status` + `migrate diff --exit-code` still clean (confirm, since `src/data/playoff.ts` changes but no schema does).
- **Regression:** `pnpm build` (schedule page changed) + re-run all `verify-*.mts`.

### Project Structure Notes

- `checkCanEditSemifinalResult` goes in `bracket.ts` (not a new `src/domain/playoffResultEdit.ts`) — the 4.3 story established "the engine is used as-is / this is wiring", and the function is bracket-topology logic that belongs beside `advanceBracket` / `playoffPlacements`. `checkCanRedraw` got its own module only because redraw had no existing domain home; the playoff does.
- `placements` folds into `PlayoffBracketView` rather than a separate `getPlayoffPlacements(tournamentId)` — `getPlayoffBracket` already reads exactly the rows and builds exactly the name map needed; a second function would re-read. Story 4.6 (public bracket) and 4.7 (archive) both consume placements and both will already be calling `getPlayoffBracket`.
- `readPlayoffMatchStates` is a *separate* small export (not folded) because the gate needs a cheap flat read with no names, on a hot write path — folding it into `getPlayoffBracket` would force the nested-relation read for a check that doesn't need it.
- New component `playoff-placements.tsx` mirrors `playoff-schedule.tsx` (Story 4.3): server, read-only, takes a plain prop, no client state. Inline-in-page was also acceptable for `PlayoffSchedule`; a component keeps the page readable and lets 4.6/4.7 reuse the markup.

### Previous story intelligence

- **Story 4.3 (done, code-reviewed)** — un-scoped all playoff result CRUD; `getPlayoffBracket` (`PlayoffBracketView` with `matchId` / team names / score / schedule per pair, `advanceBracket` on read) + `savePlayoffAdvancement` (`advanceBracket` on write, flat queries after `FOR UPDATE` to dodge a `pg` warning, separate transaction from the `SetScore` write, log-and-swallow in `advancePlayoffAfterSemifinal`). `PlayoffSchedule` component + the admin schedule «Плейоф» section (`PLAYOFF` | `COMPLETED`). Code review added a guard: `enterMatchResult` rejects a non-`GROUP` match with null `homeEntry`/`awayEntry`; `PlayoffSchedule` hides the result link until participants are decided. Two migrations tightened `match_slot_stage_check` per-stage (+ a SQL NULL-hole fix). `pnpm test` 161.
- **Story 4.1 (done, code-reviewed)** — `playoffPlacements(matches): { first,second,third,fourth: string|null }` (entryIds; final → 1&2, third-place → 3&4; `null` per place until its match has a usable result). `advanceBracket` "trusts a self-consistent set — does not detect a team in two slots" (`bracket.ts` docstring) → **this story's gate is the guard the engine assumes exists**. `indexBySlot` throws on a duplicate slot. Freeze = `hasOwnResult` = `sets.length > 0`.
- **Stories 3.6 / 3.7 (done)** — `enterMatchResult` / `editMatchResult` / `removeMatchResult` + `parseAndValidate` (the `"Партія N:"` regex — do not touch `validation.ts`) + `revalidateMatchSurfaces`. `MatchResultForm` (`mode: "create" | "edit"`) / `MatchResultPanel` are stage-agnostic. `removeMatchResult` is `ActionResult` + `toActionError`; `editMatchResult` is `MatchResultFormState`.
- **Story 3.4 (done)** — `checkCanRedraw(state, hasResults): { ok: true } | { ok: false; message }` in `src/domain/redraw.ts` — **the exact shape** for this story's predicate. Its consumer `RedrawTournamentButton` disables + captions on `!ok` (the view → domain edge) — but this story does **not** do the UI pre-disable (see the DO-NOT-TOUCH row for the match page).
- **Story 2.7 (done)** — `checkCanEnroll` / `checkCanRemoveEntry` (`teamEnrollment.ts`), same union; `enrollTeam` / `removeTeamEntry` map `!ok` → `PRECONDITION_FAILED`.

### Git intelligence

Recent: `83fb8f5` (Story 4.3 review-fix, done) ← `98f30ea` ← `6e45639` ← `01354c3` (Story 4.3) ← `329e7bf`. `epic-4` `in-progress`; `4-1` / `4-2` / `4-3` `done`, `4-4` `backlog`. `src/domain/bracket.ts` has `seedPlayoff` / `advanceBracket` / `playoffPlacements` (161 Vitest; `bracket.test.ts` 26 cases). `src/data/playoff.ts` has `savePlayoffFormation` / `getPlayoffBracket` / `savePlayoffAdvancement` + private `readPlayoffRows` / `toMatchState`. `src/actions/matches.ts` result CRUD is stage-agnostic (4.3). No migration since `20260907140000_match_slot_stage_per_stage_fix`.

### Latest tech information

- **No new library.** Prisma 7, Next 16 Server Actions, `revalidatePath`, `db.$transaction`. `playoffPlacements` / `checkCanEditSemifinalResult` are pure TypeScript.
- **No migration** — no schema change. `prisma generate` runs in `postinstall` / `build`; run `pnpm build` once because the schedule page changes (route unchanged, so `typecheck` is green without it, but run it).
- **`lucide-react`** is already a dependency (`playoff-schedule.tsx` uses `CheckIcon`) — `TrophyIcon` for the winner line, if used, needs no install.
- **`noUncheckedIndexedAccess` is OFF** — `bySlot.get(slot)` is `T | undefined` without a forced guard; the new predicate avoids `indexBySlot` entirely (`.some`), so this doesn't bite.

### Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 4.4 AC, FR-21; the 4.3/4.4 re-allocation), `prd.md` §4.8 (FR-21) + §4.6 (FR-16) + Open Question #3 (4.5, not here), `ARCHITECTURE-SPINE.md` (AD-2/AD-4/AD-5/AD-6/AD-8/AD-11), `SPEC.md` (CAP-9, Constraints "заморожуються після внесення власного результату", NFR-3), `EXPERIENCE.md` (State Patterns — disabled+caption for a not-yet-allowed action; Accessibility Floor — playoff position never colour-only; KF-1 §7), `DESIGN.md` (no medal/place token — reuse the `standings-table.tsx` ordinal treatment idea, text-first), `4-1-domain-engine-bracket.md` (`playoffPlacements` contract, the freeze rule, "trusts a consistent set"), `4-3-auto-advance-final-third-place.md` (`getPlayoffBracket` / `PlayoffBracketView`, the 4.3/4.4 boundary decision, the un-scoped CRUD), `3-6-…` / `3-7-…` (`enter/edit/removeMatchResult`, form/panel), `deferred-work.md` (the "team in two places" hazard → 4.4; `playoffPlacements` unwired → 4.4).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.4: Результати плейофа й фінальні місця] — user story + AC; FR-21
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.5 / #Story 4.6 / #Story 4.7] — the boundaries: 4.5 = «Завершити турнір» + COMPLETED lock; 4.6 = public bracket; 4.7 = archive places 1–4
- [Source: _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md#4.8] — FR-21 «Наслідки»; [#4.6] — FR-16; [#Open Questions №3] — COMPLETED edit-lock (Story 4.5)
- [Source: …/ARCHITECTURE-SPINE.md#AD-5] — advanceBracket sole deriver, freeze after own SetScore · [#AD-4] — placements never stored · [#AD-2/#AD-3/#AD-6/#AD-11] · [#Consistency Conventions]
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#Constraints] — «заморожуються після внесення власного результату» · [#NFR-3]
- [Source: …/ux-designs/…/EXPERIENCE.md#State Patterns] — disabled + caption for a not-yet-available action · [#Accessibility Floor] — playoff position not colour-only · [#Key Flows — KF-1 §7]
- [Source: _bmad-output/implementation-artifacts/4-1-domain-engine-bracket.md] — `playoffPlacements`, freeze rule, "trusts a consistent set"
- [Source: _bmad-output/implementation-artifacts/4-3-auto-advance-final-third-place.md#Notes on AC interpretation] — the 4.3/4.4 re-allocation [decision]; `getPlayoffBracket` / `PlayoffBracketView`
- [Source: _bmad-output/implementation-artifacts/3-6-enter-match-result.md] · [3-7-edit-delete-result.md] — `enter/edit/removeMatchResult`, `MatchResultForm` / `MatchResultPanel`
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — "team in two places … Story 4.4"; "`playoffPlacements` is implemented but unused … until Story 4.4"; the `checkCanRedraw` predicate pattern
- [Source: src/domain/redraw.ts] — `checkCanRedraw` return-union shape for the new predicate
- [Source: src/data/playoff.ts] — `getPlayoffBracket` / `readPlayoffRows` / `toMatchState` / `PLAYOFF_STAGES`
- [Source: src/actions/matches.ts] — `editMatchResult` / `removeMatchResult` structure, `PRECONDITION_FAILED`

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (bmad-dev-story)

### Debug Log References

- `verify-advance-bracket.mts` "all four placements resolve" assertion first failed because it used `replaceMatchResult` to re-enter SF1 after that result had been deleted earlier in the script — `replaceMatchResult` requires an existing result (`_count.sets === 0` → `not_found`) and wrote nothing, so `savePlayoffAdvancement` never re-derived the third-place participants and `createMatchResult` then wrote sets to a participant-less row. Fixed by using `createMatchResult` for the re-entry.

### Completion Notes List

- Task 1–2: `src/domain/bracket.ts` — `PlayoffResultEditCheck` + `checkCanEditSemifinalResult(matches)` (`.some` over `slot IN (FINAL, THIRD_PLACE) && sets.length > 0`; no `indexBySlot`; `checkCanRedraw` return shape). +6 Vitest cases (`bracket.test.ts`), `pnpm test` 161 → 167.
- Task 3: `src/data/playoff.ts` — `getPlayoffBracket` computes `states` once (shared with `advanceBracket`), runs `playoffPlacements(states)`, resolves each entryId through the existing `teamNames` map (`resolvePlacement`, fallback `"—"`), returns `placements` on `PlayoffBracketView`. New `PlayoffPlacementView` / `PlayoffPlacementsView` types. `readPlayoffMatchStates(tournamentId)` — lean flat (non-transactional) read → `PlayoffMatchState[]`.
- Task 4: `src/actions/matches.ts` — `checkSemifinalResultEditable(stage, tournamentId)` helper (no-op unless `SEMIFINAL`) wired into `editMatchResult` (→ `{ formError }`) and `removeMatchResult` (→ `{ ok: false, code: "PRECONDITION_FAILED" }`), both before the write. `enterMatchResult` untouched. Doc comments updated.
- Task 5: `src/components/playoff-placements.tsx` (NEW, server, read-only) — prop `rows: PlayoffPlacementRow[]` (component-local type, page maps — the `playoff-schedule.tsx` precedent; no `components → data` import). `schedule/page.tsx` — `inPlayoff` ternary refactored to a single `await getPlayoffBracket(id)`; `<PlayoffPlacements>` under `<h3>Місця</h3>` when any place is decided.
- Task 6: `scripts/verify-advance-bracket.mts` — gate allowed/blocked assertions + placements null-then-resolved assertions; header comment updated.
- Task 7: docs — `src/domain/README.md`, `src/data/README.md`, `src/actions/README.md`, `src/components/README.md`, `AGENTS.md` (Story 4.4 Stack bullet + verify catalogue line), `deferred-work.md` (new Story 4.4 section; "team in two places" + "`playoffPlacements` unwired" struck through, marked done).
- Task 8: `pnpm build` / `typecheck` / `lint` clean; `pnpm test` **167/167**; all 10 verify scripts green; `prisma migrate status` up to date (no migration this story). No new domain module — `checkCanEditSemifinalResult` is a function in the existing `bracket.ts`.

### File List

- `src/domain/bracket.ts` (UPDATE)
- `src/domain/bracket.test.ts` (UPDATE)
- `src/data/playoff.ts` (UPDATE)
- `src/actions/matches.ts` (UPDATE)
- `src/app/admin/tournaments/[id]/schedule/page.tsx` (UPDATE)
- `src/components/playoff-placements.tsx` (NEW)
- `scripts/verify-advance-bracket.mts` (UPDATE)
- `src/domain/README.md` · `src/data/README.md` · `src/actions/README.md` · `src/components/README.md` · `AGENTS.md` · `_bmad-output/implementation-artifacts/deferred-work.md` (UPDATE)

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-07 | Story drafted (`bmad-create-story`, 4 research subagents: epics 4.4 scope + boundaries / architecture + PRD + SPEC / UX / code precedent). Re-allocation from Story 4.3 confirmed: 4.4 = final placements 1–4 (admin-only display) + the semifinal-edit gate. Status: ready-for-dev. |
| 2026-09-07 | Implementation complete (`bmad-dev-story`) — all 9 tasks. `checkCanEditSemifinalResult` (`bracket.ts`) + the `editMatchResult` / `removeMatchResult` gate; `playoffPlacements` folded into `getPlayoffBracket` (`placements` on `PlayoffBracketView`) + `readPlayoffMatchStates`; new `PlayoffPlacements` component shown in the admin «Плейоф» section. No migration, no new route, no new domain module. `pnpm build`/`typecheck`/`lint` clean, `pnpm test` 167/167, all 10 verify scripts green, `migrate status` clean. Status: review. |
