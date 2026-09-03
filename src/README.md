# `src/` — layer map and dependency direction

Functional core / imperative shell over a single full-stack Next.js app. The
authoritative statement of these boundaries is `ARCHITECTURE-SPINE.md` (AD-2, AD-3,
AD-11); this file is the working copy for people editing `src/`.

| Layer | Directory | Contains | May import |
| --- | --- | --- | --- |
| View | `app/`, `components/`, `lib/` | Server/Client Components, presentation only. `lib/` = view utilities: `cn` (class-names), `auth-client` (Better Auth browser client) | shell, data (reads only), `lib/auth-client` |
| Shell | `actions/` | Server Actions: authorize → read → call core → write | domain, data, auth |
| Domain | `domain/` | Pure functions: scoring, tiebreak, bracket, schedule, validation | nothing internal |
| Data | `data/` | Prisma client + queries; the sole owner and writer of every entity | Prisma + schema types |
| Auth | `auth/` | Better Auth instance (`auth.ts`), `requireAdmin()` | data |

(Spine § Design Paradigm gives Shell's dependencies as `domain, data`; `auth` is
added here because AD-3's own graph shows `shell → auth`. `lib/` is grouped with
View per Story 1.3.)

**View ↔ auth (Story 1.5).** The view never imports `src/auth` directly. Client
Components read the session and sign in/out through `src/lib/auth-client.ts`
(`better-auth/react`, an HTTP client). The one exception is the transport endpoint
`src/app/api/auth/[...all]/route.ts`, which imports `@/auth/auth` — it is Better
Auth's HTTP handler, not a component (spine AD-1 note). `src/components/**` is
lint-blocked from importing `@/auth`.

## Dependency direction

```
view  →  shell  →  { domain, data }
auth  →  data
```

Forbidden edges:

- `domain → *` — the domain imports nothing internal, no framework, no IO.
- `data → { actions, auth, view }` and `data` never imports `next` / `react`.
- `view → data` for **writes** — the view reads through `data`; every mutation goes
  through a Server Action in `actions/`.

### Unreconciled: `data → domain` for read-time computation

AD-3 as written lists `data → domain` among the forbidden edges, and AD-5 says
`src/data` "не виводять учасників самостійно" for the bracket. But AD-4 requires the
standings table to be computed on read via `computeStandings(matches, rules)`, and
`epics.md` Story 3.2 places that computation in a `src/data` function
(`getStandings()` "через `src/domain`"). These conflict. Until Epic 3 resolves it
(a spine edit, or moving the computation into the read path per AD-5), the lint does
**not** block `data → domain`, and `src/data` may call pure `domain` functions for
read-time computation only. This is a known open item, not a settled decision.

## What ESLint enforces (a lint **error**)

- `src/domain/**` must not import `next`, the Prisma client (`@prisma/client` /
  `@/generated/prisma` / relative forms), `react`, or any other `src/` layer.
- The Prisma client may be imported only under `src/data/**`; everywhere else, call
  a named function from `src/data`. `src/auth` gets the shared client from `src/data`.
- `src/data/**` must not import `actions`, `auth`, the view layer, `next`, or `react`.
- `src/auth/**` may import only `src/data`.

## Manual-review invariants (not lint-checked)

- Every data mutation is a Server Action whose first line is `await requireAdmin()`.
- Public reads bypass the role check and always filter `state != DRAFT`.
- `Tournament.state` changes only through explicit transition Server Actions with
  precondition checks (see `ARCHITECTURE-SPINE.md` AD-8).
- The group standings table and playoff placements are never stored — computed on
  read from `Match` + `SetScore` (AD-4).
- Schema changes only via Prisma migrations; the first admin and reference data only
  via the seed script; secrets only via env (AD-10).
