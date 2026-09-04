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
