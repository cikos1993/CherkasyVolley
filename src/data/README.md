# `src/data/` — persistence layer

The only place in `src/` where the generated Prisma client
(`@/generated/prisma/client`) may be imported. Every read and write of every entity
goes through a named function exported from here — `getPublicTournaments`,
`saveMatchResult`, and so on. There is one owner and one writer per entity.

## Modules

- `users.ts` — `listAuthenticatedUsers()` (users with ≥1 `account` row, i.e. who
  have completed Google sign-in at least once; `session` rows expire, so account
  presence is the durable signal), `countAdmins()`, and the sole writers of
  `User.isAdmin`: `promoteToAdmin(id)` and `demoteFromAdmin(id)` (transactional —
  refuses to clear the last admin). Both return `{ outcome: "ok" | "not_found" |
  "last_admin" }` and are called only from `grantAdmin` / `revokeAdmin` under
  `requireAdmin()`.

The `Tournament`, `Team`, `TournamentEntry` and `Player` entities (schema landed in
Story 2.1, migration `20260903174727_tournament_schema`) are owned here too; their
query/write functions arrive with the feature stories (create → 2.4, team directory
→ 2.6, entries → 2.7, players → 2.8). Two query flavours per read:

- **public** — filter `state != DRAFT` **and** `discipline = CLASSIC` (AD-7, AD-9).
  Called from Server Components, no auth.
- **admin** — includes drafts; a separate function, called only from under
  `requireAdmin()`.

`Tournament.state` is written only by `transitionTournament` (Story 2.3 / AD-8),
never assigned. Standings and playoff placements are **never** stored (AD-4) —
there is deliberately no such column.

**May import:** the Prisma client and generated schema types. `client.ts` constructs
the single shared `PrismaClient` instance (`@prisma/adapter-pg` over the pooled
`DATABASE_URL`) and exports it as `db`; `src/auth` imports `db` from here for Better
Auth's adapter and never imports the Prisma client directly.

**Sanctioned exception to AD-11:** the build/CLI scripts `prisma/seed.mts` and
`prisma7.config.ts` construct their own client (direct/unpooled URL, own lifecycle);
the diagnostic script `scripts/db-check.mts` imports the shared `db` (and the
generated enums) directly for a live smoke check. None are application code and none
sit under `src/`, so the ESLint boundary blocks do not scope them — intentional, not
a gap. No file **inside `src/`** outside `src/data/` may import the client, and the
"reads/writes go through a named `src/data` function" convention likewise does not
bind the CLI scripts.

**Must not import:** `src/actions`, `src/auth`, `src/app`, `src/components`, `next`,
`react`.

**Open item — `src/domain`:** `getStandings()` is specified (`epics.md` Story 3.2) to
compute the table from `Match` + `SetScore` via `src/domain`. AD-3 as written forbids
`data → domain`; this tension is unresolved (see `src/README.md`). The lint does not
block it; use it for pure read-time computation only.

Rules that live here:

- Public-read queries always filter `state != DRAFT`. Queries that include drafts
  are separate functions, called only from under `requireAdmin()`.
- The group standings table and final placements are **not** stored — computed on
  read from `Match` + `SetScore`. No cache, no materialized rows.
- Callers get named functions, never a raw `PrismaClient`.

Enforced by `eslint.config.mjs`: the Prisma-client ban everywhere outside this
directory, and a block keeping this directory from importing higher layers or the
framework.
