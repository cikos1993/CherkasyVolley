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

Status: review

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

- [x] **Task 1 — User data functions** `src/data/users.ts` (NEW) (AC: 1, 2, 3, 4)
  - [x] `listAuthenticatedUsers()` → `db.user.findMany({ where: { accounts: { some: {} } }, orderBy: [{ isAdmin: "desc" }, { name: "asc" }, { email: "asc" }], select: { id, name, email, image, isAdmin, createdAt } })`.
  - [x] `countAdmins()` → `db.user.count({ where: { isAdmin: true } })`.
  - [x] **`promoteToAdmin(id)` / `demoteFromAdmin(id)`** — the sole writers of `User.isAdmin`, each returns `{ outcome: "ok" | "not_found" | "last_admin" }`. **Deviation from the drafted `setUserIsAdmin` + `getUserById`:** the last-admin check must be atomic with the write, and `db.$transaction` may not be called from `src/actions` (raw-Prisma ban). So the transaction lives in `demoteFromAdmin` (count + update in one `db.$transaction`); `promoteToAdmin` is a plain idempotent update. The actions map the outcome — no `getUserById`/`countAdmins` calls from the action layer.
  - [x] Imports only `db` from `@/data/client`. `pnpm lint` green.
  - [x] `src/data/README.md` — `users.ts` documented; "authenticated user" = has ≥1 `account`.
- [x] **Task 2 — Grant / revoke Server Actions** `src/actions/admin-roles.ts` (NEW) (AC: 1, 2, 3, 4)
  - [x] `"use server"` file. Both actions: first line `await requireAdmin()`, wrapped in `try/catch` → `toActionError(error)` (maps `AdminRequiredError` → `FORBIDDEN`, re-throws the rest).
  - [x] `grantAdmin(userId)` → `promoteToAdmin`; `not_found` → `{ ok: false, code: "NOT_FOUND" }`; else `revalidatePath("/admin/people")`, `{ ok: true, data: { id } }`.
  - [x] `revokeAdmin(userId)` → `demoteFromAdmin`; `not_found` → `NOT_FOUND`; `last_admin` → `{ ok: false, code: "LAST_ADMIN", message: "Не можна зняти роль з останнього адміністратора." }`; else `revalidatePath`, `{ ok: true }`.
  - [x] Last-admin check is target-based (any revoke that would zero the admin count) — the AC's "revoke from self as last admin" is the only reachable case (a non-admin can't call the action).
  - [x] Transaction: inside `demoteFromAdmin` (`src/data`), not the action — see Task 1 deviation note.
  - [x] `src/actions/README.md` — `admin-ping.ts` bullet replaced with `admin-roles.ts`.
- [x] **Task 3 — Extend `ActionErrorCode`** `src/actions/result.ts` (UPDATE) (AC: 3)
  - [x] `export type ActionErrorCode = "FORBIDDEN" | "LAST_ADMIN" | "NOT_FOUND";` — nothing else changed.
- [x] **Task 4 — `/admin/people` page** `src/app/admin/people/page.tsx` (NEW) (AC: 1, 2, 3)
  - [x] Server Component; no own guard (inherits `requireAdminPage()` from `src/app/admin/layout.tsx`).
  - [x] `Promise.all([getSessionUser(), listAuthenticatedUsers(), countAdmins()])`.
  - [x] `← Адмін-зона` back-link, `<h1>Керування адмінами</h1>`, one line "Роль адміна дає доступ до керування турнірами."
  - [x] Plain `<ul className="divide-y">` (no shadcn `table`); each row: `Avatar` (image or initials fallback), name-or-email, "(ви)" marker on the current user, email in `text-muted-foreground`.
  - [x] Per-row: `!isAdmin` → `<GrantAdminButton>`; `isAdmin` → `<RevokeAdminButton isSelf disabled={isSelf && adminCount<=1}>` with "Ви єдиний адміністратор" text when disabled.
  - [x] Empty list → "Ще ніхто не входив." (no `EmptyState` component).
- [x] **Task 5 — Grant / revoke client controls** `src/components/admin-role-controls.tsx` (NEW) (AC: 1, 2, 3)
  - [x] `"use client"`. `GrantAdminButton` (`variant="outline"`) + `RevokeAdminButton` (`variant="destructive"`).
  - [x] Grant: `useTransition` → `grantAdmin(userId)` → success/error toast; `try/catch` → generic toast.
  - [x] Revoke: shadcn `Dialog` (controlled `open`), title "Зняти роль адміна?", consequence body (self vs other wording), confirm `Button variant="destructive"` "Зняти", `DialogClose` "Скасувати". Confirm → `revokeAdmin(userId)` → close + toast; `try/catch` → generic toast.
  - [x] `disabled` prop → renders a plain disabled destructive button, no dialog (hooks still called before the early return).
  - [x] Successful **self**-revoke → `router.push("/")`.
  - [x] Imports actions from `@/actions/admin-roles`, `toast` from `sonner`. No `@/auth` import.
- [x] **Task 6 — shadcn `dialog`** (AC: 2)
  - [x] `pnpm dlx shadcn@latest add dialog` → `src/components/ui/dialog.tsx` (`@base-ui/react/dialog`, self-portalling). **No new dependency** — `package.json` / `pnpm-lock.yaml` unchanged. Declined the CLI's offer to overwrite `button.tsx` (base-nova re-lists it as a dep; our branded `button.tsx` must stay).
  - [x] No `layout.tsx` wiring needed.
- [x] **Task 7 — Remove the Story 1.6 demo** (housekeeping)
  - [x] Deleted `src/actions/admin-ping.ts`, `src/components/admin-ping-button.tsx`.
  - [x] `src/app/admin/page.tsx` — demo button gone; `<Link href="/admin/people">Керування адмінами</Link>` added; heading + line kept.
  - [x] `src/actions/README.md` — `admin-ping.ts` line dropped.
  - [x] `grep -rn "adminPing\|admin-ping\|AdminPingButton" src/` → empty.
- [x] **Task 8 — Docs** (housekeeping)
  - [x] `src/data/README.md`, `src/actions/README.md` (Tasks 1–2).
  - [x] `AGENTS.md` — one line: `grantAdmin` / `revokeAdmin` in `src/actions/admin-roles.ts`, `/admin/people` surface, `promoteToAdmin` / `demoteFromAdmin` sole writers, last admin protected in a transaction.
  - [x] `EXPERIENCE.md` not touched (out of doc scope, as planned).
- [x] **Task 9 — Verification gate** (AC: all)
  - [x] `pnpm lint` (exit 0) + `pnpm typecheck` (exit 0) + `pnpm build` clean on Node 24. `/admin/people` **dynamic** (ƒ); `/` and `/sign-in` **static** (○) — see Debug Log.
  - [x] `grep -rn "adminPing\|AdminPingButton" src/` → empty.
  - [x] **Automated / data-layer:**
    - anonymous `GET /admin/people` → `307` → `location: /sign-in?from=/admin` (inherited layout guard). `GET /admin` unchanged.
    - server-side (UI bypassed, no session): `POST` `grantAdmin` and `revokeAdmin` Next-Action → both `{"ok":false,"code":"FORBIDDEN","message":"Потрібні права адміністратора"}`.
    - data layer against the live DB (non-destructive, `adminCount === 1`): `demoteFromAdmin(<sole admin id>)` → `{ outcome: "last_admin" }` **with no write** (`adminCount` unchanged); `demoteFromAdmin(<bad id>)` → `{ outcome: "not_found" }`; `promoteToAdmin(<existing admin>)` → `{ outcome: "ok" }` idempotent. `listAuthenticatedUsers()` returns the seed admin + the existing second account (`kiperandrii@gmail.com`, `isAdmin=false`).
  - [~] **Browser click-through** (needs the two Google sessions — same as Story 1.5/1.6): grant the second user → they open `/admin` with no re-login → revoke via the confirm dialog → they're redirected out. **Pending user confirmation** (every server-side path above is verified).
  - [x] Command output captured in the Dev Agent Record.
- [x] **Task 10 — Commit** — `feat(admin): grant/revoke admin on /admin/people (Story 1.7)`. Committed to `main`; push deploys to Vercel.

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

claude-sonnet-5

### Debug Log References

**`pnpm build`** (Node 24, Turbopack):

```
✓ Compiled successfully
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /admin
├ ƒ /admin/people
├ ƒ /api/auth/[...all]
└ ○ /sign-in
```

`/admin/people` is dynamic (ƒ, inherits `headers()` via the layout guard); `/` and `/sign-in` stay static (○).
`pnpm typecheck` → exit 0. `pnpm lint` → exit 0. `grep -rn "adminPing\|admin-ping\|AdminPingButton" src/` → no matches.

**Manual (dev server on :3111):**

```
$ curl -sD- http://localhost:3111/admin/people        # anonymous
HTTP/1.1 307 Temporary Redirect
location: /sign-in?from=/admin

$ curl -s -X POST http://localhost:3111/sign-in \
    -H 'Next-Action: 40276fdf223ba2909f9a5cdad3ee025678795546ea' \  # grantAdmin
    -H 'Content-Type: text/plain;charset=UTF-8' --data-raw '["cktest…"]'   # no session
1:{"ok":false,"code":"FORBIDDEN","message":"Потрібні права адміністратора"}

$ curl … -H 'Next-Action: 40aff75cc2c9e0c74c1ecf500f94de389e123413ac' …   # revokeAdmin, no session
1:{"ok":false,"code":"FORBIDDEN","message":"Потрібні права адміністратора"}
```

**Data layer against the live DB** (throwaway `scripts/verify-admin-roles.mts`, run then deleted; non-destructive because `adminCount === 1`):

```
adminCount: 1   admins: [ nightfate1993@gmail.com ]
authenticatedUsers: [ nightfate1993@gmail.com isAdmin=true, kiperandrii@gmail.com isAdmin=false ]
demoteFromAdmin(nonexistent):  { outcome: 'not_found' }
demoteFromAdmin(sole admin):   { outcome: 'last_admin' }   # no write
promoteToAdmin(existing admin):{ outcome: 'ok' }           # idempotent
adminCount after: 1   # unchanged
```

### Completion Notes List

- **`src/data/users.ts`** — first real `src/data` entity module. Write path is two outcome-returning functions: `promoteToAdmin` (idempotent update) and `demoteFromAdmin` (`db.$transaction`: re-count admins inside the tx, refuse if `<= 1`, else clear). Consolidated from the drafted `setUserIsAdmin` + `getUserById` + action-side `db.$transaction` because **`src/actions` may not touch the Prisma client** (raw-Prisma ban / `src/data` README "callers get named functions, never a raw `PrismaClient`"). Keeping the transaction in `src/data` is both boundary-correct and race-safe against two simultaneous self-revokes.
- **Last-admin rule generalised** to "any revoke that would zero the admin count" (AC-interpretation note in this story sanctioned this). The self-only case is the only reachable one — a non-admin cannot reach the action.
- **AC 1 "immediate access"** — `isAdmin` is read from the DB on every `auth.api.getSession` (no `session.cookieCache`), so a granted user's next `/admin` request passes. `revalidatePath("/admin/people")` refreshes the acting admin's own list. Verified server-side that the guard + actions reject a non-admin; the grant→access→revoke **browser** click-through needs the two Google sessions and is left for user confirmation (Story 1.5/1.6 pattern). A real second non-admin (`kiperandrii@gmail.com`) already exists in the list.
- **AC 3 last-admin** — `demoteFromAdmin` returns `last_admin` and writes nothing when there is one admin; verified live (non-destructive) and the action maps it to `{ ok: false, code: "LAST_ADMIN" }`. The UI also disables the self-revoke button in this state.
- **Revoke confirm** — shadcn `dialog` added as-is (`@base-ui/react/dialog`, self-portalling, zero new deps). Declined the CLI's `button.tsx` overwrite to preserve the branded primary variant. Reusable `ConfirmDialog` remains Story 2.2.
- **Story 1.6 demo removed** — `admin-ping.ts` + `admin-ping-button.tsx` deleted; `/admin` now links to `/admin/people`.
- **No migration** — `User.isAdmin` already exists. `schema.prisma` / `prisma/migrations/**` untouched.
- **No unit tests / no Vitest** — no `src/domain` code; per the story's testing note the gate is operational (lint + typecheck + build + the anonymous/server-side/data-layer walkthrough above).

### File List

**New**
- `src/data/users.ts`
- `src/actions/admin-roles.ts`
- `src/app/admin/people/page.tsx`
- `src/components/admin-role-controls.tsx`
- `src/components/ui/dialog.tsx`

**Modified**
- `src/actions/result.ts` — `ActionErrorCode` += `"LAST_ADMIN" | "NOT_FOUND"`
- `src/app/admin/page.tsx` — demo button → link to `/admin/people`
- `src/data/README.md`, `src/actions/README.md`, `AGENTS.md`

**Deleted**
- `src/actions/admin-ping.ts`
- `src/components/admin-ping-button.tsx`

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-03 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
| 2026-09-03 | Implemented Tasks 1–10: `src/data/users.ts` (list + `promoteToAdmin` / `demoteFromAdmin` transactional last-admin guard), `grantAdmin` / `revokeAdmin` actions, `/admin/people` page + `admin-role-controls` (revoke confirm `Dialog`), removed the 1.6 demo. `lint`/`typecheck`/`build` green; anonymous redirect, server-side `FORBIDDEN`, and the last-admin / not-found / idempotency paths verified. Status: in-progress → review. |
