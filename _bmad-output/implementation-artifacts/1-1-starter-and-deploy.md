---
baseline_commit: 28643d445a937c0077b06aa496923d84aff38540
---

# Story 1.1: Starter project and deployment

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want an initialized application on the target stack, deployed to hosting,
so that there is a working foundation that every following story builds on.

## Acceptance Criteria

Translated from `epics.md` → Epic 1 → Story 1.1. Ukrainian source is authoritative; wording below must not narrow it.

**Given** an empty repository (in practice: a repo that currently holds only leftover Java/IntelliJ scaffolding)
**When** the app is initialized with `create-next-app` (Next.js 16, App Router, TypeScript, Turbopack) + Tailwind + `shadcn init` + `prisma init`
**Then**

1. The project builds locally with no errors (`pnpm build` succeeds; `pnpm lint` clean).
2. The application is deployed to Vercel and its public URL responds `200`.
3. Neon Postgres is connected; `DATABASE_URL` and every other secret are provided **only** through environment variables, never committed to git.
4. The Node engine is pinned to **24 LTS**.

### Notes on AC interpretation

- **AC ordering vs. epic text.** The epic AC lists `shadcn init` inside the same step as `create-next-app`. `shadcn init` is only meaningful *after* the Next app exists, so run it second. The full DESIGN.md token layer (brand colors, radii, `Button` primary variant) is **Story 1.2's** job — here `shadcn init` only has to succeed and write a valid `components.json` + base CSS variables. Do not hand-apply brand tokens in this story.
- **AC "prisma init".** Run `prisma init` only. Defining the `User` model, the first migration, and the seed script is **Story 1.4**. Prisma 7 changes what `prisma init` scaffolds (see Dev Notes) — leave the generated `schema.prisma` / `prisma.config.ts` essentially as generated, wired to `DATABASE_URL`, with **no models**.
- **AC "Neon connected".** There is no schema yet, so a full query round-trip cannot be exercised until Story 1.4. "Connected" here = a Neon project exists, `DATABASE_URL` (pooled connection string) is set in Vercel project env **and** local `.env`, `.env` is git-ignored, and `prisma.config.ts` reads the URL from the environment. An optional `prisma db execute --stdin <<< "SELECT 1"` (or `prisma db pull` against the empty DB) is a nice smoke check but not required to pass the story.
- **AC "builds with no errors".** The gate is `pnpm build` (Turbopack production build) **and** `pnpm lint`, both clean, on Node 24. A green Vercel deployment satisfies the build half but run it locally too.

## Tasks / Subtasks

- [x] **Task 1 — Clear the way for the scaffold** (AC: 1)
  - [x] Confirmed tracked files were `.gitignore`, `CherkasyVolley.iml`, `src/Main.java`.
  - [x] Deleted `src/Main.java`, `CherkasyVolley.iml`, `out/`.
  - [x] Kept `.git/`, `.gitignore`, `.idea/`, `AGENTS.md`, `_bmad/`, `_bmad-output/`, `.claude/`.
- [x] **Task 2 — Choose and enable the package manager** (AC: 1)
  - [x] Package manager is **pnpm**. `corepack enable pnpm` **fails on this machine** (`EPERM` — Node is in `C:\Program Files\nodejs`, not user-writable). Installed instead with `npm install -g pnpm@latest` → `C:\Users\User\AppData\Roaming\npm` (already on PATH). pnpm **11.25.0**.
  - [x] `packageManager` field pins `pnpm@11.25.0` (written by the scaffold's `--use-pnpm`). Did not fall back to npm.
- [x] **Task 3 — Scaffold the Next.js 16 app** (AC: 1)
  - [x] Scaffolded into `cna-tmp/` (dot-prefixed dir name rejected by npm naming rules) with `pnpm create next-app@latest cna-tmp --ts --app --src-dir --tailwind --eslint --turbopack --import-alias "@/*" --use-pnpm --yes`. Hoisted all generated files to repo root, **merged** `.gitignore` (rewrote clean: Next template + `!.env.example` + `/src/generated` + IDE + Claude/BMAD sections), removed `cna-tmp/`.
  - [x] `create-next-app` / `next dev` writes a `<!-- BEGIN:nextjs-agent-rules -->` block into `AGENTS.md` — merged that block into the project's existing `AGENTS.md` (outside the `bmad:context` markers) so `next dev` does not re-add it. `CLAUDE.md` (`@AGENTS.md` pointer) kept.
  - [x] Verified: `src/app/` (App Router, src dir), `tsconfig.json` `"paths": {"@/*": ["./src/*"]}`, Tailwind v4 via `src/app/globals.css` (`@import "tailwindcss"`), `eslint.config.mjs` (flat config, ESLint 9).
  - [x] `pnpm install` clean; `pnpm dev` boots on Turbopack in 2.7s; `curl http://localhost:3000/` → **HTTP 200** with rendered HTML. `pnpm build` (Turbopack) + `pnpm lint` both clean.
- [x] **Task 4 — Pin Node 24** (AC: 4)
  - [x] `"engines": { "node": "24.x" }` in `package.json`; `.nvmrc` = `24`. Machine runs `v24.19.0`.
  - [x] Vercel production build succeeded on this `engines` value — Node 24 confirmed in the deploy pipeline.
- [x] **Task 5 — `shadcn init`** (AC: 1)
  - [x] Current shadcn CLI removed `--base-color`; ran `pnpm dlx shadcn@latest init -d -f -y` (defaults → `--template=next --preset=base-nova`). `components.json`: `tailwind.config: ""` (v4 mode), `css: src/app/globals.css`, `baseColor: neutral`, `cssVariables: true`, aliases on `@/`.
  - [x] **Deviations from the story's letter (both harmless, both re-worked in Story 1.2):**
    - `base-nova` preset picked `baseColor: neutral`, not `stone`. Story 1.2 replaces the whole palette with DESIGN.md tokens regardless.
    - `init` scaffolds `src/components/ui/button.tsx` + `src/lib/utils.ts` as part of the base — not a separate `add`. `button.tsx` is the exact component Story 1.2 (UX-DR2) must customise, so it is kept rather than deleted-then-re-added.
  - [x] `globals.css` rewritten by shadcn with its OKLCH token set + `.dark` variant + `tw-animate-css` — Story 1.2 strips dark mode and applies DESIGN.md.
  - [x] `pnpm build` + `pnpm lint` clean after init.
- [x] **Task 6 — `prisma init`** (AC: 3)
  - [x] `pnpm add -D prisma@7` → **prisma 7.10.0**; `pnpm add @prisma/client@7` → **@prisma/client 7.10.0**. pnpm 11 blocked the postinstall build scripts — resolved the auto-added `pnpm-workspace.yaml` `allowBuilds` placeholders (`@prisma/engines: true`, `prisma: true`, `@prisma/client: true`; kept Next's `sharp: false`, `unrs-resolver: false`). Engine postinstall then ran clean.
  - [x] `pnpm exec prisma init --datasource-provider postgresql`. Prisma 7 scaffolds `prisma/schema.prisma` **and `prisma7.config.ts`** (that filename, not `prisma.config.ts`) **and `.env`**.
  - [x] `schema.prisma`: `generator client { provider = "prisma-client"; output = "../src/generated/prisma" }`, `datasource db { provider = "postgresql" }` (no `url`, per v7), **no models**.
  - [x] `prisma7.config.ts` reads `process.env["DATABASE_URL"]` and does `import "dotenv/config"` — added `dotenv` (17.4.2) as devDep so the config loads (Prisma's own scaffold requires it).
  - [x] `/src/generated` git-ignored. `prisma7.config.ts` is picked up by lint/tsc and passes.
  - [x] `.env` (git-ignored, `DATABASE_URL=` empty) + `.env.example` (committed, keys documented incl. commented Story 1.4/1.5 keys). Verified `git check-ignore`: `.env` ignored, `.env.example` not.
  - [x] Prisma 7 `init` also installs "agent skills" into `.claude/skills/`, `.windsurf/skills/`, `.agents/skills/` + `skills-lock.json`. Removed all of it (equivalent to `prisma init --no-skills`) — `.claude/skills/` is the BMAD skill namespace and must not be polluted; the other dirs are unused. If a later `prisma` command re-adds them, git-ignore `.agents/ .windsurf/ skills-lock.json` in Story 1.4.
  - [x] Did not run `prisma migrate` / `generate` — Story 1.4 owns migrations, the driver adapter, and seed.
- [x] **Task 7 — Neon project** (AC: 3)
  - [x] User provisioned Neon Postgres via **Vercel → Storage → Create Database → Neon** (Frankfurt). The integration injects `DATABASE_URL` (+ unpooled/PG* vars) into the Vercel project environment automatically. Redeploy after attach was green.
  - [x] Note: could not read Vercel env vars directly from here (no valid CLI token — the token supplied was rejected by Vercel's API). Relying on the user's confirmation + green redeploy + the integration's documented behaviour. First real DB round-trip is Story 1.4 (no schema yet).
- [x] **Task 8 — Deploy to Vercel** (AC: 2, 3)
  - [x] Vercel project `cherkasy-volley` (team `nightfate1993-3408`, Hobby), Git-connected to `cikos1993/CherkasyVolley`, auto-deploy on push to `main`. Framework auto-detected as Next.js.
  - [x] First production deploy triggered by empty commit `cea2d94` (Git was connected after the scaffold push, so no event had fired). Deploy green.
  - [x] `curl -I https://cherkasy-volley.vercel.app/` → **HTTP/1.1 200 OK**, `Server: Vercel`, `X-Vercel-Id: fra1::…`, `X-Nextjs-Prerender: 1`. `/missing` → 404 as expected.
  - [x] Production URL recorded in `AGENTS.md` (`## Hosting`).
- [x] **Task 9 — Local verification gate** (AC: 1, 4)
  - [x] Node 24: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm build` — all clean (re-run immediately before the scaffold commit).
  - [x] `pnpm dev` boots (Turbopack); `/` renders; served HTTP 200 locally.
  - [x] `git status` — `.env`, `node_modules`, `.next/`, `src/generated` all ignored; `git check-ignore` confirms `.env` ignored / `.env.example` tracked; no secrets in any commit.
  - [x] Deployed-URL 200 check — passed (Task 8).
- [x] **Task 10 — Commit & housekeeping**
  - [x] `AGENTS.md`: nextjs-agent-rules block merged; `<!-- bmad:manual -->` section with stack status, pnpm/corepack situation, Prisma driver-adapter note for Story 1.4, and `## Hosting` (production URL).
  - [x] Commits on `main`, pushed to `origin`:
    - `5efda03` — `chore: scaffold Next.js 16 app (Tailwind v4, shadcn/ui, Prisma 7)`
    - `cea2d94` — `chore: trigger initial Vercel deployment` (empty)
    - `a9d297c` — `docs: record production URL in AGENTS.md`
  - [x] `_bmad-output/` left untracked, as it was before this story (user manages the planning corpus separately).

## Dev Notes

### Scope discipline — what this story is and is NOT

**Is:** a buildable, deployed Next.js 16 shell on the exact stack, with Tailwind + shadcn + Prisma *initialized* (not configured with domain content), Node pinned, Neon reachable via env, live URL returning 200.

**Is NOT** (each belongs to a later story — do not pull work forward):
- `src/domain` / `src/data` / `src/actions` / `src/auth` directories + the ESLint import-boundary rule → **Story 1.3**
- `User` model, first Prisma migration, driver adapter wiring, seed script → **Story 1.4**
- Better Auth / Google sign-in → **Story 1.5**
- DESIGN.md brand token layer, `Button` primary variant, light-only theme lock → **Story 1.2**
- Public shell, discipline nav (`Класичний · Пляжний · Архів`), empty states, routes → **Story 1.8**
- Vitest / domain unit tests → **Story 1.3** (first domain code) / **3.1**

Keeping this story thin is deliberate: Epic 1's "schema grows per-epic" and "engine first" principles (`epics.md` cross-cutting principles) depend on 1.1 not over-committing structure.

### Stack — exact versions (from ARCHITECTURE-SPINE.md § Stack)

| Thing | Version / choice | Notes |
| --- | --- | --- |
| Node.js | 24 LTS | machine has `v24.19.0` ✓ — just pin it |
| TypeScript | 5.x | create-next-app default |
| Next.js (App Router) | 16.x | Turbopack is the default bundler for **both** `next dev` and `next build` in 16 — no extra flag needed at runtime; `--turbopack` at scaffold time just sets the template |
| React | 19.2 | comes bundled with Next 16 |
| Tailwind CSS | v4 | **CSS-first config** — no `tailwind.config.js`; theme lives in `globals.css` via `@theme`; colors default to OKLCH. Story 1.2 must account for this when porting DESIGN.md hex tokens |
| shadcn/ui | latest | initializes in Tailwind v4 mode by default; `components.json` `tailwind.config` left blank |
| Prisma ORM | 7.x | **major behavioral shift — see below** |
| PostgreSQL | 16+ (Neon free tier) | pooled connection string; PITR backup covers NFR-7 |
| Hosting | Vercel free tier | |
| Package manager | **pnpm** | per `AGENTS.md`; enable via Corepack |

### Prisma 7 — what changed since v6 (research, 2026-09)

`prisma init` in v7 does **not** produce the v6 layout. Expect and preserve:
- **`prisma.config.ts`** at the project root — connection URL and Migrate config live here now, read from `process.env`. The schema `datasource` block **no longer accepts `url`**.
- **`generator client { provider = "prisma-client" }`** — the new Rust-free client. `prisma-client-js` is deprecated and slated for removal. The **`output` field is now required**; the client is no longer emitted into `node_modules`. Point it at `src/generated/prisma` and git-ignore that path.
- **Prisma ships as ESM** — `package.json` may need `"type": "module"`. create-next-app 16's output is ESM-friendly; verify `next.config.ts` and `prisma.config.ts` agree.
- **Driver adapter required at `PrismaClient` construction** (`@prisma/adapter-pg` or `@prisma/adapter-neon` for Postgres) — but that is wired in **Story 1.4** when the client is first instantiated. For 1.1, just `prisma init` + no models; do not construct a client yet.

Flag this in the story so Story 1.4 does not treat the adapter requirement as a surprise.

### create-next-app in a non-empty repo

The repo already contains `.git/`, `.gitignore`, `AGENTS.md`, `_bmad/`, `_bmad-output/`, `.idea/`, `CherkasyVolley.iml`, `src/Main.java`, `out/`. `create-next-app` aborts if the target dir has files outside its allowlist (`.git`, `.gitignore`, `LICENSE`, `README.md`, a few more — **not** `AGENTS.md` or `_bmad-output/`). Hence the "scaffold into `.cna-tmp/`, then hoist and merge `.gitignore`" approach in Task 3. Do not `git rm` the planning output or `AGENTS.md`.

### .gitignore merge

Existing `.gitignore` has IntelliJ / Eclipse / NetBeans / VS Code / macOS / "Claude Code / BMAD tooling" (`.claude/`, `_bmad/`) sections. Next's template adds `/node_modules`, `/.next/`, `/out/`, `/build`, `.env*`, `next-env.d.ts`, `*.tsbuildinfo`. **Append** — do not overwrite. Note `out/` is already ignored (Eclipse `bin/` style) — fine, Next's `out/` is the same folder name and also should stay ignored (we are not using static export).

### Deployment identity / hosting

- GitHub: user `cikos1993`, repo has an `origin` remote on GitHub — see memory `[[github-identity]]` (note: `git`/`gh` may not be on PATH in pre-opened shells; use full paths `C:\Program Files\Git\cmd\git.exe` / `C:\Program Files\GitHub CLI\gh.exe`).
- Vercel + Neon are both free-tier, one-volunteer-operable (NFR-4). Neon PITR is the backup story for NFR-7 — no extra work in 1.1, just use Neon.
- Commits go directly to `main` in this repo (see `git log`: no feature-branch history). No PR needed unless the user asks.

### Secrets policy (AGENTS.md § Policy, AD-10)

`DATABASE_URL` and Google OAuth secrets: **env vars only, never git**. Commit `.env.example` (keys, empty values); git-ignore `.env`. Vercel env vars set via dashboard/CLI, not in the repo.

### Verification / "how to run" — this story establishes it

After this story, `AGENTS.md` "Running and verifying" should read (resolve these TODOs):
- `pnpm install`, `pnpm dev` (Turbopack), `pnpm build`, `pnpm lint`
- Node 24 (`.nvmrc`)
- Production URL: `<record it>`
Still TODO after 1.1 (leave alone): Vitest domain tests (1.3), `pnpm lint` import-boundary rule (1.3), `pnpm prisma migrate dev` / seed (1.4).

### Testing requirements

- No unit tests in this story — there is no domain code yet. Do **not** add Vitest or another test runner now; Story 1.3 introduces it alongside the first `src/domain` module. Adding one here risks a config that 1.3 has to redo.
- The acceptance gate is: `pnpm build` clean, `pnpm lint` clean (Node 24), `pnpm dev` boots, and `curl -I <vercel-url>` → `200`.
- Capture the build output and the `curl -I` result in the Dev Agent Record so completion is verifiable, not asserted.

### Project Structure Notes

- Target tree (from ARCHITECTURE-SPINE.md § Дерево коду) is `src/app`, `src/components`, `src/actions`, `src/domain`, `src/data`, `src/auth`, plus `prisma/`. **This story only creates `src/app` (+ `src/components` if the scaffold adds it) and `prisma/`.** The other four `src/*` dirs are Story 1.3.
- `--src-dir` + `--import-alias "@/*"` are required so the generated layout matches the architecture (`@/` → `src/`).
- Prisma client output goes to `src/generated/prisma` (git-ignored) — not the v6 default of `node_modules/.prisma`.
- No conflict with existing structure once `src/Main.java` and `CherkasyVolley.iml` are removed. `CherkasyVolley.iml` is currently tracked even though `.idea/` is ignored — removing it is intentional cleanup, not a regression.

### Latest tech information (web research, Sept 2026)

- **Next.js 16**: Turbopack is default for dev *and* build; App Router only path for new apps; `create-next-app` setup flow simplified, TypeScript + Tailwind + ESLint first-class. `next.config.ts` native TS supported.
- **Tailwind v4**: config moved from `tailwind.config.js` to `@theme` in CSS; OKLCH color space; shadcn/ui fully migrated and initializes v4 by default (`tailwind.config` blank in `components.json`).
- **shadcn/ui**: base color options include `neutral | stone | zinc | …`; pick `stone` to pre-align with DESIGN.md neutrals (revisited in 1.2).
- **Prisma 7**: `prisma-client` (Rust-free) generator, required `output`, ESM package, `prisma.config.ts` for connection/Migrate config, `url` removed from schema datasource, driver adapter required to construct `PrismaClient` (deferred to 1.4).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1: Стартер-проєкт і розгортання] — user story + AC
- [Source: _bmad-output/planning-artifacts/epics.md#Додаткові вимоги (Архітектура)] — "Стартер: create-next-app (Next.js 16 …) + Tailwind + shadcn/ui + Prisma 7. Node 24 LTS. Це Epic 1, Story 1.1."
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Фундамент, доступ і публічний каркас] — epic scope, per-epic schema growth principle
- [Source: _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md#Stack] — exact versions
- [Source: …/ARCHITECTURE-SPINE.md#AD-1] — single full-stack Next.js app, no separate API
- [Source: …/ARCHITECTURE-SPINE.md#AD-10] — schema only via migrations, seed for reference data, secrets only via env
- [Source: …/ARCHITECTURE-SPINE.md#Структурний Seed / Дерево коду] — target directory tree
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md] — shadcn/ui on Tailwind, neutrals `#F5F5F4` / `#E7E7E4` (base color hint), light theme only
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md#Foundation] — `lang="uk"`, `Europe/Kyiv`
- [Source: AGENTS.md] — pnpm mandate, secrets policy, Prisma migration policy, known pitfalls (no Python/uv; git/gh not on PATH)
- [Source: memory/github-identity.md] — GitHub user `cikos1993`, remote, PATH caveat
- Web: [Next.js 16](https://nextjs.org/blog/next-16), [create-next-app CLI](https://nextjs.org/docs/app/api-reference/cli/create-next-app), [Upgrade to Prisma ORM 7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7), [shadcn/ui – Next.js install](https://ui.shadcn.com/docs/installation/next)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (Claude Code, `/bmad-dev-story`)

### Debug Log References

- `create-next-app` rejected a `.`-prefixed target dir → scaffolded as `cna-tmp/` then hoisted.
- `corepack enable pnpm` → `EPERM: operation not permitted, open 'C:\Program Files\nodejs\pnpm'` → global npm install instead.
- `pnpm add prisma@7` → `ERR_PNPM_IGNORED_BUILDS` (`@prisma/engines`, `prisma`) → set `pnpm-workspace.yaml` `allowBuilds` entries to `true`, re-installed, engine postinstall ran.
- `prisma init` generated `prisma7.config.ts` with `import "dotenv/config"` but `dotenv` was absent → `Cannot find module 'dotenv/config'` on any `prisma` invocation → added `dotenv` devDep.
- `prisma init` installed agent skills into `.claude/.windsurf/.agents/skills/` + `skills-lock.json` → removed (equivalent of `--no-skills`).

### Completion Notes List

- **All ACs met.** (1) `pnpm build` + `pnpm lint` clean on Node v24.19.0; (2) live at https://cherkasy-volley.vercel.app → HTTP 200; (3) Neon attached via Vercel Storage integration, `.env` git-ignored, no secrets in git; (4) Node pinned 24.x, confirmed by the green Vercel build.
- Versions landed: Next **16.3.4**, React **19.2.8**, TypeScript 5.9.3, Tailwind **4.3.3**, ESLint 9.39.5, shadcn preset `base-nova` (`shadcn` 4.19.1), Prisma **7.10.0** (`prisma-client` generator), dotenv 17.4.2.
- **Deviations (all documented in Tasks, all re-worked in a later story):** shadcn `base-nova` chose `baseColor: neutral` not `stone` + init-bundled `button.tsx` (→ Story 1.2); Prisma 7 `init` filename `prisma7.config.ts`, `dotenv` devDep added, `--no-skills`-equivalent cleanup of `.claude/.windsurf/.agents/skills` (→ noted for 1.4); pnpm installed globally instead of via corepack (machine limitation).
- **Verification gap:** Vercel env vars not read directly (supplied CLI token was rejected by Vercel's API); Neon attachment relies on user confirmation + green redeploy + the integration's documented behaviour. No DB round-trip possible until Story 1.4 (no schema).
- **Deferred to their stories (not regressions):** `lang="en"` → `uk` (1.2/1.8); Geist web fonts → system stack (1.2); dark-mode CSS + palette → DESIGN.md tokens (1.2); `src/domain|data|actions|auth` + import-boundary ESLint rule (1.3); Vitest (1.3); first migration + driver adapter + seed (1.4); default landing page → real public shell (1.8).

### File List

**Added (generated/config):**
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.nvmrc`
- `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `components.json`
- `README.md`, `CLAUDE.md`
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/favicon.ico`
- `src/components/ui/button.tsx`, `src/lib/utils.ts`
- `public/*.svg` (5 files)
- `prisma/schema.prisma`, `prisma7.config.ts`
- `.env` (git-ignored), `.env.example`

**Modified:**
- `.gitignore` (rewritten: Next template + project sections)
- `AGENTS.md` (nextjs-agent-rules block + `bmad:manual` section)

**Deleted:**
- `src/Main.java`, `CherkasyVolley.iml`, `out/` (leftover Java/IntelliJ scaffold)

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-02 | Story drafted (`bmad-create-story`) |
| 2026-09-02 | Scaffold implemented through Task 6: Next 16 + Tailwind v4 + shadcn + Prisma 7, Node 24 pinned, local build/lint/dev green. Tasks 7–8 (Neon + Vercel) blocked pending credentials. Status: in-progress. |
| 2026-09-02 | Local scaffold committed on `main` as `5efda03` and pushed. |
| 2026-09-02 | Vercel project `cherkasy-volley` created + Git-connected (by user); first deploy triggered via empty commit `cea2d94`. Live at https://cherkasy-volley.vercel.app (HTTP 200). |
| 2026-09-02 | Neon Postgres attached via Vercel Storage (by user); redeploy green. Production URL recorded in `AGENTS.md` (`a9d297c`). All ACs met. Status: review. |
