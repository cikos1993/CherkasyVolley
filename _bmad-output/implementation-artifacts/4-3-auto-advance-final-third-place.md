---
baseline_commit: c31c9fa
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/implementation-artifacts/4-1-domain-engine-bracket.md
  - _bmad-output/implementation-artifacts/4-2-generate-playoff.md
  - _bmad-output/implementation-artifacts/3-6-enter-match-result.md
  - _bmad-output/implementation-artifacts/3-7-edit-delete-result.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - AGENTS.md
---

# Story 4.3: Автоформування фіналу й матчу за 3-тє місце

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an адмін,
I want щоб фінал і матч за 3-тє місце наповнювались самі після півфіналів,
so that не треба вручну зводити пари (FR-20).

## Acceptance Criteria

Translated from `epics.md` → Epic 4 → Story 4.3. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** the bracket is formed, state `PLAYOFF`
**When** neither semifinal has a result yet
**Then** the final and the third-place match are shown as «очікує суперників»
**When** both semifinal results have been entered
**Then** the final gets the two winners, the third-place match gets the two losers
**And** changing a semifinal result **before the next-round match has been played** updates its pairing

FR / AD / SPEC anchors (in context):

- **FR-20** (`prd.md` §4.8): "Після внесення Результатів обох півфіналів система створює Фінал (переможці півфіналів) і Матч за 3-тє місце (ті, хто програв). **Наслідки (перевірювані):** — До внесення обох Результатів півфіналів Фінал і Матч за 3-тє місце відображаються як «очікує суперників». — Зміна Результату півфіналу після формування Фіналу оновлює склад пар Фіналу / Матчу за 3-тє місце."
- **FR-16** (`prd.md` §4.6): "Після зміни/видалення Таблиця групи та (за наявності) Плейоф-сітка перераховуються. Видалення Результату повертає Матч у стан «не зіграно»."
- **FR-21 / FR-15** (`prd.md` §4.8 / §4.6): "Адмін вносить Результати Матчів Плейофа так само, як групових (FR-15)." — the result-entry mechanism is the group one, reused.
- **AD-5** (`ARCHITECTURE-SPINE.md`): "матчі плейофа … — рядки `Match` зі `stage ≠ GROUP`, мають розклад і результат. `homeEntry/awayEntry` матчу наступного раунду обчислюються з результатів попереднього раунду **доки в самому матчі немає `SetScore`**; після внесення результату пара заморожена й не переобчислюється. Це обчислення виконує лише `domain/bracket.ts` (`advanceBracket`) — **і на запис (Server Action), і на відображення (перед рендером сітки)**; `src/data` і компоненти не виводять учасників самостійно."
- **AD-4** (`ARCHITECTURE-SPINE.md`): "результат матчу зберігається лише як рядки `SetScore` … Таблиця групи й фінальні місця **не зберігаються** — обчислюються при кожному читанні." (So `Match` rows persist the *participant slots*; the winner / score / placement are never a column.)
- **AD-2 / AD-6 / AD-11** (`ARCHITECTURE-SPINE.md`): derivation only in `src/domain/bracket.ts`; every write via a Server Action whose first line is `await requireAdmin()`; every read/write via a named `src/data` function, Prisma only in `src/data`.
- **SPEC Constraints**: "Учасники фіналу й матчу за 3-тє місце заповнюються автоматично після півфіналів і **заморожуються після внесення власного результату**." **NFR-3**: "неможливий стан, коли таблиця не відповідає внесеним результатам."
- **EXPERIENCE.md** (Bracket): "**Bracket** — тільки читання. Пара «очікує суперників» (`bracket-pair-tbd`) доки немає результатів обох півфіналів. Після внесення результату півфіналу відповідна пара фіналу/матчу за 3-тє місце заповнюється **при наступному завантаженні**." KF-1 §7: "Вносить результати півфіналів → фінал і матч за 3-тє наповнюються командами. Вносить їх результати."

### Notes on AC interpretation

- **The 4.3 / 4.4 boundary — a correction.** `epics.md` puts "playoff result entry так само, як груповий (Story 3.6)" in **Story 4.4** and "auto-formation" in Story 4.3. But **every result-entry path is hard-scoped to `stage: "GROUP"`** today — `createMatchResult` / `replaceMatchResult` / `deleteMatchResult` (`src/data/matches.ts`), `enterMatchResult` / `editMatchResult` / `removeMatchResult` (`src/actions/matches.ts`, each with an explicit `match.stage !== "GROUP"` rejection), and the match screen (`/admin/tournaments/[id]/matches/[matchId]/page.tsx`, `if (match.stage !== "GROUP") notFound()`). Story 4.3's AC ("**When** внесено результати обох півфіналів **Then** фінал отримує переможців") **cannot be demonstrated** without semifinal result entry existing. `4-2-generate-playoff.md`'s note that these "already scope by `(tournamentId, matchId)` not `stage: "GROUP"`" is **wrong** (only `getMatchForResult` is un-scoped). **Decision:** Story 4.3 un-scopes the result-entry path for **all** playoff stages (there is no clean way to un-scope "just semifinals") and wires `advanceBracket` on write. **Story 4.4 shrinks to:** computing/showing the final placements 1–4 (`playoffPlacements`), and the FR-16 edit-gate ("play the final → correct a semifinal → play the third-place match" can put one team in two places — gate semifinal-result edits once a downstream match has a result). Flag this re-allocation to the user. [decision]

- **No new `src/domain` module.** `advanceBracket` (Story 4.1, 161 Vitest cases) is the engine — used as-is. Its freeze rule is already implemented (`hasOwnResult(match)` → `sets.length > 0` → `status: "PLAYED"` → the stored participants are returned unchanged). This story is the **data + action + surface** wiring only.

- **`src/data/playoff.ts` gains two functions — the AD-5 "write" and "render" `advanceBracket` call sites:**

  - **`getPlayoffBracket(tournamentId)` — the render-path call.** Reads the up-to-four playoff `Match` rows (`stage IN (SEMIFINAL, THIRD_PLACE, FINAL)`) with their `slot`, `homeEntry.team.name` / `awayEntry.team.name`, `scheduledAt` / `venueText`, and `sets`. Maps each to a `PlayoffMatchState` (`slot: match.slot!` — non-null for playoff rows by the tightened CHECK; `home: match.homeEntryId ? { entryId, seed: null } : null`; likewise `away`; `sets`). Runs `advanceBracket(states)`. Returns the resolved `PlayoffBracket` **decorated per slot** with `matchId: string | null` (null = the row does not exist yet), the two team names, the score summary (`matchScoreLabel(sets)`), and `scheduledAt` / `venueText`. This is the read for **this story's admin surface** *and* Story 4.6's public bracket — build it generic (no admin-only fields). `advanceBracket` is the sole participant-deriver on read (AD-5); do not read `homeEntryId` off a not-yet-played downstream row and trust it. `needsManualSeed` comes back `false` (the seed-time flag doesn't survive the persisted-rows round-trip — deferred to Story 4.6).

  - **`savePlayoffAdvancement(tournamentId)` — the write-path call.** Runs after any semifinal-result mutation. One `db.$transaction` with `SELECT id FROM "tournament" WHERE id = ${tournamentId} FOR UPDATE` first (the `savePlayoffFormation` precedent — serialises concurrent advancement). Read the playoff rows → `PlayoffMatchState[]` → `advanceBracket`. Then, for `bracket.thirdPlace` then `bracket.final`:
    - `status === "PLAYED"` → the pair is **frozen**; `advanceBracket` returned the stored participants — **do nothing**.
    - `status === "READY"` (both semifinal results present, participants known): **no row for this `slot`** → `tx.match.create({ tournamentId, stage: pair.slot, slot: pair.slot, groupId: null, homeEntryId: pair.home.entryId, awayEntryId: pair.away.entryId })`; **row exists with different participants** → `tx.match.update` those two columns; **row exists, same participants** → no-op.
    - `status === "AWAITING"` (a semifinal result is now missing / level): **row exists with any participant set** → `tx.match.update({ homeEntryId: null, awayEntryId: null })` (keep the row — it may carry `scheduledAt` / `venueText`); **no row** → nothing.
    - Never touches a `SEMIFINAL` row. Never touches a row that has its own `SetScore` (the `PLAYED` branch). Fully **idempotent** — a no-op when nothing changed, safe to call after every semifinal write.
    - `pair.slot` for `thirdPlace` / `final` is `"THIRD_PLACE"` / `"FINAL"` — a `BracketStage` string and a `MatchSlot` value with identical spelling, so `stage: pair.slot` and `slot: pair.slot` both typecheck against the Prisma enums (the `savePlayoffFormation` precedent).

- **FINAL / THIRD_PLACE rows are created lazily, at `READY`** — verbatim FR-20 "Після внесення Результатів обох півфіналів система **створює**". Before both semifinal results exist the rows are absent; `advanceBracket` (Story 4.1 handles 2-match input) synthesises them as `AWAITING`, and `getPlayoffBracket` returns them with `matchId: null`. The admin surface renders that as «очікує суперників» with no result link. Story 4.2 is **not** modified — it still creates only the two `SEMIFINAL` rows.

- **Un-scoping the result-entry path (`src/data/matches.ts`).** Drop the `stage: "GROUP"` clause from `createMatchResult` / `replaceMatchResult` / `deleteMatchResult` and from `updateMatchSchedule` (AD-5: playoff matches "мають розклад"). The `(tournamentId, matchId)` pair stays the scope; the `_count.sets` / delete-then-insert / `updateMany` logic is stage-agnostic. Update the doc comments ("group match" → "match"). `getMatchForResult` is already un-scoped and already returns `stage` + the tournament's `scoringPreset` / `type` / `discipline`.

- **Un-scoping the result-entry actions (`src/actions/matches.ts`).** Replace the `match.stage !== "GROUP"` rejection in `enterMatchResult` / `editMatchResult` / `removeMatchResult` — a playoff match is a legitimate result-entry target. Keep the `sets.length` guards (`enter`: must be 0; `edit`: must be > 0). **After a successful save / replace / delete, if `match.stage === "SEMIFINAL"` → `await savePlayoffAdvancement(tournamentId)`** (a `try/catch` that on failure logs and still returns success — the render path re-advances; a stale persisted downstream participant is corrected on next read, and the next result-mutation re-runs it). `revalidateMatchSurfaces` already revalidates `${publicRoot}/${tournamentId}` and `/admin/tournaments/${tournamentId}` — the `?tab=playoff` tab is a query param on the former, so it is covered; also add `/admin/tournaments/${tournamentId}/schedule` (already there). No `Tournament.state` guard (consistent with Story 3.7 — a `COMPLETED` lock is Story 4.5).

- **The match screen (`/admin/tournaments/[id]/matches/[matchId]/page.tsx`).** Drop the `match.stage !== "GROUP" → notFound()` guard. `MatchResultForm` / `MatchResultPanel` are already stage-agnostic — the set-count logic keys off the scoring preset (`CLASSIC` up to 5 / `CUSTOM` exactly 3), not the stage. Show the stage in the heading (e.g. «Півфінал», «Фінал», «Матч за 3-тє місце») via a small label map — `MatchStage` → Ukrainian.

- **Admin surface — a «Плейоф» section on the schedule page.** `src/app/admin/tournaments/[id]/schedule/page.tsx` — when `state === "PLAYOFF" || "COMPLETED"`, render a section built from `getPlayoffBracket(id)`: the four slots in order (SF1, SF2, third-place, final), each showing the two team names (or «очікує суперників» when a participant is `null`), the score summary if played, and a "Внести результат" / "Результат: X:Y" link to `/matches/[matchId]` **only when `matchId` is non-null**. Reuse `matchScoreLabel` and the `MatchScheduleList` row/link styling (or a thin read-only equivalent). Playoff-match date/time/venue editing may reuse `MatchScheduleList` (now that `updateMatchSchedule` is un-scoped) or be deferred — keep it if cheap. The group-match list stays exactly as it is.

- **Schema: tighten `match_slot_stage_check` per-stage** — assigned to this story by `deferred-work.md` (4.2 review) and `4-2-generate-playoff.md`. The current CHECK is `("stage" = 'GROUP') = ("slot" IS NULL)` — it permits `stage = 'SEMIFINAL', slot = 'FINAL'`. Replace with:
  ```sql
  ALTER TABLE "match" DROP CONSTRAINT "match_slot_stage_check";
  ALTER TABLE "match" ADD CONSTRAINT "match_slot_stage_check" CHECK (
    ("stage" = 'GROUP' AND "slot" IS NULL)
    OR ("stage" = 'SEMIFINAL' AND "slot" IN ('SF1', 'SF2'))
    OR ("stage" = 'THIRD_PLACE' AND "slot" = 'THIRD_PLACE')
    OR ("stage" = 'FINAL' AND "slot" = 'FINAL')
  );
  ```
  Hand-written migration (`prisma migrate diff --script` prints "empty" — Prisma 7 doesn't model CHECK). No existing row violates it (playoff rows so far are only 4.2's `SF1`/`SF2` semifinals). Follow the Story 2.4 / 3.2 / 4.2 hand-write → `migrate deploy` → `migrate status` fallback.

- **The "team in two places" hazard is NOT fixed here** (`deferred-work.md`, 4.1 review — assigned to Story 4.4/4.5). `savePlayoffAdvancement` faithfully applies `advanceBracket`; the sequence "play the final → correct a semifinal → play the third-place match" can still let `playoffPlacements` name one team as both 1st and 3rd. Story 4.4 gates the semifinal-result edit once a downstream match has a result. Note it in `deferred-work.md`.

- **No `bracket-pair-tbd` component / no public «Плейоф» tab** — Story 4.6. This story's «очікує суперників» is (a) the *data* state (FINAL/THIRD_PLACE rows absent or with null participants) and (b) a plain text line on the admin schedule section. The public tab stays the one-line placeholder.

- **`Tournament.state` is not transitioned** — this story operates within `PLAYOFF`. It produces the precondition Story 4.5's `COMPLETED` transition depends on ("зіграно фінал і матч за 3-тє").

- **No worked fixtures in the planning docs** — construct the 4-team scenario in the verify script.

## Tasks / Subtasks

- [x] **Task 1 — `prisma/schema.prisma` + migration (NEW): tighten `match_slot_stage_check`** (AC: 1)
  - [x] No model/enum change — CHECKs aren't in the schema. Pre-flight `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` (expect "empty").
  - [x] Hand-write `prisma/migrations/<YYYYMMDDHHMMSS>_match_slot_stage_per_stage/migration.sql`: `DROP CONSTRAINT` + `ADD CONSTRAINT` per the SQL in Notes.
  - [x] `pnpm exec prisma migrate deploy`; `migrate status` clean; `migrate diff --exit-code` empty.
  - [x] `pnpm typecheck` clean (no client regen needed — no schema types changed, but run `prisma generate` for safety).

- [x] **Task 2 — `src/data/playoff.ts` (UPDATE): `getPlayoffBracket` + `savePlayoffAdvancement`** (AC: 1, 2, 3)
  - [x] `import { advanceBracket, type PlayoffBracket, type PlayoffMatchState } from "@/domain/bracket"`.
  - [x] Private `readPlayoffMatchStates(client, tournamentId)` → the `stage IN (…)` `findMany` mapped to `PlayoffMatchState[]` (+ keep the raw rows / matchIds for the decorators).
  - [x] `getPlayoffBracket(tournamentId)` → `advanceBracket` over the states; return the `PlayoffBracket` decorated per slot with `{ matchId: string | null; homeTeam: string; awayTeam: string; score: string | null; scheduledAt: Date | null; venueText: string | null }`. Define the return type (e.g. `PlayoffBracketView`).
  - [x] `savePlayoffAdvancement(tournamentId)` — the transaction from Notes (`FOR UPDATE`; `advanceBracket`; per `thirdPlace`/`final`: `PLAYED` → skip, `READY` → create/update, `AWAITING` → null participants of an existing row). Idempotent. Doc comment cites AD-5 + FR-20 + the freeze rule.
  - [x] `typecheck` / `lint` clean.

- [x] **Task 3 — `src/data/matches.ts` (UPDATE): un-scope result CRUD** (AC: 2, 3)
  - [x] Remove `stage: "GROUP"` from the `where` of `createMatchResult`, `replaceMatchResult`, `deleteMatchResult`, `updateMatchSchedule`. Update each doc comment ("group match" → "match"; note it now serves playoff matches too).
  - [x] Leave `getStandings` / `listGroupMatchesForTournament` / `hasAnyGroupResult` / `allGroupMatchesPlayed` **GROUP-scoped** — they are about the group table / the FR-19 precondition.
  - [x] `typecheck` / `lint` clean.

- [x] **Task 4 — `src/actions/matches.ts` (UPDATE): playoff result entry + auto-advance hook** (AC: 2, 3)
  - [x] Replace the `match.stage !== "GROUP"` rejection in `enterMatchResult` / `editMatchResult` / `removeMatchResult` (a playoff match is a valid target; keep the `sets.length` guards).
  - [x] After a successful `createMatchResult` / `replaceMatchResult` / `deleteMatchResult`, when `match.stage === "SEMIFINAL"`: `try { await savePlayoffAdvancement(tournamentId) } catch (e) { console.error(e) }` — the save already succeeded; the render path re-advances.
  - [x] `revalidateMatchSurfaces` unchanged (it already covers the public page + `/admin/…/schedule` + `/admin/tournaments/[id]`).
  - [x] `typecheck` / `lint` clean.

- [x] **Task 5 — `src/app/admin/tournaments/[id]/matches/[matchId]/page.tsx` (UPDATE): allow playoff matches** (AC: 2)
  - [x] Drop `match.stage !== "GROUP" → notFound()`. Keep `!match → notFound()`.
  - [x] Add a `MatchStage` → Ukrainian label in the heading («Груповий матч» / «Півфінал» / «Матч за 3-тє місце» / «Фінал»).
  - [x] `pnpm build` (route unchanged, but the page changed) → `pnpm typecheck` clean.

- [x] **Task 6 — `src/app/admin/tournaments/[id]/schedule/page.tsx` (UPDATE): «Плейоф» section** (AC: 1, 2)
  - [x] `state === "PLAYOFF" || "COMPLETED"` → `getPlayoffBracket(id)` → a section listing the four slots in order with team names / «очікує суперників» / score / a result link when `matchId` is non-null. Reuse `matchScoreLabel` and the schedule-list link styling; a new thin component (`src/components/playoff-schedule.tsx` or similar) is fine.
  - [x] Preserve the group-match list and the `DRAFT` empty state verbatim.
  - [x] `pnpm build` → `pnpm typecheck` clean.

- [x] **Task 7 — `scripts/verify-advance-bracket.mts` (NEW)** (AC: 1, 2, 3)
  - [x] `verify-generate-playoff.mts` shape (dotenv first, dynamic imports, `check`, self-cleaning). One throwaway 4-team tournament: draw → all group results → `formPlayoff` (or `seedPlayoff` + `savePlayoffFormation`) → then:
    - both semifinals unplayed → `getPlayoffBracket`: `final` / `thirdPlace` `status === "AWAITING"`, `matchId === null`.
    - enter both semifinal results (via `createMatchResult` directly) → `savePlayoffAdvancement` → `FINAL` + `THIRD_PLACE` `Match` rows exist, `slot` set, participants = winners / losers, `groupId` null.
    - edit one semifinal result (`replaceMatchResult`) → `savePlayoffAdvancement` → the downstream participants update.
    - record a `FINAL` result → edit the semifinal again → `savePlayoffAdvancement` → the `FINAL` row's participants are **unchanged** (frozen); the `THIRD_PLACE` row (still unplayed) **does** re-derive.
    - delete a semifinal result (`deleteMatchResult`) → `savePlayoffAdvancement` → both downstream rows have `homeEntryId`/`awayEntryId` back to `null` (rows kept).
    - a destructive probe of the tightened CHECK: `db.match.create` with `stage: "SEMIFINAL", slot: "FINAL"` → rejected.
  - [x] Run it — green. Re-run every prior `verify-*.mts` — no regression (esp. `verify-generate-playoff` and the three that set `slot: "SF1"` on SEMIFINAL fixtures).

- [x] **Task 8 — Docs**
  - [x] `src/data/README.md` — `matches.ts` CRUD entries lose the "group" qualifier; new `playoff.ts` entries (`getPlayoffBracket`, `savePlayoffAdvancement`).
  - [x] `src/actions/README.md` — `enterMatchResult` / `editMatchResult` / `removeMatchResult` now serve all stages + the `savePlayoffAdvancement` hook for semifinals.
  - [x] `src/components/README.md` — the new playoff-schedule component (if added).
  - [x] `AGENTS.md` — Stack-status bullet for Story 4.3 (the un-scoping, `getPlayoffBracket` / `savePlayoffAdvancement`, the CHECK migration, the 4.3/4.4 re-allocation). Add the `verify-advance-bracket.mts` line to the verify-script catalogue.
  - [x] `deferred-work.md` — mark `advanceBracket` write-path **done**; note the 4.3/4.4 re-allocation (4.4 = placements 1–4 + the edit-gate); mark the `match_slot_stage_check` per-stage item **resolved**; keep the "team in two places" + `needsManualSeed` render items (4.4 / 4.6).

- [x] **Task 9 — Verification gate** (AC: all)
  - [x] `pnpm build` → `pnpm typecheck` → `pnpm lint` → `pnpm test` (**no new domain module — count stays 161**; confirm unchanged).
  - [x] Import-boundary check: `src/data/playoff.ts` imports `advanceBracket` (type + value) from `@/domain/bracket` — the established `data → domain` value edge; no Prisma in `src/actions`; `src/domain` untouched.
  - [x] `scripts/verify-advance-bracket.mts` green; all prior verify scripts green; `migrate status` clean.
  - [x] Real command output in the Dev Agent Record.
  - _Residual (matches every prior admin story): no manual signed-in browser pass (no seeded `PLAYOFF` tournament). Mitigated by `verify-advance-bracket.mts` + the full gate. Recommended with code review: form a playoff, open a semifinal from the schedule page's «Плейоф» section, enter both results → the final and third-place rows appear with the right teams; correct a semifinal → they update._

- [x] **Task 10 — Commit(s)** — one commit + `git push origin main` per completed task group (migration; data; actions; page; schedule section; verify script; docs). `build`/`typecheck`/`lint`/`test` gate each.

### Review Findings

_Code review (`bmad-code-review`). The 4 review subagents (Blind Hunter, Edge Case Hunter, Verification Gap Reviewer, Acceptance Auditor) all failed on a session rate limit; the review was performed in-session, sequentially, over `git diff c31c9fa..HEAD` (`src/` + `prisma/` + `scripts/`) across the same four lenses. Gate re-run clean: `typecheck` / `lint` pass, `pnpm test` 161/161, `verify-advance-bracket` + `verify-generate-playoff` + the three edited verify scripts green, `migrate status` up to date, no schema drift. 0 decision-needed, 1 patch, 2 deferred, 6 dismissed._

#### Patch

- [x] [Review][Patch] `enterMatchResult` accepts a result for a playoff match with no participants `[src/actions/matches.ts, src/data/matches.ts:createMatchResult]` — after a `FINAL`/`THIRD_PLACE` row is created (`READY`) and a semifinal result is then deleted, `savePlayoffAdvancement`'s `AWAITING` branch nulls the row's `homeEntryId`/`awayEntryId` but keeps the row. `getPlayoffBracket` then returns that pair with a non-null `matchId`, so `playoff-schedule.tsx` renders a «Внести результат» link; the match screen (`getMatchForResult` is un-scoped, no participant guard) shows «—» vs «—» and `createMatchResult` only guards `_count.sets === 0`. Once a score is entered, `advanceBracket` marks the pair `PLAYED` → frozen, so re-entering the semifinal result cannot recover it — the downstream match is wedged with null participants and an orphan result, and `getPlayoffBracket` reports a "played" match with «—» teams (violates NFR-3). Fix: in `enterMatchResult`, after the `getMatchForResult` fetch, reject a non-`GROUP` match whose `homeEntry`/`awayEntry` is null (e.g. «Учасників матчу ще не визначено.»). Also suppress the result link in `playoff-schedule.tsx` when `homeTeam`/`awayTeam` is null. (edge-case-hunter)
  - _Applied: `enterMatchResult` now returns `{ formError: "Учасників матчу ще не визначено." }` for a non-`GROUP` match missing `homeEntry`/`awayEntry`; `PlayoffSchedule` gates the result link on `slot.matchId && decided`. `verify-advance-bracket.mts` gains an assertion that `getPlayoffBracket` reports an emptied-but-kept third-place row as `AWAITING` with null teams. Gate re-run: `typecheck` / `lint` / `build` clean, `pnpm test` 161/161, all 10 verify scripts green._

#### Defer

- [ ] [Review][Defer] No `@@unique([tournamentId, slot])` on `Match` — `getPlayoffBracket` turns a duplicate-slot bug into a render-path 500 `[src/data/playoff.ts, src/domain/bracket.ts:indexBySlot]` — `advanceBracket`'s `indexBySlot` throws on a duplicate slot, and `getPlayoffBracket` now runs on every admin schedule render in `PLAYOFF`/`COMPLETED` (and Story 4.6's public bracket). The tightened `match_slot_stage_check` still allows any number of `SEMIFINAL` rows with `slot IN ('SF1','SF2')`; only `savePlayoffFormation`'s `count > 0` + `SELECT … FOR UPDATE` guard prevents two `SF1` rows. A partial unique index would make the guarantee structural. Pre-existing (Story 4.2); fold into Story 4.6 hardening or a schema follow-up.
- [ ] [Review][Defer] `savePlayoffAdvancement` runs in a separate transaction from the `SetScore` write, failures swallowed `[src/actions/matches.ts:advancePlayoffAfterSemifinal]` — already recorded in `deferred-work.md` (Story 4.3 section). Between the `createMatchResult` commit and `savePlayoffAdvancement` (or if the swallowed hook errors) the persisted `FINAL`/`THIRD_PLACE` rows lag the results; `getPlayoffBracket` always re-derives so every rendered surface is correct, and the next result mutation retries the persistence. No action — re-confirmed acceptable.

#### Dismissed as noise / out of scope (6)

- The "team in two places" hazard (play the final → correct a semifinal → play the third-place match) — explicitly scoped to Story 4.4 by this story's Notes and `deferred-work.md`; `savePlayoffAdvancement` faithfully applies `advanceBracket`'s freeze rule.
- No action-level test for the `advancePlayoffAfterSemifinal` hook (verification-gap) — the standing "no `requireAdmin` / session-mock harness" limitation shared by every prior story; `verify-advance-bracket.mts` covers the `savePlayoffAdvancement` data path directly and the hook is one `if` + a log-and-swallow `try/catch`.
- The `match_slot_stage_check` probe in `verify-advance-bracket.mts` relies on a bare `catch {}` that doesn't inspect which constraint fired — but `match_group_entries_required_check` is `stage != 'GROUP' OR …`, which passes for any non-`GROUP` row, so `match_slot_stage_check` is genuinely the constraint rejecting `stage: SEMIFINAL, slot: FINAL`. Valid probe.
- `getPlayoffBracket(id).then(bracket => …)` inside a ternary in `schedule/page.tsx` (style) — an `await` expression would read more plainly, but it is correct and lint-clean.
- `getPlayoffBracket`'s `decorate` falls back to «—» for a participant id absent from `teamNames` — only reachable with an already-inconsistent DB (a downstream row carrying an `entryId` that is not a semifinal participant); a defensive placeholder is appropriate.
- Two hand-written migrations for one logical CHECK change (`20260907130000` + `_fix` at `20260907140000`) — migrations are append-only and both are already recorded in the dev DB's `_prisma_migrations`; a corrective follow-up is the sanctioned pattern (Story 2.4 / 3.2 precedent).

## Dev Notes

### What this story is / is NOT

**Is:** the write-path and read-path wiring of `advanceBracket` (Story 4.1) into persisted playoff matches. `savePlayoffAdvancement` runs after every semifinal-result mutation and creates / updates / clears the `FINAL` and `THIRD_PLACE` `Match` rows, honouring the freeze rule (a match with its own `SetScore` is never re-derived). `getPlayoffBracket` re-derives on read. Playoff result entry is enabled by un-scoping the existing `matches.ts` CRUD + actions + the match screen from `stage: "GROUP"`. A «Плейоф» section on the admin schedule page gives the admin a way in. One migration tightens `match_slot_stage_check`.

**Is NOT** (do not pull forward):
- **The public «Плейоф» tab / the `Bracket` component / `bracket-pair-tbd` styling.** Story 4.6. `getPlayoffBracket` is built generic so 4.6 reuses it.
- **Final placements 1–4.** `playoffPlacements` (Story 4.1) exists but stays unwired — **Story 4.4** shows places 1–4.
- **Gating a semifinal-result edit once a downstream match has a result.** The "team in two places" hazard — **Story 4.4**.
- **«Завершити турнір» / `→ COMPLETED`.** Story 4.5. `tournamentState.ts`'s `COMPLETED` predicate stays a fail-closed stub.
- **`needsManualSeed` on the derived bracket.** `advanceBracket` returns `false`; persisting the flag is Story 4.6.
- **Re-seeding the semifinals.** A group-result edit during `PLAYOFF` changes the seeding standings but must **not** re-seed a frozen bracket (`deferred-work.md`, 3.7). Story 4.3 never calls `seedPlayoff`.
- **A schema change beyond the CHECK.** `Match.slot` / nullable entries already exist (Story 4.2 / 3.2).
- **BEACH.** `discipline = CLASSIC` only.

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `prisma/schema.prisma` | DO NOT TOUCH | CHECKs aren't modelled here. |
| `prisma/migrations/<ts>_match_slot_stage_per_stage/migration.sql` | NEW | Drop + re-add `match_slot_stage_check` per-stage (hand-written). |
| `src/data/playoff.ts` | UPDATE | `getPlayoffBracket`, `savePlayoffAdvancement`. |
| `src/data/matches.ts` | UPDATE | Drop `stage: "GROUP"` from `createMatchResult` / `replaceMatchResult` / `deleteMatchResult` / `updateMatchSchedule`. |
| `src/actions/matches.ts` | UPDATE | Allow playoff stages in `enter/edit/removeMatchResult`; `savePlayoffAdvancement` hook for `SEMIFINAL`. |
| `src/app/admin/tournaments/[id]/matches/[matchId]/page.tsx` | UPDATE | Drop the `stage !== "GROUP"` guard; stage label in the heading. |
| `src/app/admin/tournaments/[id]/schedule/page.tsx` | UPDATE | `PLAYOFF`+ «Плейоф» section from `getPlayoffBracket`. |
| `src/components/playoff-schedule.tsx` (or similar) | NEW (optional) | Thin list of the four slots with result links. |
| `scripts/verify-advance-bracket.mts` | NEW | Self-cleaning DB round-trip. |
| `src/data/README.md` · `src/actions/README.md` · `src/components/README.md` · `AGENTS.md` · `deferred-work.md` | UPDATE | Module entries, Stack status, verify catalogue, resolved deferred items. |
| `src/domain/bracket.ts` | DO NOT TOUCH | `advanceBracket` used as-is. |
| `src/data/playoff.ts` `savePlayoffFormation` / `src/actions/playoff.ts` `formPlayoff` | DO NOT TOUCH | Story 4.2 — still creates only the two `SEMIFINAL` rows. |
| `src/domain/tournamentState.ts` | DO NOT TOUCH | `COMPLETED` stub is Story 4.5. |

### Architecture compliance

- **AD-5** — `advanceBracket` is called on **write** (`savePlayoffAdvancement`, after a semifinal result) and on **read** (`getPlayoffBracket`, before the surface renders). `src/data` / components never derive participants themselves. Freeze: a downstream row with its own `SetScore` is `PLAYED` → untouched. [ARCHITECTURE-SPINE.md#AD-5, `.memlog.md` Decision 3b]
- **AD-4** — no winner / score / placement column; `Match` rows persist only the participant slots (themselves derived-until-played). [ARCHITECTURE-SPINE.md#AD-4]
- **AD-2 / AD-3** — the derivation lives only in `src/domain/bracket.ts`; `src/data/playoff.ts` makes the `data → domain` value call (`advanceBracket`), the established edge. [ARCHITECTURE-SPINE.md#AD-2, #AD-3]
- **AD-6 / AD-11** — every write is behind `enter/edit/removeMatchResult` (first line `await requireAdmin()`); every read/write is a named `src/data` function; no Prisma in `src/actions` / `src/app`. [ARCHITECTURE-SPINE.md#AD-6, #AD-11]
- **AD-8** — no state transition here; the story produces the `COMPLETED` precondition. [ARCHITECTURE-SPINE.md#AD-8]
- **NFR-3 / FR-16** — the bracket is a pure derivation, re-run on every semifinal-result change and on every render; no state where it disagrees with the entered results. [PRD NFR-3, FR-16]
- **Consistency Conventions** — `revalidatePath` after every write; a self-cleaning `verify-*.mts` for the new data functions. [ARCHITECTURE-SPINE.md#Consistency]

### Existing code being modified — current state → change → what must be preserved

**`src/data/matches.ts`** (Stories 3.2, 3.5–3.8, 4.2)
- *Current:* `createMatchResult` / `replaceMatchResult` / `deleteMatchResult` / `updateMatchSchedule` all filter `stage: "GROUP"` inside their `where`. `getMatchForResult` is scoped only by `(id, tournamentId)` and returns `stage` + `tournament.{scoringPreset,type,discipline}` + `sets`. `getStandings` / `listGroupMatchesForTournament` / `hasAnyGroupResult` / `allGroupMatchesPlayed` are GROUP-scoped by design.
- *Change:* drop `stage: "GROUP"` from the four result/schedule mutators. Nothing else.
- *Must preserve:* every signature and return shape; the `createMatchResult` `_count.sets === 0` check; `replaceMatchResult`'s delete-then-insert + `not_found` mapping; `deleteMatchResult`'s `{ count }`; the `SET_SCORE_NATURAL_KEY_INDEX` P2002 handling; the GROUP scoping on the four read functions listed above.

**`src/actions/matches.ts`** (Stories 3.5–3.7)
- *Current:* `enterMatchResult` / `editMatchResult` / `removeMatchResult` reject `match.stage !== "GROUP"` with a Ukrainian formError. `parseAndValidate` / `parseSetsFromForm` / `revalidateMatchSurfaces` are shared, stage-agnostic. No playoff calls anywhere.
- *Change:* remove the stage rejection; add the `savePlayoffAdvancement` hook for `SEMIFINAL`.
- *Must preserve:* the `requireAdmin` `AdminRequiredError`-narrow catch; the `parseAndValidate` "Партія N:" mapping; the `sets.length` guards; `scheduleMatch` untouched; the `revalidateMatchSurfaces` targets.

**`src/app/admin/tournaments/[id]/matches/[matchId]/page.tsx`** (Story 3.6)
- *Current:* `getMatchForResult(id, matchId)` → `if (!match || match.stage !== "GROUP") notFound()`. Renders `MatchResultPanel` (has result) or `MatchResultForm`. VM: `preset`, `tournamentType`, `homeTeam` / `awayTeam` names, `sets`.
- *Change:* drop the `stage !== "GROUP"` half of the guard; add a stage label to the heading.
- *Must preserve:* the `!match → notFound()`; the panel-vs-form branch; the VM shape the form/panel consume.

**`src/app/admin/tournaments/[id]/schedule/page.tsx`** (Story 3.5)
- *Current:* `getTournamentForAdmin(id)` → `DRAFT` empty state, else `listGroupMatchesForTournament(id)` → `MatchScheduleList`.
- *Change:* add a `PLAYOFF`+ «Плейоф» section from `getPlayoffBracket(id)`.
- *Must preserve:* the back link, the `DRAFT` `GROUP_NOT_DRAWN` branch, the group-match list and its VM shaping.

**`src/data/playoff.ts`** (Story 4.2)
- *Current:* `savePlayoffFormation(tournamentId, bracket)` + `PlayoffFormationResult`. Imports `db`, `allGroupMatchesPlayed`, `setTournamentState`, `type PlayoffBracket`.
- *Change:* add `getPlayoffBracket` + `savePlayoffAdvancement` (and a `PlayoffBracketView` return type). New import: `advanceBracket` value.
- *Must preserve:* `savePlayoffFormation` verbatim (the `FOR UPDATE`, the `{ ok, reason }` returns, the two re-checks).

### Testing requirements

- **No new Vitest** — `advanceBracket` is exhaustively covered (Story 4.1, 161 cases incl. the freeze rule and the semifinal-edit-before/after-final cases the 4.3 AC names). Confirm `pnpm test` stays **161**.
- **`scripts/verify-advance-bracket.mts`** is the correctness gate — it drives `createMatchResult` / `replaceMatchResult` / `deleteMatchResult` + `savePlayoffAdvancement` directly and asserts the persisted `FINAL` / `THIRD_PLACE` rows (create / update / freeze / null-out) + the tightened CHECK.
- **No action-level test** for the un-scoped `enterMatchResult` playoff path (the standing "no `requireAdmin` / session-mock harness" gap). Mitigated by the verify script covering the data path.
- **Migration verification** — `migrate status` + `migrate diff --exit-code` after `migrate deploy`.
- **Regression:** `pnpm build` (two pages changed) + re-run all prior `verify-*.mts` — the four scripts that create `SEMIFINAL` fixtures now also need those fixtures to satisfy the *tightened* CHECK (they already pass `slot: "SF1"`, which is now `SEMIFINAL ⇔ slot IN ('SF1','SF2')` — still valid).

### Project Structure Notes

- `src/data/playoff.ts` + `src/actions/matches.ts` (not a new `src/actions/playoff.ts` result action) — a deliberate DRY choice: the result-entry parse/validate/save path is identical for group and playoff, so it stays one function set; the playoff-specific reaction (`advanceBracket` on write) is the only playoff logic and it lives in `src/data/playoff.ts` (the spine's `src/actions/playoff` / `src/domain/bracket.ts` capability row is satisfied — the *derivation* is in `bracket.ts`, the *persistence* in `playoff.ts`).
- No new route → no `.next/types` regen; `pnpm build` still runs (two `page.tsx` changed).
- `getPlayoffBracket` is the shared read for this story's admin section and Story 4.6's public bracket — no admin-only fields, one function.

### Previous story intelligence

- **Story 4.1 (done, code-reviewed)** — `advanceBracket(matches: PlayoffMatchState[]): PlayoffBracket`. `indexBySlot` **throws** on a duplicate `slot` ("advanceBracket: two matches for slot X") — `getPlayoffBracket` / `savePlayoffAdvancement` must never build a `PlayoffMatchState[]` with two rows for one slot (the tightened CHECK now makes that a DB-level impossibility for SEMIFINAL too). `advanceBracket` accepts 2–4 matches; a missing `FINAL`/`THIRD_PLACE` slot is synthesised as `AWAITING`/`READY`. The freeze branch keys on `hasOwnResult` = `sets.length > 0`. Downstream slots are evaluated independently (a frozen `FINAL` does not stop `THIRD_PLACE` re-deriving — the AC's last bullet).
- **Story 4.2 (done, code-reviewed)** — `savePlayoffFormation` is the transaction pattern to mirror: `SELECT … FOR UPDATE` first, `{ ok, reason }` returns for normal races, all writes in one `$transaction`. `Match.slot` for `SEMIFINAL` rows is `SF1`/`SF2`. Its review added a per-stage CHECK to `deferred-work.md` as **this story's** job. The 4.2 spec's claim that result CRUD "already scope by `(tournamentId, matchId)` not `stage`" was wrong.
- **Stories 3.6 / 3.7 (done, code-reviewed)** — `enterMatchResult` / `editMatchResult` / `removeMatchResult` + `parseAndValidate` + `revalidateMatchSurfaces`; `MatchResultForm` (`mode: "create" | "edit"`) / `MatchResultPanel` are stage-agnostic. The `"Партія N:"` regex coupling in `parseAndValidate` is a known point — do not touch `validation.ts`.
- **Story 3.5** — the admin schedule page + `MatchScheduleList` + `matchScoreLabel`; `updateMatchSchedule` was `stage: "GROUP"`-scoped (this story un-scopes it).

### Git intelligence

Recent: `c31c9fa` (Story 4.2 review-fix, done) ← `012e54c` ← `9b260a6` (Story 4.2) ← `3304f5f` (Story 4.1 review-fix). `epic-4` `in-progress`; `4-1` + `4-2` `done`, `4-3` `backlog`. `src/domain/bracket.ts` has `advanceBracket` / `seedPlayoff` / `playoffPlacements` (161 Vitest). `src/data/playoff.ts` has `savePlayoffFormation` only. `src/actions/playoff.ts` has `formPlayoff` only. Result CRUD in `src/data/matches.ts` + `src/actions/matches.ts` is GROUP-scoped. Last migration `20260907120000_match_playoff_slot`; `match_slot_stage_check` = `("stage" = 'GROUP') = ("slot" IS NULL)`.

### Latest tech information

- **No new library.** Prisma 7, Next 16 Server Actions, `revalidatePath`, `db.$transaction`. `advanceBracket` is pure TypeScript.
- **Migration** — CHECK-only, raw SQL, hand-written after `migrate diff --script` (shows "empty"), then `migrate deploy` (the Story 2.4 / 3.2 / 4.2 fallback — `migrate dev` is non-interactive-blocked). `DROP CONSTRAINT` + `ADD CONSTRAINT` in one file; no data backfill (no row violates the tighter form).
- **`pnpm build`** regenerates `.next/types` — no new route, so `typecheck` is green without it, but run it (two pages changed).

### Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 4.3 AC, FR-20; the 4.3/4.4 boundary), `prd.md` §4.8 (FR-20) + §4.6 (FR-16), `ARCHITECTURE-SPINE.md` (AD-2/AD-3/AD-4/AD-5/AD-6/AD-8/AD-11, `.memlog.md` Decision 3b, Capability Map), `SPEC.md` (CAP-9, Constraints "заморожуються після внесення власного результату"), `EXPERIENCE.md` (Bracket — read-only, "при наступному завантаженні"; KF-1 §7; no toast for the auto-fill), `DESIGN.md` (`bracket-pair` / `bracket-pair-tbd` tokens — Story 4.6), `4-1-domain-engine-bracket.md` (`advanceBracket` contract, freeze rule, 2–4-match input), `4-2-generate-playoff.md` (`savePlayoffFormation` pattern, `Match.slot`, the wrong "already un-scoped" note), `3-6-…md` / `3-7-…md` (result-entry actions + form/panel), `deferred-work.md` (the `advanceBracket`-write item, the per-stage CHECK item, the "team in two places" hazard, `needsManualSeed` render).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.3: Автоформування фіналу й матчу за 3-тє місце] — user story + AC; FR-20
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.4] — the boundary: 4.4 = "вношу результат так само, як груповий" + places 1–4 (re-allocated: 4.3 does the un-scoping, 4.4 the placements + edit-gate)
- [Source: _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md#4.8] — FR-20 "Наслідки"; [#4.6] — FR-16 "Плейоф-сітка перераховується"
- [Source: …/ARCHITECTURE-SPINE.md#AD-5] — `advanceBracket` on write AND render; freeze after own `SetScore` · [#AD-4] · [#AD-2] · [#AD-6] · [#AD-11] · [#Capability → Architecture Map]
- [Source: …/architecture/…/.memlog.md#Decision 3b] — playoff Match rows persisted; downstream slots derived-until-played then frozen
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#CAP-9] · [#Constraints] — auto-fill after semifinals, freeze after own result
- [Source: …/ux-designs/…/EXPERIENCE.md#Component Patterns — Bracket] · [#Key Flows — KF-1] — read-only bracket, fills "при наступному завантаженні", no auto-fill toast
- [Source: _bmad-output/implementation-artifacts/4-1-domain-engine-bracket.md] — `advanceBracket` / `PlayoffMatchState` / `PlayoffBracket`, the freeze rule, 2–4-match input, `indexBySlot` throws on dup slot
- [Source: _bmad-output/implementation-artifacts/4-2-generate-playoff.md] — `savePlayoffFormation` transaction pattern, `Match.slot`, the per-stage CHECK assigned here, the incorrect "already un-scoped" note
- [Source: _bmad-output/implementation-artifacts/3-6-enter-match-result.md] · [3-7-edit-delete-result.md] — `enter/edit/removeMatchResult`, `parseAndValidate`, `MatchResultForm` / `MatchResultPanel`
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — "`advanceBracket` on the write path — Story 4.3"; "tighten `match_slot_stage_check` … in its own migration — Story 4.3"; "team in two places … Story 4.4/4.5"; "`needsManualSeed` render … Story 4.6"

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (bmad-dev-story)

### Debug Log References

- `verify-advance-bracket.mts` first run: a `pg` `DeprecationWarning` ("Calling client.query() when the client is already executing a query") fired inside `savePlayoffAdvancement` — a nested-relation `findMany` right after the `$queryRaw … FOR UPDATE` in the transaction. Fixed by splitting it into two flat queries (`match.findMany` scalars + `setScore.findMany`). `getPlayoffBracket` (no transaction) keeps the nested read.
- `match_slot_stage_check` (migration `20260907130000`) had a SQL NULL hole: `NULL IN ('SF1','SF2')` evaluates to NULL, and a CHECK constraint passes on NULL (only an explicit FALSE fails it) — so a `stage = 'SEMIFINAL', slot = NULL` row was accepted (`verify-generate-playoff.mts`'s probe caught it). Fixed with a corrective migration `20260907140000` requiring `"slot" IS NOT NULL` in each non-GROUP branch.

### Completion Notes List

- Task 1: migration `20260907130000_match_slot_stage_per_stage` + corrective `20260907140000_..._fix` — `match_slot_stage_check` is now per-stage (`SEMIFINAL ⇔ slot IN ('SF1','SF2')`, `THIRD_PLACE ⇔ 'THIRD_PLACE'`, `FINAL ⇔ 'FINAL'`), null-safe.
- Task 2: `src/data/playoff.ts` — `getPlayoffBracket` (render `advanceBracket` → `PlayoffBracketView` decorated with `matchId` / team names / score / schedule) + `savePlayoffAdvancement` (write `advanceBracket` — `FOR UPDATE`, two flat tx reads, per downstream slot: `PLAYED` skip / `READY` create-or-update / `AWAITING` clear).
- Task 3: `src/data/matches.ts` — dropped `stage: "GROUP"` from `createMatchResult` / `replaceMatchResult` / `deleteMatchResult` / `updateMatchSchedule`; the read functions stay GROUP-scoped.
- Task 4: `src/actions/matches.ts` — removed the `stage !== "GROUP"` rejections; `advancePlayoffAfterSemifinal` helper (log-and-swallow) called after a `SEMIFINAL` result save / replace / delete.
- Task 5: match screen — dropped `stage !== "GROUP" → notFound`; `STAGE_LABELS` in the meta line.
- Task 6: admin schedule page — a `PLAYOFF`/`COMPLETED` «Плейоф» section from `getPlayoffBracket`, rendered by `src/components/playoff-schedule.tsx` (NEW, server, read-only).
- Task 7: `scripts/verify-advance-bracket.mts` (NEW, 15 assertions). `verify-match-schedule` / `verify-match-result` / `verify-edit-delete-result` SEMIFINAL-fixture assertions updated to the un-scoped behaviour.
- Task 8: docs — `src/data/README.md`, `src/actions/README.md`, `src/components/README.md`, `AGENTS.md` (Stack bullet + verify line), `deferred-work.md` (write-path + CHECK items resolved; the 4.3/4.4 re-allocation; the separate-transaction and `pg`-warning notes).
- Task 9: `pnpm build` / `typecheck` / `lint` clean; `pnpm test` **161/161** (no new Vitest); all 10 verify scripts green; `migrate status` clean.

### File List

- `prisma/migrations/20260907130000_match_slot_stage_per_stage/migration.sql` (NEW)
- `prisma/migrations/20260907140000_match_slot_stage_per_stage_fix/migration.sql` (NEW)
- `src/data/playoff.ts` (UPDATE)
- `src/data/matches.ts` (UPDATE)
- `src/actions/matches.ts` (UPDATE)
- `src/app/admin/tournaments/[id]/matches/[matchId]/page.tsx` (UPDATE)
- `src/app/admin/tournaments/[id]/schedule/page.tsx` (UPDATE)
- `src/components/playoff-schedule.tsx` (NEW)
- `scripts/verify-advance-bracket.mts` (NEW)
- `scripts/verify-match-schedule.mts` · `scripts/verify-match-result.mts` · `scripts/verify-edit-delete-result.mts` (UPDATE — SEMIFINAL-fixture assertions)
- `src/data/README.md` · `src/actions/README.md` · `src/components/README.md` · `AGENTS.md` · `_bmad-output/implementation-artifacts/deferred-work.md` (UPDATE)

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-07 | Story drafted (`bmad-create-story`, 4 research subagents: epics 4.3/4.4 boundary / architecture+PRD+SPEC / UX / code precedent). Status: ready-for-dev. |
| 2026-09-07 | Implementation complete (`bmad-dev-story`) — all 10 tasks. Two migrations tighten `match_slot_stage_check` per-stage (+ NULL-hole fix). `getPlayoffBracket` / `savePlayoffAdvancement` wire `advanceBracket` on read + write; result CRUD un-scoped for playoff stages; «Плейоф» section on the admin schedule page. `verify-advance-bracket.mts` (15 assertions). `pnpm build`/`typecheck`/`lint` clean, `pnpm test` 161/161, all verify scripts green, `migrate status` clean. Status: review. |
| 2026-09-07 | Code review (`bmad-code-review`; subagents rate-limited, run in-session across the 4 lenses) — 0 decision-needed, 1 patch, 2 deferred, 6 dismissed. Patch applied: `enterMatchResult` rejects a participant-less playoff match; `PlayoffSchedule` hides the result link until participants are decided; `verify-advance-bracket.mts` +1 assertion. Gate re-run clean (`typecheck`/`lint`/`build`, `pnpm test` 161/161, all 10 verify scripts, `migrate status`). Status: done. |
