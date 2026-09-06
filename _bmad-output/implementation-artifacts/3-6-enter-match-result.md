---
baseline_commit: 8091c1a
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/implementation-artifacts/3-1-domain-engine-scoring-tiebreak-schedule-validation.md
  - _bmad-output/implementation-artifacts/3-2-group-stage-schema.md
  - _bmad-output/implementation-artifacts/3-3-draw.md
  - _bmad-output/implementation-artifacts/3-5-match-scheduling.md
  - _bmad-output/implementation-artifacts/2-8-roster-players.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - AGENTS.md
---

# Story 3.6: Внести результат матчу

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an адмін,
I want внести рахунок матчу по партіях,
so that фіксується підсумок гри й перераховується таблиця (FR-15).

## Acceptance Criteria

Translated from `epics.md` → Epic 3 → Story 3.6. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** a `GROUP` match with **no result yet**, I am an admin
**When** I enter each set's score (field count per preset: up to 5 / exactly 3) and save
**Then**

1. The score is validated **through `src/domain/validation.ts`**; the error is shown **next to the field**.
2. The set tally ("3:1") is **computed and shown alongside** — it is **not typed in by hand**.
3. On save, `revalidatePath` of the tournament page is called and the **group standings table is recomputed**.

PRD §4.6 (`prd.md`, in context) restates the same and adds precision:

- FR-15: "Адмін вносить Результат матчу як рахунок кожної Партії; **кількість Партій і рахунки валідуються за Системою очок**; підсумковий рахунок у Партіях обчислюється автоматично; **після збереження перераховується Таблиця групи**."
- The set-count and score rules already live in `src/domain/validation.ts` (Story 3.1): `CLASSIC` 3–5 sets (win-by-2, target 25, decisive 5th to 15, `VETERAN` all sets to 15), `CUSTOM` exactly 3 sets. The match must be **decided** (`CLASSIC`: one side reaches 3 set wins on the last set, no set after that).
- EXPERIENCE.md: **Score input (admin)** — "поля рахунку по партіях; кількість за пресетом (до 5 / рівно 3). Валідація за правилами пресету перед збереженням; помилку показувати біля поля. Підсумок у партіях («3:1») рахується й показується поруч, не вводиться руками." **Match row (admin)** — action «Внести результат»; `success` mark when a result exists.
- UJ-1 (`prd.md`): "Олег проходить по згенерованих матчах ... Після кожного туру відкриває матч і вносить рахунок по партіях. Таблиця групи перераховується сама."

## Notes on AC interpretation

- **This story is create-only. Editing and deleting a result is Story 3.7.** The AC's "Given матч без результату" scopes this to the first-entry case. If a result already exists, the match screen shows it read-only (no edit affordance yet — 3.7 adds it), and the Server Action refuses a second entry (`formError`).

- **No schema change.** `SetScore` (`matchId`, `setNo`, `homePoints`, `awayPoints`, `@@unique([matchId, setNo])`, CHECK `setNo` 1–5, CHECK non-negative points) landed in Story 3.2. This story only creates rows. **`prisma/schema.prisma` must not be touched.**

- **The domain is done — do not re-implement any scoring rule.** `src/domain/validation.ts` (Story 3.1) is the *sole* validator, exactly as the AC demands ("валідується через `src/domain/validation.ts`"):
  - `targetScore(preset, tournamentType, setNo)` — 15 for `VETERAN` (any set), 15 for `CLASSIC`'s 5th set, else 25.
  - `validateSetScore(home, away, target)` — non-negative integers, higher side ≥ target, win-by-2 (both presets).
  - `validateMatchScore(sets, preset, tournamentType)` — set count per preset, contiguous `setNo` from 1, each set valid, and (`CLASSIC` only) the match is decided with no extra set. Returns `{ ok: true } | { ok: false; message }` — **one message**, prefixed `Партія N: …` when the failure is set-specific.
  - `matchPoints` / `computeStandings` (`src/domain/scoring.ts`) already turn valid sets into standings — `getStandings` (`src/data/matches.ts`) already calls them. **No standings code changes.**

- **`validateMatchScore` returns one message; the AC wants it "біля поля".** Map it: a message matching `^Партія (\d+): (.+)$` renders under that set's row; any other message (`"Класичний пресет: від 3 до 5 партій."`, `"Матч не завершено …"`, `"Зайва партія …"`) renders as a form-level error above the submit button. Additionally the form runs a cheap client-side per-field check first (non-empty, integer) so the admin gets immediate per-field feedback before the round-trip — but the server's `validateMatchScore` is always the authority (NFR-1: client checks are not the control).

- **The set tally is computed, never an input.** Add a pure `matchSetSummary(sets): { home: number; away: number }` to `src/domain/scoring.ts` (it already has the private `countSetsWon` and the public `homeWonSet` — expose a summary built on the same comparison). The client form derives the live "X:Y" from its filled rows via this function; the read-only match screen and the schedule list derive it from persisted `SetScore` rows the same way. This is the **canonical helper the Story 3.5 review deferred to this story** — replace the two inline `setSummary` reducers (`src/app/classic/[tournament]/page.tsx`, `src/app/admin/tournaments/[id]/schedule/page.tsx`) with it.

- **The match screen is a new route: `/admin/tournaments/[id]/matches/[matchId]`.** EXPERIENCE.md: CAP-7 → "екран матчу в адмінці"; UJ-1 "відкриває матч, вводить рахунок". Reached from a per-row link on the existing `/admin/tournaments/[id]/schedule` page (that page is the match list — Story 3.5 built it): each row gets «Внести результат» (no result yet) or «Результат: X:Y» with a `success` check (result exists). **New deeply-nested dynamic route** → `pnpm build` before `pnpm typecheck` to regenerate `.next/types` for `PageProps<"/admin/tournaments/[id]/matches/[matchId]">` (documented pitfall — Story 2.8 / 3.5 both hit it).

- **Score-input field count is preset-driven (UX-DR8 / DESIGN.md):**
  - `CUSTOM` → exactly 3 set rows, all required.
  - `CLASSIC` → 3 rows shown initially; a "Додати партію" control adds a 4th and 5th (max 5); trailing empty rows are simply not submitted. `validateMatchScore` rejects an under-decided or over-long match, so the UI does not need its own "match is complete" logic beyond "submit the filled rows in order".
  - Number inputs: `inputMode="numeric"`, `tabular-nums` on the score cells (DESIGN.md §139 — mandatory on every numeric cell).

- **"Таблиця перерахована" is delivered as recompute + revalidation, not a visible table** (decision confirmed by the user — option A). The public «Таблиця» tab is Story 3.8 (and its chip is currently hidden — Story 3.5 review decision). After this story, `getStandings(tournamentId)` returns correct standings and `enterMatchResult` calls `revalidatePath` on the public tournament route, so Story 3.8's tab will render fresh data the moment it ships. `verify-match-result.mts` proves the recompute. **Do not build any visible standings surface in this story.**

- **Revalidation targets:** the public tournament route (`/${discipline}/${id}` — schedule tab shows the tally, and Story 3.8's standings tab), `/admin/tournaments/${id}/schedule` (the row's tally + `success` mark), `/admin/tournaments/${id}/matches/${matchId}` (the screen flips to read-only), and `/admin/tournaments/${id}` — because entering the **first** result flips `hasAnyGroupResult` to `true`, which disables the redraw button (Story 3.4), and moves toward the `GROUP_STAGE → PLAYOFF` precondition (`allGroupMatchesPlayed`, Story 4.2).

- **`createMatchResult` is scoped and guarded.** `db.$transaction`: confirm the match exists, belongs to `tournamentId`, is `stage: "GROUP"`, and has **zero** `SetScore` rows; then `createMany`. A concurrent second entry hits `@@unique([matchId, setNo])` (`P2002`) inside the transaction and rolls back — map it to a "вже внесено" `formError`, don't let it escape. Same `(parentId, childId)`-scoping discipline as `updateMatchSchedule` / `players.ts`.

- **No `success`-token Tailwind utility exists yet.** DESIGN.md names `#1F8A54` for "результат внесено". `notify` uses it as a toast background; there is no `text-success` class. For the schedule-row check indicator, use a small `lucide-react` `CheckIcon` with an explicit color (`className="text-[#1F8A54]"` or a token if Story 1.2's theme exposes one — check `globals.css` first). Do not invent a new component; a plain icon + the "Результат: X:Y" text is enough. A reusable "Зіграно" match-status badge, if wanted, is Story 3.8's call (it owns the public match/standings surfaces).

## Tasks / Subtasks

- [x] **Task 1 — `src/domain/scoring.ts` (UPDATE): `matchSetSummary`** (AC: 2)
  - [x] `matchSetSummary(sets): { home: number; away: number }` — counts via `homeWonSet`; `countSetsWon` refactored to delegate (no duplicated loop).
  - [x] `src/domain/scoring.test.ts` — 6 cases (3:0, 3:1, 3:2, 0:3, empty, CUSTOM 2:1).
  - [x] `pnpm test` 131/131; `typecheck`/`lint` clean.

- [x] **Task 2 — replace the inline `setSummary` reducers** (AC: 2)
  - [x] `src/app/classic/[tournament]/page.tsx` — local reducer → `formatResult` calling `matchSetSummary` (renamed to avoid shadowing the `resultSummary` field).
  - [x] `src/app/admin/tournaments/[id]/schedule/page.tsx` — same.
  - [x] `deferred-work.md` — both "inline `setSummary`" items marked resolved.
  - [x] `typecheck`/`lint` clean.

- [x] **Task 3 — `src/data/matches.ts` (UPDATE): `getMatchForResult` + `createMatchResult`** (AC: 1, 3)
  - [x] `getMatchForResult(tournamentId, matchId)` — pair-scoped `findFirst` with team names, stage, schedule, existing sets, and `tournament: { scoringPreset, type, discipline }`. `null` on mismatch.
  - [x] `createMatchResult(tournamentId, matchId, sets)` — one `$transaction`: `_count.sets` check (`not_found` / `exists`) → `createMany`; `P2002` on `SET_SCORE_NATURAL_KEY_INDEX` caught → `exists`. `{ ok: true } | { ok: false; reason }`.
  - [x] `SET_SCORE_NATURAL_KEY_INDEX = "set_score_matchId_setNo_key"`.
  - [x] `typecheck`/`lint` clean. `isUniqueViolation` imported from `@/data/errors` (within `src/data`).

- [x] **Task 4 — `src/actions/matches.ts` (UPDATE): `enterMatchResult`** (AC: 1, 2, 3) — `MatchResultFormState` (`setErrors`/`formError`), narrow `requireAdmin` catch, `getMatchForResult` guards (not found / not GROUP / already has result), `parseSetsFromForm` (contiguous `home-N`/`away-N`, gap → formError, non-integer → setErrors), `validateMatchScore` with `/^Партія (\d+): (.+)$/` message mapping, `createMatchResult`, 4× `revalidatePath`. `typecheck`/`lint` clean.
  - [x] `export type MatchResultFormState = { setErrors?: Record<number, string>; formError?: string }`.
  - [x] `enterMatchResult(tournamentId: string, matchId: string, _prev: MatchResultFormState, formData: FormData): Promise<MatchResultFormState>` —
    - narrow `requireAdmin()` catch → `{ formError: "Потрібні права адміністратора." }`.
    - `getMatchForResult(tournamentId, matchId)` → null → `{ formError: "Матч не знайдено." }`; `match.stage !== "GROUP"` → `{ formError: "Результат можна вносити лише для матчів групового етапу." }`; `match.sets.length > 0` → `{ formError: "Результат уже внесено." }`.
    - parse `formData`: for `setNo` 1..5 read `home-${n}` / `away-${n}`; a set is *present* if either is a non-empty string. Take the contiguous run of present sets from 1 (a gap → `{ formError: "Заповніть партії по порядку, без пропусків." }`). For each present set, parse both fields as integers; a non-integer / empty half → `setErrors[n] = "Вкажіть рахунок партії цілим числом."`. If any `setErrors`, return them.
    - `validateMatchScore(parsedSets, match.tournament.scoringPreset, match.tournament.type)` (`@/domain/validation`) → not ok → `const m = /^Партія (\d+): (.+)$/.exec(check.message)` → `m` ? `{ setErrors: { [Number(m[1])]: m[2] } }` : `{ formError: check.message }`.
    - `createMatchResult(tournamentId, matchId, parsedSets)` → `reason: "not_found"` → `{ formError: "Матч не знайдено." }`; `reason: "exists"` → `{ formError: "Результат уже внесено." }`.
    - `revalidatePath(`/${match.tournament.discipline === "BEACH" ? "beach" : "classic"}/${tournamentId}`)`, `revalidatePath(`/admin/tournaments/${tournamentId}/schedule`)`, `revalidatePath(`/admin/tournaments/${tournamentId}/matches/${matchId}`)`, `revalidatePath(`/admin/tournaments/${tournamentId}`)`.
    - return `{}`.
  - [x] `typecheck`/`lint` clean.

- [x] **Task 5 — `src/components/match-result-form.tsx` (NEW): Score input** (AC: 1, 2)
  - [x] `"use client"`. `MatchResultForm({ tournamentId, matchId, preset, homeTeam, awayTeam }: { tournamentId: string; matchId: string; preset: "CLASSIC" | "CUSTOM"; homeTeam: string; awayTeam: string })`.
  - [x] `useActionState(enterMatchResult.bind(null, tournamentId, matchId), {})`. Fully controlled state: `useState<{ home: string; away: string }[]>` seeded with 3 empty rows.
  - [x] Rows: each is `home` + `away` `<Input inputMode="numeric" className="tabular-nums" name={`home-${i+1}`}>` / `away-${i+1}`. `CUSTOM` → the 3 rows are fixed. `CLASSIC` → a "Додати партію" `Button` appends a row (disabled at 5); a trailing empty row can be removed. Row `setNo` label "Партія N".
  - [x] Live summary: `matchSetSummary(rows.filter(both filled & integer).map(...))` → renders "{home} : {away}" (`tabular-nums`), labelled, next to / below the rows — visibly not an input.
  - [x] Errors: `state.setErrors?.[n]` renders under set N's row (`aria-invalid` / `aria-describedby` on both inputs of that row); `state.formError` renders above the submit `Button` and also `notify.error` (effect keyed on `state`).
  - [x] Falling-edge-of-`pending` success effect (the `useRef` technique — `player-form.tsx`): `notify.success("Результат збережено")` + `router.refresh()` (the page re-renders read-only from fresh props).
  - [x] Submit `Button` `disabled={pending}` + spinner (EXPERIENCE "кнопка на час запиту — disabled + спінер").
  - [x] `typecheck`/`lint` clean.

- [x] **Task 6 — `src/app/admin/tournaments/[id]/matches/[matchId]/page.tsx` (NEW route)** (AC: 1, 2)
  - [x] Server Component. `getTournamentForAdmin(id)` → `notFound()` if falsy (keeps the tournament-name header + the `/admin` auth-gate story consistent). `getMatchForResult(id, matchId)` → `notFound()` if falsy or `stage !== "GROUP"`.
  - [x] Header: back-link to `/admin/tournaments/${id}/schedule`, `<h1>` "{homeTeam} — {awayTeam}", the scheduled time (`formatKyivDateTime` if set, else "час не визначено" — read-only, owned by Story 3.5). `export const metadata = { title: "Матч" }` (static — the Story 2.5 rationale).
  - [x] If `match.sets.length > 0` → render the result read-only: a set-by-set list (`tabular-nums`) + the `matchSetSummary` tally + a muted line "Виправлення й видалення результату — у наступному оновленні." (Story 3.7). Else → `<MatchResultForm tournamentId={id} matchId={matchId} preset={match.tournament.scoringPreset} homeTeam={…} awayTeam={…} />`.
  - [x] **New route** → `pnpm build` before `pnpm typecheck`.
  - [x] `typecheck`/`lint` clean.

- [x] **Task 7 — `src/components/match-schedule.tsx` (UPDATE): result link per row** (AC: 2)
  - [x] `MatchRow` gains nothing new (it already has `resultSummary`). In `MatchScheduleRow`'s header area add a `<Link href={`/admin/tournaments/${tournamentId}/matches/${match.id}`}>`: text «Внести результат» when `resultSummary` is null, else «Результат: {resultSummary}» preceded by a small `success`-colored `CheckIcon` (see Notes — check `globals.css` for a token; otherwise an explicit color).
  - [x] Preserve the existing scheduling form and its effects verbatim.
  - [x] `typecheck`/`lint` clean.

- [x] **Task 8 — Docs**
  - [x] `src/domain/README.md` — `scoring.ts` entry gains `matchSetSummary`.
  - [x] `src/data/README.md` — `matches.ts` entry gains `getMatchForResult` / `createMatchResult` + `SET_SCORE_NATURAL_KEY_INDEX`.
  - [x] `src/actions/README.md` — `matches.ts` entry gains `enterMatchResult`.
  - [x] `src/components/README.md` — `match-result-form.tsx` entry; note the `match-schedule.tsx` result link.
  - [x] `AGENTS.md` — Stack-status bullet for Story 3.6; add `scripts/verify-match-result.mts` to "Running and verifying".
  - [x] `deferred-work.md` — mark the "inline `setSummary`" item resolved (Task 2); new "Story 3.6 implementation" section for residuals (no action-level test; the "таблиця перерахована" clause has no visible surface until 3.8; the `setErrors` regex-mapping of `validateMatchScore`'s message is a coupling point).

- [x] **Task 9 — `scripts/verify-match-result.mts` (NEW, self-cleaning)** (AC: 1, 3)
  - [x] Create two throwaway drawn 4-team tournaments — one `CLASSIC`, one `CUSTOM` (the `verify-draw.mts` pipeline). For the `CLASSIC` one, pick a `GROUP` match:
    - `createMatchResult(tId, matchId, [{1,25,20},{2,25,18},{3,25,22}])` → `{ ok: true }`; assert 3 `SetScore` rows exist; `getStandings(tId)` shows the home entry with `played: 1`, `wins: 1`, `points: 3`, `setsWon: 3`, `setsLost: 0` and the away entry `losses: 1`, `points: 0`.
    - `createMatchResult` on the **same** match again → `{ ok: false, reason: "exists" }`; still exactly 3 `SetScore` rows.
    - `createMatchResult(otherTId, matchId, …)` → `{ ok: false, reason: "not_found" }`.
    - Create a `SEMIFINAL` match on `tId`; `createMatchResult(tId, semifinalId, …)` → `{ ok: false, reason: "not_found" }` (stage scope).
  - [x] For the `CUSTOM` tournament: `createMatchResult` with exactly 3 sets (`1p` each) → `{ ok: true }`; `getStandings` reflects `CUSTOM` scoring (1 point per set won).
  - [x] Full teardown (delete both tournaments — cascades matches/sets — and teams).
  - [x] Re-run all prior verify scripts (now 12 incl. `verify-match-schedule.mts`) — no regression.
  - [x] Real command output + notes in the Dev Agent Record.

- [x] **Task 10 — Verification gate** (AC: all)
  - [x] `pnpm build` (new route) → `pnpm typecheck` → `pnpm lint` → `pnpm test` (new `matchSetSummary` cases; `validateMatchScore` is already exhaustively covered by Story 3.1's suite — no new validation tests needed).
  - [x] Import-boundary grep: no new Prisma-client import outside `src/data/**`; `match-result-form.tsx` imports `matchSetSummary` from `@/domain/scoring` (the sanctioned `view → domain` pure-fn edge).
  - [x] `scripts/verify-match-result.mts` green (12 assertions); all 11 prior verify scripts green.

  _Residual (not a blocking subtask — matches every prior admin-touching story):_ a manual signed-in browser pass was not performed in this session (no auth session available to the tooling). Mitigated by `verify-match-result.mts` + `scoring.test.ts` + the full build/typecheck/lint/test gate. Recommended with code review: open a `GROUP` match from the schedule page → enter 3:0 → success toast, screen flips to read-only, schedule row shows «Результат: 3:0» with the check; enter an invalid score (25:24) → error under the set row; retry a saved match → «Результат уже внесено».

- [x] **Task 11 — Commit(s)** — one commit + `git push origin main` per completed task group. `build`/`typecheck`/`lint`/`test` gated each.

### Review Findings

_Code review (`bmad-code-review`, 4 layers: Blind Hunter, Edge Case Hunter, Verification Gap Reviewer, Acceptance Auditor) over `git diff 8091c1a..HEAD`. All 4 layers completed. 0 decision-needed, 14 patch, 1 defer, 6 dismissed._

_Dismissed (6): non-integer error string differs from the spec draft (the code's "цілим невідʼємним числом" is strictly more accurate); the schedule-row score moved from the meta line into the `<Link>` (still visible, and the link is the actionable target); static `metadata = { title: "Матч" }` (correct for `/admin/**` per the Story 2.5 rationale — `generateMetadata` would read admin-only data / leak a draft name ahead of the auth gate); `countSetsWon` as a thin `{home,away}` → `{homeSetsWon,awaySetsWon}` adapter (the naming reads better in the standings context — a semantic wrapper, not noise); `setErrors` keyed to a non-existent set row (`parseSetsFromForm` builds a contiguous `1..N` array and `validateMatchScore` enforces contiguity, so the message's `N` always maps to a rendered row); the client live-tally tie edge beyond what the `matchSetSummary` fix covers._

#### Patch

_All 14 patches applied in the review-fix pass. `pnpm build`/`typecheck`/`lint` clean, `pnpm test` 135/135, `verify-match-result.mts` (13 assertions incl. the new `SET_SCORE_NATURAL_KEY_INDEX` check) + all 11 prior verify scripts green._

- [x] [Review][Patch] `matchSetSummary` credits a tied set to the away side `[src/domain/scoring.ts]` — `homeWonSet` is a strict `>`, so the `else` branch counts a `home === away` set as an away win; the two deleted inline reducers used a 3-way check that credited neither. Unreachable for persisted data (`validateSetScore` enforces win-by-2) but this is now the *canonical* helper feeding `computeStandings` and every result surface. Fix: 3-way comparison (tie → neither side); reword the doc comment ("computed never typed" → "computed, not hand-entered — AC 2").
- [x] [Review][Patch] A large digit string in a score field overflows Postgres `int4` → unhandled 500 `[src/actions/matches.ts parseSetsFromForm]` — `"99999999999999999999"` → `Number()` = `1e20`, `Number.isInteger(1e20)` is `true`, `/^\d+$/` matches, `validateSetScore` (no upper cap by design) passes, then `createMany` hits `int4` overflow with no catch. Fix: cap the score token at 3 digits (`/^\d{1,3}$/`) in `parseSetsFromForm`, plus `maxLength={3}` / `inputMode` on the form inputs (the "cheap client-side check" the Notes call for — also addresses the Acceptance Auditor's "per-field pre-check not implemented" finding).
- [x] [Review][Patch] Empty-form submission returns a message wrong for `CUSTOM` and decides set count outside `validation.ts` `[src/actions/matches.ts parseSetsFromForm]` — zero filled rows → `{ formError: "Введіть рахунок хоча б трьох партій." }` short-circuits before `validateMatchScore`; for `CUSTOM` the rule is "рівно 3", and 1–2 filled rows already fall through to the domain's preset-correct message. Fix: drop the short-circuit, return `{ ok: true, sets: [] }`, let `validateMatchScore([], preset, type)` produce the message (it already does — "Кастомний пресет: рівно 3 партії." / "Класичний пресет: від 3 до 5 партій."). AC: "validated through `src/domain/validation.ts`".
- [x] [Review][Patch] `createMatchResult` doesn't handle a mid-transaction match delete `[src/data/matches.ts, src/actions/matches.ts]` — a concurrent redraw that deletes the `GROUP` match between `findFirst` and `createMany` surfaces as an unhandled `P2003`/`P2025`. Fix: catch those (alongside the existing `P2002`) → `reason: "not_found"`; `enterMatchResult`'s `not_found` message gains a "оновіть сторінку" hint.
- [x] [Review][Patch] The regex↔`validateMatchScore` message coupling is untested `[src/domain/validation.test.ts]` — `enterMatchResult` maps a per-set failure to `setErrors[N]` by parsing `/^Партія (\d+): (.+)$/`; `validation.test.ts` only asserts `.ok`, so a reword of `validation.ts`'s message template silently degrades every per-set error to a form-level one with no failing test. Fix: add a `validation.test.ts` case pinning the `Партія N:` prefix (`expect.stringMatching(/^Партія \d+: /)`). Already flagged in `deferred-work.md`.
- [x] [Review][Patch] `SET_SCORE_NATURAL_KEY_INDEX` string is unverified by any test `[scripts/verify-match-result.mts]` — the "second entry → exists" case exits via the `_count` branch, never the `P2002` catch, so a wrong index name would only bite on the concurrent-race path (500 instead of "exists"). The name is correct (`set_score_matchId_setNo_key`, checked against `pg_indexes`) — add an assertion in the verify script that a duplicate `(matchId, setNo)` insert is caught by `isUniqueViolation(err, SET_SCORE_NATURAL_KEY_INDEX)`.
- [x] [Review][Patch] `matchScoreLabel` — finish the dedup `[src/domain/scoring.ts + both pages]` — Story 3.6's goal was to kill the inline `setSummary`, but only the *counting* moved to `matchSetSummary`; the `{home,away}` → `"X:Y"` wrapper (`formatResult`) is still copy-pasted verbatim into `classic/[tournament]/page.tsx` and `admin/tournaments/[id]/schedule/page.tsx`. Add `matchScoreLabel(sets): string | null` next to `matchSetSummary` and use it in both.
- [x] [Review][Patch] Set-count bounds (3–5) restated as literals in three layers `[src/domain/validation.ts, src/actions/matches.ts, src/components/match-result-form.tsx]` — `MAX_SETS = 5` (action), `MIN_SETS = 3` / `MAX_SETS = 5` (form), `sets.length < 3 || sets.length > 5` (domain). Export `MATCH_SETS_MIN` / `MATCH_SETS_MAX` from `validation.ts` and import them in the action + form (the domain owns the rule; this is a const export, not a rule change).
- [x] [Review][Patch] The match screen drops venue context `[src/data/matches.ts getMatchForResult, src/app/admin/tournaments/[id]/matches/[matchId]/page.tsx]` — `getMatchForResult` doesn't select `venueText`, so the match page shows only date/time while the schedule list shows the venue. Add `venueText` to the select and render it next to the scheduled time.
- [x] [Review][Patch] The per-set target is never shown before submit `[src/components/match-result-form.tsx]` — the target is 25 normally, 15 for a `CLASSIC` decisive 5th set, 15 for every set in a `VETERAN` tournament; the admin only learns this from a post-submit "Партія 5: Партія триває до 15 очок.". Thread `tournamentType` into `MatchResultForm` and show "(до N)" per row via `targetScore` (`@/domain/validation` — the established `view → domain` pure-fn edge).
- [x] [Review][Patch] Dead heavy query on the match page `[src/app/admin/tournaments/[id]/matches/[matchId]/page.tsx]` — `getTournamentForAdmin(id)` is fetched (pulling `group`) but used only for a `!tournament` existence check that `getMatchForResult` (scoped by `tournamentId`, FK-guaranteed) already covers. Drop it.
- [x] [Review][Patch] Repeated link text with no match context `[src/components/match-schedule.tsx]` — every schedule row's `<Link>` reads just "Внести результат" / "Результат: 3:1"; a screen-reader user hears the same phrase down the list. Add `aria-label` including the team names (same fix as the Story 3.5 review's "Зберегти" finding).
- [x] [Review][Patch] `MatchResultForm` polish `[src/components/match-result-form.tsx]` — (a) success detection is `!state.formError && !state.setErrors`; harden to `Object.keys(state).length === 0` (the action returns `{}` on success); (b) `formError` renders both as a `notify.error` toast and a persistent inline `<p>` — the house pattern (`player-form.tsx`, `match-schedule.tsx`) is toast-only, drop the inline; (c) the live tally's `useMemo` should count only the contiguous run of filled rows from set 1 (matching the server), not every filled row.

#### Defer

- [x] [Review][Defer] `text-success` (#1F8A54) as body text on white is ≈ 4.35 : 1 — below WCAG AA (4.5 : 1) for 14px text `[src/components/match-schedule.tsx]` — deferred, folds into the existing design-system contrast pass (tracked since the 2.2 review — `--success` + white ≈ 4.32 : 1). This story is the first to put success-*colored text* (not a toast fill) on screen; the adjacent `CheckIcon` is a redundant cue (UX-DR13 satisfied) and `#1F8A54` is DESIGN.md's named token.

- [x] [Review][Patch] Document the "no `Tournament.state` guard in `enterMatchResult`" decision `[src/actions/matches.ts]` — group results are enterable in `PLAYOFF`/`COMPLETED`. Matching `scheduleMatch` (Story 3.5) and `players.ts` (Story 2.8), which carry the same latitude; structurally, Story 4.2's `allGroupMatchesPlayed` precondition prevents reaching `PLAYOFF` with an unfilled group match. Add a one-line doc comment stating this.

## What this story is / is NOT

**Is:** a preset-driven set-score input on a new admin match screen (`/admin/tournaments/[id]/matches/[matchId]`), validated solely through `src/domain/validation.ts`, persisting `SetScore` rows in one guarded transaction, with an auto-computed set tally and full revalidation so `getStandings` (and Story 3.8's table) recompute; plus the canonical `matchSetSummary` domain helper (closing a Story 3.5 deferral).

**Is NOT** (do not pull forward):
- **Editing or deleting a result.** Story 3.7. This story is create-only and refuses a second entry.
- **The visible public standings table.** Story 3.8 — its chip stays hidden. This story only makes standings *correct and revalidated*.
- **Any schema change.** `SetScore` landed in Story 3.2.
- **Re-implementing any scoring / validation rule.** `src/domain/validation.ts` + `src/domain/scoring.ts` are done (Story 3.1) — call them, never re-derive.
- **The "Сформувати плейоф" button / `GROUP_STAGE → PLAYOFF` transition.** Story 4.2. This story only revalidates the admin page so that button's future precondition read is fresh.
- **Playoff match results.** Epic 4 (`enterMatchResult` is `stage: "GROUP"`-scoped).
- **A "match status / Зіграно badge" component.** Story 3.8 owns the public match surface; a plain check icon + text here is enough.

## Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/domain/scoring.ts` | UPDATE | `matchSetSummary` export. |
| `src/domain/scoring.test.ts` | UPDATE | tally cases. |
| `src/data/matches.ts` | UPDATE | `getMatchForResult`, `createMatchResult`, `SET_SCORE_NATURAL_KEY_INDEX`. |
| `src/actions/matches.ts` | UPDATE | `enterMatchResult` (`MatchResultFormState`). |
| `src/components/match-result-form.tsx` | NEW | Score input (UX-DR8). |
| `src/components/match-schedule.tsx` | UPDATE | per-row result link. |
| `src/app/admin/tournaments/[id]/matches/[matchId]/page.tsx` | NEW | The match screen. |
| `src/app/classic/[tournament]/page.tsx` | UPDATE | inline `setSummary` → `matchSetSummary`. |
| `src/app/admin/tournaments/[id]/schedule/page.tsx` | UPDATE | inline `setSummary` → `matchSetSummary`. |
| `scripts/verify-match-result.mts` | NEW | Self-cleaning DB round-trip. |
| `src/domain/README.md` · `src/data/README.md` · `src/actions/README.md` · `src/components/README.md` · `AGENTS.md` · `deferred-work.md` | UPDATE | Module entries, Stack status, resolved/new deferred items. |
| `prisma/schema.prisma` | DO NOT TOUCH | `SetScore` already exists (Story 3.2). |

## Architecture compliance

- **AD-1** — public pages Server Components, mutations Server Actions. The match screen is a Server Component; `enterMatchResult` is the sole write path. [ARCHITECTURE-SPINE.md#AD-1]
- **AD-3** — `view → shell` (`MatchResultForm` → `enterMatchResult`); `shell → domain` (`enterMatchResult` → `validateMatchScore`); `shell → data` (→ `getMatchForResult` / `createMatchResult`); `view → domain` pure-fn (`MatchResultForm` / pages → `matchSetSummary`); `data → domain` value call is unchanged (`getStandings`). [ARCHITECTURE-SPINE.md#AD-3]
- **AD-4** — `Match` + `SetScore` are the sole source of a result; standings never stored. This story writes only `SetScore`; standings stay computed-on-read via `getStandings`. [ARCHITECTURE-SPINE.md#AD-4]
- **AD-6** — every mutation under `requireAdmin()`. `enterMatchResult`'s first statement. [ARCHITECTURE-SPINE.md#AD-6]
- **AD-11** — `src/data` sole Prisma owner. No new import site — `matches.ts` already imports `db`. [ARCHITECTURE-SPINE.md#AD-11]
- **NFR-1 / NFR-3** — server-side validation is authoritative (`validateMatchScore` in the action); the standings table is a pure function of results and recomputes on every read — no stored, drift-prone copy. [PRD NFR-1, NFR-3]
- **Consistency Conventions** — verb-named action (`enterMatchResult`); `revalidatePath` after the write; UA-only copy; synchronous edit (no optimistic UI), button `disabled` + spinner while pending (EXPERIENCE.md). [ARCHITECTURE-SPINE.md#Consistency Conventions]

## Existing code being modified — current state → change → what must be preserved

**`src/domain/scoring.ts`** (Story 3.1)
- *Current:* `SetScore`/`MatchResult`/`StandingsRow` interfaces, `homeWonSet`, private `countSetsWon`, `matchPoints`, `computeStandings`.
- *Change:* add `matchSetSummary(sets)`; optionally refactor `countSetsWon` to share the body.
- *Must preserve:* `matchPoints` / `computeStandings` verbatim (the whole standings pipeline depends on them, and Story 3.1's 103-test suite pins them).

**`src/data/matches.ts`** (Story 3.2 `getStandings`, 3.4 `hasAnyGroupResult`, 3.5 `listGroupMatchesForTournament` / `updateMatchSchedule`)
- *Current:* five exports.
- *Change:* add `getMatchForResult`, `createMatchResult`, `SET_SCORE_NATURAL_KEY_INDEX`.
- *Must preserve:* `getStandings` verbatim — including its `sets.length > 0` filter (Story 3.2 review fix) — and `hasAnyGroupResult`'s transaction-client signature (Story 3.4 review fix).

**`src/actions/matches.ts`** (Story 3.5 `scheduleMatch`)
- *Current:* one export + `MatchScheduleFormState`.
- *Change:* add `enterMatchResult` + `MatchResultFormState` in the same file (same feature domain — "the match").
- *Must preserve:* `scheduleMatch` verbatim, including its discipline-aware `revalidatePath` (Story 3.5 review fix).

**`src/components/match-schedule.tsx`** (Story 3.5)
- *Current:* `MatchScheduleList` + per-row `MatchScheduleRow` with a scheduling form, effects, `key` on `updatedAt`.
- *Change:* add a `<Link>` to the match screen in the row header.
- *Must preserve:* the scheduling form, both effects, the `key={`${match.id}-${match.updatedAt}`}` remount (Story 3.5 review fix).

**`src/app/classic/[tournament]/page.tsx`** & **`src/app/admin/tournaments/[id]/schedule/page.tsx`** (Story 3.5)
- *Current:* each has a local `setSummary(sets)` reducer.
- *Change:* delete it; call `matchSetSummary` from `@/domain/scoring`.
- *Must preserve:* the `showStandings`/`?tab=` handling (page.tsx) and the DRAFT branch / VM shaping (schedule page) verbatim; `matchSetSummary` is only substituted where `setSummary` was called.

## Testing requirements

- **`src/domain/scoring.test.ts`** — the only new Vitest surface: `matchSetSummary` (3:0, 3:1, 3:2, 0:3, empty, `CUSTOM` 2:1). `validateMatchScore` / `targetScore` / `validateSetScore` are already exhaustively covered by Story 3.1's suite — do **not** add duplicate validation tests. `pnpm test` grows from **125**.
- **`scripts/verify-match-result.mts`** is the real correctness check — first script to persist a result through `createMatchResult` and assert `getStandings` reflects it, for **both** presets, plus the `exists` / `not_found` / stage-scope guards.
- **No component/action test** for `match-result-form.tsx` / `enterMatchResult` — the standing "no component toolchain / no session mock" gap. Mitigated by the verify script + `validateMatchScore`'s Story 3.1 coverage + the documented manual pass.
- **Regression:** all 11 prior verify scripts re-run; `pnpm build` regenerates `.next/types` for the new route before `pnpm typecheck`.

## Previous story intelligence

**Story 3.5 (done, code-reviewed):**
- The `(tournamentId, matchId, stage:"GROUP")` scoping via `updateMany`/a guarded transaction returning a typed outcome is the exact template for `createMatchResult`.
- Discipline-aware `revalidatePath` (`/${discipline}/${id}`) — the review fix; `enterMatchResult` follows it from the start.
- The `player-form.tsx` controlled-form + two-effects (formError toast / falling-edge success) pattern → `match-result-form.tsx`.
- The `matchSetSummary` helper is a *named deferral* from the 3.5 review — this story is its owner; replace both inline copies and mark the deferred-work item resolved.
- New nested dynamic route ⇒ `pnpm build` before `pnpm typecheck`.

**Story 3.1 (done, code-reviewed):** `src/domain/validation.ts` is complete and is the *only* validator — 103 tests pin it. `validateMatchScore` returns one message, `Партія N: …`-prefixed when set-specific. `homeWonSet` is the single "who won a set" comparison — `matchSetSummary` must use it, not a fresh `>` .

**Story 3.2 (done, code-reviewed):** `SetScore` — `@@unique([matchId, setNo])`, CHECK `setNo` 1–5, CHECK non-negative points. `getStandings` trusts every persisted set already passed `validateMatchScore` and filters `sets.length > 0` — do not touch that filter.

**Story 2.8 (done):** `getEntryForAdmin`'s "scope by the pair, `null` on mismatch" is the read-side template for `getMatchForResult`.

## Git intelligence

Recent: `8091c1a` (3.5 review-fix, done) ← `2de49a2`/`5826a93`/`b4796ac`/`8c6e89e`/`81ac616`/`313b61a`/`bf16b77` (3.5 tasks + review). `src/actions/matches.ts` currently exports only `scheduleMatch` + `MatchScheduleFormState`. `src/data/matches.ts` exports `getStandings`, `hasAnyGroupResult`, `listGroupMatchesForTournament`, `updateMatchSchedule`. `src/domain/scoring.ts` exports `homeWonSet`, `matchPoints`, `computeStandings` + the interfaces (no summary helper yet). Two inline `setSummary` reducers exist in the classic + admin-schedule pages, flagged in `deferred-work.md` for this story.

## Latest tech information

- **No new library.** `db.$transaction(async (tx) => …)` (Prisma 7) as `saveDraw` / `saveRedraw` already use it. `useActionState` + `<form action>` (React 19) as `player-form.tsx`.
- **`lucide-react`** is already a dependency (`Loader2Icon` in `match-schedule.tsx`) — `CheckIcon` / `CircleCheckIcon` for the result mark, no new install.
- **Next 16** — a 4-segment dynamic route (`/admin/tournaments/[id]/matches/[matchId]`) is fine; `PageProps<"/admin/tournaments/[id]/matches/[matchId]">` is generated by `next build`.

## Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 3.6 AC, FR-15), `prd.md` §4.6 (FR-15 checkable consequences), `ARCHITECTURE-SPINE.md` (AD-1/AD-3/AD-4/AD-6/AD-11, NFR-1/3), `EXPERIENCE.md` (Score input + Match row primitives, synchronous-edit rule, CAP-7 "екран матчу"), `DESIGN.md` (Score input, `tabular-nums`, `success` color use), `3-1-…md` (`validation.ts` / `scoring.ts` contracts), `3-2-group-stage-schema.md` (`SetScore` constraints), `3-5-match-scheduling.md` (the schedule page = match list, discipline-aware revalidate, `matchSetSummary` deferral), `2-8-roster-players.md` (pair-scoped reads/writes, controlled multi-field form).

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6: Внести результат матчу] — user story + AC; FR-15
- [Source: _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md#4.6] — FR-15 checkable consequences; UJ-1
- [Source: …/ARCHITECTURE-SPINE.md#AD-1, #AD-3, #AD-4, #AD-6, #AD-11] · [PRD NFR-1, NFR-3]
- [Source: …/ux-designs/…/EXPERIENCE.md#Interaction Primitives — Score input, Match row] · [#Взаємодія — synchronous edit, disabled+spinner]
- [Source: …/ux-designs/…/DESIGN.md#Components — Score input] · [#Typography — tabular-nums] · [#Color — success]
- [Source: _bmad-output/implementation-artifacts/3-1-domain-engine-scoring-tiebreak-schedule-validation.md] — `validation.ts` / `scoring.ts` contracts, `Партія N:` message prefix
- [Source: _bmad-output/implementation-artifacts/3-2-group-stage-schema.md] — `SetScore` `@@unique` + CHECKs; `getStandings` `sets.length > 0` filter
- [Source: _bmad-output/implementation-artifacts/3-5-match-scheduling.md] — schedule page as match list; discipline-aware revalidate; `matchSetSummary` deferral
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — "inline `setSummary` duplicated" (Story 3.5 section)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (bmad-dev-story)

### Debug Log References

### Completion Notes List

- Task 1: `matchSetSummary(sets)` added to `src/domain/scoring.ts`; `countSetsWon` now delegates to it (single loop). `scoring.test.ts` +6 cases → `pnpm test` 131/131.
- Task 2: the two inline `setSummary` reducers (`classic/[tournament]/page.tsx`, `admin/tournaments/[id]/schedule/page.tsx`) replaced by a local `formatResult` wrapper over `matchSetSummary` (renamed from `setSummary` to avoid shadowing the `resultSummary` VM field). Both `deferred-work.md` entries marked resolved.
- Task 3: `src/data/matches.ts` — `getMatchForResult` (pair-scoped read, joins team names + tournament preset/type/discipline), `createMatchResult` (`$transaction`: `_count.sets` guard → `createMany`; `P2002` on `SET_SCORE_NATURAL_KEY_INDEX` → `"exists"`), `SET_SCORE_NATURAL_KEY_INDEX = "set_score_matchId_setNo_key"`. `isUniqueViolation` from `@/data/errors`.
- Task 4: `src/actions/matches.ts` — `enterMatchResult` + `MatchResultFormState` + `parseSetsFromForm` helper. Validation is only `validateMatchScore`; a `"Партія N: …"` message → `setErrors[N]`, else `formError`. 4× `revalidatePath` (public route, admin schedule, match screen, admin tournament page).
- Task 5: `src/components/match-result-form.tsx` — Score input. `CUSTOM` 3 fixed rows; `CLASSIC` 3 + "Додати партію"/"Прибрати партію" (3–5). `inputMode="numeric" tabular-nums`, `aria-label` per input. Live `matchSetSummary` tally, labelled "(рахується автоматично)". `setErrors`/`formError` rendering; falling-edge-of-pending success → `notify.success` + `router.refresh()`.
- Task 6: `src/app/admin/tournaments/[id]/matches/[matchId]/page.tsx` (NEW route, 4 segments — `pnpm build` before `pnpm typecheck`). `notFound()` on missing tournament/match or non-GROUP. Result exists → read-only set list + `matchSetSummary` + "виправлення — 3.7"; else `<MatchResultForm>`. Static `metadata`.
- Task 7: `src/components/match-schedule.tsx` — per-row `<Link>` to the match screen: «Внести результат» or `text-success` `CheckIcon` + «Результат: X:Y». `--color-success` already in `globals.css`. Scheduling form untouched.
- Task 8: READMEs (`domain`/`data`/`actions`/`components`), `AGENTS.md` (Stack bullet + verify script), `deferred-work.md` (Story 3.6 section + both `setSummary` items resolved).
- Task 9: `scripts/verify-match-result.mts` — 12 assertions green: `CLASSIC` 3:0 → `getStandings` (3 pts, 1 win, 3 sets), second entry → `exists`, cross-tournament + `SEMIFINAL` → `not_found`, `CUSTOM` 2:1 → `getStandings` (2 pts / 1 pt).
- Task 10: `pnpm build` (new route registered) / `typecheck` / `lint` / `test` 131/131 clean. All 11 prior verify scripts green. No Prisma-client import in any `.tsx`.
- Review-fix pass (`bmad-code-review`, 4 layers): 14 patches applied — `matchSetSummary` 3-way tie handling; score-token capped at 3 digits (server `/^\d{1,3}$/` + `maxLength={3}`) closing an `int4` overflow; empty-form submission now falls through to `validateMatchScore` for the preset-correct message; `createMatchResult` catches `P2003`/`P2025` → `not_found` with an "оновіть сторінку" hint; `validation.test.ts` pins the `Партія N:` prefix; `verify-match-result.mts` gained an `isUniqueViolation(SET_SCORE_NATURAL_KEY_INDEX)` assertion; `matchScoreLabel` in `scoring.ts` replaces the two duplicated `formatResult` wrappers; `MATCH_SETS_MIN`/`MATCH_SETS_MAX` exported from `validation.ts` and consumed by the action + form; the match screen shows `venueText`; per-set target ("до N") shown via `targetScore`; the dead `getTournamentForAdmin` query dropped from the match page; `aria-label` on the schedule-row link; `MatchResultForm` — success via `Object.keys(state).length === 0`, inline `formError` removed (toast only), live tally over the contiguous run; no-state-guard decision documented in a comment. `pnpm test` 135/135, `verify-match-result.mts` 13 assertions, all gates green.

### File List

- `src/domain/scoring.ts` (UPDATE)
- `src/domain/scoring.test.ts` (UPDATE)
- `src/data/matches.ts` (UPDATE)
- `src/actions/matches.ts` (UPDATE)
- `src/components/match-result-form.tsx` (NEW)
- `src/components/match-schedule.tsx` (UPDATE)
- `src/app/admin/tournaments/[id]/matches/[matchId]/page.tsx` (NEW)
- `src/app/classic/[tournament]/page.tsx` (UPDATE)
- `src/app/admin/tournaments/[id]/schedule/page.tsx` (UPDATE)
- `scripts/verify-match-result.mts` (NEW)
- `src/domain/README.md` · `src/data/README.md` · `src/actions/README.md` · `src/components/README.md` (UPDATE)
- `AGENTS.md` (UPDATE)
- `_bmad-output/implementation-artifacts/deferred-work.md` (UPDATE)
- `src/domain/validation.ts` · `src/domain/validation.test.ts` (UPDATE — review fix: `MATCH_SETS_MIN/MAX`, `Партія N:` pin)

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-06 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
| 2026-09-06 | Open question resolved by the user (option A): Story 3.6 makes standings correct + revalidated only; the visible «Таблиця» tab stays hidden until Story 3.8. No visible standings surface is built here. |
| 2026-09-06 | Implementation complete (`bmad-dev-story`) — all 11 tasks done. `pnpm build`/`typecheck`/`lint` clean, `pnpm test` 131/131 (+6), `scripts/verify-match-result.mts` (12 assertions) + all 11 prior verify scripts pass. Two carried `setSummary` deferred items closed. Status: review. |
| 2026-09-06 | Code review (`bmad-code-review`, 4 layers) — 0 decision-needed, 14 patches applied, 1 deferred, 6 dismissed. Overflow guard, preset-correct empty message, `matchScoreLabel` dedup, per-set target display, P2003 handling, message-contract test, a11y label, and more. `pnpm test` 135/135, all gates green. Status: done. |

