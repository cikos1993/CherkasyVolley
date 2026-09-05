---
baseline_commit: 2c6517e
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - _bmad-output/specs/spec-cherkasy-volley/glossary.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/implementation-artifacts/2-1-tournament-team-player-schema.md
  - _bmad-output/implementation-artifacts/2-4-create-tournament.md
  - _bmad-output/implementation-artifacts/2-5-edit-delete-tournament.md
  - _bmad-output/implementation-artifacts/2-6-team-directory.md
  - _bmad-output/implementation-artifacts/2-7-enroll-remove-team.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - AGENTS.md
---

# Story 2.8: Team roster — players

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to maintain the list of players on a team's entry,
so that the tournament has roster data (FR-10).

## Acceptance Criteria

Translated from `epics.md` → Epic 2 → Story 2.8. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** a team's entry in a tournament, I am an admin
**When** I add a player, specifying only the full name
**Then**

1. The player is saved.
2. Optional fields (date of birth, place of birth, sport rank, position, height, weight) are saved when filled, and not shown when empty.
3. The system does not forbid the same full name across different entries.
4. A player can be edited and deleted.

### Notes on AC interpretation

- **No tournament-state restriction on player CRUD — a deliberate contrast with Story 2.7.** FR-10's own wording ("Адмін додає/редагує/видаляє Гравця у Складі…") names no state gate, unlike FR-9's explicit "після Жеребкування заявити нову Команду не можна" that grounded Story 2.7's `DRAFT`-only lock. **Decision: add/edit/delete a player in any tournament state.** A roster correction (a birth date typo, a late-joining player) is a data-quality concern independent of match/draw state, and the AC gives no reason to couple it to `Tournament.state`. No `src/domain` precondition module is needed for this story — a deliberate absence, not an oversight (contrast Story 2.7's `teamEnrollment.ts`).
- **New admin route: `/admin/tournaments/[id]/entries/[entryId]`.** Story 2.7's "Команди" section lists entries but has no room for full 7-field roster CRUD (potentially a dozen-plus players per team) without overloading the tournament management page. EXPERIENCE.md's public IA already establishes the precedent of a dedicated roster sub-route (`/classic/[tournament]/teams/[team]` — "Склад команди"); this story's admin equivalent is `/admin/tournaments/[id]/entries/[entryId]`, keyed by the entry's own id (not `teamId`) since `Player` belongs to `TournamentEntry`, not `Team`, directly. Story 2.7's `team-enrollment.tsx` gets a "Склад" link per entry row pointing here.
- **Scope every read/write by `(tournamentId, entryId)` together, never `entryId` alone — a direct, deliberate application of the Story 2.7 code-review finding.** That review found `removeTeamEntry` deleting by `entryId` alone let a mismatched `tournamentId` cancel an entry belonging to a *different* tournament. This story's admin route takes both ids from the URL (`/admin/tournaments/[id]/entries/[entryId]`) and **every** data access — the page's own entry lookup, `updatePlayer`, `deletePlayer` — must verify the entry actually belongs to that tournament, not just that the entry exists. `getEntryForAdmin(tournamentId, entryId)` (new, in `src/data/entries.ts`) is the single scoped lookup the page and every action call first.
- **`birthDate` stays a free-text `String?`, not a date input.** Story 2.1 already decided this ("optional free-text `String?` … not a real date type") — this story's form uses a plain text `Input` for it, same as every other optional field, not `<input type="date">`.
- **One `PlayerForm` component, `mode: "create" | "edit"` — the `TournamentForm`/`TeamForm` precedent, not a new pattern.** Same reasoning Story 2.4/2.5 established: one component, a `mode` prop, a bound action per mode, avoids duplicating the 7-field layout.
- **AC 3 ("не забороняє однакове ПІБ") needs no code — it's an absence, already true.** There is no unique constraint on `Player.fullName` (schema unchanged since Story 2.1: `@@index([entryId])` only) and this story adds none. Worth stating explicitly so a future reader doesn't "fix" a duplicate name as a bug.

## Tasks / Subtasks

- [x] **Task 1 — `src/domain/playerForm.ts` (NEW) + Vitest spec** (AC: 1, 2, 3)
  - [x] Pure module. `FULL_NAME_MAX = 120`; `FREE_TEXT_MAX = 60` for the six optional fields.
  - [x] `PlayerInput` — `null` is the "empty" sentinel for optional fields.
  - [x] `PlayerField = keyof PlayerInput`; `FieldErrors = Partial<Record<PlayerField, string>>`.
  - [x] `validatePlayer(raw)` — trims every field; collects every failing field at once.
  - [x] `src/domain/playerForm.test.ts` — 9 tests: all-filled, name-only (others null), whitespace-only optional → null, exact-max accepted, empty/whitespace `fullName` rejected (message content asserted), over-max `fullName` (message content asserted), each optional field over max independently, multi-error, Ukrainian message assertion.
  - [x] `pnpm test` → 5 files, 68/68.
- [x] **Task 2 — `src/data/entries.ts` (UPDATE): `getEntryForAdmin`** (AC: 1, 2, 3, 4)
  - [x] `getEntryForAdmin(tournamentId, entryId)` — scoped `findFirst`, returns `null` when the ids don't pair up. `typecheck`/`lint` clean.
- [ ] **Task 3 — `src/data/players.ts` (NEW)** (AC: 1, 2, 3, 4)
  - [ ] `listPlayersForEntry(entryId: string)` — `db.player.findMany({ where: { entryId }, orderBy: { fullName: "asc" } })`.
  - [ ] `createPlayer(entryId: string, input: PlayerInput): Promise<{ id: string }>` — **the sole creator** — `db.player.create({ data: { entryId, ...input }, select: { id: true } })`.
  - [ ] `updatePlayer(entryId: string, playerId: string, input: PlayerInput)` — **the sole updater**, scoped by both ids (Task 2's lesson, applied here too): `db.player.updateMany({ where: { id: playerId, entryId }, data: input })`. Returns `{ count }`.
  - [ ] `deletePlayer(entryId: string, playerId: string)` — **the sole deleter**, same scoping: `db.player.deleteMany({ where: { id: playerId, entryId } })`. Returns `{ count }`.
- [ ] **Task 4 — `src/actions/players.ts` (NEW): `addPlayer` / `editPlayer` / `removePlayer`** (AC: 1, 2, 3, 4)
  - [ ] `export type PlayerFormState = { fieldErrors?: Partial<Record<PlayerField, string>>; formError?: string };`
  - [ ] `addPlayer(tournamentId: string, entryId: string, _prev: PlayerFormState, formData: FormData): Promise<PlayerFormState>` — `requireAdmin()` → `getEntryForAdmin(tournamentId, entryId)` (not found → `formError` "Заявку не знайдено.") → `validatePlayer(raw)` (from `formData`) → `!ok` → `{ fieldErrors }` → `createPlayer(entryId, value)` → `revalidatePath(\`/admin/tournaments/${tournamentId}/entries/${entryId}\`)` → `{}` (no redirect — stays on the roster page, list updates in place, the `createTeam`/Story 2.6 pattern).
  - [ ] `editPlayer(tournamentId: string, entryId: string, playerId: string, _prev: PlayerFormState, formData: FormData): Promise<PlayerFormState>` — same shape, bound via `.bind(null, tournamentId, entryId, playerId)` in the form: `requireAdmin()` → `getEntryForAdmin` (not found → `formError`) → `validatePlayer` → `!ok` → `{ fieldErrors }` → `updatePlayer(entryId, playerId, value)` (`count === 0` → `formError` "Гравця не знайдено.") → `revalidatePath` → `{}`.
  - [ ] `removePlayer(tournamentId: string, entryId: string, playerId: string): Promise<ActionResult<undefined>>` — `requireAdmin()` → `getEntryForAdmin` (not found → `NOT_FOUND`) → `deletePlayer(entryId, playerId)` (`count === 0` → `NOT_FOUND` "Гравця вже видалено.") → `revalidatePath` → `{ ok: true }`.
  - [ ] Imports: `requireAdmin` (`@/auth/requireAdmin`), `getEntryForAdmin` (`@/data/entries`), `listPlayersForEntry`/`createPlayer`/`updatePlayer`/`deletePlayer` (`@/data/players`), `validatePlayer`/`PlayerField` (`@/domain/playerForm`), `toActionError`/`ActionResult` (`@/actions/result`), `revalidatePath` (`next/cache`). No new `ActionErrorCode` — `removePlayer` reuses `NOT_FOUND` (Story 2.3).
- [ ] **Task 5 — `src/components/player-form.tsx` (NEW, Client Component)** (AC: 1, 2, 3, 4)
  - [ ] `mode: "create" | "edit"` (discriminated union props, the Story 2.5-review-fixed `TournamentFormProps` shape — no `!`-asserted required-in-one-branch prop this time). Create: `{ mode?: "create"; tournamentId; entryId }`. Edit: `{ mode: "edit"; tournamentId; entryId; playerId; initial: PlayerFormValues; onCancel: () => void }` (edit needs a way to close back to the read view — `create` doesn't).
  - [ ] `useActionState(mode === "edit" ? editPlayer.bind(null, tournamentId, entryId, playerId) : addPlayer.bind(null, tournamentId, entryId), {})`. Seven controlled fields (`fullName` + 6 optional), the same UX-DR11 controlled-state rationale as every prior form in this codebase (`tournament-form.tsx`, `team-form.tsx`).
  - [ ] `formError` → `notify.error` (the established `useEffect` pattern). Success (falling edge of `pending`, no errors — the `tournament-form.tsx` edit-mode / `team-form.tsx` technique): create mode clears all fields + `notify.success("Гравця додано")` + `router.refresh()`; edit mode calls `onCancel()` (closes the edit form back to the read row) + `notify.success("Зміни збережено")` + `router.refresh()`.
  - [ ] Submit label: "Додати гравця" (create) / "Зберегти" (edit). Edit mode also renders a "Скасувати" button calling `onCancel()` directly (no confirmation needed — canceling an edit discards nothing already saved).
- [ ] **Task 6 — `src/components/roster.tsx` (NEW, Client Component)** (AC: 2, 4)
  - [ ] Props: `{ tournamentId: string; entryId: string; players: Player[] }` (`Player` = the full Prisma row shape from `listPlayersForEntry`).
  - [ ] Local state: `editingPlayerId: string | null`. Each player renders as a read-only row **unless** `editingPlayerId === player.id`, in which case it renders `<PlayerForm mode="edit" ... onCancel={() => setEditingPlayerId(null)} />` instead.
  - [ ] **Read row** — `fullName` plus each optional field rendered as `label: value` **only when non-null** (AC 2's "не показуються, якщо порожні" — the read view, not the form, hides empty fields), a "Редагувати" button (sets `editingPlayerId`), and a `ConfirmDialog`-gated "Видалити" button (title "Видалити гравця?", description naming `fullName`, `confirmLabel="Видалити"`, `destructive`) calling `removePlayer`, same shape as `DeleteTournamentButton`/`TeamEnrollment`'s remove — **including the `try`/`catch` around the confirm call** (the Story 2.7 review's `enroll()` fix — don't reintroduce the gap it just closed).
  - [ ] Empty list (`players.length === 0`): a plain paragraph — `Ще немає гравців у складі.` (no existing `empty-states.ts` constant fits; don't force one, matching the `/admin/teams` and `/admin/tournaments` list precedents).
  - [ ] Always renders `<PlayerForm mode="create" tournamentId={tournamentId} entryId={entryId} />` below the list (add-another stays available regardless of list state).
- [ ] **Task 7 — `src/app/admin/tournaments/[id]/entries/[entryId]/page.tsx` (NEW)** (AC: 1, 2, 3, 4)
  - [ ] Server Component. `const { id, entryId } = await params;` → `Promise.all([getEntryForAdmin(id, entryId), listPlayersForEntry(entryId)])` → `if (!entry) notFound()` (catches both "entry doesn't exist" and "entry belongs to a different tournament").
  - [ ] Back-link to `/admin/tournaments/${id}`, `<h1>{entry.team.name}</h1>`, a `<p>` naming this as the roster ("Склад команди"), `<Roster tournamentId={id} entryId={entryId} players={players} />`.
  - [ ] `export const metadata = { title: "Склад команди" }` (static — the `/admin/tournaments/[id]` stub's rationale for not reading admin data ahead of the layout's auth gate applies identically here).
- [ ] **Task 8 — `src/components/team-enrollment.tsx` (UPDATE): link to the roster page** (AC: reachability)
  - [ ] Each entry row gets a "Склад" link (`<Link href={\`/admin/tournaments/${tournamentId}/entries/${entry.id}\`}>`) alongside the team name, **regardless of tournament state** (AC-interpretation: roster management isn't `DRAFT`-gated, unlike the "Зняти" button which still only renders in `DRAFT`).
  - [ ] No other change to `team-enrollment.tsx` — its own enroll/remove logic (and the Story 2.7 review fixes already in it) stay untouched.
- [ ] **Task 9 — Docs**
  - [ ] `src/domain/README.md` — `playerForm.ts` entry.
  - [ ] `src/data/README.md` — `entries.ts`'s entry gains `getEntryForAdmin`; new `players.ts` entry.
  - [ ] `src/actions/README.md` — `players.ts` entry.
  - [ ] `src/components/README.md` — `player-form.tsx` + `roster.tsx` entries.
  - [ ] `AGENTS.md` — Stack-status bullet for Story 2.8.
  - [ ] No `ARCHITECTURE-SPINE.md` / `EXPERIENCE.md` / `epics.md` / `SPEC.md` edit — the new route extends the documented `/admin/tournaments/**` prefix; no new invariant.
- [ ] **Task 10 — `deferred-work.md` (UPDATE)**
  - [ ] Add a **"Story 2.8 implementation"** section: `addPlayer`/`editPlayer`/`removePlayer` have no automated action-level test (same class as every prior action); `player-form.tsx`/`roster.tsx` untested at the component layer; no roster-size cap (SPEC gives none, not required); no public roster read yet (`listPlayersForEntry` is admin-only in this story — Story 2.9's decision).
- [ ] **Task 11 — Verification gate** (AC: all)
  - [ ] `pnpm test` (existing 4 domain files + the new `playerForm.test.ts`) · `pnpm typecheck` · `pnpm lint` · `pnpm build` clean.
  - [ ] Route table — `/admin/tournaments/[id]/entries/[entryId]` (NEW, `ƒ`) added; rest unchanged.
  - [ ] Import-boundary greps: no new Prisma import site outside `src/data/**`; `src/domain/**` free of `next`/`react`.
  - [ ] `scripts/verify-roster.mts` (NEW, self-cleaning, same style as the prior verify scripts): create a throwaway tournament + team + entry → `createPlayer` with only `fullName` → assert all optional fields are `null` and not just missing → `createPlayer` a second player with every field filled → assert stored verbatim → `updatePlayer` the first player's `sportRank` → assert it updated and other fields untouched → **assert `updatePlayer`/`deletePlayer` scoped to a *different*, throwaway entry's id return `{ count: 0 }` and change nothing** (the direct regression test for the Story 2.7 lesson this story applies) → `deletePlayer` one player → assert gone, the other survives → delete the tournament (cascades team? no — cascades entry+players; delete the team separately) and confirm nothing orphaned.
  - [ ] **Browser walkthrough — expect not run** (no automated Google OAuth in this environment, the same residual gap carried since Story 2.4). Coverage instead: `typecheck`/`lint`/`build` + the verify script (the real AC-1/AC-2/AC-4 check) + code review.
  - [ ] Capture real command output + notes in the Dev Agent Record.
- [ ] **Task 12 — Commit(s)** — one commit + `git push origin main` per completed task. `build` gated each.

## Dev Notes

### What this story is / is NOT

**Is:** full CRUD for `Player` rows scoped to one `TournamentEntry` — add (name required, 6 optional fields), edit (same 7 fields), delete (`ConfirmDialog`), on a new `/admin/tournaments/[id]/entries/[entryId]` page linked from Story 2.7's "Команди" section. Every read/write scoped by `(tournamentId, entryId)` together.

**Is NOT** (do not pull forward):
- **Any tournament-state restriction on player CRUD** — explicitly decided against (see AC-interpretation notes).
- **The public roster page** (`/classic/[tournament]/teams/[team]`) → **Story 2.9**. `listPlayersForEntry` is admin-only in this story.
- **Any change to `Team` or `TournamentEntry` themselves** — this story only adds `Player` CRUD; entry enrollment/cancellation (Story 2.7) is untouched.
- **A roster size cap** — SPEC specifies none; not built.
- **`birthDate` as a real date type** — stays `String?`, decided in Story 2.1.

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/domain/playerForm.ts` | NEW | Pure. `validatePlayer`, `FULL_NAME_MAX`, `FREE_TEXT_MAX`. |
| `src/domain/playerForm.test.ts` | NEW | Vitest — valid/partial input, every bound, multi-error, message content. |
| `src/data/entries.ts` | UPDATE | + `getEntryForAdmin(tournamentId, entryId)`. |
| `src/data/players.ts` | NEW | `listPlayersForEntry`, `createPlayer`, `updatePlayer`, `deletePlayer` — all scoped by `(entryId, playerId)` where applicable. |
| `src/actions/players.ts` | NEW | `addPlayer`, `editPlayer`, `removePlayer`. |
| `src/components/player-form.tsx` | NEW | `mode: "create" \| "edit"`, discriminated union props. |
| `src/components/roster.tsx` | NEW | Read rows + inline edit-swap + add form. |
| `src/app/admin/tournaments/[id]/entries/[entryId]/page.tsx` | NEW | Roster page. |
| `src/components/team-enrollment.tsx` | UPDATE | + "Склад" link per entry row. |
| `scripts/verify-roster.mts` | NEW | Self-cleaning DB round-trip, includes the cross-entry-scoping regression check. |
| `src/{domain,data,actions,components}/README.md` · `AGENTS.md` · `deferred-work.md` | UPDATE | Module entries, Stack status, new deferred section. |
| `prisma/schema.prisma` | DO NOT TOUCH | `Player` already fully modeled (Story 2.1) — no migration this story. |
| `src/actions/result.ts` | DO NOT TOUCH | `removePlayer` reuses the existing `NOT_FOUND` code. |
| `src/lib/empty-states.ts` | DO NOT TOUCH | No constant fits "no players yet"; a plain paragraph is used instead, matching precedent. |

### Architecture compliance

- **AD-1 / layers** — `player-form.tsx`/`roster.tsx`/the page are View; `addPlayer`/`editPlayer`/`removePlayer` are Shell; `listPlayersForEntry`/`createPlayer`/`updatePlayer`/`deletePlayer`/`getEntryForAdmin` are Data; `validatePlayer` is Domain (pure). [ARCHITECTURE-SPINE.md#Design Paradigm]
- **AD-3 — dependency direction.** `view → shell` (`player-form.tsx` → `@/actions/players`), `shell → domain` (`addPlayer`/`editPlayer` → `@/domain/playerForm`), `shell → data` (→ `@/data/players`, `@/data/entries`), `data → domain` (`createPlayer`/`updatePlayer` take the `PlayerInput` type from `src/domain/playerForm` — a type-only import, the same sanctioned edge `createTeamRecord`/`createTournamentRecord` already established, Story 2.4).
- **AD-6 — every mutation is a Server Action under `requireAdmin()`.** All three actions call it first. [ARCHITECTURE-SPINE.md#AD-6]
- **AD-11 — `src/data` is the sole Prisma owner.** All new Prisma access lives in `src/data/players.ts` (+ the `entries.ts` addition); the domain module and actions never import Prisma. [ARCHITECTURE-SPINE.md#AD-11]
- **Consistency Conventions** — verb-named actions (`addPlayer`, `editPlayer`, `removePlayer`); `revalidatePath` after every write; `ConfirmDialog` for the destructive action; UA-only copy. [ARCHITECTURE-SPINE.md#Consistency Conventions]
- **EXPERIENCE.md** — the public `/classic/[tournament]/teams/[team]` route is the precedent this story's admin route structurally mirrors (different tree, same "one team's roster, one page" shape); §Voice (verb buttons: "Додати гравця", "Зберегти", "Видалити"); §Interaction Primitives (`ConfirmDialog` for the destructive action, synchronous edits with revalidation). [EXPERIENCE.md]
- **DESIGN.md** — same `Input`/`Label`/`Button` primitives as every prior admin form; no new components. [DESIGN.md#Components]

### Existing code being modified — current state → change → what must be preserved

**`src/data/entries.ts`** (Story 2.7, code-review-fixed)
- *Current:* `listEntriesForTournament`, `countTournamentEntries`, `createEntry`, `deleteEntry(tournamentId, entryId)` (scoped via `deleteMany`, the Story 2.7 review fix), `TOURNAMENT_ENTRY_NATURAL_KEY_INDEX`.
- *Change:* add `getEntryForAdmin(tournamentId, entryId)` — a scoped single-entry read, same `(tournamentId, entryId)`-together discipline `deleteEntry` already established.
- *Must preserve:* `deleteEntry`'s existing scoped-delete behavior verbatim — this story does not touch it.

**`src/components/team-enrollment.tsx`** (Story 2.7, code-review-fixed)
- *Current:* enroll picker (`useTransition`, `try`/`catch`-wrapped since the review fix) + entries list with `ConfirmDialog`-gated "Зняти" (`DRAFT`-only).
- *Change:* add a "Склад" link per entry row, unconditional on `state`.
- *Must preserve:* every existing behavior verbatim, including the review-fixed `try`/`catch` in `enroll()` and the stale-`selectedTeamId` guard (`effectiveTeamId`) — this story only adds a `<Link>`, touches no logic.

**`prisma/schema.prisma`** — unchanged. `Player`'s shape (`fullName` required, six optional `String?` fields, `entryId onDelete: Cascade`) already landed in Story 2.1.

### Testing requirements

- **Unit (Vitest):** `src/domain/playerForm.test.ts` — the deterministic core (required/optional field handling, every bound, multi-error, message content per the Story 2.7 review's lesson about weak content-free assertions).
- **Not unit-tested (no infra, same class as every prior action):** `addPlayer`/`editPlayer`/`removePlayer` themselves. Gate = `typecheck` + `lint` + the **DB round-trip script** (`verify-roster.mts`, which directly proves the `(entryId, playerId)` scoping this story is built around) + code review.
- **Regression:** `pnpm test` (5 files after this story), route table (`/admin/tournaments/[id]/entries/[entryId]` new `ƒ`, rest unchanged), import-boundary greps clean, all four prior verify scripts re-run unchanged.

### Previous story intelligence

**Story 2.7 (done, `2c6517e`):** the single most load-bearing lesson for this story — its code review found `removeTeamEntry` deleting a `TournamentEntry` by `entryId` alone, with no check that it belonged to the named `tournamentId`, letting a mismatched pair cancel an entry in the wrong tournament. Fixed via `deleteMany({ where: { id, tournamentId } })` returning `{ count }`. **This story's `updatePlayer`/`deletePlayer` apply the identical scoping discipline from the start** (`(entryId, playerId)` together), and `getEntryForAdmin(tournamentId, entryId)` extends the same discipline one level up (the page and every action verify the entry belongs to the tournament in the URL before doing anything else). Also reused: the `useTransition`+`try`/`catch` pattern for the delete button (`enroll()`'s missing catch was itself a review finding — don't repeat it), `ConfirmDialog`'s exact usage shape, and `TeamForm`'s clear-on-success / `router.refresh()` technique.

**Story 2.5 (done):** the `mode: "create" | "edit"` discriminated-union component pattern (`TournamentForm`, `TournamentFormProps`) — that story's own code review found and fixed a non-discriminated version of this exact prop shape (`tournamentId!` non-null assertion); `player-form.tsx` starts from the corrected shape directly, no such assertion needed here.

**Story 2.1 (done):** `Player`'s schema decisions this story builds on verbatim — `fullName` the only required field, six optional `String?` fields (including `birthDate` as free text, not a date type), `@@index([entryId])`, `onDelete: Cascade` from `TournamentEntry`, no dedup across entries (AC 3 needs no code).

### Git intelligence

Recent: `2c6517e` (2.7 code-review fixes) ← `c6aef62` (2.7 verification gate) ← `200846d` (2.7 deferred-work) ← `a418bbd` (2.7 docs) ← `716d2bd` (2.7 Команди section). `src/data/` = `client.ts`, `users.ts`, `errors.ts`, `tournaments.ts`, `teams.ts`, `entries.ts`, `README.md` — no `players.ts`. `src/actions/` = `result.ts`, `admin-roles.ts`, `tournaments.ts`, `teams.ts`, `entries.ts`, `README.md` — no `players.ts`. `src/domain/` = `README.md`, `tournamentState.ts`(+spec), `tournamentForm.ts`(+spec), `teamForm.ts`(+spec), `teamEnrollment.ts`(+spec) — no `playerForm.ts`. `src/components/` has `tournament-form.tsx`, `tournament-actions.tsx`, `team-form.tsx`, `team-enrollment.tsx`, `confirm-dialog.tsx`, `empty-state.tsx` — no `player-form.tsx`/`roster.tsx`. `src/app/admin/tournaments/[id]/` has only `page.tsx` — no `entries/` subdirectory. `.claude/` + `_bmad/` are git-ignored.

### Latest tech information

- No new library. Same React 19.2 `useActionState`/controlled-form pattern as every prior multi-field form; same `useTransition`+direct-call pattern as every prior single-action button.
- **Nested dynamic route params in Next 16** — `/admin/tournaments/[id]/entries/[entryId]/page.tsx` receives `params` as `Promise<{ id: string; entryId: string }>`; `const { id, entryId } = await params;`, same async-params convention already used by `/admin/tournaments/[id]/page.tsx`. **New-route `tsc` caveat carried since Story 2.4:** `PageProps<"/admin/tournaments/[id]/entries/[entryId]">` needs `.next/types`, which only exists after `next build` (or `next dev`) — run `pnpm build` before `pnpm typecheck` reports clean on this new route.

### Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 2.8 AC, FR-10), `glossary.md` ("Гравець", "Склад"), `SPEC.md` (CAP-4), `ARCHITECTURE-SPINE.md` (AD-1, AD-3, AD-6, AD-11, Consistency Conventions), `EXPERIENCE.md` (the public roster-route precedent, `ConfirmDialog`/synchronous-edit patterns, Voice), `2-1-tournament-team-player-schema.md` (`Player`'s exact schema and its "no dedup, free-text birthDate" decisions), `2-5-edit-delete-tournament.md` (the discriminated-union component-props fix this story's `PlayerForm` starts from), `2-7-enroll-remove-team.md` (the `(tournamentId, entryId)` scoping lesson this entire story is built around, the `try`/`catch`-on-delete lesson), `deferred-work.md` (nothing this story resolves — a fresh "Story 2.8 implementation" section instead).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.8: Склад команди — гравці] — user story + AC; FR-10
- [Source: _bmad-output/planning-artifacts/epics.md#FR-10] — "Адмін додає/редагує/видаляє Гравця у Складі; єдине обовʼязкове поле — ПІБ; решта полів опційні… унікальність гравців між Заявками система не контролює"
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#CAP-4] — team/roster capability
- [Source: _bmad-output/specs/spec-cherkasy-volley/glossary.md] — Гравець, Склад
- [Source: …/ARCHITECTURE-SPINE.md#AD-6, #AD-11, #Consistency Conventions] — Server Action + requireAdmin; src/data sole Prisma owner; revalidatePath after every write
- [Source: …/EXPERIENCE.md#Information Architecture] — `/classic/[tournament]/teams/[team]` — the public roster-route precedent
- [Source: _bmad-output/implementation-artifacts/2-1-tournament-team-player-schema.md] — `Player` schema, its free-text/no-dedup decisions
- [Source: _bmad-output/implementation-artifacts/2-5-edit-delete-tournament.md] — the discriminated-union component-props fix
- [Source: _bmad-output/implementation-artifacts/2-7-enroll-remove-team.md] — the `(tournamentId, entryId)` scoping lesson and the delete-button `try`/`catch` lesson
- [Source: src/components/team-enrollment.tsx · src/components/tournament-actions.tsx · src/components/confirm-dialog.tsx · src/app/admin/tournaments/[id]/page.tsx] — the exact patterns this story reuses

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-05 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
