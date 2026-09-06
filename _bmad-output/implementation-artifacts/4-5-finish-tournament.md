---
baseline_commit: e781c95
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/implementation-artifacts/2-3-tournament-state-machine.md
  - _bmad-output/implementation-artifacts/4-2-generate-playoff.md
  - _bmad-output/implementation-artifacts/4-3-auto-advance-final-third-place.md
  - _bmad-output/implementation-artifacts/4-4-playoff-results-final-placements.md
  - _bmad-output/implementation-artifacts/3-6-enter-match-result.md
  - _bmad-output/implementation-artifacts/3-7-edit-delete-result.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - AGENTS.md
---

# Story 4.5: Завершити турнір

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an адмін,
I want завершити турнір після того, як зіграно фінал і матч за 3-тє місце,
so that турнір фіксується, потрапляє в архів, і його результати більше не можна змінити (FR-7).

## Acceptance Criteria

Translated from `epics.md` → Epic 4 → Story 4.5. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** турнір у стані `PLAYOFF`, зіграно Фінал і Матч за 3-тє місце (обидва мають власний `SetScore`)
**When** адмін тисне «Завершити турнір»
**Then** `ConfirmDialog` попереджає, що після цього Результати редагувати не можна
**And** після підтвердження стан турніру → `COMPLETED` (через санкціонований перехід, не присвоєнням)
**And** редагування Результатів матчів заблоковане (внесення / виправлення / видалення) — на сервері, не лише в UI
**And** турнір з'являється в Архіві за свій рік (сам `/archive` — Story 4.7; ця історія лише робить турнір `COMPLETED` і ревалідує `/archive`)

**Given** турнір у стані `PLAYOFF`, Фінал **або** Матч за 3-тє місце ще без Результату
**When** адмін дивиться на дію «Завершити турнір»
**Then** кнопка видима, але неактивна, з підписом-причиною («Доступно коли зіграно фінал і матч за 3-тє місце»)
**And** пряма (підроблена) спроба переходу в `COMPLETED` відхиляється на сервері з тим самим поясненням

**Given** турнір у стані `COMPLETED`
**When** глядач або адмін відкриває сторінку турніру
**Then** вгорі показано банер «Турнір завершено»
**And** для адміна всі дії редагування Результатів (і розкладу) на поверхнях турніру недоступні (EXPERIENCE: «усі дії редагування зникають; для адміна теж»)

### FR / AD / SPEC anchors (in context)

- **FR-7** (`prd.md` §4.2): «Адмін може перевести Турнір у Стан Завершений кнопкою «завершити турнір». **Наслідки (перевірювані):** — Кнопка доступна лише коли зіграно Фінал і Матч за 3-тє місце. — Після переходу в Завершений Турнір з'являється в Архіві за свій рік із фінальними місцями 1–4; подальше редагування Результатів заблоковане `[ПРИПУЩЕННЯ]`.»
- **PRD §11 / SPEC Assumptions** (both, verbatim): «Після переходу турніру в стан Завершений редагування результатів заблоковане.» — this is the resolution of PRD **Open Question #3** *for v1* (block fully; no correction-with-recompute path). Open Question #4 («чи може адмін скасувати «завершити турнір»») stays **open — out of scope here** (no un-complete flow).
- **AD-8** (`ARCHITECTURE-SPINE.md`): «Переходи `DRAFT → GROUP_STAGE → PLAYOFF → COMPLETED` — окремі Server Actions, кожна перевіряє передумови (напр. … `COMPLETED` лише коли зіграно фінал і матч за 3-тє). Пряме присвоєння `state` поза цими переходами заборонене.» The `PLAYOFF → COMPLETED` edge and its precondition **already exist** in `src/domain/tournamentState.ts` (`TRANSITIONS.PLAYOFF = ["COMPLETED"]`, `PRECONDITIONS.COMPLETED` gates on `ctx.finalAndThirdPlacePlayed === true`). This story wires the **real input** and the **caller** — it does not touch the state machine's transition table or precondition predicates.
- **AD-4** (`ARCHITECTURE-SPINE.md`): «Таблиця групи й фінальні місця не зберігаються — обчислюються при кожному читанні.» `COMPLETED` changes nothing about how placements / standings are derived — `getPlayoffBracket` / `getStandings` keep working unchanged. The only thing `COMPLETED` adds is a **write lock**, never a materialised result.
- **NFR-3** (`prd.md` §5): «неможливий стан, коли таблиця не відповідає внесеним результатам.» Freezing edits in `COMPLETED` cannot desync anything — the derivations still run on read.
- **AD-6 / AD-11 / AD-2 / AD-3**: every write via a Server Action, first line `await requireAdmin()`; every read/write via a named `src/data` function; Prisma only in `src/data`; the lock predicate is pure `src/domain`.
- **EXPERIENCE.md** — *State Patterns* table row **«Турнір завершено»**: «Банер «Турнір завершено» вгорі; усі дії редагування зникають; для адміна теж». *Component Patterns* → *Admin action bar*: «Плейоф → «Завершити турнір» коли зіграно фінал і матч за 3-тє». *Interaction Primitives* → *Підтвердження*: «руйнівні й незворотні дії (… завершити турнір) — shadcn `Dialog`, кнопка підтвердження — `destructive`». *Voice and Tone*: «Завершити турнір? Після цього результати редагувати не можна.»
- **DESIGN.md** — *Status badge*: «`Завершений` — контур `#6B6B70`» (already implemented in `src/components/status-badge.tsx`). No dedicated banner token — use a plain bordered/`muted` block, text-first (see *Accessibility Floor* — state never colour-only).
- **UX-DR10**: `ConfirmDialog` (never native `confirm()`), confirm button `destructive`.

### Notes on AC interpretation

- **The `COMPLETED` transition itself does NO domain work** — unlike `drawTournament` (seating + schedule generation) and `formPlayoff` (seeding). It is a pure state flip + one precondition check. `src/actions/README.md` designates `transitionTournament(id, targetState)` as *the generic transition action*, with dedicated actions reserved for transitions "that do domain work … rather than nesting a call to `transitionTournament`". **Decision: wire `transitionTournament(id, "COMPLETED")` directly** — this is its first real caller. Extend only its `context` block to supply the `COMPLETED` precondition input; do **not** add a `finishTournament` action.

- **The precondition input — a new lean data read `finalAndThirdPlacePlayed(tournamentId, client?)` in `src/data/matches.ts`.** Mirror `allGroupMatchesPlayed` exactly (same file, same shape, same optional-transaction-client tail even though nothing needs the tx form yet — keep the family consistent):
  ```ts
  /**
   * Whether both the FINAL and the THIRD_PLACE match exist and each has a
   * recorded result — the precondition for checkTransition(..., "COMPLETED", ...)
   * (FR-7). Both rows must be present AND non-empty: a bracket where only the
   * final has been played is not finishable. "Has a result" = "has a SetScore
   * row" (createMatchResult writes all sets in one transaction).
   */
  export async function finalAndThirdPlacePlayed(
    tournamentId: string,
    client: Prisma.TransactionClient | typeof db = db,
  ): Promise<boolean> {
    const rows = await client.match.findMany({
      where: { tournamentId, stage: { in: ["FINAL", "THIRD_PLACE"] } },
      select: { stage: true, _count: { select: { sets: true } } },
    });
    const played = new Set(rows.filter((r) => r._count.sets > 0).map((r) => r.stage));
    return played.has("FINAL") && played.has("THIRD_PLACE");
  }
  ```
  Do **not** reuse `getPlayoffBracket(id).placements` for the button/action gate — that runs `advanceBracket` + a nested-relation read + name resolution for a boolean. (The admin schedule page already calls `getPlayoffBracket` for its own reasons; the admin `[id]` page and the action do not, and should not start.)

- **The result-editing lock — a new pure predicate `checkCanEditResults(state)` in `src/domain/tournamentState.ts`.** It is *lifecycle policy keyed on state*, so it belongs beside `TRANSITIONS` / `checkTransition`, **not** in a new `src/domain/resultLock.ts` (that would be a near-empty module; `checkCanRedraw` got its own module only because redraw had no existing domain home — the lifecycle does). Shape mirrors `checkCanRedraw` (`src/domain/redraw.ts`) — pure, framework-free, ready-to-show Ukrainian message:
  ```ts
  export type ResultEditCheck = { ok: true } | { ok: false; message: string };

  /**
   * Whether match results (and schedule) may still be entered / corrected /
   * removed. Blocked in COMPLETED: the tournament is archived and its results
   * are frozen (FR-7 / PRD Open Question #3, resolved for v1). Every other
   * state allows it (a group-result edit during PLAYOFF is fine — it never
   * re-seeds the bracket; that gate is checkCanEditSemifinalResult).
   */
  export function checkCanEditResults(state: TournamentState): ResultEditCheck {
    if (state === "COMPLETED") {
      return { ok: false, message: "Турнір завершено — результати редагувати не можна." };
    }
    return { ok: true };
  }
  ```
  - Message must **not** start with `"Партія N: "` — `parseAndValidate` (`src/actions/matches.ts`) maps that prefix to `setErrors[N]`. Plain sentence only.
  - `~4` Vitest cases in the existing `src/domain/tournamentState.test.ts` (`DRAFT` / `GROUP_STAGE` / `PLAYOFF` → ok; `COMPLETED` → not ok, message non-empty). `pnpm test` **167 → ~171**; state the exact number in the Dev Agent Record.

- **Enforcing the lock — where.** All four result-mutation entry points, server-side (the real control — NFR-1):
  | Action (`src/actions/matches.ts`) | Return on block |
  | --- | --- |
  | `enterMatchResult` | `{ formError: check.message }` |
  | `editMatchResult` | `{ formError: check.message }` |
  | `removeMatchResult` | `{ ok: false, code: "PRECONDITION_FAILED", message: check.message }` |
  | `scheduleMatch` | `{ formError: check.message }` |
  - `enterMatchResult` / `editMatchResult` / `removeMatchResult` already call `getMatchForResult(tournamentId, matchId)` — **add `state: true` to its `tournament` select** (`src/data/matches.ts`), then `checkCanEditResults(match.tournament.state)` right after the `!match` null-check (for `removeMatchResult`: before `checkSemifinalResultEditable` and before `deleteMatchResult`; for `editMatchResult`: alongside the existing `sets.length === 0` / semifinal-gate block; for `enterMatchResult`: after the participant / `sets.length > 0` checks).
  - `scheduleMatch` already reads `getTournamentForAdmin(tournamentId)` → has `.state`. Add the check right after the `!tournament` null-check.
  - **Shared helper preferred:** a tiny `assertResultsEditable(state)` local to `src/actions/matches.ts` returning the check, so the four call sites read uniformly (the `checkSemifinalResultEditable` precedent).
  - **Blocking `scheduleMatch` in `COMPLETED` is an EXPERIENCE-driven decision, not a literal epics AC.** FR-13 says "будь-якого Матчу"; EXPERIENCE's *State Patterns* row says «усі дії редагування зникають» and both spines "перемагають будь-який мок". A completed tournament's schedule is history — freezing it is correct. [decision — documented here and in `deferred-work.md`.]
  - **Scope note:** other admin writes touching a `COMPLETED` tournament (`updateTournament` reqs/rules, `deleteTournament`, roster edits via `players.ts`, enrollment) are **NOT** gated here. `deleteTournament` was deliberately left state-unrestricted in Story 2.5. Roster/enrollment are structurally unreachable in `COMPLETED` for enrollment (`checkCanEnroll` is `DRAFT`-only) and out of FR-7's "Результатів" scope for roster. `updateTournament` already locks `teamCount`/`rounds` outside `DRAFT`; name/year/preset edits are not "Результати". Leave them — over-gating is its own risk. (The admin `[id]` form is visually locked in `COMPLETED` — see the UI task — but that's presentation, not a new server gate.)

- **The button — `FinishTournamentButton` in `src/components/tournament-actions.tsx`.** Same file, same `"use client"` module as `DrawTournamentButton` / `FormPlayoffButton` / `RedrawTournamentButton`. Mirror `RedrawTournamentButton` (it has the `ConfirmDialog`; `FinishTournamentButton` needs one too — UX-DR10 + AC) crossed with `FormPlayoffButton`'s `checkTransition`-driven disabled+caption:
  ```tsx
  export function FinishTournamentButton({
    tournamentId, state, finalAndThirdPlacePlayed,
  }: { tournamentId: string; state: TournamentState; finalAndThirdPlacePlayed: boolean }) {
    const router = useRouter();
    const check = checkTransition(state, "COMPLETED", { finalAndThirdPlacePlayed });
    const caption =
      !check.ok && check.code === "PRECONDITION_FAILED"
        ? "Доступно коли зіграно фінал і матч за 3-тє місце"
        : check.ok ? null : check.message;

    async function finish(): Promise<boolean | void> {
      const res = await transitionTournament(tournamentId, "COMPLETED").catch((): null => {
        notify.error("Не вдалося завершити турнір. Спробуйте ще раз.");
        return null;
      });
      if (res === null) throw new Error("finish request failed");
      if (!res.ok) { notify.error(res.message); return false; }
      notify.success("Турнір завершено");
      router.refresh();
    }

    return (
      <div className="grid gap-2">
        <ConfirmDialog
          trigger={<Button variant="destructive" disabled={!check.ok}>Завершити турнір</Button>}
          title="Завершити турнір?"
          description="Після цього результати редагувати не можна."
          confirmLabel="Завершити турнір"
          destructive
          onConfirm={finish}
        />
        {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
      </div>
    );
  }
  ```
  - Import `transitionTournament` from `@/actions/tournaments` (already exported).
  - The `view → domain` `checkTransition` call is the established edge (`FormPlayoffButton`, `DrawTournamentButton` already do it) — lint-clean.
  - `ConfirmDialog`'s `onConfirm` throwing keeps the dialog open (per `src/components/README.md`); the `res === null` throw path uses that. A `res.ok === false` returns `false` → dialog closes, toast shown (same as `RedrawTournamentButton`).

- **`transitionTournament` — extend the `context` block only.** In `src/actions/tournaments.ts`:
  ```ts
  const context: TransitionContext = {};
  if (targetState === "GROUP_STAGE") {
    context.entryCount = await countTournamentEntries(tournamentId);
    context.teamCount = tournament.teamCount;
  }
  if (targetState === "COMPLETED") {
    context.finalAndThirdPlacePlayed = await finalAndThirdPlacePlayed(tournamentId);
  }
  ```
  Import `finalAndThirdPlacePlayed` from `@/data/matches`. Everything else in `transitionTournament` stays: the `getTournamentForAdmin` null-check, `checkTransition`, `setTournamentState`, the existing `revalidatePath` calls (it **already** does `revalidatePath("/archive")` for `COMPLETED` and the public discipline path). **Add** three revalidations so every completed-tournament surface refreshes:
  ```ts
  revalidatePath("/admin/tournaments");
  revalidatePath(`/admin/tournaments/${tournamentId}/schedule`);
  revalidatePath(`/${tournament.discipline === "BEACH" ? "beach" : "classic"}/${tournamentId}`);
  ```
  (The existing `revalidatePath(tournament.discipline === "BEACH" ? "/beach" : "/classic")` covers the list; the per-tournament public route is the new one — the banner + the hidden edit affordances need it.)

- **Admin `[id]` page (`src/app/admin/tournaments/[id]/page.tsx`).**
  - Add `finalAndThirdPlacePlayed(id)` to the existing `Promise.all`.
  - Render a **«Завершити турнір»** `<section>` **only when `state === "PLAYOFF"`** (the `FormPlayoffButton` section is `GROUP_STAGE`-only; this is its `PLAYOFF` sibling), passing `state` + `finalAndThirdPlacePlayed`.
  - When `state === "COMPLETED"`: show a banner block («Турнір завершено. Результати зафіксовано.») near the top (under the `Стан:` line), and pass `locked={COMPLETED ? ALL_FIELDS : …}` to `TournamentForm` so every field is disabled (the form already supports a `locked: TournamentField[]` prop and renders a caption for locked fields). `ALL_FIELDS` = `["type","name","year","scoringPreset","teamCount","rounds"]` (or `discipline` too if the form lists it — check `TournamentField`). Keep `DeleteTournamentButton` (Story 2.5 decision). The `Команди` / `Розклад` sections: the schedule link stays (viewing is fine); the `TeamEnrollment` section already no-ops its controls outside `DRAFT`.

- **Match screen (`src/app/admin/tournaments/[id]/matches/[matchId]/page.tsx`).** It already computes `editLockedReason` for the semifinal-edit gate and passes it to `MatchResultPanel` as `lockedReason`. **Extend it:** add `state: true` to `getMatchForResult`'s tournament select; set `editLockedReason` to `checkCanEditResults(match.tournament.state).message` when that check fails (takes precedence over / combines with the semifinal gate — either reason blocks). Also pass a `lockedReason` to `MatchResultForm` (the no-result-yet branch) so a `COMPLETED` tournament with an unplayed match can't have a result entered from the UI either.
  - **`MatchResultForm` needs a `lockedReason?: string` prop** (`src/components/match-result-form.tsx`) — when set, render the score inputs + submit disabled with a muted caption, same treatment `MatchResultPanel` already gives its locked state. Keep it minimal.
  - `MatchResultPanel` already handles `lockedReason` — no change beyond it now also being fed the `COMPLETED` reason.

- **Admin schedule page + `MatchScheduleList` (`src/components/match-schedule.tsx`).** Pass a `locked?: boolean` (or `lockedReason?: string`) prop from `src/app/admin/tournaments/[id]/schedule/page.tsx` (it has `tournament.state`). When locked: `MatchScheduleRow` hides the inline schedule `<form>` and renders the result as plain text (drop the `<Link>` to the match screen, or keep the link but the match screen itself is locked — **keep the link**, since viewing the recorded result there is fine; only hide the schedule `<form>`). Show a one-line muted caption at the top of the list. Keep it simple — a `locked` boolean that (a) skips rendering the `<form>` and (b) shows the result link as read-only text is enough.

- **Public tournament page (`src/app/classic/[tournament]/page.tsx`).** When `tournament.state === "COMPLETED"`, render a banner **above `<TournamentTabs>`**: a bordered/`muted` block, text «Турнір завершено», text-first (Accessibility Floor — not colour-only; the `StatusBadge` already says «Завершений», the banner is the EXPERIENCE-mandated prominent version). No new component needed for one block — inline `<p>` / `<div>` is fine (the `playoff` tab placeholder is inline too). If you prefer a component, `src/components/completed-banner.tsx` is acceptable and 4.6/4.7 could reuse it; not required.
  - **Do NOT** change `listPublicTournaments()` / the `/classic` listing to hide `COMPLETED` tournaments. Whether completed tournaments leave the active list once `/archive` exists is **Story 4.7's** call (`deferred-work.md`, 2.9 review — "will completed tournaments need to disappear from `/classic`"). This story leaves them visible.

- **No migration. No new route. No new `src/domain` module** (`checkCanEditResults` is a function added to the existing `tournamentState.ts`). **No change to `src/domain/bracket.ts`, `src/data/playoff.ts`, `advanceBracket`, `seedPlayoff`, `playoffPlacements`, `checkCanEditSemifinalResult`.**

- **No worked fixtures in the planning docs** — write `scripts/verify-finish-tournament.mts` from scratch on the 4-team pattern (`verify-advance-bracket.mts` is the closest sibling to copy the setup from).

## Tasks / Subtasks

- [x] **Task 1 — `src/domain/tournamentState.ts` (UPDATE): `checkCanEditResults` + `ResultEditCheck`** (AC: 3)
  - [x] `ResultEditCheck = { ok: true } | { ok: false; message: string }` + `checkCanEditResults(state)` — `state === "COMPLETED"` → `{ ok: false, message: "Турнір завершено — результати редагувати не можна." }`, else `{ ok: true }`. Message has no `"Партія N:"` prefix. Doc comment cites FR-7 / Open Question #3.
  - [x] **No change** to `TRANSITIONS`, `PRECONDITIONS`, `checkTransition`, `canTransition`, `LABELS`, `TransitionContext` (the `finalAndThirdPlacePlayed` field is already there).
  - [x] `typecheck` / `lint` clean.

- [x] **Task 2 — `src/domain/tournamentState.test.ts` (UPDATE): predicate cases** (AC: 3)
  - [x] `describe("checkCanEditResults", …)` — `DRAFT` / `GROUP_STAGE` / `PLAYOFF` → `{ ok: true }`; `COMPLETED` → `ok: false`, message non-empty.
  - [x] `pnpm test` **167 → ~171** (state the exact number in the Dev Agent Record).

- [x] **Task 3 — `src/data/matches.ts` (UPDATE): `finalAndThirdPlacePlayed` + `getMatchForResult` state** (AC: 1, 2, 3)
  - [x] `finalAndThirdPlacePlayed(tournamentId, client?)` — one `match.findMany` over `stage IN (FINAL, THIRD_PLACE)`, both stages must be present with `_count.sets > 0`. Mirrors `allGroupMatchesPlayed`'s signature (optional `Prisma.TransactionClient`).
  - [x] `getMatchForResult` — add `state: true` to the `tournament` select. No other change to it.
  - [x] `typecheck` / `lint` clean (no `data → actions/domain-value` beyond the existing edges).

- [x] **Task 4 — `src/actions/tournaments.ts` (UPDATE): `COMPLETED` context + revalidation** (AC: 1, 2)
  - [x] Import `finalAndThirdPlacePlayed` from `@/data/matches`.
  - [x] In `transitionTournament`: `if (targetState === "COMPLETED") context.finalAndThirdPlacePlayed = await finalAndThirdPlacePlayed(tournamentId);`
  - [x] Add `revalidatePath("/admin/tournaments")`, `revalidatePath(\`/admin/tournaments/${tournamentId}/schedule\`)`, `revalidatePath(\`/${discipline === "BEACH" ? "beach" : "classic"}/${tournamentId}\`)` (the `/archive` + discipline-list revalidations already exist — keep them).
  - [x] No change to the `GROUP_STAGE` branch, the `checkTransition` call, `setTournamentState`, or the error mapping.
  - [x] `typecheck` / `lint` clean.

- [x] **Task 5 — `src/actions/matches.ts` (UPDATE): the `COMPLETED` result-lock** (AC: 3)
  - [x] Import `checkCanEditResults` from `@/domain/tournamentState`. Local helper `assertResultsEditable(state)` (or inline) — the `checkSemifinalResultEditable` precedent.
  - [x] `enterMatchResult` / `editMatchResult`: after the `!match` null-check → `checkCanEditResults(match.tournament.state)` → `{ formError: check.message }` on block. Order: before `checkSemifinalResultEditable`.
  - [x] `removeMatchResult`: after `!match` → `{ ok: false, code: "PRECONDITION_FAILED", message: check.message }` on block. Before `checkSemifinalResultEditable` / `deleteMatchResult`.
  - [x] `scheduleMatch`: after `!tournament` → `{ formError: check.message }` on block (uses `tournament.state` from `getTournamentForAdmin`).
  - [x] `advancePlayoffAfterSemifinal` / `revalidateMatchSurfaces` / `parseAndValidate` / the `requireAdmin` catch — unchanged. Doc comments updated (the `COMPLETED` note replaces the "a `COMPLETED` lock is Story 4.5" TODO comments in `enterMatchResult` / `editMatchResult`).
  - [x] `typecheck` / `lint` clean (no Prisma in `src/actions`).

- [x] **Task 6 — `src/components/tournament-actions.tsx` (UPDATE): `FinishTournamentButton`** (AC: 1, 2)
  - [x] New export `FinishTournamentButton({ tournamentId, state, finalAndThirdPlacePlayed })` — `ConfirmDialog` (`destructive`, title «Завершити турнір?», description «Після цього результати редагувати не можна.», confirm «Завершити турнір»), `checkTransition(state, "COMPLETED", { finalAndThirdPlacePlayed })` for `disabled` + caption («Доступно коли зіграно фінал і матч за 3-тє місце» for `PRECONDITION_FAILED`), calls `transitionTournament(tournamentId, "COMPLETED")`, `notify` + `router.refresh()`.
  - [x] Import `transitionTournament` from `@/actions/tournaments`.
  - [x] No change to the other three buttons.

- [x] **Task 7 — Admin `[id]` page (UPDATE): finish section + completed banner + locked form** (AC: 1, 2, 3)
  - [x] `src/app/admin/tournaments/[id]/page.tsx` — add `finalAndThirdPlacePlayed(id)` to `Promise.all`.
  - [x] `state === "PLAYOFF"` → new `<section>` «Завершити турнір» with `<FinishTournamentButton>`.
  - [x] `state === "COMPLETED"` → banner block under the `Стан:` line («Турнір завершено. Результати зафіксовано.»), and `locked` = all `TournamentField`s for `<TournamentForm>`.
  - [x] `pnpm build` (route unchanged, but the page changed) → `typecheck` clean.

- [x] **Task 8 — Match screen + result form/panel lock (UPDATE)** (AC: 3)
  - [x] `src/app/admin/tournaments/[id]/matches/[matchId]/page.tsx` — set `editLockedReason` from `checkCanEditResults(match.tournament.state)` (in addition to the existing semifinal gate); pass `lockedReason` to `MatchResultForm` too (the no-result branch).
  - [x] `src/components/match-result-form.tsx` — add `lockedReason?: string`; when set, disable the score inputs + submit and show a muted caption (mirror `MatchResultPanel`'s locked block).
  - [x] `src/components/match-result-panel.tsx` — no change (already consumes `lockedReason`).
  - [x] `pnpm build` → `typecheck` clean.

- [x] **Task 9 — Schedule page + `MatchScheduleList` lock (UPDATE)** (AC: 3)
  - [x] `src/components/match-schedule.tsx` — `MatchScheduleList` + `MatchScheduleRow` take `locked?: boolean`; when locked, `MatchScheduleRow` skips the schedule `<form>` and renders the result as read-only text (keep the `<Link>` to the match screen — viewing the recorded result is fine, and the match screen is itself locked). One muted caption at the top of the list.
  - [x] `src/app/admin/tournaments/[id]/schedule/page.tsx` — pass `locked={tournament.state === "COMPLETED"}`.
  - [x] `pnpm build` → `typecheck` clean.

- [x] **Task 10 — Public tournament page: «Турнір завершено» banner (UPDATE)** (AC: 4)
  - [x] `src/app/classic/[tournament]/page.tsx` — when `tournament.state === "COMPLETED"`, render a bordered/`muted` banner «Турнір завершено» above `<TournamentTabs>`. Text-first (Accessibility Floor). Inline markup is fine; a `src/components/completed-banner.tsx` is acceptable if it reads cleaner (4.6/4.7 could reuse).
  - [x] **Do not** touch `listPublicTournaments()` / the `/classic` list.

- [x] **Task 11 — `scripts/verify-finish-tournament.mts` (NEW)** (AC: all)
  - [x] Copy the 4-team setup from `verify-advance-bracket.mts`: `createTournamentRecord` → 4 teams/entries → `saveDraw` → all group results → `savePlayoffFormation` → both semifinal results (`createMatchResult`) → `savePlayoffAdvancement`.
  - [x] Assert: `finalAndThirdPlacePlayed(id)` **false** before the final/third are played; `checkTransition("PLAYOFF", "COMPLETED", { finalAndThirdPlacePlayed: false })` → `PRECONDITION_FAILED`.
  - [x] Play the final only → `finalAndThirdPlacePlayed` still **false** (third-place not played).
  - [x] Play the third-place match → `finalAndThirdPlacePlayed` **true**; `checkTransition(..., { finalAndThirdPlacePlayed: true })` → `{ ok: true }`.
  - [x] `checkCanEditResults("PLAYOFF")` → ok; `checkCanEditResults("COMPLETED")` → not ok.
  - [x] Drive `setTournamentState(id, "COMPLETED")` (or `transitionTournament`) then assert a `createMatchResult` / `replaceMatchResult` / `deleteMatchResult` **is refused by the action layer** — *note:* the verify script calls `src/data` directly (un-gated), so assert via `checkCanEditResults(tournament.state)` on the reloaded state, matching how `verify-advance-bracket.mts` asserts the semifinal gate (predicate-level, not action-level — the action wiring gap is the standing "no session-mock harness" limitation).
  - [x] Self-cleaning: full teardown (delete tournament → cascade; delete teams). Header comment describing the scenario. Green; all other verify scripts still green.

- [x] **Task 12 — Docs (UPDATE)**
  - [x] `src/domain/README.md` — `checkCanEditResults` under `tournamentState.ts`.
  - [x] `src/data/README.md` — `finalAndThirdPlacePlayed`; `getMatchForResult` now selects `state`.
  - [x] `src/actions/README.md` — `transitionTournament` is now really called (`FinishTournamentButton`); the `COMPLETED` result-lock on `enter/edit/removeMatchResult` + `scheduleMatch`.
  - [x] `src/components/README.md` — `FinishTournamentButton`; `MatchResultForm` / `MatchScheduleList` `lockedReason` / `locked` props.
  - [x] `AGENTS.md` — new Story 4.5 Stack-status bullet + a `verify-finish-tournament.mts` line in the verify catalogue; note the `COMPLETED` result-edit lock as a convention.
  - [x] `_bmad-output/implementation-artifacts/deferred-work.md` — new "Story 4.5 implementation" section: Open Question #3 resolved (block fully) for v1; Open Question #4 (un-complete) still open; `scheduleMatch` `COMPLETED`-lock is an EXPERIENCE-driven decision; `/classic` still lists `COMPLETED` tournaments (4.7's call); TOCTOU on the finish gate (check-then-act, same accepted class); no action-level test for the result-lock (same standing gap).

- [x] **Task 13 — Verification gate** (AC: all)
  - [x] `pnpm build` ✓ · `pnpm typecheck` ✓ · `pnpm lint` ✓ · `pnpm test` **~171/171** (exact number recorded).
  - [x] `prisma migrate status` up to date, `migrate diff --exit-code` clean (no migration this story — confirm, since `src/data/matches.ts` changes but no schema does).
  - [x] `pnpm exec tsx scripts/verify-finish-tournament.mts` green; **all 11 verify scripts** green.
  - [x] Import-boundary check: `checkCanEditResults` is pure `src/domain` (no new imports in `tournamentState.ts`); `src/actions/matches.ts` imports `@/domain/tournamentState` (already imports `@/domain/bracket`), no Prisma; `src/actions/tournaments.ts` imports `@/data/matches` (already imports several `@/data/*`); `tournament-actions.tsx` (`src/components`) imports `@/actions/tournaments` + `@/domain/tournamentState` (both already used there).
  - [x] Command output in the Dev Agent Record.
  - _Residual (matches every prior admin story): no manual signed-in browser pass (no seeded `PLAYOFF`/`COMPLETED` tournament). Mitigated by the verify script + the full server gate. Recommended with code review: form a playoff, play both semifinals, the final and the third-place match → the admin `[id]` page «Завершити турнір» button enables → confirm → tournament is `COMPLETED`; then confirm the public page shows the «Турнір завершено» banner, the match screens disable «Виправити»/«Видалити результат»/«Внести результат», and the schedule page hides the schedule forms._

- [x] **Task 14 — Commit(s)** — one commit + `git push origin main` per task group (domain predicate + tests; data helper; action wiring — transition + result-lock; button + admin page; match/schedule UI locks; public banner; verify script; docs). Per the standing "commit after each task" instruction.

### Review Findings

_Code review (`bmad-code-review`, 4 layers: Blind Hunter, Edge Case Hunter, Verification Gap, Acceptance Auditor) over `git diff e781c95..bf4674e` (`src/` + `scripts/`). 1 decision-needed → resolved (Option A), 5 patch → all applied, 4 deferred, ~11 dismissed. Gate re-run clean: `build` / `typecheck` / `lint`, `pnpm test` 169/169, all 16 verify scripts green._

#### Decision-needed → resolved: Option A (full freeze)

- [x] [Review][Decision] `updateTournament` is not gated on `COMPLETED`, yet this story locks the whole edit form when `COMPLETED` — **resolved: Option A.** `updateTournament` now returns `{ formError: "Турнір завершено — його дані редагувати не можна." }` for a `COMPLETED` tournament (before any field processing); `TournamentForm` hides the submit button when every editable field is locked and takes a `lockedHint` prop (the admin page passes «Турнір завершено — дані зафіксовано.» so the per-field caption is no longer the misleading «…лише в стані «Чернетка»»); `transitionTournament(…, "COMPLETED")` also revalidates every match screen. Client + server + banner now agree with EXPERIENCE «усі дії редагування зникають». — `[src/actions/tournaments.ts:130, src/app/admin/tournaments/[id]/page.tsx]` — the form now disables all six fields (`LOCKED_WHEN_COMPLETED`) and the banner promises «редагуванню не підлягають», but `updateTournament` still passes `type`/`name`/`year`/`scoringPreset` straight through `validateNewTournament` → `updateTournamentRecord` regardless of state (only `teamCount`/`rounds` are substituted, via `resolveGroupStageFields`). Two consequences: (a) **broken honest submit** — disabled controlled inputs are not submitted, so clicking the still-active «Зберегти зміни» on a `COMPLETED` tournament sends `null` for the four fields → `{ fieldErrors }` painted on greyed-out fields; (b) **forged-request hole** — a crafted POST can rename or re-`scoringPreset` an archived tournament, and changing `scoringPreset` silently changes how `getStandings` recomputes its now-public archived table. The story's own "Scope note" said to leave `updateTournament` ungated ("name/year/preset edits are not «Результати»"), but it then shipped the full form lock + banner. EXPERIENCE «усі дії редагування зникають; для адміна теж» argues for a full freeze. Also the per-field hint still reads «Змінити можна лише в стані «Чернетка»» for a `COMPLETED`-locked field (`tournament-form.tsx:81`). (blind-hunter + edge-case-hunter)
  - **Option A** — gate `updateTournament` on `COMPLETED` (early `{ formError }`, `checkCanEditResults` or a dedicated check) **and** disable the submit button when every field is locked, **and** fix the hint copy. Full freeze; client + server + banner agree. _(recommended)_
  - **Option B** — revert `LOCKED_WHEN_COMPLETED` to `LOCKED_OUTSIDE_DRAFT` (metadata stays editable in `COMPLETED`, matching the story's written scope note); no broken submit, no shipped promise to break.

#### Patch

- [x] [Review][Patch] Duplicated «Турнір завершено» copy + banner markup, no `role="status"`, no shared component `[src/app/admin/tournaments/[id]/page.tsx, src/app/classic/[tournament]/page.tsx, src/components/match-schedule.tsx]` — three near-identical `<p class="… rounded-md border … bg-muted …">` blocks with inconsistent trailing copy («Результати зафіксовано й редагуванню не підлягають.» / «Підсумкові результати нижче.» / «— розклад зафіксовано.») and no `role="status"`/`role="note"`. Project convention keeps shared UI copy in `src/lib/` (`empty-states.ts`). Extract a `src/components/completed-banner.tsx` (server, `role="status"`, one canonical string) used by both page banners; a future `/beach` public page then inherits it. (blind-hunter)
- [x] [Review][Patch] `transitionTournament` does not revalidate open match pages after finishing `[src/actions/tournaments.ts:59-68]` — it revalidates the schedule page and the tournament page, but an admin who already has `/admin/tournaments/[id]/matches/[matchId]` open keeps the live «Виправити»/entry affordance until a hard reload (then the action rejects with «Турнір завершено…»). Add `revalidatePath('/admin/tournaments/[id]/matches/[matchId]', 'page')`. (blind-hunter)
- [x] [Review][Patch] `assertResultsEditable` is a misnamed one-line passthrough `[src/actions/matches.ts:137-145]` — it returns (does not assert/throw) and just forwards to `checkCanEditResults`. Inline `checkCanEditResults(<state>)` at the four call sites, or rename. (blind-hunter)
- [x] [Review][Patch] `enterMatchResult` runs the `COMPLETED` check after the `sets.length > 0` guard `[src/actions/matches.ts enterMatchResult]` — a completed-tournament entry attempt surfaces «Результат уже внесено.» instead of the clearer freeze message (unreachable via the UI, which passes `lockedReason`, but reachable by a stale/forged request). Move the `assertResultsEditable` check to right after the `!match` null-check. (`editMatchResult` / `removeMatchResult` order is already correct.) (blind-hunter)
- [x] [Review][Patch] `verify-finish-tournament.mts` asserts `checkTransition` with hardcoded booleans, never linking the DB helper `[scripts/verify-finish-tournament.mts:122,144]` — `checkTransition("PLAYOFF","COMPLETED",{ finalAndThirdPlacePlayed: false/true })` uses literals while `await finalAndThirdPlacePlayed(id)` is computed separately and only checked in isolation. Feed the DB-derived value into those `checkTransition` assertions so the script actually exercises data-helper → predicate. (verification-gap) _(The action-layer wiring stays uncovered — harness-blocked, see Defer.)_

#### Defer

- [x] [Review][Defer] TOCTOU on the finish gate and the result-edit lock `[src/actions/tournaments.ts, src/actions/matches.ts]` — deferred, accepted race class (2–5-admin scale, already noted in `deferred-work.md`). A concurrent `removeMatchResult` on the `FINAL`/`THIRD_PLACE` match between `transitionTournament`'s `finalAndThirdPlacePlayed` read and `setTournamentState` can land the tournament in `COMPLETED` with an unplayed decider that `checkCanEditResults` then permanently blocks fixing; the symmetric race lets a result edit commit against a tournament that just went `COMPLETED`. `setTournamentState` already accepts a `Prisma.TransactionClient`, so a `SELECT … FOR UPDATE` + re-check (the `savePlayoffFormation` / `saveRedraw` pattern) is the eventual fix — revisit if a real incident occurs. (blind-hunter + edge-case-hunter)
- [x] [Review][Defer] No action-level regression test for the `COMPLETED` lock `[src/actions/matches.ts, src/actions/tournaments.ts]` — deferred, harness-blocked. The four `assertResultsEditable` early-returns and `transitionTournament`'s `COMPLETED` context branch have zero automated coverage (`verify-finish-tournament.mts` writes through the un-gated `src/data` functions and asserts the pure predicate; there is no `requireAdmin`/session mock). Same standing gap as Stories 3.6 / 3.7 / 4.3 / 4.4. (verification-gap)
- [x] [Review][Defer] No `completedAt` timestamp on `Tournament` `[prisma/schema.prisma]` — deferred, Story 4.7 concern. The archive will order by `updatedAt`, which any later permitted metadata edit or the unguarded delete would bump. Folds into the standing "no audit trail" item. (blind-hunter)
- [x] [Review][Defer] `deleteTournament` stays unguarded for `COMPLETED` and its `ConfirmDialog` copy omits matches/results/standings `[src/components/tournament-actions.tsx, src/actions/tournaments.ts]` — deferred, pre-existing (Story 2.5 deliberately left delete state-unrestricted; useful as the only escape hatch while PRD Open Question #4 is open). The confirm copy could add «матчі та результати». (blind-hunter)

## Dev Notes

### What this story is / is NOT

**Is:** the `PLAYOFF → COMPLETED` transition, finally wired. Three pieces:
1. **The precondition input** — `finalAndThirdPlacePlayed(tournamentId)` (`src/data/matches.ts`, mirrors `allGroupMatchesPlayed`) feeds the `COMPLETED` predicate that already exists in `tournamentState.ts`. `transitionTournament(id, "COMPLETED")` gets its first real caller.
2. **The button** — `FinishTournamentButton` (`tournament-actions.tsx`, `ConfirmDialog` + `checkTransition` disabled/caption), shown in the admin `[id]` page's `PLAYOFF` state.
3. **The result-edit lock** — a new pure predicate `checkCanEditResults(state)` (`tournamentState.ts`) blocks `enterMatchResult` / `editMatchResult` / `removeMatchResult` / `scheduleMatch` in `COMPLETED` (PRD Open Question #3, resolved for v1). Plus the EXPERIENCE «Турнір завершено» banner (public page) and the disabled edit affordances on the admin match / schedule surfaces.

**Is NOT** (do not pull forward):
- **The `/archive` route, its year grouping, its «тип, рік, назва, місця 1–4» list, `/archive/[year]/[tournament]` read-only view.** Story 4.7 (FR-23 / CAP-10). This story only makes a tournament `COMPLETED` and `revalidatePath("/archive")`.
- **Removing `COMPLETED` tournaments from the `/classic` active list.** Story 4.7's decision (`deferred-work.md`, 2.9 review). Leave `listPublicTournaments()` untouched.
- **The public «Плейоф» tab / `Bracket` component / `bracket-pair-tbd` / a public placements block.** Story 4.6. The public tab stays its one-line placeholder.
- **Un-completing a tournament / returning it from the archive to active (PRD Open Question #4).** Explicitly open, out of scope. No backward `COMPLETED → PLAYOFF` edge — `TRANSITIONS.COMPLETED = []` stays.
- **Correcting results in a completed tournament with re-recompute (the other horn of Open Question #3).** Resolved *against* — v1 blocks fully.
- **Gating `updateTournament` / `deleteTournament` / roster / enrollment writes on `COMPLETED`.** Out of scope (see "Enforcing the lock" note). `deleteTournament` stays state-unrestricted (Story 2.5).
- **A migration / a new route / a new `src/domain` module.** `checkCanEditResults` is a function in the existing `tournamentState.ts`. `finalAndThirdPlacePlayed` is a function in the existing `matches.ts`.
- **Changing `tournamentState.ts`'s transition table or precondition predicates.** The `COMPLETED` edge + `PRECONDITIONS.COMPLETED` (gating on `ctx.finalAndThirdPlacePlayed`) were built in Story 2.3 for exactly this. Only add `checkCanEditResults`.
- **Touching `advanceBracket` / `seedPlayoff` / `playoffPlacements` / `getPlayoffBracket` / `savePlayoffAdvancement` / `checkCanEditSemifinalResult`.** Stories 4.1–4.4, used as-is.
- **A `--warning`/banner design token.** DESIGN.md has none; use `border` + `muted` + text (Accessibility Floor: state never colour-only). Same open item as `notify.warning` (`deferred-work.md`, 4.2 review) — do not solve the design-token gap here.
- **BEACH.** `discipline = CLASSIC` only.

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/domain/tournamentState.ts` | UPDATE | `checkCanEditResults` + `ResultEditCheck`. No change to `TRANSITIONS` / `checkTransition` / `PRECONDITIONS`. |
| `src/domain/tournamentState.test.ts` | UPDATE | ~4 cases for `checkCanEditResults`. |
| `src/data/matches.ts` | UPDATE | `finalAndThirdPlacePlayed(tournamentId, client?)` (mirrors `allGroupMatchesPlayed`); `getMatchForResult` selects `tournament.state`. |
| `src/actions/tournaments.ts` | UPDATE | `transitionTournament`'s `COMPLETED` context branch + 3 extra `revalidatePath`. |
| `src/actions/matches.ts` | UPDATE | `checkCanEditResults` gate on `enter`/`edit`/`removeMatchResult` + `scheduleMatch`. |
| `src/components/tournament-actions.tsx` | UPDATE | `FinishTournamentButton` (NEW export). |
| `src/app/admin/tournaments/[id]/page.tsx` | UPDATE | `finalAndThirdPlacePlayed` fetch; `PLAYOFF` finish section; `COMPLETED` banner + fully-locked form. |
| `src/app/admin/tournaments/[id]/matches/[matchId]/page.tsx` | UPDATE | `editLockedReason` also from `checkCanEditResults`; `lockedReason` → `MatchResultForm`. |
| `src/components/match-result-form.tsx` | UPDATE | `lockedReason?: string` prop → disabled inputs + caption. |
| `src/components/match-schedule.tsx` | UPDATE | `locked?: boolean` → hide schedule `<form>`, read-only result text, top caption. |
| `src/app/admin/tournaments/[id]/schedule/page.tsx` | UPDATE | pass `locked={state === "COMPLETED"}`. |
| `src/app/classic/[tournament]/page.tsx` | UPDATE | «Турнір завершено» banner above the tabs when `COMPLETED`. |
| `scripts/verify-finish-tournament.mts` | NEW | 4-team playoff → finish → assert precondition + lock. |
| `src/domain/README.md` · `src/data/README.md` · `src/actions/README.md` · `src/components/README.md` · `AGENTS.md` · `_bmad-output/implementation-artifacts/deferred-work.md` | UPDATE | Module entries, Stack status, verify catalogue, resolved/open questions. |
| `src/components/match-result-panel.tsx` | DO NOT MODIFY | Already consumes `lockedReason`; it's just also fed the `COMPLETED` reason now. |
| `src/domain/tournamentState.ts` `TRANSITIONS` / `PRECONDITIONS` / `checkTransition` | DO NOT MODIFY | Story 2.3 built the `COMPLETED` edge + predicate for this. |
| `src/domain/bracket.ts` · `src/data/playoff.ts` | DO NOT MODIFY | Stories 4.1–4.4. |
| `src/data/tournaments.ts` `listPublicTournaments` / `getPublicTournament` | DO NOT MODIFY | `/classic` still lists `COMPLETED` — Story 4.7's call. |
| `prisma/**` | DO NOT TOUCH | No schema change. |
| `src/app/archive/**` | DO NOT CREATE | Story 4.7. |

### Architecture compliance

- **AD-8** — `state` moves only through `transitionTournament` → `checkTransition` (edge + `PRECONDITIONS.COMPLETED`) → `setTournamentState` (the sole writer). No direct assignment. The `COMPLETED` edge and precondition were defined in Story 2.3; this story supplies the runtime input. [ARCHITECTURE-SPINE.md#AD-8]
- **AD-4 / NFR-3** — `COMPLETED` adds a *write lock*, never a stored table/placement. `getStandings` / `getPlayoffBracket` derive on read, unchanged. Freezing edits cannot desync a derivation. [ARCHITECTURE-SPINE.md#AD-4, PRD NFR-3]
- **AD-6 / AD-11** — the finish is a Server Action (`transitionTournament`, first line `await requireAdmin()`); the lock is enforced in the four result Server Actions; `finalAndThirdPlacePlayed` is a named `src/data` function; no Prisma in `src/actions` / `src/components` / `src/app`. [ARCHITECTURE-SPINE.md#AD-6, #AD-11]
- **AD-2 / AD-3** — `checkCanEditResults` is pure `src/domain` (no framework/IO); the `view → domain` `checkTransition` call in `FinishTournamentButton` is the established edge (`FormPlayoffButton`). [ARCHITECTURE-SPINE.md#AD-2, #AD-3]
- **NFR-1** — the lock is server-side; the disabled UI controls are a convenience, not the control. [PRD NFR-1]
- **Consistency Conventions** — new domain function has Vitest cases; the verify script covers the new data path; `revalidatePath` after the write covers `/archive` + the public tournament page + the admin surfaces. [ARCHITECTURE-SPINE.md#Consistency]

### Existing code being modified — current state → change → what must be preserved

**`src/domain/tournamentState.ts`** (Story 2.3, untouched by 3.x/4.x)
- *Current:* `TournamentState`, `TRANSITIONS` (forward-only), `LABELS`, `TransitionContext` (already has `finalAndThirdPlacePlayed?: boolean`), `PRECONDITIONS` (`COMPLETED` gates on `ctx.finalAndThirdPlacePlayed === true`, message «Завершити турнір можна лише коли зіграно фінал і матч за 3-тє місце.»), `canTransition`, `checkTransition`. No imports. `tournamentState.test.ts` covers the table + `checkTransition` edges/preconditions.
- *Change:* add `ResultEditCheck` + `checkCanEditResults(state)`.
- *Must preserve:* every existing export and signature; the `PRECONDITIONS.COMPLETED` message and predicate (do **not** "improve" it); no imports added.

**`src/data/matches.ts`** (Stories 3.2–3.7 + 4.3)
- *Current:* `getStandings`, `listGroupMatchesForTournament`, `updateMatchSchedule`, `hasAnyGroupResult(id, client?)`, `allGroupMatchesPlayed(id, client?)` (`GROUP`-scoped, `_count.sets` per match), `getMatchForResult` (selects `tournament: { scoringPreset, type, discipline }`), `createMatchResult` / `replaceMatchResult` / `deleteMatchResult` (any stage since 4.3). `SET_SCORE_NATURAL_KEY_INDEX`, `isMissingMatch`.
- *Change:* add `finalAndThirdPlacePlayed(id, client?)` next to `allGroupMatchesPlayed`; add `state: true` to `getMatchForResult`'s `tournament` select.
- *Must preserve:* `allGroupMatchesPlayed` verbatim (`FINAL`/`THIRD_PLACE` filter is a *new* function, not a change to that one); `getMatchForResult`'s other selected fields; every result-mutation function's transaction shape and `{ ok, reason }` returns.

**`src/actions/tournaments.ts`** (Stories 2.3–2.5)
- *Current:* `transitionTournament(id, targetState)` — `requireAdmin` → `getTournamentForAdmin` → build `context` (only `GROUP_STAGE` branch populated) → `checkTransition` → `setTournamentState` → `revalidatePath` (public discipline path; `/archive` when `COMPLETED`; `/admin/tournaments/${id}`) → `{ ok: true, data: { state } }` / `toActionError`. Also `createTournament` / `updateTournament` / `deleteTournament`.
- *Change:* add the `COMPLETED` context branch (`finalAndThirdPlacePlayed`); add 3 `revalidatePath` calls.
- *Must preserve:* the `GROUP_STAGE` branch; the `getTournamentForAdmin` null → `NOT_FOUND`; `checkTransition` result mapping; `setTournamentState`; the existing `revalidatePath` calls; the `try/catch → toActionError`. `createTournament` / `updateTournament` / `deleteTournament` untouched.

**`src/actions/matches.ts`** (Stories 3.5–3.7 + 4.3 + 4.4)
- *Current:* `scheduleMatch` (`getTournamentForAdmin` → `validateMatchSchedule` → `updateMatchSchedule`), `enterMatchResult` / `editMatchResult` (`MatchResultFormState`) / `removeMatchResult` (`ActionResult`), `parseSetsFromForm` / `parseAndValidate` (`"Партія N:"` regex), `revalidateMatchSurfaces` (4 paths), `advancePlayoffAfterSemifinal` (`SEMIFINAL`-only), `checkSemifinalResultEditable` (`SEMIFINAL`-only, uses `readPlayoffMatchStates`). No `Tournament.state` guard anywhere (the "Story 4.5" TODO).
- *Change:* add `checkCanEditResults(state)` gate to all four; add `state` read where missing (only `getMatchForResult` needs the select widened — `scheduleMatch` already has `tournament.state`).
- *Must preserve:* `parseAndValidate` unchanged (keep the gate message free of `"Партія N:"`); `advancePlayoffAfterSemifinal` / `checkSemifinalResultEditable` / `revalidateMatchSurfaces` calls and their order; the `sets.length` guards; the three return shapes; the `requireAdmin` catch. The `COMPLETED` gate goes **before** the semifinal gate (cheaper, and a completed tournament blocks regardless of slot).

**`src/app/admin/tournaments/[id]/page.tsx`** (Stories 2.4–2.8 + 3.3–3.4 + 4.2)
- *Current:* `Promise.all([getTournamentForAdmin, listTeams, listEntriesForTournament, hasAnyGroupResult, allGroupMatchesPlayed])`; `TournamentForm` (edit, `locked` = `["teamCount","rounds"]` outside `DRAFT`); `Команди` section; `DRAFT` → draw section; `GROUP_STAGE` → redraw + form-playoff sections; `state !== "DRAFT"` → schedule link; delete button.
- *Change:* add `finalAndThirdPlacePlayed(id)` to `Promise.all`; `PLAYOFF` → finish section; `COMPLETED` → banner + fully-locked form.
- *Must preserve:* the back link, the `Стан:` line, every existing section and its state gate, the `TournamentForm` `key`/`initial` shaping, the delete button.

**`src/app/admin/tournaments/[id]/schedule/page.tsx`** (Stories 3.5 + 4.3 + 4.4)
- *Current:* `DRAFT` → `GROUP_NOT_DRAWN`; else `MatchScheduleList` (group matches VM); `inPlayoff` (`PLAYOFF`|`COMPLETED`) → `getPlayoffBracket` → `PlayoffSchedule` + `PlayoffPlacements` (when `hasPlacements`).
- *Change:* pass `locked={tournament.state === "COMPLETED"}` to `MatchScheduleList`.
- *Must preserve:* the `DRAFT` branch, the group-match VM shaping, the `inPlayoff` section (`PlayoffSchedule` + `PlayoffPlacements`) — a `COMPLETED` tournament still shows its final bracket + placements here, read-only.

**`src/app/classic/[tournament]/page.tsx`** (Stories 2.9 + 3.5 + 3.8)
- *Current:* `resolveTournament` → `notFound()`; `StatusBadge`; `TournamentTabs` (`showPlayoff` = `PLAYOFF`|`COMPLETED`); default tab `standings` (`GROUP_STAGE`+) / `teams` (`DRAFT`); per-tab data reads; `playoff` tab is a placeholder `<p>`.
- *Change:* a «Турнір завершено» banner above `<TournamentTabs>` when `state === "COMPLETED"`.
- *Must preserve:* the `notFound()`, the `StatusBadge`, the tab routing / default-tab logic, every tab's render, the `playoff` placeholder (Story 4.6).

### Testing requirements

- **New Vitest** — `checkCanEditResults` gets ~4 cases in `tournamentState.test.ts` (every `src/domain` function needs unit tests — AGENTS.md). `pnpm test` **167 → ~171**; exact number in the Dev Agent Record. `checkTransition(..., "COMPLETED", ...)` is already covered by the Story 2.3 tests — no new case needed there unless you spot a gap.
- **`scripts/verify-finish-tournament.mts`** is the integration gate: the real DB round-trip through the 4-team playoff to `finalAndThirdPlacePlayed` true/false and `checkTransition` accept/reject, plus `checkCanEditResults` at the predicate level (the action wiring is the standing "no session-mock harness" gap — assert the predicate + the reloaded `state`, matching `verify-advance-bracket.mts`'s approach to the semifinal gate).
- **No action-level test** for the gated result actions (standing gap — every prior story). The domain predicate + verify script + code review cover it.
- **No migration** — `prisma migrate status` + `migrate diff --exit-code` clean (confirm, since `src/data/matches.ts` changes but no schema).
- **Regression:** `pnpm build` (several pages changed) + re-run all 11 `verify-*.mts`.

### Project Structure Notes

- `checkCanEditResults` in `tournamentState.ts`, not a new `src/domain/resultLock.ts`: it is lifecycle policy keyed on `TournamentState`, and the module's own doc-comment claims to be "the single source of truth for … what has to be true" about the lifecycle. `checkCanRedraw` got its own module only because redraw is a same-state repeatable action with no lifecycle home — this has one.
- `finalAndThirdPlacePlayed` in `matches.ts` beside `allGroupMatchesPlayed`, not `playoff.ts`: it is a `Match`/`SetScore` count with no bracket derivation, exactly `allGroupMatchesPlayed`'s shape; `playoff.ts` is for `advanceBracket`-driven reads.
- `FinishTournamentButton` in the existing `tournament-actions.tsx` (with `Draw`/`Redraw`/`FormPlayoff`), not a new file — same client module, same `checkTransition`/`ConfirmDialog`/`notify` imports.
- The `COMPLETED` banner: inline in the page is consistent with the `playoff`-tab placeholder and keeps this story small. A `completed-banner.tsx` component is a fine call if the dev wants 4.6/4.7 reuse — not required.

### Previous story intelligence

- **Story 4.4 (done, code-reviewed)** — `checkCanEditSemifinalResult` (`bracket.ts`) + the `editMatchResult` / `removeMatchResult` gate via `readPlayoffMatchStates`; `playoffPlacements` folded into `getPlayoffBracket` as `placements`; `PlayoffPlacements` component in the admin schedule «Плейоф» section; `MatchResultPanel` got a `lockedReason` prop + the match page computes it for the semifinal gate. **This story's `COMPLETED` lock uses the same `lockedReason` prop / same match-page `editLockedReason` computation** — just a second reason source. `pnpm test` 167.
- **Story 4.3 (done)** — un-scoped all playoff result CRUD from `stage: "GROUP"`; `getPlayoffBracket` (`advanceBracket` on read) + `savePlayoffAdvancement` (on write). The match screen no longer `notFound()`s a non-`GROUP` match. `PlayoffSchedule` component + the `PLAYOFF`|`COMPLETED` admin schedule section.
- **Story 4.2 (done)** — `formPlayoff` — the "dedicated action, not `transitionTournament`" precedent (because it seeds); `FormPlayoffButton` — the `checkTransition`-driven disabled+caption + `notify` pattern this story's `FinishTournamentButton` mirrors. `allGroupMatchesPlayed(id, client?)` — the exact shape `finalAndThirdPlacePlayed` copies. `savePlayoffFormation` — `SELECT … FOR UPDATE` + report-not-throw races.
- **Story 3.4 (done)** — `checkCanRedraw(state, hasResults): { ok: true } | { ok: false; message }` in `src/domain/redraw.ts` — **the exact shape** for `checkCanEditResults`. `RedrawTournamentButton` — `ConfirmDialog` + disabled + caption on `!ok` (the pattern for `FinishTournamentButton`, which also needs the dialog).
- **Story 3.7 (done)** — `deferred-work.md` explicitly: «No `Tournament.state` guard on edit/delete — consistent with `enterMatchResult` / `scheduleMatch`. A `COMPLETED` lock on result editing is FR-7 (Story 4.5); until then a completed tournament's archived results are editable.» — **this story closes that.**
- **Story 2.3 (done)** — built `tournamentState.ts` with `PRECONDITIONS.COMPLETED` as a fail-closed stub gating on `ctx.finalAndThirdPlacePlayed`; `transitionTournament` as the single parameterized transition action. The `deferred-work.md` note that dedicated per-edge actions "belong with the draw/playoff" only applies to edges doing domain work — `COMPLETED` does none.

### Git intelligence

Recent: `e781c95` (Story 4.4 review-fix, done) ← `d0d707e` ← `1286a7e` ← `64b4990` ← `f435266`. `epic-4` `in-progress`; `4-1`…`4-4` `done`, `4-5` `backlog`, `4-6` / `4-7` `backlog`. `src/domain/tournamentState.ts` has the `COMPLETED` edge + precondition (fail-closed, unused input). `src/actions/tournaments.ts` `transitionTournament` has **no caller in `src/`** yet — this story is its first. `src/actions/matches.ts` result CRUD has no `Tournament.state` guard (the tracked "Story 4.5" gap). No migration since `20260907140000_match_slot_stage_per_stage_fix`. `pnpm test` 167.

### Latest tech information

- **No new library.** Prisma 7, Next 16 Server Actions, `revalidatePath`. `checkCanEditResults` / `finalAndThirdPlacePlayed` are pure TS + one Prisma count.
- **No migration** — no schema change. `prisma generate` runs in `postinstall` / `build`; run `pnpm build` because several pages change (routes unchanged, so `typecheck` is green without it, but run it).
- **`lucide-react`** already a dependency — `Loader2Icon` (used in `tournament-actions.tsx`) covers the button; no new icon needed.
- **`ConfirmDialog`** (`src/components/confirm-dialog.tsx`) — `onConfirm` returning `false` closes the dialog + lets the caller toast; throwing keeps it open (per `src/components/README.md`). `FinishTournamentButton.finish` follows `RedrawTournamentButton.redraw` exactly.
- **`noUncheckedIndexedAccess` is OFF** — no bearing here.

### Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 4.5 AC, FR-7; the 4.5/4.6/4.7 boundaries), `prd.md` §4.2 (FR-7) + §11 + Open Questions #3/#4, `ARCHITECTURE-SPINE.md` (AD-2/AD-4/AD-6/AD-8/AD-11 + Deferred: "Політика редагування результатів у завершеному турнірі — поведінкове рішення"), `SPEC.md` (CAP-2 success: «у Завершений — лише коли зіграно фінал і матч за 3-тє»; Assumptions: «редагування результатів заблоковане»), `EXPERIENCE.md` (State Patterns «Турнір завершено»; Component Patterns → Admin action bar; Interaction Primitives → Підтвердження; Voice and Tone «Завершити турнір? …»), `DESIGN.md` (Status badge «Завершений» — контур `#6B6B70`; no banner token), `2-3-tournament-state-machine.md` (the `COMPLETED` predicate stub), `4-2-generate-playoff.md` (`allGroupMatchesPlayed` shape, `FormPlayoffButton`), `4-4-playoff-results-final-placements.md` (`lockedReason` prop, the match-page lock computation), `3-7-edit-delete-result.md` + `deferred-work.md` (the "`COMPLETED` lock is Story 4.5" note being closed).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.5: Завершити турнір] — user story + AC; FR-7
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.6 / #Story 4.7] — boundaries: 4.6 = public bracket; 4.7 = `/archive` + places 1–4 list + read-only archived view
- [Source: _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md#4.2] — FR-7 «Наслідки» · [#10 Open Questions #3, #4] · [#11 Індекс припущень — «редагування Результатів у Завершеному турнірі заблоковане»]
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#Capabilities CAP-2] — «у Завершений — лише коли зіграно фінал і матч за 3-тє місце; прямої зміни стану в обхід переходів немає» · [#Assumptions] — «Після переходу турніру в стан Завершений редагування результатів заблоковане»
- [Source: …/ARCHITECTURE-SPINE.md#AD-8] — transitions check preconditions, no direct `state` assignment · [#AD-4] — placements never stored · [#AD-6/#AD-11/#AD-2/#AD-3] · [#Deferred] — "Політика редагування результатів у завершеному турнірі … поведінкове рішення"
- [Source: …/ux-designs/…/EXPERIENCE.md#State Patterns — «Турнір завершено»] — banner + all edit actions disappear, admin too · [#Component Patterns — Admin action bar] · [#Interaction Primitives — Підтвердження] · [#Voice and Tone] — «Завершити турнір? Після цього результати редагувати не можна.»
- [Source: …/ux-designs/…/DESIGN.md#Status badge] — «Завершений» контур `#6B6B70`
- [Source: src/domain/tournamentState.ts] — `TRANSITIONS.PLAYOFF = ["COMPLETED"]`, `PRECONDITIONS.COMPLETED` (`ctx.finalAndThirdPlacePlayed`)
- [Source: src/domain/redraw.ts] — `checkCanRedraw` return-union shape for `checkCanEditResults`
- [Source: src/data/matches.ts] — `allGroupMatchesPlayed` shape for `finalAndThirdPlacePlayed`; `getMatchForResult`
- [Source: src/actions/tournaments.ts] — `transitionTournament` structure, the `context` block
- [Source: src/actions/matches.ts] — `checkSemifinalResultEditable` precedent; the four result mutation actions
- [Source: src/components/tournament-actions.tsx] — `FormPlayoffButton` / `RedrawTournamentButton` for `FinishTournamentButton`
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — "«A `COMPLETED` lock on result editing is FR-7 (Story 4.5)»"; the `checkCanRedraw` predicate pattern; the "no session-mock harness" test gap

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (implemented in-session, no separate dev-story agent)

### Debug Log References

- `pnpm build` runs `node scripts/migrate-deploy.mjs` locally (`VERCEL_ENV` unset) → `migrate deploy` against the Neon `dev` branch; no-op this story (no new migration), build green.

### Completion Notes List

- **Task 1–2:** `src/domain/tournamentState.ts` — `ResultEditCheck` + `checkCanEditResults(state)` (`COMPLETED` → block, else ok; `checkCanRedraw` shape). `TRANSITIONS` / `PRECONDITIONS` / `checkTransition` untouched. +1 `describe` / 2 `it` in `tournamentState.test.ts`. `pnpm test` **167 → 169**.
- **Task 3:** `src/data/matches.ts` — `finalAndThirdPlacePlayed(tournamentId, client?)` (mirrors `allGroupMatchesPlayed`; both `FINAL` + `THIRD_PLACE` must have a `SetScore`). `getMatchForResult` now selects `tournament.state`.
- **Task 4:** `src/actions/tournaments.ts` — `transitionTournament` fills `context.finalAndThirdPlacePlayed` for `COMPLETED`; added `revalidatePath` for `/admin/tournaments`, `…/schedule`, and the public tournament route.
- **Task 5:** `src/actions/matches.ts` — `assertResultsEditable(state)` helper wired into `enterMatchResult` / `editMatchResult` (`{ formError }`), `removeMatchResult` (`{ ok: false, code: "PRECONDITION_FAILED" }`), `scheduleMatch` (`{ formError }`), each before the semifinal gate / write. Doc comments updated (the "Story 4.5" TODOs replaced).
- **Task 6:** `src/components/tournament-actions.tsx` — `FinishTournamentButton` (`ConfirmDialog` `destructive` + `checkTransition` disabled/caption; calls `transitionTournament(id, "COMPLETED")`).
- **Task 7:** admin `[id]/page.tsx` — `finalAndThirdPlacePlayed(id)` in `Promise.all`; `PLAYOFF` → «Завершення» section with `<FinishTournamentButton>`; `COMPLETED` → banner + `TournamentForm` `locked` = all six fields.
- **Task 8:** match screen — `editLockedReason` now also from `checkCanEditResults(match.tournament.state)` (takes precedence over the semifinal gate); `MatchResultForm` gained `lockedReason?` (replaces the form with a muted line), passed from the page.
- **Task 9:** `src/components/match-schedule.tsx` — `MatchScheduleList` / `MatchScheduleRow` `locked?: boolean`; when locked, the per-row schedule `<form>` is dropped and a muted caption heads the list (the match-screen `<Link>` stays). Schedule page passes `locked={state === "COMPLETED"}`.
- **Task 10:** public `classic/[tournament]/page.tsx` — «Турнір завершено» banner above `<TournamentTabs>` when `COMPLETED`. `listPublicTournaments()` untouched.
- **Task 11:** `scripts/verify-finish-tournament.mts` (NEW) — 4-team playoff → both semifinals → assert `finalAndThirdPlacePlayed` false / false-after-final-only / true; `checkTransition` reject→accept; `checkCanEditResults` PLAYOFF ok / COMPLETED block; `setTournamentState(…, COMPLETED)` → reloaded-state lock. Full teardown. Green.
- **Task 12:** docs — `src/domain/README.md`, `src/data/README.md`, `src/actions/README.md`, `src/components/README.md`, `AGENTS.md` (Stack bullet + verify line + convention), `deferred-work.md` (Story 4.5 section: Open Q #3 resolved / #4 open; `scheduleMatch` lock = EXPERIENCE decision; `/classic` unchanged; TOCTOU + no-action-test + no-banner-token + unconditional-fetch items).
- **Task 13:** `pnpm build` ✓ · `pnpm typecheck` ✓ · `pnpm lint` ✓ · `pnpm test` **169/169**. `prisma migrate status` up to date; `migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` → "empty migration". All 16 `verify-*.mts` green.

### File List

- `src/domain/tournamentState.ts` (UPDATE)
- `src/domain/tournamentState.test.ts` (UPDATE)
- `src/data/matches.ts` (UPDATE)
- `src/actions/tournaments.ts` (UPDATE)
- `src/actions/matches.ts` (UPDATE)
- `src/components/tournament-actions.tsx` (UPDATE)
- `src/components/match-result-form.tsx` (UPDATE)
- `src/components/match-schedule.tsx` (UPDATE)
- `src/app/admin/tournaments/[id]/page.tsx` (UPDATE)
- `src/app/admin/tournaments/[id]/schedule/page.tsx` (UPDATE)
- `src/app/admin/tournaments/[id]/matches/[matchId]/page.tsx` (UPDATE)
- `src/app/classic/[tournament]/page.tsx` (UPDATE)
- `scripts/verify-finish-tournament.mts` (NEW)
- `src/components/completed-banner.tsx` (NEW — review patch)
- `src/components/tournament-form.tsx` (UPDATE — review patch: `lockedHint`, hide submit when fully locked)
- `src/domain/README.md` · `src/data/README.md` · `src/actions/README.md` · `src/components/README.md` · `AGENTS.md` · `_bmad-output/implementation-artifacts/deferred-work.md` (UPDATE)

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-07 | Story drafted (`bmad-create-story`). Scope: wire `PLAYOFF → COMPLETED` — `finalAndThirdPlacePlayed` data helper feeds the existing `tournamentState.ts` precondition; `FinishTournamentButton` (`ConfirmDialog` + `checkTransition`) calls `transitionTournament(id, "COMPLETED")` (its first real caller); new pure `checkCanEditResults(state)` blocks `enter`/`edit`/`removeMatchResult` + `scheduleMatch` in `COMPLETED`; «Турнір завершено» banner + disabled edit affordances on admin match/schedule surfaces. No migration, no new route, no new domain module. `/archive` = Story 4.7; public bracket = Story 4.6; un-complete (Open Q #4) = out of scope. Status: ready-for-dev. |
| 2026-09-07 | Implementation complete (in-session) — all 14 tasks. `checkCanEditResults` (`tournamentState.ts`) + the four-action `COMPLETED` gate; `finalAndThirdPlacePlayed` (`matches.ts`) feeds `transitionTournament`'s `COMPLETED` context (its first real caller, via `FinishTournamentButton`); «Турнір завершено» banners; `locked`/`lockedReason` props lock the admin match & schedule surfaces; `TournamentForm` fully locked in `COMPLETED`. `scripts/verify-finish-tournament.mts` (NEW). No migration, no new route, no new domain module. `pnpm build`/`typecheck`/`lint` clean, `pnpm test` 169/169, all 16 verify scripts green, `migrate` clean. Status: review. |
| 2026-09-07 | Code review (`bmad-code-review`, 4 layers) — 1 decision-needed, 5 patch, 4 deferred, ~11 dismissed. Decision resolved to **Option A** (full freeze): `updateTournament` now refuses a `COMPLETED` tournament server-side; `TournamentForm` hides the submit when fully locked + `lockedHint` prop fixes the caption. Patches applied: shared `CompletedBanner` (`role="status"`, one string); `transitionTournament` revalidates match screens; `assertResultsEditable` inlined; `COMPLETED` check moved ahead of the `sets.length` guards in `enterMatchResult`; `verify-finish-tournament.mts` feeds the DB helper into its `checkTransition` assertions. Gate re-run clean (`build`/`typecheck`/`lint`, `pnpm test` 169/169, all 16 verify scripts green). Status: done. |
