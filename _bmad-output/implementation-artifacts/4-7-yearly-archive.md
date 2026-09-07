---
baseline_commit: 327854a
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/implementation-artifacts/4-4-playoff-results-final-placements.md
  - _bmad-output/implementation-artifacts/4-5-finish-tournament.md
  - _bmad-output/implementation-artifacts/4-6-public-bracket.md
  - _bmad-output/implementation-artifacts/3-8-public-standings-table.md
  - _bmad-output/implementation-artifacts/2-9-public-tournament-page-teams-tab.md
  - _bmad-output/implementation-artifacts/1-8-public-shell-and-menu.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - AGENTS.md
---

# Story 4.7: Річний архів

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a глядач,
I want переглядати завершені турніри за роками — з фінальними місцями, таблицями й сіткою,
so that я бачу історичний запис змагань (FR-23).

## Acceptance Criteria

Translated from `epics.md` → Epic 4 → Story 4.7 (the last story of Epic 4). The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** є хоча б один турнір у стані `COMPLETED`
**When** глядач відкриває `/archive` без входу
**Then** турніри згруповані за роком (роки — від новіших до старіших)
**And** для кожного турніру показано: **Тип турніру**, **рік**, **назву** та **фінальні місця 1–4**
**And** якщо завершених турнірів немає — порожній стан (`ARCHIVE_EMPTY`)

**Given** архівний (`COMPLETED`) турнір
**When** глядач відкриває `/archive/[year]/[tournament]` без входу
**Then** сторінка **лише для читання** показує назву, `StatusBadge`, і **всі** дані турніру: заявлені команди, турнірну **Таблицю**, **Розклад** і **Сітку плейофа** з фінальними місцями
**And** місця 5+ (команди поза плейофом) видно за їхнім фінальним порядком у Таблиці групи
**And** невідповідний `[year]` (не рік цього турніру) або не-`COMPLETED` турнір → 404

**Given** турнір перейшов у `COMPLETED`
**When** глядач відкриває `/classic`
**Then** цей турнір **більше не показується** у списку активних (він тепер в архіві) — EXPERIENCE KF-1 §8

### FR / AD / SPEC anchors (in context)

- **FR-23** (`prd.md` §4.9): «Глядач може переглянути Архів — перелік Завершених турнірів за роками. **Наслідки (перевірювані):** — Для кожного Турніру показано: Тип турніру, рік, назву та фінальні місця 1–4. — `[ПРИПУЩЕННЯ]` Для команд поза плейофом показується їхнє фінальне місце в Таблиці групи (бажано, не обов'язково для v1). — Архівний Турнір відкривається в режимі лише читання з усіма Таблицями та Сіткою.»
- **FR-25** (`prd.md` §4.10): «Уся інформація Турніру в Стані Груповий етап і далі доступна без входу.» — a `COMPLETED` tournament's full record is public.
- **SPEC CAP-10**: «Для кожного завершеного турніру архів показує тип, рік, назву та місця 1–4; архівний турнір відкривається лише для читання з усіма таблицями й сіткою; доступний без входу.»
- **AD-4 / AD-5** (`ARCHITECTURE-SPINE.md`): турнірна таблиця й фінальні місця **не зберігаються** — обчислюються при кожному читанні. `getStandings` / `getPlayoffBracket` (`src/data`) already do this; the archive is a **read surface** over them, nothing new is stored.
- **AD-7** (`ARCHITECTURE-SPINE.md`): публічне читання йде повз `requireAdmin()`. All the archive reads are role-blind `src/data` functions.
- **AD-9**: `discipline = CLASSIC` only — every archive query filters it.
- **EXPERIENCE.md** §Information Architecture: `/archive` = «Архів за роками», `/archive/[year]/[tournament]` = «Архівний турнір — лише читання». §Key Flows KF-1 §8: «Турнір зникає зі списку активних і зʼявляється в `/archive/2026` з місцями 1–4.» §Empty state cases: «рік архіву без турнірів» (`ARCHIVE_YEAR_EMPTY` — but see Notes: there is no per-year page, so this stays copy-only). §Voice and Tone: спокійні порожні стани.
- **DESIGN.md**: reuse the existing brand-layer components (`Standings table`, `Bracket pair`, `Status badge`, `Empty state`); `tabular-nums` on every numeric cell; content max-width 1120px.
- **UX-DR9**: `EmptyState` component for the "no archived tournaments" case.
- **UX-DR15**: routes `/archive`, `/archive/[year]/[tournament]` per EXPERIENCE.

### Notes on AC interpretation

- **Almost every rendering piece already exists.** `getStandings` / `getPlayoffBracket` / `listGroupMatchesForTournament` / `listEntriesForTournament` (all `src/data`, role-blind, working for `COMPLETED`); `StandingsTable`, `Bracket` (Story 4.6), `PlayoffPlacements` (Story 4.4), `PublicSchedule`, `StatusBadge`, `EmptyState`; `placementNames(view)` (Story 4.6 review), `PLAYOFF_QUALIFIERS`. `empty-states.ts` already has `ARCHIVE_EMPTY` and `ARCHIVE_YEAR_EMPTY`. The top nav «Архів» (`src/lib/sections.ts` + `DisciplineNav`) already links `/archive` and its `isActiveSection` matches `/archive/**`. **Story 4.7 = two new pages + a few `src/data` reads + a filter change on `/classic`.**

- **The archive detail page is a single scrollable read-only page, NOT tabbed.** `epics.md` / EXPERIENCE list `/archive/[year]/[tournament]` as «Архівний турнір — лише читання» with **no** `?tab=` in the IA (unlike `/classic/[tournament]?tab=…`). FR-23 says «з **усіма** Таблицями та Сіткою» — everything visible at once fits the archive mental model (you review the whole record, you don't monitor one aspect). So: stacked `<section>`s — **Команди** · **Таблиця** · **Розклад** · **Плейоф** — each with an `<h2>` heading, each rendering the existing read-only component. **Decision:** this closes the deferred item "parameterise `TournamentTabs` off the `/classic` route tree — Story 4.7" as **not needed** (the archive detail is not tabbed). Update `deferred-work.md`.

- **`/archive` — the list page (`src/app/archive/page.tsx`, replace the Story 1.8 placeholder).**
  - New `src/data/tournaments.ts` read: `listArchivedTournaments()` — `where: { state: "COMPLETED", discipline: "CLASSIC" }`, `orderBy: [{ year: "desc" }, { name: "asc" }]`, `select: { id, name, type, year }`.
  - Group the rows by `year` in the page (a `Map<number, rows[]>` or `Object.groupBy` — Node 24 has it; if lint/TS target balks, a manual reduce). Render each year as a block: `<h2>{year}</h2>` then a list.
  - **Final places 1–4 per tournament:** for each tournament fetch `getPlayoffBracket(t.id)` (via `Promise.all`) and take `placementNames(bracket.placements)`. A `COMPLETED` tournament always has the final **and** the third-place match played (Story 4.5 gates `PLAYOFF → COMPLETED` on `finalAndThirdPlacePlayed`), so all four names resolve. Show them compactly, e.g. «1. {t1} · 2. {t2} · 3. {t3} · 4. {t4}» (`tabular-nums` on the ordinals is fine; the ordinal is the cue, per DESIGN — not colour). If for any reason a place is `null`, render «—» for it (defensive).
  - **N+1 note:** `Promise.all(rows.map(r => getPlayoffBracket(r.id)))` is one `getPlayoffBracket` (≈2 indexed reads + `advanceBracket`) per archived tournament. At v1 scale (a federation runs a handful of tournaments per year — NFR-5: "десятки команд, сотні матчів на турнір", not hundreds of tournaments) this is fine. If the archive ever grows large, a batched read (`match.findMany({ where: { tournamentId: { in: ids }, stage: { in: PLAYOFF_STAGES } } })` → group → `playoffPlacements` per group) replaces the loop. **Do the simple loop; note the batched path in `deferred-work.md`.**
  - Each row links to `/archive/${year}/${t.id}`. Show `TOURNAMENT_TYPE_LABELS[t.type]` (`src/lib/tournament-labels.ts`).
  - Empty (`listArchivedTournaments()` → `[]`) → `<EmptyState {...ARCHIVE_EMPTY} />` (`src/lib/empty-states.ts`).
  - Header via the existing `<SectionShell title={ARCHIVE.label}>` (the `/classic`, `/beach` pattern) or a plain `<main>` — match `src/app/classic/page.tsx`.

- **`/archive/[year]/[tournament]/page.tsx` — the detail page (NEW route, two dynamic segments).**
  - New `src/data/tournaments.ts` read: `getArchivedTournament(id)` — `db.tournament.findFirst({ where: { id, state: "COMPLETED", discipline: "CLASSIC" } })`. The sibling of `getPublicTournament` for the archive.
  - `notFound()` when it returns `null` **or** when `tournament.year !== Number(year)` (keeps the URL canonical — a `/archive/2025/<2026-tournament>` link 404s).
  - Fetch in parallel: `getStandings(id)`, `listEntriesForTournament(id)`, `listGroupMatchesForTournament(id)`, `getPlayoffBracket(id)`.
  - Render, stacked (no tabs), reusing the components — see "the shared view-model helpers" below:
    - Header: back-link to `/archive`, `<h1>{name}</h1>` + `<StatusBadge state="COMPLETED" />`.
    - **Команди**: `<h2>` + a `<ul>` of team names, each a link to `/classic/${id}/teams/${teamId}` (the existing public roster route — it uses `resolveTournament`, which returns `COMPLETED` tournaments, so it already works; a dedicated `/archive/.../teams/[team]` route is **not** built — accepted URL wrinkle, note it). Empty → `<EmptyState {...NO_TEAMS} />`.
    - **Таблиця**: `<h2>` + `<StandingsTable rows={…} hasResults={…} tournamentName={name} />` — places 5+ are simply the rows below position 4, which is exactly "їхнє фінальне місце в Таблиці групи" (FR-23 §5 — no extra work).
    - **Розклад**: `<h2>` + `<PublicSchedule matches={…} />` (group matches only, as on `/classic`).
    - **Плейоф**: `<h2>` + `<Bracket pairs={…} />` + `<PlayoffPlacements teamNames={…} />` (always shown — a `COMPLETED` tournament always has all four placements).

- **The shared view-model helpers — extract, don't duplicate.** `/classic/[tournament]/page.tsx` already maps `getStandings()` → `StandingsTable` rows (adds `position`, `qualifies`) and `listGroupMatchesForTournament()` → `PublicSchedule` rows (formats the date, computes the score label). The archive detail page needs the identical maps. Extract them into `src/data/matches.ts` (the `data → domain` value-call edge is already established there — `getStandings` itself calls `computeStandings` / `orderStandings`; adding `formatKyivDateTime` / `matchScoreLabel` calls is the same edge):
  - `standingsTableRows(standings: StandingsView[])` → the flat `{ entryId, position, teamName, played, wins, losses, points, setsWon, setsLost, qualifies, needsManualSeed }[]` shape `StandingsTable` takes. `qualifies = index < PLAYOFF_QUALIFIERS && standings.length > PLAYOFF_QUALIFIERS` (verbatim from the classic page). `PLAYOFF_QUALIFIERS` from `@/domain/tiebreak`.
  - `publicScheduleRows(matches: <listGroupMatchesForTournament return>)` → the `{ id, homeTeam, awayTeam, scheduledAtDisplay, venueText, resultSummary }[]` shape `PublicSchedule` takes (`formatKyivDateTime` / `matchScoreLabel` from `@/domain`).
  - **`bracketPairs` needs NO helper:** `PlayoffBracketPairView` is structurally a superset of `BracketPairVM` (same `slot` / `status` / `homeTeam` / `awayTeam` / `score`, plus extras), so `const bracketPairs: BracketPairVM[] = [bracket.semifinals[0], bracket.semifinals[1], bracket.final, bracket.thirdPlace]` type-checks directly. **Remove the now-redundant `toBracketPair` mapper from `/classic/[tournament]/page.tsx`** and use the direct array in both pages.
  - **`placementNames`** already exists (`src/data/playoff.ts`, Story 4.6) — use it in both the list and detail pages.
  - Refactor `/classic/[tournament]/page.tsx` to consume `standingsTableRows` / `publicScheduleRows` (behaviour unchanged — same output, just moved). This is a **for-reuse refactor**, not a feature change; keep its tab logic, `resolveTournament`, `CompletedBanner`, `showPlayoff`, everything else exactly as-is.

- **`/classic` list — exclude `COMPLETED` (EXPERIENCE KF-1 §8).** Change `listPublicTournaments()` (`src/data/tournaments.ts`): `where: { state: { not: "DRAFT" }, … }` → `where: { state: { in: ["GROUP_STAGE", "PLAYOFF"] }, … }`. A completed tournament now appears **only** in `/archive`.
  - **Do NOT change `getPublicTournament(id)`** — leave it `state: { not: "DRAFT" }`. A shared link to `/classic/<completed-tournament>` must still resolve (it renders with the Story 4.5 «Турнір завершено» `CompletedBanner`); the intentional asymmetry is: the *list* moves on, a *direct link* still works. Optionally add a one-line «Переглянути в архіві» link on `/classic/[tournament]` when `state === "COMPLETED"` (pointing at `/archive/${year}/${id}`) — nice, not required.
  - **`src/app/classic/page.tsx`** already renders `listPublicTournaments()`; it also should gain a «Переглянути архів» link → `/archive` (Story 2.9's own AC: «список активних турнірів + посилання в архів»).
  - **Check `scripts/verify-public-tournament.mts`** — if it asserts a `COMPLETED` tournament in `listPublicTournaments()`, update that assertion (a `COMPLETED` tournament is now excluded; `getPublicTournament` still returns it).

- **No `/archive/[year]` index page.** EXPERIENCE's IA has no such route; `/archive` links straight to `/archive/[year]/[tournament]`. Hitting `/archive/2026` renders Next's `not-found` — acceptable (it is not a linked path). A one-line `src/app/archive/[year]/page.tsx` that `redirect("/archive")` is optional polish. `ARCHIVE_YEAR_EMPTY` copy stays in `empty-states.ts` unused-for-now (it was authored for a per-year view that v1's IA doesn't have) — do not delete it, note it.

- **`/beach` is untouched.** `discipline = CLASSIC` everywhere; `/beach` stays the Story 1.8 «Незабаром» placeholder.

- **No migration, no new `src/domain` module, no `src/actions`, no `Tournament.state` change, no auth.** New: two page routes, three-ish `src/data` reads (`listArchivedTournaments`, `getArchivedTournament`, `standingsTableRows`, `publicScheduleRows`), one `listPublicTournaments` filter change. This is the largest of the Epic 4 "read surface" stories but still adds zero write paths.

## Tasks / Subtasks

- [x] **Task 1 — `src/data/tournaments.ts` (UPDATE): archive reads + `/classic` list filter** (AC: 1, 2, 4)
  - [x] `listArchivedTournaments()` — `{ state: "COMPLETED", discipline: "CLASSIC" }`, `orderBy [{ year: "desc" }, { name: "asc" }]`, `select { id, name, type, year }`.
  - [x] `getArchivedTournament(id)` — `findFirst({ where: { id, state: "COMPLETED", discipline: "CLASSIC" } })`. Docstring: the archive sibling of `getPublicTournament`.
  - [x] `listPublicTournaments()` — filter `state: { in: ["GROUP_STAGE", "PLAYOFF"] }` (was `{ not: "DRAFT" }`). Docstring updated: `COMPLETED` tournaments live in `/archive` now; `getPublicTournament` still returns them for a direct link.
  - [x] `getPublicTournament` unchanged.
  - [x] `typecheck` / `lint` clean.

- [x] **Task 2 — `src/data/matches.ts` (UPDATE): shared view-model helpers** (AC: 2)
  - [x] `standingsTableRows(standings)` — flatten `StandingsView[]` → the `StandingsTable` row shape (adds `position` = index+1, `qualifies`). Uses `PLAYOFF_QUALIFIERS` (`@/domain/tiebreak`).
  - [x] `publicScheduleRows(matches)` — `listGroupMatchesForTournament` rows → the `PublicSchedule` row shape (`formatKyivDateTime` / `matchScoreLabel` from `@/domain`).
  - [x] Both are pure projections (no new query). `typecheck` / `lint` clean (the `data → domain` value-call edge already exists here via `getStandings`).

- [x] **Task 3 — `/classic/[tournament]/page.tsx` (UPDATE): consume the shared helpers** (AC: 4 regression)
  - [x] Replace the inline `standingsRows` map with `standingsTableRows(standings)`; the inline `matches` map with `publicScheduleRows(await listGroupMatchesForTournament(id))`.
  - [x] Remove the module-scope `toBracketPair`; `const bracketPairs: BracketPairVM[] = bracket ? [bracket.semifinals[0], bracket.semifinals[1], bracket.final, bracket.thirdPlace] : []`.
  - [x] **No behaviour change** — everything else (tabs, `resolveTournament`, `CompletedBanner`, `showPlayoff`, default tab, per-tab conditional fetch) stays exactly as-is.
  - [x] `pnpm build` → `typecheck` clean; open the page in each tab state mentally / via the residual manual pass.

- [x] **Task 4 — `src/app/archive/page.tsx` (REPLACE the placeholder): the year-grouped list** (AC: 1)
  - [x] `listArchivedTournaments()` → group by `year` (desc). For each tournament `getPlayoffBracket(t.id)` via `Promise.all` → `placementNames(bracket.placements)`.
  - [x] Render: per year an `<h2>{year}</h2>`, then a list — each item: name (link → `/archive/${year}/${t.id}`), `TOURNAMENT_TYPE_LABELS[t.type]`, and «1. … · 2. … · 3. … · 4. …» (a `null` place → «—»).
  - [x] `[]` → `<EmptyState {...ARCHIVE_EMPTY} />`. Header: `<SectionShell title={ARCHIVE.label}>` (match `src/app/classic/page.tsx`). `metadata.title = ARCHIVE.label`.
  - [x] `typecheck` / `lint` clean.

- [x] **Task 5 — `src/app/archive/[year]/[tournament]/page.tsx` (NEW): the read-only detail** (AC: 2, 3)
  - [x] `getArchivedTournament(id)` → `notFound()` if `null` or `tournament.year !== Number(year)`.
  - [x] Parallel fetch: `getStandings(id)`, `listEntriesForTournament(id)`, `listGroupMatchesForTournament(id)`, `getPlayoffBracket(id)`.
  - [x] Stacked read-only sections (each `<section>` + `<h2>`): **Команди** (`<ul>` of team-name links → `/classic/${id}/teams/${teamId}`; empty → `<EmptyState {...NO_TEAMS} />`), **Таблиця** (`<StandingsTable rows={standingsTableRows(standings)} hasResults={standings.some(e => e.row.played > 0)} tournamentName={tournament.name} />`), **Розклад** (`<PublicSchedule matches={publicScheduleRows(matchRows)} />`), **Плейоф** (`<Bracket pairs={[semifinals[0], semifinals[1], final, thirdPlace]} />` + `<PlayoffPlacements teamNames={placementNames(bracket.placements)} />`).
  - [x] Header: back-link → `/archive`, `<h1>{name}</h1>` + `<StatusBadge state={tournament.state} />`. `max-w-[1120px]` main (the `/classic/[tournament]` width).
  - [x] `generateMetadata` → `{ title: tournament?.name ?? "Архів" }` (via `getArchivedTournament`).
  - [x] `pnpm build` (NEW nested dynamic route — `.next/types` regen; run `build` before `typecheck`) → `typecheck` clean.

- [x] **Task 6 — `src/app/classic/page.tsx` (UPDATE): «Переглянути архів» link** (AC: 4)
  - [x] Add a `<Link href="/archive">Переглянути архів</Link>` (Story 2.9 AC: «список активних турнірів + посилання в архів») — above or below the list, styled as the other muted links.
  - [x] The list now shows only `GROUP_STAGE`/`PLAYOFF` tournaments (from the Task 1 filter). No page-code change needed for that beyond the link.

- [x] **Task 7 — `scripts/verify-archive.mts` (NEW) + `scripts/verify-public-tournament.mts` (UPDATE if needed)** (AC: 1, 2, 4)
  - [x] `verify-archive.mts` — lean setup (no full playoff needed for the list reads): create a `CLASSIC` tournament, `setTournamentState(id, "COMPLETED")` directly; create a second tournament left `DRAFT`/`GROUP_STAGE`. Assert: `listArchivedTournaments()` includes the completed one with the right `year`, ordered year-desc; **excludes** the non-completed one; `getArchivedTournament(completedId)` returns it; `getArchivedTournament(otherId)` → `null`; `listPublicTournaments()` **excludes** the completed one and **includes** a `GROUP_STAGE` one. Self-cleaning (delete both tournaments + teams).
  - [x] `verify-public-tournament.mts` — if it asserts a `COMPLETED` tournament in `listPublicTournaments()`, flip that to "excluded"; `getPublicTournament` still returns it. Re-run it green.
  - [x] Header comments describe the scenario.

- [x] **Task 8 — Docs** — `src/data/README.md` (`listArchivedTournaments` / `getArchivedTournament`; `listPublicTournaments` filter note; `standingsTableRows` / `publicScheduleRows`), `AGENTS.md` (Story 4.7 Stack bullet + `verify-archive.mts` in the catalogue; note `/classic` list now excludes `COMPLETED`), `_bmad-output/implementation-artifacts/deferred-work.md` (Story 4.7 section: `TournamentTabs` parameterisation resolved not-needed — archive detail is single-page; `/archive/[year]/[tournament]/teams/[team]` reuses `/classic/...` — accepted URL wrinkle; N+1 `getPlayoffBracket` on `/archive` — batched follow-up if it grows; `ARCHIVE_YEAR_EMPTY` copy unused; no component test for the two new pages). `src/components/README.md` only if a component gains a prop (it should not).

- [x] **Task 9 — Verification gate** (AC: all)
  - [x] `pnpm build` ✓ · `pnpm typecheck` ✓ · `pnpm lint` ✓ · `pnpm test` (unchanged count — no domain change; state it) ✓.
  - [x] `prisma migrate status` up to date; `migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` → "empty migration" (confirm — no schema change).
  - [x] `pnpm exec tsx scripts/verify-archive.mts` green; all verify scripts green (esp. `verify-public-tournament.mts`, `verify-finish-tournament.mts`).
  - [x] Import-boundary: the two new pages import `@/data` + `@/components` (Server Component read edge); `src/data/matches.ts` value-calls `@/domain` (the established edge); no `@/data` import in any `src/components` file.
  - [x] Command output in the Dev Agent Record.
  - _Residual: no automated component/page test for `/archive` and `/archive/[year]/[tournament]` (standing "no component toolchain" gap). Recommended manual pass with code review: finish a tournament (Story 4.5) → open `/archive` as an anonymous visitor: the tournament appears under its year with places 1–4; `/classic` no longer lists it; click through to `/archive/[year]/[tournament]` → all four sections render read-only; a mismatched year in the URL 404s._

- [x] **Task 10 — Commit(s)** — one commit + `git push origin main` per task group (data reads + `/classic` filter; shared helpers + classic refactor; archive list page; archive detail page; verify + docs). Per the standing "commit after each task" instruction.

## Dev Notes

### What this story is / is NOT

**Is:** the public yearly archive — the last Epic 4 story. A `/archive` list (COMPLETED tournaments grouped by year, each with type / year / name / places 1–4) and a `/archive/[year]/[tournament]` single-page read-only record (Команди · Таблиця · Розклад · Плейоф), both reusing the components already built (`StandingsTable`, `Bracket`, `PlayoffPlacements`, `PublicSchedule`, `StatusBadge`, `EmptyState`) and the role-blind `src/data` reads (`getStandings`, `getPlayoffBracket`, `listGroupMatchesForTournament`, `listEntriesForTournament`). Plus: `/classic` stops listing `COMPLETED` tournaments (EXPERIENCE KF-1), and two page-level view-model maps move to `src/data/matches.ts` so the classic and archive pages share them.

**Is NOT** (do not pull forward):
- **A tabbed archive detail page / parameterising `TournamentTabs`.** The archive detail is one scrollable page (EXPERIENCE IA has no `?tab=` for it; FR-23 says «з усіма»). The `TournamentTabs`-parameterisation deferred item is resolved **not-needed**.
- **A dedicated `/archive/[year]/[tournament]/teams/[team]` route.** The archive «Команди» links reuse `/classic/[tournament]/teams/[team]` (it already resolves `COMPLETED` tournaments). Accepted URL wrinkle.
- **A `/archive/[year]` index page.** Not in the IA; `/archive` links straight to the tournament. `ARCHIVE_YEAR_EMPTY` copy stays unused (don't delete).
- **A migration / a new `src/domain` module / a `src/actions` function / a `Tournament.state` change / any write path.** Read surface only.
- **Changing `getPublicTournament(id)`** — only `listPublicTournaments()` (the list) drops `COMPLETED`; a direct `/classic/<completed>` link still resolves (with the Story 4.5 banner).
- **A batched `getPlayoffBracket`.** The `/archive` list uses a simple `Promise.all` loop; a batched read is a documented follow-up for when the archive is large.
- **Widening `getPlayoffBracket` / `getStandings` / any component prop.** They already return / accept everything needed.
- **`needsManualSeed` surfacing.** `StandingsTable` already shows its `*` marker + legend (Story 3.8); the archive reuses it verbatim.
- **BEACH.** `discipline = CLASSIC` only; `/beach` untouched.

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/data/tournaments.ts` | UPDATE | `listArchivedTournaments()`, `getArchivedTournament(id)`; `listPublicTournaments()` filter → `state IN (GROUP_STAGE, PLAYOFF)`. |
| `src/data/matches.ts` | UPDATE | `standingsTableRows(standings)`, `publicScheduleRows(matches)` — shared view-model projections. |
| `src/app/classic/[tournament]/page.tsx` | UPDATE | Consume the two helpers; drop `toBracketPair` (direct `BracketPairVM[]` assignment). No behaviour change. |
| `src/app/classic/page.tsx` | UPDATE | «Переглянути архів» link; list now excludes `COMPLETED` via the data filter. |
| `src/app/archive/page.tsx` | REPLACE | Year-grouped list of `COMPLETED` tournaments with places 1–4. |
| `src/app/archive/[year]/[tournament]/page.tsx` | NEW | Single-page read-only archived tournament (4 stacked sections). |
| `scripts/verify-archive.mts` | NEW | `listArchivedTournaments` / `getArchivedTournament` / `listPublicTournaments` filter. |
| `scripts/verify-public-tournament.mts` | UPDATE (if needed) | `COMPLETED` now excluded from `listPublicTournaments`. |
| `src/data/README.md` · `AGENTS.md` · `_bmad-output/implementation-artifacts/deferred-work.md` | UPDATE | New reads, the `/classic` filter change, resolved / new deferred items. |
| `src/components/{standings-table,bracket,playoff-placements,public-schedule,status-badge,empty-state}.tsx` | DO NOT MODIFY | Reused verbatim. |
| `src/data/playoff.ts` `getPlayoffBracket` / `placementNames` / `getStandings` | DO NOT MODIFY | Used as-is. |
| `src/components/tournament-tabs.tsx` | DO NOT MODIFY | Archive detail is not tabbed. |
| `src/app/classic/_lib/resolve-tournament.ts` | DO NOT MODIFY | The archive has its own resolver (`getArchivedTournament`). |
| `prisma/**` | DO NOT TOUCH | No schema change. |

### Architecture compliance

- **AD-4 / AD-5** — the archive renders `getStandings` / `getPlayoffBracket` (both re-derive on read via `computeStandings` / `orderStandings` / `advanceBracket` / `playoffPlacements`); nothing about "archived" is stored. [ARCHITECTURE-SPINE.md#AD-4, #AD-5]
- **AD-7** — all archive reads are role-blind `src/data` functions filtering `state = COMPLETED` (a subset of `state != DRAFT`) and `discipline = CLASSIC`. No `requireAdmin`, no session. [ARCHITECTURE-SPINE.md#AD-7]
- **AD-2 / AD-3** — the pages read `@/data` (the sanctioned `view → data` edge, same as `/classic/[tournament]`); `standingsTableRows` / `publicScheduleRows` make `data → domain` value calls (`getStandings` already does — same file, same edge); no `@/data` import from any component. [ARCHITECTURE-SPINE.md#AD-2, #AD-3, §Design Paradigm]
- **AD-9** — `CLASSIC` filter on every archive query. [ARCHITECTURE-SPINE.md#AD-9]
- **NFR-3** — the archived table / bracket cannot desync: pure re-derivation on read. A `COMPLETED` tournament's results are frozen (Story 4.5), so the read is stable. [PRD NFR-3]
- **NFR-5 / NFR-6** — `< 2s` on mobile: the list's `Promise.all` of `getPlayoffBracket` is bounded by the (small) number of archived tournaments; each page is a single Server Component render, `max-w-[1120px]`, mobile-first, tables scroll in their own container (`StandingsTable` already). [PRD NFR-5, NFR-6; EXPERIENCE §Responsive]

### Existing code being modified — current state → change → what must be preserved

**`src/data/tournaments.ts`** (Stories 2.1 / 2.4 / 2.5 / 2.9)
- *Current:* `getTournamentForAdmin` (drafts, no discipline filter), `setTournamentState`, `createTournamentRecord`, `getPublicTournament(id)` (`state != DRAFT` + `CLASSIC`), `listPublicTournaments()` (same filter, list), `updateTournamentRecord`, `deleteTournamentRecord`, `listTournamentsForAdmin`.
- *Change:* add `listArchivedTournaments()` + `getArchivedTournament(id)`; narrow `listPublicTournaments()` to `state IN (GROUP_STAGE, PLAYOFF)`.
- *Must preserve:* `getPublicTournament` verbatim (a direct link to a completed tournament still resolves); every other function; the `select` shape `listPublicTournaments` returns (`{ id, name, type, year, state }`) unless the page no longer needs `state` (it may drop it — check `src/app/classic/page.tsx`; it uses `StatusBadge state={tournament.state}` so keep `state`).

**`src/data/matches.ts`** (Stories 3.2–3.8 + 4.2 + 4.5)
- *Current:* `getStandings` (→ `StandingsView[]`), `listGroupMatchesForTournament`, `updateMatchSchedule`, `hasAnyGroupResult`, `allGroupMatchesPlayed`, `finalAndThirdPlacePlayed`, `getMatchForResult`, `createMatchResult` / `replaceMatchResult` / `deleteMatchResult`. Already value-calls `@/domain` (`computeStandings` / `orderStandings`).
- *Change:* add `standingsTableRows(standings)` + `publicScheduleRows(matches)` — pure projections.
- *Must preserve:* every existing function; do not change `getStandings`'s return type (the helper takes its output).

**`src/app/classic/[tournament]/page.tsx`** (Stories 2.9 / 3.5 / 3.8 / 4.5 / 4.6)
- *Current:* `resolveTournament` → `notFound()`; `StatusBadge`; `CompletedBanner` when `COMPLETED`; `TournamentTabs` (`showPlayoff`); `defaultTab`; per-tab conditional fetch + inline VM maps (`standingsRows`, `matches`); `bracketPairs` via module-scope `toBracketPair`; `placementNames`; the 4-tab body switch.
- *Change:* `standingsRows` → `standingsTableRows(standings)`; `matches` map → `publicScheduleRows(...)`; drop `toBracketPair`, use the direct `BracketPairVM[]` array.
- *Must preserve:* **all** tab routing / `showPlayoff` / `defaultTab` / `resolveTournament` / `CompletedBanner` / `generateMetadata` — this is a mechanical de-dup, output identical.

**`src/app/archive/page.tsx`** (Story 1.8)
- *Current:* a static `<SectionShell title={ARCHIVE.label}><EmptyState {...ARCHIVE_EMPTY} /></SectionShell>` placeholder (`export default function ArchivePage()` — sync).
- *Change:* becomes `async`; reads `listArchivedTournaments()` + `Promise.all(getPlayoffBracket)`; renders the year-grouped list or the empty state.
- *Must preserve:* the `metadata` export, the `SectionShell` wrapper + title, the `ARCHIVE_EMPTY` empty state for the zero case.

**`src/app/classic/page.tsx`** (Stories 1.8 / 2.9)
- *Current:* `listPublicTournaments()` → `<ul>` of tournament links + `<StatusBadge>`; `<EmptyState {...NO_TOURNAMENTS} />` when empty.
- *Change:* add a `/archive` link; the list is implicitly `COMPLETED`-free via the data filter.
- *Must preserve:* the empty state, the `StatusBadge`, the `SectionShell` + title, `TOURNAMENT_TYPE_LABELS`.

### Testing requirements

- **No new Vitest** — no `src/domain` change. State the unchanged count (169) in the Dev Agent Record.
- **`scripts/verify-archive.mts`** (NEW) is the integration gate for the archive reads + the `/classic` filter change. Lean setup (a `COMPLETED` tournament via direct `setTournamentState`, plus a non-completed one) — the full-playoff data reads (`getStandings` / `getPlayoffBracket` shapes) are already covered by `verify-group-stage-schema.mts` / `verify-advance-bracket.mts`.
- **`scripts/verify-public-tournament.mts`** — re-run after the `listPublicTournaments` filter change; fix any assertion that expects `COMPLETED` in the list.
- **No component / page test** for `/archive` and `/archive/[year]/[tournament]` — the standing "no component toolchain" gap (same as every prior public page). The data is covered by the verify scripts; the markup by the documented manual pass.
- **No migration** — `prisma migrate status` + `migrate diff … --script` still "empty migration" (confirm; no schema change).
- **Regression:** `pnpm build` (new route + changed pages) + re-run all `verify-*.mts`.

### Project Structure Notes

- The archive detail page is **single-page, not tabbed** — a deliberate divergence from `/classic/[tournament]` (see Notes). This means `src/components/tournament-tabs.tsx` gains no consumer here and stays `/classic`-shaped; the deferred "parameterise it for the archive" item is closed as not-needed.
- The view-model maps go to `src/data/matches.ts` (not a new `src/lib` view module, not into a shared component) because the component-layer import boundary forbids `src/components → @/data`, so a helper that takes `getStandings()`'s `@/data` return type must live in `@/data`. `getStandings` already value-calls `@/domain`, so `standingsTableRows` / `publicScheduleRows` doing the same (`formatKyivDateTime`, `matchScoreLabel`, `PLAYOFF_QUALIFIERS`) is the same established edge.
- `getArchivedTournament` is a separate function (not a param on `getPublicTournament`) — matches the `getPublicTournament` / `getTournamentForAdmin` / `listTournamentsForAdmin` pattern of one named read per visibility concern (AD-11).
- The archive list's places 1–4 reuse `placementNames(bracket.placements)` (Story 4.6 review helper) — no new placement projection.
- `standingsTableRows` deliberately keeps the exact `qualifies` rule from `/classic/[tournament]/page.tsx` (`index < PLAYOFF_QUALIFIERS && length > PLAYOFF_QUALIFIERS`) — for a `COMPLETED` tournament the top 4 did advance, so the marker is correct history.

### Previous story intelligence

- **Story 4.6 (done, code-reviewed)** — `Bracket` component (`BracketPairVM` carries `slot` / `status` / `homeTeam` / `awayTeam` / `score`; `PlayoffBracketPairView` is structurally a superset — direct assignment works, no mapper); `src/lib/playoff-labels.ts` (`PLAYOFF_SLOT_LABELS`); `placementNames(view)` in `src/data/playoff.ts`; the `?tab=playoff` branch of `/classic/[tournament]/page.tsx` renders `<Bracket>` + `<PlayoffPlacements>`. **The archive reuses all of this.** `pnpm test` 169.
- **Story 4.5 (done, code-reviewed)** — `PLAYOFF → COMPLETED` gated on `finalAndThirdPlacePlayed` (so an archived tournament always has all four placements resolved); `CompletedBanner` (`src/components/completed-banner.tsx`, `role="status"`); `updateTournament` / result actions refuse `COMPLETED` (archived results are frozen — the archive reads a stable snapshot). `transitionTournament(…COMPLETED)` already `revalidatePath("/archive")`.
- **Story 4.4 (done)** — `PlayoffPlacements({ teamNames: (string|null)[] })` — generic, read-only, reused here.
- **Story 3.8 (done, code-reviewed)** — `standings-table.tsx` (`StandingsTable`, server, read-only, `overflow-x-auto role="region" aria-label`, `qualifies` blue-bold + legend, `needsManualSeed` `*` + legend, `#F1F1EF`→`border-border` approximation); the public-page `?tab=` + default-tab logic. **The archive's Таблиця section is `<StandingsTable>` verbatim.** The inline `standingsRows` map this story extracts was written here.
- **Story 2.9 (done, code-reviewed)** — `resolveTournament` (public read + admin draft preview); `getPublicTournament` / `listPublicTournaments` (`state != DRAFT` + `CLASSIC`); the 2.9 review's open question "will completed tournaments need to disappear from `/classic` once `/archive` exists — real question for whoever builds `/archive`" — **this story answers it: yes, the list; no, a direct link.** `/classic/[tournament]/teams/[team]` (public roster route, uses `resolveTournament`) — reused by the archive «Команди» links.
- **Story 1.8 (done)** — `/archive`, `/classic`, `/beach` as independent route trees; `SectionShell`; `DisciplineNav` + `src/lib/sections.ts` (`ARCHIVE` link, `isActiveSection` matches `/archive/**`); `EmptyState` + `src/lib/empty-states.ts` (`ARCHIVE_EMPTY`, `ARCHIVE_YEAR_EMPTY`, `NO_TOURNAMENTS`, `NO_TEAMS`).

### Git intelligence

Recent: `327854a` (Story 4.6 review-fix, done) ← `5d17f47` (Story 4.6) ← `390e6c1` (Story 4.5 review-fix). `epic-4` `in-progress`; `4-1`…`4-6` `done`, `4-7` `backlog` (the last story). `src/data/tournaments.ts` has `getPublicTournament` / `listPublicTournaments` (`state != DRAFT`). `src/data/matches.ts` has `getStandings` (→ `StandingsView[]`), `listGroupMatchesForTournament`. `src/data/playoff.ts` has `getPlayoffBracket` / `placementNames`. `src/app/archive/page.tsx` is the Story 1.8 placeholder. `src/components/bracket.tsx` / `standings-table.tsx` / `playoff-placements.tsx` / `public-schedule.tsx` are the read-only components to reuse. No migration since `20260907140000_match_slot_stage_per_stage_fix`. `pnpm test` 169.

### Latest tech information

- **No new library.** Next 16 Server Components, Tailwind v4, Prisma 7 reads.
- **No migration** — no schema change. `pnpm build` before `pnpm typecheck` because of the **new nested dynamic route** `/archive/[year]/[tournament]` (Next needs `.next/types` regen for `PageProps<"/archive/[year]/[tournament]">` — the Story 2.8 / 3.5 / 3.6 pattern).
- **`Object.groupBy`** is available on Node 24 (the pinned runtime) and in TS 5's lib. If `tsconfig` `lib`/`target` doesn't expose it, a manual `reduce` into a `Map<number, T[]>` is fine — don't add a polyfill.
- **`Number(year)`** — `year` is a route param string; compare against `tournament.year` (an `Int` column). `Number("2026") === 2026`. A non-numeric segment → `NaN !== year` → `notFound()`.
- **`PLAYOFF_STAGES`** (`["SEMIFINAL", "THIRD_PLACE", "FINAL"]`) is a private const in `src/data/playoff.ts` — only relevant if the batched-placements follow-up is ever done; not this story.

### Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 4.7 AC, FR-23; Epic 4 «Архів (FR-23) — окрема невелика історія (read-only)»), `prd.md` §4.9 (FR-23) + §4.10 (FR-25), `ARCHITECTURE-SPINE.md` (AD-4/AD-5/AD-7/AD-9), `SPEC.md` (CAP-10, Assumptions «Фінальні місця команд поза плейофом (5-те й нижче) показуються за порядком у таблиці групи»), `EXPERIENCE.md` (IA — `/archive`, `/archive/[year]/[tournament]`; KF-1 §8 — completed tournament leaves the active list; Empty state cases), `DESIGN.md` (reuse the brand-layer components; `tabular-nums`; 1120px), `4-6-…` (`Bracket` / `BracketPairVM` / `PLAYOFF_SLOT_LABELS` / `placementNames`), `4-5-…` (`COMPLETED` always has placements; `CompletedBanner`), `4-4-…` (`PlayoffPlacements`), `3-8-…` (`StandingsTable` + the `standingsRows` map being extracted), `2-9-…` (`getPublicTournament` / `listPublicTournaments`, the "does `/classic` drop completed" open question), `1-8-…` (`/archive` placeholder, `SectionShell`, `sections.ts`, `empty-states.ts`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.7: Річний архів] — user story + AC; FR-23
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4] — «Архів (FR-23) — окрема невелика історія (read-only)»
- [Source: _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md#4.9] — FR-23 «Наслідки» (тип/рік/назва/місця 1–4; read-only з таблицями й сіткою; місця 5+ за таблицею групи) · [#4.10] — FR-25
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#Capabilities CAP-10] — архів: тип/рік/назва/місця 1–4, read-only, без входу · [#Assumptions] — місця 5+ за таблицею групи
- [Source: …/ARCHITECTURE-SPINE.md#AD-4] — таблиця / фінальні місця не зберігаються · [#AD-5] · [#AD-7] — публічне читання повз auth, `state != DRAFT` · [#AD-9] — `CLASSIC` фільтр
- [Source: …/ux-designs/…/EXPERIENCE.md#Information Architecture] — `/archive`, `/archive/[year]/[tournament]` «лише читання» · [#Key Flows KF-1 §8] — «Турнір зникає зі списку активних і зʼявляється в `/archive/2026`» · [#State Patterns] — empty states
- [Source: …/ux-designs/…/DESIGN.md#Components] — reuse `Standings table` / `Bracket pair` / `Status badge` / `Empty state` · [#Typography] — `tabular-nums`
- [Source: src/data/tournaments.ts] — `getPublicTournament` / `listPublicTournaments` (the filter to narrow; the read to add a sibling of)
- [Source: src/data/matches.ts] — `getStandings` (→ `StandingsView[]`), `listGroupMatchesForTournament` (the maps to extract)
- [Source: src/data/playoff.ts] — `getPlayoffBracket`, `placementNames`
- [Source: src/components/standings-table.tsx / bracket.tsx / playoff-placements.tsx / public-schedule.tsx / status-badge.tsx] — the read-only components reused verbatim
- [Source: src/app/classic/[tournament]/page.tsx] — the tab-body + VM-map code the archive detail mirrors (and the classic page is refactored to share)
- [Source: src/app/classic/page.tsx / src/app/archive/page.tsx / src/lib/sections.ts / src/lib/empty-states.ts] — the `/classic` list, the `/archive` placeholder to replace, the section links + empty-state copy
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — "parameterise `TournamentTabs` … Story 4.7" (resolved not-needed); "will completed tournaments need to disappear from `/classic` … whoever builds `/archive`" (resolved here)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (bmad-dev-story)

### Debug Log References

- `pnpm build` runs `node scripts/migrate-deploy.mjs` locally (`VERCEL_ENV` unset) → `migrate deploy` against the Neon `dev` branch; no-op this story (no migration). Build regenerates `.next/types` for the new `/archive/[year]/[tournament]` route.

### Completion Notes List

- **Task 1:** `src/data/tournaments.ts` — `listArchivedTournaments()` / `getArchivedTournament(id)` (`state = COMPLETED` + `CLASSIC`); `listPublicTournaments()` filter `{ not: "DRAFT" }` → `{ in: ["GROUP_STAGE", "PLAYOFF"] }`; `getPublicTournament` unchanged. Docstrings updated.
- **Task 2:** `src/data/matches.ts` — `standingsTableRows(standings)` (flatten + `position` + `qualifies`) and `publicScheduleRows(matches)` (Kyiv date + score label), both pure; `formatKyivDateTime` / `matchScoreLabel` / `PLAYOFF_QUALIFIERS` imported (the `data → domain` value edge `getStandings` already uses).
- **Task 3:** `src/app/classic/[tournament]/page.tsx` — consumes `standingsTableRows` / `publicScheduleRows`; `toBracketPair` removed (`const bracketPairs: BracketPairVM[] = [semifinals[0], semifinals[1], final, thirdPlace]` — `PlayoffBracketPairView` is structurally a superset). No behaviour change; ~35 lines of inline mapping gone.
- **Task 4:** `src/app/archive/page.tsx` — replaces the placeholder: `listArchivedTournaments()` → `Promise.all(getPlayoffBracket)` → `placementNames`; grouped by year (Map, insertion order = year-desc from the query); each row: name link → `/archive/${year}/${id}`, type label, «1. … · 2. … · 3. … · 4. …» («—» for a null place). `[]` → `<EmptyState {...ARCHIVE_EMPTY} />`.
- **Task 5:** `src/app/archive/[year]/[tournament]/page.tsx` (NEW) — `getArchivedTournament(id)` → `notFound()` if null or `tournament.year !== Number(year)`; parallel fetch of standings / entries / group matches / bracket; four stacked read-only `<section>`s (Команди links → `/classic/${id}/teams/${teamId}`, Таблиця → `<StandingsTable>`, Розклад → `<PublicSchedule>`, Плейоф → `<Bracket>` + `<PlayoffPlacements>`).
- **Task 6:** `src/app/classic/page.tsx` — «Переглянути архів завершених турнірів» link → `/archive`; list is `COMPLETED`-free via the Task 1 filter.
- **Task 7:** `scripts/verify-archive.mts` (NEW) — three throwaway tournaments (`COMPLETED` ×2 years / `GROUP_STAGE` / `DRAFT`) via direct `setTournamentState`: asserts `listArchivedTournaments` (COMPLETED-only, year-desc), `getArchivedTournament` (COMPLETED-only), `listPublicTournaments` (excludes COMPLETED, keeps GROUP_STAGE), `getPublicTournament` (still resolves COMPLETED), and `standingsTableRows` (positions + top-4 marker) with a hand-built input. Full teardown. `verify-public-tournament.mts` needed no change (it only tested DRAFT vs GROUP_STAGE).
- **Task 8:** docs — `src/data/README.md` (the four new reads + the `listPublicTournaments` narrowing), `AGENTS.md` (Story 4.7 Stack bullet + `verify-archive.mts` catalogue line), `deferred-work.md` (Story 4.7 section: `TournamentTabs` parameterisation not-needed; archive teams reuse `/classic/...`; N+1 `getPlayoffBracket` batched follow-up; no `/archive/[year]` index / `ARCHIVE_YEAR_EMPTY` unused; no component test).
- **Task 9:** `pnpm build` ✓ · `pnpm typecheck` ✓ · `pnpm lint` ✓ · `pnpm test` **169/169** (unchanged — no domain change). `prisma migrate status` up to date; `migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` → "empty migration". All 17 verify scripts green. Import-boundary clean (pages read `@/data`; `src/data/matches.ts` value-calls `@/domain`; no `@/data` import in any component).
- No migration, no new `src/domain` module, no `src/actions`, no `Tournament.state` change, no write path. Last story of Epic 4.

### File List

- `src/data/tournaments.ts` (UPDATE)
- `src/data/matches.ts` (UPDATE)
- `src/app/classic/[tournament]/page.tsx` (UPDATE)
- `src/app/classic/page.tsx` (UPDATE)
- `src/app/archive/page.tsx` (REPLACE)
- `src/app/archive/[year]/[tournament]/page.tsx` (NEW)
- `scripts/verify-archive.mts` (NEW)
- `src/data/README.md` · `AGENTS.md` · `_bmad-output/implementation-artifacts/deferred-work.md` (UPDATE)

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-07 | Story drafted (`bmad-create-story`). Scope: `/archive` (year-grouped list of `COMPLETED` tournaments, places 1–4) + `/archive/[year]/[tournament]` (single-page read-only record — Команди · Таблиця · Розклад · Плейоф), reusing every existing read-only component; `listArchivedTournaments` / `getArchivedTournament` reads; `standingsTableRows` / `publicScheduleRows` helpers extracted to `src/data/matches.ts` (shared with `/classic/[tournament]`); `listPublicTournaments()` narrowed to exclude `COMPLETED` (EXPERIENCE KF-1). Archive detail is single-page not tabbed → `TournamentTabs` parameterisation resolved not-needed. No migration, no domain, no actions, no write path. `/archive` = last story of Epic 4. Status: ready-for-dev. |
| 2026-09-07 | Implementation complete (`bmad-dev-story`) — all 10 tasks. `/archive` + `/archive/[year]/[tournament]` pages; `listArchivedTournaments` / `getArchivedTournament`; `standingsTableRows` / `publicScheduleRows` extracted (classic page refactored to share); `listPublicTournaments` excludes `COMPLETED`; `/classic` archive link. `scripts/verify-archive.mts` (NEW). No migration / domain / actions / write path. `pnpm build`/`typecheck`/`lint` clean, `pnpm test` 169/169, all 17 verify scripts green, `migrate diff` empty. Status: review. |
