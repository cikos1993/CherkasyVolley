<!-- bmad:context -->
<!-- Verified 2026-09-02 against 28643d4. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## CherkasyVolley

Публічна платформа турнірів Федерації волейболу Черкащини. Стек за планом (код ще не написано):
Next.js 16 (App Router) + TypeScript, pnpm, Prisma + PostgreSQL (Neon), Better Auth (Google),
shadcn/ui + Tailwind, хостинг Vercel. Планування живе в `_bmad-output/` — архітектурний спайн
`_bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md`
є джерелом істини для інваріантів; історії — `_bmad-output/planning-artifacts/epics.md`.

## Policy

- Секрети (`DATABASE_URL`, Google OAuth) — лише через змінні середовища, ніколи в git.
- Схему БД змінювати лише міграціями Prisma; довідкові дані й першого адміна — лише seed-скриптом.
- Не редагувати згенерований клієнт Prisma вручну — перегенерувати через `pnpm prisma generate`.

## Where things are

- Інваріанти архітектури (AD-1…AD-11): `ARCHITECTURE-SPINE.md` — читати перед структурними змінами.
- Історії для реалізації: `_bmad-output/planning-artifacts/epics.md`; статус — `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- UX-контракти: `_bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md` (візуал) і `EXPERIENCE.md` (поведінка, IA, стани).
- Плановий контракт: `_bmad-output/specs/spec-cherkasy-volley/SPEC.md`.

## Running and verifying

- Пакетний менеджер — **pnpm** (`pnpm install`, `pnpm dev`, `pnpm build`, `pnpm lint`); Node 24.
- `pnpm lint` (ESLint 9 flat config) включає правила меж імпорту: `src/domain/` без `next`/Prisma-клієнта/`react`/інших шарів; Prisma-клієнт (`@/generated/prisma`, `@prisma/client`) лише в `src/data/`; `src/data/` не залежить від `actions`/`auth`/view/`next`/`react`; `src/auth/` імпортує лише `src/data`. Ловляться і alias-, і відносні форми. Порушення — помилка ESLint, окремо від перевірки типів.
- TODO: юніт-тести доменних функцій `src/domain/*` — обовʼязкові; запуск через Vitest (додається з першим модулем `src/domain`).
- Міграції: `pnpm prisma migrate dev --name <...>` для розробки — **проти власної Neon-гілки, не проти прод-гілки** (може запропонувати reset, створює/видаляє shadow DB). Прод отримує міграції лише через `pnpm prisma migrate deploy`, який `build` запускає через `scripts/migrate-deploy.mjs` (пропускається на preview-збірках Vercel). `prisma generate` — у `postinstall` і на початку `build`, бо `src/generated/` gitignored.
- Seed: `pnpm seed` (`prisma db seed` → `tsx prisma/seed.mts`) — ідемпотентний upsert першого адміна по `SEED_ADMIN_EMAIL` (у нижньому регістрі). Повторний запуск дублів не створює.
- `pnpm typecheck` (`tsc --noEmit`) — офлайн-перевірка типів (`next build` тепер потребує БД).

## Conventions that differ from defaults

- `src/domain/` — чисті функції: не імпортує `next`, Prisma-клієнт, `react`, `src/data`, `src/actions`, `src/auth`, `src/app`, `src/components`, `src/lib`.
- Prisma-клієнт (`@/generated/prisma`; `@prisma/client` — реекспорт) імпортується лише в `src/data/`; усі читання/записи — через іменовані функції там. `src/auth/` бере спільний інстанс клієнта з `src/data/`.
- Кожна мутація даних — Server Action у `src/actions/`, перший рядок `await requireAdmin()`.
- Турнірна таблиця й місця плейофа обчислюються при читанні, ніколи не зберігаються в БД.
- `Tournament.state` змінюється лише через Server Action `transitionTournament`, не присвоєнням.
- Інтерфейс лише українською, без i18n-бібліотеки; час зберігається в UTC, показується в `Europe/Kyiv`; ID — cuid.
- Планові документи — українською; ідентифікатори в коді — англійською.

## Known pitfalls

- **Увесь тулчейн встановлено** (Node 24, pnpm 11, uv 0.12, Python 3.11, git). Раніше «немає Python/uv» — застаріло.
- **PowerShell-інструмент**: PATH налаштовано через `.claude/settings.local.json` (`env.PATH`, gitignored, машинно-специфічні шляхи для користувача `night`) — `node`/`pnpm`/`npm`/`uv`/`python`/`git` резолвляться без дій. BMAD-скрипти (`resolve_customization.py`, `render_skill.py`) і `bmad-build` — через `uv run` у PowerShell. **Інший розробник/машина**: відтворити `.claude/settings.local.json` зі своїми шляхами (`(Get-Command node).Source` тощо).
- **Bash-інструмент**: не підхоплює той `env.PATH` і чистить Windows-шляхи при POSIX-конверсії — `node`/`pnpm`/`uv` там недоступні; `git` є (`/mingw64/bin/git`, або повний шлях `C:\Program Files\Git\cmd\git.exe`). Для node/pnpm/uv/BMAD — використовувати PowerShell-інструмент.
- `gh` (GitHub CLI) **не встановлено** — `winget install GitHub.cli` за потреби. Операції з git — через `git` напряму.

<!-- /bmad:context -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- bmad:manual -->
<!-- Notes below are maintained by hand, outside the bmad-managed block above. -->

## Stack status (Story 1.1)

- Scaffolded: Next.js 16 (App Router, `src/`, Turbopack default), React 19.2, TypeScript 5, Tailwind CSS **v4** (CSS-first — theme in `src/app/globals.css` via `@theme`, no `tailwind.config.js`), ESLint 9 flat config, shadcn/ui (Tailwind v4 mode), Prisma **7** (`prisma-client` generator, output `src/generated/prisma`, `prisma7.config.ts` holds the connection URL — not `schema.prisma`).
- Package manager: **pnpm** (installed globally via `npm i -g pnpm`; `corepack enable` fails on this machine — Node lives in `C:\Program Files\nodejs`, not user-writable). `packageManager` field pins the version.
- Node: pinned to 24.x via `package.json` `engines` + `.nvmrc`.
- Commands: `pnpm dev` (Turbopack), `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm seed`.
- Prisma 7 driver adapter wired (Story 1.4): `@prisma/adapter-pg` + `pg` over the pooled `DATABASE_URL`; the shared `PrismaClient` is `src/data/client.ts` (`export const db`), imported from `@/generated/prisma/client`. Migrations use the direct URL (`DATABASE_URL_UNPOOLED` / `DIRECT_URL`) via `prisma7.config.ts`. `build` = `prisma generate && node scripts/migrate-deploy.mjs && next build` (the wrapper runs `migrate deploy` only when `VERCEL_ENV` is `production` or unset). `prisma/seed.mts` + `prisma7.config.ts` are the only sanctioned importers of the generated client outside `src/data/` (build/CLI scripts, not linted).
- **No dev/staging database yet** — there is one Neon project. Recommended: create a personal Neon branch for `migrate dev`; only `migrate deploy` touches the prod branch.
- Auth (Story 1.5): **Better Auth 1.7.x**, Google provider only (`emailAndPassword: { enabled: false }`). `src/auth/auth.ts` (server instance; throws in prod if auth env vars are missing) · `src/lib/auth-client.ts` (`createAuthClient` + `inferAdditionalFields`, browser) · `src/app/api/auth/[...all]/route.ts` (`toNextJsHandler`, `runtime = "nodejs"`). Tables `user`/`session`/`account`/`verification` (`@@map` lowercase; models stay `PascalCase`). `User` table renamed `User` → `user`; `googleSub` dropped (OAuth identity lives in `account`; `account` is keyed `@@unique([issuer, accountId])`). `isAdmin` is a Better Auth `additionalFields` entry with `input: false` — on `session.user`, set only by the Story 1.7 action. Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET` (≥32 chars), `BETTER_AUTH_URL`. Google Cloud redirect URI: `<BETTER_AUTH_URL>/api/auth/callback/google`. **All table names are lowercase via `@@map` going forward** (Better Auth convention; Postgres-friendly).
- `@better-auth/cli` lags the `better-auth` runtime — after `@better-auth/cli generate`, reconcile the schema against `@better-auth/core/db/get-tables.mjs` (the runtime's own table defs), not just the CLI output.
- DB conformance check: `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` must print "empty migration"; `pnpm exec tsx scripts/db-check.mts` prints row counts.

## Domain boundaries (Story 1.3)

- Layer dirs: `src/domain` (pure core), `src/data` (sole Prisma owner + shared client instance), `src/actions` (Server Actions), `src/auth`. Each carries a `README.md`; `src/README.md` has the layer map + dependency direction. `ARCHITECTURE-SPINE.md` (AD-2/AD-3/AD-11) is the authoritative version.
- `eslint.config.mjs` enforces (lint error, alias + relative forms) via `no-restricted-imports` (resolver-independent) + `import/no-restricted-paths` (`eslint-plugin-import`, bundled by `eslint-config-next` — no added dependency):
  - `src/domain/**` — no `next`, no Prisma client, no `react`, no other `src/` layer (incl. `src/lib`).
  - Prisma client (`@/generated/prisma`, `@prisma/client`) — only under `src/data/**`.
  - `src/data/**` — no `actions`/`auth`/`app`/`components`, no `next`/`react`.
  - `src/auth/**` — may import only `src/data` (Better Auth gets the `PrismaClient` instance from there).
- **Open item:** `src/data → src/domain` is *not* blocked. AD-3 as written forbids it, but `epics.md` Story 3.2 puts `getStandings()` in `src/data` "через `src/domain`". Reconcile in Epic 3 (spine edit, or move read-time computation to the read path per AD-5).

## Hosting

- **Production:** https://cherkasy-volley.vercel.app (Vercel, team `volley3`, project `cherkasy-volley`, region `fra1`). Auto-deploys on push to `main`.
- CLI: `npx vercel link --yes --project cherkasy-volley` links to `volley3/cherkasy-volley` (writes `.vercel/`, `.env.local` — both gitignored).
- Neon Postgres: provisioned via Vercel → Storage (project `twilight-dust-91359102`). Sets `DATABASE_URL` (pooled) + `DATABASE_URL_UNPOOLED` (direct) in Vercel env. Local: `npx vercel env pull .env.local`.

<!-- /bmad:manual -->
