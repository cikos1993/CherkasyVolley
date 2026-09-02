# `src/` — layer map and dependency direction

Functional core / imperative shell over a single full-stack Next.js app.

| Layer | Directory | Contains | May import |
| --- | --- | --- | --- |
| View | `app/`, `components/`, `lib/` | Server/Client Components, presentation only | shell, data (reads only) |
| Shell | `actions/` | Server Actions: authorize → read → call core → write | domain, data, auth |
| Domain | `domain/` | Pure functions: scoring, tiebreak, bracket, schedule, validation | nothing internal |
| Data | `data/` | Prisma client + queries; the sole owner and writer of every entity | Prisma + schema types |
| Auth | `auth/` | Better Auth config, `requireAdmin()` | data |

## Dependency direction

```
view  →  shell  →  { domain, data }
auth  →  data
```

Forbidden edges:

- `domain → *` — the domain imports nothing internal, no framework, no IO.
- `data → { actions, auth, view }` — data depends on Prisma, the generated schema
  types, and (only for read-time computation) pure `domain` functions. It never
  reaches up into the shell, auth, or view.
- `view → data` for **writes** — the view reads through `data`; every mutation goes through a Server Action in `actions/`.

## What enforces this

`eslint.config.mjs` carries scoped blocks that make the load-bearing subset a lint **error**:

- `src/domain/**` must not import `next`, `@prisma/client`, `react`, or any other `src/` layer.
- `@prisma/client` may be imported only under `src/data/**`; everywhere else, call a named function from `src/data`.
- `src/data/**` must not import `actions`, `auth`, or the view layer (`app`, `components`).

The rest of the direction table is convention — keep to it.

## Core invariants that shape these layers

- Every data mutation is a Server Action whose first line is `await requireAdmin()`.
- Public reads bypass the role check and always filter `state != DRAFT`.
- `Tournament.state` changes only through explicit transition Server Actions with precondition checks.
- The group standings table and playoff placements are never stored — they are computed on read from `Match` + `SetScore`.
- Schema changes only via Prisma migrations; the first admin and reference data only via the seed script; secrets only via env.
