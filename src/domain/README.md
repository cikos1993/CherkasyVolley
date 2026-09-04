# `src/domain/` — pure functional core

Deterministic `(input) → output` functions that hold every tournament rule: match
scoring by preset, group standings and tiebreaks, set-score validation, group
schedule generation, playoff seeding and bracket advancement.

## Modules

- `tournamentState.ts` — the tournament lifecycle. `TRANSITIONS` (the forward-only
  chain `DRAFT → GROUP_STAGE → PLAYOFF → COMPLETED`), `canTransition(from, to)`
  (edge-only, for the view to decide which action to offer), and
  `checkTransition(from, to, ctx)` (the authoritative gate — edge plus the target
  state's precondition). `TransitionContext` carries the precondition inputs; the
  `DRAFT → GROUP_STAGE` precondition (enrolled entries equal the field size) is
  live, the later ones are fail-closed predicates until match results are
  modelled. The Server Action `transitionTournament` is the only caller.

- `tournamentForm.ts` — rules for the "create tournament" form. `allowedTournamentTypes(discipline)`
  (CLASSIC → the four types, BEACH → none), the numeric bounds (`YEAR_MIN/MAX`,
  `TEAM_COUNT_MIN/MAX`, `ROUNDS_MIN/MAX`, `NAME_MAX`), and `validateNewTournament(raw)`
  which coerces raw form values into a typed `NewTournamentInput` or a map of
  per-field Ukrainian errors (every failing field reported, not just the first).

The Vitest runner (`pnpm test`) was added alongside the first module.

**May import:** other `src/domain` modules, the standard library, pure npm utilities.

**Must not import:** `next` (or `next/*`), the Prisma client (`@prisma/client`,
`@/generated/prisma`, or relative forms), `react` / `react-dom`, `src/data`,
`src/actions`, `src/app`, `src/components`, `src/auth`, `src/lib`.

No IO, no framework, no side effects. Same input always yields the same output.
No component or Server Action computes points, sets, or placements on its own —
it calls a function from here.

Enforced by the `src/domain/**` block in `eslint.config.mjs` (a forbidden import
is a lint error — both alias and relative specifier forms). Every function here
carries unit tests (deterministic, no mocks).
