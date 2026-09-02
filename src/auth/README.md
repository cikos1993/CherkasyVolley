# `src/auth/` — authentication and role check

Better Auth configuration (Google provider; sessions and users in the app's own
Postgres) and `requireAdmin()` — the single point where the admin role is checked.

**May import:** `src/data`.

**Must not import:** `src/domain`, `src/actions`, `src/app`, `src/components`.

Rules that live here:

- The role is the boolean `User.isAdmin`. A signed-in user without it is treated
  exactly like an anonymous viewer.
- `requireAdmin()` throws before any `src/data` access reachable from a Server
  Action, and also guards the `/admin` layout (redirect for non-admins).
- Public reads never call `requireAdmin()` — they go straight through `src/data`.

Wired in the sign-in and access-control stories; this directory starts empty.
