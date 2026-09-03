# `src/auth/` — authentication and role check

`auth.ts` — the Better Auth instance (Google provider only; `emailAndPassword`
disabled). Sessions and users live in the app's own Postgres via Better Auth's
Prisma adapter over `db` (from `src/data/client.ts`). `requireAdmin()` (Story 1.6)
will be the single point where the admin role is checked.

**May import:** `src/data` (the shared `PrismaClient` — Better Auth's adapter needs
the instance), `next/*`, `better-auth/*`. This layer never imports `@prisma/client`
/ `@/generated/prisma` directly.

**Must not import:** `src/domain`, `src/actions`, `src/app`, `src/components`.

## The view ↔ auth bridge

The layer direction is `auth → data`; the view does not import `src/auth` directly.
The two sanctioned bridges are:

- `src/app/api/auth/[...all]/route.ts` — the Better Auth HTTP endpoint
  (`toNextJsHandler(auth)`). It is transport, not a component.
- `src/lib/auth-client.ts` — the browser client (`createAuthClient` from
  `better-auth/react`). Client Components call `authClient.signIn` / `signOut` /
  `useSession`; they never import `src/auth`.

Server-side session reads (`auth.api.getSession({ headers })`) go through `auth.ts`.

## Rules that live here

- The role is the boolean `User.isAdmin` (AD-6), declared as a Better Auth
  `user.additionalFields` entry with `input: false` — it is returned on
  `session.user.isAdmin` but can never be set through the auth API. Only the
  Story 1.7 Server Action sets it.
- A signed-in user without `isAdmin` is treated exactly like an anonymous viewer.
- Public reads never touch auth — they go straight through `src/data`.

Boundaries enforced by the `src/auth/**` block in `eslint.config.mjs`.
