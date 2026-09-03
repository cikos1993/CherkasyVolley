---
baseline_commit: a5a1257
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - AGENTS.md
---

# Story 1.7: Admin management (grant / revoke `isAdmin`)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to grant and revoke the admin role for other users,
so that several people in the federation can run tournaments (FR-3).

## Acceptance Criteria

Translated from `epics.md` → Epic 1 → Story 1.7. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** I am signed in as an admin, on `/admin/people`
**When** I open the list of users who have signed in at least once
**Then**

1. I can grant `isAdmin` to anyone in the list, and they get access to `/admin` immediately (on their next request — no re-login).
2. I can revoke `isAdmin`.
3. An attempt to revoke the role from myself while I am the last admin is rejected with an explanation.
4. All three actions (grant, revoke, list) are Server Actions / data reads gated by `requireAdmin()`.

### Notes on AC interpretation

- **"users who have signed in at least once"** (AC list) — a `User` row alone is not enough (the seed creates one before any login). "Signed in" = has at least one `Account` row (Google OAuth completed and linked; `account` persists, `session` expires). Filter: `where: { accounts: { some: {} } }`. The current admin always qualifies (they are signed in, Google-only).
- **"grant … immediately"** (AC 1) — `isAdmin` is read fresh from the DB on every `auth.api.getSession` call (Better Auth `session.cookieCache` is **not** configured — deferred item from Story 1.5/1.6). So the granted user's very next request to `/admin` passes `requireAdminPage()`. No session invalidation, no re-login. Do **not** add cookie cache in this story.
- **"revoke"** (AC 2) — sets `isAdmin = false` via `src/data`. The revoked user's next `/admin` request redirects to `/?error=admin-required` (Story 1.6 guard, unchanged).
- **"last admin" rejection** (AC 3) — the rule generalises safely to: **reject any revoke that would drop the admin count to zero** (`target.isAdmin === true && adminCount <= 1`). The "last admin who is not me" case cannot occur — a non-admin cannot call the action (`requireAdmin()` blocks them), so the only reachable last-admin revoke is self-revoke. Return `{ ok: false, code: "LAST_ADMIN", message: "Не можна зняти роль з останнього адміністратора." }`. UI also disables the button in this state, but the **server** is the check (FR-2/NFR-1: hiding a control is not access control).
- **"all three are Server Actions under `requireAdmin()`"** (AC 4) — `grantAdmin(userId)` and `revokeAdmin(userId)` are `"use server"` actions, first line `await requireAdmin()`. The user **list** is a `src/data` read called from the `/admin/people` Server Component, which is already behind the `/admin` layout guard (`requireAdminPage()`, Story 1.6) — it is an admin-only query by construction.
- **Confirmation on revoke** — EXPERIENCE.md Interaction Primitives + UX-DR10: "зняти роль" is in the list of actions that use a shadcn `Dialog` (not native `confirm()`), destructive confirm button. Grant needs no confirmation. Add shadcn `dialog` as-is (base-nova defaults, like `sonner` in Story 1.6). The reusable `ConfirmDialog` wrapper is Story 2.2 — do **not** build it here; a local dialog on the revoke button is enough.
- **This story replaces the Story 1.6 demo.** Delete `src/actions/admin-ping.ts` and `src/components/admin-ping-button.tsx`; remove the demo button from `src/app/admin/page.tsx`. Keep `src/actions/result.ts` — it is now real shared infrastructure.
- **No schema migration.** `User.isAdmin` (boolean, `@default(false)`) already exists (Story 1.4). This story adds no columns and no migration. If you catch yourself running `prisma migrate dev`, stop — nothing in `schema.prisma` changes.
- **Scope guard. In scope:** `/admin/people` page + the user list read + `grantAdmin` / `revokeAdmin` actions + the last-admin guard + the revoke confirm dialog + deleting the 1.6 demo + a link from `/admin` to `/admin/people`. **Not in scope:** the public shell / discipline nav / `/` → `/classic` (Story 1.8); the reusable `ConfirmDialog` / `Toast` / `Skeleton` / `EmptyState` (Story 2.2); admin chrome / sidebar / a real `/admin` dashboard; any tournament/team/domain code; email invitations; audit log; `session.cookieCache`; Better Auth `admin` plugin.

## Tasks / Subtasks

- [ ] **Task 1 — User data functions** `src/data/users.ts` (NEW) (AC: 1, 2, 3, 4)
  - [ ] `listAuthenticatedUsers()` → `db.user.findMany({ where: { accounts: { some: {} } }, orderBy: [{ isAdmin: "desc" }, { name: "asc" }, { email: "asc" }], select: { id: true, name: true, email: true, image: true, isAdmin: true, createdAt: true } })`. Returns the admin-only list (drafts/DRAFT filter is an AD-7 concern for tournaments, N/A here).
  - [ ] `setUserIsAdmin(id: string, isAdmin: boolean)` → `db.user.update({ where: { id }, data: { isAdmin }, select: { id: true, isAdmin: true } })`.
  - [ ] `countAdmins()` → `db.user.count({ where: { isAdmin: true } })`.
  - [ ] `getUserById(id: string)` → `db.user.findUnique({ where: { id }, select: { id: true, isAdmin: true } })` — for existence + current-role checks in the actions.
  - [ ] Import `db` from `@/data/client`. `src/data/**` lint block: no `next`/`react`/`actions`/`auth`/view — this file imports only `db` + generated types. Compliant.
  - [ ] `src/data/README.md` — add `users.ts` to the "named functions" list; note "authenticated users" = has ≥1 `Account`.
- [ ] **Task 2 — Grant / revoke Server Actions** `src/actions/admin-roles.ts` (NEW) (AC: 1, 2, 3, 4)
  - [ ] `"use server"` file. Both actions: first line `const me = await requireAdmin();` (`requireAdmin` returns the acting user — Story 1.6).
  - [ ] `grantAdmin(userId: string): Promise<ActionResult<{ id: string }>>`:
    ```ts
    const target = await getUserById(userId);
    if (!target) return { ok: false, code: "NOT_FOUND", message: "Користувача не знайдено." };
    if (!target.isAdmin) await setUserIsAdmin(userId, true);   // idempotent
    revalidatePath("/admin/people");
    return { ok: true, data: { id: userId } };
    ```
  - [ ] `revokeAdmin(userId: string): Promise<ActionResult<{ id: string }>>`:
    ```ts
    const target = await getUserById(userId);
    if (!target) return { ok: false, code: "NOT_FOUND", message: "Користувача не знайдено." };
    if (target.isAdmin && (await countAdmins()) <= 1) {
      return { ok: false, code: "LAST_ADMIN", message: "Не можна зняти роль з останнього адміністратора." };
    }
    if (target.isAdmin) await setUserIsAdmin(userId, false);   // idempotent
    revalidatePath("/admin/people");
    return { ok: true, data: { id: userId } };
    ```
  - [ ] Wrap the `countAdmins()` + `setUserIsAdmin(false)` pair in `db.$transaction(async (tx) => …)` **or** accept the tiny read-committed race (two admins self-revoking at the same millisecond). Recommended: transaction with the count re-checked inside. Document the choice.
  - [ ] Errors are returned, not thrown (AC wants a rejection the UI can show). `requireAdmin()`'s `AdminRequiredError` is still mapped by `toActionError` if you prefer try/catch — but the reachable failures here (`NOT_FOUND`, `LAST_ADMIN`) are plain returns.
  - [ ] `revalidatePath("/admin/people")` after every successful write (Consistency Conventions: `revalidatePath` after each mutation).
  - [ ] `src/actions/README.md` — replace the `admin-ping.ts` bullet with `admin-roles.ts` (`grantAdmin` / `revokeAdmin`, `requireAdmin()` first line, last-admin guard).
- [ ] **Task 3 — Extend `ActionErrorCode`** `src/actions/result.ts` (UPDATE) (AC: 3)
  - [ ] `export type ActionErrorCode = "FORBIDDEN" | "LAST_ADMIN" | "NOT_FOUND";`
  - [ ] Nothing else changes — `ActionError` / `ActionResult` / `toActionError` already derive from it.
- [ ] **Task 4 — `/admin/people` page** `src/app/admin/people/page.tsx` (NEW) (AC: 1, 2, 3)
  - [ ] Server Component. No own guard needed — `src/app/admin/layout.tsx` (`requireAdminPage()`, Story 1.6) already gates `/admin/**`.
  - [ ] Read: `const me = await getSessionUser();` (from `@/auth/requireAdmin`, `cache()`-wrapped — no extra DB hit), `const users = await listAuthenticatedUsers();`, `const adminCount = await countAdmins();`.
  - [ ] Heading `<h1 className="text-2xl font-bold">Керування адмінами</h1>` + one line: "Роль адміна дає доступ до керування турнірами."
  - [ ] Render `users` as a plain list (`<ul>` / `<div>` rows — **no** shadcn `table`). Each row: `Avatar` (existing `@/components/ui/avatar`, `AvatarImage src={user.image}` + `AvatarFallback` = first letter of name/email), name (or email if no name), email in `text-muted-foreground`, and for the current user a "(ви)" marker.
  - [ ] Per-row action, passed to the client component (Task 5):
    - `!user.isAdmin` → grant control.
    - `user.isAdmin && user.id !== me.id` → revoke control.
    - `user.isAdmin && user.id === me.id` → revoke control with `isSelf`; `disabled` when `adminCount <= 1`, with visible text "Ви єдиний адміністратор".
  - [ ] Empty list (only possible before anyone but the seed admin has an account, and the seed admin always shows) → a plain "Ще ніхто не входив." line. Do not build the `EmptyState` component (Story 2.2).
  - [ ] `LayoutProps` / `PageProps` not needed (no params). `/admin/people` inherits `dynamic` from the layout's `headers()` use.
- [ ] **Task 5 — Grant / revoke client controls** `src/components/admin-role-controls.tsx` (NEW) (AC: 1, 2, 3)
  - [ ] `"use client"`. Exports `GrantAdminButton` and `RevokeAdminButton` (or one `AdminRoleControl` with a `mode` prop — keep it small).
  - [ ] `GrantAdminButton({ userId })` — `Button` "Надати доступ", `useTransition`, calls `grantAdmin(userId)`; on `res.ok` → `toast.success("Доступ надано")`; else `toast.error(res.message)`. Try/catch around the call → generic error toast (pattern from the Story 1.6 review fix on `admin-ping-button`).
  - [ ] `RevokeAdminButton({ userId, isSelf, disabled })` — `Button` "Зняти доступ" (`variant="destructive"`), opens a shadcn `Dialog` (title "Зняти роль адміна?", body names the consequence, confirm button `variant="destructive"` "Зняти", cancel "Скасувати"). Confirm → `useTransition` → `revokeAdmin(userId)`; on `res.ok` → `toast.success("Доступ знято")` + close dialog; on `res.code === "LAST_ADMIN"` → `toast.error(res.message)` + close; else `toast.error(res.message)`. Try/catch → generic error toast.
  - [ ] `disabled` prop short-circuits: render the button `disabled`, no dialog.
  - [ ] After a successful **self**-revoke (`isSelf` and `res.ok`), `router.push("/")` — the admin has just dropped their own access; leaving them on `/admin/people` means the next click redirects them anyway. Non-self revoke stays on the page (the list revalidates).
  - [ ] Imports the actions from `@/actions/admin-roles` (Client Components may import Server Actions). Imports `toast` from `sonner`. `src/components/**` lint block forbids `@/auth` — not used here.
- [ ] **Task 6 — shadcn `dialog`** (AC: 2)
  - [ ] `pnpm dlx shadcn@latest add dialog` → `src/components/ui/dialog.tsx` (base-nova defaults, no brand edits — DESIGN.md "as-is zі shadcn"). Confirm it adds no runtime dependency beyond what `@base-ui/react` already provides (base-nova `Dialog` = `@base-ui/react` `Dialog`, same as `dropdown-menu`). If it pulls an unexpected package, stop and flag (Story 1.6 hit this with `sonner` → `next-themes`).
  - [ ] No `<DialogProvider>` / portal wiring needed in `layout.tsx` — base-nova `Dialog` self-portals (same as the existing `DropdownMenu`).
- [ ] **Task 7 — Remove the Story 1.6 demo** (housekeeping)
  - [ ] Delete `src/actions/admin-ping.ts` and `src/components/admin-ping-button.tsx`.
  - [ ] `src/app/admin/page.tsx` — remove `<AdminPingButton />` and its import; replace with a link to `/admin/people` (`<Link href="/admin/people">Керування адмінами</Link>` — `next/link`). Keep the "Адмін-зона" heading + one line.
  - [ ] `src/actions/README.md` — drop the `admin-ping.ts` line (Task 2 already adds the `admin-roles.ts` line).
  - [ ] `grep -rn "adminPing\|admin-ping\|AdminPingButton" src/` must return nothing after this task.
- [ ] **Task 8 — Docs** (housekeeping)
  - [ ] `src/data/README.md` — `users.ts` functions + "authenticated user" definition (done in Task 1).
  - [ ] `src/actions/README.md` — `admin-roles.ts` (done in Task 2).
  - [ ] `AGENTS.md` — one line under "Conventions": grant/revoke admin = `grantAdmin` / `revokeAdmin` in `src/actions/admin-roles.ts`; last admin cannot be demoted; `/admin/people` is the surface.
  - [ ] `EXPERIENCE.md` is **not** updated here (out of doc scope, consistent with Story 1.6). The `/admin/people` behaviour is captured in this story + `src/actions/README.md`.
- [ ] **Task 9 — Verification gate** (AC: all)
  - [ ] `pnpm lint` + `pnpm typecheck` + `pnpm build` clean on Node 24. `/admin/people` shows as **dynamic** (ƒ). `/` and `/sign-in` still **static** (○).
  - [ ] `grep -rn "adminPing\|AdminPingButton" src/` → empty.
  - [ ] **Manual (`pnpm dev`, or prod after deploy):**
    - as the seed admin, open `/admin/people` → the list shows every user with a linked Google account; the seed admin row is marked "(ви)" and its "Зняти доступ" is disabled ("Ви єдиний адміністратор") **when they are the only admin**.
    - sign in (other browser / incognito) as a **second** Google account → that user now appears in the list as non-admin.
    - as admin, click "Надати доступ" for the second user → toast "Доступ надано", row flips to admin.
    - in the second user's session, open `/admin` → it now renders (no re-login).
    - as admin, "Зняти доступ" for the second user → confirm dialog → "Зняти" → toast, row flips back; second user's next `/admin` load redirects to `/` with the toast.
    - as admin (now the only admin again), try "Зняти доступ" on your own row → button disabled; and via the server (below) the action returns `LAST_ADMIN`.
    - **Server-side proof (UI bypassed):** with **two** admins, POST the `revokeAdmin` Next-Action for your own id with a **non-admin** session cookie (or no cookie) → `{ ok: false, code: "FORBIDDEN" }`. With an admin session and `adminCount === 1`, POST `revokeAdmin(me.id)` → `{ ok: false, code: "LAST_ADMIN" }`. Capture how you exercised it (the Story 1.6 pattern: read the action id from `.next/dev/server/app/**/server-reference-manifest.json`, `curl -X POST <page> -H 'Next-Action: <id>' -H 'Content-Type: text/plain;charset=UTF-8' --data-raw '["<userId>"]'`).
  - [ ] Capture command output + the manual walkthrough (which accounts, what happened) in the Dev Agent Record.
- [ ] **Task 10 — Commit** — `feat(admin): grant/revoke admin on /admin/people (Story 1.7)`. Commit to `main`; push deploys to Vercel (prod auth configured in Story 1.5).

## Dev Notes

### What this story is / is NOT

**Is:** the `/admin/people` user list, `grantAdmin` / `revokeAdmin` Server Actions with the last-admin guard, the first real `src/data` entity functions (`src/data/users.ts`), the revoke confirm dialog, and the removal of the Story 1.6 demo.

**Is NOT** (do not pull forward):
- Public shell, discipline nav (`Класичний · Пляжний · Архів`), `/` → `/classic`, real landing page → **Story 1.8**.
- Reusable `ConfirmDialog` / `Toast` helper / `Skeleton` / `EmptyState` → **Story 2.2**. Use a local `Dialog` and inline empty text here.
- Admin dashboard / sidebar / nav chrome. `/admin` stays a minimal page with a link to `/admin/people`.
- `session.cookieCache`, session invalidation on role change, Better Auth `admin` plugin, email invites, audit log.
- Any tournament/team/domain code, any `src/data` function beyond `users.ts`.
- A migration — `isAdmin` already exists.

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/data/users.ts` | NEW | `listAuthenticatedUsers`, `setUserIsAdmin`, `countAdmins`, `getUserById`. First real `src/data` entity module. |
| `src/actions/admin-roles.ts` | NEW | `grantAdmin(userId)`, `revokeAdmin(userId)` — `requireAdmin()` first line, last-admin guard, `revalidatePath`. |
| `src/actions/result.ts` | UPDATE | `ActionErrorCode` gains `"LAST_ADMIN" | "NOT_FOUND"`. |
| `src/app/admin/people/page.tsx` | NEW | Server Component list; inherits the `/admin` layout guard. |
| `src/components/admin-role-controls.tsx` | NEW | client grant button + revoke button with confirm `Dialog`. |
| `src/components/ui/dialog.tsx` | NEW | `pnpm dlx shadcn add dialog` (base-nova as-is). |
| `src/app/admin/page.tsx` | UPDATE | drop the demo button; add a `next/link` to `/admin/people`. |
| `src/actions/admin-ping.ts` | DELETE | Story 1.6 demo. |
| `src/components/admin-ping-button.tsx` | DELETE | Story 1.6 demo. |
| `src/data/README.md`, `src/actions/README.md`, `AGENTS.md` | UPDATE | new functions / conventions. |
| `package.json` / `pnpm-lock.yaml` | UPDATE | `+ @base-ui/react` sub-path or nothing new (verify what `dialog` pulls). |
| `src/app/page.tsx`, `src/app/layout.tsx` | DO NOT TOUCH | Story 1.8 / no change needed. |
| `prisma/schema.prisma`, `prisma/migrations/**` | DO NOT TOUCH | no schema change. |

### Architecture compliance

- **AD-6** — every mutation is a Server Action, first line `await requireAdmin()`. `grantAdmin` / `revokeAdmin` are the only write path to `User.isAdmin`. Role = boolean `User.isAdmin`. [ARCHITECTURE-SPINE.md#AD-6]
- **AD-11** — `src/data/users.ts` is the sole owner/writer of the `User` entity's role field. `src/actions` and `src/app` never call Prisma directly — they call `listAuthenticatedUsers` / `setUserIsAdmin` / `countAdmins` / `getUserById`. Enforced by `eslint.config.mjs` (Prisma-client ban outside `src/data`). [ARCHITECTURE-SPINE.md#AD-11]
- **AD-3** — layer direction: `view (admin/people/page.tsx) → data (users.ts)` for the read; `view → shell (admin-roles.ts) → {auth, data}` for the writes. `src/data` imports nothing upward. The client control imports the Server Action (sanctioned view→shell edge). [src/README.md]
- **AD-7 not touched** — public reads are unaffected; `/admin/people` is admin-only by the layout guard.
- **Consistency Conventions** — Server Action names are verbs (`grantAdmin`, `revokeAdmin`); `ActionResult` = `{ ok: true, data } | { ok: false, code, message }`; `revalidatePath` after each write; a typed failure maps to `{ ok: false, code, message }`. [ARCHITECTURE-SPINE.md#Consistency Conventions]
- **FR-2 / NFR-1** — the last-admin rule and the role check are enforced on the **server**. The disabled button is UX only. The Task 9 server-side proof exercises the action with the UI bypassed. [SPEC.md#CAP-1, PRD FR-2/FR-3]
- **Story 1.3 ESLint** — `src/data/**` may not import `next`/`react`/`actions`/`auth`/view; `src/actions/**` has no block (convention only — may import `domain`/`data`/`auth`); `src/components/**` is blocked from `@/auth` (not used in the control). Confirm `pnpm lint` stays green.
- **DESIGN.md / EXPERIENCE.md** — `Dialog` and `Button` (non-primary) used as-is; revoke confirm button is `destructive` (`#C4342B`); one primary action per screen; plain factual UA copy, no exclamation marks; `lang="uk"`; touch targets — base-nova sizing is the known deferred a11y item (do not fix here).

### Data model & "who has signed in"

- `User` (`@@map("user")`): `id` (cuid), `name?`, `email` (unique), `emailVerified`, `image?`, `isAdmin` (`@default(false)`), `createdAt`, `updatedAt`, relations `sessions[]`, `accounts[]`. No change this story.
- `Account` (`@@map("account")`): one row per linked provider identity, `@@unique([issuer, accountId])`. Persists across sign-outs. **"Signed in at least once" ⇔ `accounts: { some: {} }`.** `session` rows expire and are pruned, so do not filter on `sessions`.
- The seed admin (`SEED_ADMIN_EMAIL`, Story 1.4/1.5) has `isAdmin: true` and — after the Story 1.5 first sign-in — one `account`. So it always appears in `listAuthenticatedUsers()`.
- Better Auth reads `isAdmin` (a `user.additionalFields` entry, `input: false`) fresh on every `auth.api.getSession`. No `cookieCache` ⇒ a role change takes effect on the target's next request. Story 1.6's `requireAdminPage()` / `requireAdmin()` are unchanged.

### Server Action invocation shape (Story 1.6 established this)

- `"use server"` file; every export is an async function. `const me = await requireAdmin()` returns the acting `user` (has `id`, `isAdmin`). Throwing `AdminRequiredError` for a non-admin is mapped to `{ ok: false, code: "FORBIDDEN" }` by `toActionError` — but here the reachable business failures (`LAST_ADMIN`, `NOT_FOUND`) are plain `return`s, not throws.
- Client calls the action inside `startTransition(async () => { try { … } catch { toast.error("…") } })` — the try/catch is the Story 1.6 review fix (an unexpected throw, e.g. DB down, must not leave the button dead).
- `revalidatePath("/admin/people")` from `next/cache` after a successful write so the Server Component list re-renders with the new role.

### Confirm dialog (revoke only)

- EXPERIENCE.md: destructive/irreversible actions use a shadcn `Dialog`, never native `confirm()` (native dialogs block the event loop — see AGENTS.md "browser dialogs"). Confirm button `variant="destructive"`.
- base-nova `Dialog` (from `@base-ui/react`) self-portals — no provider in `layout.tsx`. Same family as the working `DropdownMenu` (Story 1.5). Watch for the base-nova `Menu.Group`/`Menu.GroupLabel` class of gotcha (Story 1.5 `MenuGroupContext` crash): use the dialog parts exactly as `shadcn add dialog` generates them.
- Grant is not destructive → no dialog, direct action + toast.

### Testing requirements

- **No unit tests / no Vitest.** No `src/domain` code — the last-admin rule is orchestration (`countAdmins()` + acting-user id), kept inline in `revokeAdmin`. Setting up Vitest for a 3-line predicate is disproportionate and out of this story's scope; the first real domain engine (Epic 3) brings the runner. (If a reviewer wants the rule extracted to `src/domain/adminRules.ts`, that is a follow-up that also lands Vitest — flag, don't do it here.)
- The gate is operational (Task 9): `lint` + `typecheck` + `build` clean; `/admin/people` dynamic; a manual walkthrough of grant → instant access → revoke → redirect, and a **server-side** check that (a) a non-admin gets `FORBIDDEN` and (b) the sole admin gets `LAST_ADMIN`, both independent of the UI.
- Capture real command output + the walkthrough (which accounts, what happened) in the Dev Agent Record — verifiable, not asserted (Stories 1.1–1.6 pattern).

### Previous story intelligence

**Story 1.6 (done, deployed):**
- `src/auth/requireAdmin.ts` — `requireAdmin()` (throws `AdminRequiredError`, returns the user), `requireAdminPage()` (redirects), `getSessionUser()` (`cache()`-wrapped, `session.user | null`). Import guards from `@/auth/requireAdmin`, never `@/auth/auth`, in `src/app/**`.
- `src/actions/result.ts` — `ActionResult<T>`, `ActionError`, `ActionErrorCode` (currently `"FORBIDDEN"`), `toActionError`. This story extends `ActionErrorCode`.
- `src/app/admin/layout.tsx` — `await requireAdminPage()` gates all `/admin/**`. `/admin/people` needs no own guard.
- `src/components/flash-toaster.tsx` + `src/components/ui/sonner.tsx` (light-only, `theme="light"`, no `next-themes`) — `<Toaster />` + `<FlashToaster />` mounted in `src/app/layout.tsx`. `toast` imported from `sonner`.
- Client action calls wrap in `useTransition` + `try/catch` + toast (review fix). Give repeat toasts a stable `id` if needed.
- `shadcn add` lands in `src/components/ui/` — base-nova, no brand edits. `avatar` / `button` / `card` / `dropdown-menu` / `sonner` present; `dialog` is new here. **Verify what a new shadcn component pulls in** — `sonner` unexpectedly added `next-themes`, which was then removed.
- Server-action HTTP probe for the verification gate: action id from `.next/dev/server/app/<route>/page/server-reference-manifest.json`, `POST` to any page path with `Next-Action: <id>`, `Content-Type: text/plain;charset=UTF-8`, body `["arg1"]`.
- Toolchain: **PowerShell** for `pnpm` / `prisma` / `npx` / `vercel`; `git` via `C:\Program Files\Git\cmd\git.exe`. Background `pnpm dev` via the Bash tool's `run_in_background`. Working dir can drift after `cd` — prefer `pnpm -C <path>` / absolute paths.
- Deferred (from 1.5/1.6, relevant here): `session.cookieCache` off (intentional — makes grant instant); base-nova touch targets < 44px (design-system pass); a role-revoked user viewing a stale `/admin` via the client Router Cache is not reachable pre-1.7 but becomes reachable now — **confirm a soft-nav back to `/admin` after revoke re-runs the guard** (Next 16 does not client-cache dynamic routes by default, so it should; verify in the walkthrough).

**Story 1.3 (done):** `src/data/` had only `client.ts` + README; this story adds the first query/write module. `src/actions/**` has no ESLint block — the "may import domain/data/auth" rule is convention (README).

### Git intelligence

Recent: `a5a1257` (1.6 review patches) ← `7d4583f` (1.6 guard + gate) ← `feeaac8` (1.5 prod). `src/data/` = `client.ts` + `README.md` only. `src/actions/` = `result.ts` + `admin-ping.ts` (to be deleted) + `README.md`. `src/app/admin/` = `layout.tsx` + `page.tsx`. No `/admin/people`. `dialog` not installed. `isAdmin` column exists since `20260903105840_init_user` / reconciled in `20260903115000_add_better_auth`.

### Latest tech information

- **Next.js 16** — `revalidatePath` from `next/cache` (server-only). Server Actions in `"use server"` files; Client Components import and call them. `redirect()` unchanged. Typed routes: `/admin/people` is a static path, no `PageProps` needed.
- **Better Auth 1.7.x** — `session.user.isAdmin` typed via `additionalFields` + client `inferAdditionalFields`. `auth.api.getSession` is the server read; no cookie cache configured. There is a first-party Better Auth `admin` plugin (ban/impersonate/role) — **not** used; v1 role model is the single `isAdmin` boolean per AD-6.
- **Prisma 7** — `db.user.findMany({ where: { accounts: { some: {} } } })` relation filter; `db.user.count`; `db.$transaction(async (tx) => …)` for the count+update atomicity option. Generated client at `@/generated/prisma/client`.
- **shadcn `dialog` (base-nova)** — `@base-ui/react` `Dialog`, self-portalling. No new runtime dep expected (verify).
- No security advisories for these versions.

### Project context reference

No `project-context.md`. Binding docs: `ARCHITECTURE-SPINE.md` (AD-6, AD-7, AD-11, Consistency Conventions), `epics.md` (Story 1.7 AC + Epic 1 demo criterion "наявний адмін призначає другого" + Stories 1.6/1.8 boundaries), `SPEC.md` (CAP-1: "після сідінгу перший адмін може надати роль другому"; Constraints: "further admins granted in-app"), PRD §4.1 FR-3 ("список … лише тих, хто вже входив"; "не може зняти роль сам із себе, якщо він останній Адмін"; assumption: revoke is desirable-not-critical), `EXPERIENCE.md` (IA `/admin/people`, "Керування адмінами"; Interaction Primitives — Dialog for "зняти роль", destructive confirm), `DESIGN.md` (Dialog/Button as-is, destructive colour), `AGENTS.md`, `src/data/README.md` + `src/actions/README.md` + `src/auth/README.md` (Story 1.3 contracts), `1-6-require-admin-access-control.md` (guard surface, `ActionResult`, demo to remove, deferred items).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.7: Керування адмінами] — user story + AC (grant, revoke, last-admin rejection, all three under `requireAdmin()`)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1] — demo criterion: "наявний адмін призначає другого"
- [Source: _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md#FR-3] — "список … лише тих, хто вже входив"; "не може зняти роль сам із себе, якщо він останній Адмін"; revoke = desirable, not v1-critical
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#CAP-1] — "після сідінгу перший адмін може надати роль другому"; "further admins granted in-app"
- [Source: _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md#AD-6] — Server Action first line `await requireAdmin()`; role = `User.isAdmin`; grant/revoke also under `requireAdmin()`
- [Source: …/ARCHITECTURE-SPINE.md#AD-11] — `src/data` is the sole Prisma importer + sole read/write path per entity
- [Source: …/ARCHITECTURE-SPINE.md#Consistency Conventions] — verb action names; `{ ok, data | code, message }`; `revalidatePath` after each write
- [Source: …/ARCHITECTURE-SPINE.md#Capability → Architecture Map] — "Вхід через Google, ролі (FR-1..FR-3) → `src/auth`, `src/actions/admin`"
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md#Information Architecture] — `/admin/people` "Керування адмінами"; surface-closure CAP-1 → `/sign-in` + `/admin/people`
- [Source: …/EXPERIENCE.md#Interaction Primitives] — "зняти роль" → shadcn `Dialog`, not native `confirm()`; confirm button `destructive`
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md#Components] — Dialog / Button (non-primary) as-is; `#C4342B` destructive only for destructive actions incl. "зняти роль адміна"
- [Source: _bmad-output/implementation-artifacts/1-6-require-admin-access-control.md] — `requireAdmin()` returns the user; `ActionResult` / `ActionErrorCode` / `toActionError`; demo (`admin-ping`) to be replaced; client action try/catch pattern; server-action HTTP probe; deferred `cookieCache`
- [Source: _bmad-output/implementation-artifacts/1-3-domain-scaffold-boundaries.md] — `src/data` / `src/actions` boundaries and conventions
- [Source: AGENTS.md] — pnpm + PowerShell; no schema change without a migration; secrets via env; browser dialogs block — use shadcn `Dialog`
- Web: [Better Auth – admin plugin (not used, for context)](https://www.better-auth.com/docs/plugins/admin), [Next.js – revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath), [shadcn/ui – dialog](https://ui.shadcn.com/docs/components/dialog)

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
