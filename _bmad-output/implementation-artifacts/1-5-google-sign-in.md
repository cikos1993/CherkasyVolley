---
baseline_commit: a6275d5
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - AGENTS.md
---

# Story 1.5: Google sign-in

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to sign in to the site with my Google account and sign out,
so that the system can identify me (FR-1).

## Acceptance Criteria

Translated from `epics.md` → Epic 1 → Story 1.5. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** Better Auth is configured with a Google provider, with the session and users in Postgres
**When** the user clicks "Увійти через Google" on `/sign-in` and completes the OAuth flow
**Then**

1. A `User` is created or found, the session is persisted, and the user is returned to the page they came from.
2. A user without `isAdmin` sees the same interface as an anonymous Viewer — **no edit buttons in the DOM** (not merely hidden).
3. "Вийти" in the user menu returns the user to the anonymous-Viewer state.

### Notes on AC interpretation

- **"Better Auth … session and users in Postgres"** — Better Auth's Prisma adapter over the existing `db` client (`src/data/client.ts`, Story 1.4). Better Auth needs four tables: `user`, `session`, `account`, `verification`. `user` already exists from Story 1.4 as `User` — this story **reconciles** it (Task 4) and adds the other three, in **one new migration**.
- **"A `User` is created or found"** — the seeded admin (`SEED_ADMIN_EMAIL`, email only, no OAuth account) must be **linked** to the Google identity on first sign-in, not duplicated. Better Auth account-linking by trusted provider handles this (Task 3) — the seed's whole purpose (Story 1.4) depends on it.
- **"returned to the page they came from"** — `signIn.social({ provider: "google", callbackURL })`. The "Увійти" entry point carries `?from=<current path>`; `/sign-in` reads it and passes it as `callbackURL`. Default when absent: `/`.
- **"no edit buttons in the DOM"** — there are **no** admin/edit surfaces yet (Stories 1.6–1.8, Epic 2+), so this AC is structurally satisfied now: public pages are not auth-gated, and the only auth-dependent UI is the user menu (a nav element, not an edit control). Record that AD-7 / EXPERIENCE.md ("Кнопок редагування для не-адміна не існує в DOM") is the governing principle every later story follows.
- **"user menu"** — EXPERIENCE.md: "Вхід: одна кнопка «Увійти через Google» … Вихід — у меню користувача." Story 1.8 builds the real site header (discipline nav). This story adds a **minimal** user-menu element (a shadcn `DropdownMenu` + `Avatar`, or just a link + button) mounted in `layout.tsx`; 1.8 absorbs it into the shell. Do **not** build the discipline nav or replace `src/app/page.tsx` (still the throwaway page — Story 1.8).
- **`requireAdmin()` / `/admin` redirect / granting the admin role** are **Stories 1.6 / 1.7** — not here. This story only makes `session.user.isAdmin` exist and be `false` for a normal sign-in.
- **Scope guard.** Better Auth server config + Google provider + route handler + auth client + `/sign-in` page + minimal user menu + the schema reconciliation migration. **Not** in scope: `requireAdmin()`, `/admin`, any Server Action, admin management UI, the public shell / discipline nav, email/password auth, any domain or `src/data` entity function.

## Tasks / Subtasks

- [x] **Task 1 — Install Better Auth** (AC: 1)
  - [x] `better-auth@1.7.2` added. No ignored build scripts.
- [x] **Task 2 — Better Auth server instance** `src/auth/auth.ts` (AC: 1, 2)
  - [x] `betterAuth({ baseURL, secret, database: prismaAdapter(db, {provider:"postgresql"}), socialProviders.google (prompt "select_account"), account.accountLinking {enabled, trustedProviders:["google"]}, user.additionalFields.isAdmin {input:false, defaultValue:false}, advanced.database.generateId:false, plugins:[nextCookies()] })`. `db` from `@/data/client`.
  - [x] `emailAndPassword` not enabled (Google only). `auth` exported; server-only.
- [x] **Task 3 — Route handler** `src/app/api/auth/[...all]/route.ts` (AC: 1, 3)
  - [x] `export const { GET, POST } = toNextJsHandler(auth)`. Bridge documented in `src/auth/README.md`.
- [x] **Task 4 — Auth client** `src/lib/auth-client.ts` (AC: 1, 3)
  - [x] `createAuthClient()` (same origin), re-exports `signIn`/`signOut`/`useSession`. In `src/lib` (view util), not `src/auth`.
- [x] **Task 5 — Reconcile `prisma/schema.prisma` + Better Auth schema** (AC: 1)
  - [x] `@better-auth/cli generate` merged the four models; hand-reconciled (dropped `googleSub`, `@default(cuid())` on all ids, `token @unique`, `onDelete: Cascade`, `@@map` lowercase). `prisma validate` + `generate` ✓.
  - [x] **Migration applied.** `prisma migrate dev` refused non-interactively **and** planned a `DROP TABLE "User"` (Prisma does not infer the `@@map` rename → data loss). Instead: generated the SQL with `prisma migrate diff --from-config-datasource --to-schema`, hand-edited the `User` part to `ALTER TABLE ... RENAME` + `RENAME CONSTRAINT` + `RENAME INDEX` + `DROP COLUMN "googleSub"` + `ADD COLUMN emailVerified/image`, kept Prisma's verbatim SQL for the three new tables. Committed as `prisma/migrations/20260903115000_add_better_auth/`, applied with `prisma migrate deploy`. `prisma migrate status` → "Database schema is up to date!" (no drift).
  - [x] The seeded admin row **survived** — same `id` (`cmtlezdfq…`), `email`, `isAdmin: true`, `createdAt`; new `emailVerified: false`, `image: null`, no `googleSub`. `session`/`account` tables present (0 rows). `pnpm seed` re-run → still idempotent.
- [x] **Task 6 — `/sign-in` page** `src/app/sign-in/page.tsx` (AC: 1)
  - [x] Client Component; `<Suspense>` around the `useSearchParams` inner form (Next 16 requirement) — page still prerenders static. Primary `Button` "Увійти через Google" → `signIn.social({ provider:"google", callbackURL })`. `callbackURL` = validated same-origin `?from` path, else `/`. Redirects to `callbackURL` if already signed in.
- [x] **Task 7 — Minimal user menu** `src/components/user-menu.tsx` + `layout.tsx` (AC: 2, 3)
  - [x] Client Component via `useSession()`: not signed in → "Увійти" link to `/sign-in?from=<pathname>`; signed in → `DropdownMenu` + `Avatar` (image/initials) with name/email and "Вийти" → `signOut()` + `router.refresh()`.
  - [x] Mounted in `layout.tsx` in a minimal right-aligned `<header>` strip. Preserved `lang="uk"`, `metadata`, `min-h-full flex flex-col`, `import "./globals.css"`. `layout.tsx` does **not** call `auth.api.getSession` — pages stay static (`/` and `/sign-in` prerender).
- [x] **Task 8 — Env + Google Cloud OAuth** (AC: 1)
  - [x] `.env.example` Story 1.5 block activated with the Google Cloud redirect-URI / JS-origin instructions.
  - [x] `.env.local`: `BETTER_AUTH_SECRET` generated, `BETTER_AUTH_URL=http://localhost:3000`.
  - [x] **User** created the Google Cloud OAuth 2.0 Web client (localhost + Vercel redirect URIs / JS origins) and put `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` into `.env.local`. Vercel env — see the Handoff note (add before the production sign-in test).
- [x] **Task 9 — `next.config.ts` / build** (AC: 1)
  - [x] `pnpm exec next build` clean with **no** `next.config.ts` change — `better-auth` bundles fine under Turbopack. Routes: `/` + `/sign-in` static, `/api/auth/[...all]` dynamic.
- [x] **Task 10 — Verification gate** (AC: all)
  - [x] `pnpm prisma migrate status` → up to date; `migrate diff` (live DB vs schema) → empty; `user` has `emailVerified`/`image`/`isAdmin`, no `googleSub`; `session`/`account`/`verification`(+`issuer`) exist.
  - [x] `pnpm lint` + `pnpm typecheck` + `pnpm build` clean on Node 24. Routes: `/` + `/sign-in` static, `/api/auth/[...all]` dynamic.
  - [x] **Manual OAuth round-trip — DONE (local, `pnpm dev`).** Signed in as `SEED_ADMIN_EMAIL`: the **seeded** `user` row was linked (`users: 1` — no duplicate; same `id` `cmtlezdfq…`), `account` row created (`providerId: google`, `issuer: https://accounts.google.com`), `session` persisted; `name` + `image` backfilled from Google (`updateUserInfoOnLink`); `emailVerified` flipped to `true`; **`isAdmin` stayed `true`** (`input: false` untouched); returned to the origin page; the user-menu avatar appeared. **"Вийти"** → `sessions: 0`, menu back to "Увійти". Two bugs found & fixed here (see Debug Log). Non-seed sign-in not tested (no second Google account) — the create path is exercised by the same code and `isAdmin` defaults `false`.
- [x] **Task 11 — Docs** (housekeeping)
  - [x] `src/auth/README.md` rewritten — `auth.ts` instance, the view↔auth bridge (route handler + `auth-client.ts`), Google-only, `isAdmin` additional field.
  - [x] `AGENTS.md` `## Stack status` — Better Auth 1.7.x note (Google-only, table names, `User`→`user` rename, `googleSub` drop, env vars, callback URI).
  - [x] `.env.example` (Task 8).
- [x] **Task 12 — Commit** — `9042697` on `main` — `feat(auth): Google sign-in via Better Auth (Story 1.5)` (18 files, incl. `prisma/migrations/20260903115000_add_better_auth/`). Not pushed.

### Review Findings

_Adversarial code review 2026-09-03 (`bmad-code-review`, 4 layers). Scope: `a6275d5..HEAD` (`src/auth/**`, `src/lib/auth-client.ts`, `src/app/api/auth/**`, `src/app/sign-in/**`, `src/components/user-menu.tsx`, `src/app/layout.tsx`, `prisma/**`, `.env.example`, `AGENTS.md`, `package.json`). Outcome: 2 decision-needed (resolved), 12 patch (applied), 5 defer, ~6 dismissed. **1 high-severity schema bug found and fixed.**_

- [x] [Review][Patch][HIGH] **`Account` schema was missing `issuer` (required by the runtime) and `@@unique([issuer, accountId])`.** `@better-auth/cli@1.4.21` lags `better-auth@1.7.2`; the runtime (`@better-auth/core/db/get-tables.mjs`) defines `account.issuer` as required and keys accounts on `(issuer, accountId)`, and `oauth2/link-account.mjs` writes `issuer` on every account create → the **first Google sign-in would have failed** on the `account` insert. Added `issuer String` + `@@unique([issuer, accountId])`; migration `20260903120000_account_issuer` applied; `prisma migrate diff --from-config-datasource --to-schema` now returns an empty diff (DB structurally matches the schema). [prisma/schema.prisma, prisma/migrations/]
- [x] [Review][Decision] **AD-3 `view → auth` bridge** — **Resolved: option (a).** Added an AD-1 companion note in `ARCHITECTURE-SPINE.md` (the `[...all]` route handler is sanctioned transport, not a service); added `src/lib` to the spine's View row and `src/README.md` layer table with the bridge rule; added a `src/components/**` ESLint block forbidding `@/auth` imports (components use `@/lib/auth-client`). [ARCHITECTURE-SPINE.md, src/README.md, eslint.config.mjs]
- [x] [Review][Decision] **DB table-name convention** — **Resolved: option (a).** Lowercase `@@map` for all tables going forward; recorded in `AGENTS.md` ("All table names are lowercase via `@@map`") and `epics.md` (the Story 1.4 clarification note). Epic 2 models follow this. [AGENTS.md, epics.md]
- [x] [Review][Patch] `src/auth/auth.ts` — no fail-fast on missing env. Added: throw when `VERCEL_ENV === "production"` and `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` is unset (mirrors `src/data/client.ts`). Unset `BETTER_AUTH_SECRET` otherwise → per-instance random secret → sessions drop across redeploys. [src/auth/auth.ts]
- [x] [Review][Patch] `account.accountLinking.updateUserInfoOnLink: true` added — Better Auth defaults it off, so the seeded admin's `name`/`image` would never populate from Google and the menu would show "—" forever. [src/auth/auth.ts]
- [x] [Review][Patch] `emailAndPassword: { enabled: false }` set explicitly (was relying on the default) — documents the SPEC "Google-only" constraint and the unused `account.password` column. [src/auth/auth.ts]
- [x] [Review][Patch] `src/lib/auth-client.ts` — added `inferAdditionalFields` (config-literal form, no server import) so `session.user.isAdmin` is typed client-side; removed the unused `signIn`/`signOut`/`useSession` re-exports. [src/lib/auth-client.ts]
- [x] [Review][Patch] `safeCallback` hardened — rejects backslashes, control chars, `//`, and a `/sign-in` prefix (redirect loop); checks the decoded form. [src/app/sign-in/page.tsx]
- [x] [Review][Patch] `/sign-in` — `try/catch/finally` around `signIn.social`; `submitting` resets and an error message shows on failure (previously the button locked forever). [src/app/sign-in/page.tsx]
- [x] [Review][Patch] `UserMenu` — `from` now carries the query string (`pathname` + `useSearchParams`); `aria-label` on the dropdown trigger; a fixed-size placeholder instead of `null` while `isPending` (no CLS); focus ring on the "Увійти" link; `signOut` guarded against double-click. Returns `null` on `/sign-in` so the header link doesn't duplicate the page CTA. [src/components/user-menu.tsx]
- [x] [Review][Patch] `route.ts` — export all verbs `toNextJsHandler` returns; `export const runtime = "nodejs"` (explicit — `pg` cannot run on Edge). [src/app/api/auth/[...all]/route.ts]
- [x] [Review][Patch] `epics.md` — note added at Story 1.4 that `googleSub` is superseded by the `account` table (Story 1.5). [epics.md]
- [x] [Review][Patch] Migration durability — the hand-written `add_better_auth` SQL was only ever applied to the one prod DB. Verified now: `prisma migrate diff --from-config-datasource --to-schema` → empty (live DB == schema); `migrate status` clean. Captured the `migrate diff` command + a `scripts/db-check.mts` conformance script (re-usable) in the repo. [scripts/db-check.mts, AGENTS.md]
- [x] [Review][Defer] `updatedAt` is `NOT NULL` with no DB default on `session`/`account`/`verification` (and `user`, from the 1.4 defer). Better Auth's adapter always sets it; a raw / non-Better-Auth insert would fail. Fold `@default(now())` into a future migration if such a path appears. — `deferred-work.md`.
- [x] [Review][Defer] Interactive targets below the EXPERIENCE 44×44px a11y floor (base-nova `Button` `h-8`, `Avatar` `size-8`, the text "Увійти" link). Cross-cutting design-system decision (button/avatar sizing vs. "shadcn as-is") — Story 2.2 / a design-system pass. — `deferred-work.md`.
- [x] [Review][Defer] `session.cookieCache` not configured — every `useSession` / future server check hits Postgres. Add a short-TTL signed cookie cache when session reads get hot (Story 1.6). — `deferred-work.md`.
- [x] [Review][Defer] No committed OAuth integration test / manual-checklist script — needs the test runner; the story records the pending manual steps. — `deferred-work.md`.
- [x] [Review][Defer] Preview-deploy auth won't work (Google redirect URIs can't wildcard `*.vercel.app`; single `BETTER_AUTH_URL`). Document; revisit if preview auth is needed. — `deferred-work.md`.

## Dev Notes

### What this story is / is NOT

**Is:** Better Auth wired for Google-only OAuth, the schema reconciled into Better Auth's shape (+ 3 new tables), a `/sign-in` page, and a minimal user menu with sign-out.

**Is NOT** (do not pull forward):
- `requireAdmin()`, `/admin` layout + redirect → **Story 1.6**.
- Grant/revoke admin, `/admin/people` → **Story 1.7**.
- The public shell, discipline nav (`Класичний · Пляжний · Архів`), `/` → `/classic` redirect, real landing page → **Story 1.8**.
- Email/password auth, magic links, other providers.
- Any Server Action, `src/data` entity function, domain code, Vitest.

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `prisma/schema.prisma` | UPDATE | reconcile `User` (`@@map("user")`, +`emailVerified`/`image`, −`googleSub`, keep `isAdmin`); add `Session`/`Account`/`Verification`. Keep the `generator client` + `datasource db` blocks. |
| `prisma/migrations/**` | NEW (generated) | `add_better_auth` — table rename + columns + 3 tables + drop `googleSub`. |
| `prisma/seed.mts` | VERIFY | upserts `user` by `email` — should be unaffected; re-run after the migration to confirm. |
| `src/auth/auth.ts` | NEW | Better Auth instance. |
| `src/auth/README.md` | UPDATE | document the instance + the bridge exception. |
| `src/lib/auth-client.ts` | NEW | browser client. |
| `src/app/api/auth/[...all]/route.ts` | NEW | Better Auth route handler. |
| `src/app/sign-in/page.tsx` | NEW | sign-in page (Client Component). |
| `src/components/user-menu.tsx` | NEW | user menu (Client Component). |
| `src/app/layout.tsx` | UPDATE | mount the user menu in a minimal top strip. **Preserve** `lang="uk"`, `metadata`, `min-h-full flex flex-col`, `import "./globals.css"`. |
| `src/app/page.tsx` | DO NOT TOUCH | throwaway create-next-app page — Story 1.8 replaces it. |
| `package.json` / `pnpm-lock.yaml` | UPDATE | `better-auth`. |
| `.env.example` | UPDATE | activate the Story 1.5 block. |
| `next.config.ts` | MAYBE | `serverExternalPackages` only if the build needs it. |
| `AGENTS.md` | UPDATE | Stack status. |
| shadcn components | ADD if missing | `Card`, `DropdownMenu`, `Avatar` — `pnpm dlx shadcn@latest add card dropdown-menu avatar` (they land in `src/components/ui/`, base-nova defaults, no brand edits per DESIGN.md "as-is зі shadcn"). |

### Better Auth — the shape that matters (research, Sept 2026)

- **Package:** `better-auth@1.7.2` (single package). CLI: `npx @better-auth/cli@latest` — `generate` (writes the Prisma models from your config) and `secret` (generates `BETTER_AUTH_SECRET`). The CLI **does not** run the migration — you run `prisma migrate dev` after.
- **Imports:** `betterAuth` from `"better-auth"`; `prismaAdapter` from `"better-auth/adapters/prisma"`; `toNextJsHandler` + `nextCookies` from `"better-auth/next-js"`; `createAuthClient` from `"better-auth/react"`.
- **`prismaAdapter(db, { provider: "postgresql" })`** — pass the **constructed** client (our `db` from `src/data/client.ts`), not `@prisma/client`. Better Auth's own Prisma+Next guide uses exactly the `PrismaPg` + custom-generator-output pattern this repo already has.
- **Core tables** (Better Auth `@@map` lowercase):
  - `user`: `id`, `name String`, `email String @unique`, `emailVerified Boolean`, `image String?`, `createdAt`, `updatedAt` — plus our `isAdmin` (additional field). We keep `name` nullable and `id @default(cuid())`.
  - `session`: `id`, `expiresAt`, `token String @unique`, `createdAt`, `updatedAt`, `ipAddress String?`, `userAgent String?`, `userId` → `user` (`onDelete: Cascade`).
  - `account`: `id`, `accountId String` (the Google `sub`), `providerId String` (`"google"`), `userId` → `user` (Cascade), `accessToken?`, `refreshToken?`, `idToken?`, `accessTokenExpiresAt?`, `refreshTokenExpiresAt?`, `scope?`, `password?`, `createdAt`, `updatedAt`.
  - `verification`: `id`, `identifier`, `value`, `expiresAt`, `createdAt?`, `updatedAt?`.
- **`user.additionalFields`** — a field with `input: false` is stored + returned on `session.user` (typed via inference) but cannot be set through the auth API. Exactly what `isAdmin` needs.
- **Account linking** — `account.accountLinking.trustedProviders: ["google"]` links a social sign-in to an existing same-email user even when that user's `emailVerified` is `false` (our seeded admin). Without it, the seed's first login would create a second user.
- **Session on the server** (Stories 1.6+): `await auth.api.getSession({ headers: await headers() })`. **Client:** `authClient.useSession()`. **Sign out:** `await authClient.signOut()`.
- **`nextCookies()`** — last plugin; lets `auth.api.*` calls from Server Actions propagate `Set-Cookie` (needed by 1.6/1.7). Harmless for the redirect OAuth flow here.
- **OAuth callback path:** `/api/auth/callback/google` — fixed by the `[...all]` handler; register it in Google Cloud. `baseURL` must be the real domain in prod or the callback defaults to localhost.

### Architecture compliance

- **SPEC Constraint** — "Ідентифікація адміна — лише через вхід Google. Користувач, що ввійшов, але не має ролі адміна, у всьому розглядається як анонімний глядач." → Google-only (`emailAndPassword` off); `isAdmin` defaults `false`; no UI gates on "signed in", only on `isAdmin` (later stories).
- **AD-6** — role is the boolean `User.isAdmin`. This story creates the field; granting is Story 1.7's Server Action under `requireAdmin()`.
- **AD-7** — public reads bypass auth; nothing in this story gates a public page on being signed in.
- **AD-10 / AD-11** — schema only via this migration; `src/auth` imports `db` from `src/data`, never `@prisma/client`. Better Auth's own tables are created by the migration, not hand-SQL.
- **Consistency Conventions** — Prisma models `PascalCase` (`User`, `Session`, `Account`, `Verification`), tables lowercase via `@@map` (Better Auth convention); ids `cuid`; `DateTime` UTC.
- **Story 1.3 ESLint** — `src/auth/**` may import `src/data` + `next/*` + `better-auth/*`; must not import `@/domain`, `@/actions`, `@/app`, `@/components`, `@prisma/client`. `src/app/api/auth/[...all]/route.ts` importing `@/auth/auth` is not lint-restricted (no `src/app` block) and is the sanctioned transport bridge — note it in the README.
- **EXPERIENCE.md** — "одна кнопка «Увійти через Google»", "Вихід — у меню користувача", "після входу — повернення на сторінку, з якої прийшов".
- **DESIGN.md** — primary `Button` for the sign-in CTA; `DropdownMenu` + `Avatar` for the menu, shadcn as-is (no brand edits beyond the existing primary button).

### File structure

- `src/auth/auth.ts` (server), `src/lib/auth-client.ts` (browser), `src/app/api/auth/[...all]/route.ts` (transport). No `src/auth/index.ts` barrel.
- The `[...all]` catch-all segment name is Better Auth's convention (`toNextJsHandler` expects it).
- shadcn adds land in `src/components/ui/` — do not hand-edit them (DESIGN.md, AGENTS.md).

### Testing requirements

- **No unit tests / no Vitest** — no domain code. The gate is operational (Task 10): migration clean, lint/typecheck/build clean, and a manual Google OAuth round-trip (needs real Google credentials — the dev pauses for them like Story 1.4 did for the DB).
- Capture every command's real output + a description of the manual sign-in / sign-out / non-admin checks in the Dev Agent Record. Verifiable, not asserted.

### Previous story intelligence

**Story 1.4 (done, `a6275d5`):**
- `src/data/client.ts` exports `db` (`@prisma/adapter-pg` over pooled `DATABASE_URL`, `globalThis` singleton, throws if `DATABASE_URL` unset). `src/auth/auth.ts` imports `{ db }` from `@/data/client`.
- `prisma7.config.ts` loads `.env.local` then `.env`; `datasource.url` = direct/unpooled; `migrations.seed = "tsx prisma/seed.mts"`; `shadowDatabaseUrl` wired.
- `build` = `prisma generate && node scripts/migrate-deploy.mjs && next build` — the wrapper skips `migrate deploy` on Vercel preview builds. `pnpm typecheck` exists (offline `tsc --noEmit`).
- **One production Neon DB, no dev branch.** Story 1.4 review recommends creating a personal Neon branch for `migrate dev`. `migrate reset` is blocked by Prisma's AI-agent gate. So: run `migrate dev` carefully (against a branch if you make one), review the generated SQL before it applies.
- `User` table currently: `id`(cuid), `email` unique, `name?`, `googleSub?` unique, `isAdmin` default false, `createdAt`/`updatedAt`. One row: the seeded admin (`SEED_ADMIN_EMAIL`, `isAdmin=true`, everything else null).
- Prisma 7.10.0, `prisma-client` generator → `src/generated/prisma` (git-ignored). Import the client as `@/generated/prisma/client` (there is no `index.ts`).
- `deferred-work.md` from the 1.4 review: `updatedAt` has no DB default — **fold the fix into this story's migration** if convenient (add `@default(now())` to `User.updatedAt`), or leave it (Better Auth's adapter sets `updatedAt` on every write).
- Toolchain: **PowerShell** tool for `pnpm`/`prisma`/`npx`. `git` in both. `pnpm-workspace.yaml` `allowBuilds` gates postinstall builds (`esbuild: true` is there from `tsx`).

**Story 1.3 (done):** `src/auth/**` ESLint block — verified it does not ban `next` or third-party packages, only internal layers + the Prisma client. `src/lib` gets only the Prisma-client ban.

**Story 1.2 (done):** brand primary `Button` = shadcn `default` variant (`rounded-md`, `bg-primary`). Other shadcn components are base-nova defaults. Light theme only.

### Git intelligence

Recent: `a6275d5` / `1be0a84` (Story 1.4 — `User` model, migration, seed, adapter), `cd223c5` / `3e23d11` (Story 1.3 — boundaries). `src/auth/` has only `README.md`. `src/app/` has the throwaway `layout.tsx` + `page.tsx`. No API routes yet. No `better-auth` dependency.

### Latest tech information (web research, Sept 2026)

- **`better-auth@1.7.2`** — peer deps confirm `next ^16 / react ^19 / prisma ^7 / @prisma/client ^7 / pg ^8`. `@better-auth/cli@1.4.21` (`npx @better-auth/cli@latest`).
- **Better Auth + Prisma 7 + Next.js** — [prisma.io/docs/guides/authentication/better-auth/nextjs](https://www.prisma.io/docs/guides/authentication/better-auth/nextjs) uses the exact `PrismaPg` + `@/generated/prisma/client` + `prisma.config.ts` shape this repo has. `npx @better-auth/cli generate` → `prisma migrate dev` → `prisma generate`.
- **Google provider** — [better-auth.com/docs/authentication/google](https://better-auth.com/docs/authentication/google): `socialProviders.google.{clientId,clientSecret}`, optional `prompt: "select_account"`, `accessType: "offline"`. Redirect URI `<baseURL>/api/auth/callback/google`.
- **Session** — [better-auth.com/docs/concepts/session-management](https://www.better-auth.com/docs/concepts/session-management): `auth.api.getSession({ headers: await headers() })` (server), `authClient.useSession()` (client).
- **Additional fields** — [better-auth.com/docs/concepts/database](https://www.better-auth.com/docs/concepts/database): `user.additionalFields` with `type/required/defaultValue/input/returned`; appears on `session.user` by inference.
- No known security advisories for `better-auth@1.7.x`. `BETTER_AUTH_SECRET` must be ≥ 32 chars.

### Project context reference

No `project-context.md`. Binding docs: `SPEC.md` (CAP-1, "Google-only" constraint), `ARCHITECTURE-SPINE.md` (AD-6, AD-7, AD-10, AD-11, Consistency Conventions), `epics.md` (Story 1.5 AC + Epic 1 demo criterion + Stories 1.6–1.8 boundaries), `EXPERIENCE.md` (sign-in flow, user menu, `/sign-in`, no-edit-buttons-in-DOM), `DESIGN.md` (primary Button, shadcn as-is), `AGENTS.md`, `src/auth/README.md` (Story 1.3 contract), `1-4-…md` (client, migration, env wiring), `deferred-work.md`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5: Вхід через Google] — user story + AC
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1] — demo criterion ("адмін входить через Google, бачить порожню адмін-зону"); Stories 1.6 (`requireAdmin`), 1.7 (admin mgmt), 1.8 (public shell) boundaries
- [Source: _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md#AD-6] — role = `User.isAdmin`; `requireAdmin()` in `src/auth/`
- [Source: …/ARCHITECTURE-SPINE.md#AD-7] — public reads bypass auth
- [Source: …/ARCHITECTURE-SPINE.md#AD-10, #AD-11] — schema via migration; `src/data` sole Prisma importer
- [Source: …/ARCHITECTURE-SPINE.md#Consistency Conventions] — Better Auth, Google provider, session + users in own Postgres, `requireAdmin()` single check point; PascalCase models, cuid ids, UTC
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#CAP-1 / #Constraints] — Google-only identity; signed-in non-admin == anonymous viewer
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md#Interaction Primitives / #Information Architecture] — one "Увійти через Google" button, return to origin, sign out in user menu, `/sign-in` route
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md#Foundation] — "Кнопок редагування для не-адміна не існує в DOM, не лише приховано"
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md#Components] — primary Button; DropdownMenu / Avatar / Card shadcn as-is
- [Source: _bmad-output/implementation-artifacts/1-4-auth-schema-migrations-seed.md] — `db` client, `prisma7.config.ts`, `build`/`typecheck` scripts, seed, one prod DB, `updatedAt` deferred item
- [Source: _bmad-output/implementation-artifacts/1-3-domain-scaffold-boundaries.md] — `src/auth/**` ESLint block (allows `next` + third-party, bans internal layers + Prisma client)
- [Source: AGENTS.md] — pnpm + PowerShell tool; secrets via env; migration policy; `.env.example` maintenance
- Web: [Prisma – Better Auth + Next.js](https://www.prisma.io/docs/guides/authentication/better-auth/nextjs), [Better Auth – Google](https://better-auth.com/docs/authentication/google), [Better Auth – Prisma adapter](https://www.better-auth.com/docs/adapters/prisma), [Better Auth – Database / additional fields](https://www.better-auth.com/docs/concepts/database), [Better Auth – Session management](https://www.better-auth.com/docs/concepts/session-management)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (Claude Code, `/bmad-dev-story`)

### Debug Log References

All code written; migration applied; `pnpm lint` + `pnpm typecheck` + `pnpm build` clean.

- `@better-auth/cli generate` merged the four models but **kept** `googleSub` (CLI only adds) → hand-removed. Generated `Session`/`Account`/`Verification` had bare `id String @id` → added `@default(cuid())`; `token` → `token @unique`; both FKs → `onDelete: Cascade`.
- `betterAuth()` only **warns** on empty Google env vars — does not throw. `generate` / `build` / `typecheck` succeed without real credentials. OAuth won't function until they're set.
- **Migration required a hand-written SQL file.** `prisma migrate dev` is non-interactive-hostile here, and it planned `DROP TABLE "User"` (Prisma cannot infer that `@@map("user")` is a rename → would lose the seeded admin). Workaround: `prisma migrate diff --from-config-datasource --to-schema --script` for the base SQL, then rewrote the `User` section as `ALTER TABLE "User" RENAME TO "user"` + `RENAME CONSTRAINT` + `RENAME INDEX` + `DROP COLUMN "googleSub"` + `ADD COLUMN emailVerified/image`, kept Prisma's verbatim SQL for the 3 new tables. Applied via `prisma migrate deploy`. `migrate status` reports no drift.
- `useSearchParams()` on `/sign-in` needs a `<Suspense>` boundary in Next 16 → wrapped the inner form; `/sign-in` still prerenders static.
- `next build` needed no `serverExternalPackages` for `better-auth`.
- `pg` SSL-mode deprecation warning on connections — cosmetic, pre-existing (Story 1.4 review).

**Two runtime bugs found during the manual OAuth round-trip (static review missed both):**
- **`account_not_linked` on first sign-in.** Better Auth 1.7's `account.accountLinking.requireLocalEmailVerified` defaults to `true` — it refuses to link a social account to a *local* user whose `emailVerified` is `false`, and `trustedProviders` does **not** bypass this clause. The seeded admin is exactly that. Fix: `requireLocalEmailVerified: false` (the seed is itself the trust decision).
- **Page crash on avatar click** — `Base UI: MenuGroupContext is missing`. base-nova's `DropdownMenuLabel` is `@base-ui/react` `Menu.GroupLabel`, which requires a `<Menu.Group>` parent (unlike Radix). Replaced the label with a plain `<div>` for the name/email header.

**Deferred to the production sign-in test (still user-side):** add `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` (= prod origin) to the Vercel project env, push `main`, repeat the round-trip on `https://cherkasy-volley.vercel.app`.

### Completion Notes List

- **Code complete + code-reviewed + remediated.** Everything verifiable without live Google credentials passes: `migrate status` clean, `prisma migrate diff` (live DB vs schema) → empty, seeded admin row preserved through the `User`→`user` rename, `googleSub` dropped, `session`/`account`/`verification`(+`issuer`) present; `pnpm lint` + `pnpm typecheck` + `pnpm build` clean; `/` and `/sign-in` prerender static, `/api/auth/[...all]` dynamic. **Server auth path smoke-tested:** `auth.api.getSession({ headers: new Headers() })` → `null` (anonymous) with no error — proves the Better Auth instance, the Prisma adapter, and the config (`additionalFields`, `generateId:false`, `nextCookies`) all initialize. This is the same path Story 1.6's `requireAdmin` uses.
- **AC 1 — verified (local).** Signed in via Google as `SEED_ADMIN_EMAIL`: the seeded `user` row was **found & linked** (one row, same `id`), the `session` persisted, the browser returned to the origin page. `account` row: `providerId: google`, `issuer: https://accounts.google.com`. `name` + `image` came from Google; `isAdmin` stayed `true`.
- **AC 2 — verified (structural).** No admin/edit surfaces exist; public pages are not auth-gated; the only auth-dependent UI is the client-hydrated user menu. `session.user.isAdmin` is typed (client `inferAdditionalFields`) and was `true` for the admin — a new (non-seed) user gets `false`. AD-7 / EXPERIENCE.md "no edit buttons in the DOM" governs later stories. (Non-seed account not tested — no second Google account.)
- **AC 3 — verified (local).** "Вийти" → `authClient.signOut()` + `router.replace("/")` + `router.refresh()` → `session` row deleted, menu reverts to "Увійти".
- **Schema reconciliation (Story 1.4-review item):** `googleSub` removed; OAuth identity is now `account` (`providerId`/`accountId`). `epics.md`'s `googleSub`-on-`User` is superseded.
- **Deviations:** hand-written migration SQL (rename, not drop-recreate); `.env.local` carries a generated `BETTER_AUTH_SECRET` + placeholder Google vars.
- **`updatedAt` no-DB-default (1.4 deferred item)** — not addressed here; Better Auth's adapter sets `updatedAt` on every write, so left as-is.

### Handoff — the one remaining step (user acceptance)

The implementation is complete and reviewed. It cannot be *behaviourally* verified by the agent because Google OAuth needs a real OAuth client only the account owner can create. To close the story:

1. **Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Web application.**
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` and `https://cherkasy-volley.vercel.app/api/auth/callback/google`
   - Authorized JavaScript origins: `http://localhost:3000`, `https://cherkasy-volley.vercel.app`
2. Put `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env.local` **and** Vercel project env (all environments). Add `BETTER_AUTH_SECRET` (already in `.env.local`, value in the file) and `BETTER_AUTH_URL=https://cherkasy-volley.vercel.app` to Vercel env.
3. `pnpm dev` → open any page → "Увійти" → `/sign-in` → "Увійти через Google". Verify:
   - signing in as `SEED_ADMIN_EMAIL` links the **existing** `user` row (run `pnpm exec tsx scripts/db-check.mts` — `users` stays `1`, `accounts` becomes `1`), `isAdmin` stays `true`, and the menu shows the Google name/avatar;
   - signing in as a different Google account creates a new `user` (`isAdmin` = `false`), the page returns to where you started, and the UI is identical to anonymous apart from the menu;
   - "Вийти" clears the session (`sessions` count drops) and the menu reverts to "Увійти".
4. Push `main` (deploys to Vercel, applies the two migrations) and repeat step 3 on the production URL.

Once verified, set the story + `sprint-status.yaml` to `done`.

### File List

**Added:**
- `src/auth/auth.ts`
- `src/lib/auth-client.ts`
- `src/app/api/auth/[...all]/route.ts`
- `src/app/sign-in/page.tsx`
- `src/components/user-menu.tsx`
- `src/components/ui/card.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/components/ui/avatar.tsx` _(shadcn add, base-nova defaults)_
- `prisma/migrations/20260903115000_add_better_auth/migration.sql` _(hand-written — rename, not drop-recreate)_
- `prisma/migrations/20260903120000_account_issuer/migration.sql` _(code review — `account.issuer` + `@@unique`)_
- `scripts/db-check.mts` _(code review — DB conformance smoke)_

**Modified:**
- `prisma/schema.prisma` (+ `Session`/`Account`/`Verification`; `User` → `@@map("user")`, +`emailVerified`/`image`, −`googleSub`; +`Account.issuer` + `@@unique([issuer, accountId])`)
- `src/app/layout.tsx` (mount `UserMenu`)
- `src/auth/README.md`
- `AGENTS.md`
- `.env.example`
- `package.json` / `pnpm-lock.yaml` (`better-auth`)
- `eslint.config.mjs` _(code review — `src/components/**` ∌ `@/auth`)_
- `_bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md` _(code review — AD-1 route-handler note, `src/lib` in the View row)_
- `_bmad-output/planning-artifacts/epics.md` _(code review — `googleSub` / table-name clarification)_
- `src/README.md` _(code review — view↔auth bridge)_
- `_bmad-output/implementation-artifacts/deferred-work.md` / `sprint-status.yaml`

**Local only (git-ignored):**
- `.env.local` — `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, empty `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
- `src/generated/prisma/**` — regenerated (now includes `Session`/`Account`/`Verification`)

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-03 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
| 2026-09-03 | Implemented: `better-auth@1.7.2`; `src/auth/auth.ts` (Google-only, `isAdmin` additionalField, account linking, `nextCookies`); `src/lib/auth-client.ts`; `/api/auth/[...all]` route; `/sign-in` page; `UserMenu` in `layout.tsx`. Schema reconciled into Better Auth shape (`User`→`user`, +`emailVerified`/`image`, −`googleSub`; +`session`/`account`/`verification`) via a hand-written rename migration (`20260903115000_add_better_auth`) applied with `migrate deploy` — seeded admin row preserved, `migrate status` clean. `pnpm lint` + `pnpm typecheck` + `pnpm build` clean. Committed `9042697`. **Pending user:** Google Cloud OAuth client + the manual sign-in round-trip. Status: review. |
| 2026-09-03 | Code review (`bmad-code-review`, 4 layers). **1 high** fixed: `account` was missing `issuer` + `@@unique([issuer, accountId])` (`@better-auth/cli` lags the 1.7.2 runtime) — first sign-in would have failed; migration `20260903120000_account_issuer` applied, DB now structurally matches the schema. 2 decisions resolved (view↔auth bridge → spine/README/ESLint; lowercase `@@map` tables everywhere). 12 patches: env fail-fast in `auth.ts`, `updateUserInfoOnLink`, explicit `emailAndPassword:false`, client `inferAdditionalFields`, hardened `safeCallback`, sign-in/sign-out error handling, `from` keeps query string, `aria-label`/focus-ring/CLS-placeholder/`/sign-in`-hide on `UserMenu`, `runtime="nodejs"`, `epics.md` note, `scripts/db-check.mts`. 5 deferred. `pnpm lint` + `pnpm typecheck` + `pnpm build` clean. Status: review. |
| 2026-09-03 | User created the Google OAuth client. Manual OAuth round-trip run locally (`pnpm dev`). Two runtime bugs found & fixed (`632ee26`): `accountLinking.requireLocalEmailVerified: false` (Better Auth 1.7 blocked linking to the unverified-email seeded admin) and the `UserMenu` `DropdownMenuLabel` crash (base-ui `GroupLabel` needs a `Group` parent). **AC 1/2/3 verified locally** — seeded admin linked with no duplicate (`isAdmin` preserved, name/avatar from Google), sign-out clears the session. Status: **done**. |
| 2026-09-03 | **Deployed to production.** Added `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` / `DIRECT_URL` to Vercel prod env; replaced the Neon-integration's `DATABASE_URL` / `DATABASE_URL_UNPOOLED` with plain (build+runtime-visible) vars — the integration's Secret `DATABASE_URL` was not reaching the serverless runtime. Fixed the `client.ts` / `auth.ts` module-level env guards to skip `NEXT_PHASE === "phase-production-build"` (`7f2e65f`). Production live: `/api/auth/get-session` → `null` 200, `/api/auth/sign-in/social` → 200 with a correct Google URL (`redirect_uri=https://cherkasy-volley.vercel.app/api/auth/callback/google`). Human click-through on prod = same as the verified local flow. |
