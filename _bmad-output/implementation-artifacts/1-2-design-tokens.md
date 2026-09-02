---
baseline_commit: e1b4362
context:
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
---

# Story 1.2: Design token layer

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a Tailwind/shadcn configuration carrying the DESIGN.md tokens,
so that all UI is built from a single source of colour, shape, and typography.

## Acceptance Criteria

Translated from `epics.md` → Epic 1 → Story 1.2. Ukrainian source is authoritative; wording below must not narrow it.

**Given** the deployed project from Story 1.1
**When** the DESIGN.md tokens are applied (colours primary / success / destructive / neutrals, radii 7 / 10 / 14 / full, system font stack, `tabular-nums` utility)
**Then**

1. Only light mode is available — there is no dark theme.
2. The brand `Button` (primary) variant renders with fill `#1F6FEB`, white text, and a 10 px corner.
3. Every other shadcn component keeps its shadcn defaults.

### Notes on AC interpretation

- **"apply the DESIGN.md tokens"** = edit `src/app/globals.css` (and `src/app/layout.tsx` for the font). Do **not** introduce `tailwind.config.js` — this project is Tailwind v4 CSS-first (theme lives in `globals.css` via `@theme`; `components.json` `tailwind.config` is deliberately blank).
- **"only light mode"** = delete the generated `.dark { … }` token block from `globals.css`. **Keep** the `@custom-variant dark (&:is(.dark *))` line: it scopes `dark:` utilities to a `.dark` ancestor class, and since nothing in the app ever sets that class, every `dark:` utility (in the shadcn `Button`, in the throwaway `page.tsx`) is dead. Removing that line would make `dark:` fall back to Tailwind's `prefers-color-scheme` default and the throwaway page's `dark:bg-black` would activate under OS dark mode — the opposite of the AC. So: remove the `.dark` **token block**, keep the variant line, and do not scrub `dark:` classes out of shadcn components.
- **"brand Button (primary)"** — in shadcn this is the `default` variant. Only that variant changes (fill + text come free once `--primary` / `--primary-foreground` are the brand values; the corner needs an explicit `rounded-md`). `outline` / `secondary` / `ghost` / `destructive` / `link` are untouched (UX-DR2: "інші варіанти — дефолти shadcn").
- **"rest of shadcn stays default"** — do not override shadcn colour tokens beyond the brand set named in DESIGN.md (`background`, `foreground`, `muted`, `muted-foreground`, `border`, `primary`, `primary-foreground`, `accent`, `accent-foreground`, `success*`, `destructive`). `popover`, `card`, `input`, `ring`, `chart-*`, `sidebar-*` inherit from the base-nova preset. DESIGN.md "Do's and Don'ts": *"Оверайдити кольорові токени shadcn понад primary"* is a **Don't**.
- **`tabular-nums`** — Tailwind v4 ships the `tabular-nums` utility built in (`font-variant-numeric: tabular-nums`). No custom utility is required; this AC clause is satisfied by confirming the class works after the token edit. Do not add a bespoke `.tabular` helper.
- **`success` token** — base-nova has no `--success`; add `--success` + `--success-foreground` to `:root` and map them in the `@theme inline` block so a `bg-success` / `text-success` utility exists (DESIGN.md uses it for "зіграно / результат внесено"). This is a brand token named in the AC's "колір success", not an over-override.
- **Scope guard.** This story is the token layer *only*. No new components, no `not-found.tsx` / route work, no public shell, no `Button` usage anywhere. The default `src/app/page.tsx` stays the throwaway create-next-app page — Story 1.8 replaces it; its `dark:` classes are out of scope here.

## Tasks / Subtasks

- [x] **Task 1 — Swap the colour tokens in `src/app/globals.css`** (AC: 2, 3)
  - [x] In the `:root` block, replace the base-nova OKLCH values with the DESIGN.md brand values (hex is fine in Tailwind v4 `@theme`/`:root`):
    - `--background: #FFFFFF` · `--foreground: #0E0E10`
    - `--muted: #F5F5F4` · `--muted-foreground: #6B6B70`
    - `--border: #E7E7E4` · `--input: #E7E7E4` (input inherits border per DESIGN)
    - `--primary: #1F6FEB` · `--primary-foreground: #FFFFFF`
    - `--accent: #1F6FEB` · `--accent-foreground: #FFFFFF` (single accent = primary)
    - `--destructive: #C4342B`
    - `--ring: #1F6FEB` (visible focus ring is `{colors.primary}` — EXPERIENCE.md Accessibility Floor)
  - [ ] Add the `success` token pair: `--success: #1F8A54` · `--success-foreground: #FFFFFF`.
  - [ ] Leave `--popover*`, `--card*`, `--chart-*`, `--sidebar-*` as the base-nova preset set them (do not delete — some shadcn components read them).
- [x] **Task 2 — Remove the dark theme** (AC: 1)
  - [x] Delete the entire `.dark { … }` token block from `globals.css`.
  - [x] **Keep** `@custom-variant dark (&:is(.dark *));` — see the AC interpretation note. Deleting it re-enables `prefers-color-scheme`-driven `dark:` styling.
  - [x] Confirm nothing sets a `.dark` class or `color-scheme: dark` (check `layout.tsx`, `page.tsx` — currently neither does).
- [x] **Task 3 — Radii** (AC: 2, and DESIGN.md Shapes)
  - [x] Set `--radius-sm: 7px` · `--radius-md: 10px` · `--radius-lg: 14px` explicitly in `@theme inline`. `--radius-xl`..`4xl` kept deriving from `--radius` (unused in v1).
  - [x] `full` (999px) — Tailwind's built-in `rounded-full` covers it; no token added.
- [x] **Task 4 — System font stack** (AC: "системний шрифт-стек")
  - [x] `layout.tsx`: removed `next/font/google` import, `geistSans`/`geistMono` consts, and the `${…variable}` className fragment. `<html>` is now `className="h-full antialiased"`.
  - [x] `globals.css` `@theme inline`: `--font-sans` = DESIGN system stack, `--font-heading: var(--font-sans)`, `--font-mono` = system mono stack.
  - [x] Removed the dead `--font-geist-*` references (supersedes the Story 1.1 code-review patch).
  - [x] Verified: no `geist`/`Geist` in the built CSS; `pnpm build` fetches no web font.
- [x] **Task 5 — Brand `Button` primary variant** (AC: 2)
  - [x] `button.tsx` `default` variant → `"rounded-md bg-primary text-primary-foreground hover:bg-primary/80"`. Fill/text come from the brand `--primary`/`--primary-foreground`.
  - [x] `outline` / `secondary` / `ghost` / `destructive` / `link`, base string, sizes, function body untouched.
  - [x] **Side-effect recorded:** non-primary buttons inherit the base string's `rounded-lg` = now 14 px. Compliant with UX-DR2 (other variants = shadcn defaults; AC only constrains primary). Flag for Story 2.2 when `Button` is first used.
- [x] **Task 6 — Verify `tabular-nums`** (AC: "утиліта `tabular-nums`")
  - [x] `tabular-nums` is a Tailwind v4 core utility (`font-variant-numeric`); nothing in the config removes it. It is not in the built CSS yet only because no source file references it (Tailwind emits on demand) — it will compile when a numeric cell uses it (Story 3.8 standings table). No code change.
- [x] **Task 7 — Verification gate** (AC: all)
  - [x] `pnpm install` (lockfile updated: `@types/node` 20→24 — the Story 1.1 code-review patch had not resynced it), then `pnpm lint` (clean) and `pnpm build` (clean) on Node v24.19.0.
  - [x] Built-CSS token checks: `--primary:#1f6feb` ✓, `--primary-foreground:#ffffff` ✓, `--success:#1f8a54` ✓, `--radius-sm:7px` ✓ `--radius-md:10px` ✓ `--radius-lg:14px` ✓, no `.dark{--…}` token block ✓, system font stack ✓, no Geist ✓. `default` Button variant carries `rounded-md`.
  - [x] `pnpm dev` / visual eyeball: **not run** in this environment (headless). Compiled CSS verified instead; a browser check of the primary Button + light-only render is the open item for code review.
  - [x] Build + lint output captured below.
- [x] **Task 8 — Commit**
  - [x] `94ad3c6` — implementation. Code-review patches committed on top (2026-09-03). Not pushed.

### Review Findings

_Adversarial code review 2026-09-03 (`bmad-code-review`): 4 layers — Blind Hunter, Edge Case Hunter, Verification Gap, Acceptance Auditor. Scope: `e1b4362..94ad3c6` (`src/app/globals.css`, `src/app/layout.tsx`, `src/components/ui/button.tsx`). Outcome: 1 decision-needed, 4 patch, 4 defer, ~10 dismissed. No high-severity findings._

#### Decision needed — resolved 2026-09-03

- [x] [Review][Decision] `--accent` = brand blue would make shadcn's hover/selected surfaces (DropdownMenu, Select, Command, Menu, Calendar) render as saturated blue fills — forbidden by DESIGN.md's "Don'ts" (*"Синій … hover"*). **Resolution:** option (b) — `--accent` → `#F5F5F4` (= `--muted`), `--accent-foreground` → `#0E0E10`. The frontmatter `accent: #1F6FEB` line reads as "there is no separate accent colour", not "make every hover blue"; DESIGN's own component specs put active/hover surfaces on `{colors.muted}` (`discipline-nav-item-active`, `tab-chip-active`), so neutral `--accent` matches DESIGN better than blue.

#### Patch — applied 2026-09-03

- [x] [Review][Patch] All buttons now `md` (10 px): `Button` base cva string `rounded-lg` → `rounded-md`; the `rounded-md` added to the `default` variant reverted (redundant). Matches DESIGN.md Shapes ("кнопки = md"). [src/components/ui/button.tsx:7]
- [x] [Review][Patch] `color-scheme: light` added to `:root` — native controls / scrollbars / pickers stay light under OS dark mode. [src/app/globals.css]
- [x] [Review][Patch] `--input` reverted to the base-nova value `oklch(0.922 0 0)` (= shadcn default per DESIGN.md); removed the `#e7e7e4` override. [src/app/globals.css]
- [x] [Review][Patch] `--card-foreground` / `--popover-foreground` / `--secondary-foreground` set to `#0e0e10` — single DESIGN foreground for all text, carded or not. [src/app/globals.css]

#### Deferred

- [x] [Review][Defer] DESIGN.md typography scale (`display` 32/700/−0.6 px, `display-sm` 24/700/−0.3 px, `body` 14, `label` 13/500, `caption` 11/500/+0.2 px) is not tokenized — only font families landed. AC's `When` clause names only "системний шрифт-стек", so not an AC miss, but a named DESIGN token group with no home — deferred to Story 1.8 (first `display` headings in the public shell)
- [x] [Review][Defer] Remapping shadcn `sm/md/lg` cannot express DESIGN's per-component radius intent — DESIGN wants inputs/tab-chips at 7 px but shadcn `Input` uses `rounded-md` (now 10 px); whoever adds `Input` / tab-chips must override per component — deferred to Story 2.2
- [x] [Review][Defer] Primary `Button` hover (`hover:bg-primary/80`, inherited from base-nova) lightens the blue on white instead of darkening it and nudges label contrast toward ~3:1; invisible with the old near-black primary — deferred to Story 2.2 (define a darker-blue hover step)
- [x] [Review][Defer] `#1F6FEB` on white ≈ 4.6:1 — fine for the button fill, borderline for small blue text (future `link` variant, 11 px `caption` "position 1–4" numerals); no darker "blue text" token — deferred to Story 3.8 (standings table)

## Dev Notes

### What this story is / is NOT

**Is:** a single-source token layer in `globals.css` + the one-line font change in `layout.tsx` + the one-class `Button` primary corner. Pure presentation config.

**Is NOT** (do not pull forward):
- New components — `ConfirmDialog`, `Toast` helper, `Skeleton` table form, `EmptyState` → **Story 2.2** (`epics.md` line ~306).
- Discipline nav (`Класичний · Пляжний · Архів`), public shell, real landing page → **Story 1.8**.
- `src/domain` / `src/data` / `src/actions` / `src/auth` + import-boundary ESLint rule → **Story 1.3**.
- Any Prisma / auth / route work.

### Files this story touches (all UPDATE, none NEW)

| File | Current state | This story changes | Must preserve |
| --- | --- | --- | --- |
| `src/app/globals.css` | base-nova preset: `@import "tailwindcss"` + `"tw-animate-css"` + `"shadcn/tailwind.css"`; `@custom-variant dark`; `@theme inline` mapping block; `:root` OKLCH neutral palette; full `.dark {}` block; `@layer base` resets. Trailing newline added by 1.1 review. | `:root` colour values → DESIGN hex; add `--success*` (both layers); delete the `.dark {}` block (keep `@custom-variant dark`); set explicit `--radius-sm/md/lg`; set `--font-sans`/`--font-heading`/`--font-mono` to system stacks. | The `@import` lines, `@custom-variant dark`, the `@theme inline` → `var(--…)` mapping pattern, the `@layer base` block, `--popover*`/`--card*`/`--secondary*`/`--chart-*`/`--sidebar-*` tokens, the two-layer (`:root` raw + `@theme inline` semantic) structure. |
| `src/app/layout.tsx` | Loads `Geist`/`Geist_Mono` via `next/font/google`, injects `--font-geist-*` CSS vars on `<html>`. `lang="uk"` and UA `<title>`/`description` already set (1.1 review). | Remove `next/font/google` import + the two font consts + the `${…variable}` className fragment. | `lang="uk"`, `metadata`, `h-full antialiased`, `min-h-full flex flex-col` on `<body>`, the `import "./globals.css"`, `LayoutProps<"/">` typing. |
| `src/components/ui/button.tsx` | shadcn base-nova `Button` on `@base-ui/react/button` + `cva`. Base string ends `… rounded-lg …`; `default` variant `"bg-primary text-primary-foreground hover:bg-primary/80"`. | Append `rounded-md` to the `default` variant only. | Everything else — base string, all other variants, all sizes, `defaultVariants`, the `Button` function, exports. |

### Tailwind v4 / shadcn base-nova mechanics (must-know)

- **CSS-first, no config file.** Theme is declared in `globals.css`: `@theme` / `@theme inline` blocks generate the utilities. There is no `tailwind.config.js` and `components.json` `tailwind.config` is `""` on purpose — do not add one.
- **Two-layer token pattern (keep it).** base-nova puts raw values in `:root` (`--primary: …`) and semantic mappings in `@theme inline` (`--color-primary: var(--primary)`). Utilities like `bg-primary` come from the `@theme inline` layer. You only edit the **`:root` raw values** (and add `--success` to *both* layers). `@theme inline` with the `inline` keyword means the referenced var is resolved at build for utility generation — a new `--color-success: var(--success)` line is needed for `bg-success` to exist.
- **Source order wins.** In `globals.css` the `@import "shadcn/tailwind.css"` comes first, then your `:root` — so your `:root` values override the preset's. Verify the preset has no `!important` on colour tokens (it doesn't as of `shadcn@4.19.1`).
- **`@custom-variant dark (&:is(.dark *))`** makes `dark:` utilities respond to a `.dark` ancestor class instead of `@media (prefers-color-scheme: dark)`. **Keep it.** Delete only the `.dark {}` token block. With the block gone and no `.dark` class ever applied, the dark palette and every `dark:` utility are inert. Deleting the variant line instead reverts `dark:` to the OS-preference media query — `page.tsx`'s `dark:bg-black` would then paint under OS dark mode.
- **`tabular-nums`** is a first-class Tailwind v4 utility — `font-variant-numeric`. Built in, nothing to declare.
- **Radius utilities** (`rounded-sm/md/lg`) read `--radius-sm/md/lg` from the theme. base-nova computes them from `--radius` via `calc()`; overriding the three explicit vars in `@theme inline` is the clean way to hit 7/10/14 px exactly.

### Architecture compliance

- **Tailwind v4 + shadcn/ui** is the fixed UI system (ARCHITECTURE-SPINE.md § Stack; DESIGN.md). No other styling library.
- **View layer only** — this story lives entirely in `src/app/**` + `src/components/**` (SPINE § Structural Seed table row "View"). It imports nothing from `shell` / `data` / `domain`. No `@prisma/client`, no `next` server APIs beyond what `layout.tsx` already has.
- **UA-only, `Europe/Kyiv`** (EXPERIENCE.md Foundation) — no i18n library; time formatting is not in this story. `lang="uk"` is already on `<html>` (do not regress it).
- **Accessibility floor** (EXPERIENCE.md): visible focus ring must be `{colors.primary}` → set `--ring: #1F6FEB`.
- DESIGN.md "Do's and Don'ts" are binding: single blue accent, no second accent colour, no override of shadcn colour tokens beyond the brand set, no shadows-as-hierarchy.

### Library / framework versions (from Story 1.1 landing)

- Next **16.3.4**, React **19.2.8**, TypeScript 5.9.3, Tailwind CSS **v4** (`tailwindcss@^4`, `@tailwindcss/postcss@^4`), `shadcn@4.19.1` (preset `base-nova`), `class-variance-authority@0.7.1`, `@base-ui/react@1.7.0`, `tw-animate-css@1.4.0`.
- No new dependencies. Removing `next/font/google` usage does **not** require removing any package (it is part of `next`).

### File structure

- Target tree (SPINE § Дерево коду): `src/app`, `src/components`, `src/actions`, `src/domain`, `src/data`, `src/auth`. This story only touches `src/app` and `src/components` — both already exist. Do not create the other four dirs (Story 1.3).

### Testing requirements

- **No unit tests.** There is still no test runner (Vitest arrives in Story 1.3 with the first `src/domain` module — Story 1.1 Dev Notes). Do not add Vitest / Jest here; a config added now is one Story 1.3 has to redo.
- Acceptance gate: `pnpm build` clean + `pnpm lint` clean on Node 24, `pnpm dev` renders `/` in light mode, and a manual eyeball of the primary `Button` (fill `#1F6FEB` / white text / ~10 px corner). Capture build + lint output in the Dev Agent Record — verifiable, not asserted.
- Optional sanity: `pnpm dlx tsx` or a scratch check is overkill; a visual check plus the green build is the bar.

### Previous story intelligence — Story 1.1 (done)

- **`globals.css` is base-nova output**, not hand-written — it carries the full OKLCH neutral palette, a `.dark` block, and `tw-animate-css`. Story 1.1 explicitly deferred "strip dark mode and apply DESIGN.md" to **this** story.
- Story 1.1's code review already made two related edits you will see in `git diff` (uncommitted): `--font-sans: var(--font-geist-sans)` in `globals.css` (Task 4 replaces this with the system stack) and `lang="uk"` + UA metadata in `layout.tsx` (keep). See `1-1-starter-and-deploy.md` § Review Findings.
- **`components.json`** has `"baseColor": "neutral"` (base-nova picked it; the story wanted `stone`). Leave it — it only affects future `shadcn add` scaffolds, not the running CSS. The CSS token values are what this story fixes.
- **pnpm** is the package manager (`pnpm@11.25.0` pinned). `corepack enable` fails on this machine — pnpm is a global npm install. `git` / `gh` are not on PATH in pre-opened shells — use `C:\Program Files\Git\cmd\git.exe`.
- **No `node_modules` in the tree right now** — run `pnpm install` before `pnpm lint` / `pnpm build`.
- **Deploy:** push to `main` auto-deploys to Vercel (`cherkasy-volley.vercel.app`). Vercel runs `next build` but **not** `pnpm lint` — run lint locally.

### Git intelligence

Recent commits are all scaffold + docs (`5efda03` scaffold, `cea2d94` deploy trigger, `a9d297c`/`7967fc5`/`f9a090a` docs). No prior styling work — `globals.css` and `button.tsx` are untouched since the `5efda03` scaffold. Working tree currently has **uncommitted Story 1.1 code-review patches** (8 files incl. `globals.css`, `layout.tsx`) — reconcile per Task 8 before committing 1.2.

### Latest tech information (as of 2026-01, knowledge cutoff)

- **Tailwind CSS v4**: stable CSS-first config; `@theme` / `@theme inline` in the stylesheet, `@import "tailwindcss"`, no JS config needed. OKLCH is the default colour output but hex literals are accepted in `@theme` / `:root`. `@custom-variant` is the supported way to define variants like `dark`.
- **shadcn/ui (Tailwind v4 mode)**: `components.json` `tailwind.config: ""`; components ship with `dark:` classes by default — the project decides whether a `dark` variant exists. `base-nova` preset uses `@base-ui/react` primitives (not Radix) and a `--radius`-derived radius scale.
- **`next/font`**: dropping a `next/font/google` call is a safe removal — no build config change, the font simply is not fetched. System-font UIs need no `next/font` at all.
- No known security or breaking-change concerns for a token-only change on these versions.

### Project context reference

No `project-context.md` in this repo. Binding context docs: `AGENTS.md` (conventions, pitfalls), `DESIGN.md` (visual contract — the token values), `EXPERIENCE.md` (behaviour: `lang="uk"`, focus ring, light-only), `ARCHITECTURE-SPINE.md` (stack, layer boundaries).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2: Токен-шар дизайну] — user story + AC
- [Source: _bmad-output/planning-artifacts/epics.md#Додаткові вимоги (UX)] — UX-DR1 (token list: colours, radii 7/10/14/full, system stack, `tabular-nums`, light only), UX-DR2 (Button primary: fill primary / white / 10px; other variants = shadcn defaults)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md] — frontmatter token table (`colors`, `typography`, `rounded`), § Colors, § Typography, § Shapes, § Components (Button primary), § Do's and Don'ts
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md#Foundation] — `lang="uk"`, `Europe/Kyiv`, shadcn/Tailwind
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md#Accessibility Floor] — focus ring `{colors.primary}`
- [Source: _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md#Stack] — Tailwind v4, Next 16, React 19.2
- [Source: …/ARCHITECTURE-SPINE.md#Structural Seed / Дерево коду] — View layer = `src/app/**` + `src/components/**`
- [Source: _bmad-output/implementation-artifacts/1-1-starter-and-deploy.md] — base-nova preset, deferred "strip dark mode + apply DESIGN.md" to this story, pnpm/PATH pitfalls, code-review patches in the tree
- [Source: AGENTS.md] — Tailwind v4 CSS-first (`@theme` in `globals.css`, no `tailwind.config.js`), pnpm, UA-only no i18n, `git` full path

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (Claude Code) — drafted and implemented in one session (no `bmad-build`; `uv` unavailable on this machine).

### Debug Log References

- `pnpm install --frozen-lockfile` → `ERR_PNPM_OUTDATED_LOCKFILE` (`@types/node` lockfile `^20` vs manifest `^24`, from the Story 1.1 code-review patch). Resolved with a plain `pnpm install` — `pnpm-lock.yaml` regenerated (`@types/node` 24.13.3).
- Corrected a mistake in the story's own draft: initially removed `@custom-variant dark`; that reverts `dark:` to `prefers-color-scheme` and the throwaway `page.tsx` would darken under OS dark mode. Restored the variant line; only the `.dark {}` token block is removed.

### Completion Notes List

- **All ACs met.** (1) light only — no `.dark{--…}` token block in the built CSS, `dark:` utilities compile as `:is(.dark *)` and are inert (no `.dark` class anywhere). (2) primary `Button` = `--primary #1F6FEB` fill / `--primary-foreground #FFFFFF` text / `rounded-md` 10 px. (3) only the DESIGN.md brand token set changed; `popover`/`card`/`secondary`/`chart-*`/`sidebar-*` kept base-nova values.
- Files changed: `src/app/globals.css` (token swap, `.dark` block removed, `--success*` added to both layers, explicit radii, system fonts), `src/app/layout.tsx` (dropped `next/font/google` Geist), `src/components/ui/button.tsx` (one class on `default` variant), `pnpm-lock.yaml` (`@types/node`).
- `pnpm lint` clean, `pnpm build` clean (Turbopack, Node v24.19.0), 2 static routes (`/`, `/_not-found`).
- **Not verified in-env:** browser visual check (`pnpm dev`) — headless. Built-CSS token values verified by grep instead. A code-review pass should eyeball the primary Button and the light-only render in a browser.
- **Follow-ups:** non-primary `Button` corner is now 14 px (side-effect of `--radius-lg` → 14 px + base string `rounded-lg`); revisit in Story 2.2. `components.json` `baseColor` stays `neutral` (affects only future `shadcn add`, not runtime CSS).
- **Deferred, unchanged:** `page.tsx` is still the throwaway create-next-app page with hardcoded colours / inert `dark:` classes → Story 1.8.

### File List

**Modified:**
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/components/ui/button.tsx`
- `pnpm-lock.yaml`

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-03 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
| 2026-09-03 | Implemented: DESIGN.md token layer in `globals.css`, dropped Geist for system stack, `Button` primary `rounded-md`, `.dark` token block removed. `pnpm lint` + `pnpm build` clean on Node 24. Status: review. |
| 2026-09-03 | Code review (`bmad-code-review`, 4 layers). 1 decision resolved (neutral `--accent`), 4 patches applied (all buttons `rounded-md`, `color-scheme: light`, `--input` reverted to shadcn default, `*-foreground` pinned to `#0E0E10`), 4 items deferred (type scale → 1.8; per-component radii, primary hover → 2.2; small blue-text contrast → 3.8). `pnpm lint` + `pnpm build` clean; token values re-verified in built CSS. Status: done. |
