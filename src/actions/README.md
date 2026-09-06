# `src/actions/` — imperative shell

Every data mutation in the app is a Server Action here. There is no other write path.

Each action follows the same shape:

```
await requireAdmin()   // first line, always — throws before any data access
const current = await getX(...)        // read via src/data
const next = computeSomething(current) // call src/domain
await saveX(next)                      // write via src/data
revalidatePath(...)                    // refresh affected pages
```

**May import:** `src/domain`, `src/data`, `src/auth`.

**Must not import:** the Prisma client directly — go through `src/data`. (Lint-enforced.)

Conventions below are manual-review, not lint-checked:

- `requireAdmin()` is the first statement of every action. Hiding a button is not
  access control; the server rejects the write.
- `Tournament.state` is changed only by explicit transition actions
  (`DRAFT → GROUP_STAGE → PLAYOFF → COMPLETED`), each checking its preconditions
  via `checkTransition` before writing through `setTournamentState`. Never assign
  `state` directly. `transitionTournament` is the generic transition action;
  `drawTournament` (Story 3.3) is the first **dedicated** one — it reuses
  `checkTransition` directly rather than nesting a call to `transitionTournament`,
  since the `DRAFT → GROUP_STAGE` transition also has to atomically seat entries
  and generate the match calendar.
- Actions return `{ ok: true, data }` or `{ ok: false, code, message }`.
- After every write, call `revalidatePath` / `revalidateTag` for the affected routes.

Actions are wired in their feature stories.

- `result.ts` — the shared `ActionResult<T>` / `ActionError` / `ActionErrorCode`
  types and `toActionError()`, which maps `AdminRequiredError` to
  `{ ok: false, code: "FORBIDDEN" }` and re-throws anything else (including
  `NEXT_REDIRECT`).
- `admin-roles.ts` — `grantAdmin(userId)` / `revokeAdmin(userId)`. First line
  `await requireAdmin()`; `revokeAdmin` refuses to clear the last admin
  (`code: "LAST_ADMIN"`), enforced in a `src/data` transaction, not the UI.
- `tournaments.ts` — `transitionTournament(id, targetState)`: `requireAdmin()` →
  `getTournamentForAdmin` → `checkTransition` (`src/domain/tournamentState`) →
  `setTournamentState`. The only path that changes `Tournament.state` (AD-8);
  an illegal edge or unmet precondition returns `{ ok: false, code }`.
  `createTournament(_prev, formData)` — a `useActionState` action:
  `requireAdmin()` → `validateNewTournament` (`src/domain/tournamentForm`) →
  `createTournamentRecord` → `redirect` to the new tournament page. Returns
  `CreateTournamentState` (`fieldErrors`, or `formError`) — not `ActionResult`;
  forms and `ActionResult` are different surfaces. The form keeps the user's
  input on a rejected submit via controlled state on its side, not by echoing
  values back through this type — see `src/components/README.md`.
  `updateTournament(tournamentId, _prev, formData)` — same `CreateTournamentState`
  shape, bound to a tournament id via `.bind(null, tournamentId)` in the form.
  `requireAdmin()` → `getTournamentForAdmin` (not found → `formError`) →
  `validateNewTournament`, substituting the tournament's **current**
  `teamCount`/`rounds` whenever `state !== "DRAFT"` (the fields the form
  disables outside `DRAFT` are re-enforced here, not just hidden client-side) →
  `updateTournamentRecord` (`P2002` → duplicate `formError`, `P2025` → not-found
  `formError`) → `revalidatePath` (`/admin/tournaments`, the tournament page,
  `/classic`) → `{}` on success (no redirect — edits stay on the same page,
  per EXPERIENCE.md's synchronous-edit pattern). `deleteTournament(tournamentId)`
  — `ActionResult<undefined>`, the `admin-roles.ts` shape: `requireAdmin()` →
  `deleteTournamentRecord` (cascades) → `revalidatePath` → `{ ok: true }`;
  `P2025` → `{ ok: false, code: "NOT_FOUND" }`.
- `teams.ts` — `createTeam(_prev, formData)`: `requireAdmin()` →
  `validateNewTeam` (`src/domain/teamForm`) → `createTeamRecord` →
  `revalidatePath("/admin/teams")` → `{}` (no redirect — the form stays on
  `/admin/teams`, the AC's "appears in the list"). Returns `TeamFormState`
  (`fieldErrors` / `formError`), the same shape family as `CreateTournamentState`.
  `P2002` (via `@/data/errors`'s `isUniqueViolation`) → "Команда з такою назвою
  вже існує.".
- `entries.ts` — `enrollTeam(tournamentId, teamId)` / `removeTeamEntry(tournamentId,
  entryId)`: `ActionResult<undefined>`, the `admin-roles.ts` shape (not
  `useActionState` — a single-value picker/button, not a multi-field form).
  Both: `requireAdmin()` → `getTournamentForAdmin` (not found → `NOT_FOUND`) →
  the matching pure precondition from `src/domain/teamEnrollment`
  (`checkCanEnroll` / `checkCanRemoveEntry`; not ok → `PRECONDITION_FAILED`) →
  the write (`createEntry` / `deleteEntry`) → `revalidatePath`. `enrollTeam`
  additionally maps a `P2002` (via `@/data/errors`'s `isUniqueViolation`) to
  "Ця команда вже заявлена в цей турнір."; `removeTeamEntry` scopes
  `deleteEntry` by `(tournamentId, entryId)` together and treats `count === 0`
  as `NOT_FOUND` "Заявку вже видалено." rather than catching `P2025` (Story
  2.7 fix — a mismatched pair must delete nothing, not the wrong tournament's
  entry). No new `ActionErrorCode` — both reuse `PRECONDITION_FAILED`/`NOT_FOUND`
  (Story 2.3).
- `players.ts` — `addPlayer(tournamentId, entryId, _prev, formData)` /
  `editPlayer(tournamentId, entryId, playerId, _prev, formData)`: the
  `PlayerFormState` (`fieldErrors`/`formError`) shape, the same family as
  `CreateTournamentState`/`TeamFormState`. Both: `requireAdmin()` (caught
  narrowly via `instanceof AdminRequiredError` → `formError`; anything else
  rethrows — no bare catch) → `getEntryForAdmin(tournamentId, entryId)` (not
  found → `formError`) → `validatePlayer` (`src/domain/playerForm`) → the
  write (`createPlayer` / `updatePlayer`) → `revalidatePath`. `editPlayer`
  scopes `updatePlayer` by `(entryId, playerId)` together and treats
  `count === 0` as a `formError` (same lesson as `entries.ts`'s Story 2.7
  fix, applied here from the start — see `src/data/README.md`).
  `removePlayer(tournamentId, entryId, playerId)` — `ActionResult<undefined>`,
  the `admin-roles.ts` shape: `requireAdmin()` → `getEntryForAdmin` (not
  found → `NOT_FOUND`) → `deletePlayer(entryId, playerId)` → `count === 0` →
  `NOT_FOUND` → `revalidatePath`. No state restriction (unlike `entries.ts`) —
  Story 2.8's AC leaves roster edits open regardless of `Tournament.state`.
- `draw.ts` — `drawTournament(tournamentId)` (Story 3.3): `ActionResult<undefined>`,
  the `admin-roles.ts` shape. `requireAdmin()` → `getTournamentForAdmin` (not
  found, or no `group` → `NOT_FOUND`) → `listEntriesForTournament` for the entry
  ids/count → `checkTransition(tournament.state, "GROUP_STAGE", { entryCount,
  teamCount })` (not ok → `{ ok: false, code, message }`) → shuffles the entry
  ids with `schedule.ts`'s exported `defaultShuffle` (review fix — without it,
  `listEntriesForTournament`'s alphabetical order would make the actual
  matchups, not just their listing, deterministic) → `generateSchedule`
  (`src/domain/schedule`) → `saveDraw` (`src/data/draw.ts`, one transaction:
  `GroupSlot` + `Match` rows + `setTournamentState`) → `revalidatePath`
  (including `/admin/tournaments`, the list page). The first dedicated
  (non-`transitionTournament`) transition action — see the note above.
  **`redrawTournament(tournamentId)` (Story 3.4)** — same `ActionResult<undefined>`
  shape, same file (same feature domain). `requireAdmin()` → `getTournamentForAdmin`
  (not found/no `group` → `NOT_FOUND`) → `hasAnyGroupResult` (`src/data/matches.ts`)
  → `checkCanRedraw(tournament.state, hasResults)` (`src/domain/redraw` — **not**
  `checkTransition`; `state` never changes on a redraw) → `listGroupEntryIds`
  (`src/data/draw.ts` — reads `GroupSlot`, never re-reads `TournamentEntry`) →
  `defaultShuffle` → `generateSchedule` → `saveRedraw` (deletes + recreates
  `GROUP`-stage `Match` rows in one transaction) → `revalidatePath` (discipline
  route + the tournament page only — **not** `/admin/tournaments`, since `state`
  is unchanged so the list page's display is already correct). Both `drawTournament`
  and `redrawTournament` also `revalidatePath(`/classic/${id}`)` (Story 3.5) — the
  public tournament page renders the match calendar on its Розклад tab.
- `playoff.ts` — `formPlayoff(tournamentId)` (Story 4.2): `ActionResult<{ needsManualSeed:
  boolean }>`, the `drawTournament` pattern for the `GROUP_STAGE → PLAYOFF` edge.
  `requireAdmin()` → `getTournamentForAdmin` (not found / no `group` → `NOT_FOUND`) →
  `allGroupMatchesPlayed` (`src/data/matches.ts`) → `checkTransition(tournament.state,
  "PLAYOFF", { allGroupMatchesPlayed })` (this one call is both AC gates — the edge
  *and* the "all matches played" precondition) → `getStandings` (guard
  `< PLAYOFF_QUALIFIERS` → `PRECONDITION_FAILED`) → `seedPlayoff` (`src/domain/bracket`)
  → `savePlayoffFormation` (`src/data/playoff.ts`, one transaction: two `SEMIFINAL`
  `Match` rows + `setTournamentState`, with in-tx re-checks) → `revalidatePath`
  (including `/admin/tournaments` and the public tournament page, which gains its
  «Плейоф» tab). Returns `needsManualSeed` so `FormPlayoffButton` can warn about a
  name-tiebreak seed. v1 has exactly one `Group` per tournament, so FR-19's
  "multi-group not supported" needs no branch. Dedicated action (not
  `transitionTournament`) — see the note above.
- `matches.ts` — `scheduleMatch(tournamentId, matchId, _prev, formData)` (Story 3.5):
  the `MatchScheduleFormState` (`fieldErrors`/`formError`) shape, the same family as
  `players.ts`'s form actions (a multi-field form, not `ActionResult`). `requireAdmin()`
  caught narrowly (`instanceof AdminRequiredError` → `formError`, else rethrow) →
  `getTournamentForAdmin` (not found → `formError`) → `validateMatchSchedule`
  (`src/domain/matchSchedule` — not ok → `fieldErrors`) → `updateMatchSchedule`
  (`count === 0` → not-found `formError`) → `revalidatePath`
  (`/admin/tournaments/${id}/schedule` **and** `/classic/${id}`). No `Tournament.state`
  gate — FR-13 says "будь-якого Матчу" and a match can't exist before the draw anyway
  (same "no state restriction" latitude as `players.ts`). The data reads the pages
  need stay imported from `@/data/matches` directly — a `"use server"` file exports
  only callable actions.
  **`enterMatchResult(tournamentId, matchId, _prev, formData)` (Story 3.6)** — the
  `MatchResultFormState` (`setErrors` / `formError`) shape. Narrow `requireAdmin()`
  catch → `getMatchForResult` (not found / not `GROUP` / already has a result →
  `formError`) → `parseSetsFromForm` (reads `home-N`/`away-N` into a contiguous
  set list; a gap or a non-integer half → `formError`/`setErrors`) →
  `validateMatchScore` (`src/domain/validation` — **the sole validator**; a
  `"Партія N: …"`-prefixed message is mapped back to `setErrors[N]`, anything else
  is a `formError`) → `createMatchResult` (`"exists"`/`"not_found"` →
  `formError`) → `revalidatePath` (the public tournament route, the admin schedule
  page, the match screen, and `/admin/tournaments/${id}` — the first result flips
  `hasAnyGroupResult`, which the redraw button reads). First-entry only; editing
  is `editMatchResult`.
  **`editMatchResult(tournamentId, matchId, _prev, formData)` / `removeMatchResult(tournamentId,
  matchId)` (Story 3.7)** — `editMatchResult` is `enterMatchResult`'s sibling for a
  match that **already** has a result (`sets.length === 0` → `formError`); same
  `parseAndValidate` (shared parse + `validateMatchScore` + `Партія N:` mapping)
  and `revalidateMatchSurfaces` (the shared 4-path helper), writing through
  `replaceMatchResult`. `removeMatchResult` is the `ActionResult<undefined>` shape
  (`removePlayer` template): `requireAdmin` → `getMatchForResult` (not found / not
  `GROUP` → `NOT_FOUND`) → `deleteMatchResult` (`count === 0` → `NOT_FOUND`
  "Результат уже видалено.") → `revalidateMatchSurfaces` → `{ ok: true }`. Neither
  has a `Tournament.state` guard (a `COMPLETED` lock is FR-7 / Story 4.5).
