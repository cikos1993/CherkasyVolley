# `src/components` — shared view primitives

Presentational and interaction building blocks. No `@/data`, no `@/auth` (use
`@/lib/auth-client`). Two sanctioned upward edges: a component may call its
Server Actions (`@/actions` — `admin-role-controls.tsx`, `tournament-form.tsx`,
`tournament-actions.tsx`), and it may read pure constants / types from
`@/domain` (`tournament-form.tsx`
takes the enum value lists and the numeric bounds from `@/domain/tournamentForm`
so the form and the server validator cannot drift). No business computation in
the view — scores, standings and transitions are decided in `src/domain` /
`src/actions`. shadcn/base-nova primitives live in `ui/`.

## `notify` (`@/lib/notify`)

The single entry point for toasts. **Import `notify`, never `sonner`'s `toast`
directly** — the only exceptions are `ui/sonner.tsx` (the `<Toaster>`) and
`flash-toaster.tsx` (needs the `id` option to de-dupe the URL-param toast).

- `notify.success(message)` — short confirmation. Renders on the success token
  (`#1F8A54` background, white text).
- `notify.warning(message)` — a completed action that needs the user's
  attention (Story 4.2: the playoff was formed, but the top-4 order relied on a
  name tiebreak). Amber background + `TriangleAlertIcon` (`ui/sonner.tsx`'s
  `classNames.warning` — there is no `--warning` design token yet).
- `notify.error(message)` — a failed action. Renders on the destructive token
  (`#C4342B` background, white text). The wiring is `toastOptions.classNames` in
  `ui/sonner.tsx`, not sonner's `richColors` (which paints from its own palette,
  off-token).

**Form contract:** when a Server Action returns `{ ok: false }`, raise
`notify.error(res.message)` and **leave the form fields as the user typed them** —
never reset on failure.

## `ConfirmDialog` (`@/components/confirm-dialog`)

Gate for destructive or irreversible actions. Wraps `ui/dialog`.

```tsx
<ConfirmDialog
  trigger={<Button variant="destructive">Видалити</Button>}
  title="Видалити результат матчу?"
  description="Таблиця перерахується."
  confirmLabel="Видалити"
  destructive
  onConfirm={deleteResult}
/>
```

- `onConfirm` resolves (returns anything but `false`) → the dialog closes.
- `onConfirm` returns `false` → the dialog stays open, nothing is logged. Use it
  for a handled failure the caller has already surfaced: `notify.error(res.message);
  return false;`.
- `onConfirm` throws → the dialog stays open and the error is `console.error`d —
  for an *unexpected* exception, not a normal `{ ok: false }` outcome.
- The whole dialog (both buttons, Esc, backdrop, close X) is locked while
  `onConfirm` is in flight; a long-running action must impose its own timeout.
- On a `destructive` dialog, initial focus is on Cancel.
- `description` is required — every confirmation states what will happen.

## `EmptyState` (`@/components/empty-state`) + `@/lib/empty-states`

Dashed-border block: `description`, optional `title` (omit it for a plain
one-liner, matching the calmest empty states), optional `action` (an admin CTA),
optional `headingLevel` (`2` default, `3` for nested sections so heading order
stays correct — only applies when there is a `title`). Canonical copy lives in
`@/lib/empty-states` — `description` carries the authoritative sentence from the
UX Voice guide; spread it: `<EmptyState {...NO_TOURNAMENTS} />`.

## `Skeleton` / `TableSkeleton` / `CardSkeleton`

`ui/skeleton` is the primitive; `skeletons.tsx` has the table / card shapes.
Loading states use these — **never a full-page spinner**. Each composite is a
`role="status" aria-busy` region with an `aria-label` (default "Завантаження").
For it to be announced, keep the region mounted and swap what's *inside* it, so
the change from skeleton to content is a content change on a live region:

```tsx
<div role="status" aria-busy={pending}>
  {pending ? <TableSkeleton rows={6} columns={5} /> : <StandingsTable … />}
</div>
```

Counts are clamped (0–50). The consumer owns any `overflow-x-auto` scroll
container around a `TableSkeleton`.

## Motion

Under `prefers-reduced-motion` the dialog's scale/fade transition and the
backdrop blur are dropped (see `app/globals.css`). The Skeleton pulse and the
small in-button spinner are functional low-motion affordances and stay.

## No native dialogs

`alert()` / `confirm()` / `prompt()` are ESLint errors (`no-alert`). Use
`ConfirmDialog` or a toast.

## `tournament-form.tsx`

The create/edit tournament form (`mode: "create" | "edit"`, default `"create"`).
`useActionState(action, {})` over a `<form action={formAction}>`, where `action`
is `createTournament` in create mode or `updateTournament.bind(null, tournamentId)`
in edit mode. Fields: `type` / `scoringPreset` are native `<select>` (2–4 static
options — lighter than the base-ui popover and `FormData`-native); the rest are
`ui/input`. The domain module supplies the option lists and the `min` / `max`
bounds; `src/lib/tournament-labels` supplies the Ukrainian option text.

**Form-reset workaround (UX-DR11):** React 19 clears an uncontrolled
`<form action>` on submit. The planned fix — the action echoing values back and
each control reading `defaultValue` from them — does not work here: `@base-ui/react`'s
`Input` rejects a `defaultValue` that changes after mount (logs an error and
ignores it). The form is **fully controlled** instead (a local `useState` with
`value` / `onChange` on every field, seeded from the `initial` prop in edit mode
or `initialValues()` in create mode); React never clears controlled state, so a
rejected submit keeps the user's input with no echo needed. Per-field errors
come back in `state.fieldErrors` (wired to the control via `aria-invalid` /
`aria-describedby`); a whole-form error (`state.formError` — auth, duplicate
name) fires `notify.error`, keyed on the whole `state` object so two identical
error strings in a row both toast.

**Edit mode** additionally takes `tournamentId`, `initial` (a `FormValues`
seed), `locked` (a `TournamentField[]` — the fields to render `disabled`, with a
caption; `[id]/page.tsx` passes `["teamCount", "rounds"]` outside `DRAFT`, and
all six fields when `COMPLETED`), and `lockedHint` (the caption text; defaults
to "Змінити можна лише в стані «Чернетка».", overridden to a "Турнір завершено"
line when `COMPLETED`). When **every** editable field is locked the submit
button is not rendered at all — the server (`updateTournament`) also refuses a
`COMPLETED` edit, so there is nothing to submit. There is no `redirect` on success
(edits stay on the same page), so success is detected by tracking the falling
edge of `pending` (a `useRef`, not `state`'s identity) in a **second** effect
kept separate from the `formError` one: on a clean completion it fires
`notify.success` and `router.refresh()`. The caller (`[id]/page.tsx`) also keys
the component on `tournament.updatedAt.getTime()` so a successful save (which
bumps `updatedAt` and revalidates the page) remounts the form with the
server-canonical — e.g. trimmed — values instead of leaving stale local state.

## `team-form.tsx`

The add-team form — one controlled field (`name`), the same UX-DR11 rationale
as `tournament-form.tsx` but simpler (a single `useState<string>`, not a
`FormValues` record). No redirect on success; instead a second effect, keyed
off the falling edge of `pending` (a `useRef`, never fires on mount — the same
technique as `tournament-form.tsx`'s edit-mode success effect), clears the
field, fires `notify.success`, and calls `router.refresh()` so the list below
picks up the newly revalidated data.

## `team-actions.tsx`

`DeleteTeamButton({ teamId, teamName })` — a per-row destructive action on
`/admin/teams`, the `DeleteTournamentButton` shape: a `ConfirmDialog`
(`destructive`) around `deleteTeam`. On `!ok` it `notify.error`s the message
(«Команда бере участь у турнірі — спершу зніміть її заявку.» when the team is
enrolled) and keeps the dialog effectively resolved; on success `notify.success`
+ `router.refresh()`.

## `tournament-actions.tsx`

`DeleteTournamentButton({ tournamentId })` — a `ConfirmDialog` wrapping
`deleteTournament`, same shape as `RevokeAdminButton` (`admin-role-controls.tsx`):
a thrown/rejected call or `{ ok: false }` toasts the error and returns `false`
(dialog stays open); success toasts and `router.push("/admin/tournaments")`.

`DrawTournamentButton({ tournamentId, state, entryCount, teamCount })` (Story
3.3) — `useTransition` + a direct call to `drawTournament`, the
`team-enrollment.tsx` `enroll()` shape (not `useActionState` — a single-action
button, not a form): success toasts and `router.refresh()`; `{ ok: false }` or
a thrown/rejected call toasts the error. No `ConfirmDialog` — "провести
жеребкування" isn't in `EXPERIENCE.md`'s closed list of actions requiring one.
Disabled + captioned via `checkTransition(state, "GROUP_STAGE", { entryCount,
teamCount })` (`src/domain/tournamentState`) computed client-side — the same
`view → domain` edge `team-enrollment.tsx`'s `checkCanEnroll` already uses,
applied here to reuse the transition's own precondition instead of a second
implementation of it. **The caller must only render this component while
`state === "DRAFT"`** (review fix — `/admin/tournaments/[id]/page.tsx` gates
the whole "Жеребкування" section on it): once a tournament has been drawn,
`checkTransition(state, "GROUP_STAGE", ...)` is checking an edge that no
longer exists (`GROUP_STAGE`/`PLAYOFF`/`COMPLETED` can't go "back" to
`GROUP_STAGE`), so its message becomes a confusing, self-referential
`INVALID_TRANSITION` string rather than a real explanation.

`RedrawTournamentButton({ tournamentId, state, hasResults })` (Story 3.4) —
unlike `DrawTournamentButton`, wrapped in a `ConfirmDialog` (`DeleteTournamentButton`'s
exact shape: `onConfirm` returns `false`/throws to keep the dialog open on a
handled/unexpected failure; success toasts and calls `router.refresh()`, not
`router.push`, since this stays on the same page). The story's own AC text
names confirmation explicitly ("тисну «Пережеребкувати» **й підтверджую**"),
unlike the draw button, where confirmation was deliberately skipped. Disabled
trigger + caption via `checkCanRedraw(state, hasResults)` (`src/domain/redraw`)
— the caller must only render this while `state === "GROUP_STAGE"`
(`/admin/tournaments/[id]/page.tsx` gates it, mirroring the draw section's
`DRAFT` gate); once a result exists the button stays visible but disabled
(PRD FR-12: "заблоковане", not "зникає").

`FormPlayoffButton({ tournamentId, state, allGroupMatchesPlayed })` (Story 4.2)
— the `DrawTournamentButton` twin for the `GROUP_STAGE → PLAYOFF` edge: same
`useTransition` + direct `formPlayoff` call, **no `ConfirmDialog`** (the UX
groups «Сформувати плейоф» with the draw, not with the confirmed actions).
Client gate `checkTransition(state, "PLAYOFF", { allGroupMatchesPlayed })`; the
`PRECONDITION_FAILED` caption is overridden to the UX wording «Доступно коли
всі матчі груп зіграно». On success: `notify.success("Плейоф сформовано")` and,
when the action returns `needsManualSeed`, a `notify.warning` that some seed
was settled by team name. `router.refresh()` runs on every outcome (`finally`)
— the section vanishes on success, a stale precondition is corrected on a
failed race. Rendered only while `state === "GROUP_STAGE"` (the page gates it,
alongside the redraw section).

`FinishTournamentButton({ tournamentId, state, finalAndThirdPlacePlayed })`
(Story 4.5) — `RedrawTournamentButton`'s shape (`ConfirmDialog`, `destructive`)
crossed with `FormPlayoffButton`'s `checkTransition`-driven disabled + caption.
Calls `transitionTournament(tournamentId, "COMPLETED")` — the first real caller
of that action. Client gate `checkTransition(state, "COMPLETED",
{ finalAndThirdPlacePlayed })`; `PRECONDITION_FAILED` caption → «Доступно коли
зіграно фінал і матч за 3-тє місце». Dialog copy «Завершити турнір? Після цього
результати редагувати не можна.» Rendered only while `state === "PLAYOFF"`.

## `team-enrollment.tsx`

`TeamEnrollment({ tournamentId, state, teamCount, entries, availableTeams })`
— the "Команди" section on `/admin/tournaments/[id]` (Story 2.7). Two halves:

- **Enroll** — a native `<select>` of `availableTeams` + a `Button`
  ("Заявити"), `useTransition` + a direct call to `enrollTeam` (the
  `GrantAdminButton` pattern — no `useActionState`, since a single-value
  picker isn't a multi-field form). Disabled via
  `checkCanEnroll(state, entries.length, teamCount)` — called client-side
  purely for the UI hint; the server re-checks independently. Derives an
  `effectiveTeamId` (falls back to the current first `availableTeams` entry)
  rather than trusting the raw `useState` value directly, so a
  `router.refresh()` that removes the selected team from the list (e.g. the
  one just enrolled) can't leave the `<select>` pointing at a nonexistent
  `<option>`.
- **Entries list** — team name + (state `"DRAFT"` only) a `ConfirmDialog`-gated
  "Зняти" button calling `removeTeamEntry`, same shape as
  `DeleteTournamentButton`. Empty list → `<EmptyState {...NO_TEAMS} />` — the
  first context in the codebase where `NO_TEAMS`'s copy ("Ще немає заявлених
  команд.") is actually the right one (`src/lib/empty-states.ts`). Each entry
  row also carries a "Склад" link to `/admin/tournaments/[id]/entries/[entryId]`
  (Story 2.8), unconditional on `state` — only "Зняти" stays `DRAFT`-gated.

## `player-form.tsx`

`PlayerForm(props)` — the roster add/edit form (Story 2.8), discriminated on
`mode: "create" | "edit"` (default `"create"`): create-mode props are just
`tournamentId`/`entryId`; edit-mode additionally requires `playerId`,
`initial` (a `FormValues` seed) and `onCancel` (fixed after a Story 2.5-review
lesson — an all-optional-props shape let a caller construct an invalid
create/edit mix behind a non-null assertion). `useActionState(action, {})`
where `action` is `addPlayer.bind(null, tournamentId, entryId)` or
`editPlayer.bind(null, tournamentId, entryId, playerId)`. Fully controlled
(`useState<FormValues>`, one `<Input>` per field, `fullName` required, the six
optional fields share `FREE_TEXT_MAX` — the `tournament-form.tsx` UX-DR11
pattern, single flat record instead of per-field `useState`). Field labels
come from `@/lib/player-labels`'s `PLAYER_OPTIONAL_FIELDS` — shared with
`roster.tsx` since the code review found the same six labels duplicated
verbatim between the two (a fix-pass patch, not part of the original story).

Two effects, following the `tournament-form.tsx`/`team-form.tsx` split:
`state.formError` → `notify.error`; a second effect keyed off the falling
edge of `pending` (a `useRef`) that on a clean completion does
mode-dependent work — edit mode toasts "Зміни збережено" and calls
`props.onCancel()`; create mode clears the form back to `emptyValues()` (via
a `submitted` ref comparison, not an unconditional reset, so in-progress
typing for the *next* player survives a slow request racing a fast one — the
pattern Story 2.7's own review found missing and is applied here from the
start) and toasts "Гравця додано" — then both call `router.refresh()`.

**Two ESLint rules new to this story**, both from this component:
`react-hooks/set-state-in-effect` forbids `setForm(emptyValues())` (even
`setForm(() => emptyValues())`) directly inside an effect — fixed by the
`submitted`-ref-comparison updater above, which *reads* prior state rather
than ignoring it. `react-hooks/refs` forbids writing to a ref during render
(an earlier draft synced `onCancelRef.current` in the component body) — fixed
by calling `props.onCancel()` directly inside the effect and adding `props`
to its dependency array (a "wasteful but correct" extra re-run, same
precedent as `team-enrollment.tsx`).

## `roster.tsx`

`Roster({ tournamentId, entryId, players })` — the player list on the roster
page (Story 2.8). A local `Player` type (not Prisma-imported, matching
`team-enrollment.tsx`'s `Entry`/`Team` precedent). `PlayerRow` renders a
player's `fullName` plus only the optional fields that are non-null
(`PLAYER_OPTIONAL_FIELDS.filter(({ name }) => player[name] != null)` — nulls
are omitted, not shown as empty; the field list is shared with
`player-form.tsx` via `@/lib/player-labels`), an "Редагувати" button, and a
`ConfirmDialog`-gated "Видалити" button calling `removePlayer` (the
`team-enrollment.tsx` remove-entry shape: `catch` → toast + `throw` on an
unexpected failure, `{ ok: false }` → toast + `return false`, success →
toast + `router.refresh()`). `editingPlayerId` (local `useState`) swaps one
row for `<PlayerForm mode="edit">` in place; a `<PlayerForm mode="create">`
is always rendered at the bottom. Empty roster → `<EmptyState {...NO_PLAYERS} />`
(`@/lib/empty-states` — a fix-pass patch; the story originally shipped a
hand-written `<p>`, bypassing this project's own empty-state convention). No
roster-size cap or dedup UI — Story 2.8's AC leaves "duplicate ПІБ allowed"
as an intentional absence.

## `status-badge.tsx`

`StatusBadge({ state })` — the first public-facing status pill (Story 2.9).
`state: TournamentState` (type-only `view → domain` import from
`@/domain/tournamentState`, the `tournament-form.tsx` precedent), text from
that module's existing `LABELS`. Visual variant per `DESIGN.md`'s
`status-badge` token: `DRAFT` → `bg-muted`/`text-muted-foreground` fill
(reachable only via the admin draft-preview fallback, never shown to a plain
visitor); `GROUP_STAGE`/`PLAYOFF` → `border-primary`/`text-primary` outline;
`COMPLETED` → `border-muted-foreground`/`text-muted-foreground` outline.
Used on `/classic` (the listing) and `/classic/[tournament]`.

## `completed-banner.tsx`

`CompletedBanner({ className? })` (Story 4.5) — a **server** component, one
canonical «Турнір завершено. Результати зафіксовано.» line in a bordered `muted`
block with `role="status"` (so assistive tech announces why the edit controls
below it are gone — EXPERIENCE State Patterns; Accessibility Floor: state never
colour-only). Rendered above the tabs on `/classic/[tournament]` and under the
`Стан:` line on `/admin/tournaments/[id]` when `state === "COMPLETED"`. One
string, one markup — no per-page copy drift.

## `public-roster.tsx`

`PublicRoster({ players })` — the read-only counterpart to the admin
`Roster`/`PlayerRow` (Story 2.8), used on the public
`/classic/[tournament]/teams/[team]` page. **Not** a reuse-with-a-flag of
the admin components — no edit/delete affordances, no `ConfirmDialog`, no
`@/actions` import, since every admin affordance there assumes a session
this page never checks for. Same non-null-optional-field filtering as
`PlayerRow`, sharing the same `PLAYER_OPTIONAL_FIELDS` labels
(`@/lib/player-labels`, extracted during Story 2.8's own code review
specifically so a future consumer like this one wouldn't re-duplicate them).
Empty roster → a plain line, not `EmptyState` — a team with zero players
mid-setup is a data-quality state, not a "nothing here yet" product surface.

## `tournament-tabs.tsx`

`TournamentTabs({ tournamentId, active, showPlayoff })` (Story 3.5; order +
always-show-standings, Story 3.8) — the `?tab=` chip nav on
`/classic/[tournament]`, a **server** component (chips are
`<Link href={`/classic/${id}?tab=${key}`}>`, so no `useSearchParams` and no
client Suspense boundary). Active chip: `border-foreground text-foreground` +
`aria-current="page"`; the rest `border-border text-muted-foreground` (DESIGN.md
`tab-chip` / `tab-chip-active`). Order **Таблиця · Розклад · Команди · Плейоф**
(DESIGN §176 / EXPERIENCE IA); the Плейоф chip is omitted (not disabled) unless
`showPlayoff` (`state ∈ {PLAYOFF, COMPLETED}`). `overflow-x-auto` container
(UX-DR14). Also exports `TournamentTabKey` and `normalizeTournamentTab(raw)`,
which returns the known key or **`null`** for an absent/unknown value — the page
then picks a state-aware default (`standings` in `GROUP_STAGE`+, `teams` for a
`DRAFT` admin-preview).

## `standings-table.tsx`

`StandingsTable({ rows, hasResults, tournamentName })` (Story 3.8; hardened in
its own review) — the public «Таблиця» tab, a **server** component (read-only
for everyone — EXPERIENCE). A local `StandingsTableRow` view type (not
data-imported — the `public-schedule.tsx` precedent); the page shapes
`getStandings`'s `StandingsView[]` into it (`entryId` key, `position`,
`qualifies: index < PLAYOFF_QUALIFIERS && standings.length > PLAYOFF_QUALIFIERS`
— the marker is a *distinction*, so a group of exactly four suppresses it).
`rows.length === 0` → `<EmptyState {...GROUP_NOT_DRAWN} />` (the component owns
its pre-draw empty state, like `PublicSchedule`). Markup per UX-DR5: an
`overflow-x-auto role="region"` container that is **`tabIndex={0}`** (keyboard
scroll) and `aria-label`ed with the tournament name (archive-page
disambiguation); a `<table>` with an `sr-only` `<caption>`; `<th scope="col">`
headers, each `aria-label`ed with the full word (`<abbr title>` for the visual,
`Очки` spelled out); `<th scope="row">` for the team name; `tabular-nums
text-center` cells incl. `№`; **no zebra**, `border-b` dividers. Qualifying
positions: `font-bold text-primary` + `title` + `sr-only` (colour is never the
only cue — UX-DR13); `needsManualSeed` → a `*` **plus** an `sr-only`
explanation. The legend `<p>` renders only when there is a qualifier and/or a
manual-seed row. `hasResults === false` → a `<td colSpan={8}>` row with
`NO_RESULTS.description` (team rows still render with zeros — EXPERIENCE).
Reused verbatim by the archive route (Story 4.7).

## `match-schedule.tsx`

`MatchScheduleList({ tournamentId, matches, locked? })` (Story 3.5; `locked`
since Story 4.5) — the admin editor on
`/admin/tournaments/[id]/schedule`. A local `MatchRow` view model (not
Prisma-imported — the `team-enrollment.tsx` precedent), shaped server-side. Each
row is a `MatchScheduleRow` with its own hooks: a header line (teams + a
`·`-joined meta line: `scheduledAtDisplay ?? "час не визначено"`, venue, result
tally) and an always-visible `<form action={formAction}>` (a `datetime-local`
`Input`, a `venueText` `Input` with `maxLength={VENUE_TEXT_MAX}`, a "Зберегти"
`Button`). `useActionState(scheduleMatch.bind(null, tournamentId, match.id), {})`;
fully controlled inputs (`useState`, the `player-form.tsx` UX-DR11 pattern — the
base-ui `Input` only rejects a *changed `defaultValue`*, a `value` is fine).
Field errors under the field (`aria-invalid`/`aria-describedby`); `formError` →
`notify.error`; a second effect on the falling edge of `pending` (a `useRef`) →
`notify.success("Розклад оновлено")` + `router.refresh()`. When `locked` (the
tournament is `COMPLETED`), the schedule `<form>` is dropped from every row and
a muted "Турнір завершено — розклад зафіксовано." line heads the list; the
`<Link>` to the match screen stays (viewing the recorded result is fine, and
that screen is itself locked).

## `playoff-schedule.tsx`

`PlayoffSchedule({ tournamentId, slots })` (Story 4.3) — a **server** component,
read-only. The four playoff slots (semifinal 1/2, third-place, final) from
`getPlayoffBracket`'s `PlayoffBracketView`. Each row: the label + either
`{home} — {away}` or «очікує суперників» (muted, when a participant is `null`);
a link to the match screen only when `matchId` is non-null — «Результат: X:Y»
with a `CheckIcon` on the success token, else «Внести результат». Rendered on
the admin schedule page in the `PLAYOFF`/`COMPLETED` states.

## `playoff-placements.tsx`

`PlayoffPlacements({ teamNames })` (Story 4.4) — a **server** component,
read-only. `teamNames` is the four places in order; a `null` entry renders
«— (матч не зіграно)» (muted). The ordinal label (owned by the component:
«1-е / 2-е / 3-тє / 4-е місце») is the cue, not colour; the `TrophyIcon` on
1st is decorative (`aria-hidden`, `text-primary`). `<ol aria-label>`. Reused
verbatim by both the admin schedule page and the public «Плейоф» tab (Story 4.6),
each passing `getPlayoffBracket().placements` team names, rendered under «Місця»
once at least one place is decided.

## `bracket.tsx`

`Bracket({ pairs })` (Story 4.6) — a **server** component, read-only: the public
playoff bracket on `/classic/[tournament]?tab=playoff`, wrapped in a
`<section aria-label="Сітка плейофа">`. `pairs` is a `BracketPairVM[]` (`slot`,
`status: "AWAITING" | "READY" | "PLAYED"`, `homeTeam`/`awayTeam: string | null`,
`score: string | null`) — the page maps `getPlayoffBracket()`'s
`PlayoffBracketView` (a trivial per-pair copy; `src/components` may not import
`@/data`). Slot labels come from `src/lib/playoff-labels.ts`
(`PLAYOFF_SLOT_LABELS`), shared with the admin schedule section. An `AWAITING`
pair renders the `bracket-pair-tbd` state (white card, `border-dashed`, «очікує
суперників» — dashed border + text, never colour alone); a `READY`/`PLAYED` pair
renders `bg-muted rounded-md`, teams left (`min-w-0 break-words`), `score` right
(`tabular-nums shrink-0`, omitted when `null`). Layout `grid sm:grid-cols-2` —
semifinals left, final + third-place right (matched by slot, not array order);
single stacked column below 640px. No winner emphasis (the score and the
`PlayoffPlacements` list below carry the outcome). `#B0B0B4` (DESIGN's TBD colour)
has no token — `border-border` / `text-muted-foreground` approximate it, the
`standings-table.tsx` precedent.

## `public-schedule.tsx`

`PublicSchedule({ matches })` (Story 3.5) — the read-only «Розклад» tab list, the
`public-roster.tsx` precedent (no `@/actions`, no form, no session assumption).
Each row: teams, the result tally (right, `tabular-nums`) if present, and a muted
line with `scheduledAtDisplay ?? "час не визначено"` + venue. Empty list → a
plain muted line, not `EmptyState` (a drawn tournament always has matches — the
empty case is a should-not-happen edge, same treatment as `public-roster.tsx`'s
zero-players line).

## `match-result-form.tsx`

`MatchResultForm(props)` (Story 3.6; `mode: "create" | "edit"` added Story 3.7)
— the Score input (UX-DR8) on `/admin/tournaments/[id]/matches/[matchId]`.
Discriminated-union props (the `player-form.tsx` shape): `edit` adds
`initialSets` + `onCancel`, binds `editMatchResult` instead of `enterMatchResult`,
seeds rows from `initialSets`, labels the submit "Зберегти зміни" + shows a
"Скасувати" button, and on a clean save toasts "Зміни збережено" and calls
`props.onCancel()`. Everything else (per-set target, live tally, add/remove-set,
`aria-label`s, `Object.keys(state).length === 0` success, toast-only `formError`)
is identical across modes.
`useActionState(enterMatchResult.bind(null, tournamentId, matchId), {})`; fully
controlled (`useState<Row[]>` seeded with 3 empty rows). `CUSTOM` → the 3 rows
are fixed; `CLASSIC` → "Додати партію" appends up to 5, "Прибрати партію" drops a
trailing empty row. Each row is two `inputMode="numeric"` `tabular-nums` inputs
(`home-N` / `away-N`) with an `aria-label` naming the team + set. The live
"X : Y" tally is `matchSetSummary` (`@/domain/scoring`) over the rows whose both
halves parse as non-negative integers — visibly labelled "(рахується
автоматично)", never an input. `state.setErrors[N]` renders under set N (both
inputs get `aria-invalid` / `aria-describedby`); `state.formError` renders above
the submit button and `notify.error`s. Falling-edge-of-`pending` success effect
(the `player-form.tsx` `useRef` technique) → `notify.success` +
`router.refresh()` (the page re-renders read-only). Submit `disabled` + spinner
while pending (EXPERIENCE — synchronous edit, no optimistic UI). A `lockedReason`
prop (Story 4.5) replaces the whole form with that muted line — the match page
passes it when the tournament is `COMPLETED` (also for the semifinal-edit gate,
via `MatchResultPanel`).

The `match-schedule.tsx` row (Story 3.5) gained a `<Link>` to this screen —
«Внести результат» when no result, else a `text-success` `CheckIcon` + «Результат:
X:Y».

## `match-result-panel.tsx`

`MatchResultPanel({ tournamentId, matchId, preset, tournamentType, homeTeam,
awayTeam, sets, lockedReason? })` (Story 3.7) — the match screen's view **when a
result exists**, the `roster.tsx` in-place-edit precedent. Local `editing`
`useState`: `false` → the read-only set list + `matchSetSummary` tally, an
"Виправити" `Button` (toggles `editing`), and a `ConfirmDialog`-gated "Видалити
результат" (`destructive`; "Видалити результат матчу? Таблиця перерахується."; the
`roster.tsx` `remove()` shape — `catch → toast + throw`, `{ ok: false } → toast +
return false`, success → toast + `router.refresh()`). `true` →
`<MatchResultForm mode="edit" initialSets={sets} onCancel={() => setEditing(false)} … />`.
When `lockedReason` is set (Story 4.4 — a semifinal whose downstream match is
already played, `checkCanEditSemifinalResult`), both buttons render **disabled**
with the reason as a muted caption and the edit form is not reachable; the
server actions still enforce it. The page renders this for `match.sets.length > 0`,
else the create-mode form.
