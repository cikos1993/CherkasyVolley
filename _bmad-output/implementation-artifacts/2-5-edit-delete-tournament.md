---
baseline_commit: d4077d9
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - _bmad-output/specs/spec-cherkasy-volley/glossary.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/implementation-artifacts/2-1-tournament-team-player-schema.md
  - _bmad-output/implementation-artifacts/2-3-tournament-state-machine.md
  - _bmad-output/implementation-artifacts/2-4-create-tournament.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - AGENTS.md
---

# Story 2.5: Edit and delete tournament

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to change a tournament's details or delete it,
so that I can correct a mistake or remove something unneeded (FR-6).

## Acceptance Criteria

Translated from `epics.md` → Epic 2 → Story 2.5. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** a tournament exists, I am an admin
**When** I edit the name / year / rules
**Then**

1. The changes are saved.
2. Group-stage parameters (number of teams, number of rounds) are editable only in state `DRAFT`.
3. "Delete tournament" opens a `ConfirmDialog`; after confirmation, the tournament and all related entities (entries, rosters) are deleted.

### Notes on AC interpretation

- **Which fields count as "назву/рік/правила" (AC 1) vs "параметри групового етапу" (AC 2)?** The create form (Story 2.4) has 6 fields: `type`, `name`, `year`, `scoringPreset`, `teamCount`, `rounds`. AC 2 names exactly two as `DRAFT`-only: **`teamCount`, `rounds`**. Everything else — **`type`, `name`, `year`, `scoringPreset`** — is editable in any state. Rationale: `type`/`scoringPreset` are classification/rules metadata, not structural inputs to the group (unlike `teamCount`/`rounds`, which the eventual draw consumes to size the calendar — Story 3.3). `discipline` stays out of the form entirely, same as create (hardcoded `CLASSIC`, AD-9).
- **No state restriction on delete itself.** The AC says confirm → delete, full stop — it does not gate deletion by `state`. The 2-1 review flagged the open question ("decide whether `COMPLETED` tournaments are delete-protected"); **decision: no restriction, matches the AC as written.** A `COMPLETED` tournament (already in the public archive) can still be deleted by an admin who explicitly confirms. This is a real risk given SPEC's "втрата історії неприйнятна", but adding a state gate is a narrowing of the literal AC that the AC text does not support — flag it in `deferred-work.md` as a candidate follow-up (an `archived` soft-delete flag, or a second confirmation step) rather than deciding it here.
- **No separate `/admin/tournaments/[id]/edit` route.** `EXPERIENCE.md`'s IA lists a single `/admin/tournaments/[t]` route for "Ведення" (management — teams, draw, schedule, results, playoff, finish). The 2.4 story explicitly anticipated this: "Stories 2.5 (edit/delete) … build this page out — it is a shared surface, extended not rebuilt." **Decision: turn the existing `[id]` stub's static `<dl>` into an inline edit form + a delete action on the same page**, not a new route.
- **New: an admin tournament list at `/admin/tournaments`.** Not literally required by this story's AC, but carried forward as a named finding from the 2.4 code review: *"No admin listing page for tournaments … Story 2.5 ('edit/delete tournament') is the natural owner — it needs a way to pick a tournament to edit."* Without it, the only way to reach the edit/delete UI is the one-shot redirect URL from creation. **In scope**: a minimal list page (name, type, year, state, link to each `[id]`), reachable from the `/admin` dashboard. This also gives `createTournament`'s existing `redirect` a real place to link back to, and is the natural home for `revalidatePath("/admin/tournaments")` after every tournament write (create/edit/delete) — the 2.4 review's second deferred item ("`createTournament` does not `revalidatePath`, … revisit once [a list] exists") is now actionable; this story both creates the list and wires the missing `revalidatePath` call into `createTournament`.
- **`updateTournament` reuses `validateNewTournament` verbatim — no new `src/domain` code.** The 6 edit fields are the exact same shape `NewTournamentInput` already validates (Story 2.4). The Server Action builds the raw payload from `formData` for the always-editable fields and substitutes the tournament's **current** `teamCount`/`rounds` (not the submitted value) whenever `state !== "DRAFT"` — defense in depth against a forged request that includes those fields outside `DRAFT`, independent of whatever the client renders. `discipline` is not read from the form (hardcoded `"CLASSIC"`, matching create).
- **`updateTournament` and `deleteTournament` handle Prisma `P2025`** (record not found — a concurrent delete between page load and submit). Add `isRecordNotFound(error)` to `src/data/tournaments.ts` alongside the existing `isUniqueViolation`. This directly resolves the `deferred-work.md` item from the 2.3 review: *"Prisma errors from `setTournamentState` escape the `try/catch`… tournament delete is Story 2.5."* (`setTournamentState` itself is untouched — out of scope here — but the same class of gap on the new delete/update writers is closed as they're built, not deferred again.)
- **`deleteTournament` returns `ActionResult<undefined>` (the `admin-roles.ts` / `transitionTournament` shape), not the `useActionState` form-state shape.** It is a single confirm-and-go action behind `ConfirmDialog`, exactly like `revokeAdmin` — not a multi-field form. `updateTournament` uses the `useActionState` form-state shape (same `CreateTournamentState` type `createTournament` already returns — structurally identical, no new type needed) because it is a multi-field form with per-field errors.
- **Cascade delete is already correct at the schema level (Story 2.1/2.4) — no new migration.** `Tournament → Group` and `Tournament → TournamentEntry` are both `onDelete: Cascade`; `TournamentEntry → Player` is `onDelete: Cascade`. A single `db.tournament.delete({ where: { id } })` removes the tournament, its group, its entries, and their rosters in one statement, satisfying AC 3's "турнір і всі повʼязані сутності (заявки, склади) видаляються" with zero new schema work. (`TournamentEntry → Team` stays `onDelete: Restrict`, but that FK points the other way — deleting a `Tournament` never touches `Team` rows.)
- **Post-edit UX: no redirect, no reset — matches EXPERIENCE.md's "Редагування" primitive** ("усі зміни синхронні … після успіху сторінка ревалідується, користувач бачить збережений стан"). `updateTournament` returns `{}` (or `{ fieldErrors }` / `{ formError }`) — never `redirect()`. The form's local controlled state already reflects what was submitted; a `notify.success` toast confirms the write, and `router.refresh()` + a `key` on the form (see Dev Notes) resyncs it to the server-canonical (trimmed) values.

## Tasks / Subtasks

- [x] **Task 1 — `src/data/tournaments.ts` (UPDATE): reads, editor, deleter, error helper** (AC: 1, 2, 3)
  - [x] `listTournamentsForAdmin()` — `db.tournament.findMany({ orderBy: [{ year: "desc" }, { name: "asc" }], select: { id, name, type, year, state, discipline } })`. Admin read (drafts included), called only under `requireAdminPage()` (the `/admin` layout already gates every route under it).
  - [x] `updateTournamentRecord(id, input: NewTournamentInput)` — `db.tournament.update({ where: { id }, data: { type, name, year, scoringPreset, teamCount, rounds } })` (omit `discipline` from `data` — never changes post-create, same invariant as create). Second writer of `Tournament` after `createTournamentRecord`; still never touches `state` (AD-8 — `setTournamentState` stays the sole writer of that one column).
  - [x] `deleteTournamentRecord(id)` — `db.tournament.delete({ where: { id } })`. Relies on the existing cascade FKs (Story 2.1/2.4 schema) — no new Prisma work.
  - [x] `isRecordNotFound(error): boolean` — `error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"`, same style as `isUniqueViolation`.
  - [x] Doc comments matching the file's existing style (see `getTournamentForAdmin` / `setTournamentState`). `typecheck` + `lint` clean.
- [x] **Task 2 — `src/actions/tournaments.ts` (UPDATE): `updateTournament` + `deleteTournament`** (AC: 1, 2, 3)
  - [x] `updateTournament(tournamentId: string, _prev: CreateTournamentState, formData: FormData): Promise<CreateTournamentState>` (bound via `.bind(null, tournamentId)` in the form). Body: `requireAdmin()` (narrowed try → `AdminRequiredError` → `formError`, else re-throw — same as `createTournament`) → `getTournamentForAdmin(tournamentId)`; `null` → `{ formError: "Турнір не знайдено." }` → build the raw payload (`discipline: "CLASSIC"`, `type`/`name`/`year`/`scoringPreset` from `formData`, `teamCount`/`rounds` from `formData` **only if `tournament.state === "DRAFT"`**, else `String(tournament.teamCount)` / `String(tournament.rounds)`) → `validateNewTournament(raw)` → `!ok` → `{ fieldErrors }` → `updateTournamentRecord(tournamentId, parsed.value)` in a narrowed try: `isUniqueViolation(error, TOURNAMENT_NATURAL_KEY_INDEX)` → `{ formError: "Турнір з такою назвою вже існує за цей рік." }`; `isRecordNotFound(error)` → `{ formError: "Турнір не знайдено." }`; else re-throw → on success, `revalidatePath("/admin/tournaments")`, `revalidatePath(\`/admin/tournaments/${tournamentId}\`)`, `revalidatePath("/classic")` (matches `transitionTournament`'s existing convention of revalidating the public discipline path on every tournament write, even before that page consumes tournament data) → `return {}`.
  - [x] `deleteTournament(tournamentId: string): Promise<ActionResult<undefined>>`. Body: `try { await requireAdmin(); await deleteTournamentRecord(tournamentId); } catch (error) { if (isRecordNotFound(error)) return { ok: false, code: "NOT_FOUND", message: "Турнір не знайдено." }; return toActionError(error); }` then `revalidatePath("/admin/tournaments")`, `revalidatePath(\`/admin/tournaments/${tournamentId}\`)` (now 404 — cheap to invalidate, avoids a stale cached page on back-navigation), `revalidatePath("/classic")`, `revalidatePath("/archive")`, `return { ok: true, data: undefined }`. (`/classic` unconditionally, not discipline-gated like `transitionTournament` — v1 has no `BEACH` create path, so fetching `discipline` first to branch would be dead code; same simplification `createTournament` already makes.)
  - [x] Add `revalidatePath("/admin/tournaments")` to the existing `createTournament`, right before its `redirect()` call (the missing wiring the 2.4 review flagged, now that the list exists to invalidate).
  - [x] Import `updateTournamentRecord`, `deleteTournamentRecord`, `isRecordNotFound` from `@/data/tournaments`. `transitionTournament` untouched. `typecheck` + `lint` clean.
- [x] **Task 3 — `src/components/tournament-form.tsx` (UPDATE): support edit mode** (AC: 1, 2)
  - [x] Extend props: `mode?: "create" | "edit"` (default `"create"`); when `mode === "edit"`, also accept `tournamentId: string`, `initial: FormValues`, `locked: readonly TournamentField[]` (the fields to render `disabled` — `["teamCount", "rounds"]` when the tournament is not `DRAFT`, `[]` when it is).
  - [x] `useActionState(mode === "edit" ? updateTournament.bind(null, tournamentId) : createTournament, {})`. Local controlled `form` state seeds from `initial` in edit mode, `initialValues()` in create mode.
  - [x] Each `Field`'s control gets `disabled={locked.includes(name)}` (native `<select>` / `Input` both support it). A locked field shows a caption below it: `Змінити можна лише в стані «Чернетка».` (`text-xs text-muted-foreground`, the same caption pattern as the disabled "Зняти доступ" button in `admin-role-controls.tsx`).
  - [x] Submit button label: "Створити турнір" (create, unchanged) / "Зберегти зміни" (edit — verb-first, Voice guide).
  - [x] Keep the existing `useEffect(() => { if (state.formError) notify.error(state.formError); }, [state])` untouched (both modes share `formError` semantics — do not risk the already-reviewed create path). Add a **second, edit-only** effect for the success toast, keyed off the **falling edge of `pending`** (not `state`'s identity, which is fragile to reason about): `const wasPending = useRef(false); useEffect(() => { if (mode === "edit" && wasPending.current && !pending && !state.formError && !state.fieldErrors) { notify.success("Зміни збережено"); router.refresh(); } wasPending.current = pending; }, [pending, state, mode]);` — fires only once a real submit completes successfully (never on mount, since `wasPending.current` starts `false`); inert in create mode.
  - [x] `typecheck` + `lint` clean.
- [x] **Task 4 — `src/components/tournament-actions.tsx` (NEW): `DeleteTournamentButton`** (AC: 3)
  - [x] `"use client"`. Props: `{ tournamentId: string }`. Uses `ConfirmDialog` (title "Видалити турнір?", description "Турнір і всі повʼязані заявки та склади будуть видалені.", `confirmLabel="Видалити"`, `destructive`), same shape as `RevokeAdminButton` in `admin-role-controls.tsx`: `onConfirm` calls `deleteTournament(tournamentId)` (catch → `notify.error(...)` + `return false`; `!ok` → `notify.error(res.message)` + `return false`; success → `notify.success("Турнір видалено")` + `router.push("/admin/tournaments")`).
  - [x] Trigger: `<Button variant="destructive">Видалити турнір</Button>`.
  - [x] `typecheck` + `lint` clean.
- [x] **Task 5 — `src/app/admin/tournaments/[id]/page.tsx` (UPDATE): inline edit + delete** (AC: 1, 2, 3)
  - [x] Replace the static `<dl>` with `<TournamentForm mode="edit" tournamentId={id} initial={{...}} locked={tournament.state === "DRAFT" ? [] : ["teamCount", "rounds"]} key={tournament.updatedAt.getTime()} />` followed by `<DeleteTournamentButton tournamentId={id} />` in its own section (visually separated — a destructive action below the save form, not beside it, so it can't be mis-clicked as "save"). `initial` maps every DB field to its string form (`String(tournament.year)`, etc. — the form's `FormValues` are all strings, same as create's `initial`).
  - [x] Keep the state label (`STATE_LABELS[tournament.state]`) as read-only text near the top — `state` itself is never editable here (AD-8; only `transitionTournament` changes it, out of this story's scope).
  - [x] `export const metadata = { title: "Турнір" }` stays static (the 2.4 story's rationale for not reading tournament data ahead of the layout's auth gate still holds).
- [x] **Task 6 — `src/app/admin/tournaments/page.tsx` (NEW): admin tournament list** (AC: reachability — carried finding from the 2.4 review)
  - [x] Server Component. `await listTournamentsForAdmin()`. Back-link to `/admin`, `<h1>Турніри</h1>`, a "Створити турнір" link (`/admin/tournaments/new`) near the top.
  - [x] Empty (`length === 0`): a plain paragraph, same weight as `/admin/people`'s "Ще ніхто не входив." — `Ще немає турнірів.` (do **not** reuse `NO_TOURNAMENTS` from `@/lib/empty-states` — that copy ("Активні турніри зʼявляться тут, коли їх створить адміністратор.") is viewer-voiced, for the public `/classic` empty state (Story 2.9); an admin looking at their own empty list needs the create-CTA, not that sentence).
  - [x] Non-empty: a `<ul>` of rows (name, type label, year, state label), each row a `<Link href={\`/admin/tournaments/${t.id}\`}>`, same `divide-y` list shell as `/admin/people`.
  - [x] `export const metadata = { title: "Турніри" }`.
- [x] **Task 7 — `src/app/admin/page.tsx` (UPDATE): dashboard link** (AC: reachability)
  - [x] Replace the "Створити турнір" link with a "Турніри" link to `/admin/tournaments` (the list is now the single entry point; the list page itself carries the "Створити турнір" link — Task 6).
- [ ] **Task 8 — Docs**
  - [ ] `src/data/README.md` — `tournaments.ts` entry: add `listTournamentsForAdmin`, `updateTournamentRecord` (second `Tournament` writer, never `state`), `deleteTournamentRecord`, `isRecordNotFound`.
  - [ ] `src/actions/README.md` — `tournaments.ts` entry: add `updateTournament` (form-state shape, DRAFT-locked fields) and `deleteTournament` (`ActionResult`, `ConfirmDialog`-driven).
  - [ ] `src/components/README.md` — extend the `tournament-form.tsx` section for `mode="edit"` / `locked` / the success-detection mechanism; add a `tournament-actions.tsx` (`DeleteTournamentButton`) section modeled on the existing `ConfirmDialog` usage example.
  - [ ] `AGENTS.md` — Stack-status bullet for Story 2.5 (edit/delete tournament, admin list page, the `P2025` helper).
  - [ ] No `ARCHITECTURE-SPINE.md` / `EXPERIENCE.md` / `epics.md` / `SPEC.md` edit — no new invariant, no new route class (extends the documented `/admin/tournaments/*` IA prefix).
- [ ] **Task 9 — `deferred-work.md` (UPDATE)**
  - [ ] Mark **resolved**: 2.4-review "No admin listing page for tournaments" (Task 6); 2.4-review "`createTournament` does not `revalidatePath`" (Task 2 fix); 2.3-review "Prisma errors … escape the `try/catch`" — narrow the resolution note to "the new `updateTournament`/`deleteTournament` writers catch `P2025`; `setTournamentState` itself is untouched, still open for `transitionTournament`."
  - [ ] Add a **"Story 2.5 implementation"** section: the "no delete-state-restriction" decision (with the archival-protection follow-up flagged); no automated test for `updateTournament`/`deleteTournament` (same class of gap as `createTournament`/`transitionTournament`); the edit form's success-detection mechanism has no component test (same "no component-test toolchain" gap tracked since the 2-2 review).
- [ ] **Task 10 — Verification gate** (AC: all)
  - [ ] `pnpm test` (both existing domain specs — no new ones, no `src/domain` changes) · `pnpm typecheck` · `pnpm lint` · `pnpm build` clean.
  - [ ] Route table — `/admin/tournaments` (NEW, `ƒ`) added; `/admin/tournaments/[id]` and `/admin/tournaments/new` unchanged (`ƒ`); rest unchanged.
  - [ ] Import-boundary greps unchanged (no new Prisma import site outside `src/data`; no new `src/domain` module).
  - [ ] Extend `scripts/verify-tournament-create.mts` **or** add a small sibling script (self-cleaning, same style) that round-trips edit + delete against the real DB: create a throwaway tournament → `updateTournamentRecord` (name/year/type/scoringPreset change while `DRAFT`) → read back → `deleteTournamentRecord` → confirm the `Tournament`, its `Group`, and (after enrolling a throwaway `TournamentEntry`/`Player` if feasible within the script's existing scope) the cascade all disappear. This is the real AC-1/AC-3 verification, same rationale as the 2.4 script (no session-mock infra for the action layer).
  - [ ] **Browser walkthrough** (signed-in admin session required — same residual gate as 2.4's create form): `/admin/tournaments` list renders; edit a `DRAFT` tournament's name/year/type/scoringPreset/teamCount/rounds → saved, toast, values persist after a manual refresh; edit a tournament (any test fixture at `DRAFT`, since no further transition exists to reach `GROUP_STAGE`+ without Epic 3's draw) to confirm `teamCount`/`rounds` render `disabled` with the caption **once one exists past `DRAFT`** — if no such fixture is reachable yet (the draw is Epic 3, not shipped), note this explicitly as **not walked** and rely on `updateTournament`'s server-side substitution (Task 2) as the enforcement, same as the 2.4 precedent of flagging untested-but-code-reviewed paths; delete a tournament via `ConfirmDialog` → cascade confirmed in DB → redirected to `/admin/tournaments`; duplicate-name edit → toast; non-admin → rejected.
  - [ ] Capture real command output + walkthrough notes in the Dev Agent Record.
- [ ] **Task 11 — Commit(s)** — one commit + `git push origin main` per completed task. `build` gated each.

## Dev Notes

### What this story is / is NOT

**Is:** editing an existing tournament's `type`/`name`/`year`/`scoringPreset` (any state) and `teamCount`/`rounds` (`DRAFT` only) via an inline form on `/admin/tournaments/[id]`; deleting a tournament (any state) via `ConfirmDialog`, cascading to its `Group`/`TournamentEntry`/`Player` rows; a new `/admin/tournaments` admin list page (reachability, carried from the 2.4 review) with a `/admin` dashboard link; the `updateTournamentRecord` / `deleteTournamentRecord` / `listTournamentsForAdmin` / `isRecordNotFound` additions to `src/data/tournaments.ts`; `updateTournament` / `deleteTournament` additions to `src/actions/tournaments.ts`.

**Is NOT** (do not pull forward):
- **Team enrolment** (2.7), **roster** (2.8), the **public tournament page** (2.9) — the `[id]` page stays admin-only.
- **Any `state` transition** — `transitionTournament` (2.3) is untouched; this story never writes `Tournament.state`.
- **The draw**, `GroupSlot` / `Match` / `SetScore` — Epic 3. There is still no way to reach `GROUP_STAGE`+ except by hand-editing the DB, so the `teamCount`/`rounds`-locked-outside-`DRAFT` path has no real fixture to walk yet (noted in Task 10).
- **Soft-delete / archival protection for `COMPLETED` tournaments** — explicitly decided against adding here (see AC-interpretation notes); flagged in `deferred-work.md` instead.
- **A `Team.name`-style normalization pass** — out of scope, unrelated entity (Story 2.6).
- **New shadcn primitives, new migrations, new `src/domain` modules** — none needed; every field this story touches already has a validator (`validateNewTournament`, Story 2.4) and every table already has the right cascade FKs (Story 2.1/2.4).

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/data/tournaments.ts` | UPDATE | + `listTournamentsForAdmin`, `updateTournamentRecord`, `deleteTournamentRecord`, `isRecordNotFound`. |
| `src/actions/tournaments.ts` | UPDATE | + `updateTournament`, `deleteTournament`; `createTournament` gains one `revalidatePath` call. `transitionTournament` untouched. |
| `src/components/tournament-form.tsx` | UPDATE | + `mode="edit"` / `tournamentId` / `initial` / `locked` props; disabled-field rendering; success-toast + `router.refresh()` path. |
| `src/components/tournament-actions.tsx` | NEW | `DeleteTournamentButton` — `ConfirmDialog` + `deleteTournament` + `router.push`. |
| `src/app/admin/tournaments/[id]/page.tsx` | UPDATE | Static `<dl>` → `<TournamentForm mode="edit">` + `<DeleteTournamentButton>`. |
| `src/app/admin/tournaments/page.tsx` | NEW | Admin tournament list. |
| `src/app/admin/page.tsx` | UPDATE | "Створити турнір" link → "Турніри" link. |
| `scripts/verify-tournament-create.mts` or a new sibling script | UPDATE/NEW | Edit + delete round-trip, self-cleaning. |
| `src/{data,actions,components}/README.md` · `AGENTS.md` · `deferred-work.md` | UPDATE | Module entries, Stack status, resolved/added deferred items. |
| `src/domain/tournamentForm.ts` | DO NOT TOUCH | `validateNewTournament` is reused as-is; no new fields, no new bounds. |
| `src/actions/result.ts` | DO NOT TOUCH | `NOT_FOUND` already exists (used by `transitionTournament`); `deleteTournament` reuses it — no new `ActionErrorCode`. |
| `prisma/schema.prisma` | DO NOT TOUCH | Cascade FKs already correct (Story 2.1/2.4); no migration this story. |
| `src/app/admin/layout.tsx` | DO NOT TOUCH | Already `requireAdminPage()` + `force-dynamic` — covers `/admin/tournaments` (the new list route). |
| `src/generated/prisma/**` | UNCHANGED | No schema change → no regeneration needed. |

### Architecture compliance

- **AD-1 / layers** — `tournament-form.tsx` / `tournament-actions.tsx` / the two pages are View; `updateTournament` / `deleteTournament` are Shell (`src/actions`); `updateTournamentRecord` / `deleteTournamentRecord` / `listTournamentsForAdmin` are Data. No Domain changes (`validateNewTournament` is reused, not extended). [ARCHITECTURE-SPINE.md#Design Paradigm]
- **AD-3 — dependency direction.** Same edges as Story 2.4: `view → shell` (`tournament-form.tsx` / `tournament-actions.tsx` import `@/actions/tournaments`), `view → domain` (the form still reads `TournamentField` etc. from `@/domain/tournamentForm` — unchanged import, no new one), `shell → data`. No new `data → domain` import — `updateTournamentRecord` takes the same `NewTournamentInput` type `createTournamentRecord` already imports.
- **AD-6 — every mutation is a Server Action under `requireAdmin()`.** Both `updateTournament` and `deleteTournament` call it first, before any read or write. [ARCHITECTURE-SPINE.md#AD-6]
- **AD-8 — `state` changes only via `transitionTournament`.** Neither `updateTournamentRecord` nor `deleteTournamentRecord` touches the `state` column; `updateTournamentRecord`'s `data:` object deliberately omits it. [ARCHITECTURE-SPINE.md#AD-8]
- **AD-9 — v1 filters `CLASSIC`.** `updateTournament` never reads a `discipline` field from the form (hardcoded, same as create); `type` stays bounded by `allowedTournamentTypes("CLASSIC")` via the reused validator.
- **AD-11 — `src/data` is the sole Prisma owner.** The two new writers, the new reader, and `isRecordNotFound` (Prisma error typing) all live in `src/data/tournaments.ts`; the actions and components never import Prisma. [ARCHITECTURE-SPINE.md#AD-11]
- **Consistency Conventions** — `revalidatePath` after every write (now including `createTournament`'s missing call, and both new actions); UA-only copy; verb-named actions (`updateTournament`, `deleteTournament`); the delete confirmation uses `ConfirmDialog`, never `confirm()`. [ARCHITECTURE-SPINE.md#Consistency Conventions]
- **EXPERIENCE.md** — §Interaction Primitives ("Підтвердження: руйнівні й незворотні дії … видалити турнір … shadcn Dialog … Кнопка підтвердження — destructive"; "Редагування: усі зміни синхронні … після успіху сторінка ревалідується"); §Voice ("Кнопки — дієслова" → "Зберегти зміни" / "Видалити турнір"; "Підтвердження руйнівних дій — пряма мова"). [EXPERIENCE.md]
- **DESIGN.md** — same form primitives as Story 2.4 (`Input`/native `<select>` as-is, `rounded-sm` inputs, labels above); the delete button is the existing `destructive` `Button` variant, visually separated from the save form (own section, not adjacent to the primary action). [DESIGN.md#Components]

### Existing code being modified — current state → change → what must be preserved

**`src/data/tournaments.ts`** (Story 2.3/2.4)
- *Current:* `getTournamentForAdmin(id)`, `countTournamentEntries(tournamentId)`, `setTournamentState(id, state)` (sole `state` writer), `createTournamentRecord(input)` (sole creator), `TOURNAMENT_NATURAL_KEY_INDEX`, `isUniqueViolation(error, indexName?)`.
- *Change:* add `listTournamentsForAdmin()`, `updateTournamentRecord(id, input)`, `deleteTournamentRecord(id)`, `isRecordNotFound(error)`.
- *Must preserve:* `setTournamentState` stays the only `state` writer; `updateTournamentRecord`'s `data:` object must not include `state` or `discipline`. `createTournamentRecord` unchanged.

**`src/actions/tournaments.ts`** (Story 2.3/2.4)
- *Current:* `transitionTournament(id, targetState)`, `createTournament(_prev, formData)` + `CreateTournamentState`.
- *Change:* add `updateTournament(tournamentId, _prev, formData)`, `deleteTournament(tournamentId)`; add one `revalidatePath("/admin/tournaments")` call to `createTournament`, before its `redirect()`.
- *Must preserve:* `transitionTournament` verbatim. `createTournament`'s existing behavior (form-state shape, `redirect`, `P2002` handling) unchanged apart from the added `revalidatePath` line.

**`src/components/tournament-form.tsx`** (Story 2.4)
- *Current:* create-only. `useActionState(createTournament, {})`; controlled `FormValues` state seeded from `initialValues()`; a `Field` render-prop wrapper; native `<select>` for `type`/`scoringPreset`, `Input` for the rest; submit button "Створити турнір".
- *Change:* generalize for `mode="edit"` — different bound action, different seed (`initial` prop instead of `initialValues()`), `disabled` on locked fields + caption, different submit label, a success path (no `redirect` to key off, so a distinct success-toast + `router.refresh()` branch).
- *Must preserve:* the create path's exact current behavior (UX-DR11 controlled-state mechanism, `notify.error` on `formError`, pending spinner) — a regression here breaks Story 2.4's shipped feature, not just this one.

**`src/app/admin/tournaments/[id]/page.tsx`** (Story 2.4, minimal stub)
- *Current:* fetches `getTournamentForAdmin(id)`, `notFound()` if missing, renders a read-only `<dl>` + a "наступні історії" line.
- *Change:* replace the `<dl>` with the edit form + delete button; drop the "наступні історії" line (edit/delete is no longer a future story).
- *Must preserve:* the back-link, `<h1>{tournament.name}</h1>`, the `notFound()` gate, the static `metadata` (do not switch to `generateMetadata` — the 2.4 story's rationale for avoiding an admin-data read ahead of the layout's auth gate still applies).

**`src/app/admin/page.tsx`** (Story 2.4)
- *Current:* two links — "Створити турнір" (`/admin/tournaments/new`), "Керування адмінами" (`/admin/people`).
- *Change:* "Створити турнір" → "Турніри" (`/admin/tournaments`).
- *Must preserve:* the `mx-auto w-full max-w-2xl px-4 py-8` shell, `metadata`, the "Керування адмінами" link.

**`prisma/schema.prisma`** — unchanged. The cascade FKs this story relies on (`Tournament → Group`, `Tournament → TournamentEntry`, `TournamentEntry → Player`, all `onDelete: Cascade`) already landed in Story 2.1/2.4.

### Testing requirements

- **Unit (Vitest):** none new — this story adds no `src/domain` code. `pnpm test` must still show the existing 2 files / 39 tests unchanged.
- **Not unit-tested (no infra, same class as `createTournament` / `transitionTournament`):** `updateTournament` (the `requireAdmin` gate, the `DRAFT`-lock substitution, the `P2002`/`P2025` catches) and `deleteTournament` (the `requireAdmin` gate, the `P2025` catch, the cascade). Gate = `typecheck` + `lint` + a **script-based DB round-trip** (Task 10, extending the 2.4 precedent) + the **browser walkthrough** + code review.
- **Regression:** `pnpm test`, route table (`/admin/tournaments` added, rest unchanged), import-boundary greps clean, the existing `verify-tournament-create.mts` checks still pass (untouched behavior for plain create).
- Capture real command output + walkthrough notes in the Dev Agent Record.

### Previous story intelligence

**Story 2.4 (done, `d4077d9`):** established `createTournamentRecord` / `isUniqueViolation` / `TOURNAMENT_NATURAL_KEY_INDEX` in `src/data/tournaments.ts`; `createTournament` + `CreateTournamentState` in `src/actions/tournaments.ts`; the controlled-form pattern (`tournament-form.tsx`) with its `Field` wrapper and `bind()` helper — reuse both verbatim for the edit fields; `src/lib/tournament-labels.ts` (`TOURNAMENT_TYPE_LABELS`, `SCORING_PRESET_LABELS`) — reuse for the list page's type/state display; the `/admin/tournaments/[id]` stub — this story's primary edit target; the `@prisma/adapter-pg` P2002 shape discovery (`error.meta.driverAdapterError.cause.constraint.index`, not `error.meta.target`) — the same discriminated-shape approach likely applies to P2025's `meta`, verify live rather than assuming the classic shape. Two review-carried findings this story directly resolves: no admin tournament list; `createTournament` missing `revalidatePath`.

**Story 2.3 (done):** `src/domain/tournamentState.ts` (`LABELS`, `TournamentState`) — reused as-is for the state display; `getTournamentForAdmin` — reused for both the `[id]` page and inside `updateTournament`. Carried finding this story partially resolves: Prisma errors (there: from `setTournamentState`; here: from the new `updateTournamentRecord`/`deleteTournamentRecord`) escaping unmapped — `isRecordNotFound` closes it for the two new writers; `setTournamentState` itself is untouched (still open, tracked).

**Story 2.2 (done):** `notify` (`@/lib/notify`), `ConfirmDialog` (exact shape to reuse for `DeleteTournamentButton` — see the `admin-role-controls.tsx` `RevokeAdminButton` precedent, structurally identical to what `DeleteTournamentButton` needs), the `GrantAdminButton`/spinner pattern.

### Git intelligence

Recent: `d4077d9` (2.4 docs → done) ← `a6e7cbf` (2.4 review round 2) ← `a2ddc7e` (2.4 `/code-review` fixes) ← `f5f79e0` (2.4 → review) ← `fc51494` (2.4 Task 11). `src/actions/tournaments.ts` = `transitionTournament` + `createTournament`. `src/data/tournaments.ts` = `getTournamentForAdmin`, `countTournamentEntries`, `setTournamentState`, `createTournamentRecord`, `isUniqueViolation`, `TOURNAMENT_NATURAL_KEY_INDEX`. `src/components/` has `tournament-form.tsx` (create-only), `confirm-dialog.tsx`, `admin-role-controls.tsx` (the `ConfirmDialog`-driven destructive-action precedent). `src/app/admin/tournaments/` has `new/page.tsx` and `[id]/page.tsx` (stub) — no `page.tsx` at the `tournaments/` level itself (this story adds it). `.claude/` + `_bmad/` are git-ignored.

### Latest tech information

- No new library. Same React 19.2 `useActionState` / controlled-form pattern as Story 2.4 — see that story's "Latest tech information" for the `defaultValue`-vs-controlled-state trap (already solved, being extended here, not re-solved).
- **`router.refresh()`** (`next/navigation`, Client Component) — re-runs the nearest Server Component data fetch without a full reload or losing client state elsewhere on the page; used identically in `admin-role-controls.tsx`'s non-self `revoke()` path. Combined with a `key` on `<TournamentForm>` (`tournament.updatedAt.getTime()`) to force the controlled form to re-seed from the freshly revalidated `initial` prop after a successful edit.
- **Prisma 7 / `@prisma/adapter-pg`** — `db.tournament.delete()` on a row with cascading children issues the cascade at the Postgres FK level (`onDelete: Cascade`), not via Prisma-side multi-query emulation, so it is atomic. `P2025` ("Record to update/delete not found") is the code for a missing row on both `update` and `delete` — confirm its `meta` shape live (per the Story 2.4 P2002 discovery) rather than assuming parity with the classic shape.

### Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 2.5 AC + Epic 2 intro), `glossary.md` (same terms as 2.4 — "Тип турніру", "Система очок", "Стан турніру"), `SPEC.md` (CAP-2 "адмін … редагує та видаляє його"; Constraints — admin-only mutation, server-side auth, archive durability language informing the delete-restriction decision), `ARCHITECTURE-SPINE.md` (AD-1, AD-3, AD-6, AD-8, AD-9, AD-11, Consistency Conventions), `DESIGN.md` (same form primitives, `destructive` button), `EXPERIENCE.md` (IA — `/admin/tournaments/[t]` "Ведення"; §Interaction Primitives — confirm dialogs, synchronous edits with revalidation; §Voice), `2-4-create-tournament.md` (the form/action/data patterns this story extends), `2-3-tournament-state-machine.md` (`getTournamentForAdmin`, `LABELS`, the Prisma-error-mapping carried finding), `deferred-work.md` (the two 2.4-review items this story resolves, the soft-delete question this story explicitly declines to resolve).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5: Редагувати й видалити турнір] — user story + AC (edit name/year/rules; group-stage params DRAFT-only; delete via ConfirmDialog, cascades entries/rosters)
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#CAP-2, #Constraints] — "адмін … редагує та видаляє [турнір]"; admin-only mutation, server-side auth; archive durability language
- [Source: …/ARCHITECTURE-SPINE.md#AD-6, #AD-8, #AD-9, #AD-11, #Consistency Conventions] — Server Action + requireAdmin; state via transitions only; CLASSIC filter; src/data sole Prisma owner; revalidatePath after every write
- [Source: …/EXPERIENCE.md#Information Architecture, #Interaction Primitives, #Voice and Tone] — `/admin/tournaments/[t]` single management route; confirm-dialog + synchronous-edit patterns; verb buttons
- [Source: _bmad-output/implementation-artifacts/2-4-create-tournament.md] — the form/action/data patterns, the P2002-shape discovery, the two review findings this story resolves
- [Source: _bmad-output/implementation-artifacts/2-3-tournament-state-machine.md] — `getTournamentForAdmin`, `LABELS`, the Prisma-error-mapping carried finding
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 2-4-create-tournament, #Deferred from: code review of 2-3-tournament-state-machine, #Deferred from: code review of 2-1-tournament-team-player-schema] — admin list / revalidatePath / P2025 / soft-delete items
- [Source: src/components/admin-role-controls.tsx · src/components/confirm-dialog.tsx · src/app/admin/people/page.tsx] — the `ConfirmDialog`-driven destructive-action pattern and the admin-list-page shape to match

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-04 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
