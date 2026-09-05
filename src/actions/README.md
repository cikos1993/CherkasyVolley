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
  (`DRAFT → GROUP_STAGE → PLAYOFF → COMPLETED`), each checking its preconditions.
  Never assign `state` directly.
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
  "Ця команда вже заявлена в цей турнір."; `removeTeamEntry` maps `P2025` to
  `NOT_FOUND` "Заявку вже видалено.". No new `ActionErrorCode` — both reuse
  `PRECONDITION_FAILED`/`NOT_FOUND` (Story 2.3).
