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

- `result.ts` — the shared `ActionResult<T>` type and `toActionError()`, which maps
  `AdminRequiredError` to `{ ok: false, code: "FORBIDDEN" }` and re-throws anything
  else (including `NEXT_REDIRECT`).
- `admin-ping.ts` — a Story 1.6 demo proving the server enforces the role
  independent of the UI. Story 1.7 removes it and adds the real grant/revoke actions.
