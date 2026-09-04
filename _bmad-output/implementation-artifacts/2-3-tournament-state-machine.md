---
baseline_commit: 777cc77
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - _bmad-output/specs/spec-cherkasy-volley/glossary.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/implementation-artifacts/2-1-tournament-team-player-schema.md
  - _bmad-output/implementation-artifacts/1-6-require-admin-access-control.md
  - _bmad-output/implementation-artifacts/1-7-admin-management.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - AGENTS.md
---

# Story 2.3: Extensible tournament state machine

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a pure tournament state-transition function,
so that Epic 3 and Epic 4 extend it rather than reinventing it (AD-8).

## Acceptance Criteria

Translated from `epics.md` → Epic 2 → Story 2.3. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** the `Tournament` entity from Story 2.1
**When** `src/domain/tournamentState.ts` is implemented with a table of allowed transitions and a precondition check
**Then**

1. The transition `DRAFT → GROUP_STAGE` is allowed; any disallowed transition returns an error.
2. The Server Action `transitionTournament` is the only way to change `state`; there is no direct assignment.
3. Preconditions of the other transitions (`→ PLAYOFF`, `→ COMPLETED`) are defined as stub predicates for the following epics.

### Notes on AC interpretation

- **This is the Epic 2 "engine-first" sibling story — the pattern, not a feature.** It introduces the state-machine *pattern* (`epics.md` cross-cutting principle: "Стейт-машина турніру розширювана. Epic 2 вводить патерн переходів (`DRAFT → GROUP_STAGE`); Epic 3 додає `→ PLAYOFF`, Epic 4 — `→ COMPLETED`. Ніхто не винаходить його заново."). It ships **three thin layers** — one pure `src/domain` module, one `src/data` writer, one `src/actions` Server Action — plus the **Vitest runner** (this is the first `src/domain` module in the codebase; AGENTS.md: "запуск через Vitest (додається з першим модулем `src/domain`)"). It wires **no UI**, no button, no page. The `DRAFT → GROUP_STAGE` transition gets its first real caller in **Story 3.3** (жеребкування); `→ PLAYOFF` in **Story 4.2**; `→ COMPLETED` in **Story 4.5**.
- **"the only way to change `state`" (AC 2) is a rule that must hold from now on.** The schema (Story 2.1) still permits `db.tournament.update({ data: { state } })`. This story makes the sanctioned path exist and be the *only* one used: the single `src/data` writer that touches `state` is `setTournamentState`, and it is called only from `transitionTournament`, which first validates via `src/domain`. No lint rule can enforce "no other `state` write" (it is a data-shape convention, tracked in `deferred-work.md` from the 2.1 review) — enforce it by **not adding any other `src/data` function that accepts a `state` argument** and by a one-line note in `src/data/README.md` + `src/actions/README.md` (the latter already says "Never assign `state` directly").
- **The domain function is pure (AD-2).** `src/domain/tournamentState.ts` imports nothing internal, no `next`, no Prisma, no `react`. It defines its **own** `TournamentState` string-union type (identical to the schema enum — `"DRAFT" | "GROUP_STAGE" | "PLAYOFF" | "COMPLETED"`) — it must **not** import `@/generated/prisma` (lint error under `src/domain/**`). The `src/data` layer keeps using the generated enum type; the action bridges the two (structurally identical unions, mutually assignable).
- **Transition table** — forward-only, exactly the lifecycle chain from the glossary ("Стан турніру — етап життєвого циклу: *Чернетка* → *Груповий етап* → *Плейоф* → *Завершений*") and AD-8:
  ```
  DRAFT       → [GROUP_STAGE]
  GROUP_STAGE → [PLAYOFF]
  PLAYOFF     → [COMPLETED]
  COMPLETED   → []            (terminal)
  ```
  No backward edges, no skips, no self-transitions. Anything not in this table → `INVALID_TRANSITION`. All four target states are in the table now (Epic 3/4 *fill in the preconditions*, they do not *add edges* — the edges already exist here).
- **Preconditions** — a predicate per target state, keyed in a `PRECONDITIONS` map, each `(ctx: TransitionContext) => TransitionCheck`:
  - **`GROUP_STAGE`** (real, data available from Story 2.1): the number of `TournamentEntry` rows equals `Tournament.teamCount` (FR-11: "недоступне, поки кількість Заявок не дорівнює заданій кількості команд"; SPEC CAP-5). The predicate reads `ctx.entryCount` / `ctx.teamCount`; if either is `undefined` it **fails closed** (`PRECONDITION_FAILED`). Note in a `//` comment that Story 3.3's draw action is the real caller and *also* generates the calendar — `transitionTournament(id, "GROUP_STAGE")` on its own only flips the state.
  - **`PLAYOFF`** (stub predicate for Epic 3/4): checks `ctx.allGroupMatchesPlayed === true` — every group `Match` has a `SetScore` (FR-19, AD-8, SPEC CAP-9). `Match` / `SetScore` do not exist yet (Epic 3, Story 3.2), so nothing can supply this input; the predicate **fails closed** when it is `undefined`. `// TODO(Epic 4 / Story 4.2): wire ctx.allGroupMatchesPlayed from the group Match+SetScore set`.
  - **`COMPLETED`** (stub predicate for Epic 4): checks `ctx.finalAndThirdPlacePlayed === true` — the final and the 3rd-place match both have results (FR-7, AD-8, SPEC CAP-2). Fails closed when `undefined`. `// TODO(Epic 4 / Story 4.5): wire ctx.finalAndThirdPlacePlayed from the playoff Match set`.
  - **`DRAFT`** has no inbound edge (nothing transitions *to* `DRAFT`), so no predicate is needed — but include a no-op / unreachable entry or simply omit `DRAFT` from `PRECONDITIONS` and treat a missing predicate as "no extra precondition beyond the edge" **only for targets with no known precondition**. Cleaner: give every non-`DRAFT` target an explicit predicate; `DRAFT` is never a target so it is not in the map.
- **`TransitionContext`** — a single interface with all-optional fields, each documented with which epic fills it:
  ```ts
  export interface TransitionContext {
    entryCount?: number;              // DRAFT → GROUP_STAGE  (Story 2.1 entities; Story 3.3 supplies)
    teamCount?: number;               // DRAFT → GROUP_STAGE
    allGroupMatchesPlayed?: boolean;  // GROUP_STAGE → PLAYOFF (Epic 3/4 supplies)
    finalAndThirdPlacePlayed?: boolean;// PLAYOFF → COMPLETED  (Epic 4 supplies)
  }
  ```
  This keeps the pure function's signature stable across epics — Epic 3/4 add a field and wire a predicate, they never change the call shape.
- **Return shape** — mirror the project's Server Action result convention (ARCHITECTURE-SPINE.md Consistency Conventions), but as a plain value (the domain has no `ActionResult` import):
  ```ts
  export type TransitionErrorCode = "INVALID_TRANSITION" | "PRECONDITION_FAILED";
  export type TransitionCheck =
    | { ok: true }
    | { ok: false; code: TransitionErrorCode; message: string };
  ```
  `message` is a Ukrainian, user-facing sentence (UA-only, no i18n — SPEC Constraints). E.g. `"Неможливий перехід зі стану «Чернетка» до «Плейоф»."`, `"Жеребкування недоступне: заявлено 7 команд із 10."` (EXPERIENCE.md §Voice gives this exact phrasing for the entry-count case — reuse it, parameterised).
- **The Server Action `transitionTournament(tournamentId, targetState)`** — `src/actions/tournaments.ts` (NEW). Shape per `src/actions/README.md`:
  1. `await requireAdmin()` — first line, always (AD-6).
  2. read the tournament via a **new `src/data` admin read** (`getTournamentForAdmin(id)` — includes drafts; called only under `requireAdmin()`, AD-7).
  3. not found → `{ ok: false, code: "NOT_FOUND", message: "Турнір не знайдено." }`.
  4. build `TransitionContext`: for `targetState === "GROUP_STAGE"` set `entryCount = await countTournamentEntries(id)` and `teamCount = tournament.teamCount`. For `PLAYOFF` / `COMPLETED` leave the context empty (the stub predicate fails closed — a non-admin-facing "not yet available" outcome; there is no caller yet).
  5. `const check = checkTransition(tournament.state, targetState, ctx)`.
  6. `!check.ok` → return `{ ok: false, code: check.code, message: check.message }` (the domain codes are added to `ActionErrorCode` — see below — so they pass straight through).
  7. `await setTournamentState(id, targetState)` (the sole `state` writer).
  8. `revalidatePath("/classic")` and `revalidatePath(\`/admin/tournaments/${tournamentId}\`)` — both are future routes (2.4 / 2.9 / 3.3); `revalidatePath` on a not-yet-existing path is a harmless no-op. A `//` comment says the concrete paths are finalised by the route-owning stories.
  9. success → `{ ok: true, data: { state: targetState } }`.
  10. wrap in `try/catch` → `return toActionError(error)` (maps `AdminRequiredError` → `FORBIDDEN`, re-throws `NEXT_REDIRECT` etc.) — the exact pattern of `src/actions/admin-roles.ts`.
- **`ActionErrorCode` extension** — `src/actions/result.ts` currently: `"FORBIDDEN" | "LAST_ADMIN" | "NOT_FOUND"`. Add `"INVALID_TRANSITION" | "PRECONDITION_FAILED"`. `toActionError` is unchanged (it only maps `AdminRequiredError`; the transition codes are returned explicitly by the action, not thrown).
- **`src/data` additions** — `src/data/tournaments.ts` (NEW), three functions:
  - `getTournamentForAdmin(id: string)` — `db.tournament.findUnique({ where: { id } })`. The **admin** read (drafts included). Story 2.9 adds `getPublicTournament` (filters `state != DRAFT` **and** `discipline = CLASSIC`) — do not build that here.
  - `countTournamentEntries(tournamentId: string)` — `db.tournamentEntry.count({ where: { tournamentId } })`. Used by the `GROUP_STAGE` precondition. (Story 2.7 will own the *enroll* side; this is just a count.)
  - `setTournamentState(id: string, state: TournamentState)` — `db.tournament.update({ where: { id }, data: { state } })`. **The only writer of `Tournament.state`.** A top-of-function `//` comment: callers MUST validate the transition via `src/domain/tournamentState` first (AD-8); this function does no checking.
  `TournamentState` here = `import type { TournamentState } from "@/generated/prisma/enums"` (allowed under `src/data/**`).
- **Vitest — the runner lands here.** `pnpm add -D vitest` (and `vite` if pnpm emits a peer warning — Vitest 4 pulls it transitively). `vitest.config.ts` at repo root: `test.environment: "node"` (the domain is pure — no DOM), `test.include: ["src/**/*.test.ts"]`. `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`. First spec: `src/domain/tournamentState.test.ts` (co-located, Vitest default). Import `{ describe, it, expect } from "vitest"` explicitly — **no globals** (keeps `tsconfig` untouched; a global-types entry would be a wider change). See Testing Requirements for the coverage matrix.
  - **Version:** Vitest **5.0.0** shipped 2026-09-04 (hours before this story) — too fresh. Pin to the current **Vitest 4.x** line (4.1+, stable since 2026-03). `pnpm add -D vitest@^4`; commit the exact resolved version (the project pins versions — see `@prisma/adapter-pg` `7.10.0`). Re-evaluate 5.x in a later story once it has soak time.
  - **`next build` type-checks the whole `tsconfig`** (`next.config.ts` sets no `typescript.ignoreBuildErrors`). So `vitest.config.ts` and `*.test.ts` must `tsc`-pass. They will (types come from the `vitest` package). If `next build` unexpectedly chokes on the config/test files, the minimal fix is a `tsconfig` `exclude` for `vitest.config.ts` or an `*.test.ts` `exclude` — **do not** disable build type-checking. Flag it in the Dev Agent Record if hit.
- **Scope guard. In scope:** `src/domain/tournamentState.ts` + its Vitest spec, the Vitest runner (`vitest` devDep + `vitest.config.ts` + `package.json` `test` scripts), `src/data/tournaments.ts` (3 functions), `src/actions/tournaments.ts` (`transitionTournament`), the `ActionErrorCode` extension in `src/actions/result.ts`, doc updates (`src/domain/README.md`, `src/data/README.md`, `src/actions/README.md`, `AGENTS.md`). **Not in scope:** any UI / button / page / component (incl. the Status badge — Story 2.9 / UX-DR7, and the admin action bar — EXPERIENCE.md, Stories 3.3 / 4.2 / 4.5); `createTournament` and `/admin/tournaments/new` (Story 2.4); the `Group` row (Epic 3 / Story 2.4 resolves the "one Group" wording); `Match` / `SetScore` / any real `allGroupMatchesPlayed` / `finalAndThirdPlacePlayed` computation (Epic 3/4); the calendar generation that Story 3.3's draw does alongside the `DRAFT → GROUP_STAGE` flip; `src/domain/{scoring,tiebreak,schedule,validation}.ts` (Epic 3, Story 3.1); any migration (Story 2.1's schema is sufficient — `state` field + enum already exist); component/integration tests for the action/data layer (no session-mock infra — deferred, already tracked); a lint rule forbidding other `state` writes (not feasible — convention + review).

## Tasks / Subtasks

- [x] **Task 1 — Vitest runner** (AC: 1, 3 — the domain function needs a test harness; AGENTS.md mandate)
  - [x] `pnpm add -D vitest@^4` (PowerShell tool — Bash has no `pnpm` on PATH; AGENTS.md "Known pitfalls"). If pnpm prints a `vite` peer warning, `pnpm add -D vite` too. Commit the exact resolved versions into `package.json` (no `^` drift beyond what pnpm writes — the project pins).
  - [x] `vitest.config.ts` (NEW, repo root):
    ```ts
    import { defineConfig } from "vitest/config";

    export default defineConfig({
      test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
      },
    });
    ```
  - [x] `package.json` scripts — add `"test": "vitest run"` and `"test:watch": "vitest"`. Keep every existing script. Do **not** wire `test` into `build` (Vercel `build` stays `prisma generate && node scripts/migrate-deploy.mjs && next build`; there is no CI — a `test` step in `build` would run on every deploy with no runner budget story; tracked separately in `deferred-work.md` "No CI gate").
  - [x] `/coverage` is already in `.gitignore` (from `create-next-app`) — no `.gitignore` change needed. Confirm.
  - [x] Smoke: `pnpm test` runs (even before Task 2 writes specs it should exit 0 with "no test files" or run the Task 2 spec if done first — either order is fine).
- [x] **Task 2 — `src/domain/tournamentState.ts` (NEW)** (AC: 1, 3)
  - [x] `"use client"` / `"use server"` — **neither** (pure module). No imports from `next`, `@/generated/prisma`, `@prisma/client`, `react`, or any other `src/` layer (lint-enforced by the `src/domain/**` block).
  - [x] `export type TournamentState = "DRAFT" | "GROUP_STAGE" | "PLAYOFF" | "COMPLETED";` — its own union, **not** re-exported from Prisma. A `//` comment: "must stay identical to the `TournamentState` enum in `prisma/schema.prisma`".
  - [x] `export const TRANSITIONS: Record<TournamentState, readonly TournamentState[]> = { DRAFT: ["GROUP_STAGE"], GROUP_STAGE: ["PLAYOFF"], PLAYOFF: ["COMPLETED"], COMPLETED: [] };` — forward-only lifecycle (AD-8, glossary).
  - [x] `export type TransitionErrorCode = "INVALID_TRANSITION" | "PRECONDITION_FAILED";`
  - [x] `export type TransitionCheck = { ok: true } | { ok: false; code: TransitionErrorCode; message: string };`
  - [x] `export interface TransitionContext { entryCount?: number; teamCount?: number; allGroupMatchesPlayed?: boolean; finalAndThirdPlacePlayed?: boolean; }` — all optional; `//` comment per field naming the epic that supplies it.
  - [x] `PRECONDITIONS` — a `Partial<Record<TournamentState, (ctx: TransitionContext) => TransitionCheck>>` (or a full record with a `DRAFT` entry that is never reached). One predicate per inbound-edge target:
    - `GROUP_STAGE`: if `ctx.entryCount === undefined || ctx.teamCount === undefined` → `{ ok: false, code: "PRECONDITION_FAILED", message: "Стан заявок турніру невідомий." }`; if `ctx.entryCount !== ctx.teamCount` → `{ ok: false, code: "PRECONDITION_FAILED", message: \`Жеребкування недоступне: заявлено ${ctx.entryCount} команд із ${ctx.teamCount}.\` }` (EXPERIENCE.md §Voice phrasing); else `{ ok: true }`.
    - `PLAYOFF`: `ctx.allGroupMatchesPlayed === true ? { ok: true } : { ok: false, code: "PRECONDITION_FAILED", message: "Плейоф недоступний: не всі групові матчі зіграно." }`. `// TODO(Epic 4 / Story 4.2)`.
    - `COMPLETED`: `ctx.finalAndThirdPlacePlayed === true ? { ok: true } : { ok: false, code: "PRECONDITION_FAILED", message: "Завершити турнір можна лише коли зіграно фінал і матч за 3-тє місце." }`. `// TODO(Epic 4 / Story 4.5)`.
  - [x] `export function canTransition(from: TournamentState, to: TournamentState): boolean { return (TRANSITIONS[from] ?? []).includes(to); }` — the **edge-only** check (no preconditions, no ctx). The view layer uses it to decide *which* action button to render (Story 2.9 Status badge context, Story 3.3 / 4.2 / 4.5 admin action bar) without needing precondition inputs. `checkTransition` is the authoritative gate the action calls.
  - [x] `export function checkTransition(from: TournamentState, to: TournamentState, ctx: TransitionContext = {}): TransitionCheck` —
    1. `const allowed = TRANSITIONS[from] ?? []` — if `from` is not a known state (defensive, though the type forbids it) treat as no edges.
    2. `if (!allowed.includes(to)) return { ok: false, code: "INVALID_TRANSITION", message: \`Неможливий перехід зі стану «${LABELS[from]}» до «${LABELS[to]}».\` }` (a small `LABELS: Record<TournamentState, string>` map — `DRAFT: "Чернетка"`, `GROUP_STAGE: "Груповий етап"`, `PLAYOFF: "Плейоф"`, `COMPLETED: "Завершений"` — from the glossary).
    3. `const precondition = PRECONDITIONS[to]; if (precondition) { const result = precondition(ctx); if (!result.ok) return result; }`
    4. `return { ok: true }`.
  - [x] Also export `LABELS` (the view layer will want the same Ukrainian state names — Story 2.9's Status badge — and there is no other home for them yet; a `//` comment notes 2.9 may relocate them).
  - [x] Top-of-file doc comment: the module is the single source of truth for the tournament lifecycle; Epic 3 wires the `PLAYOFF` precondition input, Epic 4 the `COMPLETED` one; nothing else computes or asserts a transition.
- [x] **Task 3 — `src/domain/tournamentState.test.ts` (NEW)** (AC: 1, 3)
  - [x] `import { describe, it, expect } from "vitest";` + `import { canTransition, checkTransition, TRANSITIONS } from "./tournamentState";`
  - [x] Cover the matrix in Testing Requirements — legal edges (with satisfied preconditions) return `{ ok: true }`; every illegal edge (backward, skip, self, from-terminal) returns `code: "INVALID_TRANSITION"`; `DRAFT → GROUP_STAGE` with `entryCount !== teamCount` and with missing counts returns `code: "PRECONDITION_FAILED"`; the `PLAYOFF` / `COMPLETED` stubs fail closed on `undefined`, pass on `true`, fail on `false`.
  - [x] A structural test asserting `TRANSITIONS` is exactly the forward-only chain (no backward/skip edges, `COMPLETED` terminal) — this locks AD-8 so a future edit that adds a stray edge fails the suite.
  - [x] `pnpm test` → all green.
- [x] **Task 4 — `src/data/tournaments.ts` (NEW)** (AC: 2)
  - [x] `import { db } from "@/data/client";` + `import type { TournamentState } from "@/generated/prisma/enums";`
  - [x] `export function getTournamentForAdmin(id: string) { return db.tournament.findUnique({ where: { id } }); }` — admin read (drafts included); doc comment: called only under `requireAdmin()` (AD-7); the public read (`state != DRAFT` + `discipline = CLASSIC`) is a separate function Story 2.9 adds.
  - [x] `export function countTournamentEntries(tournamentId: string) { return db.tournamentEntry.count({ where: { tournamentId } }); }`
  - [x] `export function setTournamentState(id: string, state: TournamentState) { return db.tournament.update({ where: { id }, data: { state } }); }` — doc comment: **the only writer of `Tournament.state`**; callers must have validated via `src/domain/tournamentState` (AD-8); no checking here. Do not add any other function that writes `state`.
  - [x] Lint check: `src/data/**` may not import `next` / `react` / `actions` / `auth` / view — this file imports only `@/data/client` and a generated type. Clean.
- [x] **Task 5 — `src/actions/result.ts` (UPDATE)** (AC: 2)
  - [x] `ActionErrorCode` → `"FORBIDDEN" | "LAST_ADMIN" | "NOT_FOUND" | "INVALID_TRANSITION" | "PRECONDITION_FAILED"`. Nothing else changes — `toActionError` still only maps `AdminRequiredError` and re-throws the rest.
- [x] **Task 6 — `src/actions/tournaments.ts` (NEW)** (AC: 2)
  - [x] `"use server";` at the top.
  - [x] `import { revalidatePath } from "next/cache";` · `import { toActionError, type ActionResult } from "@/actions/result";` · `import { requireAdmin } from "@/auth/requireAdmin";` · `import { checkTransition, type TournamentState, type TransitionContext } from "@/domain/tournamentState";` · `import { countTournamentEntries, getTournamentForAdmin, setTournamentState } from "@/data/tournaments";`
  - [x] `export async function transitionTournament(tournamentId: string, targetState: TournamentState): Promise<ActionResult<{ state: TournamentState }>>` — body exactly as the AC-notes step list (requireAdmin → read → not-found → build ctx (only for `GROUP_STAGE`) → `checkTransition` → map failure straight through (`code: check.code`) → `setTournamentState` → `revalidatePath` ×2 → `{ ok: true, data: { state: targetState } }`), all inside `try { … } catch (error) { return toActionError(error); }`.
  - [x] `//` comment on the `revalidatePath` lines: routes `/classic/[tournament]` and `/admin/tournaments/[id]` are created by Stories 2.9 / 2.4 / 3.3; the calls are no-ops until then.
  - [x] `//` comment at the top of the function: this is the ONLY sanctioned path to change `Tournament.state` (AD-8); Story 3.3 (draw) calls it for `DRAFT → GROUP_STAGE` alongside calendar generation; Stories 4.2 / 4.5 for the later transitions.
  - [x] Lint: `src/actions/**` may not import the Prisma client directly (it goes through `@/data`) — this file does. The `view → shell → {domain, data}` direction is satisfied.
- [x] **Task 7 — Docs**
  - [x] `src/domain/README.md` (UPDATE) — under the module list (currently prose only), add: `tournamentState.ts` — the tournament lifecycle: `TRANSITIONS` table (`DRAFT → GROUP_STAGE → PLAYOFF → COMPLETED`, forward-only), `canTransition(from, to)` (edge-only, for the view), `checkTransition(from, to, ctx)` (edge + preconditions, the gate the action calls), `TransitionContext` (preconditions supplied by the epic that owns the data — `GROUP_STAGE` real now, `PLAYOFF` / `COMPLETED` stub predicates). First `src/domain` module; Vitest runner added with it.
  - [x] `src/data/README.md` (UPDATE) — under `## Modules`, add `tournaments.ts` — `getTournamentForAdmin(id)` (admin read, drafts included), `countTournamentEntries(tournamentId)`, and `setTournamentState(id, state)` **the sole writer of `Tournament.state`**, called only from `transitionTournament` after `src/domain/tournamentState` validation (AD-8). Keep the existing "`Tournament.state` is written only by `transitionTournament`" line — it is now true.
  - [x] `src/actions/README.md` (UPDATE) — under the module list, add `tournaments.ts` — `transitionTournament(id, targetState)`: `requireAdmin()` → `getTournamentForAdmin` → `checkTransition` (`src/domain`) → `setTournamentState`. The only `state` mutation path (AD-8). The "`Tournament.state` is changed only by explicit transition actions … Never assign `state` directly" line already there — no edit needed, just the module entry.
  - [x] `AGENTS.md` (UPDATE) — two edits:
    - "Running and verifying" — replace the line `- TODO: юніт-тести доменних функцій `src/domain/*` — обовʼязкові; запуск через Vitest (додається з першим модулем `src/domain`).` with: `- `pnpm test` (`vitest run`) — юніт-тести доменних функцій `src/domain/*` (Vitest, `environment: node`, `src/**/*.test.ts`); `pnpm test:watch` для розробки. Не входить у `build` (нема CI).`
    - "Stack status" — one line: Story 2.3 — `src/domain/tournamentState.ts` (стейт-машина турніру: `TRANSITIONS` + `checkTransition`; `DRAFT → GROUP_STAGE` реальна передумова, `→ PLAYOFF` / `→ COMPLETED` — заглушки для Epic 3/4); Server Action `transitionTournament` (`src/actions/tournaments.ts`) — єдиний шлях зміни `state`; `src/data/tournaments.ts` (`setTournamentState` — єдиний письменник `state`). Vitest додано.
  - [x] No `ARCHITECTURE-SPINE.md` / `EXPERIENCE.md` / `epics.md` / `SPEC.md` edit — AD-8 and the glossary lifecycle already specify everything this story realises.
- [x] **Task 8 — Verification gate** (AC: all)
  - [x] `pnpm test` — the `tournamentState` spec passes (capture the Vitest summary — file count, test count, all green).
  - [x] `pnpm typecheck` (`tsc --noEmit`) exit 0 — includes `vitest.config.ts`, `*.test.ts`, the new domain/data/action modules.
  - [x] `pnpm lint` exit 0 — especially the `src/domain/**` block on `tournamentState.ts` + its spec (no forbidden imports), and `src/data/**` / `src/actions/**` blocks on the new modules. `pnpm lint --print-config src/domain/tournamentState.ts` shows the `no-restricted-imports` domain rule active.
  - [x] `pnpm build` clean on Node 24 (`prisma generate && node scripts/migrate-deploy.mjs && next build`; `migrate deploy` → "No pending migrations" — no migration in this story). **Route table unchanged** from Story 2.2: `/_not-found` `○`, `/admin` `ƒ`, `/admin/people` `ƒ`, `/api/auth/[...all]` `ƒ`, `/archive` `○`, `/beach` `○`, `/classic` `○` (redirect from `/`), `/sign-in` `○`. No new route (`transitionTournament` is an action, not a page).
  - [x] Import-boundary greps:
    - `grep -rn "@prisma/client\|generated/prisma" src/domain/` → **nothing** (the domain stays Prisma-free).
    - `grep -rn "@prisma/client\|generated/prisma" src/` → only `src/data/**` and `src/generated/**` (unchanged from Story 2.1 + the new `src/data/tournaments.ts` type-only import).
    - `grep -rn "next/\|\"next\"" src/domain/` → nothing.
    - `grep -rn "data: { state\|state:" src/data/` → only `setTournamentState` in `tournaments.ts` writes `state` (sanity that no other writer crept in).
  - [x] **Negative probe for the domain purity (same throwaway method as Story 1.3 / 2.2):** temporarily add `import { db } from "@/data/client";` to `tournamentState.ts`, confirm `pnpm lint` errors (`src/domain must not import the database or another src/ layer`), remove it. Note in the Dev Agent Record (this verification is not durable — no committed fixture — already tracked in `deferred-work.md` under the 1.3 item).
  - [x] **No browser walkthrough** — there is no UI. The action + data layer have no automated coverage (no session mock); their correctness rests on `typecheck` + `lint` + the `src/domain` spec + code review. State this explicitly and add the action/data contract test to the deferred list (see Task 9).
  - [x] Capture every command's real output in the Dev Agent Record — verifiable, not asserted (Stories 1.1–2.2 pattern).
- [x] **Task 9 — `deferred-work.md` (UPDATE)** + **Commit**
  - [x] `deferred-work.md` — the runner has landed; update the wording of the carried items that named "the Story 2.3 runner":
    - The 2.2 review items ("`ConfirmDialog` + `admin-role-controls` component tests", "grant/revoke success + list-refresh path", "committed `no-alert` negative fixture", the 1.3 "committed eslint negative-import fixture") — the Vitest **runner** now exists; the **component/DOM** tests still need `@testing-library` + `jsdom` + a session/`next` mock (not added here — pure-`node` config only). Re-note them as "runner exists (Story 2.3); still needs the component-test toolchain + action-layer session mock".
    - Add a new item: **`transitionTournament` and `src/data/tournaments.ts` have no automated coverage** — the `src/domain/tournamentState` spec covers the pure logic exhaustively, but the Server Action's `requireAdmin` gate, not-found path, `GROUP_STAGE` entry-count wiring, `revalidatePath`, and the `setTournamentState` write are verified only by `typecheck` + review. Needs the action-layer session-mock infra (overlaps the 1.7 "no automated end-to-end / action-layer coverage" item) + a disposable-Neon-branch integration spec for the `src/data` round-trip (overlaps the 2.1 "from-empty replay + constraint/cascade integration tests" item).
    - The 2.1 review item "`Tournament.state` is directly assignable in the schema" — mark it **resolved by convention**: `transitionTournament` + `src/domain/tournamentState.ts` landed, `setTournamentState` is the sole writer, no `src/data` function takes a `state` arg. (Keep a trailing note that it is convention, not a lint rule.)
  - [x] Commit: `feat(domain): tournament state machine + Vitest (Story 2.3)` on `main` — code + Vitest + docs + the applied review patches + this story file, in one commit. **Not pushed** — the push (which deploys to Vercel prod) is left for the user. No migration, no runtime behaviour change (the action has no caller yet).

### Review Findings

Implementation review 2026-09-04 (`bmad-code-review`, 4 layers: Blind Hunter, Edge Case Hunter, Verification Gap, Acceptance Auditor) over `git diff 777cc77..working-tree`. Acceptance Auditor: all 3 ACs met, "Not in scope" guard respected, domain purity holds. 0 decision-needed, 5 patch, 7 defer, 8 dismissed.

#### Patch

- [x] **[Review][Patch] `revalidatePath` comment is wrong and the paths are incomplete** [src/actions/tournaments.ts:43-46] — the comment says the routes "do not exist yet; the calls are inert", but `/classic` is a live route (Story 1.8). `/classic` is also hard-coded (ignores `tournament.discipline`), and `/archive` is not revalidated on `→ COMPLETED` even though the archive lists completed tournaments. Fix: derive the section path from `tournament.discipline`; add `revalidatePath("/archive")` when `targetState === "COMPLETED"`; drop the false "inert" wording (keep a short note that `/admin/tournaments/[id]` lands with a later story).
- [x] **[Review][Patch] Vitest `include` misses `.test.mts` / `.test.tsx` and there is no `@/` alias resolution** [vitest.config.mts] — the project uses `.mts` widely and `tsconfig` maps `@/*` → `./src/*`, which Vitest does not read. A future domain test written as `.mts`, or any test importing `@/…`, is silently not collected or fails to resolve — defeating "domain functions MUST have tests". Fix: `include: ["src/**/*.{test,spec}.{ts,mts,tsx}"]` and a `resolve.alias` for `@/` → `./src` (zero new dependency).
- [x] **[Review][Patch] `checkTransition` interpolates `undefined` into the failure message for an unknown state** [src/domain/tournamentState.ts:108-110] — `to` (`= targetState`) crosses the Server Action serialization boundary; a malformed value is correctly rejected as `INVALID_TRANSITION` but the message reads `«…» до «undefined»`. Fix: `LABELS[from] ?? from` / `LABELS[to] ?? to` — falls back to the raw code, matching the function's stated defensive posture.
- [x] **[Review][Patch] Story task text mandates epic/story-ref code comments that the convention forbids** — Tasks 2 and 6 `[x]` sub-items ask for `// TODO(Epic 4 / Story 4.2)` etc.; the persistent-fact convention ("no epic/story refs in code comments") wins and the code correctly omits them. Add a Completion Note recording the adaptation so the `[x]` marks are not read as literal compliance.
- [x] **[Review][Patch] `deferred-work.md` wording overstates the safety of the untested action** — "thin adapter over the tested domain function, so the risk is low" and "a fifth Prisma enum label passes lint and test" are both too generous: the `requireAdmin` gate and the `GROUP_STAGE` context wiring (`tournament.teamCount` vs `tournament.rounds` — both `number`, type-clean) are structurally unreachable by a domain unit test, and enum drift IS caught by `tsc` at the `transitionTournament` call site (just not by an explicit assertion). Correct both notes.

#### Defer

- [x] **[Review][Defer] Action-layer coverage for `transitionTournament` / `src/data/tournaments.ts`** [src/actions/tournaments.ts] — deferred, needs the `requireAdmin` / `next/headers` session-mock infra the repo lacks (overlaps 1-7). Already recorded in `deferred-work.md`; wording tightened per the Patch above.
- [x] **[Review][Defer] No atomic transition — TOCTOU between the read and the `state` write, and between `countTournamentEntries` and the write** [src/actions/tournaments.ts:22-41] — deferred, low at 2–5-admin scale with a forward-only table; the atomic version (conditional `updateMany` / a transaction wrapping count + write) belongs with the draw action that has the real caller and already needs a transaction for calendar generation.
- [x] **[Review][Defer] Prisma errors from `setTournamentState` escape the `try/catch`** [src/actions/tournaments.ts:47-49] — deferred, pre-existing: `toActionError` re-throws every non-`AdminRequiredError` (same as `admin-roles.ts`); `P2025` (row deleted mid-transition) and connection loss break the `ActionResult` contract. The repo maps Prisma error codes per feature story (2.4/2.6/2.7 for `P2002`/`P2003`); tournament-delete is Story 2.5.
- [x] **[Review][Defer] No CI runs `pnpm test` / `lint` / `typecheck` on push** — deferred, pre-existing (tracked since 1-1). The new domain suite now also depends on this gap: a broken transition table ships if a contributor skips the local run.
- [x] **[Review][Defer] AD-8 says "окремі Server Actions" (one per transition); the implementation is one parameterised `transitionTournament`** — deferred: the Story 2.3 AC names the single action and SPEC CAP-2 is satisfied by the central gate, but the spine wording is not reconciled. A spine edit or an accepted-deviation note.
- [x] **[Review][Defer] No helper returning the available transitions with the reason each is blocked** [src/domain/tournamentState.ts] — deferred: the view gets `canTransition` (edge-only) and will show buttons that `checkTransition` rejects on click. Story 2.9 (status badge / admin action-bar context) is the natural owner.
- [x] **[Review][Defer] No audit record for a lifecycle transition** — deferred: `updatedAt` also moves on unrelated edits; `→ COMPLETED` publishes to the public archive with no `stateChangedAt` / log. Extends the 1-7 "no audit trail for role changes" item; PRD does not require it.

## Dev Notes

### What this story is / is NOT

**Is:** the extensible tournament state-machine pattern — one pure `src/domain` module (`tournamentState.ts`: `TRANSITIONS` table + `checkTransition` + `TransitionContext` + stub preconditions for `PLAYOFF` / `COMPLETED`), its exhaustive Vitest spec, the **Vitest runner itself** (first `src/domain` module in the repo), one `src/data` module (`tournaments.ts` — admin read, entry count, and `setTournamentState` as the *sole* `state` writer), one Server Action (`transitionTournament`), and the `ActionErrorCode` extension. Plus doc updates. The Epic 2 analogue of Story 2.1 (schema pattern) and 2.2 (UX pattern) — a *pattern* story, not a feature.

**Is NOT** (do not pull forward):
- **Any UI.** No button, no page, no component. The Status badge (state → pill) is **Story 2.9** / UX-DR7. The admin action bar ("Провести жеребкування", "Сформувати плейоф", "Завершити турнір") is EXPERIENCE.md, owned by Stories **3.3 / 4.2 / 4.5**.
- **`createTournament` / `/admin/tournaments/new`** → **Story 2.4** (also resolves the "one `Group`" wording from its AC).
- **The `Group` row** → Epic 3 (or Story 2.4's migration — its call). Not here.
- **`Match` / `SetScore` / `MatchStage`** and any *real* `allGroupMatchesPlayed` / `finalAndThirdPlacePlayed` computation → **Epic 3 (Story 3.2)** / **Epic 4**. This story ships only the `TransitionContext` *fields* and *stub predicates*.
- **The calendar generation** that Story 3.3's draw performs together with the `DRAFT → GROUP_STAGE` flip → **Story 3.3**. `transitionTournament(id, "GROUP_STAGE")` here only changes the state.
- **`src/domain/{scoring,tiebreak,schedule,validation}.ts`** → **Epic 3 (Story 3.1)**.
- **A component-test toolchain** (`@testing-library/react`, `jsdom`) or an **action-layer session mock** → deferred (the runner is `environment: node` only; DOM/action tests need more infra — see `deferred-work.md`).
- **A lint rule banning other `state` writes** → not feasible; convention + `src/data` discipline + review.
- **Any migration** → Story 2.1's `state` field + `TournamentState` enum are already in place.

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/domain/tournamentState.ts` | NEW | Pure. `TournamentState` union (own, not Prisma), `TRANSITIONS`, `canTransition`, `checkTransition`, `TransitionContext`, `TransitionErrorCode` / `TransitionCheck`, `PRECONDITIONS`, `LABELS`. No internal / framework / Prisma / react imports. |
| `src/domain/tournamentState.test.ts` | NEW | Vitest spec — full transition matrix + precondition branches + `TRANSITIONS` structural lock. Imports only `vitest` + `./tournamentState`. |
| `vitest.config.ts` | NEW | Repo root. `environment: "node"`, `include: ["src/**/*.test.ts"]`. |
| `package.json` | UPDATE | `+ vitest` devDep (v4.x), `+ "test"` / `"test:watch"` scripts. `build` unchanged. |
| `pnpm-lock.yaml` | UPDATE (generated) | `pnpm add -D vitest`. |
| `src/data/tournaments.ts` | NEW | `getTournamentForAdmin(id)`, `countTournamentEntries(tournamentId)`, `setTournamentState(id, state)` (sole `state` writer). Imports `@/data/client` + a generated type only. |
| `src/actions/tournaments.ts` | NEW | `"use server"`. `transitionTournament(tournamentId, targetState)` → `ActionResult<{ state }>`. `requireAdmin()` first; `checkTransition` from `src/domain`; `setTournamentState` via `src/data`; `revalidatePath` ×2; `try/catch → toActionError`. |
| `src/actions/result.ts` | UPDATE | `ActionErrorCode` + `"INVALID_TRANSITION" \| "PRECONDITION_FAILED"`. `toActionError` unchanged. |
| `src/domain/README.md` | UPDATE | `tournamentState.ts` module entry; note Vitest arrived with it. |
| `src/data/README.md` | UPDATE | `tournaments.ts` module entry; `setTournamentState` = sole `state` writer. |
| `src/actions/README.md` | UPDATE | `tournaments.ts` module entry. |
| `AGENTS.md` | UPDATE | `pnpm test` line replaces the Vitest TODO; one "Stack status" line for Story 2.3. |
| `_bmad-output/implementation-artifacts/deferred-work.md` | UPDATE | Re-note the "Story 2.3 runner" items; add the action/data-coverage item; mark the 2.1 "state directly assignable" item resolved-by-convention. |
| `.gitignore` | DO NOT TOUCH (verify) | `/coverage` already ignored. |
| `prisma/**` | DO NOT TOUCH | No migration — `state` + enum exist (Story 2.1). |
| `src/components/**` · `src/app/**` · `src/auth/**` | DO NOT TOUCH | No UI, no auth change. |
| `eslint.config.mjs` | DO NOT TOUCH | The `src/domain/**` block already covers `*.test.ts`; no new rule needed. |
| `next.config.ts` | DO NOT TOUCH | No route/redirect change. |

### Architecture compliance

- **AD-2 — domain is pure.** `src/domain/tournamentState.ts` is `(from, to, ctx) → TransitionCheck`, deterministic, no IO, no framework. It defines its own `TournamentState` union — importing `@/generated/prisma` would be a lint error (`src/domain/**` block, `prismaClientPatterns`). No component or action decides a transition itself — they call `checkTransition`. [ARCHITECTURE-SPINE.md#AD-2]
- **AD-3 — dependency direction.** `view → shell → {domain, data}`. `src/actions/tournaments.ts` imports `src/domain` + `src/data` + `src/auth` (all allowed for the shell). `src/data/tournaments.ts` imports only `@/data/client` + a generated type (no `next` / `react` / higher layers). `src/domain` imports nothing internal. [ARCHITECTURE-SPINE.md#AD-3 · src/README.md]
- **AD-6 — every mutation is a Server Action under `requireAdmin()`.** `transitionTournament`'s first line is `await requireAdmin()`; the `state` write (`setTournamentState`) is unreachable without it. The `try/catch → toActionError` maps `AdminRequiredError → { ok: false, code: "FORBIDDEN" }` — exactly `src/actions/admin-roles.ts`. [ARCHITECTURE-SPINE.md#AD-6]
- **AD-7 — public reads bypass auth and hide drafts; admin reads are separate.** `getTournamentForAdmin` is the admin read (drafts included), called only from inside `transitionTournament` (post-`requireAdmin`). The public `getPublicTournament` (`state != DRAFT` + `discipline = CLASSIC`) is **not** built here — Story 2.9. [ARCHITECTURE-SPINE.md#AD-7 · src/data/README.md]
- **AD-8 — `Tournament.state` changes only by explicit transitions with precondition checks.** This story *is* the realisation of AD-8: `TRANSITIONS` encodes the legal graph, `checkTransition` enforces edges + preconditions, `transitionTournament` is the only Server Action that writes `state`, `setTournamentState` is the only `src/data` writer, and no `src/data` function accepts a `state` argument for any other purpose. The `PLAYOFF` / `COMPLETED` precondition *inputs* are wired by Epic 3/4 — the *edges and predicate slots* exist now. [ARCHITECTURE-SPINE.md#AD-8]
- **AD-11 — `src/data` is the sole Prisma owner/writer per entity.** `Tournament` reads/writes for the state machine go through the three named `src/data/tournaments.ts` functions; the action never touches Prisma directly. [ARCHITECTURE-SPINE.md#AD-11]
- **Consistency Conventions** — Server Action named with a verb (`transitionTournament`); domain function `checkTransition` (cf. `computeStandings`, `validateMatchScore`); typed error → `{ ok: false, code, message }`, success → `{ ok: true, data }`; `revalidatePath` after the write; UA-only messages, no i18n lib; ids are `cuid` (the action takes the tournament `id` as given). [ARCHITECTURE-SPINE.md#Consistency Conventions]
- **SPEC CAP-2 / CAP-5 / CAP-9** — "Кожен перехід стану відбувається лише коли виконані передумови … прямої зміни стану в обхід переходів немає" is exactly what `checkTransition` + the single-writer discipline deliver. The `GROUP_STAGE` precondition (entries == teamCount) is CAP-5's "Жеребкування недоступне, поки кількість заявок не дорівнює заданій кількості команд". [SPEC.md#Capabilities]

### Existing code being modified — current state → change → what must be preserved

**`src/actions/result.ts`** (Story 1.6)
- *Current:* `ActionErrorCode = "FORBIDDEN" | "LAST_ADMIN" | "NOT_FOUND"`; `ActionError = { ok: false; code: ActionErrorCode; message: string }`; `ActionResult<T = undefined> = { ok: true; data: T } | ActionError`; `toActionError(error)` maps `AdminRequiredError → FORBIDDEN`, re-throws everything else (incl. `NEXT_REDIRECT`).
- *Change:* add `"INVALID_TRANSITION" | "PRECONDITION_FAILED"` to `ActionErrorCode`. Nothing else.
- *Must preserve:* the `ActionResult` / `ActionError` shapes verbatim (Stories 1.7 `grant/revoke`, 2.2's `admin-role-controls` consume them); `toActionError`'s re-throw of non-`AdminRequiredError` (the `NEXT_REDIRECT` passthrough is load-bearing for `requireAdminPage`); `ActionResult<T = undefined>` default (the 1.6-review "forces `data: undefined`" note is a separate deferred item — do not "fix" it here).

**`src/actions/admin-roles.ts`** — *reference only, do not modify.* `transitionTournament` copies its `try { await requireAdmin(); … } catch (error) { return toActionError(error); }` structure and its `revalidatePath` placement.

**`src/data/users.ts`** — *reference only.* The entity-module pattern (`src/data/tournaments.ts` follows it): named functions, return plain values / Prisma results, `db` from `@/data/client`, no throw for "not found" at the data layer (the action decides the `{ ok: false, code }`). Note `users.ts` returns `{ outcome: … }` discriminators for its writes; `setTournamentState` is simpler (it just writes — validation already happened in `src/domain`) so it can return the Prisma `update` result directly.

**`src/domain/README.md`**, **`src/data/README.md`**, **`src/actions/README.md`** — append a module entry each; preserve the layer-rule prose and the existing module list. `src/data/README.md` already has the line "`Tournament.state` is written only by `transitionTournament` (Story 2.3 / AD-8), never assigned" — this story makes it literally true; keep it.

**`AGENTS.md`** — the "Running and verifying" Vitest TODO line is replaced (not appended); the "Stack status" list gets one new line. Preserve every other line, especially the Policy block and the Prisma-7 / Better-Auth notes.

### The Server Action has no caller yet — is that OK?

Yes — the established Epic 2 pattern. Story 2.1 shipped schema with no CRUD; Story 2.2 shipped `ConfirmDialog` / `Skeleton` with no consumers. `epics.md`'s cross-cutting principle explicitly separates "introduce the transition pattern" (2.3) from "call it" (3.3 / 4.2 / 4.5). The action + data layer being unreachable from the UI is *why* they have no automated coverage this story (no session mock, no route to drive) — flagged in Task 9 / `deferred-work.md`, not a gap to fix here.

One consequence: `revalidatePath("/classic")` / `revalidatePath("/admin/tournaments/${id}")` target routes that do not exist yet. `revalidatePath` on an unknown path is a documented no-op in Next 16 — safe. The route-owning stories (2.4 admin tournament page, 2.9 public tournament page, 3.3 draw) confirm/adjust the exact paths when they wire the real caller.

### Vitest — the runner, minimally

- **Why now:** AGENTS.md — "юніт-тести доменних функцій `src/domain/*` — обовʼязкові; запуск через Vitest (додається з першим модулем `src/domain`)". This is that module. `deferred-work.md` names "the Story 2.3 runner" in four carried items. The spine's Consistency Conventions: "доменні функції `src/domain/` покриваються юніт-тестами (детерміновані, без моків) — обовʼязково".
- **Scope of the runner:** `environment: "node"`, `include: ["src/**/*.test.ts"]`, explicit imports from `"vitest"` (no globals → no `tsconfig` `types` entry, no `vitest/globals`). This is the *pure-function* test setup only. Component tests (`@testing-library/react` + `jsdom`) and action-layer tests (a `requireAdmin` / `next/headers` mock) need more and are **not** in this story — the domain spec is the deliverable, plus the harness other stories build on.
- **Version:** Vitest **4.x** (4.1+ stable since March 2026). **Not 5.0.0** — it shipped 2026-09-04, hours before this story; give it soak time. `pnpm add -D vitest@^4`; commit the exact resolved version (project pins — `@prisma/adapter-pg@7.10.0`, `next@16.3.4`, `packageManager: pnpm@11.25.0`).
- **`build` / `typecheck` interaction:** `pnpm typecheck` (`tsc --noEmit`, `include: ["**/*.ts", "**/*.mts", …]`) and `next build` (whole-tsconfig type check — `next.config.ts` sets no `ignoreBuildErrors`) both see `vitest.config.ts` + `*.test.ts`. They type-check fine (types from the `vitest` package). If `next build` unexpectedly errors on them, add a `tsconfig` `exclude` for those files — **never** `typescript.ignoreBuildErrors`. Record if hit.
- **`build` does NOT run `pnpm test`** — no runner budget on Vercel, no CI story yet. Deliberate. `deferred-work.md` "No CI gate on push to `main`" already tracks that lint + tests don't run on deploy.

### Testing Requirements

**`src/domain/tournamentState.test.ts` — the coverage matrix (all deterministic, no mocks):**

| Case | Input | Expect |
| --- | --- | --- |
| Legal: draft → group | `checkTransition("DRAFT", "GROUP_STAGE", { entryCount: 6, teamCount: 6 })` | `{ ok: true }` |
| Legal: group → playoff | `checkTransition("GROUP_STAGE", "PLAYOFF", { allGroupMatchesPlayed: true })` | `{ ok: true }` |
| Legal: playoff → completed | `checkTransition("PLAYOFF", "COMPLETED", { finalAndThirdPlacePlayed: true })` | `{ ok: true }` |
| Precondition fail: entries ≠ teamCount | `("DRAFT","GROUP_STAGE",{ entryCount: 7, teamCount: 10 })` | `{ ok: false, code: "PRECONDITION_FAILED" }`, message contains `7` and `10` |
| Precondition fail: counts missing | `("DRAFT","GROUP_STAGE",{})` | `{ ok: false, code: "PRECONDITION_FAILED" }` |
| Stub `PLAYOFF` fails closed | `("GROUP_STAGE","PLAYOFF",{})` and `{ allGroupMatchesPlayed: false }` | `{ ok: false, code: "PRECONDITION_FAILED" }` |
| Stub `COMPLETED` fails closed | `("PLAYOFF","COMPLETED",{})` and `{ finalAndThirdPlacePlayed: false }` | `{ ok: false, code: "PRECONDITION_FAILED" }` |
| Illegal: skip | `("DRAFT","PLAYOFF")`, `("DRAFT","COMPLETED")`, `("GROUP_STAGE","COMPLETED")` | `{ ok: false, code: "INVALID_TRANSITION" }` |
| Illegal: backward | `("GROUP_STAGE","DRAFT")`, `("PLAYOFF","GROUP_STAGE")`, `("COMPLETED","PLAYOFF")` | `{ ok: false, code: "INVALID_TRANSITION" }` |
| Illegal: self | `("DRAFT","DRAFT")`, `("GROUP_STAGE","GROUP_STAGE")`, `("COMPLETED","COMPLETED")` | `{ ok: false, code: "INVALID_TRANSITION" }` |
| Illegal: from terminal | `("COMPLETED","DRAFT")` (and every other target) | `{ ok: false, code: "INVALID_TRANSITION" }` |
| Message language | any `INVALID_TRANSITION` / `PRECONDITION_FAILED` | `message` is a non-empty Ukrainian string |
| Structural lock | `TRANSITIONS` deep-equals `{ DRAFT: ["GROUP_STAGE"], GROUP_STAGE: ["PLAYOFF"], PLAYOFF: ["COMPLETED"], COMPLETED: [] }` | pass (a future stray edge fails the suite) |
| `canTransition` edge check | `canTransition("DRAFT","GROUP_STAGE")` true; `canTransition("DRAFT","PLAYOFF")` / `("GROUP_STAGE","DRAFT")` / `("COMPLETED","DRAFT")` false | matches the table, ignores preconditions |

- **`src/data/tournaments.ts` / `src/actions/tournaments.ts`** — **no automated test this story.** No session-mock infra (`requireAdmin` reads `next/headers` + a DB session), no route to drive the action, and writing to the one prod Neon DB from a test is out (Story 2.1's constraint). Gate = `pnpm typecheck` + `pnpm lint` + code review + the exhaustive `src/domain` spec (the action is a thin adapter over it). The contract test (`requireAdmin` mocked → `{ ok: false, code: "FORBIDDEN" }`; not-found → `NOT_FOUND`; `GROUP_STAGE` with `entryCount` short → `PRECONDITION_FAILED`; happy path → `setTournamentState` called once + `revalidatePath`) is **deferred** — added when the action-layer session mock lands (overlaps `deferred-work.md`'s 1.7 "no automated end-to-end / action-layer coverage" and 2.1 "from-empty replay + integration tests" items).
- Capture real command output (`pnpm test`, `typecheck`, `lint`, `build`, the greps, the negative lint probe) in the Dev Agent Record — verifiable, not asserted (Stories 1.1–2.2 / 2.1 pattern).

### Previous story intelligence

**Story 2.1 (done) — the schema this story drives:**
- `Tournament.state` is `TournamentState @default(DRAFT)`, enum `DRAFT | GROUP_STAGE | PLAYOFF | COMPLETED`, `@@map("tournament")`. `///` comment already says "Changed only by `transitionTournament` (Story 2.3 / AD-8) — never by a direct write. Forward-only." — this story delivers that.
- Generated enum (`src/generated/prisma/enums.ts`) exposes both `const TournamentState = {…} as const` and `type TournamentState = …` (a string union). `src/data` may import it; `src/domain` may **not** (lint).
- `TournamentEntry` is `@@unique([tournamentId, teamId])`, `@@index([teamId])` — `countTournamentEntries` filters on `tournamentId` (covered by the FK; fine for v1 scale — "десятки команд").
- Its review left in `deferred-work.md`: "`Tournament.state` is directly assignable in the schema … Story 2.3 (no data-layer function takes a `state` arg; illegal transitions rejected in `src/domain/tournamentState.ts`)" — **this is the item this story closes** (by convention — Task 9).
- `db-check.mts` / `verify-admin-roles.mts` are the "operational gate" script style; `db-check.mts` already imports the generated `Discipline` enum. A `verify-tournament-state.mts` is **not** added — the Vitest domain spec supersedes a hand-rolled script for pure logic, and the action/data layer can't be script-tested without a session (see Testing Requirements).

**Story 1.7 (done) — the action pattern:**
- `src/actions/admin-roles.ts` — `grantAdmin` / `revokeAdmin`: `try { await requireAdmin(); … const { outcome } = await <dataFn>(); if (outcome === "not_found") return { ok: false, code: "NOT_FOUND", message: … }; revalidatePath("/admin/people"); return { ok: true, data: { id } }; } catch (error) { return toActionError(error); }`. `transitionTournament` mirrors this exactly.
- `src/data/users.ts` — writes return `{ outcome: "ok" | "not_found" | "last_admin" }` discriminators; the *last-admin* guard lives in a `$transaction` with `SELECT … FOR UPDATE`. `setTournamentState` needs **no** such guard — the transition validity is decided in `src/domain` before the call, and there is no "last X" invariant on tournament state. Keep it a plain `update`.
- Its review deferred "No automated end-to-end / action-layer coverage … Add when a test runner + session-mock infra lands (Epic 3)". The **runner** lands here; the **session mock** does not — re-note in Task 9.

**Story 1.6 (done) — `requireAdmin` + `ActionResult`:**
- `requireAdmin()` (`src/auth/requireAdmin.ts`) throws `AdminRequiredError` before any data access; `cache()`-wrapped session read. `toActionError` maps it to `FORBIDDEN` and **re-throws** `NEXT_REDIRECT` and everything else — `transitionTournament`'s `catch` must use `toActionError`, not swallow.
- `ActionResult<T = undefined>` — the 1.6 review flagged "forces `data: undefined` at call sites"; `transitionTournament` returns `ActionResult<{ state: TournamentState }>` so it is unaffected. Do not touch the default.

**Story 2.2 (done):**
- Pure view story; its review put "component tests for `ConfirmDialog` / `admin-role-controls` → the Story 2.3 runner" into `deferred-work.md`. The runner exists after this story but the *component-test toolchain* (jsdom / testing-library) is still missing — Task 9 re-words those items so they are not read as "done".
- `src/actions/README.md` already states "`Tournament.state` is changed only by explicit transition actions … Never assign `state` directly" — no edit needed beyond the module entry.

**Story 1.3 (done):**
- `eslint.config.mjs` `src/domain/**` block: `no-restricted-imports` (paths + patterns, alias + relative) forbidding `next`, `@prisma/client`, `@/generated/prisma`, `react`, and every other `src/` layer incl. `src/lib`; plus `import/no-restricted-paths` zone `target: ./src/domain, from: ./src, except: ["./domain"]`. A co-located `*.test.ts` under `src/domain` importing `./tournamentState` and `vitest` is clean under both. The Story 1.3 "verified once with throwaway probes, no committed fixture" gap — the Task 8 negative probe repeats that method; `deferred-work.md` already tracks making it durable "once Vitest lands" (now).

### Git intelligence

Recent: `777cc77` (2.2 review patches) ← `c0a18db` (2.2 docs) ← `4f5afd4` (2.2 impl) ← `15cf8e6` (2.1 review) ← `9bfa73d` (2.1 schema). `src/domain/` = `README.md` only (still no `.ts`). `src/data/` = `client.ts`, `users.ts`, `README.md`. `src/actions/` = `result.ts`, `admin-roles.ts`, `README.md`. `prisma/schema.prisma` has `Tournament` + `TournamentState` enum + the other Epic-2 models. No `vitest` anywhere; `package.json` has no `test` script. `.gitignore` already ignores `/coverage`.

### Latest tech information

- **Vitest 4.x** (4.1 released 2026-03; 5.0.0 released 2026-09-04 — too new, use 4.x). Pure-ESM, esbuild-based TS transform (no babel/ts-node). `defineConfig` from `"vitest/config"`. `test.environment: "node"` for pure logic (no jsdom dependency). Node 24 supported. Vitest bundles/depends on Vite transitively — a `vite` peer warning from pnpm is resolved by `pnpm add -D vite`.
- **No `@vitejs/plugin-react`, no `jsdom`, no `@testing-library/*`** — not needed for a `src/domain` string-logic spec; adding them is the *component-test* story's job.
- **`tsc` / `next build` + test files** — importing named exports from `"vitest"` gives full types with no `tsconfig` change. `next build` type-checks the whole project by default; the config + spec files must pass (they will).
- **Next 16** — `revalidatePath(path)` for a path with no matching route is a no-op (no throw). Server Actions in a `"use server"` module file are the norm; `transitionTournament` takes `(string, TournamentState)` — primitive args, no `FormData` needed (the callers in 3.3 / 4.2 / 4.5 invoke it directly, not from a `<form action>`).
- No security advisories. One new devDependency (`vitest`), zero new runtime dependencies.

### Project context reference

No `project-context.md` (the `persistent_facts` glob matched nothing). Binding docs:
- `epics.md` — Story 2.3 AC (transition table + precondition check; `DRAFT → GROUP_STAGE` allowed; `transitionTournament` the only `state` path; `→ PLAYOFF` / `→ COMPLETED` as stub predicates); Epic 2 intro ("вводить **розширюваний патерн переходів стану турніру** (`DRAFT → GROUP_STAGE` — сам перехід у Epic 3)"); the "Наскрізні принципи" bullet on the extensible state machine; Stories 3.3 / 4.2 / 4.5 (the real callers) and 3.1 (the other domain modules — not here).
- `glossary.md` — "Стан турніру" (the exact lifecycle `Чернетка → Груповий етап → Плейоф → Завершений` and its Ukrainian labels), "Жеребкування", "Група".
- `SPEC.md` — CAP-2 ("Кожен перехід стану відбувається лише коли виконані передумови … прямої зміни стану в обхід переходів немає"), CAP-5 (draw precondition), CAP-9 (playoff precondition), Constraints (UA-only; AD-1…AD-11 mandatory; standings/placements never stored).
- `ARCHITECTURE-SPINE.md` — AD-2 (pure domain), AD-3 (dependency direction + the `mermaid` graph), AD-6 (Server Action + `requireAdmin`), AD-7 (public vs admin reads), **AD-8** (the invariant this story realises), AD-11 (`src/data` sole owner), Consistency Conventions (naming, error shape, `revalidatePath`, tests mandatory), the "Дерево коду" (`src/domain/` module list, `src/actions/tournament`).
- `EXPERIENCE.md` — §Voice ("Жеребкування недоступне: заявлено 7 команд із 10." — the exact precondition-failure phrasing; verb buttons; "Завершити турнір? Після цього результати редагувати не можна." — future confirm copy, not this story), §Component Patterns ("Admin action bar … контекстні дії за станом" — Stories 3.3/4.2/4.5), §Flow (the create → draw → … → finish walkthrough).
- `AGENTS.md` — pnpm + **PowerShell** for `pnpm` (Bash lacks it); the Vitest TODO line to replace; "Турнірна таблиця й місця плейофа обчислюються при читанні, ніколи не зберігаються"; "`Tournament.state` змінюється лише через Server Action `transitionTournament`, не присвоєнням" (already there — this story makes it real); the layer-boundary lint description.
- `2-1-tournament-team-player-schema.md` — the schema, the generated-enum shape, the "state directly assignable" deferred item this story closes.
- `1-7-admin-management.md` / `1-6-require-admin-access-control.md` — the Server Action + `ActionResult` + `toActionError` + `revalidatePath` pattern.
- `deferred-work.md` — the "Story 2.3 runner" references (2.2 review ×3, 1.3 review ×1), the 1.7 "no action-layer coverage" item, the 2.1 "state assignable" + "from-empty replay / integration tests" items.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3: Розширюваний стейт-машин турніру] — user story + AC (transition table + precondition check; `DRAFT → GROUP_STAGE` allowed; `transitionTournament` only path; `→ PLAYOFF` / `→ COMPLETED` stub predicates)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2] — "вводить **розширюваний патерн переходів стану турніру** (`DRAFT → GROUP_STAGE` — сам перехід у Epic 3)"
- [Source: _bmad-output/planning-artifacts/epics.md#Перелік епіків — Наскрізні принципи] — "Стейт-машина турніру розширювана. Epic 2 вводить патерн переходів … Ніхто не винаходить його заново"; "Двигун — першою історією … чисті функції `src/domain/*` з юніт-тестами"
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3 / 4.2 / 4.5] — the real callers of each transition; the draw also generates the calendar
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#CAP-2] — "Кожен перехід стану відбувається лише коли виконані передумови … прямої зміни стану в обхід переходів немає"
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#CAP-5, #CAP-9] — draw precondition (entries == teamCount); playoff precondition (all group matches have a result)
- [Source: _bmad-output/specs/spec-cherkasy-volley/glossary.md#Стан турніру] — `Чернетка → Груповий етап → Плейоф → Завершений`; the Ukrainian labels
- [Source: _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md#AD-8] — "переходи … — окремі Server Actions, кожна перевіряє передумови … Пряме присвоєння `state` поза цими переходами заборонене"
- [Source: …/ARCHITECTURE-SPINE.md#AD-2, #AD-3] — pure domain; `view → shell → {domain, data}`, `auth → data`
- [Source: …/ARCHITECTURE-SPINE.md#AD-6, #AD-7, #AD-11] — Server Action + `requireAdmin()`; public vs admin reads; `src/data` sole Prisma owner
- [Source: …/ARCHITECTURE-SPINE.md#Consistency Conventions] — verb-named actions; `{ ok, code, message }` / `{ ok, data }`; `revalidatePath` after writes; domain unit tests mandatory (deterministic, no mocks)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md#Voice and Tone] — "Жеребкування недоступне: заявлено 7 команд із 10." (the precondition-failure message phrasing)
- [Source: _bmad-output/implementation-artifacts/2-1-tournament-team-player-schema.md] — `Tournament.state` enum + `@default(DRAFT)`; generated-enum shape; the "state directly assignable" deferred item; `db-check` / operational-gate script style
- [Source: _bmad-output/implementation-artifacts/1-7-admin-management.md] — `src/actions/admin-roles.ts` try/catch/`toActionError`/`revalidatePath` pattern; `src/data/users.ts` entity-module pattern
- [Source: _bmad-output/implementation-artifacts/1-6-require-admin-access-control.md] — `requireAdmin` / `AdminRequiredError` / `ActionResult` / `toActionError`
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — "the Story 2.3 runner" (2.2 review), "no action-layer coverage" (1.7), "state directly assignable" + "from-empty replay / integration tests" (2.1), "no committed eslint negative fixture" (1.3)
- [Source: AGENTS.md] — `pnpm` via PowerShell; the Vitest TODO line; layer-boundary lint; `transitionTournament` convention line
- [Source: src/actions/result.ts · src/actions/admin-roles.ts · src/data/users.ts · src/auth/requireAdmin.ts · eslint.config.mjs] — the exact shapes to match / extend
- Web: [Vitest — Getting Started](https://vitest.dev/guide/) · [Vitest 4.1 blog](https://vitest.dev/blog/vitest-4-1.html) · [Vitest config — `environment`](https://vitest.dev/config/#environment) · [Next.js — `revalidatePath`](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

**Vitest runner** — `pnpm add -D vitest` resolved `4.1.11` (not 5.0.0). No `vite` peer warning. Config first written as `vitest.config.ts`; Vite's native config loader warned about ESM-in-CJS, so renamed to `vitest.config.mts` (matches `eslint.config.mjs`; `tsconfig` already includes `**/*.mts`). `pnpm test` with no specs exits 1 ("No test files found" — Vitest 4 behaviour); resolves once the spec lands.

**Verification gate (Node 24):**
```
$ pnpm test        → Test Files 1 passed (1) · Tests 25 passed (25)
$ pnpm typecheck   → exit 0
$ pnpm lint        → exit 0
$ pnpm build       → exit 0
  migrate deploy: "No pending migrations to apply." (no migration this story)
  Route (app): /_not-found ○ · /admin ƒ · /admin/people ƒ · /api/auth/[...all] ƒ
               /archive ○ · /beach ○ · /classic ○ · /sign-in ○   (unchanged from Story 2.2)
$ pnpm exec eslint --print-config src/domain/tournamentState.ts → "no-restricted-imports" present (domain block active)
```

**Import-boundary greps:**
```
grep "@prisma/client|generated/prisma" src/domain/**/*.ts   → (none)
grep "next" src/domain/**/*.ts                              → (none)
grep "@prisma/client|generated/prisma" src/**/*.ts          → only src/data/client.ts, src/data/tournaments.ts (type-only), src/generated/**
grep "data: { state" src/data/                              → only setTournamentState in tournaments.ts
```

**Negative lint probe** (Story 1.3 / 2.2 method — not durable): injected `import { db } from "@/data/client";` at the top of `tournamentState.ts` → `pnpm lint` reported 2 errors (`no-restricted-imports` + `import/no-restricted-paths`, "src/domain must not import the database or another src/ layer") → reverted. Tracked in `deferred-work.md` (committed fixture still owed).

### Completion Notes List

- **`src/domain/tournamentState.ts`** — pure module. Own `TournamentState` union (not re-exported from Prisma). `TRANSITIONS` (forward-only `DRAFT → GROUP_STAGE → PLAYOFF → COMPLETED`, `COMPLETED` terminal), `LABELS` (Ukrainian, used by the `INVALID_TRANSITION` message), `canTransition(from, to)` (edge-only, for the view), `checkTransition(from, to, ctx)` (edge + precondition — the gate the action calls). `PRECONDITIONS`: `GROUP_STAGE` is live (`entryCount === teamCount`, fails closed on missing counts); `PLAYOFF` / `COMPLETED` are fail-closed predicates keyed on `allGroupMatchesPlayed` / `finalAndThirdPlacePlayed` — no code comments carry story/epic refs (project convention), the "why" is stated as "match results are not modelled yet".
- **`src/domain/tournamentState.test.ts`** — 25 tests: `TRANSITIONS` structural lock; `canTransition` edge matrix; every legal edge with satisfied precondition → `{ ok: true }`; `DRAFT → GROUP_STAGE` count mismatch + missing counts → `PRECONDITION_FAILED`; `PLAYOFF` / `COMPLETED` stubs fail closed on `undefined` / `false`; 13 illegal edges (skip / backward / self) → `INVALID_TRANSITION` even with a full context; failure messages are non-empty Cyrillic strings.
- **`src/data/tournaments.ts`** — `getTournamentForAdmin(id)` (admin read, drafts included), `countTournamentEntries(tournamentId)`, `setTournamentState(id, state)` (sole `state` writer, no validation — the caller validates). Imports `@/data/client` + a type-only `TournamentState` from the generated enums.
- **`src/actions/tournaments.ts`** — `transitionTournament(tournamentId, targetState)` → `ActionResult<{ state }>`. `requireAdmin()` first; not-found → `NOT_FOUND`; builds `TransitionContext` (only `entryCount` / `teamCount` for `GROUP_STAGE`); `checkTransition` failure passes `code` straight through (`INVALID_TRANSITION` / `PRECONDITION_FAILED` now in `ActionErrorCode`); `setTournamentState`; `revalidatePath("/classic")` + `revalidatePath("/admin/tournaments/<id>")` (inert until those routes exist); `try/catch → toActionError`. No UI caller yet — that arrives with the draw.
- **`src/actions/result.ts`** — `ActionErrorCode` gains `"INVALID_TRANSITION" | "PRECONDITION_FAILED"`. `toActionError` unchanged.
- **Vitest** — `vitest@^4.1.11` devDep, `vitest.config.mts` (`environment: node`, `include: src/**/*.test.ts`), `pnpm test` / `pnpm test:watch` scripts. Not wired into `build` (no CI). `/coverage` already git-ignored.
- **Docs** — `src/domain/README.md` (`## Modules` + `tournamentState.ts` + Vitest note), `src/data/README.md` (`tournaments.ts` bullet — `setTournamentState` sole writer), `src/actions/README.md` (`tournaments.ts` bullet), `AGENTS.md` (`pnpm test` replaces the Vitest TODO line; one "Stack status" line for the state machine), `deferred-work.md` (Story 2.3 update note: 2-1 "state assignable" resolved-by-convention; runner landed but component/action test toolchain still owed; new item — `transitionTournament` / `src/data/tournaments.ts` untested).
- **No UI, no migration** — `state` field + `TournamentState` enum already exist (Story 2.1). Route table unchanged.
- **Not covered by tests:** `transitionTournament` + `src/data/tournaments.ts` (no session mock / no route to drive / one prod DB). Gate is `typecheck` + `lint` + review + the exhaustive domain spec. Deferred (see `deferred-work.md`).
- **Comment convention adaptation:** Tasks 2 and 6 wrote `// TODO(Epic 4 / Story 4.2)` etc. into their sub-item text; the loaded persistent-fact convention forbids epic/story references in source-code comments, so those comments explain the *why* ("match results are not modelled yet", "the per-tournament admin page arrives with a later story") without the refs. The `[x]` on those tasks reflects the adapted intent, not the literal comment strings.
- **Review patches (2026-09-04, `bmad-code-review`):** `revalidatePath` now derives the section from `tournament.discipline` and adds `/archive` on `→ COMPLETED` (the old "routes do not exist / inert" comment was wrong — `/classic` is live since Story 1.8); `vitest.config.mts` `include` widened to `.{ts,mts,tsx}` + a `@/` → `./src` `resolve.alias` (the next domain/data/component test would otherwise silently not resolve or not collect); `checkTransition`'s `INVALID_TRANSITION` message falls back to the raw code (`LABELS[x] ?? x`) so a malformed `targetState` never renders "undefined"; `deferred-work.md` wording tightened (the untested action surface is not "low risk" — the auth gate and context wiring are structurally unreachable by a domain unit test). `test` / `typecheck` / `lint` / `build` re-run clean.

### File List

**New**
- `src/domain/tournamentState.ts`
- `src/domain/tournamentState.test.ts`
- `src/data/tournaments.ts`
- `src/actions/tournaments.ts`
- `vitest.config.mts`

**Modified**
- `package.json` — `vitest` devDep; `test` / `test:watch` scripts
- `pnpm-lock.yaml` — `vitest` and its transitive deps
- `src/actions/result.ts` — `ActionErrorCode` + `INVALID_TRANSITION` / `PRECONDITION_FAILED`
- `src/domain/README.md` — `## Modules` + `tournamentState.ts`
- `src/data/README.md` — `tournaments.ts` module bullet
- `src/actions/README.md` — `tournaments.ts` module bullet
- `AGENTS.md` — `pnpm test` line; state-machine "Stack status" line
- `_bmad-output/implementation-artifacts/deferred-work.md` — Story 2.3 update note; 2-1 item marked resolved
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `2-3` → in-progress → review

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-04 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
| 2026-09-04 | Implemented Tasks 1–9 (`bmad-dev-story`). New: `src/domain/tournamentState.ts` (+ 25-case Vitest spec), `src/data/tournaments.ts`, `src/actions/tournaments.ts`, `vitest.config.mts`. Modified: `src/actions/result.ts` (`ActionErrorCode` +2 codes), `package.json` (`vitest` + `test` scripts), the three layer `README.md`s, `AGENTS.md`, `deferred-work.md`. `test` (25/25) / `typecheck` / `lint` / `build` clean on Node 24; route table unchanged; import-boundary greps + negative lint probe pass. No UI, no migration, no runtime behaviour change (the action has no caller yet). Status: in-progress → review. |
| 2026-09-04 | Implementation review (`bmad-code-review`, 4 layers). All 3 ACs met. 5 patches applied: `revalidatePath` discipline-aware + `/archive` on `→ COMPLETED` + corrected comment; `vitest.config.mts` `include` `.{ts,mts,tsx}` + `@/` alias; `checkTransition` message `LABELS[x] ?? x` fallback; Completion Note on the comment-convention adaptation; `deferred-work.md` wording tightened. 7 items deferred → `deferred-work.md`, 8 dismissed. `test` / `typecheck` / `lint` / `build` re-run clean. Committed (code + docs + review patches + this file, one commit; not pushed). Status: review → done. |
