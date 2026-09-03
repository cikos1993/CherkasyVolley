---
baseline_commit: 81a5550
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - AGENTS.md
---

# Story 1.8: Public shell and menu

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a viewer,
I want to open the site and see the section structure,
so that I understand where to find tournaments and can start using it (FR-24).

## Acceptance Criteria

Translated from `epics.md` → Epic 1 → Story 1.8. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** a deployed application
**When** a viewer opens any page without signing in
**Then**

1. The top menu shows three independent items: `Класичний` · `Пляжний` · `Архів`.
2. `/beach` opens a "Незабаром" stub page with no tournament functionality.
3. `/classic` with no tournaments shows an empty state; `/archive` with no tournaments shows an empty state.
4. On a screen < 640px the menu stays usable for navigation (items collapse / stay reachable).
5. No entity of one section appears in another.

### Notes on AC interpretation

- **"Top menu … three independent items"** (AC 1) — the **Discipline nav** (DESIGN.md brand component / UX-DR3). "Independent" = switching `Класичний`↔`Пляжний`↔`Архів` is a full page navigation, not a tab; the active item does not carry `?tab` state (EXPERIENCE.md Component Patterns). Active item: `{colors.muted}` background, `{rounded.sm}`, weight 600 (mockup `directions-3-chosen-C.html` `.C .nav`). Inactive: `{colors.muted-foreground}`, 13px, `px-2.5 py-1.5`.
- **`/` → `/classic`** (EXPERIENCE.md IA: "`/` → редірект на `/classic`"). Replace the Next.js starter `src/app/page.tsx` with a `redirect("/classic")`. This is the AC's implicit landing behaviour — a viewer "opens the site" and lands on `/classic`.
- **"`/beach` … 'Незабаром' … no tournament functionality"** (AC 2) — a plain page: the shell + an empty state. Copy (EXPERIENCE.md Voice): «У розділі «Пляжний» ще немає турнірів. Незабаром.» No links into any tournament flow, no data fetch.
- **"empty state"** (AC 3) — DESIGN.md UX-DR9: dashed border, `{rounded.lg}` (14px), a `display`-register heading + one calm line (EXPERIENCE.md Voice: "Порожні стани — один спокійний рядок"). There are **no tournament entities yet** (the `Tournament` model is Epic 2, Story 2.1), so `/classic` and `/archive` are *always* empty in this story — render the empty state unconditionally. The "(адміну) кнопка «Створити турнір»" from EXPERIENCE.md State Patterns is **Epic 2** — do not add it here.
- **"< 640px … usable"** (AC 4) — the three items are short (`Класичний` / `Пляжний` / `Архів`); at 13px with tight gaps they fit well under 360px. Keep all three visible, just let the row sit comfortably (no horizontal page scroll). A `Sheet`/`⋯` collapse (EXPERIENCE.md "пункти в «⋯» за потреби") is **not needed** for three short words — do not build it. Verify at 360px that the nav is reachable and `body` does not scroll horizontally (UX-DR14).
- **"No entity of one section appears in another"** (AC 5) — AD-9: `discipline` is an enum, v1 filters `CLASSIC`; `BEACH` has no data. Since no entities exist yet, this is satisfied by the **route structure** (`/classic`, `/beach`, `/archive` are separate trees) and by `/beach` fetching nothing. Note it; there is nothing to filter.
- **The shell lives in the root layout.** `src/app/layout.tsx` already has a `<header>` with `<UserMenu />`. Add a wordmark link (→ `/classic`) and the `<DisciplineNav />` to that header. It then shows on every route (including `/admin`, `/sign-in`) — acceptable and minimal; a distinct admin chrome is a later concern. `UserMenu` already blanks itself on `/sign-in`.
- **Scope guard. In scope:** the discipline nav component, the header wiring, `/` → `/classic` redirect, `/classic` + `/beach` + `/archive` pages (each an empty state), a minimal `EmptyState` component, page `metadata`. **Not in scope:** any tournament/team/archive data or `src/data` function (Epic 2); the "Створити турнір" admin CTA on `/classic` (Epic 2); `/classic/[tournament]`, tabs, `/archive/[year]/...` (Epic 2 / 4); the reusable `Skeleton` / `Toast` / `ConfirmDialog` (Story 2.2); a `⋯`/Sheet mobile collapse; a real `not-found.tsx`; admin nav chrome; `/classic` → list rendering.

## Tasks / Subtasks

- [ ] **Task 1 — `EmptyState` component** `src/components/empty-state.tsx` (NEW) (AC: 2, 3)
  - [ ] Server-safe (no `"use client"`), presentational. Props: `title: string`, `children: ReactNode` (the one-line description).
  - [ ] Markup per DESIGN.md UX-DR9 / mockup `.C .empty`: a centered block, `border border-dashed`, `rounded-lg` (maps to the 14px token), generous padding (`p-8` / `p-10`), `text-center`. `title` in the `display` register — `text-2xl font-bold tracking-tight` (the `display-sm` scale is still un-tokenised, deferred from Story 1.2 — a plain class is fine, same as the `/admin` headings). Description line in `text-sm text-muted-foreground`, `mt-2`.
  - [ ] Minimal by design — Story 2.2 formalises the reusable `EmptyState` (5 documented cases). This is the primitive; do not add variants, icons, or an admin-CTA slot.
- [ ] **Task 2 — `DisciplineNav` component** `src/components/discipline-nav.tsx` (NEW) (AC: 1, 4)
  - [ ] `"use client"` — needs `usePathname()` for the active item. Three `next/link`s: `Класичний` → `/classic`, `Пляжний` → `/beach`, `Архів` → `/archive`.
  - [ ] Active when `pathname === href || pathname.startsWith(href + "/")` (so `/classic/anything` keeps `Класичний` active — future-proofs Epic 2).
  - [ ] Container: `flex items-center gap-1`. Link: `rounded-sm px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors`. Active: `bg-muted font-semibold text-foreground`. Inactive hover: `hover:text-foreground` (no blue — DESIGN.md "синій не для hover").
  - [ ] Keyboard-reachable, visible focus ring (`focus-visible:ring-2 focus-visible:ring-ring` or rely on the global `outline-ring/50` base). `aria-current="page"` on the active link.
  - [ ] No `⋯` / Sheet collapse (see AC 4 note).
- [ ] **Task 3 — Header wiring** `src/app/layout.tsx` (UPDATE) (AC: 1)
  - [ ] In the existing `<header>`: left = a wordmark `<Link href="/classic">` with the site name ("Волейбол Черкащини" or a short "Волейбол Черкащини" text — `font-semibold`), then `<DisciplineNav />`; right = the existing `<UserMenu />`.
  - [ ] Layout the header as `flex items-center justify-between gap-4 border-b px-4 py-2` (add the `border-b`; keep `px-4 py-2`). Wrap the left cluster (`wordmark + nav`) in a `div className="flex items-center gap-4 min-w-0"`. On narrow screens the nav must not push `UserMenu` off-screen or cause horizontal scroll — `flex-wrap` on the header or `overflow-x-auto` on the nav cluster if needed; verify at 360px.
  - [ ] **Preserve:** `lang="uk"`, `import "./globals.css"`, `<Toaster />` + `<FlashToaster />`, `min-h-full flex flex-col` on `<body>`.
  - [ ] Update `metadata` to a title template so section pages compose cleanly:
    ```ts
    export const metadata: Metadata = {
      title: { default: "Волейбол Черкащини", template: "%s · Волейбол Черкащини" },
      description:
        "Платформа турнірів Федерації волейболу Черкащини — розклад, таблиці, результати.",
    };
    ```
    (Existing `/admin` and `/admin/people` `title` strings then render as "Адмін-зона · Волейбол Черкащини" — fine, no change needed there.)
- [ ] **Task 4 — `/` → `/classic` redirect** `src/app/page.tsx` (REPLACE) (AC: 1)
  - [ ] Replace the entire Next.js starter file with:
    ```tsx
    import { redirect } from "next/navigation";

    export default function Home() {
      redirect("/classic");
    }
    ```
  - [ ] This removes the `next/image` import and the `/next.svg` / `/vercel.svg` usage. Leave the SVG files in `public/` (harmless; deleting them is out of scope).
- [ ] **Task 5 — `/classic` page** `src/app/classic/page.tsx` (NEW) (AC: 3, 5)
  - [ ] Server Component. No data fetch (no `Tournament` model yet). Section heading ("Класичний" — `display` register, `text-2xl font-bold tracking-tight` or a `<h1>`), then `<EmptyState title="Ще немає турнірів">` + a one-line description, e.g. «Активні турніри зʼявляться тут, коли їх створить адміністратор.»
  - [ ] `export const metadata = { title: "Класичний" };`
  - [ ] Wrap content in the shared page container: `main className="mx-auto w-full max-w-[1120px] px-4 py-8"` (DESIGN.md `contentMaxWidth` 1120px). Use the same container on `/beach` and `/archive`.
- [ ] **Task 6 — `/beach` page** `src/app/beach/page.tsx` (NEW) (AC: 2)
  - [ ] Server Component, no data. Heading "Пляжний", then `<EmptyState title="Незабаром">` + «У розділі «Пляжний» ще немає турнірів.» No tournament links, no CTA.
  - [ ] `export const metadata = { title: "Пляжний" };`
- [ ] **Task 7 — `/archive` page** `src/app/archive/page.tsx` (NEW) (AC: 3)
  - [ ] Server Component, no data. Heading "Архів", then `<EmptyState title="Архів порожній">` + «Завершені турніри зʼявляться тут за роками.»
  - [ ] `export const metadata = { title: "Архів" };`
- [ ] **Task 8 — Docs** (housekeeping)
  - [ ] `AGENTS.md` — one line under "Conventions" or "Stack status": public shell = `DisciplineNav` + wordmark in `src/app/layout.tsx`; routes `/classic` · `/beach` · `/archive`; `/` redirects to `/classic`; `EmptyState` (`src/components/empty-state.tsx`) is the minimal primitive, Story 2.2 formalises it.
  - [ ] `src/README.md` — if it lists routes/structure, add the three public routes; otherwise no change. (`src/components/**` needs no README.)
  - [ ] `EXPERIENCE.md` is **not** edited (consistent with 1.6/1.7).
- [ ] **Task 9 — Verification gate** (AC: all)
  - [ ] `pnpm lint` + `pnpm typecheck` + `pnpm build` clean on Node 24.
  - [ ] Build route table: `/classic`, `/beach`, `/archive` **static** (○) — they have no dynamic data; `/` shows as a redirect. `/admin/**` stay dynamic (ƒ). `/sign-in` stays static.
  - [ ] `grep -rn "next.svg\|vercel.svg\|To get started" src/` → empty (the starter page is gone).
  - [ ] **Manual (`pnpm dev`):**
    - open `/` → lands on `/classic`; header shows wordmark + `Класичний · Пляжний · Архів` + the user slot; `Класичний` is the active (muted-bg, bold) item.
    - click `Пляжний` → full navigation to `/beach`, "Незабаром" empty state, `Пляжний` now active.
    - click `Архів` → `/archive` empty state, `Архів` active.
    - resize to **360px** → all three nav items reachable, no horizontal page scroll, `UserMenu` still visible.
    - browser tab title on `/beach` reads "Пляжний · Волейбол Черкащини".
    - `/classic` still opens with no sign-in (AC — viewer, no auth).
  - [ ] Capture command output + the walkthrough in the Dev Agent Record.
- [ ] **Task 10 — Commit** — `feat(shell): public discipline nav + /classic /beach /archive (Story 1.8)`. Commit to `main`; push deploys to Vercel. This closes Epic 1.

## Dev Notes

### What this story is / is NOT

**Is:** the public site chrome — a wordmark + the three-item discipline nav in the root header, the `/` → `/classic` redirect that finally removes the Next.js starter page, three section pages that each render a minimal empty state, and the `EmptyState` primitive.

**Is NOT** (do not pull forward):
- Any `Tournament` / `Team` / archive data, any `src/data` function → **Epic 2 (Story 2.1+)**. `/classic` and `/archive` are unconditionally empty here.
- The "(адміну) Створити турнір" CTA on the `/classic` empty state → **Epic 2**.
- `/classic/[tournament]`, the tab chips, `/archive/[year]/[tournament]` → **Epic 2 / Epic 4**.
- The reusable `EmptyState` with its five documented cases, `Skeleton`, `Toast` helper, `ConfirmDialog` → **Story 2.2**. This story ships only the `EmptyState` shell.
- A `⋯` / `Sheet` mobile menu collapse — unnecessary for three short items.
- `not-found.tsx`, admin nav chrome, footer, SEO/OG tags beyond the title template.
- Any change to `/admin/**`, `/sign-in`, auth, or `src/data` / `src/actions` / `src/auth`.

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/components/empty-state.tsx` | NEW | dashed-border block, `title` + one line. Minimal primitive. |
| `src/components/discipline-nav.tsx` | NEW | `"use client"`, `usePathname()`, 3 links, active = `bg-muted font-semibold`. |
| `src/app/layout.tsx` | UPDATE | header: wordmark + `<DisciplineNav />` + `<UserMenu />`; `border-b`; `metadata` title template. Preserve everything else. |
| `src/app/page.tsx` | REPLACE | Next starter → `redirect("/classic")`. |
| `src/app/classic/page.tsx` | NEW | heading + `<EmptyState>`; `metadata.title`. |
| `src/app/beach/page.tsx` | NEW | "Незабаром" stub. |
| `src/app/archive/page.tsx` | NEW | archive empty state. |
| `AGENTS.md` | UPDATE | one line on the public shell + routes. |
| `src/README.md` | UPDATE (maybe) | add the 3 routes if a route list exists there. |
| `src/app/admin/**`, `src/auth/**`, `src/data/**`, `src/actions/**` | DO NOT TOUCH | |
| `prisma/**` | DO NOT TOUCH | no schema change. |

### Architecture compliance

- **AD-1** — public pages are Server Components. `/classic`, `/beach`, `/archive` are RSCs with no IO. `DisciplineNav` is a Client Component only because it reads `usePathname()` — it fetches nothing. [ARCHITECTURE-SPINE.md#AD-1]
- **AD-7** — public reads bypass auth. These pages call no `src/data` and no `requireAdmin()` — they are open. Nothing to filter (no entities). [ARCHITECTURE-SPINE.md#AD-7]
- **AD-9** — `discipline` enum, v1 = `CLASSIC`; `BEACH` present in types, no UI/data. `/beach` renders a stub and fetches nothing. Route separation (`/classic` vs `/beach` vs `/archive`) is the AC-5 mechanism until Epic 2 adds the `Tournament.discipline` filter. [ARCHITECTURE-SPINE.md#AD-9]
- **AD-3 / layers** — `src/components/**` (nav, empty-state) is pure view: no `@/auth`, no `@/data`, no `@/actions`. `src/app/**` pages import only `src/components`. `src/components/**` is lint-blocked from `@/auth`; not used here. [src/README.md]
- **DESIGN.md** — discipline nav is a brand-layer component (active = `muted` bg, `rounded-sm`, weight 600). Empty state = dashed `rounded-lg`. `display` register (`text-2xl font-bold tracking-tight`) only in headings + empty-state titles (Do's and Don'ts: "`display` лише в шапках і порожніх станах"). One primary button per screen — there are **no** buttons on these pages. Blue is not used for hover or decoration.
- **EXPERIENCE.md** — `/` → `/classic`; discipline switch is a full navigation, no `?tab`; empty states are one calm line, plain factual UA, no exclamation marks; `lang="uk"` (already set); touch targets ≥ 44px on mobile — the nav links are `px-2.5 py-1.5` on 13px text ≈ ~32px tall, **below the 44px floor** (the same known deferred design-system item flagged in Stories 1.5–1.7 — do not fix here, note it).
- **UX-DR14 (responsive)** — `body` never scrolls horizontally; the page container is `max-w-[1120px] mx-auto px-4`. Test at 360 / 768 / 1280.
- **Consistency Conventions** — route segments are `kebab-case` (`/classic`, `/beach`, `/archive` — all single-word, fine). UA UI, no i18n lib.

### Routing & redirect specifics (Next.js 16)

- `redirect("/classic")` from `next/navigation` inside `src/app/page.tsx`'s default export — Next renders `/` as a redirect. In the build output `/` appears without a size (it is not a rendered page). Do **not** wrap it in `try/catch` (it throws `NEXT_REDIRECT` by design).
- The three section pages have **no** `headers()` / `cookies()` / dynamic APIs and no `searchParams` usage → they prerender **static** (`○`). Confirm in the build output; if any shows `ƒ`, something pulled in a dynamic API by mistake.
- `DisciplineNav` being a Client Component does **not** make its host pages dynamic — the client boundary is fine inside a static RSC.
- Typed routes: `/classic`, `/beach`, `/archive` are static string paths — no `PageProps`/`LayoutProps` needed on the new pages. The root layout keeps `LayoutProps<"/">`.

### Previous story intelligence

**Story 1.7 (done, deployed):**
- `src/app/layout.tsx` — `<header className="flex justify-end px-4 py-2">` with `<UserMenu />`; `<Toaster />` + `<FlashToaster />` after `{children}`; `metadata` currently a flat `{ title, description }`.
- `src/app/page.tsx` — still the **Next.js starter** (`next/image`, `/next.svg`, "To get started, edit the page.tsx"). This story is what finally replaces it (the 1.6/1.7 "`/` is still the placeholder" note).
- `src/app/admin/page.tsx` / `admin/people/page.tsx` — use `<h1 className="text-2xl font-bold">` headings and `export const metadata = { title: "…" }` (added in the 1.7 review). Match that heading style.
- `src/app/admin/layout.tsx` — has `export const dynamic = "force-dynamic"` (1.7 review). Do not copy that onto public pages — they must stay static.
- shadcn base-nova components live in `src/components/ui/`. `Button` / `Card` / `Dialog` / `Avatar` / `Sonner` / `DropdownMenu` are installed; **no new shadcn component is needed** for this story (the nav and empty-state are hand-rolled per DESIGN.md).
- `src/components/**` ESLint block forbids `@/auth`. `usePathname` / `Link` from `next/navigation` / `next/link` are fine.
- Toolchain: **PowerShell** for `pnpm`; `git` via `C:\Program Files\Git\cmd\git.exe`; background `pnpm dev` via the Bash tool's `run_in_background`; kill a stale `next dev` (`taskkill //PID <pid> //F`) — Next 16 holds a single-server lock. Prefer `pnpm -C <path>` after a `cd` drifts the working dir.
- `globals.css` — light-only; tokens `--color-muted`, `--color-muted-foreground`, `--color-foreground`, `--color-border` all exist; `--radius-sm` (7px) / `--radius-lg` (14px) exist. `@layer base { * { @apply border-border } }` sets the default border colour, so `border-b` / `border-dashed` pick up `#e7e7e4` without an explicit `border-border`.

**Story 1.2 (done):** typography scale (`display` 32/24, `body` 14, `caption` 11) is **not** tokenised — a deferred item. Headings use plain `text-2xl font-bold tracking-tight`.

### Testing requirements

- **No unit tests / no Vitest** — no `src/domain` code, no data, no actions. Pure view. The gate is operational (Task 9): `lint` + `typecheck` + `build` clean; the correct static/redirect route classification; and a manual walkthrough of the redirect, the three nav items + active state, and the 360px layout.
- Capture real command output + the walkthrough in the Dev Agent Record — verifiable, not asserted (Stories 1.1–1.7 pattern).

### Git intelligence

Recent: `81a5550` (1.7 review patches) ← `d057a4d` ← `2d09f05` (1.7) ← `0308f0b` (1.7 draft). `src/app/` has `layout.tsx`, `page.tsx` (starter), `sign-in/`, `admin/`, `api/auth/`. No `/classic`, `/beach`, `/archive`. `src/components/` has `ui/`, `user-menu.tsx`, `flash-toaster.tsx`, `admin-role-controls.tsx`. No `discipline-nav` / `empty-state`.

### Latest tech information

- **Next.js 16** — `redirect()` in a page component; static prerendering is the default for pages with no dynamic APIs; a Client Component inside a static RSC does not deopt it. `metadata` `title` supports `{ default, template }`.
- No new dependency. No shadcn add.
- No security advisories.

### Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 1.8 AC + Epic 1 demo criterion "`/beach` показує заглушку" + boundary with Epic 2), `EXPERIENCE.md` (IA route map, "`/` → `/classic`", Discipline nav behaviour, empty-state Voice, Responsive < 640px), `DESIGN.md` (Discipline nav + Empty state brand components, `display` register, `contentMaxWidth` 1120, blue-usage rules), `SPEC.md` (CAP-11 public browsing & discipline navigation; non-goals — no print/offline/native), `ARCHITECTURE-SPINE.md` (AD-1, AD-7, AD-9), `AGENTS.md`, `1-7-admin-management.md` (layout header state, starter page still present, heading style, static-vs-dynamic discipline), mockup `mockups/directions-3-chosen-C.html` (`.C .nav` and `.C .empty` exact styling).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.8: Публічний каркас і меню] — user story + AC (three-item menu, `/beach` stub, empty states, < 640px, no cross-section leakage)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1] — demo criterion "`/beach` показує заглушку"; Epic 1 closes with this story
- [Source: _bmad-output/planning-artifacts/epics.md#Карта покриття FR — FR-24] — Epic 1 (Story 1.8): незалежні розділи меню Класичний / Пляжний, заглушка Пляжний
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#CAP-11] — публічний перегляд через меню з окремими незалежними розділами «Класичний» і «Пляжний»
- [Source: _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md#AD-9] — `discipline` enum; v1 filters `CLASSIC`; `BEACH` in types without UI
- [Source: …/ARCHITECTURE-SPINE.md#AD-1, #AD-7] — public pages are Server Components; public reads bypass `requireAdmin()`
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md#Information Architecture] — route map, "`/` → редірект на `/classic`"
- [Source: …/EXPERIENCE.md#Component Patterns] — "Discipline nav — … Перемикання Класичний↔Пляжний — повний перехід сторінки"
- [Source: …/EXPERIENCE.md#Voice and Tone] — "Порожні стани — один спокійний рядок"; «У розділі "Пляжний" ще немає турнірів. Незабаром.»
- [Source: …/EXPERIENCE.md#Responsive & Platform] — "< 640px: меню дисциплін — компактна смуга"; `body` по горизонталі не рухається
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md#Components] — Discipline nav (active `muted` bg, `rounded.sm`, 600) + Empty state (dashed `rounded.lg`, `display-sm` + line)
- [Source: …/DESIGN.md#Typography] — `display` register only in headers + empty-state greetings
- [Source: …/DESIGN.md#Layout & Spacing] — `contentMaxWidth` 1120px
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/mockups/directions-3-chosen-C.html] — `.C .nav` (`gap:4px; a { color:#6b6b70; font-size:13px; padding:6px 10px; border-radius:7px } a.on { background:#F5F5F4; color:#0E0E10; font-weight:600 }`), `.C .empty` (`border:1px dashed #E7E7E4; border-radius:12px; padding:26px; text-align:center`)
- [Source: _bmad-output/implementation-artifacts/1-7-admin-management.md] — layout header, starter page still present, heading style, static vs `force-dynamic`
- Web: [Next.js — redirect](https://nextjs.org/docs/app/api-reference/functions/redirect), [Next.js — Metadata `title` template](https://nextjs.org/docs/app/api-reference/functions/generate-metadata#title)

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
