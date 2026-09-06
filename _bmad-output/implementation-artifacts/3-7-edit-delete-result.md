---
baseline_commit: 41c0268
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/implementation-artifacts/3-1-domain-engine-scoring-tiebreak-schedule-validation.md
  - _bmad-output/implementation-artifacts/3-2-group-stage-schema.md
  - _bmad-output/implementation-artifacts/3-6-enter-match-result.md
  - _bmad-output/implementation-artifacts/2-8-roster-players.md
  - _bmad-output/implementation-artifacts/2-5-edit-delete-tournament.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - AGENTS.md
---

# Story 3.7: Виправити або видалити результат

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an адмін,
I want змінити чи прибрати раніше внесений результат,
so that я можу виправити помилку (FR-16).

## Acceptance Criteria

Translated from `epics.md` → Epic 3 → Story 3.7. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** a match **with a recorded result**
**When** I edit the score and save
**Then** the group standings table **(and the playoff bracket, if one exists)** are recomputed.
**When** I delete the result **via `ConfirmDialog`**
**Then** the match returns to the **"not played"** state and the table is recomputed.

PRD §4.6 FR-16 (`prd.md`, in context): "Адмін змінює чи видаляє раніше внесений Результат; після зміни/видалення **перераховуються Таблиця групи та (за наявності) Плейоф-сітка**; **видалення повертає Матч у стан «не зіграно»**."

- EXPERIENCE.md **Match row (admin)**: "дія «Внести результат» / **«Виправити»**. Значок `success` коли результат є. **«Видалити результат» — під підтвердженням.**"
- EXPERIENCE.md Voice — destructive confirmation: **"«Видалити результат матчу? Таблиця перерахується.»"**
- UX-DR10: "Патерн підтвердження — shadcn `Dialog` (не нативний `confirm()`) для **видалення результату** / турніру / зняття ролі / завершення турніру; кнопка підтвердження — `destructive`."
- EXPERIENCE.md Взаємодія: "усі зміни синхронні … після успіху сторінка ревалідується, користувач бачить збережений стан. Кнопка на час запиту — `disabled` + спінер."

## Notes on AC interpretation

- **No schema change, no new domain module, no new route.** `SetScore` (Story 3.2), `validateMatchScore` / `matchSetSummary` (Story 3.1/3.6), and the match screen `/admin/tournaments/[id]/matches/[matchId]` (Story 3.6) all exist. This story adds an edit path and a delete path on that screen, plus two `src/data` writers and two Server Actions. **`prisma/schema.prisma` must not be touched.**

- **This story finishes the pair Story 3.6 opened.** 3.6 was create-only (`enterMatchResult` refuses a second entry). 3.7 adds: edit (replace the `SetScore` rows) and delete (remove them → match back to "не зіграно"). Same validator (`src/domain/validation.ts`), same tally helper (`matchSetSummary`), same `(tournamentId, matchId, stage:"GROUP")` scoping, same 4 `revalidatePath` targets.

- **`MatchResultForm` gains `mode: "create" | "edit"`** — the established `player-form.tsx` / `tournament-form.tsx` pattern (discriminated-union props; edit adds `initialSets` + `onCancel`). Create-mode is unchanged (seed empty rows, `enterMatchResult`, "Результат збережено"). Edit-mode: seed rows from `initialSets`, action is `editMatchResult`, button "Зберегти зміни" + a "Скасувати" `Button`, and on a clean save it toasts "Зміни збережено", calls `props.onCancel()`, and `router.refresh()` — exactly `player-form.tsx`'s edit-mode success effect.

- **The match screen's result view becomes a client `MatchResultPanel`** (`src/components/match-result-panel.tsx`, the `roster.tsx` in-place-edit precedent). Props: `{ tournamentId, matchId, preset, tournamentType, homeTeam, awayTeam, sets }`. Holds an `editing` `useState`:
  - not editing → the read-only set list + `matchSetSummary` tally (moved out of the page's inline JSX), an "Виправити" `Button` (toggles `editing`), and a `ConfirmDialog`-gated "Видалити результат" `Button` (`destructive`).
  - editing → `<MatchResultForm mode="edit" initialSets={sets} onCancel={() => setEditing(false)} … />`.
  - The page (`.../matches/[matchId]/page.tsx`) renders `<MatchResultPanel … sets={match.sets} />` when `match.sets.length > 0`, else the create-mode `<MatchResultForm>` (unchanged).

- **Delete uses `ConfirmDialog`, not a native confirm (UX-DR10).** Title "Видалити результат матчу?", description "Таблиця групи перерахується." (EXPERIENCE Voice — a direct-speech sentence naming the consequence), `confirmLabel="Видалити"`, `destructive`. `onConfirm` calls `removeMatchResult`: `{ ok: false }` → `notify.error(res.message)` + `return false` (dialog stays open); a thrown/rejected call → `notify.error` + `throw` (per `ConfirmDialog`'s contract); success → `notify.success("Результат видалено")` + `router.refresh()`. Same wiring as `roster.tsx`'s `remove()`.

- **`editMatchResult` (`src/actions/matches.ts`)** — the `MatchResultFormState` shape, a sibling of `enterMatchResult` (same file, same feature). Narrow `requireAdmin()` catch → `getMatchForResult(tournamentId, matchId)` (`!match` → `formError`; `stage !== "GROUP"` → `formError`; **`sets.length === 0` → `{ formError: "Результат ще не внесено." }`** — edit needs an existing result, the create path handles a fresh one) → `parseSetsFromForm` (the existing helper) → `validateMatchScore` with the same `/^Партія (\d+): (.+)$/` mapping → `replaceMatchResult` (`!ok` → the stale-match `formError`) → the same 4 `revalidatePath` calls → `{}`.

- **`removeMatchResult` (`src/actions/matches.ts`)** — `ActionResult<undefined>`, the `removePlayer` shape (a button + confirm, not a form). `requireAdmin()` → `getMatchForResult` (`!match` or `stage !== "GROUP"` → `{ ok: false, code: "NOT_FOUND", message: "Матч не знайдено." }`) → `deleteMatchResult` (`count === 0` → `{ ok: false, code: "NOT_FOUND", message: "Результат уже видалено." }`) → the same 4 `revalidatePath` → `{ ok: true, data: undefined }`; wrap in `try/catch (toActionError)`.

- **Data layer (`src/data/matches.ts`):**
  - `replaceMatchResult(tournamentId, matchId, sets)` — one `db.$transaction`: `tx.match.findFirst({ where: { id: matchId, tournamentId, stage: "GROUP" }, select: { id: true } })` → falsy → `{ ok: false, reason: "not_found" }`; `tx.setScore.deleteMany({ where: { matchId } })` then `tx.setScore.createMany({ data: sets.map((s) => ({ ...s, matchId })) })` → `{ ok: true }`. Same `P2003`/`P2025` catch → `"not_found"` as `createMatchResult` (a concurrent redraw). No `_count` check — the action already confirmed a result exists; `replaceMatchResult` is a plain "delete then re-insert".
  - `deleteMatchResult(tournamentId, matchId)` — `db.setScore.deleteMany({ where: { matchId, match: { tournamentId, stage: "GROUP" } } })` → `{ count }`. The nested `match` filter is the `(tournamentId, stage)` scope; a cross-tournament `matchId` deletes nothing.

- **"Плейоф-сітка, якщо існує" is Epic 4 territory — no code for it here.** No playoff exists yet (`transitionTournament`'s `→ PLAYOFF` is fail-closed, Story 4.2 wires it). The 4 `revalidatePath` calls already cover the future playoff tab (it will read from a Story 4.1 `getBracket` on the same route). **AD-5** freezes a playoff pair once its own `SetScore` exists, so editing a *group* result after a bracket is formed changes the seeding standings but does **not** re-seed a formed bracket — that interaction is `domain/bracket.ts`'s (Epic 4), not this story's. Note it; do not build it.

- **No `Tournament.state` guard** — consistent with `enterMatchResult` (Story 3.6) and `scheduleMatch` (Story 3.5). FR-16 doesn't restrict edit/delete by state; FR-7 (Story 4.5) is where `COMPLETED` freezes result editing, and that guard belongs there. Carry the same one-line doc comment `enterMatchResult` has.

- **The schedule-row link (`match-schedule.tsx`) is unchanged.** It already reads "Результат: X:Y" with the `success` check when a result exists; clicking lands on the match screen where "Виправити"/"Видалити" now live. EXPERIENCE's "«Виправити»" affordance is the button on the panel, not the schedule-row link text.

## Tasks / Subtasks

- [ ] **Task 1 — `src/data/matches.ts` (UPDATE): `replaceMatchResult` + `deleteMatchResult`** (AC: 1, 2)
  - [ ] `replaceMatchResult(tournamentId: string, matchId: string, sets: { setNo: number; homePoints: number; awayPoints: number }[]): Promise<{ ok: true } | { ok: false; reason: "not_found" }>` — `db.$transaction`: match `findFirst` (`id`+`tournamentId`+`stage:"GROUP"`) → falsy → `not_found`; `tx.setScore.deleteMany({ where: { matchId } })` → `tx.setScore.createMany({ data: sets.map((s) => ({ ...s, matchId })) })` → `{ ok: true }`. Catch `isRecordNotFound(error)` / `P2003` → `{ ok: false, reason: "not_found" }` (same as `createMatchResult`).
  - [ ] `deleteMatchResult(tournamentId: string, matchId: string): Promise<{ count: number }>` — `db.setScore.deleteMany({ where: { matchId, match: { tournamentId, stage: "GROUP" } } })`.
  - [ ] Doc comments: `replaceMatchResult` is edit-only (the caller confirmed a result exists); `deleteMatchResult` is scoped by the nested `match` filter and returns `{ count: 0 }` for a mismatched pair or an already-empty match.
  - [ ] `typecheck`/`lint` clean. No new Prisma-client import site.

- [ ] **Task 2 — `src/actions/matches.ts` (UPDATE): `editMatchResult` + `removeMatchResult`** (AC: 1, 2)
  - [ ] `editMatchResult(tournamentId, matchId, _prev, formData): Promise<MatchResultFormState>` — narrow `requireAdmin()` catch → `getMatchForResult` (`!match` → `"Матч не знайдено."`; `stage !== "GROUP"` → `"Результат можна вносити лише для матчів групового етапу."`; `sets.length === 0` → `"Результат ще не внесено."`) → `parseSetsFromForm` → `validateMatchScore(parsed.sets, match.tournament.scoringPreset, match.tournament.type)` with the `/^Партія (\d+): (.+)$/` → `setErrors` mapping (identical to `enterMatchResult`) → `replaceMatchResult` (`!ok` → `{ formError: "Матч більше не існує — можливо, проведено пережеребкування. Оновіть сторінку." }`) → the 4 `revalidatePath` (`/${discipline}/${id}`, `…/schedule`, `…/matches/${matchId}`, `/admin/tournaments/${id}`) → `{}`.
  - [ ] `removeMatchResult(tournamentId, matchId): Promise<ActionResult<undefined>>` — `try { await requireAdmin(); const match = await getMatchForResult(...); if (!match || match.stage !== "GROUP") return { ok: false, code: "NOT_FOUND", message: "Матч не знайдено." }; const { count } = await deleteMatchResult(...); if (count === 0) return { ok: false, code: "NOT_FOUND", message: "Результат уже видалено." }; revalidatePath ×4; return { ok: true, data: undefined }; } catch (error) { return toActionError(error); }` — `import { toActionError, type ActionResult } from "@/actions/result"`.
  - [ ] Extract the shared "revalidate all 4 match surfaces" into a small local helper (`revalidateMatchSurfaces(discipline, tournamentId, matchId)`) so `enterMatchResult` / `editMatchResult` / `removeMatchResult` don't restate the four paths (review-proofing the same class the 3.6 review flagged for `setSummary`).
  - [ ] `typecheck`/`lint` clean.

- [ ] **Task 3 — `src/components/match-result-form.tsx` (UPDATE): `mode` + edit props** (AC: 1)
  - [ ] Discriminated props: `type MatchResultFormProps = { mode?: "create"; tournamentId; matchId; preset; tournamentType; homeTeam; awayTeam } | { mode: "edit"; …same…; initialSets: { setNo: number; homePoints: number; awayPoints: number }[]; onCancel: () => void }`.
  - [ ] `action` = `props.mode === "edit" ? editMatchResult.bind(null, tournamentId, matchId) : enterMatchResult.bind(null, tournamentId, matchId)`.
  - [ ] Seed `rows`: edit → `props.initialSets.map((s) => ({ home: String(s.homePoints), away: String(s.awayPoints) }))`; create → `emptyRows(MATCH_SETS_MIN)` (unchanged).
  - [ ] Falling-edge success effect: edit → `notify.success("Зміни збережено")` + `props.onCancel()` + `router.refresh()`; create → `notify.success("Результат збережено")` + `router.refresh()` (unchanged). Same `Object.keys(state).length === 0` check.
  - [ ] Submit label: edit → "Зберегти зміни"; create → "Зберегти результат". Edit mode adds a `type="button"` "Скасувати" `Button` calling `props.onCancel()` (disabled while pending), next to submit — the `player-form.tsx` layout.
  - [ ] `typecheck`/`lint` clean. Preserve the per-set target display, live tally, add/remove-set controls, `aria-label`s verbatim.

- [ ] **Task 4 — `src/components/match-result-panel.tsx` (NEW): read-only + edit + delete** (AC: 1, 2)
  - [ ] `"use client"`. `MatchResultPanel({ tournamentId, matchId, preset, tournamentType, homeTeam, awayTeam, sets }: { …; sets: { setNo: number; homePoints: number; awayPoints: number }[] })`. Local `Sets` type, not Prisma-imported (`roster.tsx` precedent).
  - [ ] `const [editing, setEditing] = useState(false)`. `editing` → `<MatchResultForm mode="edit" tournamentId={…} matchId={…} preset={…} tournamentType={…} homeTeam={…} awayTeam={…} initialSets={sets} onCancel={() => setEditing(false)} />`.
  - [ ] not editing → the set list (`tabular-nums`, "Партія N   H : A"), the `matchSetSummary` tally line ("Рахунок у партіях: X : Y"), an "Виправити" `Button` (`variant="outline"`, `onClick={() => setEditing(true)}`), and:
    - `<ConfirmDialog trigger={<Button variant="destructive">Видалити результат</Button>} title="Видалити результат матчу?" description="Таблиця групи перерахується." confirmLabel="Видалити" destructive onConfirm={remove} />` where `remove()` follows `roster.tsx`'s `remove()`: `await removeMatchResult(tournamentId, matchId).catch(() => null)`; `null` → `notify.error("Не вдалося видалити результат. Спробуйте ще раз."); throw`; `!res.ok` → `notify.error(res.message); return false`; success → `notify.success("Результат видалено"); router.refresh()`.
  - [ ] `typecheck`/`lint` clean.

- [ ] **Task 5 — `src/app/admin/tournaments/[id]/matches/[matchId]/page.tsx` (UPDATE): render the panel** (AC: 1, 2)
  - [ ] Replace the inline `hasResult` read-only block with `<MatchResultPanel tournamentId={id} matchId={matchId} preset={match.tournament.scoringPreset} tournamentType={match.tournament.type} homeTeam={homeTeam} awayTeam={awayTeam} sets={match.sets} />`.
  - [ ] The `else` branch (`<MatchResultForm mode="create" … />`) is unchanged; drop the now-unused `matchSetSummary` import from the page (it moved into the panel) and the "Виправлення й видалення результату — у наступному оновленні." line.
  - [ ] `typecheck`/`lint` clean (`pnpm build` to be safe — same route, no new segment, so `.next/types` is fine, but run the gate).

- [ ] **Task 6 — Docs**
  - [ ] `src/data/README.md` — `matches.ts` entry gains `replaceMatchResult` / `deleteMatchResult`.
  - [ ] `src/actions/README.md` — `matches.ts` entry gains `editMatchResult` / `removeMatchResult` + the `revalidateMatchSurfaces` helper note.
  - [ ] `src/components/README.md` — `match-result-form.tsx` gains the `mode: "create" | "edit"` note; new `match-result-panel.tsx` entry.
  - [ ] `AGENTS.md` — Stack-status bullet for Story 3.7; add `scripts/verify-edit-delete-result.mts` to "Running and verifying".
  - [ ] `deferred-work.md` — new "Story 3.7 implementation" section (no action-level test; the playoff-bracket-recompute clause of AC 1 has no code and no surface until Epic 4; `replaceMatchResult`'s delete-then-create is not guarded against a truly concurrent second editor — same TOCTOU class).

- [ ] **Task 7 — `scripts/verify-edit-delete-result.mts` (NEW, self-cleaning)** (AC: 1, 2)
  - [ ] Draw a throwaway `CLASSIC` 4-team tournament; on a `GROUP` match, `createMatchResult` a 3:0 → `getStandings`: home entry `points: 3`, `wins: 1`, `played: 1`.
  - [ ] `replaceMatchResult(tId, matchId, [3:2 over 5 sets])` → `{ ok: true }`; `getStandings`: home entry now `points: 2`, away `points: 1` (recomputed), both `played: 1`; exactly 5 `SetScore` rows.
  - [ ] `deleteMatchResult(tId, matchId)` → `{ count: 5 }`; `getStandings`: home entry `played: 0`, `points: 0` (match no longer counted); 0 `SetScore` rows.
  - [ ] `replaceMatchResult(<other tournament id>, matchId, …)` → `{ ok: false, reason: "not_found" }`; `deleteMatchResult(<other tournament id>, matchId)` → `{ count: 0 }`.
  - [ ] Create a `SEMIFINAL` match on the tournament; `replaceMatchResult(tId, semifinalId, …)` → `{ ok: false, reason: "not_found" }` (stage scope).
  - [ ] Full teardown (delete tournament — cascades — and teams).
  - [ ] Re-run all prior verify scripts (13 incl. `verify-match-result.mts`) — no regression.
  - [ ] Real command output + notes in the Dev Agent Record.

- [ ] **Task 8 — Verification gate** (AC: all)
  - [ ] `pnpm build` → `pnpm typecheck` → `pnpm lint` → `pnpm test` (no new domain surface — `validateMatchScore` / `matchSetSummary` already covered; **no new Vitest expected**, confirm the count is unchanged).
  - [ ] Import-boundary grep: no new Prisma-client import outside `src/data/**`; `match-result-panel.tsx` imports only `@/actions`, `@/components`, `@/domain` (pure), `@/lib`.
  - [ ] `scripts/verify-edit-delete-result.mts` green; all 13 prior verify scripts green.
  - [ ] Manual signed-in pass — the documented residual gate (no session available to tooling), same as 3.5/3.6: on a match with a result, "Виправити" → change 3:0 → 3:1 → save → toast, panel shows the new score; "Видалити результат" → confirm → toast, screen flips to the empty score form; the schedule row loses its `success` check.

- [ ] **Task 9 — Commit(s)** — one commit + `git push origin main` per completed task group. `build`/`typecheck`/`lint`/`test` gated each.

## What this story is / is NOT

**Is:** an edit path (`MatchResultForm mode="edit"` + `editMatchResult` + `replaceMatchResult`) and a `ConfirmDialog`-gated delete path (`removeMatchResult` + `deleteMatchResult`) on the existing match screen, wrapped in a client `MatchResultPanel`; every write revalidates the four match surfaces so `getStandings` recomputes.

**Is NOT** (do not pull forward):
- **Any schema change, new domain module, or new route.**
- **The visible public standings table.** Story 3.8. This story keeps standings *correct and revalidated* on every edit/delete.
- **Playoff bracket recomputation.** Epic 4 (`domain/bracket.ts` + AD-5's freeze rule). The revalidation reaches the future playoff tab; no bracket code here.
- **Re-implementing any scoring / validation rule.** `src/domain/validation.ts` + `matchSetSummary` are done — call them.
- **A `COMPLETED`-state lock on result editing.** FR-7 / Story 4.5.
- **Editing schedule (date/time/venue).** Story 3.5 owns that on the schedule page; unrelated.

## Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/data/matches.ts` | UPDATE | `replaceMatchResult`, `deleteMatchResult`. |
| `src/actions/matches.ts` | UPDATE | `editMatchResult`, `removeMatchResult`, `revalidateMatchSurfaces` helper. |
| `src/components/match-result-form.tsx` | UPDATE | `mode: "create" \| "edit"` discriminated props. |
| `src/components/match-result-panel.tsx` | NEW | Read-only + "Виправити" toggle + `ConfirmDialog` delete. |
| `src/app/admin/tournaments/[id]/matches/[matchId]/page.tsx` | UPDATE | Renders `MatchResultPanel` for a match with a result. |
| `scripts/verify-edit-delete-result.mts` | NEW | Self-cleaning DB round-trip (edit recomputes, delete un-counts). |
| `src/data/README.md` · `src/actions/README.md` · `src/components/README.md` · `AGENTS.md` · `deferred-work.md` | UPDATE | Module entries, Stack status, new deferred section. |
| `prisma/schema.prisma` | DO NOT TOUCH | `SetScore` already exists (Story 3.2). |

## Architecture compliance

- **AD-1** — the match screen is a Server Component; `editMatchResult` / `removeMatchResult` are the sole write paths. [ARCHITECTURE-SPINE.md#AD-1]
- **AD-3** — `view → shell` (`MatchResultPanel` → `editMatchResult` / `removeMatchResult`), `shell → domain` (→ `validateMatchScore`), `shell → data` (→ `replaceMatchResult` / `deleteMatchResult` / `getMatchForResult`), `view → domain` pure-fn (`MatchResultPanel` → `matchSetSummary`). [ARCHITECTURE-SPINE.md#AD-3]
- **AD-4 / NFR-3** — `Match` + `SetScore` are the sole source of a result; standings never stored. Edit replaces `SetScore` rows, delete removes them; `getStandings` recomputes on read. There is no stored table to update or forget. [ARCHITECTURE-SPINE.md#AD-4, PRD NFR-3]
- **AD-5** — a playoff pair freezes once its own `SetScore` exists; editing a *group* result does not re-seed a formed bracket. Untouched here (no bracket) — flagged so Epic 4 owns the interaction. [ARCHITECTURE-SPINE.md#AD-5]
- **AD-6** — every mutation under `requireAdmin()`. Both actions' first statement. [ARCHITECTURE-SPINE.md#AD-6]
- **AD-11** — `src/data` sole Prisma owner. No new import site. [ARCHITECTURE-SPINE.md#AD-11]
- **Consistency Conventions / UX-DR10 / UX-DR11** — verb-named actions; `revalidatePath` after each write; `ConfirmDialog` (not `confirm()`) for the destructive delete, `destructive` confirm button; synchronous edit, `disabled` + spinner while pending; toast feedback. [ARCHITECTURE-SPINE.md#Consistency Conventions, EXPERIENCE.md]

## Existing code being modified — current state → change → what must be preserved

**`src/data/matches.ts`** (3.2 `getStandings`, 3.4 `hasAnyGroupResult`, 3.5 `listGroupMatchesForTournament`/`updateMatchSchedule`, 3.6 `getMatchForResult`/`createMatchResult`/`SET_SCORE_NATURAL_KEY_INDEX`)
- *Current:* seven exports; `createMatchResult` is a guarded `$transaction` (`_count` check → `createMany`, `P2002`/`P2003`/`P2025` catches).
- *Change:* add `replaceMatchResult` (delete-then-create in a tx, no `_count` check) and `deleteMatchResult` (`setScore.deleteMany` with a nested `match` filter).
- *Must preserve:* `getStandings` verbatim (its `sets.length > 0` filter), `createMatchResult` verbatim (it stays the create path), `getMatchForResult`'s select (which already includes `sets` + `tournament.{scoringPreset,type,discipline}` + `venueText` from the 3.6 review).

**`src/actions/matches.ts`** (3.5 `scheduleMatch`, 3.6 `enterMatchResult` + `parseSetsFromForm` + `MatchResultFormState`)
- *Current:* three exports + the `parseSetsFromForm` / `SCORE_TOKEN` helpers; `enterMatchResult` maps `/^Партія (\d+): (.+)$/` → `setErrors`, revalidates 4 paths, carries the no-state-guard doc comment.
- *Change:* add `editMatchResult` (reusing `parseSetsFromForm` + the regex map verbatim) and `removeMatchResult` (`ActionResult` shape); extract the 4-path revalidation into `revalidateMatchSurfaces`.
- *Must preserve:* `scheduleMatch` and `enterMatchResult` verbatim except for swapping the inline 4× `revalidatePath` for the helper call; `parseSetsFromForm`'s 3-digit `SCORE_TOKEN` cap (3.6 review fix).

**`src/components/match-result-form.tsx`** (3.6, 3.6-review)
- *Current:* create-only. Controlled `rows`, per-set target via `targetScore`, live `matchSetSummary` tally over the contiguous run, add/remove-set for `CLASSIC`, `aria-label`s, `Object.keys(state).length === 0` success, toast-only `formError`.
- *Change:* add `mode` discriminated props; seed rows from `initialSets` in edit mode; edit-mode success calls `props.onCancel()`; submit label + a "Скасувати" button in edit mode.
- *Must preserve:* every create-mode behaviour verbatim (target display, tally, add/remove, a11y, success/error handling).

**`src/app/admin/tournaments/[id]/matches/[matchId]/page.tsx`** (3.6, 3.6-review)
- *Current:* `getMatchForResult` → `notFound()` guard; `hasResult` → inline read-only set list + tally + "виправлення — 3.7" line; else `<MatchResultForm>`.
- *Change:* `hasResult` branch → `<MatchResultPanel … sets={match.sets} />`; drop the inline block, the "3.7" line, and the now-unused `matchSetSummary` import.
- *Must preserve:* the `notFound()` guard, the header (back-link, `<h1>`, the `venueText`-aware meta line from the 3.6 review), the static `metadata`, the create-mode `else` branch.

## Testing requirements

- **No new Vitest.** `validateMatchScore` / `matchSetSummary` / `targetScore` are exhaustively covered (Story 3.1/3.6). `replaceMatchResult` / `deleteMatchResult` are `src/data` round-trips — covered by the verify script, the codebase's established pattern.
- **`scripts/verify-edit-delete-result.mts`** is the real correctness check — first script to prove `getStandings` *changes* when a result is edited and *un-counts a match* when a result is deleted, plus the `not_found` / stage-scope guards on both writers.
- **No component/action test** for `match-result-panel.tsx` / `editMatchResult` / `removeMatchResult` — the standing "no component toolchain / no session mock" gap. Mitigated by the verify script + the documented manual pass.
- **Regression:** all 13 prior verify scripts re-run; `pnpm build` (same route — a sanity build, not a `.next/types` regen).

## Previous story intelligence

**Story 3.6 (done, code-reviewed):**
- `parseSetsFromForm` (3-digit `SCORE_TOKEN` cap), the `/^Партія (\d+): (.+)$/` → `setErrors` mapping, and the 4 `revalidatePath` targets are the exact pieces `editMatchResult` reuses — do not re-derive them.
- `createMatchResult`'s `$transaction` + `P2002`/`P2003`/`P2025` catch is the template for `replaceMatchResult`'s catch (drop the `P2002` arm — a delete-then-create can't hit `@@unique`).
- The 3.6 review extracted `MATCH_SETS_MIN`/`MATCH_SETS_MAX` to `validation.ts` and pinned the `Партія N:` message — both already in place.
- `getMatchForResult` already selects everything the panel needs (`sets`, `tournament.{scoringPreset,type,discipline}`, `venueText`).
- `MatchResultForm` is fresh from the review — `Object.keys(state).length === 0` success, toast-only `formError`, contiguous-run tally. Edit mode must not regress any of it.

**Story 2.8 (done):** `roster.tsx` is the exact precedent for `MatchResultPanel` — a client component holding `editing` state, swapping a read-only row for an in-place `<Form mode="edit">`, with a `ConfirmDialog`-gated delete calling an `ActionResult` action (`removePlayer` → `remove()` shape: `catch → toast + throw`, `{ ok: false } → toast + return false`, success → `toast + router.refresh()`).

**Story 2.5 (done, code-reviewed):** `player-form.tsx` / `tournament-form.tsx`'s `mode: "create" | "edit"` discriminated-union props (fixed after a 2.5-review lesson that an all-optional-props shape let a caller build an invalid create/edit mix) — `MatchResultForm` follows the same shape.

## Git intelligence

Recent: `41c0268` (3.6 review-fix, done) ← `775be01`/`8d751fd`/`06e3482`/`1b8568e`/`5974933` (3.6 tasks + review). `src/actions/matches.ts` exports `scheduleMatch`, `enterMatchResult`, `MatchScheduleFormState`, `MatchResultFormState` + the `parseSetsFromForm` helper. `src/data/matches.ts` exports `getStandings`, `hasAnyGroupResult`, `listGroupMatchesForTournament`, `updateMatchSchedule`, `getMatchForResult`, `createMatchResult`, `SET_SCORE_NATURAL_KEY_INDEX`. `MatchResultForm` is create-only. The match screen renders an inline read-only block for a match with a result.

## Latest tech information

- **No new library.** `db.$transaction` (Prisma 7), `useActionState` (React 19), `ConfirmDialog` (shadcn/base-ui `Dialog` wrapper, Story 2.2) — all in use.
- **`setScore.deleteMany` with a nested relation filter** (`where: { matchId, match: { tournamentId, stage } }`) is standard Prisma 7 — the same shape `hasAnyGroupResult` already uses (`where: { match: { tournamentId, stage: "GROUP" } }`).

## Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 3.7 AC, FR-16), `prd.md` §4.6 (FR-16), `ARCHITECTURE-SPINE.md` (AD-1/AD-3/AD-4/AD-5/AD-6/AD-11, NFR-3), `EXPERIENCE.md` (Match row — «Виправити» / «Видалити результат» under confirmation; Voice — the exact delete-confirm sentence; synchronous-edit rule), `DESIGN.md` / UX-DR10 (`ConfirmDialog`, `destructive` confirm), `3-6-enter-match-result.md` (`parseSetsFromForm`, the regex map, the 4 revalidate targets, `getMatchForResult`'s select, the fresh `MatchResultForm`), `2-8-roster-players.md` (`roster.tsx` in-place edit + `ConfirmDialog` delete pattern), `2-5-edit-delete-tournament.md` (`mode` discriminated props).

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7: Виправити або видалити результат] — user story + AC; FR-16
- [Source: _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md#4.6 FR-16] — recompute on edit/delete; delete → "не зіграно"
- [Source: …/ARCHITECTURE-SPINE.md#AD-1, #AD-3, #AD-4, #AD-5, #AD-6, #AD-11] · [PRD NFR-3]
- [Source: …/ux-designs/…/EXPERIENCE.md#Interaction Primitives — Match row] · [#Voice and Tone — "Видалити результат матчу? Таблиця перерахується."] · [#Взаємодія — synchronous edit]
- [Source: …/ux-designs/…/DESIGN.md / UX-DR10] — `ConfirmDialog` for result deletion, `destructive` confirm
- [Source: _bmad-output/implementation-artifacts/3-6-enter-match-result.md] — `parseSetsFromForm`, `/^Партія N:/` map, `revalidatePath` targets, `getMatchForResult`, `MatchResultForm`
- [Source: _bmad-output/implementation-artifacts/2-8-roster-players.md] — `roster.tsx` in-place edit + `ConfirmDialog` delete (`remove()` shape)
- [Source: _bmad-output/implementation-artifacts/2-5-edit-delete-tournament.md] — `mode: "create" | "edit"` discriminated props

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-06 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
