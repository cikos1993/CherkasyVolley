# `src/domain/` — pure functional core

Deterministic `(input) → output` functions that hold every tournament rule: match
scoring by preset, group standings and tiebreaks, set-score validation, group
schedule generation, playoff seeding and bracket advancement.

**May import:** other `src/domain` modules, the standard library, pure npm utilities.

**Must not import:** `next` (or `next/*`), `@prisma/client`, `react` / `react-dom`,
`src/data`, `src/actions`, `src/app`, `src/components`, `src/auth`.

No IO, no framework, no side effects. Same input always yields the same output.
No component or Server Action computes points, sets, or placements on its own —
it calls a function from here.

Enforced by the `src/domain/**` block in `eslint.config.mjs` (a forbidden import
is a lint error). Every function here carries unit tests (deterministic, no mocks).
