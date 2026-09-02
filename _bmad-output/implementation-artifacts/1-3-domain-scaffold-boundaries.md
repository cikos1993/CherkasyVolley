---
baseline_commit: d7b3961
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - AGENTS.md
---

# Story 1.3: Domain scaffold and dependency boundaries

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the `src/domain` / `src/data` / `src/actions` / `src/auth` directories with enforced import boundaries,
so that domain logic stays pure and testable (AD-2, AD-3, AD-11).

## Acceptance Criteria

Translated from `epics.md` → Epic 1 → Story 1.3. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** the project from Story 1.1
**When** the directories are created and the ESLint import-boundary rule is configured
**Then**

1. Importing anything internal into `src/domain` — `src/data`, `src/actions`, `next`, `@prisma/client` — fails `pnpm lint`.
2. Importing `@prisma/client` anywhere outside `src/data` fails `pnpm lint`.
3. The dependency direction `view → shell → {domain, data}`, `auth → data` is documented in a directory README.

### Notes on AC interpretation

- **"create the directories"** = `src/domain`, `src/data`, `src/actions`, `src/auth`. `src/app` and `src/components` already exist (Story 1.1); `src/lib` also exists (shadcn's `cn` helper — leave it, it is a View-layer utility). Each new directory gets a tracked `README.md` (git does not track empty directories, and AC 3 wants a README anyway) — no `index.ts` barrels, no placeholder `.ts` modules.
- **"anything internal … (`src/data`, `src/actions`, `next`, `@prisma/client`)"** — this is the enumerated minimum. AD-3 forbids `domain → *` for *every* internal layer, so also block `src/app`, `src/components`, `src/auth`, and `react` / `react-dom` from `src/domain`. The domain is pure `(input) → output` with zero framework imports.
- **"fails `pnpm lint`"** — the rule must produce an ESLint **error** (not warning), so `pnpm lint` exits non-zero. There is no source file that violates it yet, so `pnpm lint` and `pnpm build` stay green after this story. Verification is done with a throwaway probe file (see Task 4) whose ESLint output is pasted into the Dev Agent Record — asserted completion is not acceptable.
- **"outside `src/data`"** — the ban applies to all of `src/**` except `src/data/**`. `prisma/seed.ts` (Story 1.4) lives under `prisma/`, not `src/`, so it is already outside scope. `src/generated/**` (the generated client) is already in `globalIgnores` and is never linted.
- **"documented in a directory README"** — put the canonical layer map + dependency-direction diagram in **`src/README.md`**, and a one-paragraph "purpose / may import / must not import" note in each layer's own `README.md` (`src/domain`, `src/data`, `src/actions`, `src/auth`). The Ukrainian planning docs are Ukrainian; code-adjacent READMEs follow the repo's code language — **English** (AGENTS.md: "ідентифікатори в коді — англійською"; `document_output_language: English`).
- **No test runner.** Vitest is **not** in this story's AC — there is no `src/domain` code to test yet (the first domain functions are Story 3.1, per `epics.md` "двигун — першою історією" and the Epic 3 lead-in). Do not add Vitest/Jest here; a config added now is one Story 3.1 has to reconcile. The AGENTS.md Vitest TODO stays a TODO.
- **Scope guard.** Directories + READMEs + ESLint config only. No Prisma models, no migration, no `PrismaClient` construction (Story 1.4). No auth code (Story 1.5). No Server Actions, no `requireAdmin()` (Stories 1.5 / 1.6). No routes, no public shell (Story 1.8). No CI workflow (see Dev Notes — tracked in `deferred-work.md`).

## Tasks / Subtasks

- [x] **Task 1 — Create the four layer directories with READMEs** (AC: 3)
  - [x] `src/domain/README.md` — pure core; may import only other domain modules + pure utils; must not import `next`, `@prisma/client`, `react`, or any other layer.
  - [x] `src/data/README.md` — sole Prisma importer, sole entity owner/writer via named functions. **Deviation from draft:** `may import src/domain` (pure, acyclic) is explicitly allowed for read-time computation (`getStandings()` runs `computeStandings` over `Match` + `SetScore` — AD-4 / Story 3.2 design). Must not import `actions`, `auth`, `app`, `components`. Records the `state != DRAFT` public-read filter and the no-stored-standings invariant.
  - [x] `src/actions/README.md` — imperative shell; `await requireAdmin()` first line, then `data → domain → data`, `revalidatePath`; may import `domain`, `data`, `auth`; never `@prisma/client` directly.
  - [x] `src/auth/README.md` — Better Auth config + `requireAdmin()`; may import `src/data` only.
  - [x] `src/README.md` — layer table (View/Shell/Domain/Data/Auth) copied from ARCHITECTURE-SPINE.md § Design Paradigm, dependency-direction list, forbidden edges (corrected: `data → { actions, auth, view }`, `data → domain` allowed), note on what `eslint.config.mjs` enforces, and the core invariants (requireAdmin, public-read draft filter, explicit state transitions, computed standings, migrations/seed/secrets).
- [x] **Task 2 — Add the domain-purity ESLint block** (AC: 1)
  - [x] Config object `files: ["src/domain/**/*.{ts,tsx}"]` appended after `...nextTs`.
  - [x] `no-restricted-imports` (`error`): `paths` bans `next`, `@prisma/client`, `react`, `react-dom`; `patterns` bans `next/*`, `@prisma/client/*`, `@/generated/prisma(/*)`, and alias forms `@/data(/*)`, `@/actions(/*)`, `@/auth(/*)`, `@/app/*`, `@/components/*`.
  - [x] `import/no-restricted-paths` (`error`): zone `{ target: "./src/domain", from: "./src", except: ["./domain"] }` — catches relative cross-layer imports. No new dependency; `import` plugin + TS resolver already registered by `eslint-config-next`.
- [x] **Task 3 — Add the Prisma-confinement ESLint block** (AC: 2)
  - [x] Config object `files: ["src/**/*.{ts,tsx}"]`, `ignores: ["src/data/**", "src/domain/**", "src/generated/**"]` — `no-restricted-imports` (`error`) bans `@prisma/client` (+ patterns for `@prisma/client/*`, `@/generated/prisma(/*)`).
  - [x] `src/domain` kept in `ignores` (it has its own, stricter `no-restricted-imports`; flat-config rule options replace, not merge — non-overlapping blocks avoid clobbering).
  - [x] Third object `files: ["src/data/**/*.{ts,tsx}"]` — `import/no-restricted-paths` zones block `from: ./src/actions`, `./src/auth`, `./src/app`, `./src/components`. **Deviation from draft:** `from: ./src/domain` dropped — AD-4 / Story 3.2 require `getStandings()` in `src/data` to call `src/domain`; blocking it would contradict a downstream design. Direction stays acyclic (domain imports nothing).
- [x] **Task 4 — Verify the rules actually fire** (AC: 1, 2)
  - [x] Probe files created (`src/domain/__lint_probe__.ts` importing `@prisma/client`, `next/headers`, `@/data/*` alias, `../data/*` relative; `src/app/__lint_probe__.ts` importing `@prisma/client`; `src/data/__lint_probe__.ts` importing `@prisma/client` + `@/actions/*` + `@/domain/*`; target stubs). `pnpm exec eslint` output pasted into Dev Agent Record — every banned import errors; `@prisma/client` inside `src/data` does **not** error; `src/data → src/domain` does **not** error.
  - [x] All 6 probe/stub files deleted.
  - [x] `pnpm lint` clean, `pnpm build` clean (Node 24, Turbopack) with probes gone.
- [x] **Task 5 — Update AGENTS.md** (AC: 3)
  - [x] `## Running and verifying`: the `pnpm lint` import-boundary TODO resolved into a live description (domain/data/prisma boundaries, ESLint error separate from type check). Vitest TODO reworded (added "with the first `src/domain` module"); migration/seed TODO untouched.
  - [x] Added a `## Domain boundaries (Story 1.3)` note to the hand-maintained `<!-- bmad:manual -->` block (durable against `bmad:context` refresh). "Conventions that differ from defaults" block left as-is (already correct).
- [x] **Task 6 — Commit**
  - [x] committed on `main` — `feat(arch): domain scaffold + import-boundary lint rule (Story 1.3)`. Not pushed (pending code review, per the Story 1.2 pattern).

### Review Findings

_Adversarial code review 2026-09-03 (`bmad-code-review`, 4 layers — Blind Hunter, Edge Case Hunter, Verification Gap, Acceptance Auditor). Scope: `d7b3961..HEAD` (`eslint.config.mjs`, `AGENTS.md`, `src/**/README.md`). Outcome: 1 decision-needed (resolved), 7 patch (applied), 2 defer, ~6 dismissed. No high-severity findings._

- [x] [Review][Decision] `src/README.md` overrode AD-3 (`data → domain` forbidden) on its own authority, labelling the spine "corrected", while AD-3 / AD-5 / SPEC.md still forbid that edge and `epics.md` Story 3.2 places `getStandings()` in `src/data` "через `src/domain`". **Resolved: option (b).** Lint stays neutral (does not block `data → domain`); `src/README.md`, `src/data/README.md`, `src/auth/README.md` and the `AGENTS.md` manual note now present it as an explicit **unreconciled** tension (AD-3 vs AD-4/AD-5/Story 3.2) flagged for Epic 3 reconciliation — not a "correction". Rationale: blocking it now only forces a course-correction against Story 3.2's stated design; where the computation lives (data vs. read path) is an Epic 3 decision.
- [x] [Review][Patch] Relative-path domain bans + the whole `src/data` upward-import ban depended solely on `import/no-restricted-paths` (silent no-op until target layers have `.ts` files; silently breaks on resolver regression — reproduced by two layers). Added resolver-independent `no-restricted-imports` `patterns` (alias + `**/…` relative forms) to the `src/domain` and `src/data` blocks. Probe-verified: `../data/x`, `../../generated/prisma`, `../auth/x` now error with no target file present; `src/domain` sibling imports (`./x`) stay clean. [eslint.config.mjs]
- [x] [Review][Patch] Prisma 7's custom generator makes `@/generated/prisma` (+ relative) the real specifier. Added `@/generated/prisma`, `@/generated/prisma/**`, `**/generated/prisma`, `**/generated/prisma/**` to a shared `prismaClientPatterns` used by every block; reworded rule messages, `AGENTS.md`, and the READMEs to name the generated client as primary and `@prisma/client` as the re-export. [eslint.config.mjs, AGENTS.md, src/*/README.md]
- [x] [Review][Patch] `src/auth` needs the `PrismaClient` instance for Better Auth's adapter but the config bans the client there. Clarified in `src/data/README.md` + `src/auth/README.md`: the single client instance is constructed in `src/data` and imported from there by `src/auth` (`auth → data` allowed; `auth → @prisma/client` not). [src/data/README.md, src/auth/README.md]
- [x] [Review][Patch] Added a `src/auth/**` enforcement block (`no-restricted-imports` patterns + `import/no-restricted-paths` zones) forbidding `auth → domain/actions/app/components` and direct Prisma-client import — was documented, not enforced. Probe-verified. [eslint.config.mjs]
- [x] [Review][Patch] Added `next` / `react` / `react-dom` ban to the `src/data` block (data depends only on Prisma + schema types; `next/cache` previously undetected). [eslint.config.mjs]
- [x] [Review][Patch] Broadened all block file globs to `**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}` (matches `eslint-config-next`); added bare `@/app` / `@/components` / `@/lib`; switched deep-subpath specifiers to `/**`. Probe-verified `@prisma/client/runtime/library` now errors in `src/domain`. [eslint.config.mjs]
- [x] [Review][Patch] Doc consistency: `AGENTS.md` "Conventions" line updated (full domain ban list); READMEs now separate "ESLint enforces" from "manual-review invariants"; `src/README.md` layer table annotated (why `lib`/`auth` appear); File List below updated with `sprint-status.yaml`. Resolved-TODO lines remain in the `<!-- bmad:context -->` block — the durable statement is the `<!-- bmad:manual -->` "Domain boundaries" section; a `bmad-project-context` refresh regenerates the managed lines from repo reality. [AGENTS.md, src/README.md, src/*/README.md, story file]
- [x] [Review][Defer] No committed regression test / CI gate proving the boundary config fires and stays firing — the probe method is one-time and not reproducible against `main`. Needs the test runner (first `src/domain` module) or a CI job. — deferred, tracked in `deferred-work.md`.
- [x] [Review][Defer] `import/no-restricted-paths` zone paths (`from: "./src"`) resolve against `process.cwd()` — fine for `pnpm lint` at repo root, possibly wrong under some editor integrations. — deferred, revisit if it bites.

## Dev Notes

### What this story is / is NOT

**Is:** four empty directories, five README files, and four scoped blocks appended to `eslint.config.mjs` (`src/domain`, Prisma-confinement, `src/data`, `src/auth` — the last three expanded during code review). Zero runtime code, zero new dependencies.

**Is NOT** (do not pull forward):
- `User` model, first migration, `PrismaClient` construction, driver adapter, seed → **Story 1.4**.
- Better Auth config, actual `requireAdmin()` implementation → **Stories 1.5 / 1.6** (directory + README only here).
- Any Server Action, any `src/data` query function → their feature stories (Epic 2+).
- First real `src/domain` module (`scoring.ts` etc.) + its unit tests + Vitest → **Story 3.1**.
- Public shell / discipline nav / routes → **Story 1.8**.
- A GitHub Actions CI gate → not in AC; see "Deferred / CI" below.

### Files this story touches

| File | Status | Current state | This story changes | Must preserve |
| --- | --- | --- | --- | --- |
| `eslint.config.mjs` | UPDATE | Flat config: `...nextVitals`, `...nextTs`, then `globalIgnores([...])` incl. `src/generated/**` (added by the Story 1.1 review). | Append 2–3 scoped config objects (domain purity, Prisma confinement, optional data-layer zone) **after** the spreads. | The two spreads, their order, the `globalIgnores` list (especially `src/generated/**`), the `defineConfig` wrapper, `export default`. |
| `AGENTS.md` | UPDATE | `## Running and verifying` has `- TODO: pnpm lint включає ESLint-правило меж імпорту (Story 1.3) — окрема перевірка від типів.` | Turn that TODO into a resolved line. | Everything else — the nextjs-agent-rules block, `## Policy`, `## Conventions`, `## Known pitfalls`, `## Stack status`, `## Hosting`. Do not touch the `<!-- BEGIN:nextjs-agent-rules -->` region. |
| `src/README.md`, `src/domain/README.md`, `src/data/README.md`, `src/actions/README.md`, `src/auth/README.md` | NEW | — | Create per Task 1. | — |

### The ESLint mechanism (must-know)

- **`eslint-plugin-import` is already available.** It is a direct dependency of `eslint-config-next@16.3.4` (v2.32.0) and is `require`d + registered as the plugin `import` inside `...nextVitals` (`node_modules/eslint-config-next/dist/index.js` — `plugins: { import: _eslintpluginimport }`, `settings["import/resolver"].typescript = { alwaysTryTypes: true }`). So `import/no-restricted-paths` is usable by string id in any config object that comes *after* the spreads. **Do not** add `eslint-plugin-import` or `eslint-plugin-boundaries` to `package.json` — NFR-4 (minimum dependencies) and it is unnecessary.
- **`no-restricted-imports` (ESLint core)** matches the *import specifier string*, so it is the right tool for package-name bans (`next`, `@prisma/client`, `react`) and alias-path bans (`@/data/*`). It does **not** understand relative paths that resolve into a banned directory.
- **`import/no-restricted-paths`** resolves the *target file* through the import resolver, so it catches `../data/x`, `../../data/y`, and alias imports alike. Use it for the directory-to-directory zones. Options: `{ zones: [{ target, from, except, message }] }`; `except` entries are relative to `from`.
- **Flat-config precedence:** for a given file, a later matching config object's setting for a rule **replaces** (does not merge with) an earlier one. Keep the `no-restricted-imports` blocks non-overlapping via `ignores` (domain is excluded from the Prisma-confinement block because it has its own, stricter `no-restricted-imports`).
- **Severity must be `error`.** `pnpm lint` is `eslint` with no `--max-warnings`; a warning would not fail it. Story 1.1's AC1 gate is "lint clean" — a boundary violation must break that.
- **`src/lib/utils.ts`** (shadcn `cn`) imports only `clsx` / `tailwind-merge` — unaffected by either block. `prisma7.config.ts` imports `dotenv` — unaffected. No existing file violates the new rules, so `pnpm lint` stays green.

### Reference config shape (adapt, don't paste blindly — verify against the probe in Task 4)

```js
// eslint.config.mjs — appended after ...nextTs

// AD-2 / AD-3 — src/domain is a pure functional core
{
  files: ["src/domain/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": ["error", {
      paths: [
        { name: "next", message: "src/domain must stay framework-free (AD-2)." },
        { name: "@prisma/client", message: "src/domain must not touch the DB (AD-2/AD-11)." },
        { name: "react", message: "src/domain is pure functions, no React (AD-2)." },
        { name: "react-dom", message: "src/domain is pure functions, no React (AD-2)." },
      ],
      patterns: [
        { group: [
            "next/*", "@prisma/client/*", "@/generated/prisma", "@/generated/prisma/*",
            "@/data", "@/data/*", "@/actions", "@/actions/*",
            "@/app/*", "@/components/*", "@/auth", "@/auth/*",
          ],
          message: "src/domain must not import from any other layer (AD-3)." },
      ],
    }],
    "import/no-restricted-paths": ["error", {
      zones: [
        { target: "./src/domain", from: "./src", except: ["./domain"],
          message: "src/domain must not import from another src/ layer (AD-3)." },
      ],
    }],
  },
},

// AD-11 — @prisma/client only inside src/data
{
  files: ["src/**/*.{ts,tsx}"],
  ignores: ["src/data/**", "src/domain/**", "src/generated/**"],
  rules: {
    "no-restricted-imports": ["error", {
      paths: [
        { name: "@prisma/client",
          message: "Import Prisma only inside src/data (AD-11). Elsewhere, call a named src/data function." },
      ],
      patterns: [
        { group: ["@prisma/client/*", "@/generated/prisma", "@/generated/prisma/*"],
          message: "Import the Prisma client only inside src/data (AD-11)." },
      ],
    }],
  },
},

// AD-3 (recommended) — data layer depends only on Prisma + schema types
{
  files: ["src/data/**/*.{ts,tsx}"],
  rules: {
    "import/no-restricted-paths": ["error", {
      zones: [
        { target: "./src/data", from: "./src/domain",     message: "data must not depend on domain (AD-3)." },
        { target: "./src/data", from: "./src/actions",    message: "data must not depend on actions (AD-3)." },
        { target: "./src/data", from: "./src/app",        message: "data must not depend on the view layer (AD-3)." },
        { target: "./src/data", from: "./src/components",  message: "data must not depend on the view layer (AD-3)." },
      ],
    }],
  },
},
```

### Architecture compliance

- **AD-2** — `src/domain/` imports nothing internal, no `next`, no `@prisma/client`; deterministic `(input) → output`. [ARCHITECTURE-SPINE.md#AD-2]
- **AD-3** — dependency direction `view → shell → {domain, data}`, `auth → data`; forbidden edges `domain → *`, `data → {domain, actions, view}`, `view → data (write)`. This story enforces the `domain` and Prisma subset by lint and documents the whole graph. [ARCHITECTURE-SPINE.md#AD-3]
- **AD-11** — `@prisma/client` imported only in `src/data/`; every read/write is a named `src/data` function. [ARCHITECTURE-SPINE.md#AD-11]
- **AD-6 / AD-7 / AD-8** — not enforced here, but the `src/actions` and `src/data` READMEs must state the invariants (first line `await requireAdmin()`; public reads bypass auth and filter `state != DRAFT`; `Tournament.state` only via explicit transition actions) so later stories inherit the contract.
- **Stack** — ESLint 9 flat config, `eslint-config-next@16.3.4`, no new deps (NFR-4). [ARCHITECTURE-SPINE.md#Stack; AGENTS.md]
- **Language** — code-adjacent READMEs in English; planning docs stay Ukrainian. [AGENTS.md "Conventions"]
- **tsconfig** — `paths: { "@/*": ["./src/*"] }`, `moduleResolution: "bundler"` are already set (Story 1.1). No tsconfig change needed for this story.

### Directory-tree target (ARCHITECTURE-SPINE.md § Дерево коду)

```
src/
  app/          # exists — routes, Server Components (public reads only)
  components/   # exists — presentation, no business logic
  lib/          # exists — cn() util (View-layer helper; not in the spine tree, harmless)
  actions/      # NEW (README only) — Server Actions: requireAdmin() → data → domain → data
  domain/       # NEW (README only) — pure core: scoring, tiebreak, bracket, validation
  data/         # NEW (README only) — Prisma client + named entity functions (sole writer)
  auth/         # NEW (README only) — Better Auth config, requireAdmin()
  generated/    # git-ignored — Prisma client output (Story 1.4)
```

### Testing requirements

- **No unit tests, no test runner.** First `src/domain` code and its Vitest suite are Story 3.1 (`epics.md` Epic 3: "Перша історія — чистий двигун … з вичерпними юніт-тестами"). Adding Vitest now = a config Story 3.1 has to redo.
- **Acceptance gate:**
  1. `pnpm lint` clean and `pnpm build` clean on Node 24 with the probe files removed.
  2. The Task 4 probe runs, pasted into the Dev Agent Record: every banned import in `src/domain/__lint_probe__.ts` errors; `@prisma/client` in `src/app/__lint_probe__.ts` errors; `@prisma/client` in a `src/data/` temp file does **not** error.
  3. `src/README.md` contains the layer table + direction rule; each layer README states purpose + allowed/forbidden imports.
- Capture the actual `pnpm lint` / `pnpm build` output in the Dev Agent Record — verifiable, not asserted (per the pattern established in Stories 1.1 and 1.2).

### Previous story intelligence

**Story 1.2 (done):**
- The working tree is clean at `d7b3961`. Story 1.2 + its code-review patches are all committed.
- `pnpm install` before `pnpm lint` / `pnpm build` — `node_modules` may not be present. Story 1.2 hit `ERR_PNPM_OUTDATED_LOCKFILE` once with `--frozen-lockfile`; a plain `pnpm install` fixed it. `pnpm-lock.yaml` is current as of `d7b3961` (`@types/node` 24.x) so `--frozen-lockfile` should now work — if it does not, plain `pnpm install` and commit the lockfile delta.
- **Toolchain:** use the **PowerShell** tool for `pnpm` (PATH is wired via `.claude/settings.local.json`). The **Bash** tool does not resolve `node`/`pnpm`. `git` works in both. `gh` is not installed.
- ESLint config was last touched by the Story 1.1 review (added `src/generated/**` to `globalIgnores`) — do not drop that entry.

**Story 1.1 (done):**
- `eslint-config-next` is `16.3.4`, flat config, `core-web-vitals` + `typescript` presets. `components.json` `tailwind.config: ""` (v4). Prisma 7 client output → `src/generated/prisma` (git-ignored).
- Vercel runs `next build` only — **not** `pnpm lint` (Next 16 removed lint-on-build). Run lint locally before committing.
- Commits go straight to `main`; push → Vercel auto-deploy.

### Git intelligence

Recent commits (`d7b3961`, `40ce50a`, `2dfbc16`, `94ad3c6`, `e1b4362`) are Story 1.2 (token layer) + docs. No prior `src/domain|data|actions|auth` work — these directories do not exist yet. `eslint.config.mjs` has been touched once (Story 1.1 review, `src/generated/**` ignore). No CI workflow exists (`.github/workflows/` absent).

### Deferred / CI

`deferred-work.md` flags "No CI gate on push to `main`" as a candidate to fold into this story (it touches the lint config). **Decision: keep it out of Story 1.3.** A GitHub Actions workflow is separate scope (new file tree, secrets/permissions, PR triggers) and none of this story's ACs need it. The import-boundary rule is enforced by `pnpm lint` locally exactly like every other lint rule today; adding CI is an independent hardening story. Leave the `deferred-work.md` entry as-is.

### Latest tech information (as of 2026-01 knowledge cutoff)

- **ESLint 9 flat config**: config objects are matched and applied in array order; for a given file and rule, the last matching object wins (options replace, not merge). `files` + `ignores` in the same object scopes that object. `globalIgnores()` is a separate helper for repo-wide exclusions.
- **`eslint-plugin-import` 2.32**: `no-restricted-paths` supports `zones` with `target` / `from` / `except` / `message` and a `basePath` (defaults to `process.cwd()`). Works with `eslint-import-resolver-typescript` (bundled via `eslint-config-next`) for `@/*` alias resolution.
- **`no-restricted-imports` (core)**: `paths` (exact module ids) and `patterns` (`group` = array of gitignore-style globs, plus optional `message`, `importNames`, `allowImportNames`). Matches specifier strings only.
- No security or breaking-change concerns for a lint-config-only change on these versions.

### Project context reference

No `project-context.md` in this repo. Binding docs: `AGENTS.md` (conventions, pitfalls, "Running and verifying"), `ARCHITECTURE-SPINE.md` (AD-2 / AD-3 / AD-11, layer table, code tree), `epics.md` (Story 1.3 AC + Epic 1 scope + "engine first" principle), `SPEC.md` (Constraints: "AD-1…AD-11 … обов'язкові"). UX docs are not relevant to this story.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3: Доменний каркас і межі залежностей] — user story + AC (directories, ESLint boundary rule, README direction)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Фундамент, доступ і публічний каркас] — epic scope; "Закладає … доменний каркас (`src/domain` / `src/data` / `src/actions` / `src/auth`)"
- [Source: _bmad-output/planning-artifacts/epics.md — cross-cutting principles] — "Двигун — першою історією" (domain code + tests land in 3.1, not here)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md#Design Paradigm] — layer table (View / Shell / Domain / Data / Auth) for `src/README.md`
- [Source: …/ARCHITECTURE-SPINE.md#AD-2] — domain logic only in `src/domain/`, pure, no Next / Prisma / `src/data` / `src/actions`
- [Source: …/ARCHITECTURE-SPINE.md#AD-3] — dependency direction + forbidden edges (Mermaid graph in the spine)
- [Source: …/ARCHITECTURE-SPINE.md#AD-11] — `src/data/` sole Prisma importer and sole writer; named functions
- [Source: …/ARCHITECTURE-SPINE.md#AD-6, #AD-7, #AD-8] — invariants to record in the `src/actions` / `src/data` READMEs
- [Source: …/ARCHITECTURE-SPINE.md#Consistency Conventions] — naming (`computeStandings`, `createTournament`), cuid ids, UA-only
- [Source: …/ARCHITECTURE-SPINE.md#Structural Seed / Дерево коду] — target `src/` tree
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#Constraints] — "Архітектурні інваріанти AD-1…AD-11 … є обов'язковими"
- [Source: AGENTS.md] — pnpm + PowerShell tool, `src/domain` convention block, code-in-English, "Running and verifying" TODO to resolve
- [Source: _bmad-output/implementation-artifacts/1-1-starter-and-deploy.md] — eslint-config-next 16.3.4 flat config, `src/generated/**` ignore, Vercel build-not-lint, `src/domain|data|actions|auth` explicitly deferred to Story 1.3
- [Source: _bmad-output/implementation-artifacts/1-2-design-tokens.md] — clean tree at `d7b3961`, `pnpm install` note, toolchain (PowerShell for pnpm)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — "No CI gate" item (decision: out of scope for 1.3)
- ESLint config: `eslint-config-next` registers plugin `import` + typescript resolver — `node_modules/eslint-config-next/dist/index.js`

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (Claude Code, `/bmad-dev-story`)

### Debug Log References

- **`data → domain` boundary is a design conflict, not an oversight.** ARCHITECTURE-SPINE.md AD-3 lists `data → {domain, …}` as a forbidden edge, but AD-4 and Story 3.2's AC require `getStandings()` — a `src/data` function — to compute the table "через `src/domain`". Enforcing `data ✗→ domain` in lint now would break that downstream design. Resolution: the `src/data` zone blocks only `actions`, `auth`, `app`, `components`; `data → domain` is allowed and documented in `src/README.md` / `src/data/README.md` as an intentional, acyclic exception (domain imports nothing, so no cycle). Flagged for the Epic 3 work and worth a one-line reconciliation in the spine.
- `next/headers` in the domain probe is reported by the `no-restricted-imports` **pattern** (`next/*`) with the generic "must not import from any other layer" message rather than the `next` `paths` message. Still an error; acceptable.
- Relative cross-layer imports (`../data/x`) are caught **only** by `import/no-restricted-paths`, not by `no-restricted-imports` patterns (which match the alias string `@/data/*`). Both rules are needed — confirmed by the probe.

**Task 4 probe output (files since deleted):**

```
$ pnpm exec eslint "src/**/*.ts"

src/app/__lint_probe__.ts
  1:1  error  '@prisma/client' import is restricted from being used. Import Prisma only inside src/data. Elsewhere, call a named src/data function  no-restricted-imports

src/domain/__lint_probe__.ts
  1:1   error  '@prisma/client' import is restricted from being used. src/domain must not touch the database                                 no-restricted-imports
  2:1   error  'next/headers' import is restricted from being used by a pattern. src/domain must not import from any other layer             no-restricted-imports
  3:1   error  '@/data/__probe_target__' import is restricted from being used by a pattern. src/domain must not import from any other layer  no-restricted-imports
  3:42  error  Unexpected path "@/data/__probe_target__" imported in restricted zone. src/domain must not import from another src/ layer     import/no-restricted-paths
  4:40  error  Unexpected path "../data/__probe_target__" imported in restricted zone. src/domain must not import from another src/ layer    import/no-restricted-paths

✖ 6 problems (6 errors, 0 warnings)
```

`src/data/__probe_target__.ts` (which imports `@prisma/client`) produced **no** error — the Prisma ban does not overreach into `src/data`.

**`src/data` zone probe (`src/data/__lint_probe__.ts`, since deleted):**

```
src/data/__lint_probe__.ts
  2:29  error  Unexpected path "@/actions/__probe_target__" imported in restricted zone. data must not depend on actions  import/no-restricted-paths

✖ 1 problem (1 error, 0 warnings)
```

Line 1 (`@prisma/client`) and line 3 (`@/domain/__probe_pure__`) produced **no** error — as intended.

**Post-cleanup gate:** `pnpm lint` → clean (`$ eslint`, exit 0). `pnpm build` → clean (Next 16.3.4 Turbopack, TypeScript pass, 2 static routes `/`, `/_not-found`), Node v24.

**Code-review remediation probe (2026-09-03, files since deleted).** After applying the review patches, re-probed all layers with stub-free bad imports:

```
src/domain/_p.ts   11 no-restricted-imports errors: next/headers, @prisma/client,
                   @prisma/client/runtime/library, @/generated/prisma,
                   ../../generated/prisma, react, @/data/x, ../data/x, @/actions/x,
                   ../auth/x, @/lib/utils   (+ zone on @/lib/utils)
src/domain/_ok.ts  clean — sibling import "./_h" allowed (except: ["./domain"])
src/data/_p.ts     next/cache ERR, @/actions/x ERR, ../auth/x ERR;
                   @prisma/client / @/generated/prisma / @/domain/standings clean
src/auth/_p.ts     @prisma/client ERR, @/generated/prisma ERR, @/domain/x ERR,
                   ../actions/x ERR; @/data/client clean, next/headers clean
src/actions/_p.ts  @prisma/client ERR; @/data/x, @/domain/x, next/cache clean
src/lib/_p.ts      @prisma/client ERR
```

Relative and deep-subpath forms are now caught without a resolvable target file. `pnpm lint` + `pnpm build` clean afterward.

### Completion Notes List

- **AC 1 met.** Importing `next` / `next/*`, `@prisma/client`, `react` / `react-dom`, or any other `src/` layer (alias or relative) into `src/domain/**` is an ESLint **error** — verified by probe.
- **AC 2 met.** Importing `@prisma/client` (or `@/generated/prisma`) anywhere under `src/**` except `src/data/**` (and the domain block, which bans it harder) is an ESLint **error** — verified by probe; the ban does not fire inside `src/data`.
- **AC 3 met.** `src/README.md` carries the layer table + `view → shell → {domain, data}`, `auth → data` direction + forbidden edges + enforcement note; each of `src/{domain,data,actions,auth}/README.md` states purpose / may-import / must-not-import.
- **No new dependencies.** `import/no-restricted-paths` comes from `eslint-plugin-import`, already a transitive dep of `eslint-config-next@16.3.4` and registered as the `import` plugin with a TypeScript resolver. NFR-4 respected.
- **Extra enforcement beyond the two ACs (some added in code-review remediation):** `src/data` blocks `data → {actions, auth, app, components, next, react}` (AD-3); `src/auth` blocks `auth → {domain, actions, app, components}` and direct Prisma-client import; domain bans `react`/`react-dom` and `src/lib`. All alias + relative forms. No violating code exists.
- **`data → domain` is deliberately NOT blocked** — unreconciled AD-3 vs AD-4/Story 3.2 tension, documented as open for Epic 3 (see Review Findings decision).
- **Not done here (correct per scope):** no Vitest, no Prisma models/migration, no auth code, no Server Actions, no routes, no CI workflow. The four new directories contain only `README.md`.
- `.env.local` (Vercel-linked, git-ignored) is present in the tree; `next build` reads it. Not a change from this story.

### File List

**Added:**
- `src/README.md`
- `src/domain/README.md`
- `src/data/README.md`
- `src/actions/README.md`
- `src/auth/README.md`

**Modified:**
- `eslint.config.mjs`
- `AGENTS.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status transitions)
- `_bmad-output/implementation-artifacts/deferred-work.md` (2 code-review defer items)

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-03 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
| 2026-09-03 | Implemented: 4 layer dirs + 5 READMEs; `eslint.config.mjs` import-boundary blocks (domain purity, Prisma confinement, data-layer zone). Probe-verified all rules fire; `data → domain` intentionally left allowed (AD-4 / Story 3.2). `pnpm lint` + `pnpm build` clean on Node 24. AGENTS.md TODO resolved + manual note. Committed on `main` (not pushed). Status: review. |
| 2026-09-03 | Code review (`bmad-code-review`, 4 layers). 1 decision resolved (`data → domain` stays unblocked but reframed as an unreconciled AD-3/AD-4 tension, not a "correction"), 7 patches applied: resolver-independent `no-restricted-imports` patterns for relative + generated-client forms; new `src/auth/**` block; `next`/`react` ban in `src/data`; broader file globs + deep-subpath `/**`; `src/auth` gets `PrismaClient` from `src/data` (documented); doc consistency. 2 items deferred (boundary regression test / CI gate → `deferred-work.md`; cwd-relative zone paths). Re-probed all layers; `pnpm lint` + `pnpm build` clean. Status: done. |
