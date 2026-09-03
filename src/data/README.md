# `src/data/` — persistence layer

The only place in `src/` where the generated Prisma client
(`@/generated/prisma/client`) may be imported. Every read and write of every entity
goes through a named function exported from here — `getPublicTournaments`,
`saveMatchResult`, and so on. There is one owner and one writer per entity.

**May import:** the Prisma client and generated schema types. `client.ts` constructs
the single shared `PrismaClient` instance (`@prisma/adapter-pg` over the pooled
`DATABASE_URL`) and exports it as `db`; `src/auth` imports `db` from here for Better
Auth's adapter and never imports the Prisma client directly.

**Sanctioned exception to AD-11:** the build/CLI scripts `prisma/seed.mts` and
`prisma7.config.ts` construct their own client (direct/unpooled URL, own lifecycle).
They live under `prisma/`, which the ESLint boundary blocks do not scope — this is
intentional (they are not application code), not a gap. No other file outside
`src/data/` may import the client.

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
