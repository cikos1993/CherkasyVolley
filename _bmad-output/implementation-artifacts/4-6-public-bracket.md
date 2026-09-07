---
baseline_commit: 390e6c1
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/implementation-artifacts/4-1-domain-engine-bracket.md
  - _bmad-output/implementation-artifacts/4-3-auto-advance-final-third-place.md
  - _bmad-output/implementation-artifacts/4-4-playoff-results-final-placements.md
  - _bmad-output/implementation-artifacts/3-8-public-standings-table.md
  - _bmad-output/implementation-artifacts/2-9-public-tournament-page-teams-tab.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - AGENTS.md
---

# Story 4.6: Публічна сітка плейофа

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a глядач,
I want бачити сітку плейофа турніру без входу,
so that я стежу за фінальною стадією — хто з ким грає й з яким рахунком (FR-22, FR-25).

## Acceptance Criteria

Translated from `epics.md` → Epic 4 → Story 4.6. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** турнір у стані `PLAYOFF` або `COMPLETED`
**When** глядач відкриває вкладку «Плейоф» на `/classic/[tournament]?tab=playoff` без входу
**Then** показані всі пари сітки: два півфінали, матч за 3-тє місце, фінал — з рахунками (підсумок у партіях, напр. «3:1») для зіграних
**And** пара, суперники якої ще не визначені (фінал / матч за 3-тє до внесення обох результатів півфіналів; або після знятого результату півфіналу), показується як «очікує суперників» у стилі `bracket-pair-tbd` (біла картка, пунктирне обведення)
**And** вкладка «Плейоф» **не показується** глядачу, поки турнір не у стані `PLAYOFF` або далі

**Given** зіграно фінал (і, якщо є, матч за 3-тє місце)
**When** глядач дивиться вкладку «Плейоф»
**Then** він бачить фінальні місця 1–4 (обчислені з результатів, не збережені)

### FR / AD / SPEC anchors (in context)

- **FR-22** (`prd.md` §4.8): «Глядач може переглянути Плейоф-сітку Турніру без входу.» **FR-21 «Наслідки»**: «Плейоф-сітка з усіма парами й рахунками доступна Глядачу без входу.»
- **FR-25** (`prd.md` §4.10): «Глядач може відкрити сторінку Турніру й переглянути … Плейоф.» «Уся інформація Турніру в Стані Груповий етап і далі доступна без входу.»
- **AD-4 / AD-5** (`ARCHITECTURE-SPINE.md`): фінальні місця й стан сітки **не зберігаються** — обчислюються при кожному читанні; пари наступних раундів виводить **лише** `domain/bracket.ts` (`advanceBracket`), і на запис, і **на відображення перед рендером сітки**. `getPlayoffBracket` (`src/data/playoff.ts`, Story 4.3/4.4) вже робить це — воно **the shared read for the admin schedule section and Story 4.6's public bracket** (його власний docstring). Ця історія лише додає компонент і дріт до публічної сторінки.
- **AD-7** (`ARCHITECTURE-SPINE.md`): публічне читання йде повз `requireAdmin()`; кожен публічний запит турнірів фільтрує `state != DRAFT`. `resolveTournament` (`src/app/classic/_lib/resolve-tournament.ts`) вже це робить (public read → `state != DRAFT` **і** `discipline = CLASSIC`; admin-fallback лише для прев'ю чернетки).
- **UX-DR6** (`epics.md`): «Компонент Bracket — картка пари (команди зліва, рахунок справа) + стан «очікує суперників» (біла картка, пунктир, `#B0B0B4`).»
- **DESIGN.md** §Components → **Bracket pair**: «картка пари: підкладка `{colors.muted}` (`#F5F5F4`), `{rounded.md}` (10px), зліва команди, справа рахунок. Стан «очікує суперників» — біла картка з пунктирним обведенням, текст `#B0B0B4`.» §Typography: `tabular-nums` **обов'язкові** на кожній числовій клітинці (рахунки, сітка).
- **EXPERIENCE.md** §Component Patterns → **Bracket**: «тільки читання. Пара «очікує суперників» (`{components.bracket-pair-tbd}`) доки немає результатів обох півфіналів. Після внесення результату півфіналу відповідна пара фіналу/матчу за 3-тє місце заповнюється при наступному завантаженні.» §Component Patterns → **Tab chip**: «Вкладка «Плейоф» прихована, поки турнір не в стані Плейоф+.» §Responsive: «< 640px … картки сітки — стовпчиком.» §Accessibility Floor: стан ніколи не лише кольором.
- **UX-DR4**: стан вкладки в URL (`?tab=…`), «Плейоф» прихована до `PLAYOFF`+, горизонтальний скрол чипів на мобільному — **вже реалізовано** в `TournamentTabs` (Story 3.5 / 3.8).

### Notes on AC interpretation

- **Most of this is already built. Story 4.6 is one component + one tab branch.**
  - `getPlayoffBracket(tournamentId)` (`src/data/playoff.ts`) already returns `PlayoffBracketView`: `semifinals: [pair, pair]`, `thirdPlace: pair`, `final: pair`, `placements`. Each `PlayoffBracketPairView` carries `slot` (`SF1|SF2|THIRD_PLACE|FINAL`), `stage`, `status` (`AWAITING|READY|PLAYED`), `matchId`, `homeTeam` (`string | null`), `awayTeam` (`string | null`), `score` (`matchScoreLabel(sets)` — `"3:1"` or `null`), `scheduledAt`, `venueText`. It runs `advanceBracket` (AD-5) on every read and resolves team names from the `Match` FK relations. **No new data function, no widening of `getPlayoffBracket`.**
  - `TournamentTabs` (`src/components/tournament-tabs.tsx`) already **hides the «Плейоф» chip** unless `showPlayoff`, and the page already computes `showPlayoff = state === "PLAYOFF" || state === "COMPLETED"` and resets `activeTab` to the default when `"playoff"` is requested but `!showPlayoff`. **AC line 3 is already satisfied — verify, don't re-implement.**
  - `PlayoffPlacements` (`src/components/playoff-placements.tsx`, Story 4.4) is already a **generic read-only server component** — `PlayoffPlacements({ teamNames: (string | null)[] })`, renders «1-е / 2-е / 3-тє / 4-е місце — {team}» with a `<TrophyIcon>` on first and «— (матч не зіграно)» for a null. **Reuse it verbatim** for the public placements (AC line 4) — the admin schedule page (Story 4.4) already does exactly this mapping.
  - `resolveTournament` already gates visibility (public `state != DRAFT` + `CLASSIC`; admin-only draft preview). Since `showPlayoff` is `false` for `DRAFT`, `activeTab` can never be `"playoff"` for a draft-preview render — `getPlayoffBracket` is only called for a real `PLAYOFF`/`COMPLETED` tournament.

- **The new component — `src/components/bracket.tsx` (NEW).** A **server** component, read-only, the `standings-table.tsx` / `public-schedule.tsx` / `playoff-schedule.tsx` shape: takes a plain prop (a component-local VM, **not** a `@/data` import — `src/components/**` may not import `@/data`, lint-enforced), the page maps `PlayoffBracketView` → that prop. Owns its own slot labels (the `playoff-placements.tsx` precedent — the component owns the copy, the page passes only data).
  ```tsx
  export type BracketPairVM = {
    slot: "SF1" | "SF2" | "THIRD_PLACE" | "FINAL";
    homeTeam: string | null;
    awayTeam: string | null;
    score: string | null; // "3:1" for a played pair, null otherwise
  };
  export function Bracket({ pairs }: { pairs: BracketPairVM[] }) { … }
  ```
  - Slot → label (component-local): `SF1` → «Півфінал 1», `SF2` → «Півфінал 2», `THIRD_PLACE` → «Матч за 3-тє місце», `FINAL` → «Фінал».
  - **Awaiting** (`bracket-pair-tbd`) when `!homeTeam || !awayTeam`: white card (`bg-background`), `rounded-md`, `border border-dashed border-border`, text «очікує суперників» in `text-muted-foreground`. **Do not** rely on colour alone — the dashed border + the literal text «очікує суперників» carry the state (Accessibility Floor).
  - **Decided** (`bracket-pair`): `bg-muted rounded-md`, a flex row — teams on the left (`{homeTeam} — {awayTeam}`), the score on the right (`score` when non-null, `tabular-nums font-medium`; nothing when `READY`-but-unplayed).
  - Layout: `grid gap-4 sm:grid-cols-2` — left column the two semifinals, right column the final then the third-place match (final first — it is the headline). On `< 640px` the grid collapses to one column and the four cards stack in reading order SF1 · SF2 · Фінал · Матч за 3-тє (EXPERIENCE Responsive «картки сітки — стовпчиком»). No `overflow-x` container needed (cards wrap, unlike the standings table).
  - `#B0B0B4` (DESIGN's TBD text/border colour) has **no token** — approximate with `text-muted-foreground` / `border-border`, the same approximation `standings-table.tsx` made for `#F1F1EF` (a design-token pass is already a tracked `deferred-work.md` item). Note it in the component doc-comment.
  - **No winner emphasis / no bold on the winning team.** DESIGN's Bracket spec is «зліва команди, справа рахунок» only; the score («3:1», home first) already tells the reader who won, and the `<PlayoffPlacements>` list below states the ranking. Parsing the `score` string to bold a side is not worth it.
  - **No schedule line (date / venue) on the bracket cards.** `PlayoffBracketPairView` carries `scheduledAt` / `venueText`, but there is **no admin UI to set a playoff match's schedule** (the admin schedule page's editable form is group-only; `PlayoffSchedule` is read-only) — so those fields are always `null` in practice today. Adding a «час не визначено» line would be pure noise. Playoff-match scheduling is a separate gap (see "Is NOT").

- **Wiring — `src/app/classic/[tournament]/page.tsx` (UPDATE).** The page already fetches per-tab data conditionally (`entries` for `teams`, `standings` for `standings`, `matches` for `schedule`). Add:
  ```ts
  const bracket = activeTab === "playoff" ? await getPlayoffBracket(id) : null;
  ```
  Import `getPlayoffBracket` from `@/data/playoff` (the page is a Server Component — `view → data (read)` is the sanctioned edge; `standings` / `schedule` already import `@/data/matches` the same way). Then map:
  ```ts
  const bracketPairs: BracketPairVM[] = bracket
    ? [
        toVM("SF1", bracket.semifinals[0]),
        toVM("SF2", bracket.semifinals[1]),
        toVM("FINAL", bracket.final),
        toVM("THIRD_PLACE", bracket.thirdPlace),
      ]
    : [];
  const placementTeamNames: (string | null)[] = bracket
    ? [
        bracket.placements.first?.teamName ?? null,
        bracket.placements.second?.teamName ?? null,
        bracket.placements.third?.teamName ?? null,
        bracket.placements.fourth?.teamName ?? null,
      ]
    : [];
  const hasPlacements = placementTeamNames.some((name) => name !== null);
  ```
  (`toVM(slot, pair) => ({ slot, homeTeam: pair.homeTeam, awayTeam: pair.awayTeam, score: pair.score })` — the exact `playoff-schedule.tsx` `toSlot` precedent from the admin schedule page.)
  Replace the placeholder:
  ```tsx
  {activeTab === "playoff" ? (
    <div className="grid gap-6">
      <Bracket pairs={bracketPairs} />
      {hasPlacements ? (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">Місця</h2>
          <div className="mt-2">
            <PlayoffPlacements teamNames={placementTeamNames} />
          </div>
        </div>
      ) : null}
    </div>
  ) : null}
  ```
  (The admin schedule page uses `<h3>Місця</h3>` inside a `<section>`; the public page's tab body has no section wrapper, so `<h2>` is the right level here — match the page's other tab bodies.)

- **`needsManualSeed` is NOT surfaced on the public bracket.** `getPlayoffBracket` does not expose it (`advanceBracket` returns `false`; the seed-time flag lives only in `seedPlayoff`'s output at formation). The public **standings** tab (Story 3.8) already carries the "provisional seeding" signal (the `*` marker + legend on a position decided by the name fallback), and the public page defaults to that tab. No FR / UX asks for it on the bracket. **Decision:** the deferred item "`needsManualSeed` on the derived bracket / persisting it — Story 4.6" is resolved as **won't-do for the public bracket** — reopen only if a future admin bracket surface wants it. Update `deferred-work.md`.

- **`@@unique([tournamentId, slot])` on `Match` is NOT added here.** `advanceBracket`'s `indexBySlot` throws on a duplicate `slot`, and this story makes that a possible **anonymous-traffic 500** (previously only the admin schedule page ran it, since Story 4.3). But: the only sanctioned writers (`savePlayoffFormation` — `count > 0` + `SELECT … FOR UPDATE`; `savePlayoffAdvancement` — creates each downstream slot once) structurally prevent a duplicate slot row. A partial unique index (`WHERE slot IS NOT NULL`) is not expressible in Prisma 7's schema and would be raw-SQL-only, risking a `migrate diff` "drift" flag against the AGENTS conformance check ("must print empty migration") — not worth it for a guard against a state the writers already prevent. **Kept as a tracked schema-follow-up** in `deferred-work.md` (the 4.3-review item's stated alternative). Do not add a migration in this story.

- **The public «Розклад» tab stays group-only.** `listGroupMatchesForTournament` is `GROUP`-scoped; playoff matches do not appear there. FR-14's «розклад за Групою» is the group calendar. Playoff pairings + scores live on the «Плейоф» tab (this story). Adding playoff matches to «Розклад» is out of scope (and moot until playoff-match scheduling has an admin UI).

- **No new route, no migration, no new `src/domain` module, no new `src/data` function, no `Tournament.state` change.** This is a rendering story — the closest precedent is **Story 3.8** (public standings table): "story рендерингу — без міграції / без домену / без роуту". The engine (`getPlayoffBracket` → `advanceBracket`) and the revalidation (`enter/edit/removeMatchResult` and `formPlayoff` already `revalidatePath(\`/classic/${id}\`)`) are done.

## Tasks / Subtasks

- [x] **Task 1 — `src/components/bracket.tsx` (NEW)** (AC: 1, 2)
  - [x] `BracketPairVM` type (`slot`, `homeTeam: string | null`, `awayTeam: string | null`, `score: string | null`) + `Bracket({ pairs })` — a **server** component, no client state, no `@/data` import.
  - [x] Slot → Ukrainian label owned by the component (`SF1` «Півфінал 1», `SF2` «Півфінал 2», `THIRD_PLACE` «Матч за 3-тє місце», `FINAL` «Фінал»).
  - [x] Per pair: **awaiting** (`!homeTeam || !awayTeam`) → white card, `rounded-md`, `border border-dashed border-border`, «очікує суперників» in `text-muted-foreground`; **decided** → `bg-muted rounded-md`, flex row: `{homeTeam} — {awayTeam}` left, `score` right (`tabular-nums font-medium`, omitted when `score` is null).
  - [x] Layout `grid gap-4 sm:grid-cols-2`: left column SF1 + SF2, right column FINAL + THIRD_PLACE; single column stacking on `< 640px` in order SF1 · SF2 · Фінал · Матч за 3-тє.
  - [x] Defensive: if `pairs` is empty (should not happen — the tab only renders in `PLAYOFF`+), render a muted «Сітку ще не сформовано.» rather than an empty grid.
  - [x] Doc-comment notes the `#B0B0B4` → `text-muted-foreground` / `border-border` approximation (no token) and "read-only, no winner emphasis (score + placements carry it)".
  - [x] `typecheck` / `lint` clean.

- [x] **Task 2 — `src/app/classic/[tournament]/page.tsx` (UPDATE): the «Плейоф» tab** (AC: 1, 2, 3, 4)
  - [x] Import `Bracket` + `BracketPairVM` from `@/components/bracket`, `PlayoffPlacements` from `@/components/playoff-placements`, `getPlayoffBracket` from `@/data/playoff`.
  - [x] `const bracket = activeTab === "playoff" ? await getPlayoffBracket(id) : null;` (conditional fetch, like `standings` / `matches`).
  - [x] Map `bracket` → `bracketPairs: BracketPairVM[]` (order `SF1, SF2, FINAL, THIRD_PLACE`) and `placementTeamNames: (string | null)[]` + `hasPlacements`.
  - [x] Replace the placeholder `<p>Сітка плейофа зʼявиться в наступному оновленні.</p>` with `<Bracket pairs={bracketPairs} />` and, when `hasPlacements`, `<PlayoffPlacements teamNames={placementTeamNames} />` under an `<h2 className="text-sm font-semibold text-muted-foreground">Місця</h2>`.
  - [x] **Verify (do not re-implement):** the «Плейоф» chip is hidden unless `showPlayoff`; `activeTab === "playoff" && !showPlayoff` falls back to the default tab. Both already in the page.
  - [x] `pnpm build` (route unchanged, but the page changed) → `pnpm typecheck` clean.

- [x] **Task 3 — `scripts/verify-advance-bracket.mts` (UPDATE, light)** (AC: 1, 2, 4)
  - [x] `getPlayoffBracket` is already exercised end-to-end by this script (AWAITING/READY/PLAYED statuses, team names, `score`, `placements` null→resolved — Stories 4.3 / 4.4). Add one explicit assertion for the shape the public `Bracket` maps: a `READY` semifinal pair returns non-null `homeTeam` / `awayTeam` and `score === null` before its result; a `PLAYED` pair returns `score` like `"3:0"`. Header comment: mention it now also backs the public bracket (Story 4.6).
  - [x] No new verify script — no new data path.

- [x] **Task 4 — Docs** — `src/components/README.md` (new `bracket.tsx` entry; note `playoff-placements.tsx` is now reused publicly), `AGENTS.md` (Story 4.6 Stack bullet), `_bmad-output/implementation-artifacts/deferred-work.md` (Story 4.6 section: `needsManualSeed`-on-bracket resolved won't-do; `@@unique([tournamentId, slot])` restated as a schema follow-up; playoff-match scheduling has no admin UI; «Розклад» stays group-only; the standing "no component test" note for `bracket.tsx`).

- [x] **Task 5 — Verification gate** (AC: all)
  - [x] `pnpm build` ✓ · `pnpm typecheck` ✓ · `pnpm lint` ✓ · `pnpm test` (unchanged count — no domain change; state it) ✓.
  - [x] `prisma migrate status` up to date; `migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` → "empty migration" (no schema change — confirm).
  - [x] `pnpm exec tsx scripts/verify-advance-bracket.mts` green; all verify scripts green.
  - [x] Import-boundary: `bracket.tsx` imports nothing from `@/data` / `@/actions` / `@/domain` (pure view — labels are local); `page.tsx` imports `@/data/playoff` (a Server Component read — the established `view → data` edge).
  - [x] Command output in the Dev Agent Record.
  - _Residual: no automated component test for `bracket.tsx` (standing "no component toolchain" gap). Recommended manual pass with code review: open a `PLAYOFF` tournament's public page `?tab=playoff` as an anonymous visitor → both semifinals show teams, final + third-place show «очікує суперників»; enter both semifinal results → refresh → final + third-place fill; enter the final + third-place → «Місця» 1–4 appear; confirm the «Плейоф» chip is absent on a `GROUP_STAGE` tournament._

- [x] **Task 6 — Commit(s)** — one commit + `git push origin main` per task group (component; page wiring; verify + docs). Per the standing "commit after each task" instruction.

### Review Findings

_Code review (`bmad-code-review`, 4 layers: Blind Hunter, Edge Case Hunter, Verification Gap, Acceptance Auditor) over `git diff 390e6c1..5d17f47` (`src/` + `scripts/`). 0 decision-needed, 8 patch → all applied, 3 deferred, ~10 dismissed. Gate re-run clean: `build` / `typecheck` / `lint`, `pnpm test` 169/169, all 16 verify scripts green, `migrate diff` empty._

#### Patch

- [x] [Review][Patch] `BracketPairVM` drops `status`; `BracketPairCard` re-derives it as `!homeTeam || !awayTeam` `[src/components/bracket.tsx, src/app/classic/[tournament]/page.tsx]` — `PlayoffBracketPairView.status` (`AWAITING`/`READY`/`PLAYED`) is the authoritative field `advanceBracket` computes; the component throws it away and reconstructs an equivalent. Add `status` to `BracketPairVM`, drive the "awaiting" card off `pair.status === "AWAITING"`. (blind-hunter + edge-case-hunter)
- [x] [Review][Patch] `toBracketPair(slot, pair)` takes an explicit `slot` even though `pair.slot` carries the same literal `[src/app/classic/[tournament]/page.tsx:63-71]` — a caller-side typo (`toBracketPair("SF2", bracket.semifinals[0])`) silently mislabels a card and TypeScript will not catch it. Use `pair.slot`; drop the argument. Also hoist the mapper to module scope (it closes over nothing). (blind-hunter + verification-gap)
- [x] [Review][Patch] Long team names overflow the flex row → horizontal page scroll on mobile `[src/components/bracket.tsx:180-186]` — `<div className="flex … justify-between">` with a non-shrinking `<span>{home} — {away}</span>` (two ~120-char admin-entered names) pushes past the viewport on `< 640px`; UX-DR14 / EXPERIENCE §Responsive forbid `body` horizontal scroll. Add `min-w-0` to the flex row and the team span, `break-words` on the span. (blind-hunter + edge-case-hunter)
- [x] [Review][Patch] The bracket has no accessible landmark or heading `[src/components/bracket.tsx]` — `standings-table.tsx` (the cited precedent) wraps its content in `role="region"` + `aria-label`; the playoff tab body is a bare `<div className="grid …">` with per-card `<p>` slot labels and no «Сітка плейофа» region/heading (EXPERIENCE §Accessibility Floor). Wrap the grid in `<section aria-label="Сітка плейофа">` (or a labelled region), inside the component. (blind-hunter + acceptance-auditor)
- [x] [Review][Patch] The `pairs.length === 0` branch («Сітку ще не сформовано.») is unreachable from its only caller `[src/components/bracket.tsx:34-36, src/components/README.md]` — `bracketPairs` is `[]` only when `bracket` is `null` (tab ≠ playoff → `<Bracket>` not rendered), and `advanceBracket` always returns a full four-pair structure otherwise, so `pairs.length` is always 4. Remove the dead branch (and its inline copy — which bypasses `src/lib/empty-states.ts`); soften the README line that describes it as a real "not yet formed" state. (blind-hunter + verification-gap)
- [x] [Review][Patch] Playoff slot labels are triplicated `[src/components/bracket.tsx:8-14, src/app/admin/tournaments/[id]/schedule/page.tsx:71-74, src/app/admin/tournaments/[id]/matches/[matchId]/page.tsx:16-18]` — «Півфінал 1/2», «Матч за 3-тє місце», «Фінал» are hand-written in three places (and Story 4.7's archive bracket will be a fourth). Extract `src/lib/playoff-labels.ts` (the `tournament-labels.ts` / `empty-states.ts` precedent); the three files consume it. (blind-hunter)
- [x] [Review][Patch] `placementTeamNames` extraction + the «Місця» heading are duplicated verbatim between the public and admin surfaces `[src/app/classic/[tournament]/page.tsx:80-88, src/app/admin/tournaments/[id]/schedule/page.tsx:78-86]` — both independently map `getPlayoffBracket().placements` → `(string|null)[]` and gate on `.some(n => n !== null)`. Extract a `placementNames(view)` helper in `src/data/playoff.ts`; both pages call it. (blind-hunter + verification-gap + acceptance-auditor)
- [x] [Review][Patch] Misleading JSDoc + overstated verify comment `[src/components/bracket.tsx (Bracket doc), scripts/verify-advance-bracket.mts:145-146]` — the `Bracket` doc says pairs arrive as `[SF1, SF2, FINAL, THIRD_PLACE]`, but the body re-filters by slot and never depends on the order (reword: "any order; split into semifinals / decisive by slot"). The new verify comment «Pair-view shape the public Bracket component maps» implies the assertion tests the component; it only inspects `getPlayoffBracket`'s output (reword). Optionally add a `semifinals[1]` / `THIRD_PLACE` `score` assertion to match the existing `semifinals[0]` one. (blind-hunter + verification-gap)

#### Defer

- [x] [Review][Defer] `getPlayoffBracket` → `advanceBracket`'s `indexBySlot` throw is now on an anonymous-traffic path `[src/app/classic/[tournament]/page.tsx:62]` — deferred, restated. A duplicate `(tournamentId, slot)` `Match` row makes `advanceBracket` throw, 500-ing the public playoff tab. The state is unreachable via the sanctioned writers (`savePlayoffFormation`'s `count > 0` + `SELECT … FOR UPDATE`; `savePlayoffAdvancement`'s per-slot create), the app has **no** `error.tsx` anywhere (every page's data reads 500 on throw — an app-wide gap), and the real fix — `@@unique([tournamentId, slot])` as a partial index — is already the schema-follow-up written into `deferred-work.md` for this story. A route-segment `error.tsx` for `/classic/[tournament]` would contain the blast radius app-wide (broader task). (blind-hunter + edge-case-hunter)
- [x] [Review][Defer] `getPlayoffBracket` blocks the page render — no `Suspense` / `loading.tsx` `[src/app/classic/[tournament]/page.tsx]` — deferred, pre-existing and app-wide. Every public page awaits its `src/data` reads sequentially with no streaming boundary (2.9 / 3.8 reviews: "no caching/revalidation strategy for the app's first anonymous-traffic routes"). `getPlayoffBracket` is a few indexed reads at v1 scale (NFR-5). A cross-cutting `loading.tsx` + `unstable_cache` pass owns this. (blind-hunter)
- [x] [Review][Defer] No component / page-level test for the bracket wiring `[src/components/bracket.tsx, src/app/classic/[tournament]/page.tsx]` — deferred, standing "no component toolchain" gap. `verify-advance-bracket.mts` covers `getPlayoffBracket`'s pair-view + placement shapes (including the AWAITING/null-teams case at `:226`), but the page mapping (`toBracketPair`, `hasPlacements`) and the component's awaiting-vs-decided render are unverified. The `placementNames` / slot-labels helpers (patches above) become verify-testable once extracted. (verification-gap)

## Dev Notes

### What this story is / is NOT

**Is:** the public, read-only playoff bracket. One new **server** component `src/components/bracket.tsx` (UX-DR6 / DESIGN «Bracket pair»), wired into the existing `?tab=playoff` branch of `/classic/[tournament]/page.tsx` via the **already-built** `getPlayoffBracket` read (which runs `advanceBracket` on every read — AD-5). The final placements 1–4 are shown by **reusing** `PlayoffPlacements` (Story 4.4), exactly as the admin schedule page does. The tab-visibility rule (`PLAYOFF`+ only) is **already** enforced by `TournamentTabs` + the page.

**Is NOT** (do not pull forward):
- **A migration / a new route / a new `src/domain` module / a new `src/data` function.** Rendering story, Story 3.8 shape.
- **Widening `getPlayoffBracket` or `PlayoffBracketView`.** It already returns everything needed (`homeTeam` / `awayTeam` / `score` / `status` per pair, `placements`).
- **`needsManualSeed` on the bracket.** Resolved won't-do (see Notes) — the standings tab carries that signal; no FR/UX asks for it here.
- **`@@unique([tournamentId, slot])` on `Match`.** Schema follow-up, not this story (raw-SQL-only, `migrate diff` drift risk; the sanctioned writers already prevent a duplicate slot).
- **Playoff-match scheduling (date / venue) — an admin UI for it, or showing it on the bracket.** No admin surface sets a playoff match's schedule today; those `PlayoffBracketPairView` fields are always null. Out of scope; note it.
- **Playoff matches on the public «Розклад» tab.** `listGroupMatchesForTournament` stays `GROUP`-scoped; FR-14 is the group calendar.
- **The `/archive` route and its read-only archived bracket + «місця 1–4» list.** Story 4.7. (Story 4.7 will reuse `bracket.tsx` and `PlayoffPlacements` — build them clean.)
- **Parameterising `TournamentTabs` off the `/classic` route tree.** Tracked for Story 4.7 (the archive tabbed page would be the second consumer). Not here.
- **Winner emphasis / bolding the champion in a bracket card.** DESIGN's spec is teams + score only.
- **`Tournament.state` changes.** None.
- **BEACH.** `resolveTournament` already enforces `CLASSIC`.

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/components/bracket.tsx` | NEW | Server, read-only. `Bracket({ pairs: BracketPairVM[] })`. UX-DR6 / DESIGN «Bracket pair» + `bracket-pair-tbd`. Owns its slot labels. |
| `src/app/classic/[tournament]/page.tsx` | UPDATE | `?tab=playoff` branch: `getPlayoffBracket(id)` → `<Bracket>` + reuse `<PlayoffPlacements>` when placements resolved. Replaces the one-line placeholder. |
| `scripts/verify-advance-bracket.mts` | UPDATE | One assertion for the pair-view shape the public bracket maps; header comment. |
| `src/components/README.md` · `AGENTS.md` · `_bmad-output/implementation-artifacts/deferred-work.md` | UPDATE | Component entry; Stack bullet; resolved / restated deferred items. |
| `src/components/playoff-placements.tsx` | DO NOT MODIFY | Reused verbatim (already generic — Story 4.4). |
| `src/components/tournament-tabs.tsx` | DO NOT MODIFY | `showPlayoff` already hides the chip until `PLAYOFF`+. |
| `src/data/playoff.ts` `getPlayoffBracket` / `PlayoffBracketView` / `PlayoffBracketPairView` | DO NOT MODIFY | Already the shared public/admin read (its docstring says so). |
| `src/domain/bracket.ts` | DO NOT MODIFY | `advanceBracket` / `playoffPlacements` used as-is via `getPlayoffBracket`. |
| `prisma/**` | DO NOT TOUCH | No schema change. |
| `src/app/archive/**` | DO NOT CREATE | Story 4.7. |

### Architecture compliance

- **AD-4 / AD-5** — the bracket and the placements 1–4 are derived by `advanceBracket` / `playoffPlacements` inside `getPlayoffBracket` on **every read**; nothing is stored. The component is pure presentation of that read. [ARCHITECTURE-SPINE.md#AD-4, #AD-5]
- **AD-7** — the page reads through `resolveTournament` (public `state != DRAFT` + `CLASSIC`) and calls `getPlayoffBracket` (no auth) only when `activeTab === "playoff"`, which requires `showPlayoff` (`PLAYOFF`/`COMPLETED`). No draft leak. [ARCHITECTURE-SPINE.md#AD-7]
- **AD-2 / AD-3** — `bracket.tsx` is pure `src/components` (no `@/data` / `@/actions` / `@/domain` import — its labels are local strings); the page's `getPlayoffBracket` call is the sanctioned `view → data` read edge (same as `getStandings` / `listGroupMatchesForTournament` on this page). [ARCHITECTURE-SPINE.md#AD-2, #AD-3, §Design Paradigm table — "data (лише читання)"]
- **AD-9** — `CLASSIC` only, enforced upstream by `resolveTournament`. [ARCHITECTURE-SPINE.md#AD-9]
- **NFR-3** — the bracket cannot desync from the results: it is a pure re-derivation on read, and every result mutation already `revalidatePath(\`/classic/${id}\`)` (Stories 3.6 / 3.7 / 4.3). [PRD NFR-3]
- **NFR-6 / UX-DR14** — the bracket cards wrap / stack on `< 640px`; no horizontal page scroll. [EXPERIENCE §Responsive]

### Existing code being modified — current state → change → what must be preserved

**`src/app/classic/[tournament]/page.tsx`** (Stories 2.9 + 3.5 + 3.8 + 4.5)
- *Current:* `resolveTournament` → `notFound()`; `StatusBadge`; `CompletedBanner` (Story 4.5) when `COMPLETED`; `TournamentTabs` with `showPlayoff = state === "PLAYOFF" || state === "COMPLETED"`; `defaultTab = state === "DRAFT" ? "teams" : "standings"`; `activeTab = normalizeTournamentTab(tab) ?? defaultTab`, with `if (activeTab === "playoff" && !showPlayoff) activeTab = defaultTab`. Per-tab conditional reads: `entries` (teams), `standings` + `standingsRows` + `standingsHaveResults` (standings), `matches` (schedule). Tab bodies: `<StandingsTable>`, teams `<ul>` / `<EmptyState NO_TEAMS>`, `<PublicSchedule>`, and the `playoff` **one-line placeholder**.
- *Change:* add the `bracket` conditional read + its two derived VMs; replace the `playoff` placeholder with `<Bracket>` (+ `<PlayoffPlacements>` when `hasPlacements`).
- *Must preserve:* `resolveTournament` / `notFound()`; `StatusBadge` + `CompletedBanner`; **all** tab routing / default-tab / `showPlayoff` logic (do not touch — AC line 3 is already met by it); every other tab body; `generateMetadata`.

**`scripts/verify-advance-bracket.mts`** (Stories 4.3 + 4.4)
- *Current:* builds a 4-team playoff, drives semifinal / final / third-place results, asserts `savePlayoffAdvancement`, `getPlayoffBracket().placements`, `checkCanEditSemifinalResult`, and `match_slot_stage_check`.
- *Change:* add one assertion block on `getPlayoffBracket()`'s pair views (`READY` → teams non-null, `score` null; `PLAYED` → `score` string); update the header comment.
- *Must preserve:* every existing assertion and the self-cleaning teardown.

### Testing requirements

- **No new Vitest** — no `src/domain` change. State the unchanged test count (169) in the Dev Agent Record.
- **`scripts/verify-advance-bracket.mts`** is the integration gate for the data the bracket renders — it already covers `getPlayoffBracket` through every status; add the one pair-view-shape assertion (Task 3).
- **No component test** for `bracket.tsx` — the standing "no component toolchain" gap (same as `standings-table.tsx` / `public-schedule.tsx` / `playoff-schedule.tsx` / `playoff-placements.tsx`). The rendered markup is covered by the documented manual pass.
- **No migration** — `prisma migrate status` + `migrate diff … --script` still "empty migration" (confirm; no schema change).
- **Regression:** `pnpm build` (the public page changed) + re-run all `verify-*.mts`.

### Project Structure Notes

- `bracket.tsx` is a **server** component (no `"use client"`) — read-only, no interactivity, exactly `standings-table.tsx` / `public-schedule.tsx` / `playoff-schedule.tsx`. A client component would be wrong here (no state, no events).
- It owns its slot→label copy (the Story 4.4 review's ruling for `playoff-placements.tsx`: the component owns shared copy, the page passes only data). The page maps `PlayoffBracketView` → `BracketPairVM[]` the same way the admin schedule page maps it to `PlayoffScheduleSlot[]` via `toSlot`.
- Placements reuse `PlayoffPlacements` rather than a new public variant — it is already generic (`teamNames: (string | null)[]`), already read-only, already handles nulls. A second component would duplicate copy + markup.
- The bracket is **not** extracted into a shared `src/components` module *and also* used by the admin schedule page — the admin page keeps its flatter `PlayoffSchedule` (which additionally carries the "Внести результат" link). `bracket.tsx` is the viewer-facing card layout. Story 4.7's archived-tournament page will reuse `bracket.tsx` as-is.

### Previous story intelligence

- **Story 4.4 (done, code-reviewed)** — `getPlayoffBracket` gained `placements: PlayoffPlacementsView` (name-resolved, computed on read); `PlayoffPlacements` component (`teamNames` prop, `<TrophyIcon>` on first, «— (матч не зіграно)» for null, `<ol aria-label>`); the admin schedule page renders it under `<h3>Місця</h3>` when any place is non-null (`hasPlacements`). **This story reuses that component + that exact `hasPlacements` pattern.** `pnpm test` 167.
- **Story 4.3 (done)** — `getPlayoffBracket` (`PlayoffBracketView`: `semifinals`/`thirdPlace`/`final` as `PlayoffBracketPairView` with `matchId`/`homeTeam`/`awayTeam`/`score`/`scheduledAt`/`venueText`/`status`, `advanceBracket` on read). `PlayoffSchedule` component + `toSlot` mapping in the admin schedule page — **the mapping precedent for this story's `toVM`**. `advanceBracket` "trusts a self-consistent set" — `indexBySlot` throws on a duplicate slot (the `@@unique` gap).
- **Story 4.5 (done, code-reviewed)** — added `CompletedBanner` (`src/components/completed-banner.tsx`, server, `role="status"`) above the public tabs; `checkCanEditResults` freezes results in `COMPLETED`. The public page structure this story edits is the post-4.5 one.
- **Story 3.8 (done, code-reviewed)** — the closest precedent: a pure rendering story for the public **standings** table. `standings-table.tsx` (server, read-only, semantic markup, `tabular-nums`, `#F1F1EF`→`border-border` token approximation, `overflow-x-auto role=region` for the wide table, a `*` + legend for `needsManualSeed`). The public page's default-tab logic and `?tab=` routing were finalised here. `verify-group-stage-schema.mts` covers the data, no component test for the table.
- **Story 2.9 (done)** — `resolveTournament` (the shared visibility resolver — public read + admin draft-preview fallback, `CLASSIC`-checked); `status-badge.tsx`; `public-roster.tsx` (read-only, separate from the admin `roster.tsx`) — the "public read-only component distinct from the admin one" precedent this story follows for `bracket.tsx` vs `PlayoffSchedule`.

### Git intelligence

Recent: `390e6c1` (Story 4.5 review-fix, done) ← `bf4674e` (Story 4.5) ← `e781c95` (Story 4.4 review-fix). `epic-4` `in-progress`; `4-1`…`4-5` `done`, `4-6` `backlog`, `4-7` `backlog`. `src/data/playoff.ts` `getPlayoffBracket` returns `PlayoffBracketView` (`placements` since 4.4). `src/components/playoff-placements.tsx` (`teamNames` prop). `src/components/tournament-tabs.tsx` `showPlayoff` filters the «Плейоф» chip. `src/app/classic/[tournament]/page.tsx` `playoff` tab is a one-line placeholder. No migration since `20260907140000_match_slot_stage_per_stage_fix`. `pnpm test` 169.

### Latest tech information

- **No new library.** Next 16 Server Components, Tailwind v4 utilities. `Bracket` is pure JSX + Tailwind. `getPlayoffBracket` is an existing Prisma 7 read.
- **No migration** — no schema change. `prisma generate` runs in `postinstall` / `build`; run `pnpm build` because the public page changes (route unchanged, so `typecheck` is green without it — still run it).
- **`lucide-react`** already a dependency — `PlayoffPlacements` uses `TrophyIcon`; `bracket.tsx` needs no icon.
- **Tailwind v4 CSS-first** — theme tokens are in `src/app/globals.css` (`--radius-md: 10px`, `--muted: #f5f5f4`, `--muted-foreground: #6b6b70`, `--border: #e7e7e4`). Use `bg-muted` / `rounded-md` / `border-border` / `text-muted-foreground` utilities; there is **no** `#B0B0B4` token (approximate, note it).

### Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 4.6 AC, FR-22; the 4.6/4.7 boundary), `prd.md` §4.8 (FR-21/FR-22) + §4.10 (FR-25), `ARCHITECTURE-SPINE.md` (AD-2/AD-3/AD-4/AD-5/AD-7/AD-9), `SPEC.md` (CAP-9 «сітка … доступна Глядачу без входу», NFR-3), `EXPERIENCE.md` (Component Patterns — Bracket, Tab chip; Responsive «картки сітки — стовпчиком»; Accessibility Floor), `DESIGN.md` (§Components — Bracket pair `{colors.muted}` / `{rounded.md}` / `bracket-pair-tbd` white+dashed+`#B0B0B4`; §Typography — `tabular-nums`), `4-3-…` / `4-4-…` (`getPlayoffBracket` / `PlayoffBracketView` / `PlayoffPlacements` / `toSlot` mapping), `3-8-…` (the rendering-story shape, the public-page tab logic), `2-9-…` (`resolveTournament`, public-vs-admin component split), `deferred-work.md` (`needsManualSeed`-on-bracket → this story; `@@unique([tournamentId, slot])`; playoff-schedule gaps).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.6: Публічна сітка плейофа] — user story + AC; FR-22
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.7: Річний архів] — the boundary: `/archive`, read-only archived bracket, «місця 1–4» list, places 5+ from the group table
- [Source: _bmad-output/planning-artifacts/prds/prd-untitled-2026-08-31/prd.md#4.8] — FR-21 «Наслідки» («сітка … з рахунками … без входу»), FR-22 · [#4.10] — FR-25
- [Source: …/ARCHITECTURE-SPINE.md#AD-5] — `advanceBracket` sole deriver, on write **and render** · [#AD-4] · [#AD-7] — public read bypasses auth, filters `state != DRAFT` · [#AD-2/#AD-3] — `view → data (read)` edge
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#Capabilities CAP-9] — «сітка … доступна Глядачу без входу» · [#Constraints] — placements never stored
- [Source: …/ux-designs/…/DESIGN.md#Components — Bracket pair] — `{colors.muted}` / `{rounded.md}` / white+dashed+`#B0B0B4` TBD · [#Typography] — `tabular-nums` mandatory
- [Source: …/ux-designs/…/EXPERIENCE.md#Component Patterns — Bracket] — read-only, «очікує суперників» until both semifinal results, fills on next load · [#Component Patterns — Tab chip] — «Плейоф» hidden until Playoff+ · [#Responsive] — bracket cards stack `< 640px` · [#Accessibility Floor]
- [Source: src/data/playoff.ts] — `getPlayoffBracket` / `PlayoffBracketView` / `PlayoffBracketPairView` (`status` / `homeTeam` / `awayTeam` / `score`) / `placements` — "the shared read for the admin schedule section and Story 4.6's public bracket"
- [Source: src/components/playoff-placements.tsx] — `PlayoffPlacements({ teamNames })`, reused verbatim
- [Source: src/components/tournament-tabs.tsx] — `showPlayoff` already hides the chip
- [Source: src/app/admin/tournaments/[id]/schedule/page.tsx] — `toSlot` mapping + `hasPlacements` pattern to mirror
- [Source: src/components/standings-table.tsx / public-schedule.tsx] — the public read-only server-component shape
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — "`needsManualSeed` on the derived bracket … Story 4.6"; "`@@unique([tournamentId, slot])` … Fold into Story 4.6 hardening or a schema follow-up"; the standings token-approximation precedent

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (bmad-dev-story)

### Debug Log References

- `pnpm build` runs `node scripts/migrate-deploy.mjs` locally (`VERCEL_ENV` unset) → `migrate deploy` against the Neon `dev` branch; no-op this story (no migration), build green.

### Completion Notes List

- **Task 1:** `src/components/bracket.tsx` (NEW) — server component, `Bracket({ pairs: BracketPairVM[] })`. `BracketPairCard`: awaiting (`!homeTeam || !awayTeam`) → white card, `border border-dashed border-border`, «очікує суперників» (`text-muted-foreground`); decided → `bg-muted rounded-md`, `{home} — {away}` left, `score` right (`tabular-nums`, omitted when null). Slot labels owned by the component. Layout `grid gap-4 sm:grid-cols-2` (semifinals / final+third), stacked below 640px. Empty `pairs` → muted «Сітку ще не сформовано.» No `@/data`/`@/domain`/`@/actions` import. Comments carry no planning refs.
- **Task 2:** `src/app/classic/[tournament]/page.tsx` — `const bracket = activeTab === "playoff" ? await getPlayoffBracket(id) : null;` + `toBracketPair` mapping (order `SF1, SF2, FINAL, THIRD_PLACE`) + `placementTeamNames` / `hasPlacements` (the admin schedule page's pattern). Placeholder `<p>` replaced with `<div className="grid gap-6"><Bracket .../>{hasPlacements ? <PlayoffPlacements .../> under <h2>Місця</h2> : null}</div>`. Tab-visibility logic untouched (already correct).
- **Task 3:** `scripts/verify-advance-bracket.mts` — two assertions on `getPlayoffBracket()`'s pair views (played semifinal → both team names + `score === "3:0"`; READY final → `score === null`); header comment updated.
- **Task 4:** docs — `src/components/README.md` (new `bracket.tsx` entry; `playoff-placements.tsx` noted as reused publicly), `AGENTS.md` (Story 4.6 Stack bullet), `deferred-work.md` (Story 4.6 section: `needsManualSeed`-on-bracket → won't-do; `@@unique([tournamentId, slot])` schema follow-up; playoff-schedule-has-no-UI; «Розклад» group-only; no component test).
- **Task 5:** `pnpm build` ✓ · `pnpm typecheck` ✓ · `pnpm lint` ✓ · `pnpm test` **169/169** (unchanged — no domain change). `prisma migrate status` up to date; `migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` → "empty migration". All 16 verify scripts green. Import-boundary clean (`bracket.tsx` pure view; `page.tsx` `getPlayoffBracket` is the `view → data` read edge).
- No new route, no migration, no new `src/domain` module, no new `src/data` function, no `Tournament.state` change.

### File List

- `src/components/bracket.tsx` (NEW)
- `src/lib/playoff-labels.ts` (NEW — review patch: shared `PLAYOFF_SLOT_LABELS`)
- `src/app/classic/[tournament]/page.tsx` (UPDATE)
- `src/app/admin/tournaments/[id]/schedule/page.tsx` (UPDATE — review patch: use `PLAYOFF_SLOT_LABELS` + `placementNames`)
- `src/data/playoff.ts` (UPDATE — review patch: `placementNames(view)` helper)
- `scripts/verify-advance-bracket.mts` (UPDATE)
- `src/components/README.md` · `AGENTS.md` · `_bmad-output/implementation-artifacts/deferred-work.md` (UPDATE)

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-07 | Story drafted (`bmad-create-story`). Scope: one new server component `src/components/bracket.tsx` (UX-DR6 / DESIGN «Bracket pair») + wire the existing `getPlayoffBracket` read into the `?tab=playoff` branch of the public tournament page; reuse `PlayoffPlacements` (Story 4.4) for places 1–4. Tab-visibility rule already enforced by `TournamentTabs`. No migration, no route, no domain, no data function. `needsManualSeed`-on-bracket resolved won't-do; `@@unique([tournamentId, slot])` restated as a schema follow-up. `/archive` = Story 4.7. Status: ready-for-dev. |
| 2026-09-07 | Implementation complete (`bmad-dev-story`) — all 6 tasks. `Bracket` component + `?tab=playoff` wiring via the existing `getPlayoffBracket` read; `PlayoffPlacements` reused for places 1–4. `verify-advance-bracket.mts` extended with the pair-view shape assertions. No migration, no new route/domain/data-function. `pnpm build`/`typecheck`/`lint` clean, `pnpm test` 169/169, all 16 verify scripts green, `migrate` clean. Status: review. |
| 2026-09-07 | Code review (`bmad-code-review`, 4 layers) — 0 decision-needed, 8 patch, 3 deferred, ~10 dismissed. All 8 patches applied: `BracketPairVM` carries `status` (no re-derive); `toBracketPair` uses `pair.slot`, hoisted to module scope; long team names get `min-w-0 break-words` (no mobile h-scroll); `<section aria-label="Сітка плейофа">` wrapper; dead `pairs.length === 0` branch removed; slot labels → shared `src/lib/playoff-labels.ts` (bracket + admin schedule); `placementNames(view)` helper in `src/data/playoff.ts` (public + admin pages); JSDoc / verify comment reworded. Gate re-run clean (`build`/`typecheck`/`lint`, `pnpm test` 169/169, all 16 verify scripts green, `migrate diff` empty). Status: done. |
