# `src/auth/` — authentication and role check

Better Auth configuration (Google provider; sessions and users in the app's own
Postgres) and `requireAdmin()` — the single point where the admin role is checked.

**May import:** `src/data` only — including the shared `PrismaClient` instance that
`src/data` constructs and exports (Better Auth's Prisma adapter needs the instance;
this layer does not import `@prisma/client` / `@/generated/prisma` itself).

**Must not import:** `src/domain`, `src/actions`, `src/app`, `src/components`.

Rules that live here:

- The role is the boolean `User.isAdmin` (see `ARCHITECTURE-SPINE.md` AD-6). A
  signed-in user without it is treated exactly like an anonymous viewer.
- `requireAdmin()` has two call contexts (Story 1.6): it **throws** before any
  `src/data` access reachable from a Server Action, and it **redirects** when it
  guards the `/admin` layout for a non-admin.
- Public reads never call `requireAdmin()` — they go straight through `src/data`.

Boundaries enforced by the `src/auth/**` block in `eslint.config.mjs`. Wired in the
sign-in and access-control stories; this directory starts empty.
