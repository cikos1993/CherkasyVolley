---
baseline_commit: f202fae
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - _bmad-output/specs/spec-cherkasy-volley/glossary.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/implementation-artifacts/2-1-tournament-team-player-schema.md
  - _bmad-output/implementation-artifacts/2-2-reusable-ux-patterns.md
  - _bmad-output/implementation-artifacts/2-3-tournament-state-machine.md
  - _bmad-output/implementation-artifacts/1-7-admin-management.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - AGENTS.md
---

# Story 2.4: Create tournament

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to create a tournament by choosing a type and setting the rules,
so that a tournament exists that can be filled with teams (FR-4, FR-5).

## Acceptance Criteria

Translated from `epics.md` → Epic 2 → Story 2.4. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** I am an admin on `/admin/tournaments/new`
**When** I choose the type (Чемпіонат / Ветеранський / Жіночий / Юнаки і дівчата), a name, a year, the scoring system (Класичний / Кастомний), the number of teams and the number of rounds, and save
**Then**

1. A tournament is created in state `DRAFT` with exactly one `Group`.
2. The chosen scoring preset is stored in the tournament configuration.
3. I am redirected to the tournament page.
4. Creation is a Server Action under `requireAdmin()`.

### Notes on AC interpretation

- **This is the first real admin *feature* in the codebase** — the first form, the first `src/data` write for a domain entity, the first Server Action that redirects. Everything before it (2.1 schema, 2.2 primitives, 2.3 state-machine plumbing) was groundwork. Keep the surface tight to the AC: a create form, a `createTournament` action, the `src/data` writer, a **minimal** redirect-target page. No edit, no delete (Story 2.5), no team enrolment (2.7), no roster (2.8), no public tournament page (2.9), no draw (Epic 3).
- **"exactly one `Group`" (AC 1) — resolved here: add a minimal `Group` model and create the row in `createTournament`.** Story 2.1 explicitly punted this decision to 2.4 ("either add a minimal `Group` model in 2.4's own migration … or read 'one group' as the `teamCount` invariant with the `Group` row created at draw time"). **Decision: add the model.** Rationale: the AC says the tournament *is created with* a `Group`, and satisfying that literally removes ambiguity for Story 2.9 (which renders tournament structure) and Story 3.3 (the draw, which fills the group). The model is the structural anchor only — `GroupSlot` / `Match` / `SetScore` and the `Group` relations to them stay **Epic 3 (Story 3.2)**; that story's migration then adds only those three tables plus the `Group.slots` / `Group.matches` back-relations. See the `Group` shape below. **Flag for 3.2 in `deferred-work.md`.**
- **`Group` model shape** (`prisma/schema.prisma`, additive migration):
  ```prisma
  /// The single group of a v1 tournament (Tournament 1—1 Group). Structural anchor
  /// only — its slots and matches arrive in Epic 3. Planned size is Tournament.teamCount.
  model Group {
    id           String     @id @default(cuid())
    tournamentId String     @unique
    tournament   Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
    createdAt    DateTime   @default(now()) @db.Timestamptz(3)
    updatedAt    DateTime   @default(now()) @updatedAt @db.Timestamptz(3)
    @@map("group")
  }
  ```
  `Tournament` gains `group Group?` (the optional 1:1 back-relation — Prisma types it nullable even though the app always creates it in the same transaction). `tournamentId @unique` = exactly one group per tournament in v1; Epic 3 relaxes it only if multi-group ever ships (already deferred, post-v1). `onDelete: Cascade` matches FR-6 ("видалення Турніру видаляє … Групи").
- **`Tournament` natural key (deferred from the 2.1 review — 2.4 decides): add `@@unique([discipline, type, year, name])`.** Decision: **add it.** Rationale: an admin double-submit (double-click, back-then-resubmit) otherwise silently creates two identical tournaments; the unique index is a one-line additive migration and makes the failure explicit. This also establishes the **`P2002` → `DUPLICATE` mapping** the feature stories need (deferred-work.md 2.1). Same additive migration as `Group`.
- **`allowedTournamentTypes(discipline)` — a pure `src/domain` helper (deferred from the 2.1 review).** v1: `discipline` is always `CLASSIC` (AD-9 — no `BEACH` create path), so the helper returns all four types for `CLASSIC` and `[]` for `BEACH`. It is small but the deferred item explicitly asks for it, and the Vitest runner (Story 2.3) now exists to test it. Lives in a new `src/domain/tournamentForm.ts` alongside the numeric bounds and the form validator (below).
- **Domain form validation — `validateNewTournament(raw)` in `src/domain/tournamentForm.ts`, pure and unit-tested.** Takes the raw `FormData` string values, coerces and validates, returns `{ ok: true, value }` or `{ ok: false, fieldErrors }` (Ukrainian per-field messages). Bounds:
  - `type` — must be one of `allowedTournamentTypes("CLASSIC")`.
  - `name` — trimmed, non-empty, ≤ 120 chars. (Story 2.6 owns `Team.name` normalization; `Tournament.name` gets only trim + length here.)
  - `year` — integer in `[2000, 2100]` (matches the DB `CHECK` from Story 2.1; the form pre-fills the current year).
  - `scoringPreset` — `"CLASSIC" | "CUSTOM"`.
  - `teamCount` — integer in `[4, 64]`. **The v1 playoff is a fixed 4-team bracket (SPEC Constraints); a tournament with fewer than 4 teams could never form one.** If group-only tournaments are a valid v1 use case, relax the lower bound to `2` — see the open question at the end.
  - `rounds` — integer in `[1, 10]` (SPEC NFR-5 scale: "десятки команд, сотні матчів"; a sanity cap, not a hard rule).
  - The DB `CHECK`s (`year 2000–2100`, `teamCount > 0`, `rounds > 0`) are the backstop; the domain validator is the user-facing gate.
- **`createTournament` Server Action — `src/actions/tournaments.ts` (extend the file from Story 2.3).** Signature for `useActionState`: `(prevState, formData) => Promise<CreateTournamentState>`. Body:
  1. `await requireAdmin()` — first line (AD-6).
  2. `const parsed = validateNewTournament({ discipline: "CLASSIC", type: fd.get("type"), name: fd.get("name"), year: fd.get("year"), scoringPreset: fd.get("scoringPreset"), teamCount: fd.get("teamCount"), rounds: fd.get("rounds") })`.
  3. `!parsed.ok` → `return { fieldErrors: parsed.fieldErrors, values: <raw strings> }` (the raw strings repopulate the form — see the UX-DR11 note).
  4. `const { id } = await createTournamentRecord(parsed.value)` (`src/data`).
  5. `redirect(\`/admin/tournaments/${id}\`)` — **outside the `try/catch`** (or past a `catch` that narrows to `AdminRequiredError` / `P2002` and re-throws the rest, so `NEXT_REDIRECT` propagates). `redirect()` throws `NEXT_REDIRECT`; do not swallow it.
  6. `catch`: `P2002` (unique violation) → `return { formError: "Турнір з такою назвою вже існує за цей рік.", values: <raw> }`; `AdminRequiredError` → `return { formError: "Потрібні права адміністратора." , values: <raw> }`; anything else → re-throw (a real failure surfaces as the framework error, consistent with `toActionError`'s re-throw posture).
  - **`CreateTournamentState`** = `{ fieldErrors?: Partial<Record<Field, string>>; formError?: string; values?: Partial<Record<Field, string>> }`. Initial state `{}`.
  - **`redirect` inside a Server Action** is the Next 16 idiom for "navigate after a successful mutation" (EXPERIENCE.md: "створення турніру → на сторінку турніру"). It is a server-side redirect; `useActionState` resolves and the client navigates.
- **`src/data` — `createTournamentRecord(input)` in `src/data/tournaments.ts` (extend the file from Story 2.3).** Creates the `Tournament` **and** its `Group` in one `db.$transaction` (or a nested `create` — `db.tournament.create({ data: { …, group: { create: {} } }, select: { id: true } })` is cleaner and atomic). Returns `{ id }`. `state` is not passed — it defaults to `DRAFT` in the schema (AC 1; and no `src/data` function takes a `state` arg — Story 2.3 invariant). Public/admin read split is unchanged (Story 2.3 added `getTournamentForAdmin`; reuse it for the redirect-target page).
- **`ActionErrorCode`** — this story does not need `createTournament` to return an `ActionResult` (it uses the form-state shape), but if a `DUPLICATE` code is wanted for consistency, add `"DUPLICATE"` to `src/actions/result.ts`. Optional — the form-state `formError` string is sufficient for the UI. **Recommendation: skip the code**, keep `createTournament` on its own `CreateTournamentState` shape (forms and `ActionResult` are different surfaces).
- **The form — `src/components/tournament-form.tsx` (NEW, Client Component).** `"use client"`; `const [state, formAction, pending] = useActionState(createTournament, {})`. `<form action={formAction}>` with fields:
  - `type` — `Select` (shadcn), options = `allowedTournamentTypes("CLASSIC")` mapped to Ukrainian labels (`CHAMPIONSHIP` → "Чемпіонат", `VETERAN` → "Ветеранський чемпіонат", `WOMEN` → "Жіночий чемпіонат", `YOUTH` → "Юнаки і дівчата" — glossary "Тип турніру"). `name="type"`.
  - `name` — `Input` (`name="name"`, `maxLength={120}`, `required`).
  - `year` — `Input type="number"` (`name="year"`, `min={2000}`, `max={2100}`, `defaultValue={state.values?.year ?? String(new Date().getFullYear())}`).
  - `scoringPreset` — `Select` (or two radios), options "Класичний" / "Кастомний" (glossary "Система очок"). `name="scoringPreset"`, default `CLASSIC`.
  - `teamCount` — `Input type="number"` (`name="teamCount"`, `min={4}`, `max={64}`).
  - `rounds` — `Input type="number"` (`name="rounds"`, `min={1}`, `max={10}`, default `1`).
  - Each field: a `Label` (top-aligned — DESIGN.md "лейбли зверху"), the control, and `state.fieldErrors?.<field>` rendered below in `text-destructive text-sm` with `aria-describedby` wiring + `aria-invalid` on the control.
  - Submit: brand primary `Button` ("Створити турнір" — EXPERIENCE.md Voice verb button; one primary per screen). `disabled={pending}`, `aria-busy={pending}`, inline `<Loader2Icon className="animate-spin" />` while `pending` (the Story 2.2 pattern from `GrantAdminButton`).
  - **UX-DR11 — the form keeps its input on error.** React 19 resets an uncontrolled `<form action>` on submit. Counter it: every control's `defaultValue` / `defaultChecked` reads from `state.values?.<field>` (the raw strings the action echoes back). This is the documented React 19 form-reset workaround — do not skip it, and verify it in the walkthrough (submit an invalid form, confirm the valid fields survive).
  - `state.formError` → `useEffect(() => { if (state.formError) notify.error(state.formError); }, [state])` (`@/lib/notify` — the Story 2.2 helper; never `toast` directly).
- **shadcn form primitives — add `input`, `label`, `select`.** `pnpm dlx shadcn@latest add input label select` (base-nova preset, `components.json` is configured). If the registry is unreachable offline, hand-write minimal versions: `Input` = `<input>` with the base-nova classes (`h-8 rounded-sm border border-input bg-background px-2.5 text-sm …`; `rounded-sm` = 7px per DESIGN.md "інпути … sm 7px"); `Label` = `<label>` with `text-sm font-medium`; `Select` = a styled native `<select>` (fully accessible, zero-JS, and `color-scheme: light` already pins native control rendering) — a native `<select>` is a **sanctioned simplification** for 2–4 static options if the base-ui `Select` (a popover combobox) proves heavy. Whichever route, the controls stay visually as-is per DESIGN.md ("Input, Select … as-is зі shadcn").
- **The page — `src/app/admin/tournaments/new/page.tsx` (NEW, Server Component).** Under the `/admin` layout (already `requireAdminPage()` + `force-dynamic`). Renders a back-link to `/admin`, an `<h1>` "Створити турнір" (`text-2xl font-bold` — the `/admin/people` pattern; the DESIGN `display` type-scale token is still deferred), and `<TournamentForm />`. `export const metadata = { title: "Створити турнір" }`.
- **The redirect target — `src/app/admin/tournaments/[id]/page.tsx` (NEW, minimal stub).** The AC says "redirected to the tournament page"; EXPERIENCE.md IA puts tournament management at `/admin/tournaments/[t]`. This story ships the **stub only**: `await requireAdminPage()` is already handled by the layout; fetch via `getTournamentForAdmin(id)`; `notFound()` if missing; render the tournament name, its type/year/preset, the state ("Чернетка"), and a line "Заявка команд і жеребкування — у наступних історіях." Stories 2.5 (edit/delete), 2.7 (enrol), 2.8 (roster), 3.3 (draw) build this page out — it is a shared surface, extended not rebuilt (the `epics.md` principle for FR-25). **No `StatusBadge`** (Story 2.9 / UX-DR7). `export function generateMetadata` or a static title is fine.
- **`/admin` dashboard — `src/app/admin/page.tsx` (UPDATE).** Add a "Турніри" / "Створити турнір" link next to "Керування адмінами" so the new page is reachable. Small nav edit; the dashboard's "Керування турнірами зʼявиться в наступних історіях" line can go.
- **Scope guard. In scope:** `Group` model + `Tournament` `@@unique` + one additive migration; `src/domain/tournamentForm.ts` (`allowedTournamentTypes`, bounds, `validateNewTournament`) + its Vitest spec; `createTournamentRecord` in `src/data/tournaments.ts`; `createTournament` in `src/actions/tournaments.ts`; `src/components/tournament-form.tsx`; `src/app/admin/tournaments/new/page.tsx` + `src/app/admin/tournaments/[id]/page.tsx` (stub); the `shadcn add` of `input` / `label` / `select`; the `/admin` dashboard link; doc updates. **Not in scope:** editing / deleting a tournament (Story 2.5); the group-stage parameter lock after the draw (Story 2.5 / FR-6); team enrolment (2.7), roster (2.8); the public tournament page and the `DRAFT` 404-for-viewer (Story 2.9); the draw and `GroupSlot` / `Match` / `SetScore` (Epic 3); the `transitionTournament` call to `GROUP_STAGE` (Story 3.3 — the draw owns it); the per-set target rule (25/15 — Epic 3 `validation.ts`); the `StatusBadge` component (2.9); the DESIGN type-scale tokens (still deferred, no `display` heading here beyond the `text-2xl` the admin pages already use); a `Select` for anything beyond `type` / `scoringPreset`.

## Tasks / Subtasks

- [x] **Task 1 — shadcn form primitives** (AC: the form)
  - [x] `pnpm dlx shadcn@latest add input label select` — created the 3 files but (a) added a bogus `"cn": "^0.2.4"` npm dependency and (b) generated `import { cn } from "cn"` in all three. Removed the dep, fixed the imports to `@/lib/utils`.
  - [x] Kept `input.tsx` (radius corrected `rounded-lg` → `rounded-sm` per DESIGN.md Shapes) and `label.tsx`. **Deleted `select.tsx`** — the base-ui `Select` is a portal/positioner/scroll-arrow popover, overkill for 2–4 static options and awkward inside a `<form action>` (needs hidden-input wiring); using a styled native `<select name>` in the form instead (sanctioned by the AC note: "a native `<select>` is a sanctioned simplification for 2–4 static options"). Zero-JS, `FormData`-native, `color-scheme: light` pins its rendering.
  - [x] `pnpm lint` + `pnpm typecheck` clean.
- [x] **Task 2 — `src/domain/tournamentForm.ts` (NEW) + Vitest spec** (AC: 1, 2; deferred `allowedTypes` helper)
  - [x] Pure module — local `Discipline` / `TournamentType` / `ScoringPreset` unions with a "must track `schema.prisma`" note. No forbidden imports.
  - [x] Exports: `TOURNAMENT_TYPES`, `SCORING_PRESETS` (`as const satisfies …`), `allowedTournamentTypes`, all numeric bounds, `NewTournamentInput`, `TournamentField`, `FieldErrors`, `RawTournamentInput`, `validateNewTournament`.
  - [x] `validateNewTournament(raw)` — trims `name`; `toInteger` helper rejects non-integers / floats / `NaN` / missing; range-checks `year` / `teamCount` / `rounds`; rejects unknown `discipline` / `type` (via `allowedTournamentTypes`) / `scoringPreset`; Ukrainian per-field messages; collects **all** failing fields.
  - [x] `src/domain/tournamentForm.test.ts` — 14 tests: helper both disciplines; valid input (trim + coercion); every type × preset; bound edges; every bound/format violation → right field key; BEACH → no valid type; all-fields-fail case lists all 6 keys; messages are Cyrillic.
  - [x] `pnpm test` → 2 files, 39 tests pass (25 `tournamentState` + 14 `tournamentForm`). `typecheck` + `lint` clean.
- [ ] **Task 3 — Prisma: `Group` model + `Tournament` natural key + migration** (AC: 1)
  - [ ] `prisma/schema.prisma` — add the `Group` model (shape above); add `group Group?` to `Tournament`; add `@@unique([discipline, type, year, name])` to `Tournament` (keep the existing `@@index([discipline, state, year])`).
  - [ ] `pnpm prisma generate` — new types compile (`Group` in `@/generated/prisma/client`).
  - [ ] **HALT and confirm with the user**, then `pnpm prisma migrate dev --name tournament_group_and_natural_key` (direct URL via `prisma7.config.ts`; the Neon role has `CREATEDB` for the shadow DB — Story 1.4/2.1). Additive only — inspect the generated `migration.sql`: it must be `CREATE TABLE "group"` + `CREATE UNIQUE INDEX` (group `tournamentId`) + `CREATE UNIQUE INDEX` (the natural key) + the FK. **No `DROP`, no `ALTER` on existing tables' data.** If `migrate dev` proposes anything destructive, STOP and hand-write the additive migration, then `pnpm prisma migrate deploy` (the Story 1.5/2.1 fallback).
  - [ ] `pnpm prisma migrate status` → "up to date"; `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → "No difference detected." Commit `migration.sql` (never hand-edit after apply).
  - [ ] Extend `scripts/db-check.mts` with a `db.group.count()` (returns `0`).
- [ ] **Task 4 — `src/data/tournaments.ts` (UPDATE): `createTournamentRecord`** (AC: 1, 2, 4)
  - [ ] `import type { NewTournamentInput } from "@/domain/tournamentForm"` — the `data → domain` type import is allowed (lint does not block it; `src/README.md` sanctions `data → domain` for read-time computation, and a type import is inert). Alternatively keep the input type local to `src/data` — dev's call; prefer the shared domain type to avoid a third declaration.
  - [ ] `export function createTournamentRecord(input: NewTournamentInput): Promise<{ id: string }>` — `db.tournament.create({ data: { discipline: input.discipline, type: input.type, name: input.name, year: input.year, scoringPreset: input.scoringPreset, teamCount: input.teamCount, rounds: input.rounds, group: { create: {} } }, select: { id: true } })`. The nested `group: { create: {} }` makes the `Tournament` + `Group` insert one atomic statement. **No `state`** — it defaults to `DRAFT`.
  - [ ] Doc comment: the sole creator of a `Tournament` (+ its `Group`); `state` is never set here (defaults `DRAFT`; changed only by `transitionTournament`).
  - [ ] Lint: `src/data/**` imports only `@/data/client` + generated types + (now) a `@/domain` type. No `next` / `react` / `actions` / `auth`.
- [ ] **Task 5 — `src/actions/tournaments.ts` (UPDATE): `createTournament`** (AC: 3, 4)
  - [ ] `"use server"` (already at the top of the file). Add imports: `redirect` from `next/navigation`, `validateNewTournament` + `type NewTournamentInput` from `@/domain/tournamentForm`, `createTournamentRecord` from `@/data/tournaments`, `AdminRequiredError` from `@/auth/requireAdmin` (for the narrowed catch). Keep the existing `transitionTournament` untouched.
  - [ ] `export type CreateTournamentState = { fieldErrors?: Partial<Record<keyof NewTournamentInput, string>>; formError?: string; values?: Partial<Record<keyof NewTournamentInput, string>> }`.
  - [ ] `export async function createTournament(_prev: CreateTournamentState, formData: FormData): Promise<CreateTournamentState>` — body per the AC note (requireAdmin → validate → `{ fieldErrors, values }` on invalid → `createTournamentRecord` → `redirect` outside the try → narrowed `catch` for `P2002` / `AdminRequiredError`, re-throw the rest).
  - [ ] `P2002` detection: check `error` shape — `error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"`. **But `Prisma` cannot be imported here** (`src/actions` may not import the Prisma client). Options: (a) a small `src/data` helper `isUniqueViolation(error): boolean` that does the check (it may import `Prisma`); (b) duck-type `error && typeof error === "object" && "code" in error && error.code === "P2002"`. **Prefer (a)** — a named `src/data` export keeps the Prisma coupling in the one layer that owns it. Add `isUniqueViolation` to `src/data/tournaments.ts` (or a new `src/data/errors.ts`).
  - [ ] Build `values` from the raw `formData` strings (`String(formData.get("name") ?? "")`, …) so the form repopulates.
- [ ] **Task 6 — `src/components/tournament-form.tsx` (NEW)** (AC: the form; UX-DR11)
  - [ ] `"use client"`; `useActionState(createTournament, {})`; `<form action={formAction} className="…">`. Fields per the AC note, `Label` above each control, per-field error text + `aria-invalid` / `aria-describedby`.
  - [ ] Every control's `defaultValue` / `defaultValue`-equivalent reads `state.values?.<field>` (with the `year` fallback to the current year, `scoringPreset` fallback `"CLASSIC"`, `rounds` fallback `"1"`). This is the React 19 form-reset workaround — required by UX-DR11.
  - [ ] `useEffect` → `notify.error(state.formError)` when `state.formError` is set.
  - [ ] Submit `Button` — brand `default` variant (primary), "Створити турнір", `disabled={pending}`, `aria-busy={pending}`, inline spinner while `pending`.
  - [ ] Ukrainian type / preset labels — a local `const TYPE_LABELS: Record<TournamentType, string>` / `PRESET_LABELS` in the component (view layer owns display copy; the domain owns the values). Do not centralise in `src/lib` for two tiny maps unless a second consumer appears.
  - [ ] `src/components/**` lint: no `@/auth`, no `@/data`, no Prisma. It imports `@/actions/tournaments` (the sanctioned `view → shell` edge), `@/domain/tournamentForm` (for the type list + `TournamentType` type — `view → domain` is allowed; `src/components/**` is only blocked from `@/auth`), `@/components/ui/*`, `@/lib/notify`, `lucide-react`, `react`.
- [ ] **Task 7 — Pages** (AC: 3)
  - [ ] `src/app/admin/tournaments/new/page.tsx` (NEW) — Server Component; back-link to `/admin`, `<h1>Створити турнір</h1>`, `<TournamentForm />`; `metadata = { title: "Створити турнір" }`.
  - [ ] `src/app/admin/tournaments/[id]/page.tsx` (NEW, stub) — `const { id } = await params` (Next 16 async params); `const tournament = await getTournamentForAdmin(id)`; `if (!tournament) notFound()`; render name + type/year/preset + "Чернетка" + the "наповнення в наступних історіях" line + a back-link to `/admin`. `generateMetadata` returns the tournament name as title (or a static "Турнір").
  - [ ] Confirm the `/admin` layout's `requireAdminPage()` + `force-dynamic` covers both new routes (they are under `/admin/**`).
- [ ] **Task 8 — `/admin` dashboard link** (AC: 3 — reachability)
  - [ ] `src/app/admin/page.tsx` (UPDATE) — add a `<Link href="/admin/tournaments/new">Створити турнір</Link>` (and/or a "Турніри" heading). Drop or update the "Керування турнірами зʼявиться в наступних історіях" copy.
- [ ] **Task 9 — Docs**
  - [ ] `src/domain/README.md` — add `tournamentForm.ts` to `## Modules` (allowed types, numeric bounds, `validateNewTournament`).
  - [ ] `src/data/README.md` — under `tournaments.ts`, add `createTournamentRecord` (sole `Tournament` + `Group` creator; `state` defaults `DRAFT`) and `isUniqueViolation` if placed there.
  - [ ] `src/actions/README.md` — under `tournaments.ts`, add `createTournament` (form-state shape, `redirect` on success, `P2002` → duplicate message).
  - [ ] `src/components/README.md` — add `tournament-form.tsx` (the `useActionState` + `defaultValue`-from-state form-reset workaround; `notify.error` on `formError`).
  - [ ] `AGENTS.md` — "Stack status": one line — Story 2.4 (`createTournament` action + form; `Group` model added, natural key `@@unique([discipline, type, year, name])`, migration `<ts>_tournament_group_and_natural_key`; `src/domain/tournamentForm.ts`; `/admin/tournaments/new` + `[id]` stub). Note `Group`'s slots/matches are still Epic 3.
  - [ ] No `ARCHITECTURE-SPINE.md` / `EXPERIENCE.md` / `epics.md` / `SPEC.md` edit — the ER diagram already shows `Tournament ||--|| Group`, and the flow is in EXPERIENCE.md KF-1.
- [ ] **Task 10 — `deferred-work.md` (UPDATE)**
  - [ ] Mark **resolved**: 2.1 "`Tournament` has no natural-key uniqueness" (added `@@unique`), 2.1 "`discipline` + `type` combination is unconstrained" (the `allowedTournamentTypes` helper + the form hardcodes `CLASSIC`), 2.1 "`P2002` … has no `{ ok: false, code }` mapping" (partially — `createTournament` now catches `P2002`; 2.6 / 2.7 still owe theirs).
  - [ ] Add a note under a **Story 2.4** heading: the `Group` model landed here as a structural anchor (`tournamentId @unique`, no other columns); **Story 3.2's migration must add only `GroupSlot` / `Match` / `SetScore` + the `Group.slots` / `Group.matches` relations**, not re-create `Group`. Also: `teamCount` lower bound is `4` (v1 4-team playoff) — revisit if group-only tournaments become a v1 need.
- [ ] **Task 11 — Verification gate** (AC: all)
  - [ ] `pnpm test` (the `tournamentForm` + `tournamentState` specs green) · `pnpm typecheck` exit 0 · `pnpm lint` exit 0 · `pnpm build` clean on Node 24.
  - [ ] `migrate status` up to date; `migrate diff` empty (Task 3).
  - [ ] Build route table — **new**: `/admin/tournaments/new` and `/admin/tournaments/[id]` both `ƒ` (dynamic, under the `force-dynamic` `/admin` layout). Everything else unchanged from Story 2.3.
  - [ ] Import-boundary greps: `grep -rn "@prisma/client\|generated/prisma" src/` → only `src/data/**` + `src/generated/**` (the new `src/data/tournaments.ts` Prisma use is fine; `src/domain/tournamentForm.ts` and the form component must not appear). `grep -rn "\"next\"\|next/" src/domain/` → nothing.
  - [ ] **Browser walkthrough** (`pnpm dev` on a spare port + Chrome tools, signed in as the seed admin — or `curl` for the non-interactive parts, the Story 1.8 / 2.2 rig):
    - `/admin/tournaments/new` renders the form (all 6 fields, labels above, primary "Створити турнір").
    - Submit **valid** → row created in `DRAFT` with one `Group` (confirm via `db-check` / a quick `prisma studio` or a `select` in `scripts`), redirect lands on `/admin/tournaments/<id>` showing the name + "Чернетка".
    - Submit **invalid** (empty name, year 1999, teamCount 3) → stays on the form, every bad field shows its message, **the valid fields keep their values** (the UX-DR11 check — verify `year`/`type` survive after fixing `name`).
    - Submit a **duplicate** (same type + year + name) → `notify.error` toast "Турнір з такою назвою вже існує за цей рік.", form keeps input, no second row.
    - Non-admin / signed-out hitting `/admin/tournaments/new` → redirected by the layout (`/sign-in` or `/?error=admin-required`) — the Story 1.6 behaviour, unchanged.
    - The `createTournament` action rejects a forged non-admin POST on the server (not just the hidden UI) — `requireAdmin()` first line.
  - [ ] Capture every command's real output + the walkthrough notes in the Dev Agent Record — verifiable, not asserted (Stories 1.1–2.3 pattern).
- [ ] **Task 12 — Commit(s)** — per the standing instruction, **commit after each completed task and `git push origin main`** (memory: "commit after each task"). Suggested grouping if committing per-task is impractical mid-migration: (1) shadcn primitives + domain helper + spec; (2) schema + migration (after the user confirms `migrate dev`); (3) data + action; (4) form + pages + dashboard link; (5) docs + deferred-work. Each commit message references its task; trailers `Co-Authored-By` / `Claude-Session`. Push after each. `build` gates every commit — do not push a red build. The final push deploys to Vercel prod; the migration reaches prod via `migrate deploy` in `build` (already applied locally → no-op).

## Dev Notes

### What this story is / is NOT

**Is:** the create-tournament feature — a `src/domain/tournamentForm.ts` validator + `allowedTournamentTypes` helper (unit-tested), a `Group` model + a `Tournament` natural key (one additive migration), `createTournamentRecord` in `src/data`, the `createTournament` Server Action (`useActionState` form-state shape, `redirect` on success, `P2002` → duplicate), the `<TournamentForm>` client component, the `/admin/tournaments/new` page and a **minimal** `/admin/tournaments/[id]` stub, the shadcn `input` / `label` / `select` primitives, and an `/admin` dashboard link.

**Is NOT** (do not pull forward):
- **Edit / delete a tournament**, the group-stage parameter lock after the draw → **Story 2.5** (FR-6).
- **Team enrolment** (2.7), **roster** (2.8), the **public tournament page** + `DRAFT` 404-for-viewer (2.9).
- **The draw**, `GroupSlot` / `Match` / `SetScore`, the `Group.slots` / `Group.matches` relations, and the `transitionTournament(id, "GROUP_STAGE")` call → **Epic 3** (Story 3.3 owns the transition + calendar).
- **The per-set target rule** (25 / 15 / veteran 15 / decider 15) → **Epic 3** `src/domain/validation.ts` (`scoringPreset` is only *stored* here).
- **`StatusBadge`** (state → pill) → **Story 2.9** / UX-DR7. The `[id]` stub shows plain text "Чернетка".
- **DESIGN type-scale tokens** (`display` 32 / `display-sm` 24) → still deferred; the pages use `text-2xl font-bold` like `/admin/people`.
- **A `Select` / RadioGroup for anything beyond `type` and `scoringPreset`.**
- **Multi-group** — `Group.tournamentId` is `@unique` (v1 = one group); relaxing it is post-v1 (already deferred).

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/components/ui/input.tsx` · `label.tsx` · `select.tsx` | NEW | `shadcn add` (base-nova); hand-write if offline. `Input` `rounded-sm` (7px). |
| `src/domain/tournamentForm.ts` | NEW | Pure. `allowedTournamentTypes`, bounds, `validateNewTournament`. Local unions (track `schema.prisma`). |
| `src/domain/tournamentForm.test.ts` | NEW | Vitest — helper + every bound + multi-error. |
| `prisma/schema.prisma` | UPDATE | + `Group` model, + `Tournament.group Group?`, + `@@unique([discipline, type, year, name])`. |
| `prisma/migrations/<ts>_tournament_group_and_natural_key/migration.sql` | NEW (generated) | Additive: `CREATE TABLE "group"` + 2 `CREATE UNIQUE INDEX` + FK. HALT+confirm before `migrate dev`. |
| `scripts/db-check.mts` | UPDATE | + `db.group.count()`. |
| `src/data/tournaments.ts` | UPDATE | + `createTournamentRecord` (Tournament + Group, atomic), + `isUniqueViolation` (or `src/data/errors.ts`). |
| `src/actions/tournaments.ts` | UPDATE | + `createTournament` + `CreateTournamentState`. `transitionTournament` untouched. |
| `src/actions/result.ts` | DO NOT TOUCH | `createTournament` uses its own form-state shape, not `ActionResult` (skip a `DUPLICATE` code). |
| `src/components/tournament-form.tsx` | NEW | `"use client"`, `useActionState`, `defaultValue`-from-state (UX-DR11), `notify.error` on `formError`. |
| `src/app/admin/tournaments/new/page.tsx` | NEW | Server Component; renders `<TournamentForm />`. |
| `src/app/admin/tournaments/[id]/page.tsx` | NEW | Minimal stub — name + state + "наступні історії"; `notFound()` if missing. |
| `src/app/admin/page.tsx` | UPDATE | + "Створити турнір" link. |
| `src/{domain,data,actions,components}/README.md` · `AGENTS.md` · `deferred-work.md` | UPDATE | Module entries + Stack status + resolved/added deferred items. |
| `src/app/admin/layout.tsx` | DO NOT TOUCH | Already `requireAdminPage()` + `force-dynamic` — covers the new routes. |
| `src/generated/prisma/**` | REGENERATED | git-ignored; `postinstall` / `build` regenerate. |

### Architecture compliance

- **AD-1 / layers** — the form is View (`src/components`, Client Component for state), the page is View (Server Component), `createTournament` is Shell (`src/actions`), `createTournamentRecord` is Data, `validateNewTournament` / `allowedTournamentTypes` are Domain (pure). [ARCHITECTURE-SPINE.md#Design Paradigm]
- **AD-2 — domain is pure.** `src/domain/tournamentForm.ts` imports nothing internal, no `next`, no Prisma, no `react`. It re-declares the enums as string unions (the `tournamentState.ts` precedent). [ARCHITECTURE-SPINE.md#AD-2]
- **AD-3 — dependency direction.** `view → shell → {domain, data}`. The form imports `@/actions/tournaments` (sanctioned `view → shell`) and `@/domain/tournamentForm` (`view → domain` — allowed; `src/components/**` is lint-blocked only from `@/auth`). `src/data/tournaments.ts` importing a **type** from `@/domain` is permitted (`src/README.md`: `data → domain` is not lint-blocked; a type import is inert). `src/actions` → `src/data` + `src/domain` + `src/auth`. [src/README.md · eslint.config.mjs]
- **AD-6 — every mutation is a Server Action under `requireAdmin()`.** `createTournament`'s first line is `await requireAdmin()`; the `src/data` write is unreachable without it. A forged non-admin POST is rejected on the server, not just hidden. [ARCHITECTURE-SPINE.md#AD-6]
- **AD-7 — public reads bypass auth and hide drafts; admin reads are separate.** `getTournamentForAdmin` (Story 2.3) is the admin read used by the `[id]` stub, under the `requireAdminPage()` layout. The public tournament page + its `state != DRAFT` filter is **Story 2.9**. [ARCHITECTURE-SPINE.md#AD-7]
- **AD-8 — `state` changes only via `transitionTournament`.** `createTournamentRecord` does **not** set `state` — it relies on the schema default `DRAFT`. No `src/data` function takes a `state` argument (Story 2.3 invariant, still holds). [ARCHITECTURE-SPINE.md#AD-8]
- **AD-9 — v1 filters `CLASSIC`.** The form hardcodes `discipline: "CLASSIC"`; `allowedTournamentTypes` returns `[]` for `BEACH`. `BEACH` stays inert. [ARCHITECTURE-SPINE.md#AD-9]
- **AD-10 — schema only via migrations.** The `Group` model + natural key land in one versioned additive migration; `migrate dev` against the one Neon DB **after user confirmation** (AGENTS.md policy — no dev branch). [ARCHITECTURE-SPINE.md#AD-10]
- **AD-11 — `src/data` is the sole Prisma owner.** `createTournamentRecord` + `isUniqueViolation` (Prisma error typing) live in `src/data`; the action and form never import Prisma. [ARCHITECTURE-SPINE.md#AD-11]
- **AD-4 — standings never stored.** `Group` is a structural anchor with no computed columns; the standings table is still computed on read (Epic 3). [ARCHITECTURE-SPINE.md#AD-4]
- **Consistency Conventions** — verb-named action (`createTournament`); `redirect` after the write (EXPERIENCE.md); UA-only copy, no i18n lib; `cuid` ids; the form's field errors are Ukrainian sentences; `revalidatePath` is not needed (a `redirect` to a fresh dynamic route re-renders). [ARCHITECTURE-SPINE.md#Consistency Conventions]
- **DESIGN.md** — `Input` / `Select` as-is shadcn (`rounded-sm` 7px for inputs); one primary `Button` per screen ("Створити турнір"); labels above fields; content `max-w-[1120px]` (admin forms same width). [DESIGN.md#Components, #Layout & Spacing, #Shapes]
- **EXPERIENCE.md** — KF-1 step 1 (Олег на `/admin/tournaments/new`, обирає тип / систему очок / 6 команд / 1 коло, турнір у Чернетці); §Interaction Primitives ("Навігація після дії: створення турніру → на сторінку турніру (Чернетка)"; "Кнопка на час запиту — `disabled` + спінер у кнопці"); §State Patterns ("Помилка Server Action → Toast `destructive`; форма лишає введені дані" — UX-DR11); §Voice (verb button, plain Ukrainian, no exclamation marks). [EXPERIENCE.md]

### Existing code being modified — current state → change → what must be preserved

**`src/actions/tournaments.ts`** (Story 2.3)
- *Current:* `"use server"`; exports `transitionTournament(tournamentId, targetState) → ActionResult<{ state }>` (requireAdmin → getTournamentForAdmin → checkTransition → setTournamentState → revalidatePath → try/catch/toActionError).
- *Change:* add `createTournament` + `CreateTournamentState`. New imports (`redirect`, domain validator, `createTournamentRecord`, `AdminRequiredError`).
- *Must preserve:* `transitionTournament` verbatim — its signature, the `checkTransition` gate, the `revalidatePath` calls (the Story 2.3 review patched these), the `toActionError` catch. Do not refactor it to share a helper with `createTournament` — they have different result shapes.

**`src/data/tournaments.ts`** (Story 2.3)
- *Current:* `getTournamentForAdmin(id)`, `countTournamentEntries(tournamentId)`, `setTournamentState(id, state)` (sole `state` writer). Imports `@/data/client` + `type { TournamentState }` from generated enums.
- *Change:* add `createTournamentRecord(input)` and (optionally) `isUniqueViolation(error)`.
- *Must preserve:* `setTournamentState` stays the ONLY function that writes `state`; `createTournamentRecord` must **not** pass `state` (default `DRAFT`). The three existing functions unchanged.

**`src/actions/result.ts`** (Stories 1.6 / 2.3) — *do not modify.* `createTournament` deliberately does not use `ActionResult` (forms use `useActionState` state, not `{ ok, code, message }`). The Story 2.3 `ActionErrorCode` members stay as-is.

**`src/app/admin/page.tsx`** (Story 1.7)
- *Current:* `<h1>Адмін-зона</h1>` + "Керування турнірами зʼявиться в наступних історіях." + a single `<Link href="/admin/people">`.
- *Change:* add the `/admin/tournaments/new` link; drop / update the "наступних історіях" line.
- *Must preserve:* the `mx-auto w-full max-w-2xl px-4 py-8` shell, `metadata`, the `/admin/people` link.

**`prisma/schema.prisma`** (Story 2.1 + 2.3-era, unchanged by 2.3) — `Tournament` / `Team` / `TournamentEntry` / `Player` + 4 enums, all `@db.Timestamptz(3)`, `Tournament` `@@index([discipline, state, year])`. Add `Group` + the relation + the `@@unique`. `generator` / `datasource` blocks unchanged.

**`scripts/db-check.mts`** (Story 2.1) — imports the generated `Discipline` enum, `count()`s every table + a `CLASSIC` `findMany({ take: 100 })`. Add `group`.

### Migration against the one production database (carried since 1.4 / 2.1)

- There is a **single Neon Postgres** — no dev/staging branch. `prisma7.config.ts` points the CLI at the direct URL. `pnpm prisma migrate dev --name tournament_group_and_natural_key` **applies to production** on this setup. It is additive (`CREATE TABLE` / `CREATE UNIQUE INDEX` / FK) — non-destructive, adds one empty table and two indexes — but **HALT and get the user's OK first** (AGENTS.md policy; the Story 2.1 pattern).
- `migrate reset` is **blocked** (Prisma AI-agent gate + prod DB). "Applies cleanly on an empty DB" is argued from the clean `migrate dev` apply (the same argument Stories 1.4 / 2.1 used).
- `build` = `prisma generate && node scripts/migrate-deploy.mjs && next build`; `migrate-deploy.mjs` runs `migrate deploy` when `VERCEL_ENV` is `production` or unset. After a local `migrate dev` + push, the prod deploy's `migrate deploy` finds the migration already applied → no-op.
- The natural-key `@@unique` — the `tournament` table is empty, so the `CREATE UNIQUE INDEX` cannot fail on existing duplicates. If it ever had rows, the migration would need a dedup step first — not a concern now.

### Testing requirements

- **Unit (Vitest, the Story 2.3 runner):** `src/domain/tournamentForm.test.ts` — `allowedTournamentTypes` both disciplines; `validateNewTournament` happy path (coerced numbers, trimmed name) and **every** bound violation with the right field key; multiple simultaneous errors all surface. This is the deterministic core — the form and action are thin over it.
- **Not unit-tested (no infra):** `createTournament` (the `requireAdmin` gate, the `redirect`, the `P2002` catch) and `createTournamentRecord` (the atomic Tournament+Group insert) — same gap as `transitionTournament` (Story 2.3, deferred). Gate = `typecheck` + `lint` + the **browser walkthrough** (Task 11) + code review. The walkthrough is the real check here: valid create + redirect, every validation-error path with the UX-DR11 field-survival check, the duplicate toast, the non-admin redirect, and a DB confirmation that exactly one `Tournament` + one `Group` row appear.
- **Regression:** `pnpm test` (both domain specs), route table (2 new `ƒ` routes, rest unchanged), `migrate status` / `diff` in sync, import-boundary greps clean.
- Capture real command output + walkthrough notes in the Dev Agent Record.

### Previous story intelligence

**Story 2.3 (done, `f202fae`):** established `src/actions/tournaments.ts` + `src/data/tournaments.ts` + the Vitest runner (`vitest.config.mts`, `environment: node`, `include: ["src/**/*.{test,spec}.{ts,mts,tsx}"]`, `@/` alias — the review widened the glob + added the alias, so a `tournamentForm.test.ts` resolves fine). `src/domain/tournamentState.ts` is the precedent for a pure domain module with locally-declared string unions + a `//` "must track schema.prisma" comment. `getTournamentForAdmin` exists — reuse it for the `[id]` stub. The Story 2.3 review deferred action-layer coverage (no session mock) — `createTournament` inherits that gap; do not try to solve it here. `deferred-work.md` has a "Story 2.3 implementation" section — add a "Story 2.4" note under it or a new section.

**Story 2.2 (done):** `notify` (`@/lib/notify` — always use it, never `toast` directly), `ConfirmDialog`, `Skeleton` / `TableSkeleton` / `CardSkeleton`, `EmptyState` + `src/lib/empty-states.ts`. The `GrantAdminButton` spinner pattern (`{pending ? <Loader2Icon className="animate-spin" /> : null}` + `aria-busy`) is the model for the submit button. `no-alert` ESLint rule is active. `src/components/README.md` is the doc home for view primitives.

**Story 2.1 (done):** `Tournament` schema + the four enums (generated as `const X = {…} as const` + `type X` union in `src/generated/prisma/enums.ts`). The `db-check.mts` extension pattern + the "confirm before `migrate dev`" + "inspect `migration.sql` for `DROP`" workflow. Deferred items this story resolves: natural key, `discipline`+`type` constraint, `P2002` mapping (partial), and the `Group` question.

**Story 1.7 (done):** `src/app/admin/people/page.tsx` is the admin-page shell to copy (`mx-auto w-full max-w-2xl px-4 py-8`, back-link, `<h1 className="text-2xl font-bold">`, `metadata`). `admin-role-controls.tsx` — the Client-Component-calls-Server-Action pattern (though it uses `useTransition` + direct call, not `useActionState` + `<form>`; `createTournament` is a real multi-field form so `useActionState` is the right fit). `src/app/admin/layout.tsx` = `requireAdminPage()` + `export const dynamic = "force-dynamic"` — covers `/admin/tournaments/**`.

### Git intelligence

Recent: `f202fae` (2.3 state machine + Vitest) ← `777cc77` (2.2 review) ← `4f5afd4` (2.2) ← `15cf8e6` (2.1 review) ← `9bfa73d` (2.1 schema). `src/actions/` = `result.ts`, `admin-roles.ts`, `tournaments.ts` (`transitionTournament`), `README.md`. `src/data/` = `client.ts`, `users.ts`, `tournaments.ts` (3 fns), `README.md`. `src/domain/` = `README.md`, `tournamentState.ts` (+ spec). `src/components/ui/` = avatar, button, card, dialog, dropdown-menu, skeleton, sonner — **no input / label / select**. `prisma/migrations/` = 5 (through `20260903204803_tournament_schema_constraints`). No `Group` anywhere. `vitest.config.mts` present, `pnpm test` wired. `.claude/` + `_bmad/` are git-ignored.

### Latest tech information

- **React 19.2 `useActionState`** — `const [state, formAction, isPending] = useActionState(action, initialState)`; `action` is `(prevState, formData) => Promise<State>`; use `<form action={formAction}>`. **Known trap:** an uncontrolled `<form action={…}>` **resets its fields on submit** in React 19. To satisfy UX-DR11 ("форма лишає введені дані" on error), the action must echo the raw submitted values back in its returned state and every control must read `defaultValue={state.values?.<field>}`. ([react.dev/blog/2024/12/05/react-19](https://react.dev/blog/2024/12/05/react-19), [nextjs.org/docs/app/guides/forms](https://nextjs.org/docs/app/guides/forms), [aurorascharff.no — form validation & resets with useActionState](https://aurorascharff.no/posts/handling-form-validation-errors-and-resets-with-useactionstate/))
- **Next 16 — `redirect()`** from a Server Action: `import { redirect } from "next/navigation"`; it throws a `NEXT_REDIRECT` control-flow error — must not be caught/swallowed (call it outside the `try`, or re-throw non-domain errors). Dynamic route params are async: `const { id } = await params`.
- **shadcn/ui (base-nova preset, `@base-ui/react`)** — `pnpm dlx shadcn@latest add input label select`. `Input` and `Label` are thin. `Select` is `@base-ui/react/select` (a popover combobox) — for 2–4 static options a styled native `<select>` is a legitimate, lighter, fully-accessible alternative (`color-scheme: light` already pins native rendering).
- **Prisma 7** — nested `create` (`tournament.create({ data: { …, group: { create: {} } } })`) is a single atomic write; no explicit `$transaction` needed. `PrismaClientKnownRequestError` `.code === "P2002"` for a unique violation; keep that check in `src/data` (the layer allowed to import `Prisma`).
- **Vitest 4.1** (Story 2.3) — `pnpm test`; `include` already covers `src/**/*.{test,spec}.{ts,mts,tsx}` and the `@/` alias resolves.
- No new runtime dependency beyond the shadcn primitives (which are source files, not packages). No security advisories.

### Project context reference

No `project-context.md`. Binding docs: `epics.md` (Story 2.4 AC + Epic 2 intro + the "per-epic schema" and "shared tournament page" principles + Stories 2.5 / 2.9 / 3.2 / 3.3 boundaries), `glossary.md` ("Тип турніру" — the four Ukrainian labels; "Система очок"; "Правила турніру"; "Група" — "у v1 Турнір має рівно одну Групу; розмір задає адмін"; "Стан турніру"), `SPEC.md` (CAP-2 create/lifecycle, CAP-3 rules config, Constraints — one group / CLASSIC only / the two presets / UA-only), `ARCHITECTURE-SPINE.md` (AD-1, AD-2, AD-3, AD-6, AD-7, AD-8, AD-9, AD-10, AD-11, Consistency Conventions, the `Tournament ||--|| Group` ER diagram, "Дерево коду" — `src/actions/tournament`), `DESIGN.md` (Input/Select as-is, `rounded-sm` inputs, one primary button, labels above, brand primary Button), `EXPERIENCE.md` (IA route table `/admin/tournaments/new` + `/[t]`; KF-1 step 1; §Interaction Primitives navigation-after-action + pending button; §State Patterns UX-DR11; §Voice), `2-1-tournament-team-player-schema.md` (the schema, the enum shape, the `Group` + natural-key + `P2002` deferred items, the `migrate dev` workflow), `2-2-reusable-ux-patterns.md` (`notify`, the spinner pattern, `src/components/README.md`), `2-3-tournament-state-machine.md` (`src/actions/tournaments.ts` + `src/data/tournaments.ts` + the Vitest runner + `getTournamentForAdmin` + the `data → domain` type-import precedent + the deferred action-coverage gap), `1-7-admin-management.md` (the admin-page shell, the layout guard), `deferred-work.md` (the 2.1 items to resolve).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4: Створити турнір] — user story + AC (type/name/year/preset/teamCount/rounds; `DRAFT` + one `Group`; preset stored; redirect; Server Action under `requireAdmin()`)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2] — "Додає власною міграцією сутності … вводить розширюваний патерн … компоненти … багаторазові патерни"
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2 / 3.3] — `Group` / `GroupSlot` / `Match` / `SetScore` migration and the draw own the group's contents and the `→ GROUP_STAGE` transition
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#CAP-2, #CAP-3, #Constraints] — create & lifecycle; rules config drives scoring; one group; two presets; CLASSIC only; UA-only
- [Source: _bmad-output/specs/spec-cherkasy-volley/glossary.md] — Тип турніру (4 labels), Система очок, Правила турніру, Група ("рівно одна … розмір задає адмін"), Стан турніру
- [Source: _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md#AD-6, #AD-8, #AD-9, #AD-10, #AD-11] — Server Action + requireAdmin; state via transitions only; CLASSIC filter; migrations only; src/data sole Prisma owner
- [Source: …/ARCHITECTURE-SPINE.md#Ключові сутності] — `Tournament ||--|| Group : "має (рівно 1 у v1)"`
- [Source: …/ARCHITECTURE-SPINE.md#Consistency Conventions] — verb-named actions; `revalidatePath` / redirect after write; UA-only; cuid
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md#Key Flows KF-1] — "обирає тип «Чемпіонат», систему очок «Класичний», 6 команд, 1 коло. Турнір створено у стані Чернетка"
- [Source: …/EXPERIENCE.md#Interaction Primitives] — "Навігація після дії: створення турніру → на сторінку турніру (Чернетка)"; "Кнопка на час запиту — disabled + спінер у кнопці"
- [Source: …/EXPERIENCE.md#State Patterns] — "Помилка Server Action → shadcn Toast (destructive) з текстом; форма лишає введені дані" (UX-DR11)
- [Source: …/DESIGN.md#Components, #Shapes, #Layout & Spacing] — Input/Select as-is shadcn; `sm` 7px inputs; one primary button; labels above; 1120px
- [Source: _bmad-output/implementation-artifacts/2-1-tournament-team-player-schema.md] — schema, enum shape, `Group` / natural-key / `P2002` deferred items, `migrate dev` workflow
- [Source: _bmad-output/implementation-artifacts/2-3-tournament-state-machine.md] — `src/actions/tournaments.ts` / `src/data/tournaments.ts` / Vitest runner / `getTournamentForAdmin` / `data → domain` type import / deferred action coverage
- [Source: _bmad-output/implementation-artifacts/2-2-reusable-ux-patterns.md] — `notify`, the pending-spinner pattern, `src/components/README.md`
- [Source: _bmad-output/implementation-artifacts/1-7-admin-management.md] — admin-page shell, `/admin` layout guard, Client→Server-Action pattern
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — 2.1 natural key / `allowedTypes` / `P2002` items
- [Source: src/app/admin/people/page.tsx · src/app/admin/layout.tsx · src/app/admin/page.tsx · src/components/admin-role-controls.tsx · src/app/globals.css · src/components/ui/button.tsx] — the exact shells / tokens / patterns to match
- Web: [React 19 — Actions & `useActionState`](https://react.dev/blog/2024/12/05/react-19) · [Next.js — Forms with Server Actions](https://nextjs.org/docs/app/guides/forms) · [useActionState form validation & resets](https://aurorascharff.no/posts/handling-form-validation-errors-and-resets-with-useactionstate/) · [shadcn/ui — Input / Select](https://ui.shadcn.com/docs/components/select)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

**Task 1 — shadcn primitives.** `pnpm dlx shadcn@latest add input label select` created 3 files but polluted `package.json` with `"cn": "^0.2.4"` (a real, unrelated npm package) and wrote `import { cn } from "cn"` in each. Fix: removed the dep + `pnpm install` (lockfile back to clean), rewrote the imports to `@/lib/utils`. `input.tsx` radius `rounded-lg` → `rounded-sm` (DESIGN.md Shapes: inputs 7px). `select.tsx` deleted — native `<select>` in the form instead. `typecheck` + `lint` clean.

### Completion Notes List

- **Task 1:** `src/components/ui/input.tsx` (rounded-sm), `src/components/ui/label.tsx` — the two shadcn form primitives, `cn` imports corrected. No `select.tsx` — the form uses a styled native `<select>` (AC-sanctioned; simpler + `FormData`-native inside `<form action>`). Bogus `cn@0.2.4` dependency removed.
- **Task 2:** `src/domain/tournamentForm.ts` — `allowedTournamentTypes(discipline)` (CLASSIC → 4 types, BEACH → none), numeric bounds (`YEAR` 2000–2100, `TEAM_COUNT` 4–64, `ROUNDS` 1–10, `NAME_MAX` 120), `validateNewTournament(raw)` returning `{ ok, value }` or `{ ok, fieldErrors }` with all failing fields collected. `toInteger` rejects floats / non-numerics. 14-test spec.

### File List

**New**
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/domain/tournamentForm.ts`
- `src/domain/tournamentForm.test.ts`

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-04 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
| 2026-09-04 | Task 1 — shadcn `input` / `label` primitives (`cn` import + radius fixed; bogus `cn` npm dep removed); native `<select>` chosen over the base-ui popover. `bmad-dev-story`. |
| 2026-09-04 | Task 2 — `src/domain/tournamentForm.ts` (`allowedTournamentTypes`, bounds, `validateNewTournament`) + 14-test spec. `pnpm test` 39/39. |
