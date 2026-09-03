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

Status: in-progress

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
- [~] **Task 5 — Reconcile `prisma/schema.prisma` + Better Auth schema** (AC: 1)
  - [x] `npx @better-auth/cli@latest generate --config src/auth/auth.ts` ran → merged `User` (+`emailVerified @default(false)`, `image`, relations, `@@map("user")`), added `Session`/`Account`/`Verification`.
  - [x] Hand-reconciled: **dropped `googleSub`** (CLI kept it — OAuth identity is now `account`); added `@default(cuid())` to `Session`/`Account`/`Verification` `id`; `token @unique`; `onDelete: Cascade` on both FKs; kept `@@map` lowercase. `pnpm prisma validate` ✓, `pnpm prisma generate` ✓.
  - [ ] **`pnpm prisma migrate dev --name add_better_auth` — PENDING** (touches the prod DB: `ALTER TABLE "User" RENAME TO "user"`, `DROP COLUMN "googleSub"` + index, add `emailVerified`/`image`, `CREATE TABLE session/account/verification`). Awaiting the user's go-ahead.
  - [ ] `prisma/seed.mts` — verify unaffected after the migration (still upserts `user` by `email`).
- [x] **Task 6 — `/sign-in` page** `src/app/sign-in/page.tsx` (AC: 1)
  - [x] Client Component; `<Suspense>` around the `useSearchParams` inner form (Next 16 requirement) — page still prerenders static. Primary `Button` "Увійти через Google" → `signIn.social({ provider:"google", callbackURL })`. `callbackURL` = validated same-origin `?from` path, else `/`. Redirects to `callbackURL` if already signed in.
- [x] **Task 7 — Minimal user menu** `src/components/user-menu.tsx` + `layout.tsx` (AC: 2, 3)
  - [x] Client Component via `useSession()`: not signed in → "Увійти" link to `/sign-in?from=<pathname>`; signed in → `DropdownMenu` + `Avatar` (image/initials) with name/email and "Вийти" → `signOut()` + `router.refresh()`.
  - [x] Mounted in `layout.tsx` in a minimal right-aligned `<header>` strip. Preserved `lang="uk"`, `metadata`, `min-h-full flex flex-col`, `import "./globals.css"`. `layout.tsx` does **not** call `auth.api.getSession` — pages stay static (`/` and `/sign-in` prerender).
- [~] **Task 8 — Env + Google Cloud OAuth** (AC: 1) — **external dependency, needs the user**
  - [x] `.env.example` Story 1.5 block activated with the Google Cloud redirect-URI / JS-origin instructions and the `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` guidance.
  - [x] `.env.local` (git-ignored): `BETTER_AUTH_SECRET` generated (`npx @better-auth/cli secret`), `BETTER_AUTH_URL=http://localhost:3000`, empty `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` placeholders.
  - [ ] **PENDING (user):** create the Google Cloud OAuth 2.0 Web client; put `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` into `.env.local` **and** Vercel env; add `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` (= prod origin) to Vercel env.
- [x] **Task 9 — `next.config.ts` / build** (AC: 1)
  - [x] `pnpm exec next build` clean with **no** `next.config.ts` change — `better-auth` bundles fine under Turbopack. Routes: `/` + `/sign-in` static, `/api/auth/[...all]` dynamic.
- [ ] **Task 10 — Verification gate** (AC: all)
  - [ ] `pnpm prisma migrate status` → up to date; the `user` table has `emailVerified`/`image`/`isAdmin`, no `googleSub`; `session`/`account`/`verification` exist.
  - [ ] `pnpm lint` clean (Story 1.3 boundaries intact — `src/auth/auth.ts` imports `db` not `@prisma/client`; `src/lib/auth-client.ts` clean), `pnpm typecheck` clean, `pnpm build` clean on Node 24.
  - [ ] **Manual, with real Google creds:** `pnpm dev` → open `/classic/anything` (or `/`) → user menu shows "Увійти" → click → `/sign-in?from=…` → "Увійти через Google" → Google consent → returns to the `from` page, signed in. `session` row created; `account` row with `providerId="google"`. If signing in as `SEED_ADMIN_EMAIL`: the **existing** seeded `user` row is linked (no duplicate), `isAdmin` still `true`.
  - [ ] Sign in as a **non-seed** Google account → new `user` row, `isAdmin = false`; UI identical to anonymous (only the user menu differs).
  - [ ] "Вийти" → `session` cleared, menu back to "Увійти".
  - [ ] Capture: migration SQL, `migrate status`, lint/typecheck/build tails, and a description of the manual OAuth round-trip (+ row counts) in the Dev Agent Record.
- [x] **Task 11 — Docs** (housekeeping)
  - [x] `src/auth/README.md` rewritten — `auth.ts` instance, the view↔auth bridge (route handler + `auth-client.ts`), Google-only, `isAdmin` additional field.
  - [x] `AGENTS.md` `## Stack status` — Better Auth 1.7.x note (Google-only, table names, `User`→`user` rename, `googleSub` drop, env vars, callback URI).
  - [x] `.env.example` (Task 8).
- [ ] **Task 12 — Commit** — after the migration lands.

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

**Paused for two external blockers** (Tasks 5 migration + 8 Google OAuth). All code is written; `pnpm lint` + `pnpm typecheck` + `pnpm exec next build` are clean.

- `@better-auth/cli generate` merged the four models into `prisma/schema.prisma` but **kept** the custom `googleSub` field (the CLI only adds, never removes) → hand-removed it + its `@unique`. The CLI's generated `Session`/`Account`/`Verification` had bare `id String @id` → added `@default(cuid())` to match the Consistency Convention. `token String` → `token String @unique`. Both FKs → `onDelete: Cascade`.
- `betterAuth()` at import only **warns** ("Social provider google is missing clientId or clientSecret") when the Google env vars are empty — it does not throw, so `generate` / `next build` / `typecheck` all succeed without real credentials. OAuth itself will not work until they are set.
- `useSearchParams()` on the `/sign-in` page needs a `<Suspense>` boundary in Next 16 or the build errors — wrapped the inner form; `/sign-in` still prerenders as static.
- `next build` needed no `serverExternalPackages` addition for `better-auth`.

**Blocked — needs the user:**
1. **Task 5 migration** against the single prod Neon DB — `ALTER TABLE "User" RENAME TO "user"`, `DROP COLUMN "googleSub"` (+ its unique index), add `emailVerified`/`image`, `CREATE TABLE session/account/verification`. The one existing row (seeded admin) survives the rename; `googleSub` is `NULL` for it, so the drop loses nothing. Not run — awaiting go-ahead (and/or a Neon dev branch per the Story 1.4 recommendation).
2. **Task 8 Google OAuth** — the user must create a Google Cloud OAuth 2.0 Web client and provide `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (`.env.local` + Vercel). `BETTER_AUTH_SECRET` (generated) and `BETTER_AUTH_URL` are already in `.env.local`; the prod values need adding to Vercel env.
3. **Task 10 manual verification** — the Google OAuth round-trip (sign in / link seeded admin / sign in as non-admin / sign out) can only be done once #2 is in place.

### Completion Notes List

_Pending — story not yet complete (see Debug Log blockers)._

### File List

**Added:**
- `src/auth/auth.ts`
- `src/lib/auth-client.ts`
- `src/app/api/auth/[...all]/route.ts`
- `src/app/sign-in/page.tsx`
- `src/components/user-menu.tsx`
- `src/components/ui/card.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/components/ui/avatar.tsx` _(shadcn add, base-nova defaults)_

**Modified:**
- `prisma/schema.prisma` (+ `Session`/`Account`/`Verification`; `User` → `@@map("user")`, +`emailVerified`/`image`, −`googleSub`)
- `src/app/layout.tsx` (mount `UserMenu`)
- `src/auth/README.md`
- `AGENTS.md`
- `.env.example`
- `package.json` / `pnpm-lock.yaml` (`better-auth`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Pending:**
- `prisma/migrations/<ts>_add_better_auth/**` (Task 5, not yet generated)

**Local only (git-ignored):**
- `.env.local` — `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, empty `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
- `src/generated/prisma/**` — regenerated (now includes `Session`/`Account`/`Verification`)

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-03 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
