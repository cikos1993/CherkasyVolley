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

- `playerForm.ts` — rules for the roster (player) form (Story 2.8). `FULL_NAME_MAX`
  / `FREE_TEXT_MAX` bounds and `validatePlayer(raw)`, which trims every field —
  `fullName` required, the six optional fields (`birthDate`, `birthPlace`,
  `sportRank`, `position`, `height`, `weight`) become `null` when empty after
  trim rather than an empty string, matching Prisma's `String?` nullability so
  the value passes straight through to `src/data`. No unique/dedup check — AC 3
  ("не забороняє однакове ПІБ") is an intentional absence, not a gap.

- `scoring.ts` — group-stage points and standings (Story 3.1, glossary
  "Система очок"/"Таблиця групи"). `matchPoints(sets, preset)` — `CLASSIC`
  3/0 for a 3:0 or 3:1 sweep, 2/1 for a 3:2 decider; `CUSTOM` 1 point per set
  won, both sides, always 3 sets. `computeStandings(entryIds, matches, preset)`
  — `played`/`wins`/`losses`/`points`/`setsWon`/`setsLost` per entry,
  aggregated fresh from `matches` every call (AD-4 — never stored). Ordering
  is `tiebreak.ts`'s job, not this module's. `matchSetSummary(sets)` (Story 3.6)
  — the sets-won-per-side `{ home, away }` tally shown next to a match
  ("3:1"), built on the same `homeWonSet` comparison `countSetsWon` uses; the
  canonical helper every result surface (admin screen, schedule list, public
  page) derives the number from, so it can't drift (a tied set — impossible
  for a validated result — counts for neither side). `matchScoreLabel(sets)` —
  the `"X:Y"` string form, `null` when no sets are recorded.

- `tiebreak.ts` — group standings ordering (Story 3.1, FR-17). `orderStandings(rows,
  matches, preset, teamNames)` implements the chain points → head-to-head
  **mini-table** (a fresh `computeStandings` call restricted to just the
  matches among the currently-tied entries, not the whole group) → total sets
  won → team name (Ukrainian collation), flagging `needsManualSeed: true`
  only on rows that reach the name fallback — a step that doesn't fully
  resolve a tie (e.g. a 3-way results cycle) falls through to the next, it
  doesn't recurse into its own chain.

- `schedule.ts` — round-robin schedule generation (Story 3.1, glossary
  "Жеребкування"). `generateSchedule(entryIds, rounds, shuffle?)` — the
  standard circle method; an odd entry count gets one synthetic bye slot per
  tour that's never emitted as a real pairing. `rounds` cycles **repeat the
  identical pairing set** — a deliberate decision (no home/away swap between
  cycles; see the Story 3.1 file's Notes on AC interpretation), only the
  *order* pairs are listed within a tour is randomized, independently per
  cycle, via the injectable `shuffle` (defaults to `Math.random`-based
  Fisher–Yates; tests inject the identity function for determinism).
  `defaultShuffle` is also exported (Story 3.3 review fix) so a caller can
  randomize *which* entries end up paired together in the first place —
  `circleMethodTours` fixes its first entry as an anchor and rotates the
  rest, so the actual matchup structure is a deterministic function of
  `entryIds`' input order; `generateSchedule`'s own `shuffle` param never
  touches that order. `drawTournament` (`src/actions/draw.ts`) shuffles
  `entryIds` with it before calling `generateSchedule`, since
  `listEntriesForTournament` otherwise hands it alphabetically-ordered ids.

- `validation.ts` — set-score validation (Story 3.1, FR-5/FR-15). `targetScore(preset,
  tournamentType, setNo)` — `VETERAN` is always 15 regardless of preset;
  otherwise 25, except `CLASSIC`'s decisive 5th set, always 15 — fixed per
  FR-5's own `[NOTE FOR PM]`, PRD Open Question #5 is already resolved for
  v1, not actually open. `validateSetScore(homePoints, awayPoints, target)`
  — win-by-2, applied to **both** presets (PRD states the rule only under
  `CLASSIC`'s wording, but nothing there redefines what winning a *set*
  means under `CUSTOM`). `validateMatchScore(sets, preset, tournamentType)`
  — `CLASSIC` ends the instant one side reaches 3 set-wins (a set played
  after that point is invalid); `CUSTOM` is always exactly 3 sets, no
  early-stop concept. `MATCH_SETS_MIN` / `MATCH_SETS_MAX` (3 / 5) are exported
  so the Server Action and the score form don't restate the bound (Story 3.6
  review); a per-set failure message is prefixed `Партія N: …` — the contract
  `enterMatchResult` parses and `validation.test.ts` pins.

- `matchSchedule.ts` — match date/time/venue rules (Story 3.5). `kyivOffsetMinutes(utc)`
  resolves Europe/Kyiv's UTC offset (120 winter / 180 summer) per-date from
  `Intl.DateTimeFormat` — no timezone library. `parseKyivDateTimeLocal(raw)` reads a
  `datetime-local` string as Kyiv wall-clock and returns the UTC `Date` (empty → `null`;
  a naive-guess + one DST re-check so a value near a switch lands on the right side;
  rejects malformed and impossible calendar dates). `toKyivDateTimeLocalValue(date)` is
  the inverse (seeds the edit input); `formatKyivDateTime(date)` is the `uk-UA` display
  string. `validateMatchSchedule(raw)` combines the datetime parse with a trimmed,
  `VENUE_TEXT_MAX`-bounded `venueText` (empty → `null`, the `playerForm.ts` rule),
  returning `{ ok, value } | { ok: false, fieldErrors }`.

- `redraw.ts` — `checkCanRedraw(state, hasResults)` (Story 3.4). Pure precondition
  for re-running the draw on an already-drawn tournament — **not** a
  `checkTransition` edge, since `Tournament.state` never changes during a
  redraw (stays `GROUP_STAGE` before and after). `ok` only when `state ===
  "GROUP_STAGE"` and no `SetScore` exists yet for the tournament; otherwise a
  Ukrainian message naming which gate failed, state checked first (same
  ordering precedent as `checkCanEnroll`). Same shape and dual-purpose reuse
  (action + view) as `teamEnrollment.ts`'s `checkCanEnroll`/`checkCanRemoveEntry`.

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
