---
baseline_commit: 7d4950c
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - _bmad-output/specs/spec-cherkasy-volley/glossary.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/implementation-artifacts/2-1-tournament-team-player-schema.md
  - _bmad-output/implementation-artifacts/2-7-enroll-remove-team.md
  - _bmad-output/implementation-artifacts/2-8-roster-players.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - AGENTS.md
---

# Story 2.9: Public tournament page & Teams tab

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a глядач (visitor, no account),
I want to open a tournament's public page and see its participating teams and rosters,
so that I know who is playing (FR-25).

## Acceptance Criteria

Translated from `epics.md` → Epic 2 → Story 2.9. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** a tournament in state `GROUP_STAGE` or later
**When** a visitor opens `/classic/[tournament]` without signing in
**Then**

1. The page shows the tournament's name, a `StatusBadge` for its state, and tab-chips (Команди active; Розклад/Таблиця/Плейоф — stubs at this stage).
2. The "Команди" tab lists the tournament's entered teams; clicking a team leads to `/classic/[tournament]/teams/[team]`, which shows that team's roster.
3. A tournament in state `DRAFT` returns 404 for a non-admin — both in the listing (`/classic`) and via a direct link.

### Notes on AC interpretation

- **First public data reads in the codebase.** No `src/data` function has ever filtered for a public (non-admin) audience before this story — `getTournamentForAdmin`'s own doc comment says as much ("the public list query ... lives in its own function"; it didn't exist until now). New: `getPublicTournament(id)` / `listPublicTournaments()` (`src/data/tournaments.ts`), both filtering `state != DRAFT` **and** `discipline = CLASSIC` together (AD-7 + AD-9 — the same two-filter discipline `createTournament` already hardcodes on the write side).
- **`/classic` must actually list real tournaments now.** Today `src/app/classic/page.tsx` unconditionally renders `NO_TOURNAMENTS` regardless of what's in the database (a Story 1.8 stub — no query exists at all). AC 3's "не показуються... ні в переліку" is only a testable claim once the listing performs a real query, so this story wires `/classic` to `listPublicTournaments()`: non-empty → a list of tournament names (year, type, `StatusBadge`) each linking to `/classic/[tournament]`; empty → the existing `NO_TOURNAMENTS` empty state, unchanged.
- **DRAFT admin-preview exception — a real, deliberate feature, not an oversight.** Both `epics.md`'s own AC and `EXPERIENCE.md`'s State Patterns table say "404 для **не-адміна**" (not "for everyone") — the same specific phrasing, independently, in two authoritative planning docs. Interpreted literally: a signed-in admin can preview their own `DRAFT` tournament's public page (useful while setting one up, before the draw makes it real); everyone else gets 404. **How this stays AD-7-compliant:** `getPublicTournament`/`listPublicTournaments` (`src/data`) stay pure and role-blind — they always filter `state != DRAFT`, no exception, satisfying AD-7's letter ("Server Components read directly through `src/data/` without a role check... each public query filters `state != DRAFT`"). The fallback lives one layer up, in the **page** (`src/app/classic/[tournament]/page.tsx`, itself a Server Component under `src/app/**`): if `getPublicTournament` returns `null`, call `getSessionUser()` (`src/auth/requireAdmin.ts` — read-only, doesn't throw); if `user?.isAdmin`, fall back to the existing admin-only `getTournamentForAdmin(id)` to render the draft preview; otherwise `notFound()`. This `view → auth` edge is already sanctioned — `AGENTS.md`'s own lint note says "Lint блокує `src/components/**` від `@/auth`, але не `src/app/**`" — `/admin/layout.tsx` already does exactly this for its own gate. The team-roster page (Task 6) gets the identical fallback, since a `DRAFT` tournament's admin very plausibly already enrolled teams and added rosters (enrollment itself requires `DRAFT`, per Story 2.7) and would want to preview those too.
- **The roster page's data function is visibility-agnostic by design, mirroring `getEntryForAdmin`.** `getEntryByTeam(tournamentId, teamId)` (new, `src/data/entries.ts`) scopes strictly by the `(tournamentId, teamId)` pair — same "never look up by the child id alone" discipline `getEntryForAdmin`/`deleteEntry` already established (Story 2.7/2.8) — but does **not** filter tournament state or discipline itself. The **page** decides visibility first (public via `getPublicTournament`, or admin fallback via `getTournamentForAdmin`, exactly as above) and only calls `getEntryByTeam` once that's settled — the same "scoping ≠ visibility" separation `getEntryForAdmin` already models for the admin side. This avoids a second near-duplicate query with its own copy of the draft/discipline filter.
- **The "Команди" tab lists team names, not inline rosters.** `epics.md`'s "перелічує заявлені команди зі складами" reads as "lists the entered teams, [each] with [a link to] their roster" — `EXPERIENCE.md`'s own IA gives rosters a dedicated route (`/classic/[tournament]/teams/[team]` — "Склад команди"), which would be redundant if the tab already showed full rosters inline. Reused as-is: `listEntriesForTournament(tournamentId)` (`src/data/entries.ts`, already exists, was admin-only by convention until now) — safe to call from the public page because it's only reached after the page has already confirmed the tournament is visible; the entries themselves carry no access-sensitive data beyond what a visible tournament already exposes.
- **The roster itself reuses `listPlayersForEntry(entryId)`** (`src/data/players.ts`, Story 2.8) — same reasoning, called only after `getEntryByTeam` has resolved a visible entry. The public roster view is a **new, separate, read-only** component/render (no edit/delete affordances, no `ConfirmDialog`) — the admin `Roster`/`PlayerRow` components (Story 2.8) are not reused, since every one of their interactive bits assumes an admin session. Optional-field labels come from the shared `PLAYER_OPTIONAL_FIELDS` (`src/lib/player-labels.ts`, extracted during Story 2.8's own code review) — reused here as the module was built precisely to be shared.
- **No slug — `[tournament]` and `[team]` are raw `cuid`s.** Resolves the open item `deferred-work.md` carried since the 2-1 review ("No public URL identifier ... Story 2.9 decides if a slug is worth it"): **no.** Neither SPEC nor the epics AC asks for a pretty URL, and a slug needs its own schema migration this story doesn't otherwise require. Same identifier style used everywhere else in the app (`/admin/tournaments/[id]`, etc.).
- **Розклад/Таблиця/Плейоф tabs are inert placeholders, not a reusable `TabChip` component yet.** Their underlying features (`GroupSlot`/`Match`/`SetScore`, the standings/schedule/bracket reads) don't exist until Epic 3/4 — building a generic, reusable tab-switching component now, for one real tab out of four, is premature abstraction. This story renders four `span`/styled chips inline in the page (`tab-chip`/`tab-chip-active` tokens from `DESIGN.md`) — "Команди" is the only clickable/active one, the other three are visually present but non-interactive (no `href`, `aria-disabled`). `EXPERIENCE.md`'s `?tab=` shallow-routing and "Плейоф hidden until `PLAYOFF`+" behavior become relevant once a second tab has real content — deferred to whichever Epic 3 story adds it, which is the natural point to extract a shared component.
- **A signed-in-but-non-admin visitor is treated exactly like an anonymous one.** Nothing in the AC or `EXPERIENCE.md` grants a plain signed-in user (there is no such role beyond "has an `account` row" — Story 1.7) any extra visibility; only `user.isAdmin` unlocks the draft-preview fallback.

## Tasks / Subtasks

- [x] **Task 1 — `src/data/tournaments.ts` (UPDATE): `getPublicTournament`, `listPublicTournaments`** (AC: 1, 3)
  - [x] `getPublicTournament(id: string)` — `findFirst({ where: { id, state: { not: "DRAFT" }, discipline: "CLASSIC" } })`. `null` when not found, `DRAFT`, or `BEACH`.
  - [x] `listPublicTournaments()` — `findMany({ where: { state: { not: "DRAFT" }, discipline: "CLASSIC" }, orderBy: [{ year: "desc" }, { name: "asc" }] })`, same field selection shape as `listTournamentsForAdmin` minus `discipline` (always `CLASSIC` here).
  - [x] Doc comments state plainly these are the sole public (role-blind) tournament reads — AD-7.
  - [x] `typecheck`/`lint` clean.
- [x] **Task 2 — `src/data/entries.ts` (UPDATE): `getEntryByTeam`** (AC: 2)
  - [x] `getEntryByTeam(tournamentId: string, teamId: string)` — `findFirst({ where: { tournamentId, teamId }, select: { id: true, team: { select: { id: true, name: true } } } })`. Scoped by both ids together (never `teamId` alone) — the same discipline as `getEntryForAdmin`/`deleteEntry`. **No state/discipline filter** — visibility is the caller's job (see Notes on AC interpretation).
  - [x] Doc comment states explicitly it is visibility-agnostic and why (mirrors `getEntryForAdmin`).
  - [x] `typecheck`/`lint` clean.
- [x] **Task 3 — `src/components/status-badge.tsx` (NEW)** (AC: 1)
  - [x] `StatusBadge({ state }: { state: TournamentState })` — `TournamentState` type from `@/domain/tournamentState` (sanctioned type-only `view → domain` import, Story 2.4 precedent). Ukrainian text from that module's existing `LABELS`.
  - [x] Visual variant per `DESIGN.md`'s `status-badge` token + Colors section: `DRAFT` → gray fill (only ever rendered via the admin-preview fallback, never to a visitor); `GROUP_STAGE`/`PLAYOFF` → blue outline; `COMPLETED` → `#6B6B70` outline. Pill shape (`rounded-full`), `caption`-size text (`text-xs`).
  - [x] `typecheck`/`lint` clean.
- [x] **Task 4 — `src/components/public-roster.tsx` (NEW)** (AC: 2)
  - [x] `PublicRoster({ players })` — read-only. One entry per player: `fullName` + only the non-null optional fields (same filter logic as the admin `PlayerRow`, but no edit/delete affordances at all). Labels from `@/lib/player-labels`'s `PLAYER_OPTIONAL_FIELDS`.
  - [x] Empty roster → a plain line, not `EmptyState` (a team with zero players mid-setup is an admin data-quality concern, not a "nothing here yet" product surface a visitor needs guided out of — matches `EXPERIENCE.md`'s "Порожньо" rows, none of which name this case).
  - [x] `typecheck`/`lint` clean.
- [x] **Task 5 — `src/app/classic/[tournament]/page.tsx` (NEW)** (AC: 1, 2, 3)
  - [x] Server Component. `getPublicTournament(id)` → if `null`: `getSessionUser()` → if `user?.isAdmin`, `getTournamentForAdmin(id)` as the fallback tournament; else `undefined`. If still nothing → `notFound()`.
  - [x] Renders: back-link to `/classic`, tournament `name`, `<StatusBadge state={tournament.state} />`, the four inert/active tab-chips (Task above), then the "Команди" panel: `listEntriesForTournament(id)` → non-empty: a list of team names each `<Link href="/classic/${id}/teams/${entry.teamId}">`; empty: `<EmptyState {...NO_TEAMS} />`.
  - [x] `generateMetadata` — dynamic, `getPublicTournament(id)` for the `<title>` (a second small query; no auth-timing hazard here unlike the admin page, since this route has no layout-level redirect gate to race). Fallback title if not found (the page itself still 404s via the admin-preview logic above).
  - [x] `pnpm build` before `pnpm typecheck` (new nested route, the `.next/types` caveat carried since Story 2.4). Route table confirms `/classic/[tournament]` as `ƒ`.
- [x] **Task 6 — `src/app/classic/[tournament]/teams/[team]/page.tsx` (NEW)** (AC: 2)
  - [x] Server Component. Same visibility resolution as Task 5 (`getPublicTournament(tournamentId)` → admin-preview fallback → `notFound()` if neither), then `getEntryByTeam(tournamentId, teamId)` → `notFound()` if `null` (team never entered this tournament, or a stale/foreign id).
  - [x] `listPlayersForEntry(entry.id)` → `<PublicRoster players={...} />`.
  - [x] Back-link to `/classic/[tournament]`, `<h1>{entry.team.name}</h1>`.
  - [x] `generateMetadata` — team name in `<title>`.
  - [x] `pnpm build` before `pnpm typecheck` (second new nested route this story). Route table confirms `/classic/[tournament]/teams/[team]` as `ƒ`.
- [x] **Task 7 — `src/app/classic/page.tsx` (UPDATE): real listing**
  - [x] Replace the unconditional `<EmptyState {...NO_TOURNAMENTS} />` with `listPublicTournaments()` → empty: unchanged `NO_TOURNAMENTS`; non-empty: a list, each row → name, year, type label (`TOURNAMENT_TYPE_LABELS`, `@/lib/tournament-labels`), `<StatusBadge>`, linking to `/classic/[tournament]`.
  - [x] `typecheck`/`lint` clean.
- [x] **Task 8 — Docs**
  - [x] `src/data/README.md` — `tournaments.ts` gains `getPublicTournament`/`listPublicTournaments` (first public reads — update the module's opening "two query flavours" note to point at real examples instead of the forward-looking placeholder text); `entries.ts` gains `getEntryByTeam`.
  - [x] `src/components/README.md` — `status-badge.tsx` and `public-roster.tsx` entries.
  - [x] `AGENTS.md` — Stack-status bullet for Story 2.9.
  - [x] No `ARCHITECTURE-SPINE.md` edit needed — AD-7's public-read pattern is followed exactly as written, not extended; the admin-preview fallback is view-layer composition already permitted by the existing lint boundary, not a new invariant.
- [x] **Task 9 — `deferred-work.md` (UPDATE)**
  - [x] Resolve the 2-1-review "No public URL identifier" item: decided no slug (see Notes on AC interpretation) — mark resolved, don't delete the history.
  - [x] New "Story 2.9 implementation" section: no automated test for the two new pages' admin-preview branch (needs the same session-mock infra every action-layer test lacks); `status-badge.tsx`/`public-roster.tsx` untested at the component layer; the four-tab-chip row is inline JSX, not a component — revisit when Epic 3 gives a second tab real content; `getPublicTournament`/`listPublicTournaments`/`getEntryByTeam` have no automated test beyond the new verify script (Task 10) + a **real, OAuth-free browser walkthrough**, since the public flow needs no sign-in at all.
- [x] **Task 10 — Verification gate** (AC: all)
  - [x] `pnpm test` (unchanged — this story adds no `src/domain` module, the first since Story 2.1: 5 files, 68/68) · `pnpm typecheck` · `pnpm lint` · `pnpm build` clean.
  - [x] Route table — `/classic/[tournament]` and `/classic/[tournament]/teams/[team]` (both NEW, `ƒ`) added; rest unchanged.
  - [x] Import-boundary greps: no new Prisma import site outside `src/data/**`; confirmed `src/components/status-badge.tsx`/`public-roster.tsx` don't import `@/auth` — exactly the two new `src/app/classic/**` pages carry that edge, matching the sanctioned scope.
  - [x] `scripts/verify-public-tournament.mts` (NEW, self-cleaning) — 12/12 checks passed: `getPublicTournament`/`listPublicTournaments` see the `GROUP_STAGE` tournament and hide the `DRAFT` one; `getEntryByTeam` finds a real entered team, returns `null` for a never-entered team, returns `null` for a real `teamId` paired with the *wrong* tournament (the Story 2.7/2.8 cross-scoping lesson, applied a third time), and is confirmed visibility-agnostic (still finds the `DRAFT` tournament's own entry when asked directly).
  - [x] Re-ran all five prior verify scripts (`verify-tournament-create.mts`, `verify-tournament-edit-delete.mts`, `verify-team-create.mts`, `verify-team-enrollment.mts`, `verify-roster.mts`) — 13/13, 15/15, 5/5, 12/12, 19/19, no regression.
  - [x] **Real browser walkthrough — finally not blocked by the missing OAuth automation.** Seeded a live `GROUP_STAGE` tournament (2 teams — one with 2 players including one minimal-fields player, one empty) and a `DRAFT` tournament via a throwaway script, then browsed live in Chrome: `/classic` correctly lists only the `GROUP_STAGE` tournament with its `StatusBadge`; `/classic/[tournament]` shows name/badge/tab-chips/Команди list; both team roster pages render correctly (full player with all 6 fields, minimal player with none shown, empty-roster placeholder). **Admin-preview fallback confirmed live**: the browser's existing signed-in admin session rendered the `DRAFT` tournament's page normally (badge "Чернетка", no 404) instead of 404ing. **Anonymous-visitor path confirmed via a cookie-less `curl`**: the identical `DRAFT` URL returned `HTTP 404`, the `GROUP_STAGE` URL returned `HTTP 200` — proving both AC-3 branches (admin preview vs. non-admin 404) without touching the browser's real session. All seeded data cleaned up afterward via a throwaway script (not committed).
  - [x] Real command output + notes captured in the Dev Agent Record.
- [x] **Task 11 — Commit(s)** — one commit + `git push origin main` per completed task. `build` gated each.

## Dev Notes

### What this story is / is NOT

**Is:** the first public, sign-in-free dynamic routes in the app — a tournament's page (name, `StatusBadge`, inert tab-chips, the "Команди" list) and a team's read-only roster page — plus the `/classic` listing finally doing a real query instead of a permanent stub. First public `src/data` reads (AD-7). A narrow, sanctioned `view → auth` edge (`getSessionUser()` in two `src/app/**` pages) implementing the admin draft-preview exception both `epics.md` and `EXPERIENCE.md` explicitly call for.

**Is NOT** (do not pull forward):
- **Групи/Таблиці, Розклад, Плейоф tabs with real content** — Epic 3/4. This story renders them as inert placeholders only.
- **A reusable `TabChip`/tournament-tabs component** — premature with one real tab; inline JSX for now.
- **Match results, standings, schedule, or any `Match`/`SetScore`/`GroupSlot` data** — none of it exists yet.
- **A URL slug for tournaments/teams** — decided against (see Notes on AC interpretation); still raw `cuid`s.
- **Any admin-only affordance on the public pages** (edit/delete, "Заявити команду", etc.) — even when an admin is previewing a `DRAFT` tournament via the fallback, the page renders identically to what a visitor would eventually see; it does not sprout admin controls. That preview mode's only job is to defeat `notFound()`, nothing else.

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/data/tournaments.ts` | UPDATE | + `getPublicTournament(id)`, `listPublicTournaments()`. |
| `src/data/entries.ts` | UPDATE | + `getEntryByTeam(tournamentId, teamId)`. |
| `src/components/status-badge.tsx` | NEW | Ukrainian state label + DESIGN.md variant styling. |
| `src/components/public-roster.tsx` | NEW | Read-only player list, no admin affordances. |
| `src/app/classic/[tournament]/page.tsx` | NEW | Tournament page: name, badge, tabs, Команди panel. |
| `src/app/classic/[tournament]/teams/[team]/page.tsx` | NEW | Team roster page. |
| `src/app/classic/page.tsx` | UPDATE | Real `listPublicTournaments()` query, was a permanent stub. |
| `scripts/verify-public-tournament.mts` | NEW | Self-cleaning DB round-trip for the two new public reads. |
| `src/{data,components}/README.md` · `AGENTS.md` · `deferred-work.md` | UPDATE | Module entries, Stack status, resolve the slug open item, new deferred section. |
| `prisma/schema.prisma` | DO NOT TOUCH | No new fields, no slug column — decided against this story. |
| `src/components/roster.tsx`, `player-form.tsx` (admin) | DO NOT TOUCH | The public roster is a **separate** component (`public-roster.tsx`), not a reuse-with-a-flag of the admin one — every admin affordance in those assumes a session. |
| `src/actions/**` | DO NOT TOUCH | This story adds no mutation — everything here is a read. |

### Architecture compliance

- **AD-1 / layers** — `status-badge.tsx`/`public-roster.tsx`/the two new pages are View; `getPublicTournament`/`listPublicTournaments`/`getEntryByTeam` are Data. No new Shell (Server Action) or Domain code this story. [ARCHITECTURE-SPINE.md#Design Paradigm]
- **AD-3 — dependency direction, with one new sanctioned edge.** `view → data` (both new pages read directly, no role check — AD-7's own described shape for public Server Components) and, **new this story**, `view → auth`: `src/app/classic/[tournament]/page.tsx` and `.../teams/[team]/page.tsx` call `getSessionUser()` (read-only, never throws) to decide the draft-preview fallback. This is not a new invariant — `AGENTS.md`'s existing lint note already scopes the `@/auth` block to `src/components/**` only, leaving `src/app/**` free, and `/admin/layout.tsx` already exercises the identical edge for its own gate. `status-badge.tsx`/`public-roster.tsx` (View, but under `src/components/**`) import only `@/domain/tournamentState`'s `TournamentState` type and `LABELS` (the existing sanctioned type/const `view → domain` edge, Story 2.4) and `@/lib/player-labels` — never `@/auth`, never Prisma.
- **AD-7 — public reads filter `state != DRAFT`, no role check, at the data layer.** `getPublicTournament`/`listPublicTournaments` do this unconditionally — the admin-preview exception is entirely a page-level fallback to a **different, already-existing admin function** (`getTournamentForAdmin`), never a parameter or branch inside the public functions themselves. [ARCHITECTURE-SPINE.md#AD-7]
- **AD-9 — `discipline` filtered to `CLASSIC`.** Both new public tournament reads hardcode `discipline: "CLASSIC"`, same as `createTournament`'s write-side hardcode. [ARCHITECTURE-SPINE.md#AD-9]
- **AD-11 — `src/data` is the sole Prisma owner.** All three new reads live in `src/data/tournaments.ts`/`entries.ts`; nothing in `src/app/classic/**` or `src/components/**` imports Prisma. [ARCHITECTURE-SPINE.md#AD-11]
- **EXPERIENCE.md** — `?tab=` shallow-routing and the "Плейоф hidden until PLAYOFF+" rule are **not yet implemented** (inert placeholders only, see Notes on AC interpretation) — a documented, scoped deviation, not an oversight. §State Patterns "Чернетка (глядач) — 404" row is the source of the admin-preview exception this story implements. §Voice — plain factual copy, no exclamation marks. [EXPERIENCE.md#Component Patterns, #State Patterns]
- **DESIGN.md** — `status-badge` token (pill, `caption` size) and `tab-chip`/`tab-chip-active` tokens (pill with outline, active = foreground-color outline, not a fill) — the first two DESIGN.md domain components this codebase builds (`standings-row-qualifying`, `bracket-pair` are still Epic 3/4). [DESIGN.md#Components]

### Existing code being modified — current state → change → what must be preserved

**`src/app/classic/page.tsx`** (Story 1.8 stub)
- *Current:* `SectionShell` wrapping an unconditional `<EmptyState {...NO_TOURNAMENTS} />` — no query, no data dependency at all.
- *Change:* add `listPublicTournaments()`; branch on its length.
- *Must preserve:* the `NO_TOURNAMENTS` empty state exactly as-is for the genuinely-empty case; the `SectionShell`/`CLASSIC.label` title wiring from Story 1.8.

**`src/data/tournaments.ts`** (Story 2.4/2.5, admin-only until now)
- *Current:* `getTournamentForAdmin`, `setTournamentState`, `createTournamentRecord`, `listTournamentsForAdmin`, `updateTournamentRecord`, `deleteTournamentRecord`, `TOURNAMENT_NATURAL_KEY_INDEX` — every function here is admin-flavored (drafts included, no role check itself, called only from admin-gated call sites by convention).
- *Change:* add the two public functions alongside, don't touch anything existing.
- *Must preserve:* `setTournamentState` as the sole `state` writer (AD-8) — this story writes nothing.

**`src/data/entries.ts`** (Story 2.7, code-review-fixed in 2.7 and 2.8's own review)
- *Current:* `listEntriesForTournament`, `countTournamentEntries`, `getEntryForAdmin(tournamentId, entryId)`, `createEntry`, `deleteEntry(tournamentId, entryId)`, `TOURNAMENT_ENTRY_NATURAL_KEY_INDEX`.
- *Change:* add `getEntryByTeam(tournamentId, teamId)` — same file, same scoping discipline, keyed by `teamId` instead of `entryId` since that's what the public URL carries.
- *Must preserve:* every existing function verbatim; `listEntriesForTournament` in particular gets a **new caller** (the public tournament page) but no code change.

### Testing requirements

- **No new `src/domain` module** — first story since 2.1 with nothing to unit-test with Vitest. `pnpm test`'s file/case count is unchanged from Story 2.8 (5 files, 68 tests).
- **`scripts/verify-public-tournament.mts`** (NEW) — the real correctness check for the two new data functions: `DRAFT` invisibility, `GROUP_STAGE`+ visibility, `getEntryByTeam`'s cross-tournament scoping (the by-now-standard regression shape from Story 2.7/2.8, applied a third time).
- **A genuine browser walkthrough is possible and expected for the core (non-admin) flow** — everything this story ships needs no Google sign-in, unlike every prior admin-touching story. Only the admin-preview fallback branch keeps the usual "manual signed-in pass, not automated" caveat.
- **Regression:** `pnpm typecheck`/`lint`/`build` clean, route table (`/classic/[tournament]` + `/classic/[tournament]/teams/[team]` new `ƒ`, rest unchanged), all five prior verify scripts re-run unchanged.

### Previous story intelligence

**Story 2.8 (done, code-reviewed):** `getEntryForAdmin`'s "scope by both ids together, never the child id alone" discipline is the direct model for this story's `getEntryByTeam` — same shape, keyed by `teamId` instead of `entryId`. Story 2.8's own code review also produced `src/lib/player-labels.ts` (`PLAYER_OPTIONAL_FIELDS`) specifically so a future component wouldn't have to re-duplicate the six field labels — this story's `public-roster.tsx` is exactly that future consumer. Also reused: `listPlayersForEntry(entryId)` as-is.

**Story 2.7 (done, code-reviewed):** the "cross-tournament scoping must be tested with a *second real tournament*, not just a second entry in the same one" lesson (Blind Hunter + Verification Gap Reviewer both flagged this gap when Story 2.8 first applied the pattern) — `verify-public-tournament.mts` must include a genuine two-tournament cross-scoping check for `getEntryByTeam`, not a same-tournament-only one.

**Story 2.4 (done):** the sanctioned `view → domain` type/const import (`TournamentState`, `LABELS` from `@/domain/tournamentState`) — `status-badge.tsx` uses the identical pattern `tournament-form.tsx` established for its enum option lists.

**Story 1.8 (done):** `/classic/page.tsx`'s `SectionShell` + `CLASSIC` constant + `NO_TOURNAMENTS` wiring — this story's only change there is what fills the space between them.

### Git intelligence

Recent: `7d4950c` (2.8 code-review complete) ← `24c48a9` (2.8 fix pass) ← `6da7706` (2.8 findings) ← `0d9cd1e` (2.8 → review) ← `080d3f8` (2.8 Task 10). `src/data/tournaments.ts` has no public (role-blind) read function yet. `src/data/entries.ts` has no `teamId`-keyed lookup yet. `src/components/` has no `status-badge.tsx`, no `public-roster.tsx`. `src/app/classic/` has only `page.tsx` (the stub) — no `[tournament]/` subdirectory at all yet.

### Latest tech information

- No new library. Same async `params`/`PageProps<...>` convention as every prior dynamic route; same `generateMetadata` shape Next 16 already uses elsewhere in this repo (`/admin/tournaments/[id]/entries/[entryId]/page.tsx` uses a static `metadata` object instead only because of the auth-timing hazard that doesn't apply here).
- **Two new nested dynamic routes this story** — `PageProps<"/classic/[tournament]">` and `PageProps<"/classic/[tournament]/teams/[team]">` both need `.next/types`, which only exists after a `next build` (or `next dev`) run — the Story 2.4-carried caveat, doubled up this time. Run `pnpm build` before trusting a `pnpm typecheck` failure on either route.

### Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 2.9 AC, FR-25), `glossary.md` ("Заявка команди", "Склад", "Стан турніру"), `SPEC.md` (CAP-11, the public-read capability), `ARCHITECTURE-SPINE.md` (AD-1, AD-3, AD-7, AD-9, AD-11), `EXPERIENCE.md` (Information Architecture's `/classic/[tournament]` + `/classic/[tournament]/teams/[team]` routes, the State Patterns "Чернетка (глядач) — 404" row, Voice), `DESIGN.md` (`status-badge`, `tab-chip` tokens), `2-1-tournament-team-player-schema.md` (`Player`/`TournamentEntry` schema this story only reads), `2-7-enroll-remove-team.md` / `2-8-roster-players.md` (the `(parentId, childId)`-together scoping discipline `getEntryByTeam` extends), `deferred-work.md` (the slug open item this story resolves).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.9: Публічна сторінка турніру та вкладка «Команди»] — user story + AC; FR-25
- [Source: _bmad-output/planning-artifacts/epics.md#FR-25] — "Глядач може відкрити сторінку Турніру й переглянути Команди, склади... Турніри в Стані Чернетка не показуються Глядачу (ні в переліку, ні за прямим посиланням)"
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#CAP-11] — public-read capability
- [Source: …/ARCHITECTURE-SPINE.md#AD-7, #AD-9, #AD-3, #AD-11] — public read filtering; discipline; dependency direction incl. the `src/app/** → auth` lint carve-out; sole Prisma owner
- [Source: …/EXPERIENCE.md#Information Architecture, #State Patterns, #Component Patterns] — the `/classic/[tournament]` and `.../teams/[team]` routes; the "404 для не-адміна" row; tab-chip `?tab=` behavior (not yet implemented, see Notes)
- [Source: …/DESIGN.md#Components] — `status-badge`, `tab-chip`/`tab-chip-active` tokens
- [Source: _bmad-output/implementation-artifacts/2-7-enroll-remove-team.md, 2-8-roster-players.md] — the `(parentId, childId)`-together scoping lesson and its cross-*tournament* (not just cross-entry) testing requirement
- [Source: src/app/classic/page.tsx · src/data/tournaments.ts · src/data/entries.ts · src/auth/requireAdmin.ts · src/domain/tournamentState.ts] — the exact code this story extends

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

**Task 5/6 — resolved the AD-7 vs. epics.md/EXPERIENCE.md tension at implementation time exactly as the Notes on AC interpretation planned.** Both new pages call `getPublicTournament` first, then fall back to `getSessionUser()` + `getTournamentForAdmin` only if `user?.isAdmin` — no changes needed to the plan during implementation; the design held up.

**Task 10 — live browser verification of both `DRAFT`-visibility branches without disturbing the real Google session.** The Chrome profile used for this session already had a signed-in admin session (from earlier OAuth verification work). Rather than sign it out to test the anonymous path (an intrusive action against the user's real account), verified the anonymous branch with a cookie-less `curl` instead: `GET /classic/<draftId>` → `404`, `GET /classic/<groupStageId>` → `200`. The admin-preview branch was verified directly in that same signed-in Chrome session — the `DRAFT` tournament's page rendered normally (badge "Чернетка") instead of 404ing. Both AC-3 branches confirmed without touching the user's real session state. Seed/cleanup used two throwaway `scripts/_tmp-*.mts` files, deleted after use — never committed.

**Task 10 — story's own Dev Notes overstated one precedent.** The story predicted `verify-tournament-edit-delete.mts` already used `setTournamentState` to force a non-`DRAFT` state for test setup; it doesn't (checked — that script never touches `state`). `verify-public-tournament.mts` calls `setTournamentState` directly instead, which is simply the correct existing function for this — no issue, just noting the prediction didn't hold.

### Completion Notes List

- **Task 1:** `src/data/tournaments.ts` (UPDATE) — `getPublicTournament(id)`, `listPublicTournaments()`, both filtering `state != DRAFT` and `discipline = CLASSIC` unconditionally (AD-7/AD-9). First public reads in the codebase.
- **Task 2:** `src/data/entries.ts` (UPDATE) — `getEntryByTeam(tournamentId, teamId)`, scoped by both ids together, visibility-agnostic by design (mirrors `getEntryForAdmin`).
- **Task 3:** `src/components/status-badge.tsx` (NEW) — `StatusBadge({ state })`, `LABELS` from `@/domain/tournamentState`, `DESIGN.md`-matched variants.
- **Task 4:** `src/components/public-roster.tsx` (NEW) — read-only player list, shares `PLAYER_OPTIONAL_FIELDS` with the admin `roster.tsx`.
- **Task 5:** `/classic/[tournament]/page.tsx` (NEW) — the tournament page; admin-preview fallback via `getSessionUser()`.
- **Task 6:** `/classic/[tournament]/teams/[team]/page.tsx` (NEW) — the team roster page; same fallback.
- **Task 7:** `/classic/page.tsx` (UPDATE) — replaced the permanent `NO_TOURNAMENTS` stub with a real `listPublicTournaments()` query.
- **Task 8:** README updates in `src/{data,components}` + `AGENTS.md`.
- **Task 9:** `deferred-work.md` — resolved the 2-1-review slug item (no); new "Story 2.9 implementation" section (4 items).
- **Task 10:** `pnpm test` 5/5 files (68/68, unchanged) · `typecheck` · `lint` · `build` (2 new routes, `ƒ`) — all clean. New `scripts/verify-public-tournament.mts`: 12/12 live. All six verify scripts re-run together: 13/13 + 15/15 + 5/5 + 12/12 + 19/19 + 12/12, no regression. **First real, unblocked browser walkthrough this session** — see Debug Log.

### File List

**New**
- `src/components/status-badge.tsx`
- `src/components/public-roster.tsx`
- `src/app/classic/[tournament]/page.tsx`
- `src/app/classic/[tournament]/teams/[team]/page.tsx`
- `scripts/verify-public-tournament.mts`

**Modified**
- `src/data/tournaments.ts` — `getPublicTournament`, `listPublicTournaments` added
- `src/data/entries.ts` — `getEntryByTeam` added
- `src/app/classic/page.tsx` — real `listPublicTournaments()` query, replacing the permanent stub
- `src/data/README.md` · `src/components/README.md` · `AGENTS.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-05 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
| 2026-09-05 | Task 1 — `src/data/tournaments.ts`: `getPublicTournament`, `listPublicTournaments`. `bmad-dev-story`. |
| 2026-09-05 | Task 2 — `src/data/entries.ts`: `getEntryByTeam(tournamentId, teamId)`. |
| 2026-09-05 | Task 3 — `status-badge.tsx`. |
| 2026-09-05 | Task 4 — `public-roster.tsx`. |
| 2026-09-05 | Task 5 — `/classic/[tournament]/page.tsx`: name, badge, tab-chips, Команди panel, admin-preview fallback. |
| 2026-09-05 | Task 6 — `/classic/[tournament]/teams/[team]/page.tsx`: read-only roster page. |
| 2026-09-05 | Task 7 — `/classic/page.tsx`: real `listPublicTournaments()` listing, replacing the permanent stub. |
| 2026-09-05 | Task 8 — README + `AGENTS.md` updates. |
| 2026-09-05 | Task 9 — `deferred-work.md`: resolved the slug open item, new "Story 2.9 implementation" section. |
| 2026-09-05 | Task 10/11 — verification gate green; new `scripts/verify-public-tournament.mts` (12/12). All six verify scripts re-run together, no regression. First real, OAuth-free browser walkthrough this session — both AC-3 branches (admin preview, anonymous 404) confirmed live. Status → review. |
