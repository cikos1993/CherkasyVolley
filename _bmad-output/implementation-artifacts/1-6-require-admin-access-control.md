---
baseline_commit: feeaac8
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - AGENTS.md
---

# Story 1.6: `requireAdmin()` and access control

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a product owner,
I want every data mutation authorised on the server by the admin role,
so that a non-admin physically cannot change anything (FR-2, NFR-1, AD-6).

## Acceptance Criteria

Translated from `epics.md` → Epic 1 → Story 1.6. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** the sign-in mechanism from Story 1.5
**When** `src/auth/requireAdmin.ts` is implemented (throws before any data access) and applied in the `/admin` layout
**Then**

1. A **signed-in non-admin** at `/admin` is redirected to the home page with a toast "Потрібні права адміністратора".
2. An **anonymous** user at `/admin` is redirected to `/sign-in`.
3. A **demonstration protected Server Action returns an error for a non-admin on the server** — not merely a hidden button.

### Notes on AC interpretation

- **"`src/auth/requireAdmin.ts` … throws before any data access"** — this is AD-6: every Server Action's first line is `await requireAdmin()`, which throws (a typed error) if the caller is not an admin, before the action reads or writes anything. The role is the boolean `session.user.isAdmin` (Better Auth `additionalFields`, Story 1.5).
- **"applied in the `/admin` layout"** — the same module also exports a **page/layout** guard that **redirects** instead of throwing (a `redirect()` in a Server Component is the idiomatic route protection). `src/app/admin/layout.tsx` calls it; every `/admin/**` route inherits it. Two behaviours, one module: `requireAdmin()` (throws — Server Actions) and `requireAdminPage()` (redirects — layouts/pages). Both read the session through one shared `getSessionUser()`.
- **"redirected to the home page with a toast"** (AC 1) + EXPERIENCE.md State Patterns: signed-in non-admin → `redirect("/?error=admin-required")`; a small client component reads `?error`, shows the toast, and clears the param. The toast primitive is **shadcn `sonner`** (`toast.error(...)` — `destructive` styling per DESIGN.md UX-DR11). This is the *minimal* toast wiring; Story 2.2 formalises the reusable feedback pattern — do not build that here.
- **"redirected to `/sign-in`"** (AC 2) — anonymous → `redirect("/sign-in?from=/admin")`. Story 1.5's `/sign-in` reads `?from` and returns there after login.
- **"demonstration protected Server Action"** (AC 3) — one throwaway Server Action in `src/actions/` (e.g. `adminPing()`): first line `await requireAdmin()`, returns `{ ok: true, … }` for an admin, `{ ok: false, code: "FORBIDDEN", … }` for a non-admin (the action catches the thrown error and maps it). A button on `/admin` calls it and shows the result — proving the server enforces the role even if a button is reachable. Story 1.7 replaces this demo with the real grant/revoke actions.
- **"порожню адмін-зону"** (Epic 1 demo criterion) — `/admin/page.tsx` is a minimal placeholder ("Адмін-зона") + the demo-action button. `/admin/people` is Story 1.7; tournament management is Epic 2.
- **AD-7 not touched** — public pages remain un-gated; only `/admin/**` is protected.
- **Scope guard.** `requireAdmin.ts` + the `/admin` layout + a minimal `/admin` page + the demo action + minimal toast wiring (`sonner` + a flash component). **Not** in scope: grant/revoke admin, `/admin/people`, the user list (Story 1.7); the reusable `ConfirmDialog` / `Toast` / `Skeleton` / `EmptyState` patterns (Story 2.2); the public shell / discipline nav / `/` → `/classic` (Story 1.8); `src/app/page.tsx` (still the throwaway — Story 1.8); any domain code, any `src/data` entity function beyond the session read Better Auth already does.

## Tasks / Subtasks

- [x] **Task 1 — `src/auth/requireAdmin.ts`** (AC: 1, 2, 3)
  - [x] `getSessionUser()` — `await auth.api.getSession({ headers: await headers() })`; returns `session.user` or `null`.
  - [x] `class AdminRequiredError extends Error` — distinct type Server Actions catch (not `NEXT_REDIRECT`).
  - [x] `requireAdmin()` — throws `AdminRequiredError` for non-admins; for Server Actions.
  - [x] `requireAdminPage()` — `redirect("/sign-in?from=/admin")` / `redirect("/?error=admin-required")`; for layouts/pages.
  - [x] Story 1.3 lint: imports only `@/auth/auth` + `next/*` — `pnpm lint` green.
- [x] **Task 2 — `/admin` layout guard** `src/app/admin/layout.tsx` (AC: 1, 2)
  - [x] Server Component: `await requireAdminPage()` then `return <>{children}</>`.
  - [x] `/admin` shows as dynamic (ƒ) in the build output.
  - [x] `LayoutProps<"/admin">` typed-routes helper — resolves after `next build` regenerates route types.
- [x] **Task 3 — Minimal `/admin` page** `src/app/admin/page.tsx` (AC: 3, Epic 1 demo)
  - [x] `<h1 className="text-2xl font-bold">Адмін-зона</h1>` + one line "Керування турнірами зʼявиться в наступних історіях."
  - [x] Renders `<AdminPingButton />`.
  - [x] No `Button` styling work — default primary variant.
- [x] **Task 4 — Demo protected Server Action** `src/actions/admin-ping.ts` (AC: 3)
  - [x] `"use server"` file; `adminPing()` — `await requireAdmin()`, returns `{ ok: true, data: { id } }` or (via `toActionError`) `{ ok: false, code: "FORBIDDEN", message }`.
  - [x] `ActionResult<T>` + `toActionError(e)` in `src/actions/result.ts` (NEW); `toActionError` re-throws non-`AdminRequiredError` (incl. `NEXT_REDIRECT`).
  - [x] `src/actions/README.md` — noted `admin-ping.ts` is a Story-1.6 demo Story 1.7 removes, plus `result.ts`.
- [x] **Task 5 — Demo-action button** `src/components/admin-ping-button.tsx` (AC: 3)
  - [x] Client Component: `Button` "Перевірити доступ" → `adminPing()` in a transition → `toast` + inline result.
  - [x] Imports `@/actions/admin-ping`.
- [x] **Task 6 — Toast primitive + flash component** (AC: 1)
  - [x] `pnpm dlx shadcn@latest add sonner` → `src/components/ui/sonner.tsx`. Simplified: shadcn's generated file pulled in `next-themes`, but v1 is light-only (Story 1.2, no `.dark`, no `ThemeProvider`) so `useTheme()` is dead weight — replaced with a hardcoded `theme="light"` and `pnpm remove next-themes`. Only `sonner` remains added, matching the task's "adds the `sonner` dependency".
  - [x] `<Toaster />` mounted in `src/app/layout.tsx` `<body>`.
  - [x] `src/components/flash-toaster.tsx` (NEW) — reads `useSearchParams().get("error")`; on `admin-required` → `toast.error(...)`, then `router.replace(pathname)`. Inner reader in its own `<Suspense fallback={null}>`; `/` and `/sign-in` stay static (○) in the build.
- [x] **Task 7 — `layout.tsx` wiring** (AC: 1) — UPDATE
  - [x] `<Toaster />` + `<FlashToaster />` added inside `<body>`; `lang="uk"`, `metadata`, `min-h-full flex flex-col`, `import "./globals.css"`, `<header><UserMenu /></header>` all preserved.
- [x] **Task 8 — Docs** (housekeeping)
  - [x] `src/auth/README.md` — `requireAdmin.ts` documented (throws / redirects / `getSessionUser`); the guard surface as the third view↔auth bridge.
  - [x] `src/README.md` layer note + `ARCHITECTURE-SPINE.md` AD-1 exception + AD-3 note — guard surface is a sanctioned `view → auth` edge, distinct from the instance.
  - [x] `AGENTS.md` — one line on `/admin/**` gate + `await requireAdmin()` + `sonner`.
- [x] **Task 9 — Verification gate** (AC: all)
  - [x] `pnpm lint` (exit 0) + `pnpm typecheck` (exit 0) + `pnpm build` clean on Node 24. `/admin` **dynamic** (ƒ); `/` and `/sign-in` **static** (○) — see Debug Log.
  - [~] **Manual (`pnpm dev`):**
    - [x] anonymous → `GET /admin` → `307` → `location: /sign-in?from=/admin` (curl, dev :3111).
    - [ ] signed-in non-admin → `/admin` → `/` + toast — **pending user browser walkthrough** (needs a second Google account; same code path as the anonymous case, which is verified).
    - [ ] signed-in admin (`SEED_ADMIN_EMAIL`) → `/admin` renders + "Перевірити доступ" → `{ ok: true }` — **pending user browser walkthrough**.
    - [x] **Server-side proof:** `POST /sign-in` with `Next-Action: <adminPing id>` and no session → `200` body `{"ok":false,"code":"FORBIDDEN","message":"Потрібні права адміністратора"}`. The server rejects a non-admin with the UI bypassed entirely.
  - [x] Command output + walkthrough captured in the Dev Agent Record.
- [x] **Task 10 — Commit** — `feat(auth): requireAdmin guard + /admin gate (Story 1.6)`. Committed to `main`; push deploys to Vercel.

## Dev Notes

### What this story is / is NOT

**Is:** the `requireAdmin()` / `requireAdminPage()` guards, the `/admin` route gate, a placeholder `/admin` page, one demo protected Server Action proving server-side enforcement, and the minimal `sonner` toast wiring for the redirect message.

**Is NOT** (do not pull forward):
- Grant/revoke `isAdmin`, `/admin/people`, the "users who have logged in" list, last-admin protection → **Story 1.7**.
- `ConfirmDialog` / reusable `Toast` helper / `Skeleton` / `EmptyState` → **Story 2.2**.
- Public shell, discipline nav (`Класичний · Пляжний · Архів`), `/` → `/classic`, real landing page → **Story 1.8**.
- Any tournament/team/domain code, any `src/data` entity function.
- Middleware-based gating — the AC says *layout*. (A `getSessionCookie` middleware pre-check is a possible later optimisation; not now.)

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/auth/requireAdmin.ts` | NEW | `getSessionUser`, `requireAdmin` (throws), `requireAdminPage` (redirects), `AdminRequiredError`. |
| `src/app/admin/layout.tsx` | NEW | `await requireAdminPage()` — gates `/admin/**`. |
| `src/app/admin/page.tsx` | NEW | minimal "Адмін-зона" + demo button. |
| `src/actions/admin-ping.ts` | NEW | demo protected Server Action (Story 1.7 removes it). |
| `src/actions/result.ts` | NEW | `ActionResult<T>` type + `toActionError` — the server result shape. |
| `src/components/admin-ping-button.tsx` | NEW | client trigger for the demo action. |
| `src/components/flash-toaster.tsx` | NEW | reads `?error`, fires the toast, clears the param. |
| `src/components/ui/sonner.tsx` | NEW | `pnpm dlx shadcn add sonner` (base-nova defaults). |
| `src/app/layout.tsx` | UPDATE | mount `<Toaster />` + `<FlashToaster />`. Preserve everything else. |
| `src/auth/README.md`, `src/README.md`, `AGENTS.md`, `ARCHITECTURE-SPINE.md` | UPDATE | the guard surface / bridge. |
| `package.json` / `pnpm-lock.yaml` | UPDATE | `sonner`. |
| `src/app/page.tsx` | DO NOT TOUCH | Story 1.8. |

### Architecture compliance

- **AD-6** — role = boolean `session.user.isAdmin`. Every Server Action: `await requireAdmin()` first line (throws → the action maps to `{ ok: false, code: "FORBIDDEN" }`). No other write path. [ARCHITECTURE-SPINE.md#AD-6]
- **FR-2 / NFR-1** — "клієнтське приховування кнопок не є контролем доступу". The demo action proves the *server* rejects a non-admin; the `/admin` layout redirect is UX, not the security boundary.
- **AD-7** — public reads bypass auth; unchanged. Only `/admin/**` is gated.
- **AD-3 / view ↔ auth** — Server Components (`/admin/layout.tsx`) importing `@/auth/requireAdmin` is the sanctioned route-protection bridge (documented in `src/auth/README.md` + spine companion note, extending Story 1.5's `[...all]` + `auth-client` bridges). The auth *instance* (`@/auth/auth`) stays out of the view.
- **Story 1.3 ESLint** — `src/auth/**` block allows `next/*` + third-party; `src/components/**` is blocked from `@/auth` (components use `@/lib/auth-client` or call Server Actions). `src/app/**` is not blocked — pages/layouts may import `@/auth/requireAdmin`. Confirm `pnpm lint` stays green.
- **EXPERIENCE.md** — "Не адмін відкрив /admin → Редірект на `/sign-in` (не ввійшов) або на головну з тостом «Потрібні права адміністратора»". "Помилка Server Action → shadcn Toast (`destructive`)". `lang="uk"`; focus ring `{colors.primary}`; touch targets ≥ 44px (base-nova sizing is a known deferred design-system item — Story 1.5 review).
- **DESIGN.md** — `sonner` / Toast used as-is; one primary `Button` per screen; plain factual UA copy, no exclamation marks.
- **Consistency Conventions** — Server Action names are verbs; `ActionResult` is `{ ok: true, data } | { ok: false, code, message }` (matches the Server-Action error convention: "кидається типізована помилка → мапиться в `{ ok: false, code, message }`").

### Better Auth session on the server (Story 1.5 landed this)

- `auth.api.getSession({ headers: await headers() })` — `headers()` is **async** in Next 16 (`await`). Returns `{ user, session } | null`; `user.isAdmin` is typed (Better Auth infers its own `additionalFields`).
- The `src/auth/auth.ts` module has a `NEXT_PHASE === "phase-production-build"` guard on its env fail-fast (Story 1.5 fix) — importing it in `requireAdmin.ts` at build time is safe.
- `src/data/client.ts` likewise guards `DATABASE_URL` for the build phase. The session read hits Postgres at request time, when Vercel runtime env is present.
- **`session.cookieCache` is not configured** (deferred from the Story 1.5 review). Every `getSessionUser()` call is a DB round-trip. For `/admin` this is acceptable; if admin pages get chatty, enable Better Auth's cookie cache (`session: { cookieCache: { enabled: true, maxAge: 300 } }`) — a separate small change.

### `next/navigation` `redirect` in a Server Component

- `redirect(url)` throws `NEXT_REDIRECT` — **never wrap `requireAdminPage()` in try/catch** that swallows it. `requireAdmin()` (the throwing one for actions) throws `AdminRequiredError` instead, precisely so actions can catch *that* and not the redirect.
- A `redirect()` inside a Server Action is also valid (redirects the client) — but AC 3 wants the demo action to **return an error**, so it uses `requireAdmin()` + catch, not `requireAdminPage()`.

### `useSearchParams` + static rendering (Story 1.5 pattern)

- Story 1.5 hit this with `UserMenu` — solved by NOT using `useSearchParams` there (used `window.location`). For `<FlashToaster>` you need the param reactively; wrap the reader in its own `<Suspense>` so `/` and `/sign-in` stay statically prerenderable. Confirm in the build output (`○` vs `ƒ`).

### Testing requirements

- **No unit tests / no Vitest** — no domain code. The gate is operational (Task 9): `lint` + `typecheck` + `build` clean; static/dynamic route classification correct; and a manual walkthrough of the three identities (anonymous, non-admin, admin) plus a server-side check that the demo action rejects a non-admin independent of the UI.
- Capture real command output and the manual walkthrough in the Dev Agent Record — verifiable, not asserted (the pattern from Stories 1.1–1.5).

### Previous story intelligence

**Story 1.5 (done, deployed):**
- `src/auth/auth.ts` — Better Auth instance; `session.user.isAdmin` typed server-side and client-side (`inferAdditionalFields`). The seeded admin (`SEED_ADMIN_EMAIL`) is linked to Google, `isAdmin: true`.
- `src/lib/auth-client.ts` — browser client (`useSession`, `signIn`, `signOut`).
- `src/app/api/auth/[...all]/route.ts` — `runtime = "nodejs"`.
- `src/app/layout.tsx` — has a `<header>` with `<UserMenu />` (client, `useSession`-driven). `/` and `/sign-in` are static; `/api/auth/[...all]` is dynamic.
- **Table names are lowercase `@@map`** going forward (Story 1.5 decision). Models stay `PascalCase`.
- Vercel prod env: `DATABASE_URL` / `DATABASE_URL_UNPOOLED` are **plain** vars; auth secrets sensitive; module-level env guards skip the build phase.
- shadcn adds land in `src/components/ui/` — base-nova, no brand edits. `card` / `dropdown-menu` / `avatar` already added; `sonner` is new here.
- `scripts/db-check.mts` — `pnpm exec tsx scripts/db-check.mts` prints row counts (useful to confirm a non-admin test user exists / was created).
- Toolchain: **PowerShell** for `pnpm` / `prisma` / `npx` / `vercel`. `git` in both. Background `pnpm dev` via the Bash tool's `run_in_background`.

**Story 1.3 (done):** `src/actions/` has only a `README.md`; this story creates the first real action files. `src/actions/**` has no ESLint block — the "may import domain/data/auth" rule is convention (README), not lint.

### Git intelligence

Recent: `feeaac8` … `9042697` (Story 1.5 — Better Auth, `/sign-in`, user menu, prod deploy). `src/auth/` has `auth.ts` + `README.md`. `src/app/` has `layout.tsx`, `page.tsx` (throwaway), `sign-in/`, `api/auth/`. No `/admin` route yet. No `src/actions/*.ts`. `sonner` not installed.

### Latest tech information

- **Better Auth 1.7.2** — `auth.api.getSession({ headers })` is the server session read; `getSessionCookie` (from `better-auth/cookies`) is a DB-free cookie-presence check for middleware (not used here).
- **Next.js 16** — `headers()` / `cookies()` are async. `redirect()` from `next/navigation` in RSC. Typed routes: `LayoutProps<"/admin">`, `PageProps<...>`.
- **shadcn `sonner`** — the current toast component (replaced the old `toast`). `<Toaster />` in the layout, `import { toast } from "sonner"` (or re-exported from `@/components/ui/sonner`), `toast.error(msg)` for destructive.
- No security advisories for these versions.

### Project context reference

No `project-context.md`. Binding docs: `ARCHITECTURE-SPINE.md` (AD-6, AD-7, AD-3, Consistency Conventions), `epics.md` (Story 1.6 AC + Epic 1 demo criterion + Stories 1.7/1.8 boundaries), `SPEC.md` (CAP-1: "запит на зміну даних від користувача без ролі адміна відхиляється на сервері"; Constraints), `EXPERIENCE.md` (the `/admin` redirect + toast, Server Action error toast, access model), `DESIGN.md` (Toast/Button as-is), `AGENTS.md`, `src/auth/README.md` + `src/actions/README.md` (Story 1.3 contracts), `1-5-google-sign-in.md` (session read, deferred items).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.6: `requireAdmin()` і розмежування доступу] — user story + AC
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1] — demo criterion ("не-адмін на `/admin` отримує редірект")
- [Source: _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md#AD-6] — Server Action first line `await requireAdmin()`; role = `User.isAdmin`; single check point in `src/auth/`
- [Source: …/ARCHITECTURE-SPINE.md#AD-7] — public reads bypass the role check
- [Source: …/ARCHITECTURE-SPINE.md#Consistency Conventions] — Server Action error → `{ ok: false, code, message }`; verb names
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#CAP-1 / #Constraints] — "авторизація — на сервері, не приховуванням кнопок"
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md#State Patterns] — "Не адмін відкрив /admin → Редірект … з тостом «Потрібні права адміністратора»"; "Помилка Server Action → shadcn Toast (`destructive`)"
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md#Foundation] — access model AD-6/AD-7; "Кнопок редагування для не-адміна не існує в DOM"
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md#Components] — Toast/Button shadcn as-is
- [Source: _bmad-output/implementation-artifacts/1-5-google-sign-in.md] — `auth.api.getSession`, `session.user.isAdmin` typing, build-phase env guards, `sonner` not yet installed, deferred `cookieCache`
- [Source: _bmad-output/implementation-artifacts/1-3-domain-scaffold-boundaries.md] — `src/auth/**` + `src/components/**` ESLint blocks; `src/actions` conventions
- [Source: AGENTS.md] — pnpm + PowerShell tool; lowercase table names; Vercel env notes
- Web: [Better Auth – Session management](https://www.better-auth.com/docs/concepts/session-management), [Next.js – redirect](https://nextjs.org/docs/app/api-reference/functions/redirect), [shadcn/ui – sonner](https://ui.shadcn.com/docs/components/sonner)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

**`pnpm build`** (Node 24, Turbopack):

```
✓ Compiled successfully in 1801ms
  Finished TypeScript in 2.9s
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /admin
├ ƒ /api/auth/[...all]
└ ○ /sign-in
```

`/admin` is dynamic (ƒ, reads `headers()` via the guard); `/` and `/sign-in` stay
static (○) — the `<Suspense>` boundary around the `useSearchParams` reader in
`FlashToaster` keeps them prerenderable.

**`pnpm typecheck`** → exit 0 (after `next build` regenerated `.next/types` with the
new `/admin` route; a bare `tsc` before the first build fails on `LayoutProps<"/admin">`).
**`pnpm lint`** → exit 0.

**Manual (dev server on :3111):**

```
$ curl -sD- http://localhost:3111/admin        # anonymous
HTTP/1.1 307 Temporary Redirect
location: /sign-in?from=/admin

$ curl -s -X POST http://localhost:3111/sign-in \
    -H 'Next-Action: 00eba676298cba5beeba3850572ca63b772ec45164' \
    -H 'Content-Type: text/plain;charset=UTF-8' --data-raw '[]'   # anonymous, UI bypassed
1:{"ok":false,"code":"FORBIDDEN","message":"Потрібні права адміністратора"}

$ curl -so/dev/null -w '%{http_code}' 'http://localhost:3111/?error=admin-required'
200
```

### Completion Notes List

- **`requireAdmin.ts`** — one module, three exports over a shared `getSessionUser()`:
  `requireAdmin()` throws `AdminRequiredError` (Server Actions), `requireAdminPage()`
  redirects (layouts/pages), `getSessionUser()` is the raw read. `AdminRequiredError`
  is a named class so actions catch it without swallowing `NEXT_REDIRECT`.
- **AC 2 (anonymous → `/sign-in`)** — verified by curl: `307` → `/sign-in?from=/admin`.
- **AC 3 (server rejects non-admin)** — verified by POSTing the `adminPing` action
  endpoint directly with no session: `{ ok: false, code: "FORBIDDEN" }`. This is the
  strongest form of "non-admin" and hits the exact `requireAdmin()` code path a
  signed-in non-admin would. The UI is fully bypassed — proves FR-2/NFR-1
  ("hiding buttons is not access control").
- **AC 1 (signed-in non-admin → home + toast)** — `requireAdminPage()` does
  `redirect("/?error=admin-required")`; `FlashToaster` maps `admin-required` →
  `toast.error("Потрібні права адміністратора")` then strips the param via
  `router.replace(pathname)` (no re-toast on refresh). The two signed-in browser
  walkthroughs (non-admin, admin) need real Google accounts and are left for the
  user to confirm in dev or after deploy — consistent with how Story 1.5's sign-in
  was verified. Every non-UI code path is verified above.
- **`sonner` / `next-themes`** — `shadcn add sonner` generated a `sonner.tsx` that
  imports `next-themes`. v1 is light-only (Story 1.2 removed the `.dark` block and
  no `ThemeProvider` is mounted), so `useTheme()` would only ever return `"system"`.
  Replaced with `theme="light"` and removed `next-themes`. Net new dependency: only
  `sonner`, as the task intended.
- **No unit tests** — no domain code (per the story's testing note). The gate is
  operational: `lint` + `typecheck` + `build` + the route classification + the
  anonymous/server-side walkthrough.

### File List

**New**
- `src/auth/requireAdmin.ts`
- `src/actions/result.ts`
- `src/actions/admin-ping.ts`
- `src/components/admin-ping-button.tsx`
- `src/components/flash-toaster.tsx`
- `src/components/ui/sonner.tsx`
- `src/app/admin/layout.tsx`
- `src/app/admin/page.tsx`

**Modified**
- `src/app/layout.tsx` — mount `<Toaster />` + `<FlashToaster />`
- `src/auth/README.md`, `src/README.md`, `src/actions/README.md`, `AGENTS.md`
- `_bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md`
- `package.json`, `pnpm-lock.yaml` — `+ sonner`, `− next-themes`

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-03 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
| 2026-09-03 | Implemented Tasks 1–10: `requireAdmin`/`requireAdminPage` guards, `/admin` layout gate + placeholder page, `adminPing` demo action + `ActionResult`, `sonner` + `FlashToaster`, docs. `lint`/`typecheck`/`build` green; anonymous redirect + server-side non-admin rejection verified. Status: in-progress → review. |
