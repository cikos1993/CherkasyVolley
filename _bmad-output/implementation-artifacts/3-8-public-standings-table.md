---
baseline_commit: 7f8063c
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/implementation-artifacts/3-1-domain-engine-scoring-tiebreak-schedule-validation.md
  - _bmad-output/implementation-artifacts/3-2-group-stage-schema.md
  - _bmad-output/implementation-artifacts/3-5-match-scheduling.md
  - _bmad-output/implementation-artifacts/3-6-enter-match-result.md
  - _bmad-output/implementation-artifacts/2-9-public-tournament-page-teams-tab.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - AGENTS.md
---

# Story 3.8: Публічна турнірна таблиця

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a глядач,
I want бачити таблицю групи,
so that я знаю позиції команд (FR-17, FR-18).

## Acceptance Criteria

Translated from `epics.md` → Epic 3 → Story 3.8. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** a tournament in state `GROUP_STAGE` or later
**When** a visitor opens the «Таблиця» tab **without signing in**
**Then**

1. The table shows columns: **зіграно, перемоги, поразки, очки, виграні партії, програні партії**.
2. Team order is **очки → особиста зустріч → виграні партії → детермінований резерв (назва + прапорець ручного розсіву)**.
3. Positions **1–4** are marked with a **blue bold number** and a **«Виходить у плейоф»** hint.
4. The table is **recomputed on every result change**; the markup is **semantic (`th scope`, `caption`)**; there is a **horizontal-scroll container with an `aria-label`**.

PRD §4.7 / FR-17–18 (`prd.md`, in context):

- FR-17: "Система обчислює Таблицю групи після кожної зміни Результату — стовпці зіграно/перемоги/поразки/очки/виграні партії/програні партії; очки за Системою очок; порядок — очки → особиста зустріч → виграні партії → детермінований резерв (назва + прапорець ручного розсіву)."
- FR-18: "Глядач переглядає Таблицю кожної Групи Турніру **без входу**."
- UX-DR5: "Компонент Standings table — семантика `<th scope="col">` + `<caption>`, `tabular-nums`, позиції 1–4 синім жирним номером із підказкою «Виходить у плейоф», **без зебри**, контейнер горизонтального скролу з `aria-label`."
- EXPERIENCE.md: the «Таблиця» tab is **the default in `GROUP_STAGE`+** (IA line 37; UJ-2 step 2 "сторінка турніру, вкладка Таблиця за замовчуванням"). "Standings table — тільки читання для всіх (навіть адміна). Оновлюється при перезаході на сторінку після внесення результату (`revalidatePath`)." "Позиції 1–4 — синій жирний номер; підказка при наведенні/тапі: «Виходить у плейоф»."
- EXPERIENCE.md States: **немає результатів** → "Таблиця показує команди з нулями + рядок «Результатів поки немає»"; **жеребкування не проведено** → "«Групу буде сформовано після жеребкування»".
- DESIGN.md: "Standings table — рядок; для позицій 1–4 номер позиції синій і жирний (мітка виходу в плейоф). Клітинки чисел — `tabular-nums`, вирівнювання по центру. Без зебри; розділювач — лінія `#F1F1EF`." Token `standings-row-qualifying.marker` = `{colors.primary}`.

## Notes on AC interpretation

- **The domain is done. This story is a *rendering* story.** `getStandings(tournamentId)` (`src/data/matches.ts`, Story 3.2) already returns the fully-ordered standings — `computeStandings` (FR-17 columns) → `orderStandings` (the FR-17 tiebreak chain: points → head-to-head mini-table → total sets won → team-name fallback with a `needsManualSeed` flag). It is recomputed fresh on every call (AD-4 — never stored). Story 3.6/3.7's `enterMatchResult` / `editMatchResult` / `removeMatchResult` **already** call `revalidatePath(`/${discipline}/${tournamentId}`)`, so AC 4's "recomputed on every result change" is already wired — this story only adds the visible table. **No schema change, no new domain module, no new route.**

- **`getStandings` needs one addition: the team name per row.** Today it returns `OrderedStandingsRow[]` = `{ row: StandingsRow; needsManualSeed: boolean }` — `StandingsRow` has `entryId` / `played` / `wins` / `losses` / `points` / `setsWon` / `setsLost` but **no team name** (the name is used internally by `orderStandings`'s fallback, not surfaced). `getStandings` already builds a `teamNames` map from `GroupSlot`. Add it to the return: `export type StandingsView = OrderedStandingsRow & { teamName: string }` and `.map((o) => ({ ...o, teamName: teamNames[o.row.entryId] ?? "—" }))`. **Additive** — every existing `.row.*` / `.needsManualSeed` access in the verify scripts is unaffected.

- **Un-hide the «Таблиця» tab and make it the default (`GROUP_STAGE`+).** The Story 3.5 review hid the chip (`showStandings = false` in `page.tsx`) and deferred "restore the spec order + state-dependent default" **to this story**. Do:
  - `src/components/tournament-tabs.tsx` — reorder `TABS` to DESIGN §176 / EXPERIENCE IA order: **`standings` · `schedule` · `teams` · `playoff`**. Remove the `showStandings` prop entirely — the «Таблиця» chip is now always shown (its content adapts: real table when drawn, "Групу буде сформовано після жеребкування" pre-draw). `showPlayoff` stays (genuinely conditional).
  - `normalizeTournamentTab(raw)` — change the return to `TournamentTabKey | null` (`null` when the raw value is absent or unknown) so the page can pick a state-aware default.
  - `src/app/classic/[tournament]/page.tsx` — `const defaultTab = tournament.state === "DRAFT" ? "teams" : "standings"; let activeTab = normalizeTournamentTab(tab) ?? defaultTab;`. Keep the `if (activeTab === "playoff" && !showPlayoff) activeTab = defaultTab;` guard. Drop the `showStandings` local and its reassignment line.

- **New `src/components/standings-table.tsx`** — a **server** component (read-only, no interactivity — EXPERIENCE "тільки читання для всіх"). Props (a local view type, not Prisma/data-imported — the `public-schedule.tsx` precedent): `rows: { position: number; teamName: string; played: number; wins: number; losses: number; points: number; setsWon: number; setsLost: number; qualifies: boolean; needsManualSeed: boolean }[]` and `hasResults: boolean`. Markup:
  - `<div className="overflow-x-auto" role="region" aria-label="Турнірна таблиця">` (AC 4 — scroll container with an `aria-label`; UX-DR14 — table scrolls inside its own container, body never moves).
  - `<table className="w-full text-sm">` with a `<caption className="sr-only">Турнірна таблиця групи</caption>` (AC 4 — `caption`; sr-only because the `<h1>` + active tab chip already give visible context).
  - `<thead>`: `<th scope="col">` for every column — `№`, `Команда`, then `<abbr title="Зіграно">З</abbr>`, `<abbr title="Перемоги">В</abbr>`, `<abbr title="Поразки">П</abbr>`, `Очки`, `<abbr title="Виграні партії">ВП</abbr>`, `<abbr title="Програні партії">ПП</abbr>`. Numeric headers `text-center`.
  - `<tbody>` rows — **no zebra**, `border-b` divider between rows (DESIGN's `#F1F1EF`; use `border-border` / `divide-y`, the codebase pattern). Team name cell `<th scope="row">`. Numeric cells `tabular-nums text-center`.
  - Position cell: `qualifies` → `<span className="font-bold text-primary" title="Виходить у плейоф">{position}<span className="sr-only"> — виходить у плейоф</span></span>`; else the plain number. `needsManualSeed` → append a `*` after the number (or the name).
  - Below the table, a `<p className="mt-2 text-xs text-muted-foreground">` legend: "Синім — позиції 1–4, що виходять у плейоф." + (only when some row `needsManualSeed`) " · * — місце визначено за назвою команди; потрібен ручний розсів."
  - `hasResults === false` → a single `<tr>` with a `<td colSpan={8}>` reading "Результатів поки немає." (the team rows still render, all zeros — EXPERIENCE "команди з нулями + рядок «Результатів поки немає»"). **Not** an `EmptyState` box.

- **Page wiring for the `standings` panel** (`src/app/classic/[tournament]/page.tsx`):
  - `activeTab === "standings"` → `const standings = await getStandings(id);`
  - `standings.length === 0` (no `GroupSlot` — a `DRAFT` tournament seen via the admin-preview fallback) → `<p className="text-sm text-muted-foreground">{GROUP_NOT_DRAWN.description}</p>` (the const added in the Story 3.5 review).
  - else → map to the view rows (`position: i + 1`, `qualifies: i < 4`), `hasResults = standings.some((s) => s.row.played > 0)`, `<StandingsTable rows={…} hasResults={hasResults} />`.
  - Fetch `getStandings` only when `activeTab === "standings"` (the same per-tab-fetch pattern the page already uses for `teams` / `schedule`).

- **Positions 1–4 are always meaningful.** `TEAM_COUNT_MIN = 4` and a `GROUP_STAGE` tournament is fully drawn, so there are always ≥ 4 rows; if there are exactly 4, all four `qualifies` (the whole group advances — correct).

- **AD-13 / UX-DR13 — state never by colour alone.** The 1–4 qualification is conveyed three ways: the blue bold number (colour), the `title` hint (hover/tap), the `sr-only` "— виходить у плейоф" (assistive tech), and the legend line (visible text). Don't rely on the blue alone.

- **Shared surface with Story 4.7.** `standings-table.tsx` and the `getStandings` `teamName` addition are reused verbatim by the archive route (`/archive/[year]/[tournament]`). Build it generic enough (it already is — pure props); no archive code here.

## Tasks / Subtasks

- [x] **Task 1 — `src/data/matches.ts` (UPDATE): `getStandings` returns the team name** (AC: 1, 2)
  - [x] `export type StandingsView = OrderedStandingsRow & { teamName: string }`.
  - [x] `getStandings` return type → `Promise<StandingsView[]>`; final line → `orderStandings(...).map((o) => ({ ...o, teamName: teamNames[o.row.entryId] ?? "—" }))`. The two early `return []` stay (`Promise<StandingsView[]>` — `[]` is assignable).
  - [x] Doc comment: note the row now carries `teamName` for the public table (Story 3.8).
  - [x] `typecheck`/`lint` clean. No new Prisma-client import site.

- [x] **Task 2 — `src/components/tournament-tabs.tsx` (UPDATE): order + always-show standings** (AC: 3, 4)
  - [x] Reorder `TABS`: `standings` (Таблиця), `schedule` (Розклад), `teams` (Команди), `playoff` (Плейоф).
  - [x] Remove the `showStandings` prop and the `tab.key !== "standings" || showStandings` filter clause. `showPlayoff` stays.
  - [x] `normalizeTournamentTab(raw): TournamentTabKey | null` — return `null` when `value` is not a known key (instead of `"teams"`). Update the doc comment.
  - [x] `typecheck`/`lint` clean.

- [x] **Task 3 — `src/components/standings-table.tsx` (NEW)** (AC: 1, 3, 4)
  - [x] Server component. `StandingsTable({ rows, hasResults }: { rows: StandingsTableRow[]; hasResults: boolean })` with a local `StandingsTableRow` type (`position`, `teamName`, `played`, `wins`, `losses`, `points`, `setsWon`, `setsLost`, `qualifies`, `needsManualSeed`).
  - [x] `overflow-x-auto` `role="region"` `aria-label="Турнірна таблиця"` container; `<table>` with `<caption className="sr-only">`; `<th scope="col">` headers (`№`, `Команда`, `З`/`В`/`П` as `<abbr title>`, `Очки`, `ВП`/`ПП` as `<abbr title>`); `<th scope="row">` for the team name; numeric cells `tabular-nums text-center`; no zebra; `border-b` / `divide-y` divider.
  - [x] Position cell: `qualifies` → `font-bold text-primary` + `title="Виходить у плейоф"` + `sr-only` " — виходить у плейоф"; `needsManualSeed` → a `*` marker.
  - [x] Legend `<p>` below: "Синім — позиції 1–4, що виходять у плейоф." + conditional `*` note.
  - [x] `!hasResults` → one `<tr><td colSpan={8}>Результатів поки немає.</td></tr>` (team rows still shown with zeros).
  - [x] `typecheck`/`lint` clean.

- [x] **Task 4 — `src/app/classic/[tournament]/page.tsx` (UPDATE): standings panel + default tab** (AC: 1, 3, 4)
  - [x] `const defaultTab = tournament.state === "DRAFT" ? "teams" : "standings";` — `let activeTab = normalizeTournamentTab(tab) ?? defaultTab;` — `if (activeTab === "playoff" && !showPlayoff) activeTab = defaultTab;`. Drop `showStandings` + its reassignment.
  - [x] `<TournamentTabs>` — drop `showStandings={…}`.
  - [x] `activeTab === "standings"` → `getStandings(id)`; `length === 0` → `GROUP_NOT_DRAWN.description`; else map to view rows + `hasResults` + `<StandingsTable>`.
  - [x] Preserve the `teams` / `schedule` / `playoff` panels and the `resolveTournament` + `notFound()` guard verbatim.
  - [x] `typecheck`/`lint` clean.

- [x] **Task 5 — `scripts/verify-group-stage-schema.mts` (UPDATE): `teamName` + `needsManualSeed` assertions**
  - [x] In the 3-way-cycle standings section, add: `check("getStandings rows carry a non-empty teamName", standings.every((r) => typeof r.teamName === "string" && r.teamName.length > 0))` and `check("the cycle rows are flagged needsManualSeed", standings.every((r) => r.needsManualSeed))` (the latter may already exist — keep one).
  - [x] In the clear-winner section, add `check("the ordered rows expose the right team names", clearStandings[0].teamName.startsWith("…") …)` — assert `teamName` tracks the ordering.
  - [x] Run the script — green.

- [x] **Task 6 — Docs**
  - [x] `src/data/README.md` — `getStandings` entry gains "returns `teamName` per row (`StandingsView`, Story 3.8)".
  - [x] `src/components/README.md` — `tournament-tabs.tsx` note (order + always-show standings + nullable `normalizeTournamentTab`); new `standings-table.tsx` entry.
  - [x] `AGENTS.md` — Stack-status bullet for Story 3.8 (the «Таблиця» tab, `getStandings` `teamName`, tab order restored).
  - [x] `deferred-work.md` — mark the Story 3.5-review "hide Таблиця / restore order + default in 3.8" item **resolved**; new "Story 3.8 implementation" section for residuals (no component test; the `#F1F1EF` divider approximated by `border-border`; `<abbr>` single-letter headers vs. full words — a11y judgement call).

- [x] **Task 7 — Verification gate** (AC: all)
  - [x] `pnpm build` (sanity — no new route) → `pnpm typecheck` → `pnpm lint` → `pnpm test` (**no new Vitest** — `orderStandings` is exhaustively covered by `tiebreak.test.ts`; confirm the count is unchanged).
  - [x] Import-boundary grep: no new Prisma-client import outside `src/data/**`; `standings-table.tsx` imports nothing from `@/data` / `@/actions` (pure presentational).
  - [x] `scripts/verify-group-stage-schema.mts` green (with the new assertions); re-run all 13 prior verify scripts — no regression.

  _Residual (not a blocking subtask — matches every prior public/admin story):_ a manual signed-out browser pass was not performed in this session (no seeded `GROUP_STAGE` tournament in the dev DB). Mitigated by `verify-group-stage-schema.mts`'s coverage of the data + the full build/typecheck/lint/test gate. Recommended with code review: `/classic/[id]` for a `GROUP_STAGE` tournament in a private window → lands on «Таблиця» by default; table shows all teams, `tabular-nums`, positions 1–4 blue+bold with the hint, no zebra, scrolls horizontally on a narrow viewport; enter/edit/delete a result in the admin and reload → the order recomputes.
  - [x] Real command output + notes in the Dev Agent Record.

- [x] **Task 8 — Commit(s)** — one commit + `git push origin main` per completed task group. `build`/`typecheck`/`lint`/`test` gated each.

### Review Findings

_Code review (`bmad-code-review`, 4 layers: Blind Hunter, Edge Case Hunter, Verification Gap Reviewer, Acceptance Auditor) over `git diff 7f8063c..HEAD`. All 4 layers completed; Verification Gap found none. 0 decision-needed, 9 patch, 3 defer, 5 dismissed._

#### Patch

- [x] [Review][Patch] `standings-table.tsx` a11y gaps `[src/components/standings-table.tsx]` — three, one file: **(a)** the `overflow-x-auto role="region"` container has no `tabIndex={0}`, so a keyboard-only user on a narrow viewport can't scroll the table (EXPERIENCE.md says the container must be *focusable*; WCAG 2.1.1); **(b)** the `needsManualSeed` `*` is `<span aria-hidden>` with no `sr-only` counterpart — AT users get no signal the position is name-ordered, though the `qualifies` hint did get one and AC 2 lists the "прапорець ручного розсіву" as an ordering signal; **(c)** each stat `<th scope="col">` has accessible name "З"/"В"/… — `<abbr title>` tooltips don't announce and never fire on touch. Add `tabIndex={0}`, an `sr-only` "— місце за назвою команди" beside the `*`, and an `sr-only` full word (or `aria-label`) on each stat header.
- [x] [Review][Patch] `Очки` rendered as `О`; `№` cells not centred `[src/components/standings-table.tsx]` — the story's own markup spec spells `Очки` in full (it's the primary sort key); DESIGN §176 says number cells are `вирівнювання по центру` and the `№` column/header are `text-left`. Fix: `Очки` full word (no `<abbr>`); `text-center` on the `№` `<th>`/`<td>`.
- [x] [Review][Patch] Qualifier highlight is meaningless when the group is exactly 4 `[src/app/classic/[tournament]/page.tsx, src/components/standings-table.tsx]` — `TEAM_COUNT_MIN = 4`, so a 4-team group paints every row blue/bold and the "позиції 1–4" legend is noise; the marker's job is a *distinction*. Add `export const PLAYOFF_QUALIFIERS = 4` to `src/domain/tiebreak.ts` (Story 4.1's `seedPlayoff` and 4.7's archive reuse need the same rule), compute `qualifies: index < PLAYOFF_QUALIFIERS && standings.length > PLAYOFF_QUALIFIERS`, and render the "Синім — …" legend only when a row actually qualifies.
- [x] [Review][Patch] Inline "Результатів поки немає." bypasses `src/lib/empty-states.ts` (the "єдине джерело копірайту") `[src/components/standings-table.tsx, src/lib/empty-states.ts]` — and `NO_RESULTS` ("Результатів поки немає — таблиця зʼявиться після першого зіграного матчу.") is a never-used near-duplicate (grep: defined, zero consumers). Repurpose `NO_RESULTS` → `"Результатів поки немає."` and use it for the inline `<td colSpan>` row; the legend microcopy can stay component-local (it is not an empty state).
- [x] [Review][Patch] `StandingsTable` forces the page to know its empty case; the pre-draw panel is a bare `<p>` `[src/components/standings-table.tsx, src/app/classic/[tournament]/page.tsx]` — `PublicSchedule` handles `matches.length === 0` internally; here `page.tsx` branches on `standings.length === 0` and renders a bare `<p>{GROUP_NOT_DRAWN.description}</p>` while the sibling `teams` tab uses `<EmptyState {...NO_TEAMS} />`. Move the empty check into `StandingsTable` (accept `rows: []` → `<EmptyState {...GROUP_NOT_DRAWN} />`), matching `PublicSchedule` and the `teams` tab.
- [x] [Review][Patch] Region `aria-label` not parameterised for the archive reuse `[src/components/standings-table.tsx]` — the README says the component is "reused verbatim by the archive route (Story 4.7)", where several tournaments render on one page → several navigable regions all named "Турнірна таблиця". Take a `tournamentName` prop; `aria-label={`Турнірна таблиця: ${tournamentName}`}` (the `<caption>` stays group-scoped, so the two labels are distinct, not redundant).
- [x] [Review][Patch] Rows keyed on `position`, not a stable id `[src/components/standings-table.tsx, src/app/classic/[tournament]/page.tsx]` — `key={row.position}`, so after a result reorders the standings React reconciles `<tr>`s by rank, not team. Harmless for a fully SSR'd table today, but add `entryId` to the view type and key on it (also needed for any future per-row link).
- [x] [Review][Patch] The "Виходить у плейоф" phrase is hard-coded in three places `[src/components/standings-table.tsx]` — `title`, `sr-only`, and the legend each spell a variant. Export one `QUALIFIES_HINT` const (the capitalised standalone form) and use it for the `title` + `sr-only`; the legend's plural-verb phrasing can stay.
- [x] [Review][Patch] `verify-group-stage-schema.mts` new assertion line exceeds 120 chars `[scripts/verify-group-stage-schema.mts]` — reformat the `teamName` check added in Task 5.

#### Defer

- [x] [Review][Defer] `#F1F1EF` row divider approximated by `border-border` `[src/components/standings-table.tsx]` — deferred, already disclosed in `deferred-work.md`; folds into a design-system table-styling pass.
- [x] [Review][Defer] `getStandings` is now the heaviest default landing query on the most-hit public page, uncached `[src/app/classic/[tournament]/page.tsx]` — `findUnique` + all `GroupSlot` + all `GROUP` matches + all `SetScore` + full recompute per request, no `unstable_cache`/tag, no `loading.tsx`. Deferred — folds into the already-tracked "no caching/revalidation strategy for the app's first anonymous-traffic routes" item (2.9 review); at v1 scale (NFR-5) the query is small. `revalidatePath` is invalidation, not caching — a real fix needs an `unstable_cache` wrap, a cross-cutting decision.
- [x] [Review][Defer] The top-4 order is shown as definitive even when `needsManualSeed` straddles the playoff cut-line `[src/components/standings-table.tsx]` — the `*` + legend say "потрібен ручний розсів", but positions 4/5 tied on the name fallback still render position 4 with a confident "Виходить у плейоф". A stronger "this order is provisional" treatment belongs with the playoff-seeding story (4.1/4.2), which consumes `orderStandings`.

## What this story is / is NOT

**Is:** the visible public «Таблиця» tab — a semantic, scroll-contained, no-zebra standings table rendering `getStandings`'s already-ordered rows (+ a one-field `teamName` addition), with 1–4 marked blue+bold; the tab un-hidden, reordered to spec, and made the default in `GROUP_STAGE`+.

**Is NOT** (do not pull forward):
- **Any schema change, new domain module, or new route.**
- **Re-implementing scoring or the tiebreak chain.** `computeStandings` / `orderStandings` are done (Story 3.1) — `getStandings` calls them.
- **The recompute plumbing.** `enterMatchResult` / `editMatchResult` / `removeMatchResult` already `revalidatePath` the public page (Story 3.6/3.7).
- **A manual-reseed UI.** `needsManualSeed` is a read-only flag/marker here; an admin reseed screen is not in any Epic 3/4 AC (`deferred-work.md` Story 3.2 note).
- **The playoff bracket / «Плейоф» tab.** Epic 4.
- **The archive route.** Story 4.7 reuses `standings-table.tsx`; no archive code here.
- **Multi-group support.** v1 has one `Group` per tournament (AD-4 / Story 2.4).

## Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/data/matches.ts` | UPDATE | `getStandings` → `StandingsView[]` (adds `teamName`). |
| `src/components/tournament-tabs.tsx` | UPDATE | `TABS` reorder; drop `showStandings`; `normalizeTournamentTab` → nullable. |
| `src/components/standings-table.tsx` | NEW | The public table (server, read-only). |
| `src/app/classic/[tournament]/page.tsx` | UPDATE | Standings panel; state-aware default tab. |
| `scripts/verify-group-stage-schema.mts` | UPDATE | `teamName` / `needsManualSeed` assertions. |
| `src/data/README.md` · `src/components/README.md` · `AGENTS.md` · `deferred-work.md` | UPDATE | Module entries, Stack status, resolved/new deferred items. |
| `prisma/schema.prisma` | DO NOT TOUCH | Standings never stored (AD-4). |

## Architecture compliance

- **AD-1** — the standings tab is a Server Component; no mutation. [ARCHITECTURE-SPINE.md#AD-1]
- **AD-3** — `view → data` (`page.tsx` → `getStandings`), `data → domain` value (`getStandings` → `computeStandings`/`orderStandings`, the established edge), `view → domain` (none new — the table takes plain props). `standings-table.tsx` imports no layer. [ARCHITECTURE-SPINE.md#AD-3]
- **AD-4 / NFR-3** — the standings table is a pure function of `Match` + `SetScore`, recomputed on read; nothing stored, nothing to drift. [ARCHITECTURE-SPINE.md#AD-4, PRD NFR-3]
- **AD-7** — public read, no `requireAdmin`. Goes through `resolveTournament` (Story 2.9's `state != DRAFT` + `discipline = CLASSIC` filter, with the admin-preview fallback) before `getStandings`. [ARCHITECTURE-SPINE.md#AD-7]
- **AD-9** — CLASSIC only; the tab lives under `/classic/**`. [ARCHITECTURE-SPINE.md#AD-9]
- **UX-DR5 / UX-DR13 / UX-DR14** — semantic table (`th scope`, `caption`), `tabular-nums`, no zebra, scroll container with `aria-label`, body never scrolls horizontally, state not by colour alone. [DESIGN.md, EXPERIENCE.md]

## Existing code being modified — current state → change → what must be preserved

**`src/data/matches.ts`** (`getStandings`, Story 3.2 + all Epic 3 additions through 3.7)
- *Current:* `getStandings` returns `Promise<OrderedStandingsRow[]>` — `{ row, needsManualSeed }`; builds a `teamNames` map it doesn't surface.
- *Change:* surface `teamName` on each returned element (`StandingsView`); return type widens.
- *Must preserve:* the `GroupSlot`-not-`TournamentEntry` entry-id source, the `sets.length > 0` filter (Story 3.2 review), the two `return []` early exits, and every other `matches.ts` export verbatim.

**`src/components/tournament-tabs.tsx`** (Story 3.5, 3.5-review)
- *Current:* `TABS` order `teams, schedule, standings, playoff`; `showStandings` + `showPlayoff` props gate the `standings` / `playoff` chips; `normalizeTournamentTab` defaults to `"teams"`.
- *Change:* reorder `TABS`; remove `showStandings`; `normalizeTournamentTab` returns `null` for absent/unknown.
- *Must preserve:* the `<Link>`-based chips, the active-chip styling + `aria-current`, the `overflow-x-auto` row, `showPlayoff` gating, `TournamentTabKey`.

**`src/app/classic/[tournament]/page.tsx`** (Story 2.9, 3.5, 3.5-review, 3.6)
- *Current:* `showStandings = false` + a reassignment sending `?tab=standings` to `teams`; `activeTab` defaults to `teams`; panels for `teams` / `schedule` / `playoff` (placeholder); `standings` panel absent.
- *Change:* state-aware default; drop `showStandings`; real `standings` panel via `getStandings` + `<StandingsTable>`.
- *Must preserve:* `resolveTournament` → `notFound()`; the header (`<Link>` back, `<h1>`, `StatusBadge`); `generateMetadata`; the `teams` list + `NO_TEAMS`; the `schedule` panel + its VM shaping (`formatKyivDateTime`, `matchScoreLabel`); the `playoff` placeholder + its `showPlayoff` guard.

## Testing requirements

- **No new Vitest.** `orderStandings` (the FR-17 tiebreak chain, incl. `needsManualSeed`) is exhaustively unit-tested in `src/domain/tiebreak.test.ts` (Story 3.1); `computeStandings` in `scoring.test.ts`. The `teamName` addition is a one-line data map. `pnpm test`'s count is unchanged from **135**.
- **`scripts/verify-group-stage-schema.mts`** grows the `teamName` / `needsManualSeed` assertions — it already exercises `getStandings` with the 3-way-cycle and clear-winner fixtures, so it is the right place (no new script).
- **No component test** for `standings-table.tsx` — the standing "no component toolchain" gap. Mitigated by the verify script's coverage of the *data* it renders + the documented manual pass.
- **Regression:** all 13 prior verify scripts re-run; `pnpm build` sanity (same routes).

## Previous story intelligence

**Story 3.5 (done, code-reviewed):** the review **explicitly deferred to this story**: (a) un-hiding the «Таблиця» chip, (b) restoring the DESIGN §176 tab order, (c) the state-dependent default tab. `deferred-work.md`'s "four-tab-chip row" item and the 3.5-review Patch #1 both name Story 3.8 as the owner — close them.

**Story 3.6 / 3.7 (done, code-reviewed):** `enterMatchResult` / `editMatchResult` / `removeMatchResult` all call `revalidateMatchSurfaces` which revalidates `/${discipline}/${tournamentId}` — the public tournament page. So AC 4's "recomputed on every result change" needs **no action-layer change** here; the standings panel just re-fetches `getStandings` on the revalidated render.

**Story 3.2 (done, code-reviewed):** `getStandings` returns `[]` pre-draw (no `GroupSlot`), and rows with all-zeros between the draw and the first result. Its `sets.length > 0` filter is load-bearing (a review fix) — do not touch it. `verify-group-stage-schema.mts` is `getStandings`'s regression script.

**Story 2.9 (done, code-reviewed):** `resolveTournament` (`src/app/classic/_lib/resolve-tournament.ts`) is the public-read gate — `getPublicTournament` (`state != DRAFT` + `discipline = CLASSIC`) then an admin-preview fallback with a `discipline === "CLASSIC"` re-check. `public-roster.tsx` / `public-schedule.tsx` are the precedent for a read-only public component that imports no `@/actions` / `@/auth`.

## Git intelligence

Recent: `7f8063c` (3.7 review-fix, done) ← the 3.7 / 3.6 / 3.5 chain. `getStandings` currently returns `Promise<OrderedStandingsRow[]>`. `tournament-tabs.tsx` has `showStandings`; `page.tsx` has `showStandings = false`. The `standings` panel branch in `page.tsx` was **removed** in the 3.5 review (there is only a comment) — this story re-adds it, real. `GROUP_NOT_DRAWN` exists in `src/lib/empty-states.ts` (3.5 review).

## Latest tech information

- **No new library.** A plain `<table>` — no data-grid. `tabular-nums` is a Tailwind v4 utility already used across the app. `<abbr>` / `<caption>` / `<th scope>` are standard HTML.
- **Next 16** — `searchParams` is already `await`ed in this page. No new route ⇒ no `.next/types` regen needed (still run the gate).

## Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 3.8 AC, FR-17/18), `prd.md` §4.7, `ARCHITECTURE-SPINE.md` (AD-1/AD-3/AD-4/AD-7/AD-9, NFR-3), `EXPERIENCE.md` (Таблиця = default in `GROUP_STAGE`+, read-only, 1–4 hint, empty/pre-draw states), `DESIGN.md` / UX-DR5 (Standings table — semantics, `tabular-nums`, no zebra, blue 1–4, scroll container), `3-1-…md` (`orderStandings` / `computeStandings` contracts), `3-2-group-stage-schema.md` (`getStandings`, its `[]` and zero-row cases, the `sets.length > 0` filter), `3-5-match-scheduling.md` (the deferred tab work this story closes; `GROUP_NOT_DRAWN`), `3-6-enter-match-result.md` (`revalidateMatchSurfaces`), `2-9-public-tournament-page-teams-tab.md` (`resolveTournament`, `public-*` component precedent).

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.8: Публічна турнірна таблиця] — user story + AC; FR-17, FR-18
- [Source: _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md#4.7] — FR-17 (columns, tiebreak chain, recompute), FR-18 (public, no sign-in)
- [Source: …/ARCHITECTURE-SPINE.md#AD-1, #AD-3, #AD-4, #AD-7, #AD-9] · [PRD NFR-3]
- [Source: …/ux-designs/…/EXPERIENCE.md#Information Architecture] — `?tab=standings` default in `GROUP_STAGE`+
- [Source: …/ux-designs/…/EXPERIENCE.md#Interaction Primitives — Standings table] — read-only, revalidate-on-reload, 1–4 hint
- [Source: …/ux-designs/…/EXPERIENCE.md#States and Empty States] — "команди з нулями + рядок «Результатів поки немає»"; "Групу буде сформовано після жеребкування"
- [Source: …/ux-designs/…/DESIGN.md#Components — Standings table] · [#Components — `standings-row-qualifying.marker` = primary] — blue bold 1–4, `tabular-nums`, no zebra, `#F1F1EF` divider · [UX-DR5]
- [Source: _bmad-output/implementation-artifacts/3-2-group-stage-schema.md] — `getStandings` return, `[]` / zero-row cases, `sets.length > 0` filter
- [Source: _bmad-output/implementation-artifacts/3-5-match-scheduling.md#Review Findings] — the deferred «Таблиця» chip / tab-order / default-tab work this story owns
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — "four-tab-chip row is inline JSX" (Story 2.9) → resolved here

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (bmad-dev-story)

### Debug Log References

### Completion Notes List

- Task 1: `getStandings` → `Promise<StandingsView[]>` (`StandingsView = OrderedStandingsRow & { teamName }`), the final `.map` attaches `teamNames[entryId]`. Additive — every `.row.*` / `.needsManualSeed` caller unaffected.
- Task 2: `tournament-tabs.tsx` — `TABS` reordered to `standings · schedule · teams · playoff` (DESIGN §176); `showStandings` prop + its filter removed; `normalizeTournamentTab` → `TournamentTabKey | null`.
- Task 3: `standings-table.tsx` (NEW, server, zero imports) — `overflow-x-auto role="region" aria-label`, `<table>` + `sr-only <caption>`, `<th scope="col">` with `<abbr title>` for the terse stat headers, `<th scope="row">` for the team name, `tabular-nums text-center`, no zebra, `border-b`. 1–4 → `font-bold text-primary` + `title` + `sr-only`; `needsManualSeed` → `*`. Legend line + a `!hasResults` "Результатів поки немає." row.
- Task 4: `classic/[tournament]/page.tsx` — `defaultTab = state === "DRAFT" ? "teams" : "standings"`; `activeTab = normalizeTournamentTab(tab) ?? defaultTab`; `showStandings` local + reassignment removed; `standings` panel fetches `getStandings`, shapes rows (`position`, `qualifies: index < 4`), renders `<StandingsTable>` or `GROUP_NOT_DRAWN`.
- Task 5: `verify-group-stage-schema.mts` — +3 assertions that `getStandings` rows carry the right `teamName` (3-way-cycle order + clear-winner). Green.
- Task 6: `src/data/README.md` (`StandingsView`), `src/components/README.md` (`tournament-tabs` order + `standings-table` entry), `AGENTS.md` (Stack bullet), `deferred-work.md` (Story 3.8 section + two 3.5/3.6-era items marked resolved).
- Task 7: `pnpm build` / `typecheck` / `lint` / `test` 135/135 clean (no new Vitest — `orderStandings`/`computeStandings` already covered). All 13 verify scripts green. `standings-table.tsx` imports nothing; no Prisma-client import in any `.tsx`.
- Review fixes (9 patches): (1) `standings-table.tsx` a11y — `tabIndex={0}` on the scroll region, `sr-only` explanation beside the `needsManualSeed` `*`, `aria-label` full-word name on each stat `<th>`; (2) `Очки` spelled in full (no `<abbr>`), `№` header/cells `text-center`; (3) `export const PLAYOFF_QUALIFIERS = 4` added to `src/domain/tiebreak.ts`, `qualifies = index < PLAYOFF_QUALIFIERS && standings.length > PLAYOFF_QUALIFIERS` (a 4-team group no longer paints every row), legend renders only when a row qualifies; (4) `NO_RESULTS` repurposed to `"Результатів поки немає."` and consumed by the inline row (was a never-used near-duplicate); (5) `StandingsTable` owns its pre-draw empty state (`rows: []` → `<EmptyState {...GROUP_NOT_DRAWN} />`), page no longer branches; (6) region `aria-label` parameterised with `tournamentName` for the archive reuse; (7) rows keyed on `entryId` (added to the view type), not `position`; (8) one `QUALIFIES_HINT` const for `title` + `sr-only`; (9) `verify-group-stage-schema.mts` long assertion line reformatted. All gates green; `pnpm test` still 135/135; all verify scripts exit 0. 3 findings deferred (uncached `getStandings`, `#F1F1EF` divider, provisional top-4 order), 5 dismissed.

### File List

- `src/data/matches.ts` (UPDATE)
- `src/components/tournament-tabs.tsx` (UPDATE)
- `src/components/standings-table.tsx` (NEW)
- `src/app/classic/[tournament]/page.tsx` (UPDATE)
- `src/domain/tiebreak.ts` (UPDATE — review: `PLAYOFF_QUALIFIERS` const)
- `src/lib/empty-states.ts` (UPDATE — review: `NO_RESULTS` repurposed)
- `scripts/verify-group-stage-schema.mts` (UPDATE)
- `src/data/README.md` · `src/components/README.md` (UPDATE)
- `AGENTS.md` (UPDATE)
- `_bmad-output/implementation-artifacts/deferred-work.md` (UPDATE)

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-07 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
| 2026-09-07 | Implementation complete (`bmad-dev-story`) — all 8 tasks done. `pnpm build`/`typecheck`/`lint` clean, `pnpm test` 135/135 (no new Vitest), `verify-group-stage-schema.mts` (+3 `teamName` assertions) + all 13 verify scripts pass. Closes the 3.5-review tab work (chip un-hidden, order restored, state-aware default). Status: review. |
| 2026-09-07 | Code review (`bmad-code-review`, 4 layers: Blind Hunter, Edge Case Hunter, Verification Gap Reviewer, Acceptance Auditor). Verification Gap found none. 9 patches applied (a11y, `Очки`/`№` alignment, `PLAYOFF_QUALIFIERS` distinction, `NO_RESULTS` dedup, component-owned empty state, parameterised region label, `entryId` keys, hint const, script line length), 3 deferred, 5 dismissed. All gates green; `pnpm test` 135/135; all verify scripts exit 0. Status: done. |

