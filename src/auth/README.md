# `src/auth/` — authentication and role check

`auth.ts` — the Better Auth instance (Google provider only; `emailAndPassword`
disabled). Sessions and users live in the app's own Postgres via Better Auth's
Prisma adapter over `db` (from `src/data/client.ts`).

`requireAdmin.ts` — the single point where the admin role is checked. All three
functions read the session through one `getSessionUser()`
(`auth.api.getSession({ headers })`):

- `requireAdmin()` — **throws** `AdminRequiredError` if the caller is not an admin.
  First line of every Server Action; the action catches it and maps to
  `{ ok: false, code: "FORBIDDEN" }`. Never catches `NEXT_REDIRECT`.
- `requireAdminPage()` — **redirects** (`/sign-in?from=/admin` when anonymous,
  `/?error=admin-required` when signed in without the role). For `/admin` layouts
  and pages, never Server Actions.
- `getSessionUser()` — the raw `session.user | null`, `isAdmin` typed.

Server Components and layouts may import `@/auth/requireAdmin` (the guard surface)
for route protection; they still must not import `@/auth/auth` (the instance).

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

The third bridge is the **guard surface** `requireAdmin.ts`: `src/app/admin/layout.tsx`
imports `@/auth/requireAdmin` to gate `/admin/**`. This is a sanctioned `view → auth`
edge for route protection, distinct from the auth instance — `src/app/**` is not
lint-blocked from `@/auth`, but the instance stays out of components/pages by
convention.

## Rules that live here

- The role is the boolean `User.isAdmin` (AD-6), declared as a Better Auth
  `user.additionalFields` entry with `input: false` — it is returned on
  `session.user.isAdmin` but can never be set through the auth API. Only the
  Story 1.7 Server Action sets it.
- A signed-in user without `isAdmin` is treated exactly like an anonymous viewer.
- Public reads never touch auth — they go straight through `src/data`.

Boundaries enforced by the `src/auth/**` block in `eslint.config.mjs`.
