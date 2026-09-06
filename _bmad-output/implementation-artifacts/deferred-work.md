# Deferred Work

Items surfaced during reviews that are real but not actionable in the story that found them.

## Deferred from / decided in: Story 4.1 implementation (2026-09-07)

- **Two persisted `SEMIFINAL` `Match` rows share `MatchStage.SEMIFINAL`.** `domain/bracket.ts` distinguishes the semifinals with a `slot: "SF1" | "SF2"` discriminator, but the DB enum has one `SEMIFINAL` value. Story 4.2 (playoff formation) needs a way to map the two persisted rows back to `SF1`/`SF2` when building `PlayoffMatchState[]` — `createdAt` order is the cheap option, a small schema field the explicit one. Not solved in 4.1.
- **`advanceBracket` must be invoked on *both* the write path and render (AD-5).** The engine exists; the call sites do not. Story 4.2 (formation), Story 4.3 (auto-fill final / third-place), Story 4.6 (public bracket render) each own one.
- **`playoffPlacements` is implemented but unused** until Story 4.4 wires it into playoff result entry, and Story 4.7 into the archive view (places 1–4; places 5+ from the group table).
- **`advanceBracket` returns `needsManualSeed: false` unconditionally.** The seed-time flag is `seedPlayoff`'s output — its input (`OrderedStandingsRow[]`) has it; `advanceBracket`'s input (`PlayoffMatchState[]`) does not. If a later story needs the flag on every bracket render, persist it at formation or re-run `seedPlayoff`.
- **No `Match`-row / persistence / Server Action / state-transition work.** `tournamentState.ts`'s `PLAYOFF` / `COMPLETED` predicates stay fail-closed stubs — Story 4.2 wires `allGroupMatchesPlayed`, Story 4.5 wires `finalAndThirdPlacePlayed`.

## Deferred from: code review of 3-8-public-standings-table (2026-09-07)

_Implementation review (`bmad-code-review`, 4 layers) over `git diff 7f8063c..HEAD`. Verification Gap found none. 0 decision-needed, 9 patch, 3 deferred, 5 dismissed._

- **`getStandings` is now the heaviest default landing query** on the most-hit public page (`/classic/[tournament]`, default tab = `standings`), uncached — `findUnique` + all `GroupSlot` + all `GROUP` matches + all `SetScore` + full recompute/reorder per request. `revalidatePath` is invalidation, not caching. Folds into the already-tracked "no caching/revalidation strategy for the app's first anonymous-traffic routes" item (2.9 review) — the real fix (an `unstable_cache` wrap + tag, and per-tab `loading.tsx`) is a cross-cutting decision. Small at v1 scale (NFR-5).
- **The standings top-4 is shown as definitive even when `needsManualSeed` straddles the cut-line.** Positions 4/5 tied on the name fallback still render position 4 with a confident "Виходить у плейоф"; the only "provisional" signal is the `*` + legend. _Engine half addressed in Story 4.1:_ `seedPlayoff` now returns `PlayoffBracket.needsManualSeed` (true when any of the top four used the name fallback). Surfacing it on the standings table / the playoff-formation button is Story 4.2.
- **`normalizeTournamentTab` / `defaultTab` / the `qualifies` cut-off / the zero-filled "Результатів поки немає" row have no automated coverage.** Consistent with the repo's no-page/component-test posture; `verify-group-stage-schema.mts` covers the `getStandings` data. A regression in "which tab do I land on" ships undetected. Same class as every prior page-wiring gap.

## Deferred from / decided in: Story 3.8 implementation (2026-09-07)

- **No component test for `standings-table.tsx`** — the standing "no component toolchain" gap. The *data* it renders is covered by `verify-group-stage-schema.mts` (now asserting `getStandings`'s `teamName` + `needsManualSeed`); the markup (semantics, `qualifies` styling, the no-results row) is verified by the documented manual pass only.
- **`<abbr>` single-letter column headers vs. full words.** `З`/`В`/`П`/`О`/`ВП`/`ПП` with a `title` tooltip keeps the table narrow on mobile but relies on hover/long-press for the expansion. An a11y pass may prefer full words + a wider scroll container, or a visible `<caption>`/legend spelling them out.
- **The `#F1F1EF` row divider (DESIGN.md) is approximated by `border-border`** — and the code review re-flagged it. Close but not the exact token; a design-system pass over table styling could pin it.
- **Resolves the 3.5-review tab work.** The «Таблиця» chip is un-hidden, the tab order is DESIGN §176, and the default tab is state-aware (`standings` in `GROUP_STAGE`+) — the three items the 3.5 review's Patch #1 explicitly assigned to Story 3.8.
- **"position 1–4" blue numeral contrast (1-2-review, owned by 3.8):** the marker is `font-bold` at `text-sm` (14px) → WCAG "large text" (3:1 threshold), and `#1F6FEB` on white ≈ 4.6:1 clears it. If the design-system pass shrinks the numeral or drops the bold, revisit.

## Deferred from: code review of 3-7-edit-delete-result (2026-09-07)

_Implementation review (`bmad-code-review`, 4 layers) over `git diff 41c0268..HEAD`. All 4 layers completed. 0 decision-needed, 8 patch, 1 deferred, 16 dismissed._

- **No audit trail for result corrections / deletions.** `editMatchResult` / `removeMatchResult` change or wipe a recorded score with no record of who did it or the prior value. Extends the "no audit trail for role changes" (1.7 review) and "no audit record for a lifecycle transition" (2.3 review) class — one small `AuditLog` (actor, entity, action, before/after, timestamp) would cover all three. PRD doesn't require it.

## Deferred from / decided in: Story 3.7 implementation (2026-09-06)

- **No action-level test for `editMatchResult` / `removeMatchResult`** beyond `scripts/verify-edit-delete-result.mts`. Same class as every prior action (no `requireAdmin` / session-mock infra). The domain validator is fully unit-tested; untested is the `requireAdmin` gate, the `getMatchForResult` branches, and the `count === 0` path.
- **The "плейоф-сітка, якщо існує" half of AC 1 has no code and no surface.** Playoff is Epic 4 (`domain/bracket.ts` + AD-5's freeze rule). The 4 `revalidatePath` calls reach the future playoff tab; editing a group result after a bracket is formed will change the seeding standings but must not re-seed a frozen bracket — that logic belongs to Epic 4, not here.
- **`replaceMatchResult`'s delete-then-insert is not guarded against a truly concurrent second editor.** Two admins editing the same match's result at once can interleave so one's write is lost (no `updatedAt`/version check). Same accepted TOCTOU class as every other check-then-act at this project's 2–5-admin scale; a redraw racing the edit is handled (`isMissingMatch` → `not_found`).
- **No `Tournament.state` guard on edit/delete** — consistent with `enterMatchResult` / `scheduleMatch`. A `COMPLETED` lock on result editing is FR-7 (Story 4.5); until then a completed tournament's archived results are editable.

## Deferred from / decided in: Story 3.6 implementation (2026-09-06)

- **No action-level test for `enterMatchResult` beyond `scripts/verify-match-result.mts`.** Same class as every prior action (no `requireAdmin` / session-mock infra). `validateMatchScore` is exhaustively unit-tested (Story 3.1); untested is the `requireAdmin` gate, the `getMatchForResult` branches, the `parseSetsFromForm` gap/non-integer paths, and the `"Партія N:"` message-mapping.
- **The `setErrors` mapping parses `validateMatchScore`'s message with `/^Партія (\d+): (.+)$/`.** A coupling point — if Story 3.1's message prefix ever changes, set-specific errors silently fall through to `formError` (degraded, not broken). A structured return from `validateMatchScore` (`{ ok: false; setNo?: number; message }`) would remove the regex; not done here to keep the Story 3.1 module untouched.
- ~~**"Таблиця групи перерахована" (AC 3) has no visible surface until Story 3.8.**~~ **Resolved in Story 3.8** — the «Таблиця» tab now renders `getStandings` on the public page; the result-entry actions already `revalidatePath` it.
- **`createMatchResult`'s `_count`-check-then-`createMany` is not fully atomic against a concurrent first entry.** The `$transaction` narrows the window and the `@@unique([matchId, setNo])` catch turns the race into a clean `"exists"` rather than a partial write or a thrown error — same accepted-risk class as every other check-then-act in this codebase at 2–5-admin scale.

## Deferred from: code review of 3-5-match-scheduling (2026-09-06)

_Implementation review (`bmad-code-review`, 4 layers) over `git diff b23c270..HEAD`. All 4 layers completed. 1 decision-needed, 8 patch, 4 deferred, 10 dismissed._

- **Redraw silently discards `scheduledAt`/`venueText`.** Story 3.4's `saveRedraw` deletes the whole `GROUP` calendar (per PRD FR-12 "видаляє попередній календар"), which now also throws away any dates/venues an admin entered via Story 3.5. The `RedrawTournamentButton` `ConfirmDialog` copy ("Поточний календар матчів буде видалено і згенеровано новий.") does not mention that schedule data is lost too. Candidate follow-up: enrich the confirm copy ("дату, час і зал матчів також буде втрачено").
- **DST edge hours in `parseKyivDateTimeLocal`.** A nonexistent spring-forward local time (03:00–03:59 on the switch Sunday) silently resolves forward an hour; an ambiguous autumn fall-back time deterministically picks the later (EET) occurrence. Both are untested beyond "doesn't throw" and undocumented as product decisions. No admin flow reaches them (matches aren't scheduled at 03:00 on a DST Sunday). Same item was noted during implementation.
- ~~**`setSummary` shows a partial result as final.**~~ **Addressed in Story 3.6** — the two inline reducers are replaced by the canonical `matchSetSummary` (`src/domain/scoring.ts`), and `enterMatchResult` persists a result only after `validateMatchScore` confirms the match is decided, so a persisted `sets.length > 0` group match is always complete. A partial score is now only reachable by a raw DB insert (same class as `getStandings`' documented trust).
- **`TournamentTabs` is hardcoded to the `/classic` route tree** and lives in `src/components` with a discipline-neutral name. A future beach- or archive-tournament tabbed page would silently link into `/classic`. Parameterize (base path or discipline prop) when the second real consumer arrives — likely `/archive/[year]/[tournament]` (Story 4.7).

## Deferred from / decided in: Story 3.5 implementation (2026-09-06)

- ~~**The match result summary ("3:1") is an inline `setSummary` reducer duplicated in
  two page files.**~~ **Resolved in Story 3.6** — `matchSetSummary(sets)` in
  `src/domain/scoring.ts` (built on the same `homeWonSet` comparison `countSetsWon`
  uses); both page-level reducers now call it.
- **`scheduleMatch` has no automated action-level test** beyond
  `scripts/verify-match-schedule.mts`. Same class as every prior action (no
  `requireAdmin` / session-mock infra). `validateMatchSchedule` is fully unit-tested;
  untested is the `requireAdmin` gate, the not-found branches, and the
  `count === 0` path.
- **`match-schedule.tsx` / `public-schedule.tsx` / `tournament-tabs.tsx` have no
  component test** — the standing "no component-test toolchain" gap.
- **`TournamentTabs` has no ARIA `tablist` / `tab` / `tabpanel` semantics.** The chips
  are `<Link>`s and each tab is a full server render (no client tab state), so a real
  tablist would need client JS and a different interaction model. Revisit if an a11y
  pass calls for it. (Supersedes the 2.9-review "tab-chip row has no ARIA tab
  semantics" note, now that the chips are real navigation.)
- **`parseKyivDateTimeLocal`'s behaviour for the one nonexistent / ambiguous
  wall-clock hour per year** (the DST switch) is defined by the offset-iteration and
  unit-tested for "doesn't throw", but not pinned to a product decision (skip forward
  vs. clamp). No admin flow exercises it and volleyball matches are not scheduled at
  03:00–04:00 on a DST Sunday.
- **`playoff` tab panel is a one-line placeholder.** Story 4.6 owns its real content.
  (`standings` was resolved in Story 3.8 — its panel now renders `getStandings`, and
  the `GROUP_NOT_DRAWN` pre-draw copy is wired for the admin-preview-of-`DRAFT` case.)

## Deferred from: code review of 3-4-redraw (2026-09-06)

_Implementation review (`bmad-code-review`, 4 layers) over `git diff 7acfa77..8397d9b`. All 4 layers completed (2 required a retry after a session rate limit reset). 0 decision-needed, 1 patched, 4 deferred, 12 dismissed._

- **`saveRedraw` deletes by `tournamentId + stage` only, not scoped by `groupId`** (unlike `saveDraw`'s consistent `groupId` scoping). Currently inert — v1 has exactly one `Group` per `Tournament` — but a latent inconsistency for the future multi-group format `GroupSlot`'s split from `TournamentEntry` was designed to allow.
- ~~**`drawTournament`/`redrawTournament` only revalidate the discipline index page, not the public tournament-detail route** (`/classic/[tournament]`).~~ **Resolved in Story 3.5** — both now `revalidatePath(`/classic/${tournamentId}`)`, since the Розклад tab renders the calendar.
- **`/admin/tournaments/[id]/page.tsx` fetches `hasAnyGroupResult` unconditionally**, even for `DRAFT`/`PLAYOFF`/`COMPLETED` tournaments where the redraw section never renders. An avoidable but negligible extra query at this project's scale.

## Deferred from / decided in: Story 3.4 implementation (2026-09-05)

- **No automated action-level test for `redrawTournament` beyond the verify script.** Same class of gap as `drawTournament`'s already-deferred item (Story 3.3) — no `requireAdmin`/session-mock harness exists yet. Mitigated by `scripts/verify-redraw.mts` (the real DB round-trip through `checkCanRedraw` → `generateSchedule` → `saveRedraw`) + the domain logic's own Vitest coverage (`redraw.test.ts`).
- **No atomic guard against two concurrent `redrawTournament` calls** (TOCTOU between `checkCanRedraw`'s read and `saveRedraw`'s write). Same accepted-risk class as `drawTournament`'s already-deferred TOCTOU item (Story 3.3 review) — lower stakes here, since a redraw requires an explicit `ConfirmDialog` click by a trusted admin and only matters in the narrow pre-first-result window.

## Deferred from: code review of 3-3-draw (2026-09-05)

_Implementation review (`bmad-code-review`, 4 layers) over `git diff 02979c09..0c35e4c`. All 4 layers completed. 1 decision-needed, 3 patched, 3 deferred, 10 dismissed._

- **No atomic guard against two truly concurrent `drawTournament` calls** (TOCTOU between `checkTransition`'s read and `saveDraw`'s write). Manually traced the transaction: a genuine race hits `GroupSlot`'s `@@unique([groupId, entryId])` inside `saveDraw`'s transaction, which rolls back cleanly (no data corruption) but surfaces to the losing caller as an unhandled exception / generic error toast instead of a precise "вже проведено" message. Same accepted-risk class as `enrollTeam`/`transitionTournament`/`updateTournament`'s already-deferred TOCTOU gaps at this project's 2–5-admin scale. Note: the earlier (Story 2.3-review) deferred item for `transitionTournament`'s TOCTOU gap explicitly said the atomic fix "belongs with the draw action" — this story's `saveDraw` transaction closes the *data-corruption* half of that (writes are atomic), but not the race-detection half (no conditional state check before writing); the general `transitionTournament` gap itself is still fully open.
- **`drawTournament` does not map Prisma errors** (the race above, or a `P2025` if the tournament is deleted mid-request) to a friendly `ActionResult` before `toActionError` re-throws them. Pre-existing pattern identical to `setTournamentState`'s already-tracked `P2025` gap (deferred since the 2.3/2.7 reviews); `admin-roles.ts` has the same shape.
- **Transaction timeout risk at the extreme of allowed input** (`teamCount = 64`, `rounds = 10` → up to 20,160 `Match` rows in one `$transaction`). Low probability at this project's real usage scale; a one-line `{ timeout }` option on `db.$transaction` fixes it if ever hit.

## Deferred from / decided in: Story 3.3 implementation (2026-09-05)

- **No automated action-level test for `drawTournament` beyond the verify script.** Same class of gap as every prior `src/actions` function without a `requireAdmin`/session-mock harness. Mitigated by `scripts/verify-draw.mts` (the real DB round-trip through `checkTransition` → `generateSchedule` → `saveDraw`) + code review.
- **`saveDraw`'s transactional atomicity is asserted by the verify script, not stress-tested under real concurrency.** Same accepted-risk class as every other TOCTOU item already tracked in this file (`enrollTeam`'s capacity check, `transitionTournament`/`updateTournament`'s state races) — low stakes at this project's admin-only scale.
- **`generateSchedule`'s pairing order is genuinely non-deterministic in production** (default `Math.random`-based shuffle). This is expected and desired (FR-11's "випадковий порядок пар у турах"), not a bug — noted here only so a future reader doesn't mistake the non-determinism for one.
- **`AD-8` wording item (tracked since Story 2.3) is now partially addressed in practice, not resolved.** `drawTournament` is the first genuinely "окрема Server Action" per transition that AD-8's original wording described (see line further down), but `transitionTournament` itself is still the single parameterized action for the other three edges — the spine-wording-vs-implementation tension itself is unchanged.

## Deferred from: code review of 2-8-roster-players (2026-09-05)

_Implementation review (`bmad-code-review`, 4 layers) over `git diff 2c6517e..HEAD`. Blind Hunter and Verification Gap Reviewer independently converged on the same finding (patched — see the story file's Review Findings). 0 decision-needed, 7 patched, 8 deferred, 5 dismissed._

- **`Player.fullName` has no internal-whitespace collapse**, unlike `Team.name`'s `normalizeTeamName`. No correctness stake — `fullName` has no uniqueness constraint (AC 3 explicitly allows duplicates) — so this is cosmetic consistency only, not a dedup-integrity issue like `Team.name`'s.
- **`height`/`weight` are unlabeled free text with no unit hint or numeric `inputMode`.** Story 2.1 decided all six optional fields are free text; a real UX affordance for these two specifically (since they're unambiguously numeric measurements) is polish, not required by any AC.
- **Switching the in-place edit target mid-edit silently discards unsaved typing.** Clicking "Редагувати" on a different roster row while one is already mid-edit unmounts the open `PlayerForm` with no dirty-check or confirmation. No persisted data loss, not required by any AC.
- **The roster page shows only the team name, not the tournament name.** An admin with several tournaments open across browser tabs can't tell rosters apart from the page alone.
- **No minimum roster size.** Nothing stops a tournament progressing past `DRAFT` with zero-player entries. SPEC gives no roster minimum; any such precondition belongs with Epic 3's draw action, which already owns the `DRAFT → GROUP_STAGE` preconditions.
- **Tournament-ownership scoping for player writes lives only in the action's call order, not the data layer.** `updatePlayer`/`deletePlayer` (`src/data/players.ts`) scope only by `(entryId, playerId)`; the tournament-ownership check happens once, earlier, via `getEntryForAdmin` in each Server Action. Accepted tradeoff — `Player` belongs to `TournamentEntry`, not directly to `Tournament`, so a single check reused by all three actions avoids a 3-way join in every data-layer call. (The concrete risk this created — the scoping was untested — is patched in this review, not deferred.)
- **No test asserts `listPlayersForEntry`'s documented `fullName`-ascending order.** Low-value test gap, same class as every other "no action-level test" item already tracked below.
- **`editPlayer`'s `formError` path doesn't auto-close the edit form.** If a player is deleted concurrently (`count === 0`), the edit form stays open referencing a gone player until the admin manually clicks "Скасувати". Rare race at this project's admin-only scale, same class as other accepted concurrency gaps.

## Deferred from: code review of 3-1-domain-engine-scoring-tiebreak-schedule-validation (2026-09-05)

_Implementation review (`bmad-code-review`, 4 layers) over `git diff 1b20a7a..HEAD`. 0 decision-needed, 8 patched, 5 deferred, 2 dismissed._

- **`generateSchedule` has no input validation for degenerate calls** (`rounds <= 0`, `entryIds` of length 0 or 1, a duplicate `entryId`). `TEAM_COUNT_MIN`/`ROUNDS_MIN` already prevent these at tournament creation before this function is ever called.
- **`computeStandings` doesn't guard a self-match or a duplicate `entryIds` entry.** `TournamentEntry`'s DB uniqueness and `generateSchedule`'s circle method structurally prevent both upstream.
- **`validateSetScore` doesn't guard a malformed `target` passed directly.** `target` is always derived via `targetScore()` in real call sites.
- **`orderStandings`'s `teamNames` map has no guard for a missing entry.** Expected to be built from the same entries being ordered.
- **The win-by-2-for-both-presets rationale could cite stronger PRD textual support** than the story currently argues (FR-5's own CUSTOM-target-score wording). Documentation-quality note, not a functional gap.

## Deferred from: code review of 3-2-group-stage-schema (2026-09-05)

_Implementation review (`bmad-code-review`) over `git diff 9e53089..HEAD`. **Only Blind Hunter and Edge Case Hunter completed — Verification Gap Reviewer and Acceptance Auditor failed on a session rate limit** and were not re-run; treat this review as partial, not the full 4-layer pass. 0 decision-needed, 8 patched, 5 deferred, 2 dismissed._

- **`Match.homeEntryId`/`awayEntryId` cascade-delete instead of `Restrict`**, unlike `Team`'s protection while it has entries. Structurally unreachable today (`checkCanRemoveEntry` only allows removal in `DRAFT`, before any `Match` exists) — changing it needs careful analysis of Postgres's cascade-resolution order against the existing `Tournament`-deletion chain, not a routine fix.
- **Nothing enforces `match.tournamentId === group.tournamentId` when `groupId` is set.** Not enforceable as a simple `CHECK`; structurally guaranteed by the only intended writer (Story 3.3's draw).
- **`getStandings` performs three sequential round trips instead of one nested Prisma query.** Perf nitpick, not correctness, at this project's scale.
- **The verify script's post-teardown assertions sit outside its `try`/`finally`** — a script robustness gap only, no production-code impact.
- **`getStandings` has no defensive handling for a `Match` entry absent from the group's `GroupSlot` list.** Same class as Story 3.1's already-deferred "missing `teamNames` entry" item; documented assumption that Story 3.3's draw creates both together.

## Deferred from / decided in: Story 3.2 implementation (2026-09-05)

- **No automated action-level test for `getStandings` beyond the verify script.** Same class of gap as every prior `src/data` function (no `requireAdmin`/session-mock infra) — though `getStandings` itself needs no admin gate, since it will be called from a public page (Story 3.8). Mitigated by `scripts/verify-group-stage-schema.mts` (the real DB round-trip) + code review.
- **`GroupSlot` has no seed/position field.** Only membership (`groupId`, `entryId`) is modeled. Revisit if a future story needs manual reseeding beyond the read-only `needsManualSeed` display flag (`tiebreak.ts`, Story 3.1) — nothing in Epic 3/4's stories asks for one today.
- **`Match.homeEntryId`/`awayEntryId` are nullable now, but this story never actually stores a null value there.** The nullability exists purely for Epic 4's `FINAL`/`THIRD_PLACE` playoff rows (AD-5's "computed live until a result exists" rule) — flagged here so Epic 4's bracket story doesn't have to rediscover why the columns are already nullable, and so nobody "fixes" them to `NOT NULL` in the meantime.

## Deferred from / decided in: Story 3.1 implementation (2026-09-05)

- **No from-empty integration test yet** — this story is 100% unit-testable in isolation (no `src/data`/`Match`/`SetScore` schema until Story 3.2), unlike every prior story since 2.1. Story 3.2's `getStandings(tournamentId)` will be the first real integration point; a disposable-Neon-branch round-trip test belongs there, not here.
- **The win-by-2-applies-to-both-presets decision is a judgment call, not an explicit PRD statement.** PRD's "різниця у 2 м'ячі" note sits under `CLASSIC`'s wording in FR-15; nothing there redefines what winning a set means under `CUSTOM`, so `validation.ts` applies it uniformly. Revisit if a real regulation ever states `CUSTOM` sets end differently.
- **The no-home/away-swap-between-cycles decision is the same kind of judgment call.** `schedule.ts`'s `rounds` cycles repeat the identical pairing set; PRD/epics never mention alternating home/away for a multi-cycle group stage, and volleyball has no codified home-advantage stat this app tracks. Revisit if a real regulation requires it.

## Deferred from: code review of 2-9-public-tournament-page-teams-tab (2026-09-05)

_Implementation review (`bmad-code-review`, 4 layers) over `git diff 7d4950c..HEAD`. **All 4 layers independently converged on the same critical finding** (patched — see the story file's Review Findings). 0 decision-needed, 5 patched, 8 deferred, 3 dismissed._

- **No automated test for the `BEACH`-discipline admin-preview path.** `resolveTournament` depends on `getSessionUser()` (`next/headers`), which can't run outside a real Next.js request the way the existing `verify-*.mts` scripts run pure `src/data` functions. Mitigated by the code fix plus a live manual verification.
- **No caching/revalidation strategy for the app's first anonymous-traffic-facing routes.** Every request runs fresh Prisma queries. A product/perf decision, not a bug.
- **`listPublicTournaments()` doesn't distinguish active from `COMPLETED` tournaments, and its relationship to the future `/archive` route tree (Story 4.7) is undiscussed.** Real question for whoever builds `/archive` — will completed tournaments need to disappear from `/classic` once archived, or is the overlap intentional?
- **The tab-chip row has no ARIA tab semantics.** A11y polish — these are inert placeholder chips, not yet a real tablist with real panels.
- **`resolveTournament`/`getEntryByTeam` are each called twice per request** (once from `generateMetadata`, once from the page body), with no caching/dedup beyond `getSessionUser`'s own `cache()`. Perf note only.
- **No SEO/indexing discussion** (robots/sitemap, `noindex` for the admin-preview render path) for the app's first crawlable, sign-in-free content.
- **AD-3's dependency graph doesn't literally name a `view → auth` edge**, and this story's use of it (widening visibility for an admin preview) is materially different from `/admin/layout.tsx`'s existing use (gating/denying access to an already-admin-only tree). A spine-reconciliation gap, same class as the already-tracked `data → domain` open item — not a code defect.
- **`/classic`'s listing has no admin-preview logic**, unlike the tournament/roster pages — an admin's own `DRAFT` tournament never appears there, only reachable via a direct link. Satisfies AC 3's literal text but is an undocumented asymmetry.

## Deferred from / decided in: Story 2.9 implementation (2026-09-05)

- **No automated test for the admin draft-preview fallback branch.** Both `/classic/[tournament]/page.tsx` and `.../teams/[team]/page.tsx` call `getSessionUser()` and branch on `user?.isAdmin` when the public read returns `null` — untested beyond a manual signed-in browser pass, the same class of gap as every prior admin-touching flow (no `requireAdmin`/session-mock infra).
- **`status-badge.tsx`/`public-roster.tsx` have no component-level test.** Same "no component-test toolchain" gap tracked since the 2-2 review.
- ~~**The four-tab-chip row is inline JSX in the page, not a reusable component.**~~ **Resolved in Story 3.5** — `src/components/tournament-tabs.tsx` (`TournamentTabs` + `normalizeTournamentTab`), `?tab=` routing on `/classic/[tournament]`, and the "Плейоф tab hidden until `PLAYOFF`+" rule all landed now that Розклад is the first real tab.
- **`getPublicTournament`/`listPublicTournaments`/`getEntryByTeam` have no automated test beyond `scripts/verify-public-tournament.mts` and a live browser walkthrough.** Unlike every prior admin-only story, this one's core flow needed no `requireAdmin`/session-mock infra to test manually — a real, unblocked browser pass covered the non-admin path end to end.

## Deferred from / decided in: Story 2.8 implementation (2026-09-05)

- **`addPlayer`/`editPlayer`/`removePlayer` have no automated action-level test.** Same class of gap as every prior action (no `requireAdmin`/session-mock infra). `validatePlayer` is exhaustively unit-tested (`src/domain/playerForm.test.ts`); untested is the `requireAdmin` gate, the `getEntryForAdmin` not-found path, and the `(entryId, playerId)`-scoped `count === 0` branches. Mitigated by `scripts/verify-roster.mts` (the real `src/data` round-trip, including the scoped-to-a-different-entry regression case) + code review.
- **`player-form.tsx` / `roster.tsx` have no component-level test.** Same "no component-test toolchain" gap tracked since the 2-2 review.
- **No roster-size cap.** SPEC/AC give no maximum player count; an admin can add an unbounded number of players to one entry. Not required by any AC — flag if a real max ever surfaces (e.g. from a federation rule).
- **No public roster read yet.** `listPlayersForEntry` is admin-only in this story (`/admin/tournaments/[id]/entries/[entryId]`); whether/how a public tournament page shows team rosters is Story 2.9's decision.

## Deferred from: code review of 2-7-enroll-remove-team (2026-09-05)

_Implementation review (`bmad-code-review`, 4 layers, all 4 independently converging on the same critical finding — see the Patch section applied in the story) over `git diff 42ec6e9..HEAD`. 7 patches applied, 3 items deferred, 5 dismissed._

- **`enrollTeam`'s capacity check is check-then-act, not atomic.** Two concurrent enrollments near capacity can both pass `checkCanEnroll` and both insert, pushing `TournamentEntry` count past `Tournament.teamCount` — the exact overrun the "resolved" item above only closes for a single request. Same risk class, same "low at 2-5-admin scale" tolerance already accepted for `transitionTournament` (2.3 review) and `updateTournament` (2.5 review).
- **Neither `enrollTeam` nor `removeTeamEntry` re-checks `tournament.state` at write time against a concurrent `transitionTournament`.** Extends the same already-deferred TOCTOU class (2.3/2.5 reviews) to these two new writers. The eventual fix (a conditional `updateMany`/`deleteMany` scoped by `state`, or a `$transaction`) belongs with whichever story first needs real transactional guarantees — likely the draw (Epic 3), same as the other two entries in this class.
- **No visual capacity indicator in the "Команди" section** (e.g. "3 / 8 заявлено") — an admin only learns the field is full after the control disables and they read the caption. Polish, not required by any AC.

## Deferred from / decided in: Story 2.7 implementation (2026-09-05)

- **`enrollTeam`/`removeTeamEntry` have no automated action-level test.** Same class of gap as every prior action (no `requireAdmin`/session-mock infra). Narrower than usual this time — the actual business rules (`checkCanEnroll`/`checkCanRemoveEntry`) are unit-tested in `src/domain/teamEnrollment.test.ts`; what's untested is only the `requireAdmin` gate, the DB round-trip, and the `P2002`/`P2025` catches. Mitigated by `scripts/verify-team-enrollment.mts` + code review.
- **`team-enrollment.tsx` has no component-level test.** Same "no component-test toolchain" gap tracked since the 2-2 review.
- **"Field full" vs "team already enrolled" have no visual distinction beyond toast text.** Both `PRECONDITION_FAILED` outcomes render identically (a `notify.error` with a different message). A richer inline treatment (e.g. disabling the picker with different captions for each cause) is real polish, not required by the AC.

## Deferred from: code review of 2-6-team-directory (2026-09-04)

_Implementation review (`bmad-code-review`, 4 layers) over `git diff 0e485ae..HEAD`. All 3 ACs met. 7 patches applied in the story, 2 items deferred, 6 dismissed._

- **Duplicate-name rejection has no persistent, field-level indicator — only a transient toast.** Both `createTeam` (Story 2.6) and `createTournament` (Story 2.4) return a `P2002` collision as `formError` alone, never `fieldErrors.name` — unlike every other validation failure on the same forms, which stays visible under the field via `aria-invalid`/`aria-describedby` until fixed. Once the toast fades, there's no lasting sign of what was wrong. A fix belongs to a cross-cutting pass over both forms (return the duplicate as a field error, not just a form error), not a one-off patch to either story alone.
- **`/admin/teams` has no pagination, search, or filter; `listTeams()` is an unbounded `findMany`.** Same class as the already-tracked `/admin/people` "unbounded, no pagination" item (1-7 review) and the `/admin/tournaments` item (2-5 review) — add a cap + filter once any of these lists gets long enough to matter.

## Deferred from / decided in: Story 2.6 implementation (2026-09-04)

- **No team edit or delete.** FR-8 / the Story 2.6 AC only cover create-and-reuse. A mistyped team name has no in-app fix short of a direct DB edit, and an unused team can't be removed. Real future work — the natural next owner would be a small "team detail" surface, and delete needs its own `P2003` handling (see the item above).
- **`createTeam` has no automated action-level test.** Same class of gap as every prior `useActionState` action (`createTournament`, `updateTournament`) — no `requireAdmin`/session-mock infra. Mitigated by `typecheck` + `lint` + `scripts/verify-team-create.mts` (the real data-layer check) + code review.
- **`team-form.tsx`'s clear-on-success / `router.refresh()` effect has no component test.** Same "no component-test toolchain" gap tracked since the 2-2 review.

## Deferred from: code review of 2-5-edit-delete-tournament (2026-09-04)

_Implementation review (`bmad-code-review`, 4 layers) over `git diff d4077d9..HEAD`. All 3 ACs met. 9 patches applied in the story, 4 items deferred, 2 dismissed._

- **TOCTOU race on `updateTournament`'s `DRAFT` lock.** `tournament.state` is read once (`getTournamentForAdmin`), then `updateTournamentRecord` writes with no `state` guard in its `where` clause — a concurrent `transitionTournament` moving the row off `DRAFT` between the read and the write would still let the submitted `teamCount`/`rounds` persist. Same risk class, same "low at 2-5-admin scale" tolerance, as the already-deferred "No atomic transition" item from the 2.3 review (`setTournamentState` has the identical read-then-write gap). The eventual fix (a conditional `updateMany({ where: { id, state: "DRAFT" } })` returning a conflict when zero rows match, or a `$transaction`) belongs with whichever story first needs real transactional guarantees around `state` — likely the draw (Epic 3).
- **Editing a `COMPLETED`/archived tournament gets no extra friction, unlike delete.** This story explicitly decided delete has no state restriction, matching the epics AC as written; the same "editable in any state" latitude extends to the edit form's `name`/`year`/`type`/`scoringPreset` fields, so a `COMPLETED` tournament already in the public archive can be silently renamed/re-typed with just a success toast. Same candidate follow-up as the delete item above (an `archived`-aware confirmation, or read-only fields once `COMPLETED`) — not built here, just flagged alongside it.
- **`/admin/tournaments` has no pagination, search, or discipline/state filter.** As tournaments accumulate across seasons this becomes one long undifferentiated list. Same class as the already-tracked `/admin/people` "unbounded, no pagination" item (1-7 review) — add a cap + filter when either list gets long enough to matter.
- **`updateTournament`'s `getTournamentForAdmin` read and `updateTournamentRecord`'s unmapped-error branch aren't wrapped in a unified catch.** An unexpected Prisma error (connection loss, etc.) from either call propagates as an unhandled exception rather than degrading to `{ formError }`. This is not a new gap — it's the exact same pattern `createTournament` (Story 2.4) already ships for the identical `CreateTournamentState`-return-shape actions (which can't use `toActionError`'s `ActionResult` shape), itself already accepted. Revisit together if the `CreateTournamentState`/`ActionResult` split is ever unified.

## Deferred from / decided in: Story 2.5 implementation (2026-09-04)

- **Tournament delete has no state restriction, by decision.** See the resolved 2-1 item above — flagging the follow-up here too since it is a real product risk, not just a historical note: a `COMPLETED` tournament (already in the public archive) can be deleted by any admin who confirms the dialog, with no extra friction. Candidate fix: an `archived` boolean instead of a hard delete, or a second confirmation step that names the archive impact specifically.
- **`updateTournament` / `deleteTournament` have no automated test.** Same class of gap as `createTournament` / `transitionTournament` (no `requireAdmin` / session-mock infra). Mitigated by `typecheck` + `lint` + the DB round-trip script (Task 10) + a manual signed-in walkthrough + code review, not a unit/integration test.
- **The edit form's success-detection effect (`tournament-form.tsx`, the `wasPending` falling-edge check) has no component test.** Same "no component-test toolchain" gap tracked since the 2-2 review (jsdom / testing-library not installed) — fold in when that toolchain lands.
- **The `teamCount`/`rounds`-locked-outside-`DRAFT` UI path (disabled inputs + caption) has no real fixture to walk.** There is still no way to reach `GROUP_STAGE`+ before Epic 3's draw ships, so this was verified by code review + the server-side substitution in `updateTournament`, not a live browser check against a non-`DRAFT` tournament.

## Updated by: Story 2.3 implementation (2026-09-04)

_Story 2.3 landed `src/domain/tournamentState.ts`, the `transitionTournament` Server Action, `src/data/tournaments.ts`, and the **Vitest runner** (`pnpm test`, `environment: node`, `src/**/*.test.ts`). Effect on carried items:_

- **Resolved — "`Tournament.state` is directly assignable in the schema" (2-1 review).** `transitionTournament` + `src/domain/tournamentState.ts` now exist; `setTournamentState` is the only `src/data` function that writes `state`, and it takes no other `state`-writing sibling. Still a convention, not a lint rule — a stray `db.tournament.update({ data: { state } })` elsewhere would pass lint. Re-check on every story that touches `src/data/tournaments.ts`.
- **Partially unblocked — the Vitest *runner* now exists**, but only the pure-`node` setup. The component tests named in the 2-2 items (`ConfirmDialog` / `admin-role-controls` — resolve-closes / throw-stays-open / pending-lock / last-admin branch / self-revoke nav) and any action-layer test still need `@testing-library/react` + `jsdom` + a `requireAdmin` / `next/headers` session mock, none of which this story added. Those items stand; "add when the runner lands" now reads "add the component-test toolchain + session mock on top of the runner".
- **Still open — the 1-3 committed negative-import fixture.** Story 2.3's boundary probe (inject `@/data/client` into `tournamentState.ts`, confirm `pnpm lint` errors, revert) was run and passed, but it is still a throwaway, not a committed fixture. A `*.test.ts` that shells out to `eslint --no-eslintrc` on a fixture string, or a CI `pnpm lint` job, remains the durable fix.
- **New — `transitionTournament` and `src/data/tournaments.ts` have no automated coverage.** `src/domain/tournamentState.test.ts` covers the pure transition logic exhaustively (25 cases), but the Server Action's `requireAdmin` gate, the not-found path, the `GROUP_STAGE` entry-count wiring (`tournament.teamCount` vs `tournament.rounds` — both `number`, so a swap is type-clean), the `revalidatePath` calls, and the `setTournamentState` write are structurally unreachable by a domain unit test — untested, mitigated only by the small surface and code review. Domain↔Prisma `TournamentState` drift is caught by `tsc` at the `transitionTournament` call site (where a Prisma-typed `tournament.state` meets the domain `checkTransition`), but not by an explicit assertion. Needs the action-layer session mock (overlaps 1-7 "no automated end-to-end / action-layer coverage") plus a disposable-Neon-branch integration spec for the `src/data` round-trip (overlaps 2-1 "from-empty replay + constraint/cascade integration tests").

## Deferred from / decided in: Story 2.4 implementation (2026-09-04)

- **`Group` was added in Epic 2, not Epic 3.** Story 2.4 ships a **minimal** `Group` model (`id`, `tournamentId @unique`, timestamps — `onDelete: Cascade`) and `createTournamentRecord` creates the row with the tournament, to satisfy AC 1 ("created … with exactly one `Group`"). **Story 3.2's migration must add only `GroupSlot` / `Match` / `SetScore` and the `Group.slots` / `Group.matches` back-relations — it must NOT re-create `Group`.** If multi-group is ever revived (post-v1), drop the `tournamentId @unique` then.
- **`teamCount` lower bound is 4** (`src/domain/tournamentForm.ts` `TEAM_COUNT_MIN`). Rationale: the v1 playoff is a fixed 4-team bracket (SPEC Constraints), so a tournament with fewer than 4 teams could never form one. If a group-only tournament (no playoff) is a valid v1 use case, relax to `2` — a one-line change in the domain module + its spec. Raised with the user at story-draft time; no objection recorded.
- **`createTournament` (the Server Action) has no automated test.** `validateNewTournament` is exhaustively unit-tested (14 Vitest cases) and `scripts/verify-tournament-create.mts` covers the `src/data` layer for real (DRAFT + one Group + preset stored + `P2002`, self-cleaning). Untested: the action's `requireAdmin` gate, the `redirect`, and the `formError` wiring — same gap as `transitionTournament` (no session mock). Residual gate: a **manual signed-in pass** on `/admin/tournaments/new` (valid create → redirect → `[id]` page; an invalid submit → per-field errors rendered; a duplicate → the toast).
- **`src/data → src/domain` and `src/components → src/domain` are now real edges** (type + const imports only, no logic). AD-3 as written forbids `data → domain`; the reconciliation (spine edit vs. accept) is still owed — folded into the existing Epic 3 `getStandings()` open item.
- **`Tournament.name` is only trimmed, not normalized, against the new exact-string `@@unique([discipline, type, year, name])`.** "Кубок Черкащини" and "кубок  черкащини" (same discipline/type/year) both pass validation and insert as two distinct tournaments, even though the duplicate-name error implies they'd collide. Same shape as the existing "`Team.name @unique` has no normalization" item (2-1 review, owned by Story 2.6) — add a normalized comparison (case-fold + collapse whitespace) if this surfaces in practice, likely alongside whatever Story 2.6 lands for `Team`.

## Deferred from: code review of 2-4-create-tournament (2026-09-04)

_Implementation review (`bmad-code-review`, 4 layers), run after the `/code-review` fix pass. All 4 ACs met. 5 patches applied in the story, 3 items deferred, 12 dismissed._

- ~~**No admin listing page for tournaments.**~~ **Resolved in Story 2.5** — `/admin/tournaments` (`listTournamentsForAdmin`), linked from the `/admin` dashboard.
- ~~**`createTournament` does not call `revalidatePath`.**~~ **Resolved in Story 2.5** — now calls `revalidatePath("/admin/tournaments")` before its `redirect()`, since that list exists.
- **`TournamentForm`'s field-error rendering has no component test** (no assertion that a given `fieldErrors` key renders under the correct field with the right `aria-describedby`). Same class as the existing "no component-test toolchain" gap (jsdom / testing-library not installed, tracked since the 2-2 review) — fold in when that toolchain lands.

## Deferred from: code review of 2-3-tournament-state-machine (2026-09-04)

_Implementation review (`bmad-code-review`, 4 layers). All 3 ACs met. 5 patches applied in the story, 7 items deferred, 8 dismissed._

- **Action-layer coverage for `transitionTournament` / `src/data/tournaments.ts`.** The `requireAdmin` gate, the `NOT_FOUND` branch, and the `GROUP_STAGE` context wiring (`tournament.teamCount` vs `tournament.rounds` — both `number`, so a swap is type-clean) are structurally unreachable by a domain unit test. Needs the `requireAdmin` / `next/headers` session-mock infra the repo lacks (overlaps the 1-7 "no automated end-to-end / action-layer coverage" item) plus a disposable-Neon-branch integration spec for the `src/data` round-trip (overlaps the 2-1 "from-empty replay" item).
- **No atomic transition.** `getTournamentForAdmin` → `checkTransition` → `setTournamentState` is not wrapped; two concurrent `transitionTournament` calls (or a double-click) both pass and both write, and for `DRAFT → GROUP_STAGE` the `countTournamentEntries` input is read outside any transaction with the write. Low at 2–5-admin scale with a forward-only table. The atomic version (a conditional `updateMany({ where: { id, state: <from> } })` returning a conflict code, or a `$transaction` around count + write) belongs with the draw action, which has the real caller and already needs a transaction for calendar generation.
- **Prisma errors from `setTournamentState` escape the `try/catch`.** `toActionError` re-throws every non-`AdminRequiredError`, so `P2025` (tournament row deleted between the read and the write) and connection loss propagate as unhandled exceptions instead of `{ ok: false, code }`. Pre-existing pattern (`admin-roles.ts` is identical; 1-7 review deferred the same `P2025` gap). **Partially resolved in Story 2.5** — the new `updateTournamentRecord` / `deleteTournamentRecord` writers are wrapped with `isRecordNotFound` (P2025 → a mapped error, not an unhandled exception). `setTournamentState` itself is untouched — still open for `transitionTournament`.
- **No CI runs `pnpm test` / `pnpm lint` / `pnpm typecheck` on push.** Pre-existing (tracked since the 1-1 review as "No CI gate on push to `main`"). Now also affects the domain suite: a broken `TRANSITIONS` table or a flipped fail-closed predicate reaches production if a contributor skips the local run, since Vercel's `build` calls none of the three.
- **AD-8 wording vs the implementation.** ARCHITECTURE-SPINE AD-8 says the transitions are "окремі Server Actions, кожна перевіряє передумови" (one per transition); the implementation is a single parameterised `transitionTournament(id, targetState)`. The Story 2.3 AC names the single action and SPEC CAP-2 (central gate, no bypass) is satisfied, but the spine wording is unreconciled — a spine edit or an explicit accepted-deviation note. **Partially addressed by Story 3.3**: `drawTournament` is the first genuinely dedicated per-transition Server Action (reusing `checkTransition` directly, not nesting a call to `transitionTournament`) — but the other three edges still go through the single generic action, so the wording tension itself remains open.
- **No view helper for "available transitions + why each is blocked".** The view is told to use `canTransition` (edge-only), so an admin action-bar will show a button that `checkTransition` then rejects on click. Story 2.9 (status badge / admin action-bar context) is the natural owner and knows the UI shape.
- **No audit record for a lifecycle transition.** `updatedAt` also moves on unrelated edits; `→ COMPLETED` publishes a tournament to the public archive with no `stateChangedAt` column or log row. Extends the 1-7 "no audit trail for role changes" item. PRD does not require it.

## Deferred from: code review of 2-2-reusable-ux-patterns — implementation (2026-09-04)

_Review of commit `4f5afd4` (`bmad-code-review`, 4 layers). No AC violations; 3 decisions + 8 patches handled in the story. These 3 carry past._

- **grant/revoke *success* + list-refresh path was never run against a real admin session.** `RevokeAdminButton` dropped `useTransition`; the non-self list re-render now rides the Server Action's `revalidatePath("/admin/people")` (automatic on a client-invoked action) plus a belt-and-braces `router.refresh()`. The mechanism is standard Next, but the browser walkthrough only exercised the unauthenticated `FORBIDDEN` path (scratch page, since deleted). **Before the push to `main`:** a manual signed-in pass — grant, revoke-other, revoke-self — on `/admin/people`, confirming the row flips without a reload and the dialog closes. A Vitest component test (`revokeAdmin` mocked `{ok:true}` → asserts `router.refresh` called + dialog unmounts) is the first thing for the Story 2.3 runner (overlaps the existing "no automated action-layer coverage" 1-7 item).
- **`--success` `#1F8A54` fails WCAG AA with white text (≈ 4.32 : 1 < 4.5 : 1).** First surfaced by the Story 2.2 success toast (the first solid-fill text use of the token pair). **Story 3.6 adds the first `text-success` *body text* on white** (the "Результат: X:Y" link on the schedule row, `text-sm`, ≈ 4.35 : 1) — same sub-AA problem, same page. `--destructive` `#C4342B` is ≈ 5.4 : 1 and fine. Roll into one design-system contrast pass with the already-deferred "small blue-text contrast" (1-2 review) and the future `link` Button variant — decide there whether to darken `--success` or accept the redundant-cue argument (colour + icon + message).
- **UX-DR9 and `DESIGN.md` §Components still specify a `display-sm` empty-state heading; the code ships `text-lg`.** The deviation is signed off, but only in `2-2-reusable-ux-patterns.md`. Add a one-line note to the binding docs (or a UX addendum) so a future reader of DESIGN.md / epics.md isn't misled.

## Deferred from: code review of 2-2-reusable-ux-patterns (2026-09-04)

_Pre-implementation review of the story draft (`bmad-code-review`, 4 layers). The story is still `ready-for-dev`; these are carried past it._

- **The `admin-role-controls.tsx` migration (Story 2.2 / Task 6) ships to `main` — which auto-deploys to prod — gated only by a manual browser walkthrough.** No CI, no component tests until Vitest lands (Story 2.3). This is the same "no CI gate / no automated action-layer coverage" gap already tracked from the 1-1 and 1-7 reviews; the `admin-role-controls` migration widens the blast radius (it rewrites a shipped, code-reviewed Story 1.7 feature: drops `useTransition`, swaps the hand-rolled `Dialog` for `ConfirmDialog`, makes `revoke()` throw on failure). The 1-7 deferred-work mandate explicitly assigns the migration to Story 2.2, so it is not splittable. Story 2.2's Task 8 walkthrough must be thorough; a Vitest contract test for `ConfirmDialog` + `admin-role-controls` (resolve-closes / throw-stays-open / pending close-suppression / last-admin disabled branch / self-revoke navigation) should be the first thing written when the runner arrives in Story 2.3.
- **`no-alert` (Story 2.2 / Task 4) has the same non-durable verification as the Story 1.3 import-boundary rules** — verified once with a throwaway probe that is then deleted, no committed negative fixture, and `next build` (the only thing that runs on push to `main`) does not run the ESLint blocks. A later `eslint-config-next` bump that reorders/overrides rule blocks, or an accidental deletion of the block, leaves `pnpm lint` green and a `confirm()` can ship — exactly the AC-1 violation the rule exists to prevent. Fold into the existing "committed `eslint` negative fixture check once Vitest lands" item (1-3 review).
- **`ConfirmDialog` fully locks while `onConfirm` is in flight** (both buttons disabled + Esc/backdrop/X suppressed). Deliberate (the "don't close mid-request" requirement), and bounded by the platform function timeout (a hung Server Action rejects → the `catch` reopens the dialog), so not "user trapped forever" — but a slow action gives the user a spinner and no escape for up to that timeout. Revisit if a feature story wraps a genuinely long-running action in `ConfirmDialog`; a cancel affordance or a client-side timeout race would be the fix.

## Deferred from: code review of 1-1-starter-and-deploy (2026-09-03)

- **No CI gate on push to `main`.** There is no `.github/workflows/`. `main` auto-deploys to Vercel, which runs `next build` (covers AC1's build half) but not `pnpm lint` (Next 16 dropped lint-during-build) and not a Node-24-pinned check. AC1's "lint clean on Node 24" is currently enforced only by a one-time manual local run. Candidate: a small CI story, or fold into Story 1.3 (which already touches the lint config).
- ~~**Neon migrations need a direct connection URL.**~~ **Resolved in Story 1.4.** `prisma7.config.ts` `datasource.url` = `DIRECT_URL ?? DATABASE_URL_UNPOOLED ?? DATABASE_URL`; `.env.example` documents `DIRECT_URL`. `migrate dev` applied clean.
- ~~**`next.config.ts` is an empty placeholder** (no `serverExternalPackages`).~~ **Partly resolved in Story 1.4.** Added `serverExternalPackages: ["pg", "@prisma/adapter-pg"]`. Security headers / image config still deferred to a hardening pass.

## Deferred from: code review of 2-1-tournament-team-player-schema (2026-09-03)

- ~~**`Tournament` has no natural-key uniqueness.**~~ **Resolved in Story 2.4** — `@@unique([discipline, type, year, name])` added (migration `20260904160000_tournament_group_and_natural_key`); `createTournament` catches the `P2002` and returns "Турнір з такою назвою вже існує за цей рік.".
- **No soft-delete / archival concept.** Deleting a `Tournament` DB-cascades its entries and players; deleting a `TournamentEntry` erases that team's roster. **Decided in Story 2.5: delete has no state restriction** — matches the epics AC as written (confirm → delete, no gating clause), so a `COMPLETED` tournament (already in the public archive) can be deleted by an admin who explicitly confirms. This is a real risk against SPEC's "втрата історії неприйнятна" — a candidate follow-up (an `archived` soft-delete flag, or a second confirmation step naming the archive impact) is still open, just not built here.
- ~~**`discipline` + `type` combination is unconstrained**~~ **Resolved in Story 2.4** — `allowedTournamentTypes(discipline)` in `src/domain/tournamentForm.ts` (BEACH → `[]`), and the create form hardcodes `discipline: "CLASSIC"`. The schema still permits any `(discipline, type)` pair at the DB level (unreachable — no BEACH create path); a DB `CHECK` was not added.
- ~~**`Team.name @unique` has no normalization.**~~ **Resolved in Story 2.6** — `Team.name` dropped its own `@unique`; `nameKey` (trim + collapse whitespace + case-fold, `src/domain/teamForm.ts`) is the new dedup anchor. `createTeam` catches the `P2002` (via the now-shared `isUniqueViolation`) and returns "Команда з такою назвою вже існує.".
- **`P2002` / `P2003` / `P2025` mapping** — partially addressed. Story 2.4 added `isUniqueViolation(error)`; Story 2.5 added `isRecordNotFound(error)` (P2025); Story 2.6 moved both into a shared `src/data/errors.ts` (three consumers now: `tournaments.ts`, `teams.ts`) and used `isUniqueViolation` for `Team.nameKey`. `Tournament` delete never hits `P2003` (its cascades all point away from `Team`, the only `Restrict` FK); `Team` has **no delete action at all** in v1 (Story 2.6 explicitly scoped it out), so `P2003` (deleting an entered `Team`, `TournamentEntry.team` `onDelete: Restrict`) still has no code path to hit it and stays open for whichever future story adds team delete.
- ~~**`TournamentEntry` count vs `Tournament.teamCount`.**~~ **Resolved in Story 2.7 for the single-request case** — `checkCanEnroll` (`src/domain/teamEnrollment.ts`) rejects enrollment once `currentEntryCount >= teamCount`, called from `enrollTeam` before `createEntry`. **Not resolved under concurrency** (2-7 review): the check-then-act sequence (`countTournamentEntries` → `checkCanEnroll` → `createEntry`, no transaction) lets two concurrent `enrollTeam` calls near capacity both pass and both insert — see the new TOCTOU item below, same accepted-risk class as `transitionTournament`'s.
- ~~**`Tournament.state` is directly assignable in the schema.**~~ **Resolved in Story 2.3** — `transitionTournament` + `src/domain/tournamentState.ts` landed; `setTournamentState` is the sole `state` writer. Convention, not lint-enforced (see the Story 2.3 update note at the top).
- ~~**No public URL identifier**~~ **Decided in Story 2.9: no.** Neither SPEC nor the epics AC asks for a pretty URL, and a slug needs its own schema migration. `/classic/[tournament]` and `/classic/[tournament]/teams/[team]` use raw `cuid`s, same as everywhere else in the app.
- **Auth tables are still `timestamp` without time zone.** Only the four Epic-2 tables get `@db.Timestamptz(3)` in this story's follow-up. A maintenance migration should convert `user` / `session` / `account` / `verification` too (low impact — audit fields, and Vercel runs UTC).
- **From-empty migration replay + constraint/cascade integration tests** — `migrate reset` is blocked, there is no CI, and `db-check.mts` only `count()`s empty tables. When Vitest lands (anticipated in Epic 3), a disposable-Neon-branch spec should round-trip `Tournament → TournamentEntry → Player` and assert `@unique`, the cascade/`Restrict` FKs, and the `@default(now())` timestamp behaviour. Overlaps the existing "no CI gate" / "no from-empty replay" items.

## Deferred from: code review of 1-8-public-shell-and-menu (2026-09-03)

- **Discipline-nav touch targets stay below the 44px floor.** After the review the mobile links are ~36px (`py-2 sm:py-1.5` on 13px text); EXPERIENCE.md UX-DR13 wants ≥44px on `< 640px`. This is the same cross-cutting deferral tracked since Story 1.5 — a per-component bump would clash with `Button` (h-8), `Avatar` (size-8), tab chips, etc. Owner: the design-system / a11y pass, or Story 2.2.
- **No formal `⋯` / `Sheet` collapse of the discipline nav on `< 640px`.** UX-DR3 / DESIGN.md say "пункти згортаються"; the three items now fit at 360px without a menu (the wordmark hides, spacing tightens), which satisfies AC 4's "лишається придатним до навігації". A real collapse (for when a fourth section or longer labels arrive) belongs with the design-system pass.
- **No OpenGraph / `metadataBase` / web manifest.** The shell wires only `title` + `description`. A public platform wants a canonical base URL, an OG image, and a manifest — a small SEO story once the real content pages exist.
- **`aria-current` ancestor semantics.** The nav sets `aria-current="page"` on exact match and `"true"` on an ancestor route, but there are no nested routes yet to exercise the `"true"` branch — verify it with the Epic 2 `/classic/[tournament]` pages.
- **No per-section `error.tsx` boundary.** `/classic` `/beach` `/archive` fetch nothing today. When Epic 2 adds data fetching, each section needs a Ukrainian error boundary (and the `EmptyState` grows its documented five cases in Story 2.2).

## Deferred from: code review of 1-7-admin-management (2026-09-03)

- **`promoteToAdmin` / `demoteFromAdmin` throw an unhandled Prisma `P2025`** if the target `user` row disappears between the `findUnique` read and the `update`. Harmless today (nothing deletes users), but when a delete-user path is added, wrap the write in `try/catch (P2025) → { outcome: "not_found" }`.
- **`countAdmins()` and `listAuthenticatedUsers()` count different populations.** `countAdmins` counts every `isAdmin` row; the list only shows users with an `account`. A seeded admin who never signed in is counted but not shown, so the self-revoke button can be enabled when it should be disabled. No such phantom exists now (the seed admin has logged in) and a phantom recovers by signing in. Reconcile if a second seeded/imported admin ever lands without an account.
- **The `/admin/people` user list is unbounded.** No `take`, no pagination, no search. The site is public; over years, viewers who signed in (they have no reason to, but nothing stops them) accumulate on the admin-management screen. Add a cap + filter when the list gets long.
- **No audit trail for role changes.** Grant = privilege escalation, revoke = a security action; neither is recorded. Add a small `AdminRoleChange` log (actor, target, action, timestamp) if the federation ever needs accountability.
- **`grantAdmin` / `revokeAdmin` check row existence, not "has an account".** Any valid `User.id` can be promoted via a direct Server-Action POST, not only the rows `listAuthenticatedUsers()` returns. Negligible (OAuth always creates an `account`; the only account-less row is the seed admin, already an admin), but the server does not enforce the "has signed in" scope the UI implies.
- **No automated end-to-end / action-layer coverage.** `LAST_ADMIN` and `NOT_FOUND` are verified only at the data-layer (script) and by a disabled button; the action-layer mapping, `revalidatePath` list refresh, and the dialog cancel path have no test. Add when a test runner + session-mock infra lands (Epic 3, per `AGENTS.md`).
- ~~**Buttons show only `disabled` while pending**~~ **Resolved in Story 2.2.** `GrantAdminButton` shows a spinner while pending; the revoke flow now runs through `ConfirmDialog`, whose confirm button spins while `onConfirm` is in flight.

## Deferred from: code review of 1-6-require-admin-access-control (2026-09-03)

- **`requireAdminPage()` sends a bare `from=/admin`.** A signed-in-but-anonymous-session user deep-linking to `/admin/tournaments/123` returns to `/admin` after sign-in, not the sub-path. The story deliberately scopes gating to the `/admin` layout and defers the `getSessionCookie` middleware pre-check; sub-path return-to belongs with that middleware.
- **`ActionResult<T = undefined>` forces `data: undefined` at call sites.** `{ ok: true; data: T }` always requires the key. Story 1.7's grant/revoke actions likely return no payload — decide then between `data?: T`, an overload, or a `void`-friendly variant.
- **Stale `/admin` via the client Router Cache after a mid-session role revoke.** No revoke action exists until Story 1.7, and Next 16 does not client-cache dynamic (`ƒ`) routes by default, so this is not reachable now. When Story 1.7 lands revoke, confirm a soft nav back to `/admin` re-runs the guard (or add `export const dynamic` / a middleware check).
- **DB outage during `getSessionUser()` renders a raw error on `/admin`.** `auth.api.getSession` throwing (Neon down) propagates out of the layout Server Component — fails closed (no access) but with no graceful UI. Error/empty-state patterns are Story 2.2; revisit `/admin/error.tsx` then.
- **The concrete gate contract is not in `EXPERIENCE.md`.** The redirect targets (`/sign-in?from=/admin`, `/?error=admin-required`) and the one-shot-toast-then-strip-param mechanic are recorded in `src/auth/README.md` and this story, but not the behavior source of truth. Fold into the next EXPERIENCE.md revision (Story 1.7 or 1.8).

## Deferred from: code review of 1-5-google-sign-in (2026-09-03)

- **`updatedAt` is `NOT NULL` with no DB default on `session` / `account` / `verification`** (and still `user`, from the 1.4 defer). Better Auth's Prisma adapter sets `updatedAt` on every write, so this is inert today — but a raw-SQL or non-Better-Auth insert would violate it. Fold `@default(now())` into the next auth-touching migration if such a write path ever appears.
- **Interactive targets below the EXPERIENCE 44×44px accessibility floor.** base-nova `Button` is `h-8` (32px), `Avatar` is `size-8` (32px), the header "Увійти" is inline text. EXPERIENCE.md says the a11y floor wins over DESIGN.md "shadcn as-is". This is a cross-cutting design-system decision (do we bump the shadcn `default` size, add a `lg` default, or a mobile media rule?) — belongs in Story 2.2 (reusable UX patterns) or a dedicated design-system pass, not a one-component fix in 1.5.
- **`session.cookieCache` not configured.** Every `authClient.useSession()` and every future server-side session check hits Postgres for the `session` row. Add Better Auth's short-TTL signed cookie cache (`session: { cookieCache: { enabled: true, maxAge: 300 } }`) when session reads become hot — Story 1.6 (`requireAdmin`) is the natural place.
- **No committed OAuth integration test / manual-verification script.** The story's gate is a manual Google round-trip, documented in the story but not runnable. Better Auth exposes `auth.api.*` server-side; a seeded-DB integration script (link a mocked Google identity, assert one `user` + one `account` row + `isAdmin` unchanged) fits the "operational gate" style once a test runner exists.
- **Preview-deploy auth is unhandled.** Google "Authorized redirect URIs" cannot wildcard `*.vercel.app`, and `BETTER_AUTH_URL` is a single value. OAuth on Vercel preview URLs will fail. `scripts/migrate-deploy.mjs` already skips migrations on previews; document that auth is production/local only, or add a `trustedOrigins` + per-deployment `BETTER_AUTH_URL` story if preview auth is ever needed.

## Deferred from: code review of 1-4-auth-schema-migrations-seed (2026-09-03)

- **`src/data/client.ts` — no importer, no durable runtime test.** The shared `PrismaClient` (`db`) is proven only by a since-deleted manual `tsx` script. Nothing in `src/` imports it yet. A `prisma generate` output-path change, a bad env var name, or an adapter option change would pass `pnpm lint` + `pnpm build` and only break when Story 1.5 first imports `db`. Needs a durable smoke (a `db:check` script running `db.user.count()`, or a Vitest integration test once the runner lands). Story 1.5 will at least exercise it in a route.
- **No from-empty migration replay.** AC 1 ("applies cleanly on an empty database") was proven only by the original `prisma migrate dev` (its shadow DB replays from zero, but retains no artifact and the step is unnoted). `prisma migrate reset` is blocked (Prisma AI-agent safety gate + the target being the single prod Neon DB). A later migration that only fails from scratch would reach prod unverified. Needs CI or a disposable Neon branch running `migrate deploy` from empty. Overlaps "No CI gate on push to `main`".
- **`User.updatedAt` is `NOT NULL` with no database default** (unlike `createdAt`'s `DEFAULT CURRENT_TIMESTAMP`). Prisma's client fills it via `@updatedAt`; a raw-SQL or non-Prisma insert would violate the constraint. Owner: Story 1.5's Better-Auth reconciliation migration — add `@default(now())` there, or confirm Better Auth's Prisma adapter always sets `updatedAt`.
- **Connection-string resolution duplicated.** `config({ path: [".env.local", ".env"] })` + `DIRECT_URL ?? DATABASE_URL_UNPOOLED ?? DATABASE_URL` live verbatim in both `prisma7.config.ts` and `prisma/seed.mts` (`src/data/client.ts` has a third, pooled-only variant). Extract a shared `prisma/` helper if a third consumer appears.

## Deferred from: code review of 1-3-domain-scaffold-boundaries (2026-09-03)

- **No regression test / CI gate for the import-boundary lint config.** The rules in `eslint.config.mjs` (Story 1.3) were verified once with throwaway probe files that were then deleted — not reproducible against `main`, and nothing fails if a future ESLint/`eslint-config-next` bump or an accidental config edit disables them. `main` auto-deploys via `next build`, which does not run these ESLint blocks. Needs either a committed negative-import fixture check (feasible once Vitest lands with the first `src/domain` module) or a CI job running `pnpm lint`. Overlaps the existing "No CI gate on push to `main`" item above — fold together when a CI story is picked up.
- **`import/no-restricted-paths` zone paths resolve against `process.cwd()`.** `from: "./src"` / `target: "./src/domain"` in the Story 1.3 ESLint blocks assume ESLint runs from the repo root. True for `pnpm lint`; some editor integrations set a different cwd, in which case the path zones silently match nothing. Revisit if a contributor reports the rules not firing in their IDE.

## Deferred from: code review of 1-2-design-tokens (2026-09-03)

- **DESIGN.md typography scale not tokenized.** Story 1.2 landed the font *family* only. The DESIGN.md `typography` group (`display` 32px/700/1.08/−0.6px, `display-sm` 24px/700/1.12/−0.3px, `body` 14px, `label` 13px/500, `caption` 11px/500/+0.2px) has no `--text-*` tokens or utilities. Without them every heading/caption will hardcode size/weight/tracking. Owner: Story 1.8 (first `display` headings — "Розклад", "Архів", empty-state greetings).
- **Per-component radius intent needs per-component overrides.** DESIGN.md Shapes assigns 7px to inputs and tab-chips, 10px to cards/buttons, 14px to dialogs/empty-states. shadcn maps its own `rounded-sm/md/lg` differently (e.g. `Input` uses `rounded-md`). Remapping the three radius tokens alone (done in 1.2) can't deliver this — components that need a non-default corner must set it explicitly. Owner: Story 2.2 (reusable UX patterns) and each component story.
- **Primary Button hover lightens instead of darkening.** `hover:bg-primary/80` (base-nova default) over `#1F6FEB` on white produces a visibly lighter hover and pushes the white label toward ~3:1 contrast. Define a proper darker-blue hover step. Owner: Story 2.2.
- **Small blue text contrast.** `#1F6FEB` on white ≈ 4.6:1 — OK for the button fill and large text, borderline for the future `link` variant and the 11px `caption`-size blue "position 1–4" numerals in the standings table. May need a darker blue for text-sized use or a minimum size. Owner: Story 3.8 (public standings table).
