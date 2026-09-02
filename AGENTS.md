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

- TODO (після Story 1.1): пакетний менеджер — **pnpm** (`pnpm install`, `pnpm dev`).
- TODO: юніт-тести доменних функцій `src/domain/*` — обовʼязкові; запуск через Vitest.
- TODO: `pnpm lint` включає ESLint-правило меж імпорту (Story 1.3) — окрема перевірка від типів.
- TODO: міграції — `pnpm prisma migrate dev`; seed — `pnpm prisma db seed`.

## Conventions that differ from defaults

- `src/domain/` — чисті функції: не імпортує `next`, `@prisma/client`, `src/data`, `src/actions`.
- `@prisma/client` імпортується лише в `src/data/`; усі читання/записи — через іменовані функції там.
- Кожна мутація даних — Server Action у `src/actions/`, перший рядок `await requireAdmin()`.
- Турнірна таблиця й місця плейофа обчислюються при читанні, ніколи не зберігаються в БД.
- `Tournament.state` змінюється лише через Server Action `transitionTournament`, не присвоєнням.
- Інтерфейс лише українською, без i18n-бібліотеки; час зберігається в UTC, показується в `Europe/Kyiv`; ID — cuid.
- Планові документи — українською; ідентифікатори в коді — англійською.

## Known pitfalls

- На цій машині немає Python/uv — скрипти BMAD (`memlog.py`, `sprint_plan.py`, `resolve_customization.py`) не запускаються; артефакти велися вручну. Ставити Python перед наступними прогонами BMAD-скілів.
- `git` і `gh` не в PATH для наперед відкритих оболонок — повні шляхи (`C:\Program Files\Git\cmd\git.exe`, `C:\Program Files\GitHub CLI\gh.exe`) або оновити PATH з реєстру.

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
- Commands: `pnpm dev` (Turbopack), `pnpm build`, `pnpm lint`.
- Prisma driver adapter (`@prisma/adapter-*`) is required to construct `PrismaClient` in Prisma 7 — wired in Story 1.4 with the first migration + seed.

## Hosting

- **Production:** https://cherkasy-volley.vercel.app (Vercel, team `volley3`, project `cherkasy-volley`, region `fra1`). Auto-deploys on push to `main`.
- CLI: `npx vercel link --yes --project cherkasy-volley` links to `volley3/cherkasy-volley` (writes `.vercel/`, `.env.local` — both gitignored).
- Neon Postgres: add via Vercel → Storage (sets `DATABASE_URL` in project env). Not yet provisioned as of Story 1.1.

<!-- /bmad:manual -->
