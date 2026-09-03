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

Status: ready-for-dev

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

- [ ] **Task 1 — `src/auth/requireAdmin.ts`** (AC: 1, 2, 3)
  - [ ] `getSessionUser()` — `await auth.api.getSession({ headers: await headers() })`; returns `session.user` (typed, includes `isAdmin`) or `null`. `auth` from `@/auth/auth`; `headers` from `next/headers`.
  - [ ] `class AdminRequiredError extends Error` — a distinct type Server Actions can catch (do **not** catch `NEXT_REDIRECT`).
  - [ ] `requireAdmin()` — `const user = await getSessionUser(); if (!user?.isAdmin) throw new AdminRequiredError(); return user;` — for Server Actions.
  - [ ] `requireAdminPage()` — `const user = await getSessionUser(); if (!user) redirect("/sign-in?from=/admin"); if (!user.isAdmin) redirect("/?error=admin-required"); return user;` — `redirect` from `next/navigation`. For layouts/pages.
  - [ ] Story 1.3 lint: `src/auth/**` may import `next/*` + `better-auth/*` + `src/data`; it must not import `@/domain` / `@/actions` / `@/app` / `@/components` / `@prisma/client`. `requireAdmin.ts` imports only `@/auth/auth` + `next/*` — compliant.
- [ ] **Task 2 — `/admin` layout guard** `src/app/admin/layout.tsx` (AC: 1, 2)
  - [ ] Server Component: `export default async function AdminLayout({ children }: LayoutProps<"/admin">) { await requireAdminPage(); return <>{children}</>; }` (or wrap `children` in a minimal shell — keep it plain, Story 2.2/Epic 2 add admin chrome).
  - [ ] This makes `/admin/**` dynamic (uses `headers()`). Correct — admin routes must never be cached.
  - [ ] `LayoutProps<"/admin">` — the Next 16 typed-routes helper (same as the root `LayoutProps<"/">`).
- [ ] **Task 3 — Minimal `/admin` page** `src/app/admin/page.tsx` (AC: 3, Epic 1 demo)
  - [ ] Server Component heading — `display-sm` style "Адмін-зона" (DESIGN.md typography; a plain `<h1 className="text-2xl font-bold …">` is fine — the token scale is not yet extracted, deferred item from Story 1.2). One line: "Керування турнірами зʼявиться в наступних історіях."
  - [ ] Render the demo-action trigger (Task 5's client component).
  - [ ] No `Button` styling work beyond the existing primary variant.
- [ ] **Task 4 — Demo protected Server Action** `src/actions/admin-ping.ts` (AC: 3)
  - [ ] `"use server"` file. `adminPing()`:
    ```ts
    export async function adminPing(): Promise<ActionResult<{ id: string }>> {
      try {
        const user = await requireAdmin();
        return { ok: true, data: { id: user.id } };
      } catch (e) {
        if (e instanceof AdminRequiredError) {
          return { ok: false, code: "FORBIDDEN", message: "Потрібні права адміністратора" };
        }
        throw e;
      }
    }
    ```
  - [ ] `ActionResult<T>` + a `toActionError(e)` mapper live in `src/actions/result.ts` (NEW) — the small shared shape `{ ok: true; data: T } | { ok: false; code: string; message: string }` that `src/actions/README.md` already specifies. Story 2.2 builds the client Toast side; this is only the server shape.
  - [ ] `src/actions/README.md` — no rewrite needed; it already documents this. Add one line that `admin-ping.ts` is a Story-1.6 demo that Story 1.7 removes.
- [ ] **Task 5 — Demo-action button** `src/components/admin-ping-button.tsx` (AC: 3)
  - [ ] Client Component: a `Button` "Перевірити доступ" → `await adminPing()` → shows the result (`{ ok }` / code) inline or via `toast`.
  - [ ] Imports the action from `@/actions/admin-ping` (Client Components may import Server Actions). Keep it tiny.
- [ ] **Task 6 — Toast primitive + flash component** (AC: 1)
  - [ ] `pnpm dlx shadcn@latest add sonner` → `src/components/ui/sonner.tsx` (base-nova defaults, no brand edits — DESIGN.md "shadcn as-is"). It adds the `sonner` dependency.
  - [ ] Mount `<Toaster />` (from `@/components/ui/sonner`) in `src/app/layout.tsx` `<body>`.
  - [ ] `src/components/flash-toaster.tsx` (NEW) — Client Component: reads `useSearchParams().get("error")`; on `admin-required` → `toast.error("Потрібні права адміністратора")`, then `router.replace(pathname)` to drop the param (no re-toast on refresh). Wrap the `useSearchParams` usage so it does not deopt static pages — a self-contained `<Suspense>` boundary around the inner reader, mounted in `layout.tsx`. Verify `/` (and `/sign-in`) still prerender static after this.
- [ ] **Task 7 — `layout.tsx` wiring** (AC: 1) — UPDATE
  - [ ] Add `<Toaster />` and `<FlashToaster />` inside `<body>`. **Preserve** `lang="uk"`, `metadata`, `min-h-full flex flex-col`, `import "./globals.css"`, the existing `<header>` + `<UserMenu />`.
- [ ] **Task 8 — Docs** (housekeeping)
  - [ ] `src/auth/README.md` — add `requireAdmin.ts` to the "Rules that live here" / bridge section: `requireAdmin()` throws (Server Actions), `requireAdminPage()` redirects (layouts/pages), both via `getSessionUser()`. Server Components / layouts may import `@/auth/requireAdmin` (the guard surface) — they still must not import `@/auth/auth` (the instance).
  - [ ] `src/README.md` layer note + `ARCHITECTURE-SPINE.md` AD-1/AD-3 companion — the auth **guard** surface (`requireAdmin`, `requireAdminPage`, `getSessionUser`) is a sanctioned `view → auth` edge for route protection, distinct from the auth *instance*.
  - [ ] `AGENTS.md` — one line: `/admin/**` gated by `src/app/admin/layout.tsx` → `requireAdminPage()`; Server Actions start with `await requireAdmin()`; `sonner` is the toast primitive.
- [ ] **Task 9 — Verification gate** (AC: all)
  - [ ] `pnpm lint` + `pnpm typecheck` + `pnpm build` clean on Node 24. `/admin` + `/admin/*` show as **dynamic** (ƒ); `/` and `/sign-in` still **static** (○).
  - [ ] **Manual (`pnpm dev`):**
    - anonymous → open `/admin` → redirected to `/sign-in?from=/admin`.
    - sign in as a **non-admin** Google account → open `/admin` → redirected to `/` with the toast "Потрібні права адміністратора" (toast shows once; refresh does not re-show).
    - sign in as `SEED_ADMIN_EMAIL` (`isAdmin: true`) → `/admin` renders "Адмін-зона"; click "Перевірити доступ" → `{ ok: true }`.
    - **Server-side proof:** as a non-admin, POST the `adminPing` Server Action endpoint directly (or call it from a non-admin session) → the response is the `{ ok: false, code: "FORBIDDEN" }` result, not a success. Capture how you exercised it.
  - [ ] Capture command output + the manual walkthrough (which account, what happened) in the Dev Agent Record.
- [ ] **Task 10 — Commit** — `feat(auth): requireAdmin guard + /admin gate (Story 1.6)`. Commit to `main`; push deploys to Vercel (prod auth already configured in Story 1.5).

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-03 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
