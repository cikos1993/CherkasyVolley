# Deferred Work

Items surfaced during reviews that are real but not actionable in the story that found them.

## Deferred from: code review of 1-1-starter-and-deploy (2026-09-03)

- **No CI gate on push to `main`.** There is no `.github/workflows/`. `main` auto-deploys to Vercel, which runs `next build` (covers AC1's build half) but not `pnpm lint` (Next 16 dropped lint-during-build) and not a Node-24-pinned check. AC1's "lint clean on Node 24" is currently enforced only by a one-time manual local run. Candidate: a small CI story, or fold into Story 1.3 (which already touches the lint config).
- ~~**Neon migrations need a direct connection URL.**~~ **Resolved in Story 1.4.** `prisma7.config.ts` `datasource.url` = `DIRECT_URL ?? DATABASE_URL_UNPOOLED ?? DATABASE_URL`; `.env.example` documents `DIRECT_URL`. `migrate dev` applied clean.
- ~~**`next.config.ts` is an empty placeholder** (no `serverExternalPackages`).~~ **Partly resolved in Story 1.4.** Added `serverExternalPackages: ["pg", "@prisma/adapter-pg"]`. Security headers / image config still deferred to a hardening pass.

## Deferred from: code review of 1-3-domain-scaffold-boundaries (2026-09-03)

- **No regression test / CI gate for the import-boundary lint config.** The rules in `eslint.config.mjs` (Story 1.3) were verified once with throwaway probe files that were then deleted — not reproducible against `main`, and nothing fails if a future ESLint/`eslint-config-next` bump or an accidental config edit disables them. `main` auto-deploys via `next build`, which does not run these ESLint blocks. Needs either a committed negative-import fixture check (feasible once Vitest lands with the first `src/domain` module) or a CI job running `pnpm lint`. Overlaps the existing "No CI gate on push to `main`" item above — fold together when a CI story is picked up.
- **`import/no-restricted-paths` zone paths resolve against `process.cwd()`.** `from: "./src"` / `target: "./src/domain"` in the Story 1.3 ESLint blocks assume ESLint runs from the repo root. True for `pnpm lint`; some editor integrations set a different cwd, in which case the path zones silently match nothing. Revisit if a contributor reports the rules not firing in their IDE.

## Deferred from: code review of 1-2-design-tokens (2026-09-03)

- **DESIGN.md typography scale not tokenized.** Story 1.2 landed the font *family* only. The DESIGN.md `typography` group (`display` 32px/700/1.08/−0.6px, `display-sm` 24px/700/1.12/−0.3px, `body` 14px, `label` 13px/500, `caption` 11px/500/+0.2px) has no `--text-*` tokens or utilities. Without them every heading/caption will hardcode size/weight/tracking. Owner: Story 1.8 (first `display` headings — "Розклад", "Архів", empty-state greetings).
- **Per-component radius intent needs per-component overrides.** DESIGN.md Shapes assigns 7px to inputs and tab-chips, 10px to cards/buttons, 14px to dialogs/empty-states. shadcn maps its own `rounded-sm/md/lg` differently (e.g. `Input` uses `rounded-md`). Remapping the three radius tokens alone (done in 1.2) can't deliver this — components that need a non-default corner must set it explicitly. Owner: Story 2.2 (reusable UX patterns) and each component story.
- **Primary Button hover lightens instead of darkening.** `hover:bg-primary/80` (base-nova default) over `#1F6FEB` on white produces a visibly lighter hover and pushes the white label toward ~3:1 contrast. Define a proper darker-blue hover step. Owner: Story 2.2.
- **Small blue text contrast.** `#1F6FEB` on white ≈ 4.6:1 — OK for the button fill and large text, borderline for the future `link` variant and the 11px `caption`-size blue "position 1–4" numerals in the standings table. May need a darker blue for text-sized use or a minimum size. Owner: Story 3.8 (public standings table).
