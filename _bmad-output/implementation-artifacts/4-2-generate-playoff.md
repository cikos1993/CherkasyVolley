---
baseline_commit: 3304f5f
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/implementation-artifacts/3-3-draw.md
  - _bmad-output/implementation-artifacts/3-4-redraw.md
  - _bmad-output/implementation-artifacts/4-1-domain-engine-bracket.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - AGENTS.md
---

# Story 4.2: Сформувати плейоф

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an адмін,
I want сформувати сітку плейофа одним кліком,
so that турнір переходить до фінальної стадії (FR-19).

## Acceptance Criteria

Translated from `epics.md` → Epic 4 → Story 4.2. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** a tournament in state `GROUP_STAGE` where **every** group match has a result
**When** the admin presses «Сформувати плейоф»
**Then**

1. Two semifinal `Match` rows are created (`stage = SEMIFINAL`) seeded **1–4** and **2–3** by the group table.
2. The tournament state becomes `PLAYOFF`; the «Плейоф» tab appears.
3. The button is **disabled with a caption** while any group match has no result.
4. Multi-group tournaments are not supported in v1 (the button is unavailable).

FR / AD / SPEC anchors (in context):

- **FR-19** (`prd.md` §4.8): "Адмін може сформувати Плейоф Турніру одним кліком. **Наслідки (перевірювані):** — Кнопка активна лише коли кожен Матч групового етапу має Результат. — Посів = місце в Таблиці групи; у Плейоф виходять команди з місцями 1–4. — Формуються два півфінали: посів 1 проти посіву 4, посів 2 проти посіву 3. — Стан турніру = Плейоф. — Багатогрупні турніри у v1 не підтримуються (FR-4); розподіл 4 місць між кількома Групами — Відкрите питання №1, залежить від регламенту."
- **CAP-9** (`SPEC.md`): "Кнопка активна лише коли всі групові матчі мають результат; формуються півфінали посів 1 – посів 4 і посів 2 – посів 3".
- **AD-8** (`ARCHITECTURE-SPINE.md`): "переходи `DRAFT → GROUP_STAGE → PLAYOFF → COMPLETED` — окремі Server Actions, кожна перевіряє передумови (напр. `PLAYOFF` лише коли всі групові `Match` мають `SetScore`)". **CAP-2** (`SPEC.md`): "перехід у Плейоф — лише коли всі групові матчі мають результат … прямої зміни стану в обхід переходів немає."
- **AD-5** (`ARCHITECTURE-SPINE.md`): "матчі плейофа (півфінали, фінал, за 3-тє місце) — рядки `Match` зі `stage ≠ GROUP`, мають розклад і результат … Це обчислення [пар наступних раундів] виконує лише `domain/bracket.ts` (`advanceBracket`)."
- **AD-6** (`ARCHITECTURE-SPINE.md`): "будь-яка зміна БД — тільки через Server Action у `src/actions/`, перший рядок якої — `await requireAdmin()`."
- **AD-11** (`ARCHITECTURE-SPINE.md`): "Prisma-клієнт імпортується лише в `src/data/`. Кожне читання й запис проходить через іменовану функцію `src/data/`."
- **AD-4** (`ARCHITECTURE-SPINE.md`): "Таблиця групи й фінальні місця **не зберігаються** — обчислюються при кожному читанні." **AD-2** (`ARCHITECTURE-SPINE.md`): "посів плейофа … — чисті функції в `src/domain/`."
- **AD-9** (`ARCHITECTURE-SPINE.md`) / **PRD Open Question #1**: "v1 — рівно одна `Group`. … багатогрупні турніри доходять лише до кінця Групового етапу."
- **Capability → Architecture Map** (`ARCHITECTURE-SPINE.md`): "Плейоф: формування, автопросування, результати (FR-19..FR-22) | `src/domain/bracket.ts`, `src/actions/playoff` | AD-5, AD-8".
- **EXPERIENCE.md** (Admin action bar): "Груповий етап → (жодної глобальної, лише введення результатів) + «Сформувати плейоф» коли всі групові матчі зіграно". **State Patterns**: "Плейоф недоступний | Кнопка «Сформувати плейоф» неактивна + підпис «доступно коли всі матчі груп зіграно»". **KF-1 §6**: "за секунду зʼявляється вкладка Плейоф із заповненими півфіналами (1–4, 2–3), фінал і матч за 3-тє місце — «очікує суперників»." **No `ConfirmDialog` is specified** (unlike «Провести жеребкування» / «Завершити турнір»).

### Notes on AC interpretation

- **This is the `drawTournament` (Story 3.3) pattern applied to the `PLAYOFF` transition.** A dedicated verb-named Server Action `formPlayoff(tournamentId)` in a new `src/actions/playoff.ts` — **not** a call into the generic `transitionTournament`, because forming the playoff does domain work (seed the bracket, create `Match` rows) that the generic action does not. The action reuses `checkTransition` from `@/domain/tournamentState` directly (same as `drawTournament` reuses it for `DRAFT → GROUP_STAGE`), calls `seedPlayoff` (Story 4.1), and persists everything in **one `db.$transaction`** via a new `src/data/playoff.ts` function, with `setTournamentState(..., tx)` participating in that transaction. File layout mirrors `draw.ts` exactly (`src/actions/draw.ts` + `src/data/draw.ts`). The spine names the module `src/actions/playoff`; use `src/actions/playoff.ts`.

- **`src/domain/tournamentState.ts` is NOT touched.** The `PLAYOFF` precondition already exists and already takes `ctx.allGroupMatchesPlayed?: boolean`, fail-closed (`tournamentState.ts` lines 70–77: `ctx.allGroupMatchesPlayed === true ? { ok: true } : { ok: false, code: "PRECONDITION_FAILED", message: "Плейоф недоступний: не всі групові матчі зіграно." }`). Story 4.2 only **supplies the boolean** — it does not modify the predicate. `deferred-work.md`'s "Story 4.2 wires `allGroupMatchesPlayed`" means *provides the input*, not *changes the code*.

- **New data-layer read: `allGroupMatchesPlayed(tournamentId, client?)`.** There is no function today that answers "does every group match have a result?" — `hasAnyGroupResult` answers the weaker "is there *any* result", and `getStandings` filters to played matches but never compares counts. Add to `src/data/matches.ts`:
  ```ts
  export async function allGroupMatchesPlayed(
    tournamentId: string,
    client: Prisma.TransactionClient | typeof db = db,
  ): Promise<boolean> {
    const [total, played] = await Promise.all([
      client.match.count({ where: { tournamentId, stage: "GROUP" } }),
      client.match.count({ where: { tournamentId, stage: "GROUP", sets: { some: {} } } }),
    ]);
    return total > 0 && played === total;
  }
  ```
  `total > 0` guards the vacuous "0 of 0" (an undrawn tournament — not reachable at `GROUP_STAGE`, but be explicit). Accept the optional `Prisma.TransactionClient` (the `hasAnyGroupResult` / `setTournamentState` precedent) so the action can re-check inside the transaction (TOCTOU — Story 3.4).

- **Schema change: `Match.slot` — a nullable discriminator for the two `SEMIFINAL` rows.** `MatchStage` has one `SEMIFINAL` value; `bracket.ts` distinguishes the semifinals with `slot: "SF1" | "SF2"`, and `advanceBracket` (Story 4.3/4.6) keys **strictly off `slot`, never array order**. `createdAt` order is fragile (both rows can land in the same millisecond) and deriving SF1/SF2 from "which semifinal contains the current seed-1 team" flips if a group result is edited during `PLAYOFF` (FR-16). Persist the identity explicitly — it is structural (like `stage`), not a derived standing, so no AD-4 conflict:
  - New enum `enum MatchSlot { SF1 SF2 THIRD_PLACE FINAL }` — the exact four `BracketSlot` values (`bracket.ts`), so `src/data` maps `Match.slot` ↔ `BracketSlot` with **identical spelling**, the same convention as `MatchStage` ↔ `BracketStage`.
  - `Match.slot MatchSlot?` — `null` for `GROUP` matches; `"SF1"` / `"SF2"` for the two semifinals this story creates; Story 4.3 sets `"FINAL"` / `"THIRD_PLACE"` on the rows it creates.
  - Raw-SQL CHECK (Story 2.4 / 3.2 convention — Prisma 7 doesn't model CHECK, `migrate diff` ignores it): `match_slot_stage_check` = `("stage" = 'GROUP') = ("slot" IS NULL)` (every non-`GROUP` match has a slot; every `GROUP` match has none). Optionally also `"slot" IS NULL OR "slot"::text = 'SF1' OR ... = 'SF2' OR "slot"::text = "stage"::text` to pin the SF↔SEMIFINAL / FINAL↔FINAL correspondence — keep the CHECK minimal, the biconditional is the load-bearing one.
  - **Migration authored by hand** (the AGENTS.md fallback — `prisma migrate dev` is non-interactive-blocked in this tool). `CREATE TYPE "MatchSlot"` + `ALTER TABLE "match" ADD COLUMN "slot"` in one migration (a `CREATE TYPE` + column use in the same migration is fine — the "own migration" rule is only for `ALTER TYPE … ADD VALUE`). Pre-flight `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, write `migration.sql` verbatim under `prisma/migrations/<YYYYMMDDHHMMSS>_match_playoff_slot/`, `prisma migrate deploy`, verify with `migrate status` + `migrate diff --exit-code`. Adding a nullable column produces no destructive warning.

- **New data-layer write: `savePlayoffFormation(tournamentId, semifinals)` in `src/data/playoff.ts` (NEW).** Mirrors `saveDraw`. Signature: `savePlayoffFormation(tournamentId: string, semifinals: PlayoffSemifinalRow[]): Promise<void>` where `PlayoffSemifinalRow = { slot: MatchSlot; homeEntryId: string; awayEntryId: string }` (local type, like `DrawPairing`). Body — one `db.$transaction`:
  1. `if (!(await allGroupMatchesPlayed(tournamentId, tx))) throw new Error("savePlayoffFormation: a group match lost its result after the precondition check — aborting");` (TOCTOU re-check, `saveRedraw` precedent).
  2. `await tx.match.createMany({ data: semifinals.map((sf) => ({ tournamentId, stage: "SEMIFINAL", groupId: null, slot: sf.slot, homeEntryId: sf.homeEntryId, awayEntryId: sf.awayEntryId })) });` — `groupId: null` is required by the existing `match_group_stage_check` CHECK (`stage != 'GROUP' ⇒ groupId IS NULL`). Both entry ids are always set (they're seeds 1–4).
  3. `await setTournamentState(tournamentId, "PLAYOFF", tx);`
  - No `GroupSlot` touch, no final/third-place rows (Story 4.3), no validation (the action's `checkTransition` already did it).

- **The Server Action `formPlayoff(tournamentId): Promise<ActionResult<{ needsManualSeed: boolean }>>` (`src/actions/playoff.ts`, NEW).** Flow, mirroring `drawTournament`:
  1. `await requireAdmin();`
  2. `const tournament = await getTournamentForAdmin(tournamentId);` — `!tournament` → `{ ok: false, code: "NOT_FOUND", message: "Турнір не знайдено." }`; `!tournament.group` → `{ ok: false, code: "NOT_FOUND", message: "Групу турніру не знайдено." }`.
  3. `const allPlayed = await allGroupMatchesPlayed(tournamentId);`
  4. `const check = checkTransition(tournament.state, "PLAYOFF", { allGroupMatchesPlayed: allPlayed });` — `!check.ok` → `{ ok: false, code: check.code, message: check.message }`. This one call enforces **both** AC 2's "state must be `GROUP_STAGE`" (the edge) **and** AC 1/3's "all group matches played" (the precondition), with the ready Ukrainian message.
  5. `const standings = await getStandings(tournamentId);` — `if (standings.length < PLAYOFF_QUALIFIERS) return { ok: false, code: "PRECONDITION_FAILED", message: "У групі менше ніж 4 команди — плейоф неможливий." };` (defensive: `teamCount >= 4` and a drawn group guarantee ≥ 4, but `seedPlayoff` throws a `RangeError` under 4 and `toActionError` re-throws non-admin errors → an unhandled 500. Guard before calling.)
  6. `const bracket = seedPlayoff(standings);` (`StandingsView[]` is structurally assignable to `OrderedStandingsRow[]` — pass as-is).
  7. `const semifinals = bracket.semifinals.map((sf) => ({ slot: sf.slot as MatchSlot, homeEntryId: sf.home!.entryId, awayEntryId: sf.away!.entryId }));` — `home`/`away` are never null on a freshly seeded semifinal.
  8. `await savePlayoffFormation(tournamentId, semifinals);`
  9. `revalidatePath` — mirror `drawTournament`: `const publicRoot = tournament.discipline === "BEACH" ? "/beach" : "/classic";` then `revalidatePath(publicRoot)`, `revalidatePath(`${publicRoot}/${tournamentId}`)` (the «Плейоф» tab appears), `revalidatePath(`/admin/tournaments/${tournamentId}`)`, `revalidatePath("/admin/tournaments")` (the list shows «Плейоф» now).
  10. `return { ok: true, data: { needsManualSeed: bracket.needsManualSeed } };`
  11. `catch (error) { return toActionError(error); }`

- **`needsManualSeed` — surfaced at formation, persistence deferred.** `bracket.needsManualSeed` is `true` when the top-4 order relied on the team-name fallback (`deferred-work.md`: "surfacing it … is Story 4.2"). The UX specifies no dialog and no warning copy, so **do not block and do not add a `ConfirmDialog`**. Return the flag in `ActionResult.data`; the button, on success, shows `notify.success("Плейоф сформовано")` and — only when `needsManualSeed` — an additional `notify.warning`-style toast: **«Посів 4-го та 5-го місця визначено за назвою команди — перевірте таблицю групи.»** (`notify` from `src/lib/notify.ts`; check whether it exposes `warning` — if not, a second `notify.success`/`notify` call with that text, or `notify.error` is wrong here; use whatever neutral level `notify` offers, else `notify.success`). The render-path persistence of the flag (for Story 4.6's public bracket) stays deferred — re-running `seedPlayoff` against fresh standings on render, or a `Group.needsManualSeed` column, is Story 4.6's call.

- **Multi-group (AC 4) is already structurally impossible in v1.** `Group.tournamentId` is `@unique` (`schema.prisma`) — a tournament has exactly one `Group`. `getTournamentForAdmin` includes `group: { id }` (singular, nullable). There is no code path that produces a second group. So "the button is unavailable for multi-group tournaments" is satisfied by the schema; **no multi-group branch is needed**. Note this in the story's Dev Notes and add a one-line comment in `formPlayoff` / the button ("v1: exactly one Group per tournament — multi-group seeding is PRD Open Question #1"). Do not build a `groupCount > 1` check against a shape that can't occur.

- **`FormPlayoffButton` (`src/components/tournament-actions.tsx`, UPDATE) — the `DrawTournamentButton` shape, no `ConfirmDialog`.** Props `{ tournamentId: string; state: TournamentState; allGroupMatchesPlayed: boolean }`. `useTransition`; client gate `const check = checkTransition(state, "PLAYOFF", { allGroupMatchesPlayed });` (the `view → domain` edge, same as `DrawTournamentButton`'s `checkTransition` call). `form()` calls `formPlayoff(tournamentId)`; on `res.ok` → `notify.success("Плейоф сформовано")` + the conditional `needsManualSeed` toast + `router.refresh()`; on `!res.ok` → `notify.error(res.message)`; `catch` → `notify.error("Не вдалося сформувати плейоф. Спробуйте ще раз.")`. Render: `<div className="grid gap-2">` → `<Button type="button" onClick={form} disabled={!check.ok || pending} aria-busy={pending}>` with the spinner and label **«Сформувати плейоф»**, then `{!check.ok ? <p className="text-xs text-muted-foreground">{check.message}</p> : null}`. The disabled caption comes from `checkTransition`'s message ("Плейоф недоступний: не всі групові матчі зіграно." for the precondition; the edge message if `state` is wrong) — close enough to the UX's «доступно коли всі матчі груп зіграно» that no separate copy is needed; if the reviewer wants the exact UX wording, override the caption for the `PRECONDITION_FAILED` case with «Доступно коли всі матчі груп зіграно».

- **Page wiring (`src/app/admin/tournaments/[id]/page.tsx`, UPDATE).** Add `allGroupMatchesPlayed(id)` to the existing `Promise.all` (it already fetches `hasAnyGroupResult(id)` unconditionally — same pattern). Add a new section, gated `tournament.state === "GROUP_STAGE"` (alongside the redraw section, which is also `GROUP_STAGE`):
  ```tsx
  {tournament.state === "GROUP_STAGE" ? (
    <section className="mt-10 border-t pt-6">
      <h2 className="text-lg font-semibold">Плейоф</h2>
      <div className="mt-4">
        <FormPlayoffButton
          tournamentId={tournament.id}
          state={tournament.state}
          allGroupMatchesPlayed={allGroupMatchesPlayed}
        />
      </div>
    </section>
  ) : null}
  ```
  No new route → no `.next/types` regen. The «Плейоф» tab visibility on the *public* page is already handled (`tournament-tabs.tsx` hides it until `PLAYOFF`+, Story 3.5/3.8) — nothing to change there; `revalidatePath` makes it appear.

- **`scripts/verify-generate-playoff.mts` (NEW)** — the `verify-draw.mts` shape (dotenv first, dynamic `await import`, `check(label, ok)`, self-cleaning `try/finally`). Build a 4-team `__verify_playoff__` tournament, draw it (`saveDraw`), record a `SetScore` on **every** group match (`createMatchResult` from `src/data/matches`), then:
  - assert `allGroupMatchesPlayed` is `false` after recording all but one, `true` after all;
  - assert `checkTransition(state, "PLAYOFF", { allGroupMatchesPlayed: false })` refuses (no writes);
  - run `getStandings` → `seedPlayoff` → `savePlayoffFormation` directly (bypassing `requireAdmin`, as every verify script does);
  - assert two `Match` rows `stage = "SEMIFINAL"`, `groupId = null`, `slot` `"SF1"` / `"SF2"`, with `homeEntryId`/`awayEntryId` equal to standings positions 1&4 / 2&3;
  - assert `Tournament.state === "PLAYOFF"`;
  - assert a second `savePlayoffFormation` **throws** and leaves the `SEMIFINAL` count and `state` unchanged (transaction atomicity — the `verify-draw.mts` rollback-proof pattern);
  - full teardown.

- **No worked fixtures in the planning docs** — construct the 4-team scenario (distinct results so standings order is unambiguous). The domain (`seedPlayoff`) is already exhaustively unit-tested (Story 4.1); the new coverage is the data-layer transaction + the precondition read.

## Tasks / Subtasks

- [ ] **Task 1 — `prisma/schema.prisma` + migration (NEW): `Match.slot` discriminator** (AC: 1)
  - [ ] Add `enum MatchSlot { SF1 SF2 THIRD_PLACE FINAL }` with a doc comment (the four `BracketSlot` values from `src/domain/bracket.ts`, kept identical so `src/data` maps 1:1 like `MatchStage` ↔ `BracketStage`).
  - [ ] Add `slot MatchSlot?` to `model Match` with a doc comment (`null` for `GROUP`; `SF1`/`SF2` set at playoff formation, Story 4.2; `FINAL`/`THIRD_PLACE` set by Story 4.3).
  - [ ] Pre-flight `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`; hand-write `prisma/migrations/<YYYYMMDDHHMMSS>_match_playoff_slot/migration.sql`: `CREATE TYPE "MatchSlot" AS ENUM ('SF1', 'SF2', 'THIRD_PLACE', 'FINAL');`, `ALTER TABLE "match" ADD COLUMN "slot" "MatchSlot";`, `ALTER TABLE "match" ADD CONSTRAINT "match_slot_stage_check" CHECK (("stage" = 'GROUP') = ("slot" IS NULL));`.
  - [ ] `pnpm exec prisma migrate deploy`; `pnpm exec prisma migrate status` clean; `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` prints "empty migration".
  - [ ] `pnpm exec prisma generate`; `pnpm typecheck` clean.

- [ ] **Task 2 — `src/data/matches.ts` (UPDATE): `allGroupMatchesPlayed`** (AC: 3)
  - [ ] `export async function allGroupMatchesPlayed(tournamentId, client: Prisma.TransactionClient | typeof db = db): Promise<boolean>` — `total = count({ tournamentId, stage: "GROUP" })`, `played = count({ tournamentId, stage: "GROUP", sets: { some: {} } })`, return `total > 0 && played === total`. Doc comment: the FR-19 precondition input for `checkTransition(…, "PLAYOFF", …)`; distinct from `hasAnyGroupResult` (which answers "any", not "all"); the optional tx client is for the formation transaction's TOCTOU re-check.
  - [ ] `typecheck` / `lint` clean.

- [ ] **Task 3 — `src/data/playoff.ts` (NEW): `savePlayoffFormation`** (AC: 1, 2)
  - [ ] `import { db } from "@/data/client"`, `import { allGroupMatchesPlayed } from "@/data/matches"`, `import { setTournamentState } from "@/data/tournaments"`, `import type { MatchSlot } from "@/generated/prisma/enums"`.
  - [ ] `export interface PlayoffSemifinalRow { slot: MatchSlot; homeEntryId: string; awayEntryId: string }`.
  - [ ] `export function savePlayoffFormation(tournamentId: string, semifinals: PlayoffSemifinalRow[]): Promise<void>` — one `db.$transaction`: TOCTOU re-check via `allGroupMatchesPlayed(tournamentId, tx)` → throw if false; `tx.match.createMany` two `SEMIFINAL` rows (`groupId: null`, `slot`, both entry ids); `setTournamentState(tournamentId, "PLAYOFF", tx)`. Doc comment mirrors `saveDraw`'s (one transaction so a partial failure can't leave `SEMIFINAL` rows on a `GROUP_STAGE` tournament; no validation — the caller's `checkTransition` did it).
  - [ ] `typecheck` / `lint` clean (Prisma client import is in `src/data/**` — allowed).

- [ ] **Task 4 — `src/actions/playoff.ts` (NEW): `formPlayoff`** (AC: 1, 2, 3, 4)
  - [ ] `"use server"`. Imports: `revalidatePath`; `ActionResult` / `toActionError` (`@/actions/result`); `requireAdmin` (`@/auth/requireAdmin`); `getTournamentForAdmin` (`@/data/tournaments`); `allGroupMatchesPlayed` (`@/data/matches`); `getStandings` (`@/data/matches`); `savePlayoffFormation` + `PlayoffSemifinalRow` (`@/data/playoff`); `checkTransition` (`@/domain/tournamentState`); `seedPlayoff` (`@/domain/bracket`); `PLAYOFF_QUALIFIERS` (`@/domain/tiebreak`); `type MatchSlot` (`@/generated/prisma/enums`) — wait, actions can't import the Prisma client, but a **type-only** enum import is a value in the generated `enums` module; if lint blocks it, cast `sf.slot` (a `BracketSlot` string) — `"SF1"`/`"SF2"` are valid `MatchSlot` members, so `savePlayoffFormation`'s param can take the `BracketSlot` subset directly; simplest: type `PlayoffSemifinalRow.slot` as `"SF1" | "SF2" | "THIRD_PLACE" | "FINAL"` (a string union identical to `MatchSlot`'s members) so no generated-enum import is needed in `src/actions`.
  - [ ] Implement the 11-step flow from Notes on AC interpretation. `formPlayoff(tournamentId): Promise<ActionResult<{ needsManualSeed: boolean }>>`.
  - [ ] `typecheck` / `lint` clean (no Prisma import in `src/actions`).

- [ ] **Task 5 — `src/components/tournament-actions.tsx` (UPDATE): `FormPlayoffButton`** (AC: 2, 3)
  - [ ] `export function FormPlayoffButton({ tournamentId, state, allGroupMatchesPlayed }: { tournamentId: string; state: TournamentState; allGroupMatchesPlayed: boolean })` — `useTransition`, `checkTransition(state, "PLAYOFF", { allGroupMatchesPlayed })` client gate, `formPlayoff` call, `notify.success("Плейоф сформовано")` + conditional `needsManualSeed` toast + `router.refresh()`, `notify.error` on failure, `catch` fallback. Render matches `DrawTournamentButton` (no `ConfirmDialog`). Label «Сформувати плейоф».
  - [ ] For the disabled caption: if `check.code === "PRECONDITION_FAILED"`, show «Доступно коли всі матчі груп зіграно» (the UX wording); else show `check.message`.
  - [ ] `typecheck` / `lint` clean.

- [ ] **Task 6 — `src/app/admin/tournaments/[id]/page.tsx` (UPDATE): playoff section** (AC: 2, 3)
  - [ ] Add `allGroupMatchesPlayed(id)` to the `Promise.all`; destructure as `allGroupMatchesPlayed`.
  - [ ] Add the `state === "GROUP_STAGE"` section rendering `<FormPlayoffButton>` (markup in Notes on AC interpretation). Preserve the draw / redraw / schedule / delete sections verbatim.
  - [ ] `pnpm build` (no new route, but the page changed) → `pnpm typecheck` clean.

- [ ] **Task 7 — `scripts/verify-generate-playoff.mts` (NEW)** (AC: 1, 2, 3)
  - [ ] `verify-draw.mts` shape (dotenv first, dynamic imports, `check`, self-cleaning). Assertions from Notes on AC interpretation: precondition false→true, `checkTransition` refusal, `SEMIFINAL` rows + `slot` + seeds, `state === "PLAYOFF"`, re-formation throws + atomic, teardown.
  - [ ] Run it — green (exit 0, no `FAIL` lines).
  - [ ] Re-run every prior `scripts/verify-*.mts` — no regression.

- [ ] **Task 8 — Docs**
  - [ ] `src/data/README.md` — `matches.ts` entry gains `allGroupMatchesPlayed`; new `playoff.ts` entry (`savePlayoffFormation`, the transaction, the `saveDraw` parallel).
  - [ ] `src/actions/README.md` (if present) / `src/components/README.md` — `formPlayoff` / `FormPlayoffButton` entries.
  - [ ] `AGENTS.md` — Stack-status bullet for Story 4.2 (schema: `MatchSlot` enum + `Match.slot`; migration `<name>`; `formPlayoff` / `savePlayoffFormation` / `allGroupMatchesPlayed`; the `drawTournament` parallel; `needsManualSeed` surfaced at formation). Add the `verify-generate-playoff.mts` one-liner to the verify-script catalogue (§ "Running and verifying").
  - [ ] `deferred-work.md` — mark the Story 4.1 items resolved/advanced: "Two persisted `SEMIFINAL` rows share `MatchStage.SEMIFINAL`" → **resolved** (`Match.slot` added); "`advanceBracket` must be invoked on write and render" → formation call site (`formPlayoff` → `seedPlayoff`) done, render (4.6) + auto-fill (4.3) still pending; "`needsManualSeed` not on the render path" → **formation-time surfacing done** (toast), render persistence still Story 4.6. New item if any residual.

- [ ] **Task 9 — Verification gate** (AC: all)
  - [ ] `pnpm build` → `pnpm typecheck` → `pnpm lint` → `pnpm test` (**no new domain module — count stays 161**; confirm unchanged).
  - [ ] Import-boundary check: `src/data/playoff.ts` imports Prisma only via `@/data/client` and `src/data` siblings; `src/actions/playoff.ts` imports **no** Prisma client, no `src/data` write helper other than the named function, first line `await requireAdmin()`; `src/domain` untouched.
  - [ ] `scripts/verify-generate-playoff.mts` green; all prior verify scripts green.
  - [ ] `prisma migrate status` clean; `migrate diff --exit-code` empty.
  - [ ] Real command output in the Dev Agent Record.
  - _Residual (matches every prior admin story): a manual signed-in browser pass was not performed (no seeded all-played `GROUP_STAGE` tournament in the dev DB). Mitigated by `verify-generate-playoff.mts` + the full gate. Recommended with code review: draw a 4-team tournament, enter all group results, press «Сформувати плейоф» → state flips to Плейоф, the «Плейоф» tab appears, two semifinals exist seeded 1v4 / 2v3._

- [ ] **Task 10 — Commit(s)** — one commit + `git push origin main` per completed task group (migration; data; action; component+page; verify script; docs). `build`/`typecheck`/`lint`/`test` gate each.

## Dev Notes

### What this story is / is NOT

**Is:** the admin «Сформувати плейоф» action end to end — a new `formPlayoff` Server Action (`requireAdmin` → read standings → `seedPlayoff` → one `db.$transaction` that creates the two `SEMIFINAL` `Match` rows and flips `Tournament.state` to `PLAYOFF`), a new `Match.slot` discriminator so the two semifinals are addressable as `SF1`/`SF2`, a new `allGroupMatchesPlayed` read for the FR-19 precondition, a `FormPlayoffButton` on the admin tournament page (disabled + caption until every group match is played, no confirmation dialog), and a self-cleaning verify script. The `needsManualSeed` flag is surfaced to the admin at formation via a toast.

**Is NOT** (do not pull forward):
- **The final / third-place `Match` rows.** They are auto-created after both semifinal results land — **Story 4.3** (FR-20). This story creates exactly two rows.
- **`advanceBracket` on the render path / the public «Плейоф» tab / the Bracket component.** **Story 4.6** (FR-22). `revalidatePath` here just makes the (still-placeholder) tab visible.
- **Any change to `src/domain/`.** `seedPlayoff` (Story 4.1) is called as-is; `tournamentState.ts`'s `PLAYOFF` predicate already accepts `allGroupMatchesPlayed` — it is not modified.
- **`transitionTournament`.** `formPlayoff` is a dedicated action (the `drawTournament` precedent) that reuses `checkTransition` directly.
- **Persisting `needsManualSeed` for later renders.** Formation-time surfacing (toast) is in scope; a `Group.needsManualSeed` column or a render-time `seedPlayoff` re-run is **Story 4.6**.
- **A multi-group branch.** `Group.tournamentId @unique` makes a second group impossible in v1; AC 4 is satisfied structurally. Multi-group seeding is PRD Open Question #1.
- **`→ COMPLETED` / «Завершити турнір».** **Story 4.5** (FR-7).
- **Editing / rescheduling / entering results for the semifinal matches.** Result entry reuses the Story 3.6/3.7 screens (they already scope by `(tournamentId, matchId)` not `stage: "GROUP"` — verify) — but wiring that surface for `SEMIFINAL` matches is **Story 4.4**.
- **BEACH / Cup formats.** `discipline = CLASSIC` only (AD-9).

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `prisma/schema.prisma` | UPDATE | `enum MatchSlot`; `Match.slot MatchSlot?`. |
| `prisma/migrations/<ts>_match_playoff_slot/migration.sql` | NEW | `CREATE TYPE` + `ADD COLUMN` + `match_slot_stage_check` CHECK (hand-written). |
| `src/data/matches.ts` | UPDATE | `allGroupMatchesPlayed(tournamentId, client?)`. |
| `src/data/playoff.ts` | NEW | `savePlayoffFormation` + `PlayoffSemifinalRow`. |
| `src/actions/playoff.ts` | NEW | `formPlayoff` Server Action. |
| `src/components/tournament-actions.tsx` | UPDATE | `FormPlayoffButton` (alongside `DrawTournamentButton` / `RedrawTournamentButton`). |
| `src/app/admin/tournaments/[id]/page.tsx` | UPDATE | `allGroupMatchesPlayed` in the load; `GROUP_STAGE`-gated «Плейоф» section. |
| `scripts/verify-generate-playoff.mts` | NEW | Self-cleaning DB round-trip. |
| `src/data/README.md` · `src/components/README.md` · `AGENTS.md` · `deferred-work.md` | UPDATE | Module entries, Stack status, verify-script catalogue, resolved deferred items. |
| `src/domain/**` | DO NOT TOUCH | `seedPlayoff` / `tournamentState.ts` used as-is. |
| `src/actions/tournaments.ts` | DO NOT TOUCH | `transitionTournament` is not the path here. |

### Architecture compliance

- **AD-6 / NFR-1** — `formPlayoff`'s first line is `await requireAdmin()`; the disabled button is UX only, the server check is the control. [ARCHITECTURE-SPINE.md#AD-6, PRD NFR-1]
- **AD-8 / CAP-2** — `Tournament.state` moves `GROUP_STAGE → PLAYOFF` only through this explicit action, and only after `checkTransition` confirms the edge **and** the "all group matches played" precondition. `setTournamentState` stays the sole writer. [ARCHITECTURE-SPINE.md#AD-8]
- **AD-11** — every read/write is a named `src/data` function (`getTournamentForAdmin`, `getStandings`, `allGroupMatchesPlayed`, `savePlayoffFormation`, `setTournamentState`); `src/actions/playoff.ts` imports no Prisma client. [ARCHITECTURE-SPINE.md#AD-11]
- **AD-5** — the semifinal pairings come only from `seedPlayoff` (`src/domain/bracket.ts`); the action does not compute seeds itself. `Match` rows persist (`stage`, `slot`, `homeEntryId`/`awayEntryId`, later schedule + result). [ARCHITECTURE-SPINE.md#AD-5]
- **AD-4 / AD-2** — no seed number or placement is stored; `slot` is structural identity, not a derived standing. Seeding order is `getStandings` → `orderStandings` (pure), recomputed on read. [ARCHITECTURE-SPINE.md#AD-4, #AD-2]
- **AD-3** — `view → data` (page → `getTournamentForAdmin` / `allGroupMatchesPlayed`), `actions → {domain, data}`, `data → domain` value call (`getStandings` → `computeStandings`/`orderStandings`, the established edge), `view → domain` (the button's `checkTransition`, same edge `DrawTournamentButton` uses). [ARCHITECTURE-SPINE.md#AD-3]
- **Consistency Conventions** — `ActionResult` `{ ok, code, message }` shape; `revalidatePath` after the write; a self-cleaning `verify-*.mts` for the new data-layer function, including a transaction-atomicity assertion. [ARCHITECTURE-SPINE.md#Consistency]

### Existing code being modified — current state → change → what must be preserved

**`src/data/matches.ts`** (Stories 3.2, 3.5–3.8)
- *Current:* `getStandings`, `listGroupMatchesForTournament`, `hasAnyGroupResult(tournamentId, client?)`, the result CRUD functions. No "all played" counter.
- *Change:* add `allGroupMatchesPlayed(tournamentId, client?)`.
- *Must preserve:* every existing export; the `getStandings` `sets.length > 0` filter; `hasAnyGroupResult`'s signature (the page and `saveRedraw` call it).

**`src/data/tournaments.ts`** (Stories 2.3–2.5, 3.3)
- *Current:* `setTournamentState(id, state, client?)` — sole `state` writer, takes an optional tx client; `getTournamentForAdmin` — `findUnique` including `group: { id }`, all scalar columns, no discipline filter.
- *Change:* **none** — both are used as-is.
- *Must preserve:* n/a (not edited).

**`src/components/tournament-actions.tsx`** (Stories 2.5, 3.3, 3.4)
- *Current:* `DeleteTournamentButton`, `DrawTournamentButton` (`useTransition`, no dialog, `checkTransition` gate), `RedrawTournamentButton` (`ConfirmDialog`, `checkCanRedraw` gate). Client component.
- *Change:* add `FormPlayoffButton` — the `DrawTournamentButton` twin for the `PLAYOFF` edge.
- *Must preserve:* the three existing buttons and their exact props/behaviour; the `notify` / `router.refresh()` conventions.

**`src/app/admin/tournaments/[id]/page.tsx`** (Stories 2.5, 2.7, 3.3, 3.4, 3.5)
- *Current:* `Promise.all([getTournamentForAdmin, listTeams, listEntriesForTournament, hasAnyGroupResult])`; sections — form, «Команди», «Жеребкування» (`DRAFT`), «Жеребкування»/redraw (`GROUP_STAGE`), «Розклад» link (`!DRAFT`), delete.
- *Change:* add `allGroupMatchesPlayed(id)` to the load; add a `GROUP_STAGE`-gated «Плейоф» section with `<FormPlayoffButton>`.
- *Must preserve:* every existing section and its state gate; `notFound()` on missing tournament; the `LOCKED_OUTSIDE_DRAFT` form behaviour.

**`prisma/schema.prisma`** (Stories 1.4, 2.1, 2.4, 2.6, 3.2)
- *Current:* `MatchStage { GROUP SEMIFINAL THIRD_PLACE FINAL }`; `Match` with nullable `homeEntryId`/`awayEntryId`, `stage @default(GROUP)`, `groupId?`; CHECKs `match_group_stage_check` (`stage='GROUP' ⇔ groupId NOT NULL`), `match_distinct_entries_check`, `match_group_entries_required_check`.
- *Change:* add `enum MatchSlot`; `Match.slot MatchSlot?`; CHECK `match_slot_stage_check`.
- *Must preserve:* every existing model, enum, index, `@@map`, and CHECK; migrations are append-only.

### Testing requirements

- **No new Vitest** — this story adds no `src/domain` module. `seedPlayoff` / `advanceBracket` are fully covered (Story 4.1, 161 tests). Confirm `pnpm test` stays at **161**.
- **`scripts/verify-generate-playoff.mts`** is the correctness gate for the new data layer — the `verify-draw.mts` template, including the transaction-atomicity (re-formation throws, state unchanged) assertion that the Story 3.3 review added to `verify-draw.mts`.
- **Migration verification** — `prisma migrate status` + `migrate diff --exit-code` after `migrate deploy`; `prisma generate` then `typecheck`.
- **No action-level test** for `formPlayoff` (the standing "no `requireAdmin` / session-mock harness" gap — every prior action). Mitigated by the verify script covering the data path and the domain being unit-tested.
- **Regression:** `pnpm build` (page changed) + re-run all prior `verify-*.mts`.

### Project Structure Notes

- `src/actions/playoff.ts` + `src/data/playoff.ts` is the exact `src/actions/draw.ts` + `src/data/draw.ts` pairing (one domain area, action file + data file). The spine's Capability→Architecture Map names `src/actions/playoff`.
- `Match.slot` ↔ `BracketSlot` mirrors the existing `Match.stage` (`MatchStage`) ↔ `BracketStage` convention (a Prisma enum kept spelling-identical to a `src/domain` string union).
- No new route → no `.next/types` regen; `pnpm build` is still run because `page.tsx` changed.

### Previous story intelligence

- **Story 3.3 «Жеребкування» (done, code-reviewed)** is the template. Its review found: (1) `entryIds` reached the generator in a deterministic order — n/a here (`seedPlayoff` takes an already-ordered table); (2) the draw section rendered in every state — **gate the «Плейоф» section on `state === "GROUP_STAGE"`**; (3) `drawTournament` didn't `revalidatePath("/admin/tournaments")` — **include it** (the list shows the state); (4) transaction atomicity was undocumented and untested — **`verify-generate-playoff.mts` must assert a repeat call fails and leaves no partial state**.
- **Story 3.4 «Пережеребкування» (done, code-reviewed)** — the TOCTOU fix: `hasAnyGroupResult` was checked before the transaction, so a result recorded in the gap could be lost. Here the mirror risk is a group result being *deleted* between the action's `allGroupMatchesPlayed` check and the write — **`savePlayoffFormation` re-checks `allGroupMatchesPlayed(tournamentId, tx)` inside its own transaction** and aborts if it's no longer true.
- **Story 4.1 «Чистий двигун» (done, code-reviewed)** — `seedPlayoff(standings: OrderedStandingsRow[]): PlayoffBracket`; `bracket.semifinals` is `[BracketPair, BracketPair]` with `slot` `"SF1"`/`"SF2"`, `home`/`away` non-null after seeding, `status: "READY"`; `bracket.needsManualSeed` is the OR over the top-4's name-fallback flags; `< PLAYOFF_QUALIFIERS` rows → `RangeError` (guard before calling). `bracket.ts` deliberately used a `slot` discriminator "so the data layer can map 1:1" — this story adds the DB column that makes that real.
- **Stories 3.5–3.7** — every `src/data` mutation is scoped by a key **pair** (`(tournamentId, matchId)`), never a child id alone. `savePlayoffFormation` writes by `tournamentId` only (it creates rows, doesn't target one) — fine, but the TOCTOU re-check keeps it honest.

### Git intelligence

Recent: `3304f5f` (Story 4.1 review-fix, done) ← `1ac4c8d` ← `105f49f` (Story 4.1). `epic-4` is `in-progress`; `4-1-domain-engine-bracket: done`, `4-2-generate-playoff: backlog`. `src/domain/bracket.ts` exists with `seedPlayoff` / `advanceBracket` / `playoffPlacements`. `src/actions/draw.ts` + `src/data/draw.ts` are the file-pair precedent. `prisma/schema.prisma` last migration `20260905161412_group_stage_schema_constraints`; `Match.slot` does not exist. `src/domain/tournamentState.ts`'s `PLAYOFF` predicate already takes `ctx.allGroupMatchesPlayed` (fail-closed).

### Latest tech information

- **No new library.** Prisma 7 (`prisma-client` generator, enums at `@/generated/prisma/enums`, `Prisma` at `@/generated/prisma/client`), Next 16 Server Actions, `revalidatePath`. `db.$transaction(async (tx) => …)` is the established pattern (`saveDraw`).
- **Migration** — Prisma 7 doesn't model CHECK constraints; add them as raw SQL in the migration (the Story 2.4 / 3.2 precedent). `prisma migrate dev` is non-interactive-blocked in this tool → hand-write `migration.sql` after `migrate diff --script`, then `migrate deploy`. A nullable column add gives no destructive warning.
- **`pnpm build` regenerates `.next/types`** but no new route is added, so `typecheck` is green without it; run `build` anyway because `page.tsx` changed and the full gate demands it.

### Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 4.2 AC, FR-19), `prd.md` §4.8 (FR-19 consequences) + §10 Q1 (multi-group), `ARCHITECTURE-SPINE.md` (AD-2/AD-3/AD-4/AD-5/AD-6/AD-8/AD-9/AD-11, Capability→Architecture Map, Consistency Conventions), `SPEC.md` (CAP-2, CAP-9, Constraints, Non-goals), `EXPERIENCE.md` (Admin action bar, State Patterns «Плейоф недоступний», KF-1 §6, no `ConfirmDialog` for this action), `DESIGN.md` (primary Button, Bracket pair tokens — 4.6), `3-3-draw.md` (the `drawTournament` / `saveDraw` template + its review findings), `3-4-redraw.md` (the TOCTOU fix), `4-1-domain-engine-bracket.md` (`seedPlayoff` contract, the `slot` discriminator it anticipates), `deferred-work.md` (the Story 4.1 items this story resolves/advances).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2: Сформувати плейоф] — user story + 4 AC lines; FR-19
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4] · [#Story 4.1] · [#Story 4.3] · [#Story 4.6] — engine consumed, downstream owners
- [Source: _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md#4.8] — FR-19 "Наслідки (перевірювані)"; §10 Open Question #1
- [Source: …/ARCHITECTURE-SPINE.md#AD-5] · [#AD-6] · [#AD-8] · [#AD-11] · [#AD-4] · [#AD-2] · [#AD-3] · [#AD-9] · [#Capability → Architecture Map] · [#Consistency Conventions]
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#CAP-2] · [#CAP-9] · [#Constraints] · [#Non-goals] — "перехід у Плейоф — лише коли всі групові матчі мають результат"; 4-team bracket only
- [Source: …/ux-designs/…/EXPERIENCE.md#Component Patterns — Admin action bar] · [#State Patterns] · [#Key Flows — KF-1] · [#Interaction Primitives — Підтвердження] — button placement, disabled caption, no confirmation dialog
- [Source: …/ux-designs/…/DESIGN.md#Components — Button (primary)] — single blue CTA per screen
- [Source: _bmad-output/implementation-artifacts/3-3-draw.md] — `drawTournament` / `saveDraw` structure, review findings (state gate, `revalidatePath("/admin/tournaments")`, atomicity assertion)
- [Source: _bmad-output/implementation-artifacts/3-4-redraw.md] — the TOCTOU re-check-inside-transaction pattern
- [Source: _bmad-output/implementation-artifacts/4-1-domain-engine-bracket.md] — `seedPlayoff` signature/contract, `BracketSlot`, `needsManualSeed`, the anticipated `slot` discriminator
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — "Two persisted SEMIFINAL rows share MatchStage.SEMIFINAL" (Story 4.2 resolves); "advanceBracket on write path" (formation call site); "needsManualSeed not on render path" (formation-time surfacing)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (bmad-dev-story)

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-07 | Story drafted (`bmad-create-story`, 4 research subagents: epics 4.2 / architecture+PRD+SPEC / UX / code precedent — Story 3.3 draw + 4.1 bracket). Status: ready-for-dev. |
