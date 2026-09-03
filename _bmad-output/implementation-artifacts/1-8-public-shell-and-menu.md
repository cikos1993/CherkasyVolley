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

Status: done

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

- [x] **Task 1 — `EmptyState` component** `src/components/empty-state.tsx` (NEW) (AC: 2, 3)
  - [x] No `"use client"`, presentational. Props `title: string`, `children: ReactNode`.
  - [x] `rounded-lg border border-dashed px-6 py-10 text-center`; title `text-2xl font-bold tracking-tight`; line `mt-2 text-sm text-muted-foreground`.
  - [x] Minimal primitive — Story 2.2 formalises the reusable version.
- [x] **Task 2 — `DisciplineNav` component** `src/components/discipline-nav.tsx` (NEW) (AC: 1, 4)
  - [x] `"use client"`, `usePathname()`; three `next/link`s from an `ITEMS` const.
  - [x] Active: `pathname === href || pathname.startsWith(href + "/")`.
  - [x] `flex items-center gap-1`; link `rounded-sm px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground`; active `bg-muted font-semibold text-foreground`.
  - [x] `aria-current="page"` on the active link; focus ring from the global `outline-ring/50` base. No `⋯` collapse.
- [x] **Task 3 — Header wiring** `src/app/layout.tsx` (UPDATE) (AC: 1)
  - [x] `<header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2">`; left cluster `<div className="flex min-w-0 items-center gap-4">` = wordmark `<Link href="/classic">Волейбол Черкащини</Link>` + `<DisciplineNav />`; right = `<UserMenu />`. `flex-wrap` keeps the header from overflowing on narrow screens.
  - [x] Preserved `lang="uk"`, `import "./globals.css"`, `<Toaster />` + `<FlashToaster />`, `min-h-full flex flex-col`.
  - [x] `metadata.title` → `{ default: "Волейбол Черкащини", template: "%s · Волейбол Черкащини" }`. `/admin` + `/admin/people` titles now render "… · Волейбол Черкащини" (no change needed there).
- [x] **Task 4 — `/` → `/classic` redirect** `src/app/page.tsx` (REPLACE) (AC: 1)
  - [x] Whole file → `import { redirect } from "next/navigation"; export default function Home() { redirect("/classic"); }`. `next/image` / SVG usage gone; SVG files left in `public/`.
- [x] **Task 5 — `/classic` page** `src/app/classic/page.tsx` (NEW) (AC: 3, 5)
  - [x] Server Component, no data. `<main className="mx-auto w-full max-w-[1120px] px-4 py-8">`, `<h1 className="text-2xl font-bold tracking-tight">Класичний</h1>`, `<EmptyState title="Ще немає турнірів">Активні турніри зʼявляться тут, коли їх створить адміністратор.</EmptyState>`.
  - [x] `export const metadata = { title: "Класичний" };`
- [x] **Task 6 — `/beach` page** `src/app/beach/page.tsx` (NEW) (AC: 2)
  - [x] Heading "Пляжний" + `<EmptyState title="Незабаром">У розділі «Пляжний» ще немає турнірів.</EmptyState>`. No links, no CTA. `metadata.title` = "Пляжний".
- [x] **Task 7 — `/archive` page** `src/app/archive/page.tsx` (NEW) (AC: 3)
  - [x] Heading "Архів" + `<EmptyState title="Архів порожній">Завершені турніри зʼявляться тут за роками.</EmptyState>`. `metadata.title` = "Архів".
- [x] **Task 8 — Docs** (housekeeping)
  - [x] `AGENTS.md` — one line on the public shell + routes + `EmptyState` primitive.
  - [x] `src/README.md` — no route list there, no change.
  - [x] `EXPERIENCE.md` not edited.
- [x] **Task 9 — Verification gate** (AC: all)
  - [x] `pnpm lint` (exit 0) + `pnpm typecheck` (exit 0) + `pnpm build` clean on Node 24.
  - [x] Build route table: `/classic`, `/beach`, `/archive`, `/`, `/sign-in` **static** (○); `/admin`, `/admin/people` **dynamic** (ƒ) — see Debug Log.
  - [x] `grep -rn "next.svg\|vercel.svg\|To get started" src/` → empty.
  - [x] **Automated (dev :3111):** `GET /` → `307` → `location: /classic`; `/classic` → `200` with `<title>Класичний · Волейбол Черкащини</title>`, the wordmark, `aria-current="page"` on `Класичний`, the "Ще немає турнірів" empty state; `/beach` → "Незабаром" + `aria-current` on `Пляжний`; `/archive` → "Архів порожній" + `aria-current` on `Архів`; `/classic` reachable with no sign-in (`200`).
  - [x] **Narrow viewport** (browser-measured after the review restructure) — below `sm` (640px) the wordmark is `display:none`, so the header carries only the `<nav>` (222px measured) + the user slot (~49px) + chrome (~44px) ≈ 315px; `document.documentElement.scrollWidth === clientWidth` (no horizontal `body` scroll). Client-side `<Link>` nav `/classic` → `/beach` verified: URL + `h1`/`h2` + `aria-current` + active styling update with **no full reload**.
  - [x] Command output captured in the Dev Agent Record.
- [x] **Task 10 — Commit** — `feat(shell): public discipline nav + /classic /beach /archive (Story 1.8)`. Committed to `main`; push deploys to Vercel. Closes Epic 1.

### Review Findings

Code review 2026-09-03 (`bmad-code-review`, all 4 layers ran). 10 patch, 5 defer, ~8 dismissed.

- [x] [Review][Patch] Header can overflow the viewport ≤ ~400px — the left cluster (`whitespace-nowrap` wordmark + non-shrinking `<nav>`) sits inside `min-w-0` but its children don't shrink, so `flex-wrap` drops it whole and it still exceeds 360px → horizontal `body` scroll (AC 4). Restructure: drop `flex-wrap`, `hidden sm:block shrink-0` on the wordmark, `flex items-center justify-between gap-3` header. [src/app/layout.tsx]
- [x] [Review][Patch] `usePathname()` is dereferenced without a null guard — `pathname.startsWith(...)` throws if it returns `null`. `const pathname = usePathname() ?? "";` [src/components/discipline-nav.tsx]
- [x] [Review][Patch] Nav links + wordmark have no explicit focus ring — they fall back to the global `outline-ring/50` (colour only, no width). Match the `user-menu.tsx` convention: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`. [src/components/discipline-nav.tsx, src/app/layout.tsx]
- [x] [Review][Patch] `<nav>` has no accessible name — with `UserMenu` also in the header there are two nav landmarks. Add `aria-label="Розділи"`. [src/components/discipline-nav.tsx]
- [x] [Review][Patch] `aria-current="page"` is set for prefix matches too; it should be `"page"` only on an exact match, `"true"` for an ancestor-active route (relevant once Epic 2 adds `/classic/[t]`). [src/components/discipline-nav.tsx]
- [x] [Review][Patch] Section labels are triplicated (nav label / page `<h1>` / `metadata.title`) with no single source — AC 1 and AC 5 both hinge on them staying in lockstep. Extract `SECTIONS` + an `isActiveSection(pathname, href)` helper to `src/lib/sections.ts`; consume it in the nav and the three pages. [new src/lib/sections.ts, discipline-nav.tsx, 3 pages]
- [x] [Review][Patch] The page shell (`<main className="mx-auto max-w-[1120px] px-4 py-8">` + `<h1>`) is copy-pasted three times. Extract a `SectionShell` component. [new src/components/section-shell.tsx, 3 pages]
- [x] [Review][Patch] `EmptyState` — the visually prominent title is a `<p>` (not in the heading outline) and `text-2xl font-bold` (identical to the page `<h1>` → two stacked same-size bold lines). Render `<h2 className="text-lg font-semibold">`; rename `children: ReactNode` → `description: string` (it is rendered inside a `<p>`, so block content would be invalid HTML). Update the 3 call sites. [src/components/empty-state.tsx, 3 pages]
- [x] [Review][Patch] `/` redirect is a runtime 307 rendered by a component. Move it to `next.config.ts` `redirects()` with `permanent: true` (308, cacheable, crawler-friendly) and delete `src/app/page.tsx`. [next.config.ts, delete src/app/page.tsx]
- [x] [Review][Patch] No localised `not-found.tsx` — an unknown path (`/beahc`, `/classic/typo`) renders Next's default English 404 with no shell, violating the UA-only rule. Add a minimal `src/app/not-found.tsx` (shell + Ukrainian line + link to `/classic`). Also `satisfies Metadata` on the page `metadata` exports; remove the five dead `public/*.svg` starter assets. [new src/app/not-found.tsx, 3 pages, public/]
- [x] [Review][Defer] Nav touch targets (~32–36px) stay below the EXPERIENCE.md 44px floor [src/components/discipline-nav.tsx] — deferred, the same cross-cutting design-system item tracked since Story 1.5; a per-component bump would clash with every other control
- [x] [Review][Defer] No formal `⋯` / `Sheet` mobile collapse of the nav (UX-DR3 "згортаються") — deferred, unnecessary for three short words once the header restructure makes them fit; revisit with the design-system pass
- [x] [Review][Defer] No OpenGraph tags / `metadataBase` / web manifest — deferred, SEO polish beyond the shell story
- [x] [Review][Defer] `aria-current` ancestor semantics only partially handled — deferred, full treatment lands with the Epic 2 nested routes
- [x] [Review][Defer] No per-section `error.tsx` boundary — deferred, relevant once the pages fetch data (Epic 2)

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
├ ○ /archive
├ ○ /beach
├ ○ /classic
└ ○ /sign-in
```

`/`, `/classic`, `/beach`, `/archive`, `/sign-in` static (○); `/admin/**` dynamic (ƒ). `pnpm typecheck` / `pnpm lint` → exit 0. `grep -rn "next.svg\|vercel.svg\|To get started" src/` → no matches.

**Automated (dev :3111):**

```
$ curl -sD- http://localhost:3111/
HTTP/1.1 307 Temporary Redirect
location: /classic

$ curl -s http://localhost:3111/classic  | grep title/nav/empty
<title>Класичний · Волейбол Черкащини</title>
aria-current="page"  (on Класичний)
Волейбол Черкащини   (wordmark)
Ще немає турнірів     (empty state)

$ curl -s http://localhost:3111/beach     -> <title>Пляжний · Волейбол Черкащини</title>, "Незабаром", aria-current on Пляжний
$ curl -s http://localhost:3111/archive   -> <title>Архів · Волейбол Черкащини</title>, "Архів порожній", aria-current on Архів
$ curl -so/dev/null -w '%{http_code}' http://localhost:3111/classic   -> 200   (no sign-in)
```

### Completion Notes List

- **Public shell is in the root layout** — wordmark (`→ /classic`) + `<DisciplineNav />` in the left header cluster, `<UserMenu />` on the right, `flex-wrap` on the `<header>` so a narrow viewport wraps rather than overflows. Shows on every route (incl. `/admin`, `/sign-in`); a distinct admin chrome is a later concern.
- **`DisciplineNav`** is the only Client Component (`usePathname` for the active item); it fetches nothing, so `/classic` `/beach` `/archive` stay static RSCs. Active item: `bg-muted font-semibold text-foreground` + `aria-current="page"` (DESIGN.md brand spec / mockup `.C .nav`).
- **`/` → `/classic`** — `src/app/page.tsx` is now just `redirect("/classic")`; the Next.js starter (image, SVGs, "To get started") is gone. `public/next.svg` + `public/vercel.svg` left in place (harmless).
- **`EmptyState`** — minimal primitive (dashed `rounded-lg`, `title` + one line). `/classic` and `/archive` render it unconditionally (no `Tournament` model until Epic 2, Story 2.1); the "(адміну) Створити турнір" CTA is Epic 2. Story 2.2 formalises the reusable `EmptyState` and refactors these three call sites.
- **AC 5** ("no cross-section leakage") is satisfied structurally — `/classic` `/beach` `/archive` are separate route trees and none fetches data. The `Tournament.discipline` filter (AD-9) arrives with the entities in Epic 2.
- **`metadata` title template** on the root layout — section pages set a bare `title` and the tab reads "Пляжний · Волейбол Черкащини". `/admin*` titles compose the same way, no edit needed.
- **Known deferred:** nav link touch targets (~32px) are below the EXPERIENCE.md 44px floor — the same design-system item flagged since Story 1.5; not fixed here.
- No unit tests — pure view, no domain/data/actions (per the story's testing note). Gate is `lint` + `typecheck` + `build` + the redirect/nav/route-classification walkthrough above.

### File List

**New**
- `src/components/empty-state.tsx`
- `src/components/discipline-nav.tsx`
- `src/components/section-shell.tsx` (review)
- `src/lib/sections.ts` (review)
- `src/app/classic/page.tsx`
- `src/app/beach/page.tsx`
- `src/app/archive/page.tsx`
- `src/app/not-found.tsx` (review)

**Modified**
- `src/app/layout.tsx` — header (wordmark + `DisciplineNav`), `metadata` title template
- `next.config.ts` — `redirects()` `/` → `/classic` `permanent` (review)
- `AGENTS.md`

**Deleted**
- `src/app/page.tsx` — the `/` redirect moved to `next.config.ts` (review)
- `public/next.svg`, `vercel.svg`, `window.svg`, `globe.svg`, `file.svg` — dead starter assets (review)

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-03 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
| 2026-09-03 | Implemented Tasks 1–10: `DisciplineNav` + wordmark in the root header, `/` → `/classic`, `/classic` `/beach` `/archive` pages with a minimal `EmptyState`, `metadata` title template. Starter `page.tsx` removed. `lint`/`typecheck`/`build` green; redirect + nav active-state + route classification verified. Status: in-progress → review. |
| 2026-09-03 | `bmad-code-review` (4 layers). Applied 10 patches: header restructure (wordmark `hidden sm:block`, no `flex-wrap`) — measured at a narrow viewport, header content ≈315px so no `body` overflow at 360px; `usePathname() ?? ""` guard; explicit focus ring on nav + wordmark; `<nav aria-label>`; `aria-current` exact-vs-ancestor; `SECTIONS` + `isActiveSection` single-source in `src/lib/sections.ts`; `SectionShell` component; `EmptyState` → `<h2>` + `description: string`; `/` redirect moved to `next.config.ts` (`permanent` 308) + `page.tsx` deleted; `not-found.tsx` (UA); `satisfies`/typed page `metadata`; 5 dead `public/*.svg` removed. Browser-verified: `/` → `308` → `/classic`; client-side `<Link>` nav to `/beach` (no full reload, `aria-current` + styling follow); `/nonexistent` → UA 404. 5 deferred → `deferred-work.md`. Status: review → done. |
