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

- `tournamentForm.ts` — rules for the create/edit tournament form. `allowedTournamentTypes(discipline)`
  (CLASSIC → the four types, BEACH → none), the numeric bounds (`YEAR_MIN/MAX`,
  `TEAM_COUNT_MIN/MAX`, `ROUNDS_MIN/MAX`, `NAME_MAX`), `validateNewTournament(raw)`
  which coerces raw form values into a typed `NewTournamentInput` or a map of
  per-field Ukrainian errors (every failing field reported, not just the first),
  and `resolveGroupStageFields(state, submitted, current)` — the pure half of
  the edit-time rule that `teamCount`/`rounds` are only editable while `DRAFT`
  (Story 2.5): outside `DRAFT` it discards `submitted` and returns `current`
  unchanged, regardless of what a request sends.

- `teamForm.ts` — rules for the "add team" form. `normalizeTeamName(raw)` (trim
  + collapse internal whitespace — the display value), `teamNameKey(name)`
  (case-folds an already-normalized name into the dedup key), and
  `validateNewTeam(raw)` which returns a typed `NewTeamInput` (`name` +
  `nameKey`, both derived together) or a per-field error.

- `teamEnrollment.ts` — preconditions for enrolling/canceling a team's
  `TournamentEntry` (Story 2.7). `checkCanEnroll(state, currentEntryCount,
  teamCount)` — `DRAFT`-only and under-capacity (state checked first);
  `checkCanRemoveEntry(state)` — `DRAFT`-only. Both pure, called from
  `enrollTeam`/`removeTeamEntry` (`src/actions/entries.ts`) rather than left as
  inline action logic — the same shape as `tournamentForm.ts`'s
  `resolveGroupStageFields`.

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
