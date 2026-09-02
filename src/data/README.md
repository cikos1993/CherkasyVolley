# `src/data/` — persistence layer

The only place `@prisma/client` (and the generated client at `src/generated/prisma`)
may be imported. Every read and write of every entity goes through a named function
exported from here — `getPublicTournaments`, `saveMatchResult`, and so on. There is
one owner and one writer per entity.

**May import:** the Prisma client, generated schema types, and pure `src/domain`
functions for read-time computation (e.g. `getStandings()` runs `computeStandings`
over `Match` + `SetScore`). The domain is pure and imports nothing, so there is no
cycle.

**Must not import:** `src/actions`, `src/auth`, `src/app`, `src/components`.

Rules that live here:

- Public-read queries always filter `state != DRAFT`. Queries that include drafts
  are separate functions, called only from under `requireAdmin()`.
- The group standings table and final placements are **not** stored — `getStandings()`
  computes them on read from `Match` + `SetScore` via `src/domain`. No cache, no
  materialized rows.
- Callers get named functions, never a raw `PrismaClient`.

Enforced by `eslint.config.mjs`: the `@prisma/client` ban everywhere outside this
directory, plus a block keeping this directory from importing higher layers.
