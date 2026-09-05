---
baseline_commit: b23c270
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/implementation-artifacts/2-8-roster-players.md
  - _bmad-output/implementation-artifacts/2-9-public-tournament-page-teams-tab.md
  - _bmad-output/implementation-artifacts/3-2-group-stage-schema.md
  - _bmad-output/implementation-artifacts/3-3-draw.md
  - _bmad-output/implementation-artifacts/3-4-redraw.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - AGENTS.md
---

# Story 3.5: Розклад матчів

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an адмін,
I want проставити дату, час і зал кожному матчу,
so that учасники й глядачі знають, коли і де гра (FR-13, FR-14).

## Acceptance Criteria

Translated from `epics.md` → Epic 3 → Story 3.5. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** a generated calendar (the tournament has been drawn — `GROUP`-stage `Match` rows exist)
**When** I set a match's date, time and place (free text)
**Then**

1. The changes are saved and **do not affect a result that is already entered** for that match.
2. A match with no date/time is shown to a visitor as «час не визначено».
3. The «Розклад» tab shows both teams, the date, time, place, and the result (if any), and is reachable **without signing in**.

PRD §4.5 (`prd.md`, cited in context) makes the same three consequences explicit and adds precision:

- FR-13: "Адмін може задати **й змінити** дату, час і місце проведення (вільний текст) **будь-якого Матчу**." — set *and* re-set; any match, not only unplayed ones.
- FR-13 consequence: "Зміна дати/часу/місця не впливає на **Результат матчу, якщо він уже внесений**." — the scheduling write must never touch `SetScore`.
- FR-14: "Глядач може переглянути розклад Турніру — **за Групою і в хронологічному порядку**." — v1 has exactly one `Group`, so "за Групою" is trivial; "хронологічно" = ordered by `scheduledAt`.
- FR-14 consequence: "Розклад показує **обидві Заявки команд, дату, час, місце і Результат матчу (якщо є)**. Доступно без входу."

## Notes on AC interpretation

- **No schema change. `Match.scheduledAt` (`DateTime? @db.Timestamptz(3)`) and `Match.venueText` (`String?`) already exist** — added in Story 3.2's migration ahead of this story, exactly for it (see `3-2-group-stage-schema.md` and the `Match` model's doc comment in `schema.prisma`). This story only wires reads, a write, an action, and UI. **`prisma/schema.prisma` must not be touched.**

- **`scheduledAt` is one nullable field — date and time together, all-or-nothing.** AC 2 / FR-13's consequence is phrased "матч без **дати/часу**" (no date **or** time) → a single `datetime-local` input, optional. Empty input → `scheduledAt = null` → the visitor sees «час не визначено». There is no "date set but time unknown" partial state (nothing in the AC/PRD/EXPERIENCE asks for one, and `Match` has no separate date column).

- **Timezone: the admin enters Europe/Kyiv wall-clock time; storage is UTC (`Timestamptz`); display is Europe/Kyiv.** This is the project-wide rule (AGENTS.md "Conventions", NFR-2: "часовий пояс відображення — київський"). This story is the **first surface in the codebase that shows a date/time to a user or takes one as input**, so it owns the conversion helpers. An HTML `datetime-local` value is a bare wall-clock string (`"2026-06-13T11:00"`) with no zone — interpreting it as Kyiv and converting to a UTC `Date` needs Kyiv's UTC offset **at that date** (EET/UTC+2 in winter, EEST/UTC+3 in summer). **No timezone library** (NFR-4 "мінімум зовнішніх залежностей") — compute the offset from `Intl.DateTimeFormat` with `timeZone: "Europe/Kyiv"`. The conversion is genuine domain logic with real correctness stakes (a wrong offset shows every match an hour off; a wrong DST-boundary result is worse) → it lives in `src/domain/matchSchedule.ts` with exhaustive Vitest coverage, alongside the display formatter and the input-value formatter (they share the offset math — one tested place, not three). `src/domain` may use the standard library, and `Intl` is standard library (see `src/domain/README.md` "May import").

- **The «Розклад» tab is the second *real* tab on `/classic/[tournament]` — this is the point to introduce `?tab=` routing.** Story 2.9 shipped the four tab chips as inert inline `<span>`s and **explicitly deferred** the `?tab=` shallow-routing + reusable tab component: _"Revisit when Epic 3 gives 'Таблиця' or 'Розклад' real content and `?tab=` shallow-routing becomes meaningful; that's also the point to implement `EXPERIENCE.md`'s 'Плейоф tab hidden until `PLAYOFF`+' rule."_ (`deferred-work.md`, Story 2.9 section; UX-DR4; EXPERIENCE.md IA `?tab=standings|schedule|teams|playoff`). This story does the minimum that satisfies that: the page reads `searchParams.tab` and renders the matching panel; a small **server** component `TournamentTabs` renders the chips as `<Link href={`/classic/${id}?tab=…`}>` (no `useSearchParams`, so no client Suspense boundary needed — the server component already has the active tab and passes it as a prop). `teams` is the default panel (unchanged content). `schedule` is the new panel. `standings` / `playoff` panels stay minimal placeholders — Story 3.8 / 4.6 own their real content; do **not** build them here. The `playoff` chip is hidden unless `state` is `PLAYOFF` or `COMPLETED` (per EXPERIENCE.md and the deferred note).

- **Admin scheduling lives on a dedicated route: `/admin/tournaments/[id]/schedule`.** EXPERIENCE.md IA line ~47 lists `розклад` among the things managed under `/admin/tournaments/[t]`; the walkthrough (line ~154) says the admin "На вкладці Розклад проставляє дату/час/зал матчам". The match list can be long (`C(teamCount, 2) × rounds` rows — 15 for the UJ-1 example, up to thousands at the input extremes), and `/admin/tournaments/[id]/page.tsx` is already four sections deep. A dedicated Server-Component route mirrors the `/admin/tournaments/[id]/entries/[entryId]` roster precedent (Story 2.8). The admin tournament page gets a "Розклад" **link** (not an inline section), rendered when `state` is `GROUP_STAGE` or later (no calendar exists before the draw). **A new nested dynamic route** — `pnpm build` must run before `pnpm typecheck` to regenerate `.next/types` for `PageProps<"/admin/tournaments/[id]/schedule">` (documented pitfall; Story 2.8 hit the identical thing).

- **No `Tournament.state` gate on the scheduling write.** FR-13 says "будь-якого Матчу" with no state qualifier, and `players.ts` (Story 2.8) set the precedent that a per-child edit action carries no `Tournament.state` restriction unless the AC names one (this AC doesn't). A `Match` cannot exist before the draw anyway (`state` is at least `GROUP_STAGE` by the time any match is schedulable), and rescheduling a group match while the tournament is in `PLAYOFF`/`COMPLETED` is harmless. The admin *entry point* (the "Розклад" link and the tab) is gated to `GROUP_STAGE`+ for sensible UX, but the action itself is not — same split as `players.ts`.

- **The scheduling write touches only `scheduledAt` / `venueText`, never `SetScore`.** AC 1 / FR-13's consequence. `SetScore` rows are a separate table with their own writer (Story 3.6) — structurally the update *can't* reach them — but `updateMatchSchedule` still selects only those two columns in its `data`, and `verify-match-schedule.mts` proves a `SetScore` on a match survives a subsequent reschedule (see Testing).

- **`updateMatchSchedule` is scoped by `(tournamentId, matchId)` together, `stage: "GROUP"`, via `updateMany` → `{ count }`** — the "never look up / write a child row by its own id alone" discipline established by `deleteEntry` (Story 2.7 fix) and carried into `players.ts` from the start (Story 2.8). A mismatched `(tournamentId, matchId)` pair updates zero rows; the action maps `count === 0` to a not-found `formError`. The `stage: "GROUP"` clause keeps this story's action from being usable against an Epic 4 playoff match.

- **Result display on the schedule tab: only when set scores exist.** AC 3 says "результат (якщо є)". No `SetScore` row can exist yet — Story 3.6 (enter result) hasn't shipped — so "нема результату" is the only real case today, and rendering nothing / a dash for it is compliant. When sets do exist, show a set-win tally ("3:1"), counted inline (`sets.filter(s => s.homePoints > s.awayPoints).length` vs the reverse). **Do not** build a shared "match result summary" helper here — Story 3.6's AC ("підсумковий рахунок у партіях («3:1») обчислюється й показується") owns that; it will refactor the inline tally into a canonical `src/domain` function then. Flagged in `deferred-work.md`.

- **Ordering: `scheduledAt` ascending, nulls last, then `createdAt` ascending as a stable tiebreak.** `Match` does not persist `round`/`tour` — Story 3.3 deliberately dropped them from the schema ("`round`/`tour` from `generateSchedule` are not stored — needed only for the correctness of the draw algorithm itself"), so the schedule cannot be grouped by tour. FR-14's "хронологічно" = by `scheduledAt`; unscheduled matches sort to the bottom in a stable `createdAt` order. Prisma 7 supports `orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }]`; if the `nulls` modifier misbehaves against the driver, fall back to a JS sort after the query (note it in the Dev Agent Record).

- **DESIGN.md's caption example "тур 4 з 5" is not reachable and not a requirement.** It appears once in DESIGN.md §Typography as an illustration of the `caption` type style, not as a schedule-tab spec. Since `round`/`tour` isn't stored, the schedule tab has no tour metadata to show. Not a gap — noted so a reviewer doesn't read the DESIGN.md line as an unmet AC.

- **Revalidation must include the public tournament route.** `deferred-work.md` (Story 2.9 / 3.4 sections) tracks that `drawTournament`/`redrawTournament` only revalidate `/classic` (the index), "becomes relevant once Story 3.5/3.8 render schedule/standings publicly." `scheduleMatch` calls `revalidatePath(`/classic/${tournamentId}`)` (the detail route) **and** `/admin/tournaments/${tournamentId}/schedule`. This story also adds the same `revalidatePath(`/classic/${tournamentId}`)` line to `drawTournament` and `redrawTournament` (`src/actions/draw.ts`) — one-line closes of that deferred item, now that a public route actually renders `Match` data.

## Tasks / Subtasks

- [x] **Task 1 — `src/domain/matchSchedule.ts` (NEW): Kyiv ↔ UTC conversion + validation** (AC: 1, 2, 3)
  - [x] `kyivOffsetMinutes(utc: Date): number` — the Europe/Kyiv UTC offset (in minutes, e.g. 120 or 180) in effect at instant `utc`, derived from `Intl.DateTimeFormat("en-US", { timeZone: "Europe/Kyiv", … }).formatToParts` (compare the zone's wall-clock reading of `utc` against `utc`'s own UTC fields). Pure; no library.
  - [x] `VENUE_TEXT_MAX = 120` (matches `NAME_MAX`; free text, `prd.md` "не керуємо довідником залів — місце проведення це вільний текст").
  - [x] `parseKyivDateTimeLocal(raw: string | null | undefined): { ok: true; value: Date | null } | { ok: false; error: string }` — `""`/nullish → `{ ok: true, value: null }`; a well-formed `datetime-local` string (`YYYY-MM-DDTHH:mm`, optionally `:ss`) interpreted as Kyiv wall-clock → the corresponding UTC `Date` (using `kyivOffsetMinutes`, iterating once if the naive guess lands on the other side of a DST change); anything else → `{ ok: false, error: "Некоректна дата або час." }`. Also rejects an impossible calendar date (Feb 30) via a rollover check.
  - [x] `formatKyivDateTime(date: Date): string` — Kyiv-local display string, `Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })`.
  - [x] `toKyivDateTimeLocalValue(date: Date): string` — the inverse of `parseKyivDateTimeLocal` for seeding the edit input: `YYYY-MM-DDTHH:mm` in Kyiv local time.
  - [x] `validateMatchSchedule(raw: { scheduledAt: RawValue; venueText: RawValue }): { ok: true; value: { scheduledAt: Date | null; venueText: string | null } } | { ok: false; fieldErrors: { scheduledAt?: string; venueText?: string } }` — runs `parseKyivDateTimeLocal`; trims `venueText`, `""` → `null`, over `VENUE_TEXT_MAX` → a field error (same "empty optional → null, not \"\"" rule as `playerForm.ts`).
  - [x] `src/domain/matchSchedule.test.ts` (Vitest): summer instant (EEST → offset 180, `"2026-07-13T11:00"` → `2026-07-13T08:00:00.000Z`), winter instant (EET → offset 120, `"2026-01-13T11:00"` → `2026-01-13T09:00:00.000Z`), values around both DST switches (incl. the re-check branch — `2026-03-29T01:00` → `2026-03-28T23:00:00.000Z`), `null`/`""` → `null`, malformed + impossible-date → error, round-trip, `venueText` trim-to-null and over-max, `formatKyivDateTime` shape. 17 new cases.
  - [x] `pnpm test` green (124/124); `typecheck`/`lint` clean.

- [x] **Task 2 — `src/data/matches.ts` (UPDATE): `listGroupMatchesForTournament` + `updateMatchSchedule`** (AC: 1, 3)
  - [x] `listGroupMatchesForTournament(tournamentId)` — every `stage: "GROUP"` match, `orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }]`, joined team names + `sets`. Visibility-agnostic (the `getEntryByTeam` contract). The `nulls: "last"` modifier typechecks and is accepted by the `prisma-client` generator.
  - [x] `updateMatchSchedule(tournamentId, matchId, input)` — `db.match.updateMany({ where: { id: matchId, tournamentId, stage: "GROUP" }, data: { scheduledAt, venueText } })` → `{ count }`. Scoped by the pair + `stage`; writes only the two scheduling columns.
  - [x] `typecheck`/`lint` clean. No new Prisma-client import site.

- [x] **Task 3 — `src/actions/matches.ts` (NEW): `scheduleMatch`** (AC: 1, 2)
  - [x] `"use server"`. `MatchScheduleFormState = { fieldErrors?: MatchScheduleFieldErrors; formError?: string }` (`MatchScheduleFieldErrors` reused from the domain module).
  - [x] `scheduleMatch(tournamentId, matchId, _prev, formData)` — narrow `requireAdmin()` catch → `getTournamentForAdmin` (falsy → `formError`) → `validateMatchSchedule` (not ok → `fieldErrors`) → `updateMatchSchedule` → `count === 0` → `formError` → `revalidatePath` (`…/schedule` **and** `/classic/${tournamentId}`) → `{}`.
  - [x] New file; form-state shape (like `players.ts`), not `ActionResult`. Data reads stay imported from `@/data` by the pages — the action file exports only the action (Next requires every `"use server"` export to be a callable action).
  - [x] `typecheck`/`lint` clean.

- [x] **Task 4 — `src/actions/draw.ts` (UPDATE): revalidate the public detail route** (AC: 3)
  - [x] Added `revalidatePath(`/classic/${tournamentId}`)` to both `drawTournament` and `redrawTournament`, with a one-line why-comment.
  - [x] `typecheck`/`lint` clean; `pnpm test` 124/124.

- [ ] **Task 5 — `src/components/match-schedule.tsx` (NEW): admin editor** (AC: 1, 2)
  - [ ] `"use client"`. `MatchScheduleList({ tournamentId, matches })` where `matches: { id: string; homeTeam: string; awayTeam: string; scheduledAtLocal: string; scheduledAtDisplay: string | null; venueText: string; resultSummary: string | null }[]` — a plain view model, shaped server-side (local `type` in the component, not Prisma-imported — the `team-enrollment.tsx` / `roster.tsx` precedent).
  - [ ] One row per match: `"{homeTeam} — {awayTeam}"`, the current schedule (`scheduledAtDisplay ?? "час не визначено"`, the `null` case in `text-muted-foreground`), result (`resultSummary ?? "—"`), and an always-visible inline form: a `datetime-local` `<input>` (seeded `scheduledAtLocal`), a text `<input name="venueText">` (seeded `venueText`, `maxLength={VENUE_TEXT_MAX}` from `@/domain/matchSchedule`), a "Зберегти" `Button`. `useActionState(scheduleMatch.bind(null, tournamentId, match.id), {})`; fully controlled inputs (`useState`, the `player-form.tsx` UX-DR11 pattern). Field errors → under the field via `aria-invalid`/`aria-describedby`; `formError` → `notify.error` (effect keyed on `state`). Falling-edge-of-`pending` success effect (the `useRef` technique, not `state` identity — `player-form.tsx`) → `notify.success("Розклад оновлено")` + `router.refresh()`.
  - [ ] Uses the native `<input type="datetime-local">` directly (not `ui/input` / base-ui — no base-ui date primitive, and `datetime-local` needs the native control); style it with the shared `selectClassName`-style utility string (copy the one from `team-enrollment.tsx` or lift it to a shared spot if the reviewer prefers).
  - [ ] `typecheck`/`lint` clean.

- [ ] **Task 6 — `src/components/public-schedule.tsx` (NEW): read-only schedule** (AC: 2, 3)
  - [ ] `PublicSchedule({ matches })` where `matches: { id: string; homeTeam: string; awayTeam: string; scheduledAtDisplay: string | null; venueText: string | null; resultSummary: string | null }[]` — the read-only counterpart to `MatchScheduleList`, the `public-roster.tsx` precedent (**not** a reuse-with-a-flag: no `@/actions` import, no form, no session assumption). Each row: teams, `scheduledAtDisplay ?? "час не визначено"` (muted for the `null` case), `venueText` if present, `resultSummary` if present. Empty list → a plain muted line ("Розклад матчів зʼявиться після жеребкування."), not `EmptyState` (a drawn `GROUP_STAGE` tournament always has matches; the empty case is a should-not-happen edge, treated like `public-roster.tsx`'s zero-players line).
  - [ ] Server component (no interactivity) — no `"use client"`.
  - [ ] `typecheck`/`lint` clean.

- [ ] **Task 7 — `src/components/tournament-tabs.tsx` (NEW): `?tab=` chip nav** (AC: 3)
  - [ ] `TournamentTabs({ tournamentId, active, showPlayoff }: { tournamentId: string; active: "teams" | "schedule" | "standings" | "playoff"; showPlayoff: boolean })` — a **server** component. Renders the chips as `<Link href={`/classic/${tournamentId}?tab=${key}`}>`; the active chip gets the `tab-chip-active` style (`border-foreground text-foreground`, DESIGN.md), the rest `tab-chip` (`border-border text-muted-foreground`). Order: `Команди` (`teams`), `Розклад` (`schedule`), `Таблиця` (`standings`), `Плейоф` (`playoff` — omitted entirely unless `showPlayoff`). Horizontal scroll container on mobile (`overflow-x-auto`, no body scroll — UX-DR14).
  - [ ] No `useSearchParams` (the page passes `active` as a prop) — so no client Suspense boundary needed.
  - [ ] `typecheck`/`lint` clean.

- [ ] **Task 8 — `src/app/classic/[tournament]/page.tsx` (UPDATE): tab routing + schedule panel** (AC: 2, 3)
  - [ ] Read `searchParams` (now needed): `const { tab } = await searchParams;` — normalize to one of `"teams" | "schedule" | "standings" | "playoff"`, default `"teams"`; an unknown value → `"teams"` (do not 404). If `tab === "playoff"` but `state` is not `PLAYOFF`/`COMPLETED` → treat as `"teams"`.
  - [ ] Replace the inline `STUB_TABS` `<span>` row with `<TournamentTabs tournamentId={id} active={activeTab} showPlayoff={tournament.state === "PLAYOFF" || tournament.state === "COMPLETED"} />`.
  - [ ] Panel switch:
    - `teams` → the existing entries list (unchanged).
    - `schedule` → `const matches = await listGroupMatchesForTournament(id);` shaped into the `PublicSchedule` view model (`formatKyivDateTime` for `scheduledAtDisplay`, inline set-win tally for `resultSummary`), then `<PublicSchedule matches={…} />`.
    - `standings` / `playoff` → a plain muted placeholder line (`"Таблиця зʼявиться в наступному оновленні."` / `"Плейоф зʼявиться в наступному оновленні."`) — Story 3.8 / 4.6 replace these. Do **not** build standings/bracket content.
  - [ ] `generateMetadata` unchanged (title is the tournament name regardless of tab).
  - [ ] After adding a new route param usage nothing regenerates types (same route, only `searchParams` added) — but run the full gate anyway.
  - [ ] `typecheck`/`lint` clean.

- [ ] **Task 9 — `src/app/admin/tournaments/[id]/schedule/page.tsx` (NEW route): admin schedule page** (AC: 1, 2)
  - [ ] Server Component. `const { id } = await params;` → `getTournamentForAdmin(id)` → `notFound()` if falsy. If `tournament.state === "DRAFT"` → render a plain "Розклад зʼявиться після жеребкування." line with a back-link to `/admin/tournaments/${id}` (not `notFound()` — the tournament exists and the admin navigated here deliberately; a friendly explanation beats a 404).
  - [ ] `const matches = await listGroupMatchesForTournament(id);` → shape into the `MatchScheduleList` view model (`toKyivDateTimeLocalValue` for `scheduledAtLocal`, `formatKyivDateTime` for `scheduledAtDisplay`, inline tally for `resultSummary`) → `<MatchScheduleList tournamentId={id} matches={…} />`.
  - [ ] Back-link to `/admin/tournaments/${id}`, `<h1>` with the tournament name, the "Розклад" heading. `export const metadata = { title: "Розклад" }` (static — same rationale as `[id]/page.tsx`'s static title: metadata resolves outside the `/admin` auth tree).
  - [ ] **New nested dynamic route** → run `pnpm build` before `pnpm typecheck` (regenerates `.next/types` for `PageProps<"/admin/tournaments/[id]/schedule">`; documented pitfall).
  - [ ] `typecheck`/`lint` clean.

- [ ] **Task 10 — `src/app/admin/tournaments/[id]/page.tsx` (UPDATE): "Розклад" link** (AC: 1)
  - [ ] Add a section (sibling to "Команди" / "Жеребкування"), rendered when `tournament.state === "GROUP_STAGE" || tournament.state === "PLAYOFF" || tournament.state === "COMPLETED"`: a heading "Розклад" + a `<Link href={`/admin/tournaments/${tournament.id}/schedule`}>` ("Керувати розкладом" or similar). No new data fetch on this page.
  - [ ] Preserve the four existing sections and their data flow verbatim.
  - [ ] `typecheck`/`lint` clean.

- [ ] **Task 11 — Docs**
  - [ ] `src/domain/README.md` — new `matchSchedule.ts` entry.
  - [ ] `src/data/README.md` — `matches.ts`'s entry gains `listGroupMatchesForTournament` / `updateMatchSchedule`.
  - [ ] `src/actions/README.md` — new `matches.ts` entry (`scheduleMatch`); note the `draw.ts` revalidation addition.
  - [ ] `src/components/README.md` — `match-schedule.tsx`, `public-schedule.tsx`, `tournament-tabs.tsx` entries.
  - [ ] `AGENTS.md` — Stack-status bullet for Story 3.5 (no schema change; `?tab=` routing introduced; first user-facing date/time surface + `src/domain/matchSchedule.ts` conversion helpers).
  - [ ] `src/lib/empty-states.ts` — only if a new const is actually used; otherwise leave it (the schedule-empty line is inline, per Task 6).

- [ ] **Task 12 — `deferred-work.md` (UPDATE)**
  - [ ] New "Story 3.5 implementation" section: (a) no action-level test for `scheduleMatch` beyond the verify script (same class as every prior action); (b) the inline set-win tally for `resultSummary` is a placeholder — Story 3.6 owns the canonical "3:1 summary" helper and should replace both call sites; (c) `standings`/`playoff` tab panels are still placeholder lines — Story 3.8 / 4.6; (d) `TournamentTabs` has no ARIA `tablist`/`tab`/`tabpanel` semantics (chips are `<Link>`s, each tab is a full server render — a real tablist would need client JS; revisit if a11y review calls for it); (e) `parseKyivDateTimeLocal`'s DST-boundary behaviour for the one ambiguous/nonexistent wall-clock hour per year is defined by the offset-iteration but not exercised by a real admin flow.
  - [ ] Mark the two carried "revalidate `/classic/[tournament]`" deferred items (Story 2.9 / 3.4 sections) as resolved by Task 4.

- [ ] **Task 13 — Verification gate** (AC: all)
  - [ ] `pnpm test` (new `matchSchedule.test.ts`) · `pnpm typecheck` · `pnpm lint` · `pnpm build` — **`build` before `typecheck`** (new route).
  - [ ] Import-boundary grep: no new Prisma-client import outside `src/data/**`; `src/domain/matchSchedule.ts` imports nothing internal / no `next` / no `react`.
  - [ ] `scripts/verify-match-schedule.mts` (NEW, self-cleaning): create a throwaway `DRAFT` 4-team tournament, enrol 4 teams, draw it (the `verify-draw.mts` pipeline) → pick one `Match` →
    - `updateMatchSchedule(tournamentId, matchId, { scheduledAt: new Date("2026-06-13T08:00:00Z"), venueText: "СК Спартак" })` → assert `count === 1`, the row now has that `scheduledAt` / `venueText`.
    - `updateMatchSchedule(<other throwaway tournament id>, matchId, …)` → assert `count === 0` and the row is unchanged (cross-tournament scoping).
    - `updateMatchSchedule(tournamentId, matchId, { scheduledAt: null, venueText: null })` → assert both cleared.
    - insert a `SetScore` on that match (`db.setScore.create`), then `updateMatchSchedule(tournamentId, matchId, { scheduledAt: <date>, venueText: "інший зал" })` → assert the `SetScore` row still exists and is byte-identical (AC 1 — reschedule does not touch results).
    - `listGroupMatchesForTournament(tournamentId)` → assert every returned row is `stage: "GROUP"`, has both team names, and rows with a `scheduledAt` sort before rows without.
    - full teardown (delete tournament — cascades group/slots/matches/sets — and teams).
  - [ ] Re-run all 11 prior verify scripts — no regression.
  - [ ] Manual signed-in pass (documented in the Dev Agent Record, no automation for the auth path — the standing gap): on `/admin/tournaments/[id]/schedule` set a date/time/venue on one match → success toast, value persists on reload; open `/classic/[id]?tab=schedule` in a private window → the scheduled match shows the Kyiv-local date/time, an unscheduled one shows «час не визначено»; the tab is reachable with no session.
  - [ ] Real command output + notes in the Dev Agent Record.

- [ ] **Task 14 — Commit(s)** — one commit + `git push origin main` per completed task (the standing instruction). `build` gates each.

## What this story is / is NOT

**Is:** a `scheduledAt` (nullable, Kyiv-wall-clock-in / UTC-stored) + `venueText` (free text) editor for `GROUP`-stage matches on a dedicated admin route; a public read-only «Розклад» tab; the first `?tab=` routing on `/classic/[tournament]`; the first Kyiv ↔ UTC conversion helpers in the codebase.

**Is NOT** (do not pull forward):
- **Any schema change.** `Match.scheduledAt` / `Match.venueText` already exist (Story 3.2). `prisma/schema.prisma` is untouched.
- **Entering / editing / deleting match results.** `SetScore` writes are Story 3.6 / 3.7. This story's write can't reach `SetScore` and must be proven not to.
- **The real «Таблиця» or «Плейоф» tab content.** Story 3.8 / 4.6. This story leaves those panels as one-line placeholders.
- **A `round`/`tour` column, or grouping the schedule by tour.** Story 3.3 dropped `round`/`tour` from the schema on purpose; the schedule is chronological only.
- **A venue directory / lookup model.** PRD §7 explicitly: "не керуємо довідником залів — місце проведення це вільний текст."
- **A canonical "match result summary (3:1)" domain helper.** Story 3.6 owns it; this story uses an inline tally and flags it.
- **Scheduling playoff (`SEMIFINAL`/`FINAL`/`THIRD_PLACE`) matches.** `updateMatchSchedule` is `stage: "GROUP"`-scoped; Epic 4 reuses the same two columns and (likely) a widened action.
- **Notifications about the schedule (email/Telegram).** PRD §8 "поза межами MVP".

## Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/domain/matchSchedule.ts` | NEW | Kyiv↔UTC conversion, display/input formatting, `validateMatchSchedule`, `VENUE_TEXT_MAX`. |
| `src/domain/matchSchedule.test.ts` | NEW | Vitest — offsets, DST, null, malformed, round-trip. |
| `src/data/matches.ts` | UPDATE | `listGroupMatchesForTournament` + `updateMatchSchedule` alongside `getStandings` / `hasAnyGroupResult`. |
| `src/actions/matches.ts` | NEW | `scheduleMatch` (`MatchScheduleFormState` shape). |
| `src/actions/draw.ts` | UPDATE | `revalidatePath(`/classic/${id}`)` added to `drawTournament` + `redrawTournament`. |
| `src/components/match-schedule.tsx` | NEW | Admin per-match inline editor. |
| `src/components/public-schedule.tsx` | NEW | Read-only public list. |
| `src/components/tournament-tabs.tsx` | NEW | `?tab=` chip nav (server component). |
| `src/app/classic/[tournament]/page.tsx` | UPDATE | `searchParams.tab`, `TournamentTabs`, schedule panel. |
| `src/app/admin/tournaments/[id]/schedule/page.tsx` | NEW | Admin schedule route. |
| `src/app/admin/tournaments/[id]/page.tsx` | UPDATE | "Розклад" link section (`GROUP_STAGE`+). |
| `scripts/verify-match-schedule.mts` | NEW | Self-cleaning DB round-trip. |
| `src/domain/README.md` · `src/data/README.md` · `src/actions/README.md` · `src/components/README.md` · `AGENTS.md` · `deferred-work.md` | UPDATE | Module entries, Stack status, new/resolved deferred items. |
| `prisma/schema.prisma` | DO NOT TOUCH | `Match.scheduledAt` / `Match.venueText` already exist (Story 3.2). |

## Architecture compliance

- **AD-1 — public pages are Server Components, all mutations are Server Actions.** The «Розклад» tab and the admin schedule page are Server Components; `scheduleMatch` is the sole write path. [ARCHITECTURE-SPINE.md#AD-1]
- **AD-3 — dependency direction.** `view → shell` (`MatchScheduleList` → `scheduleMatch`); `shell → domain` (`scheduleMatch` → `validateMatchSchedule`); `shell → data` (→ `updateMatchSchedule` / `getTournamentForAdmin`); `view → domain` for pure formatting (`page.tsx` / `schedule/page.tsx` → `formatKyivDateTime` / `toKyivDateTimeLocalValue`, the established type/const-and-pure-fn edge — same class as `status-badge.tsx` → `LABELS`); `data → domain` is **not** used here (`listGroupMatchesForTournament` does no computation). [ARCHITECTURE-SPINE.md#AD-3]
- **AD-4 — `Match` + `SetScore` are the sole source of a result; standings never stored.** Untouched — `updateMatchSchedule` writes only scheduling columns; the schedule tab's result tally is computed on read from `SetScore`, not stored. [ARCHITECTURE-SPINE.md#AD-4]
- **AD-6 — every mutation is a Server Action under `requireAdmin()`.** `scheduleMatch`'s first statement. [ARCHITECTURE-SPINE.md#AD-6]
- **AD-7 — public reads bypass the role check and filter `state != DRAFT`.** The «Розклад» tab reads through `resolveTournament` (which enforces `state != DRAFT` + `discipline = CLASSIC`, Story 2.9) before `listGroupMatchesForTournament` is ever called; the data function itself is visibility-agnostic by the `getEntryByTeam` precedent. [ARCHITECTURE-SPINE.md#AD-7]
- **AD-11 — `src/data` is the sole Prisma owner.** No new import site — `matches.ts` already imports `db`. [ARCHITECTURE-SPINE.md#AD-11]
- **Consistency Conventions** — verb-named action (`scheduleMatch`); `revalidatePath` after the write (admin route **and** public route); UA-only copy; times stored UTC, shown Europe/Kyiv (NFR-2); `datetime-local` is a native control (no `confirm()`/`alert()`; `no-alert` not triggered). [ARCHITECTURE-SPINE.md#Consistency Conventions]

## Existing code being modified — current state → change → what must be preserved

**`src/data/matches.ts`** (Story 3.2 `getStandings`, Story 3.4 `hasAnyGroupResult`)
- *Current:* two exports.
- *Change:* add `listGroupMatchesForTournament(tournamentId)` and `updateMatchSchedule(tournamentId, matchId, input)`.
- *Must preserve:* `getStandings` verbatim — including its `sets.length > 0` filter (Story 3.2's critical review fix) — and `hasAnyGroupResult`'s optional-transaction-client signature (Story 3.4's review fix). Do not touch either.

**`src/actions/draw.ts`** (Story 3.3 `drawTournament`, Story 3.4 `redrawTournament`)
- *Current:* each revalidates `"/classic"` (or `"/beach"`), the tournament admin page, and (for `draw`) `/admin/tournaments`.
- *Change:* one added `revalidatePath(`/classic/${tournamentId}`)` line in each.
- *Must preserve:* the existing revalidation lines, the `checkTransition` / `checkCanRedraw` gates, the `defaultShuffle` calls, the transaction boundaries — everything else verbatim.

**`src/app/classic/[tournament]/page.tsx`** (Story 2.9)
- *Current:* resolves the tournament, renders header + `StatusBadge` + four inert tab `<span>`s + the teams list (or `NO_TEAMS` empty state).
- *Change:* read `searchParams.tab`; swap the `<span>` row for `<TournamentTabs>`; render one of four panels by the active tab; `teams` panel is the current content unchanged.
- *Must preserve:* `resolveTournament` usage (public read → admin-preview fallback → `discipline === "CLASSIC"` re-check — the Story 2.9 review's critical fix), `generateMetadata`, the `notFound()` on a null tournament, the teams-list markup and its `NO_TEAMS` empty state.

**`src/app/admin/tournaments/[id]/page.tsx`** (Story 2.5/2.7/3.3/3.4)
- *Current:* `Promise.all` of `getTournamentForAdmin` / `listTeams` / `listEntriesForTournament` / `hasAnyGroupResult`; edit form; "Команди"; `DRAFT`-gated draw section; `GROUP_STAGE`-gated redraw section; delete button.
- *Change:* add one "Розклад" link section, gated `state` ∈ {`GROUP_STAGE`, `PLAYOFF`, `COMPLETED`}. No new data fetch.
- *Must preserve:* the `Promise.all` reads and all existing sections verbatim.

## Testing requirements

- **New `src/domain/matchSchedule.test.ts`** — the only new Vitest surface. `pnpm test`'s count grows from **107**. Cover: EEST (summer, +3) and EET (winter, +2) conversions both directions; a wall-clock value on each DST-switch Sunday; `null`/`""` → `null`; malformed input → error; `venueText` trim-to-null and over-`VENUE_TEXT_MAX`; `parseKyivDateTimeLocal` ∘ `toKyivDateTimeLocalValue` round-trips; `formatKyivDateTime` output shape (contains the day, the Ukrainian month, the year, `HH:MM`).
- **`scripts/verify-match-schedule.mts`** is the real correctness check — the first script to (a) exercise `updateMatchSchedule`'s `(tournamentId, matchId, stage)` scoping including a deliberate cross-tournament mismatch, and (b) prove a `SetScore` survives a reschedule (AC 1).
- **No component/action test** for `match-schedule.tsx` / `public-schedule.tsx` / `scheduleMatch` — the standing "no component-test toolchain / no `requireAdmin` session mock" gap (tracked since the 2-2 / 3-3 reviews). Mitigated by the verify script + `validateMatchSchedule`'s Vitest coverage + a documented manual signed-in pass.
- **Regression:** all 11 prior verify scripts re-run unchanged; `pnpm build` regenerates `.next/types` for the one new route before `pnpm typecheck`.

## Previous story intelligence

**Story 3.4 (done, code-reviewed):**
- **Gate the whole section by state, not just disable an inner control** (3.3 + 3.4 review lesson) — applied here: the admin "Розклад" link and the `schedule` tab's admin affordances key off `state`, and the `playoff` chip is omitted (not disabled) below `PLAYOFF`.
- **Revalidate every affected route, including the public one** — 3.4's review explicitly flagged that `draw`/`redraw` skip `/classic/[tournament]`; this story fixes that (Task 4) *and* makes `scheduleMatch` do it from the start.
- **A `deferred-work.md` item that names a future story as its resolver should be closed by that story** — Task 12 closes the two "revalidate `/classic/[tournament]`" items.

**Story 3.3 (done, code-reviewed):** `round`/`tour` are deliberately not persisted on `Match` — the schedule has no tour grouping to display; don't reintroduce them.

**Story 2.9 (done, code-reviewed):** the four-tab-chip row was inline and the `?tab=` routing + "Плейоф hidden until `PLAYOFF`+" rule were deferred **to this exact point** ("Epic 3 gives 'Розклад' real content"). `resolveTournament`'s public-read → admin-fallback → `discipline` re-check chain (the review's critical fix) must be preserved when the page grows panels. `public-roster.tsx` is the precedent for `public-schedule.tsx`: a separate read-only component, never the admin one with a flag.

**Story 2.8 (done, code-reviewed):** the `(parentId, childId)`-together scoping via `updateMany`/`deleteMany` → `{ count }` (`players.ts`) is the exact template for `updateMatchSchedule`. `player-form.tsx`'s controlled-inputs + two-effects (formError toast / falling-edge success) pattern is the template for `match-schedule.tsx`. Empty optional field → `null`, not `""` (`playerForm.ts`) → `venueText`.

**Story 3.1 (done, code-reviewed):** `validation.ts` shows the house shape for a pure validator returning a discriminated `{ ok: true; value } | { ok: false; … }` union with Ukrainian messages — `validateMatchSchedule` follows it.

## Git intelligence

Recent: `b23c270` (3.4 review-fix, TOCTOU close, story → done) ← `dd8302d` (3.4 findings) ← `8397d9b` (3.4 verify script) ← `16509d0`/`2ecf73b` (3.4 Tasks 6–8). `src/data/matches.ts` currently exports `getStandings` + `hasAnyGroupResult`. `src/actions/` has no `matches.ts`. `src/actions/draw.ts` revalidates `/classic` (index) only. `/classic/[tournament]/page.tsx` has inline `STUB_TABS`. No `src/domain` module and no `src/lib` file deals with dates/times yet — this story is greenfield for timezone handling.

## Latest tech information

- **No new library.** Timezone conversion uses `Intl.DateTimeFormat` (`timeZone: "Europe/Kyiv"`) — built into the Node 24 / V8 runtime, full IANA tz database. `datetime-local` is a standard HTML input.
- **Prisma 7 `orderBy` null handling:** `{ scheduledAt: { sort: "asc", nulls: "last" } }` is supported for nullable scalar fields on Postgres. If it errors against the `@prisma/adapter-pg` driver, fall back to `orderBy: { createdAt: "asc" }` in the query + a `.sort()` in the data function (scheduled first, then unscheduled) and note it.
- **Next 16 `searchParams`** is a `Promise` in `PageProps` — `const { tab } = await searchParams;`. Reading it makes the page dynamic (already is — it reads a session via `resolveTournament`).

## Project context reference

No `project-context.md` in the repo. Binding docs: `epics.md` (Story 3.5 AC, FR-13/FR-14), `prd.md` §4.5 (FR-13/FR-14 checkable consequences; §7 "no venue directory"), `ARCHITECTURE-SPINE.md` (AD-1/AD-3/AD-4/AD-6/AD-7/AD-11), `EXPERIENCE.md` (IA `?tab=schedule`, "Матч без дати/часу → «час не визначено»", admin manages `розклад` under `/admin/tournaments/[t]`, UX-DR4 tab-in-URL, UX-DR14 responsive scroll), `DESIGN.md` (`tab-chip`/`tab-chip-active` tokens), `3-2-group-stage-schema.md` (`scheduledAt`/`venueText` landed here), `3-3-draw.md` (no `round`/`tour` persisted), `2-8-roster-players.md` (`(parentId,childId)` scoping, controlled-form pattern), `2-9-public-tournament-page-teams-tab.md` (`resolveTournament`, `public-roster.tsx` precedent, the deferred `?tab=` item this story closes).

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.5: Розклад матчів] — user story + AC; FR-13, FR-14
- [Source: _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md#4.5 Розклад] — FR-13 (задати й змінити, будь-який матч, не впливає на результат), FR-14 (за групою + хронологічно, обидві команди/дата/час/місце/результат, без входу)
- [Source: _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md#7] — "не керуємо довідником залів — місце проведення це вільний текст"
- [Source: …/ARCHITECTURE-SPINE.md#AD-1, #AD-3, #AD-4, #AD-6, #AD-7, #AD-11]
- [Source: …/ux-designs/…/EXPERIENCE.md#Information Architecture] — `?tab=schedule`; admin `/admin/tournaments/[t]` manages `розклад`
- [Source: …/ux-designs/…/EXPERIENCE.md#States and Empty States] — "Матч без дати/часу → «час не визначено»"
- [Source: …/ux-designs/…/EXPERIENCE.md#Interaction Primitives / UX-DR4] — tab state in URL, shallow; Плейоф tab hidden until `PLAYOFF`+
- [Source: …/ux-designs/…/DESIGN.md#Components] — `tab-chip` / `tab-chip-active` tokens
- [Source: _bmad-output/implementation-artifacts/3-2-group-stage-schema.md] — `Match.scheduledAt` / `Match.venueText` added ahead of this story
- [Source: _bmad-output/implementation-artifacts/3-3-draw.md] — `round`/`tour` not persisted
- [Source: _bmad-output/implementation-artifacts/2-8-roster-players.md] — `(parentId, childId)` `updateMany`→`{count}` scoping; controlled-form + two-effects pattern
- [Source: _bmad-output/implementation-artifacts/2-9-public-tournament-page-teams-tab.md] — `resolveTournament`; `public-roster.tsx`; the deferred `?tab=` routing item
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — "revalidate `/classic/[tournament]`" items (Story 2.9 / 3.4); "four-tab-chip row is inline JSX" item (Story 2.9)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (bmad-dev-story)

### Debug Log References

- `Europe/Kyiv` offsets confirmed against the Node 24 runtime before writing the DST tests: EET (+120) in winter, EEST (+180) summer, transitions at 01:00 UTC on 2026-03-29 / 2026-10-25 (tzdata still carries EU DST for Kyiv).

### Completion Notes List

- Task 1: `src/domain/matchSchedule.ts` — `kyivOffsetMinutes`, `parseKyivDateTimeLocal` (naive-guess + one DST re-check, rollover guard for impossible dates), `toKyivDateTimeLocalValue`, `formatKyivDateTime`, `validateMatchSchedule`, `VENUE_TEXT_MAX`. `matchSchedule.test.ts` — 17 cases (offsets, both DST switches incl. the re-check branch, null/empty, malformed, impossible date, round-trip, venue trim/over-max, display shape). `pnpm test` 124/124; `typecheck`/`lint` clean. No timezone library — `Intl.DateTimeFormat` only.
- Task 2: `src/data/matches.ts` — `listGroupMatchesForTournament` (chronological, `nulls: "last"`, joined team names + sets) and `updateMatchSchedule` (`updateMany` scoped by `(tournamentId, matchId, stage:"GROUP")` → `{ count }`, writes only `scheduledAt`/`venueText`). `typecheck`/`lint` clean.
- Task 3: `src/actions/matches.ts` (NEW) — `scheduleMatch`, form-state shape, narrow `requireAdmin` catch, revalidates the admin schedule route and `/classic/${id}`.
- Task 4: `src/actions/draw.ts` — `drawTournament` / `redrawTournament` now also `revalidatePath(`/classic/${tournamentId}`)` (closes the carried deferred item).

### File List

- `src/domain/matchSchedule.ts` (NEW)
- `src/domain/matchSchedule.test.ts` (NEW)
- `src/data/matches.ts` (UPDATE)
- `src/actions/matches.ts` (NEW)
- `src/actions/draw.ts` (UPDATE)

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-06 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
| 2026-09-06 | Open questions resolved by the user ("роби як вважаєш"): dedicated admin route (not inline section); `?tab=` query param (not sub-routes); pre-draw admin schedule page shows a friendly line, not `notFound()`; `teamCount` min 4 is not a 3.5 concern. |
