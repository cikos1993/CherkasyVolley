# `src/data/` — persistence layer

The only place in `src/` where the generated Prisma client
(`@/generated/prisma/client`) may be imported. Every read and write of every entity
goes through a named function exported from here — `getPublicTournament`,
`saveMatchResult`, and so on. There is one owner and one writer per entity.

## Modules

- `errors.ts` — `isUniqueViolation(error, indexName?)` (Prisma `P2002`, optionally
  narrowed to one constraint by its Postgres index name) and `isRecordNotFound(error)`
  (Prisma `P2025`). Generic predicates, not entity-specific — originally lived in
  `tournaments.ts` (Story 2.4/2.5), extracted here once `teams.ts` became a third
  consumer (Story 2.6). Every entity-specific index-name constant
  (`TOURNAMENT_NATURAL_KEY_INDEX`, `TEAM_NAME_KEY_INDEX`) stays in its own entity
  module, not here.
- `users.ts` — `listAuthenticatedUsers()` (users with ≥1 `account` row, i.e. who
  have completed Google sign-in at least once; `session` rows expire, so account
  presence is the durable signal), `countAdmins()`, and the sole writers of
  `User.isAdmin`: `promoteToAdmin(id)` and `demoteFromAdmin(id)` (transactional —
  refuses to clear the last admin). Both return `{ outcome: "ok" | "not_found" |
  "last_admin" }` and are called only from `grantAdmin` / `revokeAdmin` under
  `requireAdmin()`.
- `tournaments.ts` — `getTournamentForAdmin(id)` (admin read, drafts included;
  called only under `requireAdmin()`; includes `group: { id }` since Story 3.3,
  so callers like `drawTournament` don't need a second query for it),
  `listTournamentsForAdmin()` (admin read, every tournament, for
  `/admin/tournaments`), `setTournamentState(id, state, client?)` — **the sole
  writer of `Tournament.state`**, called only after the transition is validated
  in `src/domain/tournamentState` (AD-8; no other function writes `state`) — by
  `transitionTournament`, and (Story 3.3) by `draw.ts`'s `saveDraw` inside its
  transaction, via the optional third `client` parameter (a
  `Prisma.TransactionClient`, defaulting to the shared `db`) —
  `createTournamentRecord(input)` — **the sole creator of a `Tournament`**;
  inserts the tournament and its single `Group` in one statement, never sets
  `state` (defaults `DRAFT`) — `updateTournamentRecord(id, input)` — the second
  `Tournament` writer (`type`/`name`/`year`/`scoringPreset`/`teamCount`/`rounds`;
  never `discipline` or `state`) — `deleteTournamentRecord(id)` (relies on the
  schema's cascade FKs to remove the `Group`, `TournamentEntry` rows and their
  `Player` rosters) — and `TOURNAMENT_NATURAL_KEY_INDEX` (the Postgres index name
  the `@@unique([discipline, type, year, name])` constraint compiles to, used
  with `errors.ts`'s `isUniqueViolation`). `createTournamentRecord` /
  `updateTournamentRecord` take the `NewTournamentInput` type from `src/domain`
  (a sanctioned `data → domain` type import — see the open item below);
  `getTournamentForAdmin` / `deleteTournamentRecord` take only an `id`.
  **`getPublicTournament(id)` / `listPublicTournaments()` (Story 2.9)** — the
  first public (role-blind) reads in this file, both filtering
  `state != DRAFT` **and** `discipline = CLASSIC` unconditionally (AD-7/AD-9);
  a draft-preview exception, if a caller wants one, is resolved one layer up
  in the view (see `src/app/classic/[tournament]/page.tsx`), never here.
- `teams.ts` — `listTeams()` (every team, ordered by name — no draft/privacy
  concept, unlike `Tournament`) and `createTeamRecord(input)` — **the sole
  creator of a `Team`**; writes `input.name` and `input.nameKey` as given (both
  computed together by `validateNewTeam` in `src/domain/teamForm`, a type-only
  `data → domain` import — `createTeamRecord` never re-derives `nameKey` itself).
  `TEAM_NAME_KEY_INDEX` is the Postgres index name backing `nameKey @unique`,
  used with `errors.ts`'s `isUniqueViolation`.
- `entries.ts` — `listEntriesForTournament(tournamentId)` (admin read, joined
  `team: { id, name }`), `countTournamentEntries(tournamentId)` (**moved here
  from `tournaments.ts`, Story 2.7** — entry-owned, not tournament-owned;
  `transitionTournament`'s `DRAFT → GROUP_STAGE` precondition is still its only
  caller), `getEntryForAdmin(tournamentId, entryId)` (Story 2.8 — admin read,
  scoped by both ids together via `findFirst`, `null` if the pair doesn't
  match; the roster page's sole existence/ownership check),
  `createEntry(tournamentId, teamId)` — **the sole creator of a
  `TournamentEntry`** — and `deleteEntry(tournamentId, entryId)` — **the sole
  canceler**, scoped by both ids via `deleteMany` returning `{count}` (Story
  2.7 fix — a bare `delete({ where: { id } })` let a mismatched
  `tournamentId`/`entryId` pair cancel an entry in the wrong tournament;
  `removeTeamEntry` treats `count === 0` as not-found instead of catching
  `P2025`). Relies on the schema's `Player.entryId onDelete: Cascade` to
  remove the roster, no explicit cleanup code. `TOURNAMENT_ENTRY_NATURAL_KEY_INDEX`
  is the Postgres index name backing `@@unique([tournamentId, teamId])`, used
  with `errors.ts`'s `isUniqueViolation`. **`getEntryByTeam(tournamentId, teamId)`
  (Story 2.9)** — scoped by both ids together like `getEntryForAdmin`, but
  keyed by `teamId` (what the public roster route carries) instead of
  `entryId`. Deliberately **visibility-agnostic** — no state/discipline
  filter; the caller (a `src/app/classic/**` page) resolves whether the
  tournament is visible first, the same "scoping ≠ visibility" split
  `getEntryForAdmin` already models on the admin side.
- `players.ts` — the `Player` roster (Story 2.8), every function scoped by
  `(entryId, playerId)` together, never `playerId` alone (the same lesson as
  `entries.ts`'s Story 2.7 fix, applied here from the start).
  `listPlayersForEntry(entryId)` (admin read, ordered by `fullName`),
  `createPlayer(entryId, input)` — **the sole creator of a `Player`** — and
  `updatePlayer(entryId, playerId, input)` / `deletePlayer(entryId, playerId)`
  — the sole writer/canceler, both via `updateMany`/`deleteMany` returning
  `{count}`; `src/actions/players.ts` treats `count === 0` as not-found. Takes
  `PlayerInput` from `src/domain/playerForm` (a sanctioned type-only
  `data → domain` import, same pattern as `tournaments.ts`/`teams.ts`).
- `matches.ts` — `getStandings(tournamentId)` (Story 3.2), the group standings
  table. The first `data → domain` **value** call (every prior edge —
  `NewTournamentInput`, `PlayerInput`, etc. — was type-only): resolves the
  tournament's `Group` → its `GroupSlot`s (entry ids + team names, **not**
  `TournamentEntry` directly — see `GroupSlot`'s own doc comment in
  `schema.prisma`) → every `GROUP`-stage `Match` + `SetScore` → `src/domain/scoring.ts`'s
  `computeStandings` → `src/domain/tiebreak.ts`'s `orderStandings`. Returns
  `[]` pre-draw (no `GroupSlot` rows yet) — never stored (AD-4), recomputed
  every call. Each row is a `StandingsView` (`OrderedStandingsRow & { teamName }`
  — the name for the public «Таблиця» tab, Story 3.8). **`hasAnyGroupResult(tournamentId, client?)` (Story 3.4)** — whether
  any `GROUP`-stage `Match` has a `SetScore` yet; the sole read backing
  `checkCanRedraw`'s "no results yet" gate. `client` defaults to the shared
  `db`; `saveRedraw` (`draw.ts`) passes its transaction client to re-check
  this inside its own transaction (review fix — closes the TOCTOU window
  between the action's outer check and the write).
  **`allGroupMatchesPlayed(tournamentId, client?)` (Story 4.2)** — whether
  **every** `GROUP` match has a result. One `findMany` with `_count` on `sets`
  (a single snapshot, not two `count`s); the precondition input for
  `checkTransition(…, "PLAYOFF", …)`, distinct from `hasAnyGroupResult`'s
  "any". Takes a transaction client so `savePlayoffFormation` can re-check it
  inside its own transaction.
- `playoff.ts` — `savePlayoffFormation(tournamentId, bracket)` (Story 4.2), the
  `saveDraw` twin for the playoff. Takes the seeded `PlayoffBracket` (domain
  type) and does the `semifinals → row` mapping in one place. One
  `db.$transaction`: a `SELECT … FOR UPDATE` on the tournament row serialises
  concurrent formations (`saveDraw` gets the same from `GroupSlot`'s unique
  index — the playoff has none); then two re-checks that **return a result,
  not throw** (both are normal races): `allGroupMatchesPlayed` → `{ ok: false,
  reason: "group_incomplete" }`, and "a `SEMIFINAL` row already exists" →
  `{ ok: false, reason: "already_formed" }`. On success: `createMany` two
  `SEMIFINAL` rows (`groupId: null` — required by `match_group_stage_check`,
  each with its `slot`), then `setTournamentState(…, "PLAYOFF", tx)`. Throws
  only for a true invariant violation (a seeded semifinal missing a
  participant).
  **`getPlayoffBracket(tournamentId)` / `savePlayoffAdvancement(tournamentId)`
  (Story 4.3)** — the two `advanceBracket` call sites AD-5 mandates (read and
  write). `getPlayoffBracket` reads the up-to-four playoff `Match` rows, runs
  `advanceBracket`, and returns a `PlayoffBracketView` — each pair decorated
  with `matchId` (null until the row exists), team names, score summary and
  schedule, plus `placements` 1–4 (Story 4.4 — `playoffPlacements` over the
  same rows, team names resolved, each `null` until its deciding match is
  played); the shared read for the admin schedule section and Story 4.6's
  public bracket. `readPlayoffMatchStates(tournamentId)` (Story 4.4) is a lean
  flat read → `PlayoffMatchState[]`, feeding the semifinal-edit gate before a
  write. `savePlayoffAdvancement` runs after a semifinal-result
  mutation: one `db.$transaction` (`SELECT … FOR UPDATE`, then two **flat**
  queries — not a nested-relation `findMany`, which trips a pg-driver warning
  right after the raw lock), then `advanceBracket`, then per downstream slot —
  `PLAYED` skip (frozen), `READY` create-or-update the `FINAL`/`THIRD_PLACE`
  row, `AWAITING` null out an existing row's participants. Idempotent; never
  touches a `SEMIFINAL` row.
- `draw.ts` — `saveDraw(tournamentId, groupId, entryIds, pairings)` (Story
  3.3), the first real writer of `GroupSlot`/`Match`. One `db.$transaction`:
  seats every entry into `GroupSlot`, creates one `GROUP`-stage `Match` per
  pairing, then calls `tournaments.ts`'s `setTournamentState(..., tx)` — all
  atomically, so a partial failure can't leave draw data on a still-`DRAFT`
  tournament. Performs no validation itself; the caller (`drawTournament`)
  must already have confirmed the transition via `checkTransition`.
  **`listGroupEntryIds(groupId)` / `saveRedraw(tournamentId, groupId, pairings)`
  (Story 3.4)** — `listGroupEntryIds` reads who's actually seated (the source
  a redraw must reuse, never re-reading `TournamentEntry`); `saveRedraw`
  deletes every `GROUP`-stage `Match` for the tournament and recreates them
  from fresh pairings, in one transaction — never touches `GroupSlot` or
  `Tournament.state` (only the calendar changes on a redraw, not who's in the
  group or the lifecycle stage). `redrawTournament` confirms `checkCanRedraw`
  before calling this, but that check runs outside the transaction —
  `saveRedraw` re-checks `hasAnyGroupResult` (via its transaction client)
  right before the delete and aborts if a result now exists (review fix,
  Story 3.4), closing the TOCTOU window rather than relying solely on the
  caller's earlier check.
  **`listGroupMatchesForTournament(tournamentId)` / `updateMatchSchedule(tournamentId,
  matchId, input)` (Story 3.5)** — `listGroupMatchesForTournament` is the shared read
  for the public «Розклад» tab and the admin schedule page: every `GROUP` match with
  the two team names, `scheduledAt`/`venueText`, and its `SetScore` rows, ordered
  `scheduledAt` ascending (`nulls: "last"`) then `createdAt`. Visibility-agnostic —
  the caller resolves whether the tournament is public first (the `getEntryByTeam`
  contract). `updateMatchSchedule` sets just those two scheduling columns via
  `updateMany` scoped by `(tournamentId, matchId)` **and** `stage: "GROUP"` →
  `{ count }` (a mismatched `(tournamentId, matchId)` pair writes nothing; a
  playoff match is a valid target since Story 4.3 — AD-5); never touches
  `SetScore`, so an already-recorded result is unaffected (AC 1).
  **`getMatchForResult(tournamentId, matchId)` / `createMatchResult(tournamentId,
  matchId, sets)` (Story 3.6)** — `getMatchForResult` is the match screen's read
  (team names, stage, schedule, existing `SetScore` rows, the tournament's
  `scoringPreset`/`type`/`discipline`), scoped by the `(tournamentId, matchId)`
  pair. `createMatchResult` records a result in one `db.$transaction`: the match
  must exist, belong to the tournament (any stage — group or playoff, since
  Story 4.3), and have zero `SetScore` rows (first-entry only); then `createMany`.
  Returns `{ ok: true } | { ok: false; reason: "not_found" | "exists" }` — a
  `P2002` from `@@unique([matchId, setNo])` (a concurrent second entry) is caught
  via `errors.ts`'s `isUniqueViolation(err, SET_SCORE_NATURAL_KEY_INDEX)` and
  reported as `"exists"`, not thrown. No score validation here — the caller
  (`enterMatchResult`) has already run `src/domain/validation.ts`.
  `SET_SCORE_NATURAL_KEY_INDEX` is that constraint's Postgres index name.
  **`replaceMatchResult(tournamentId, matchId, sets)` / `deleteMatchResult(tournamentId,
  matchId)` (Story 3.7; any stage since Story 4.3)** — the edit and delete paths. `replaceMatchResult` is a
  delete-then-insert in one transaction that **re-checks `_count.sets > 0` inside
  the tx** (so a `deleteMatchResult` racing the caller's guard can't be silently
  resurrected — the Story 3.4 redraw pattern) and refuses an empty `sets` array;
  `{ ok: true } | { ok: false; reason: "not_found" }`, catching a concurrent
  editor (`P2002`) or redraw (`P2003`) as `not_found`. `deleteMatchResult` is
  `setScore.deleteMany` scoped by **both** `matchId` and the nested `match`
  filter (`tournamentId` + `stage: "GROUP"`) → `{ count }`; a mismatched pair or
  an already-empty match deletes nothing.

The `Tournament`, `Team`, `TournamentEntry`, `Player`, `Group`, `GroupSlot`, `Match`
and `SetScore` entities (schema landed across Story 2.1, 2.4, and 3.2, migrations
`20260903174727_tournament_schema` / `20260904160000_tournament_group_and_natural_key` /
`20260905125839_group_stage_schema`) are owned here too; their query/write functions
arrive with the feature stories (create → 2.4, team directory → 2.6, entries → 2.7,
players → 2.8, public reads → 2.9, standings → 3.2). Two query flavours per read:

- **public** — filter `state != DRAFT` **and** `discipline = CLASSIC` (AD-7, AD-9).
  Called from Server Components, no auth. First examples: `getPublicTournament` /
  `listPublicTournaments` (`tournaments.ts`, Story 2.9).
- **admin** — includes drafts; a separate function, called only from under
  `requireAdmin()`. Example: `getTournamentForAdmin`.

`Tournament.state` is written only through `setTournamentState` (Story 2.3 / AD-8),
never assigned directly — called by `transitionTournament` and, since Story 3.3, by
`draw.ts`'s `saveDraw` inside its own transaction. Standings and playoff placements
are **never** stored (AD-4) — there is deliberately no such column.

**May import:** the Prisma client and generated schema types. `client.ts` constructs
the single shared `PrismaClient` instance (`@prisma/adapter-pg` over the pooled
`DATABASE_URL`) and exports it as `db`; `src/auth` imports `db` from here for Better
Auth's adapter and never imports the Prisma client directly.

**Sanctioned exception to AD-11:** the build/CLI scripts `prisma/seed.mts` and
`prisma7.config.ts` construct their own client (direct/unpooled URL, own lifecycle);
the diagnostic script `scripts/db-check.mts` imports the shared `db` (and the
generated enums) directly for a live smoke check. None are application code and none
sit under `src/`, so the ESLint boundary blocks do not scope them — intentional, not
a gap. No file **inside `src/`** outside `src/data/` may import the client, and the
"reads/writes go through a named `src/data` function" convention likewise does not
bind the CLI scripts.

**Must not import:** `src/actions`, `src/auth`, `src/app`, `src/components`, `next`,
`react`.

**Open item — `src/domain`:** `getStandings()` is specified (`epics.md` Story 3.2) to
compute the table from `Match` + `SetScore` via `src/domain`. AD-3 as written forbids
`data → domain`; this tension is unresolved (see `src/README.md`). The lint does not
block it; use it for pure read-time computation only.

Rules that live here:

- Public-read queries always filter `state != DRAFT`. Queries that include drafts
  are separate functions, called only from under `requireAdmin()`.
- The group standings table and final placements are **not** stored — computed on
  read from `Match` + `SetScore`. No cache, no materialized rows.
- Callers get named functions, never a raw `PrismaClient`.

Enforced by `eslint.config.mjs`: the Prisma-client ban everywhere outside this
directory, and a block keeping this directory from importing higher layers or the
framework.
