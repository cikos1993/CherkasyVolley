# Deferred Work

Items surfaced during reviews that are real but not actionable in the story that found them.

## Deferred from: code review of 1-1-starter-and-deploy (2026-09-03)

- **No CI gate on push to `main`.** There is no `.github/workflows/`. `main` auto-deploys to Vercel, which runs `next build` (covers AC1's build half) but not `pnpm lint` (Next 16 dropped lint-during-build) and not a Node-24-pinned check. AC1's "lint clean on Node 24" is currently enforced only by a one-time manual local run. Candidate: a small CI story, or fold into Story 1.3 (which already touches the lint config).
- **Neon migrations need a direct connection URL.** `.env.example`, `prisma/schema.prisma`, and `prisma7.config.ts` wire only the pooled `DATABASE_URL`, and the `.env.example` comment tells the user to use the pooled string. `prisma migrate` against a PgBouncer-pooled endpoint commonly fails; a separate `DIRECT_URL` / `datasource.directUrl` is needed. Owner: Story 1.4 (first migration + driver adapter).
- **`next.config.ts` is an empty placeholder.** No `serverExternalPackages` for the Prisma 7 generated client (often required in RSC/server contexts), no security headers, no image config. Owner: Story 1.4 (Prisma client construction) or a dedicated hardening pass.
