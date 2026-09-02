---
baseline_commit: f9a090a531eaf4422c18274f0c01911957c79579
context:
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
---

# Story 1.2: Design token layer

Status: ready-for-dev

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
- **"only light mode"** = delete the generated `.dark { … }` token block and the `@custom-variant dark (…)` line from `globals.css`, and drop the `.dark`-dependent OKLCH values. You do **not** have to scrub every `dark:` utility class out of the shadcn `Button` source — once `@custom-variant dark` is gone those classes are inert, and leaving them keeps the component a clean shadcn upgrade target. The `.dark` **token block** must go.
- **"brand Button (primary)"** — in shadcn this is the `default` variant. Only that variant changes (fill + text come free once `--primary` / `--primary-foreground` are the brand values; the corner needs an explicit `rounded-md`). `outline` / `secondary` / `ghost` / `destructive` / `link` are untouched (UX-DR2: "інші варіанти — дефолти shadcn").
- **"rest of shadcn stays default"** — do not override shadcn colour tokens beyond the brand set named in DESIGN.md (`background`, `foreground`, `muted`, `muted-foreground`, `border`, `primary`, `primary-foreground`, `accent`, `accent-foreground`, `success*`, `destructive`). `popover`, `card`, `input`, `ring`, `chart-*`, `sidebar-*` inherit from the base-nova preset. DESIGN.md "Do's and Don'ts": *"Оверайдити кольорові токени shadcn понад primary"* is a **Don't**.
- **`tabular-nums`** — Tailwind v4 ships the `tabular-nums` utility built in (`font-variant-numeric: tabular-nums`). No custom utility is required; this AC clause is satisfied by confirming the class works after the token edit. Do not add a bespoke `.tabular` helper.
- **`success` token** — base-nova has no `--success`; add `--success` + `--success-foreground` to `:root` and map them in the `@theme inline` block so a `bg-success` / `text-success` utility exists (DESIGN.md uses it for "зіграно / результат внесено"). This is a brand token named in the AC's "колір success", not an over-override.
- **Scope guard.** This story is the token layer *only*. No new components, no `not-found.tsx` / route work, no public shell, no `Button` usage anywhere. The default `src/app/page.tsx` stays the throwaway create-next-app page — Story 1.8 replaces it; its `dark:` classes are out of scope here.

## Tasks / Subtasks

- [ ] **Task 1 — Swap the colour tokens in `src/app/globals.css`** (AC: 2, 3)
  - [ ] In the `:root` block, replace the base-nova OKLCH values with the DESIGN.md brand values (hex is fine in Tailwind v4 `@theme`/`:root`):
    - `--background: #FFFFFF` · `--foreground: #0E0E10`
    - `--muted: #F5F5F4` · `--muted-foreground: #6B6B70`
    - `--border: #E7E7E4` · `--input: #E7E7E4` (input inherits border per DESIGN)
    - `--primary: #1F6FEB` · `--primary-foreground: #FFFFFF`
    - `--accent: #1F6FEB` · `--accent-foreground: #FFFFFF` (single accent = primary)
    - `--destructive: #C4342B`
    - `--ring: #1F6FEB` (visible focus ring is `{colors.primary}` — EXPERIENCE.md Accessibility Floor)
  - [ ] Add the `success` token pair: `--success: #1F8A54` · `--success-foreground: #FFFFFF`.
  - [ ] Leave `--popover*`, `--card*`, `--chart-*`, `--sidebar-*` as the base-nova preset set them (do not delete — some shadcn components read them).
- [ ] **Task 2 — Remove the dark theme** (AC: 1)
  - [ ] Delete the entire `.dark { … }` block from `globals.css`.
  - [ ] Delete the `@custom-variant dark (&:is(.dark *));` line.
  - [ ] Confirm nothing sets a `.dark` class or `color-scheme: dark` (check `layout.tsx`, `page.tsx` — currently neither does).
- [ ] **Task 3 — Radii** (AC: 2, and DESIGN.md Shapes)
  - [ ] Base-nova derives every radius from a single `--radius: 0.625rem` via `calc()`. DESIGN.md's scale (7 / 10 / 14 px) is not a clean multiple, so set the steps explicitly in the `@theme inline` block:
    - `--radius-sm: 7px` · `--radius-md: 10px` · `--radius-lg: 14px`
    - keep a `--radius-xl` / `2xl` … if base-nova utilities reference them, or let them keep deriving — nothing in v1 uses them.
  - [ ] `full` (999px) — Tailwind's built-in `rounded-full` already covers it; no token needed.
- [ ] **Task 4 — System font stack** (AC: "системний шрифт-стек")
  - [ ] In `src/app/layout.tsx`: remove the `import { Geist, Geist_Mono } from "next/font/google"`, the `geistSans` / `geistMono` consts, and the `${geistSans.variable} ${geistMono.variable}` fragment from the `<html>` `className` (keep `h-full antialiased`).
  - [ ] In `globals.css` `@theme inline`: set `--font-sans: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;` and `--font-heading: var(--font-sans);`. Replace the `--font-mono: var(--font-geist-mono)` line with a system mono stack (`ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`) or drop `--font-mono` if no utility needs it.
  - [ ] Remove the now-dead `--font-geist-sans` / `--font-geist-mono` references. (Story 1.1's code-review patch had temporarily pointed `--font-sans` at `var(--font-geist-sans)` — this task supersedes it.)
  - [ ] Verify `pnpm build` no longer downloads Geist (no `next/font/google` call remains).
- [ ] **Task 5 — Brand `Button` primary variant** (AC: 2)
  - [ ] In `src/components/ui/button.tsx`, the `default` variant is currently `"bg-primary text-primary-foreground hover:bg-primary/80"`. After Task 1 that already renders `#1F6FEB` fill + white text. Add the corner: append `rounded-md` to the `default` variant string so it overrides the base string's `rounded-lg` (→ 10 px per `{rounded.md}`).
  - [ ] Do **not** touch `outline` / `secondary` / `ghost` / `destructive` / `link`, the base class string, the size variants, or the `Button` function body.
  - [ ] **Side-effect to note (not fix):** Task 3 raises `--radius-lg` to 14 px, and the `Button` base string keeps `rounded-lg`, so non-primary buttons become 14 px. UX-DR2 says other variants keep shadcn defaults, and the AC only constrains the primary corner, so leaving them is compliant — but record this in the Completion Notes so a later story (2.2, when `Button` is actually used) can revisit if 14 px looks wrong. Do **not** pre-emptively change the base string.
- [ ] **Task 6 — Verify `tabular-nums`** (AC: "утиліта `tabular-nums`")
  - [ ] Confirm `<span className="tabular-nums">0123</span>` produces `font-variant-numeric: tabular-nums` in the built CSS (Tailwind v4 built-in). No code change expected — this is a confirmation subtask; note the result in the Dev Agent Record.
- [ ] **Task 7 — Verification gate** (AC: all)
  - [ ] `pnpm install` (if `node_modules` absent), then `pnpm lint` and `pnpm build` — both clean on Node 24.
  - [ ] `pnpm dev`, open `/` — page renders in light mode only; no dark flash under OS dark mode.
  - [ ] Temporarily drop a `<Button>Тест</Button>` on the page (or use React devtools / a scratch route) to eyeball: fill `#1F6FEB`, white text, ~10 px corner. **Remove the scratch usage before committing.**
  - [ ] Capture the `pnpm build` + `pnpm lint` output in the Dev Agent Record.
- [ ] **Task 8 — Commit**
  - [ ] Commit directly to `main` (repo has no feature-branch history; no PR unless the user asks).
  - [ ] **Precondition:** the uncommitted Story 1.1 code-review patches (`layout.tsx`, `globals.css`, `package.json`, `eslint.config.mjs`, `AGENTS.md`, `.env.example`) are in the working tree. Either commit them first as a separate `chore:` commit, or fold them in — do not silently discard them. `git status` before starting.

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
| `src/app/globals.css` | base-nova preset: `@import "tailwindcss"` + `"tw-animate-css"` + `"shadcn/tailwind.css"`; `@custom-variant dark`; `@theme inline` mapping block; `:root` OKLCH neutral palette; full `.dark {}` block; `@layer base` resets. Trailing newline added by 1.1 review. | `:root` colour values → DESIGN hex; add `--success*`; delete `.dark {}` + `@custom-variant dark`; set explicit `--radius-sm/md/lg`; set `--font-sans`/`--font-heading`/`--font-mono` to system stacks. | The `@import` lines, the `@theme inline` → `var(--…)` mapping pattern, the `@layer base` block, `--popover*`/`--card*`/`--chart-*`/`--sidebar-*` tokens, the two-layer (`:root` raw + `@theme inline` semantic) structure. |
| `src/app/layout.tsx` | Loads `Geist`/`Geist_Mono` via `next/font/google`, injects `--font-geist-*` CSS vars on `<html>`. `lang="uk"` and UA `<title>`/`description` already set (1.1 review). | Remove `next/font/google` import + the two font consts + the `${…variable}` className fragment. | `lang="uk"`, `metadata`, `h-full antialiased`, `min-h-full flex flex-col` on `<body>`, the `import "./globals.css"`, `LayoutProps<"/">` typing. |
| `src/components/ui/button.tsx` | shadcn base-nova `Button` on `@base-ui/react/button` + `cva`. Base string ends `… rounded-lg …`; `default` variant `"bg-primary text-primary-foreground hover:bg-primary/80"`. | Append `rounded-md` to the `default` variant only. | Everything else — base string, all other variants, all sizes, `defaultVariants`, the `Button` function, exports. |

### Tailwind v4 / shadcn base-nova mechanics (must-know)

- **CSS-first, no config file.** Theme is declared in `globals.css`: `@theme` / `@theme inline` blocks generate the utilities. There is no `tailwind.config.js` and `components.json` `tailwind.config` is `""` on purpose — do not add one.
- **Two-layer token pattern (keep it).** base-nova puts raw values in `:root` (`--primary: …`) and semantic mappings in `@theme inline` (`--color-primary: var(--primary)`). Utilities like `bg-primary` come from the `@theme inline` layer. You only edit the **`:root` raw values** (and add `--success` to *both* layers). `@theme inline` with the `inline` keyword means the referenced var is resolved at build for utility generation — a new `--color-success: var(--success)` line is needed for `bg-success` to exist.
- **Source order wins.** In `globals.css` the `@import "shadcn/tailwind.css"` comes first, then your `:root` — so your `:root` values override the preset's. Verify the preset has no `!important` on colour tokens (it doesn't as of `shadcn@4.19.1`).
- **`@custom-variant dark (&:is(.dark *))`** is what makes `dark:` utilities respond to a `.dark` ancestor. Removing that line + the `.dark {}` block = no dark theme, and any leftover `dark:` class becomes a no-op (safe).
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

_TBD by dev agent_

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-03 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
