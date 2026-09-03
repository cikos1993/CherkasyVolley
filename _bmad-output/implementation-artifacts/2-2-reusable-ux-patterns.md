---
baseline_commit: 15cf8e6
context:
  - _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md
  - _bmad-output/specs/spec-cherkasy-volley/SPEC.md
  - _bmad-output/implementation-artifacts/1-2-design-tokens.md
  - _bmad-output/implementation-artifacts/1-5-google-sign-in.md
  - _bmad-output/implementation-artifacts/1-7-admin-management.md
  - _bmad-output/implementation-artifacts/1-8-public-shell-and-menu.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - AGENTS.md
---

# Story 2.2: Reusable UX patterns

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want shared `ConfirmDialog`, Toast, Skeleton, and `EmptyState` components,
so that every screen that follows behaves the same way (UX-DR9–DR12).

## Acceptance Criteria

Translated from `epics.md` → Epic 2 → Story 2.2. The Ukrainian source is authoritative; the wording below must not narrow it.

**Given** the token layer from Story 1.2
**When** a `ConfirmDialog` wrapper over shadcn `Dialog`, a Toast helper (success / error), a Skeleton in table / card shape, and an `EmptyState` component (dashed border, `display-sm` heading + one line) are implemented
**Then**

1. The native `confirm()` is used nowhere.
2. `ConfirmDialog` accepts body text, a button label, and a `destructive` variant.
3. `EmptyState` covers the 5 cases (Пляжний stub, no tournaments, no teams, no results, an archive year with no tournaments).

### Notes on AC interpretation

- **This is the design-system / reusable-primitives story for Epic 2.** It ships four view-layer building blocks that the Epic 2–4 feature stories consume; it wires **no** tournament data, **no** Server Action, **no** `src/data` / `src/domain` code. The only behavioural change to a shipped feature is migrating `src/components/admin-role-controls.tsx` (Story 1.7) onto the new `ConfirmDialog` + Toast helper — a mandated follow-up from that story's review (`deferred-work.md`), done under a strict regression checklist.
- **"wrapper over shadcn `Dialog`"** — the shadcn primitives already exist at `src/components/ui/dialog.tsx` (on `@base-ui/react/dialog`, **not** Radix — base-nova preset). `ConfirmDialog` composes `Dialog` / `DialogTrigger` / `DialogContent` / `DialogHeader` / `DialogTitle` / `DialogDescription` / `DialogFooter` / `DialogClose` — it does **not** re-implement or restyle them. `admin-role-controls.tsx` is the reference: it already uses that exact composition by hand; `ConfirmDialog` extracts it.
- **"native `confirm()` … nowhere" (AC 1)** — today nothing uses `window.confirm` (`admin-role-controls.tsx` already uses the `Dialog`). AC 1 is a *rule that must hold from now on*. Make it enforceable, not just asserted: add an ESLint rule (`no-alert`, or `no-restricted-globals` for `confirm` / `alert` / `prompt`) so a future `confirm()` fails `pnpm lint` — the same "enforce boundaries with lint" posture as Story 1.3's import rules. `prompt()` / `alert()` are covered too (EXPERIENCE.md Interaction Primitives: native dialogs block the event loop — the Chrome-automation hazard note in this repo's tooling docs).
- **`ConfirmDialog` API (AC 2)** — props: `trigger: ReactElement` (a `<Button>` element passed to `DialogTrigger render=`), `title: string`, `description: string` (**required** — every UX-DR10 confirm is a title + a consequence sentence; a missing description also leaves the dialog with no `aria-describedby`), `confirmLabel: string` (a verb — "Зняти", "Видалити", "Завершити турнір"; EXPERIENCE.md Voice), `cancelLabel?: string` (default `"Скасувати"`), `destructive?: boolean` (→ confirm button `variant="destructive"`, default `variant="default"`), `onConfirm: () => void | Promise<void>`. Self-manages `open`; while `onConfirm` is in flight the dialog is `pending` (both buttons `disabled`, confirm button shows a spinner, backdrop / Esc / X close is suppressed via `onOpenChange={(next) => { if (!pending) setOpen(next) }}` — mirrors `admin-role-controls`); on resolve → close; on reject → **stay open, emit no toast** (the caller owns all messaging; `ConfirmDialog` `console.error`s the throw so a caller bug is not fully silent). Re-entrancy-guarded (`if (pending) return` at the top of `handleConfirm`). Client Component (`"use client"`).
- **"button label" = the *confirm* button's label**, not the trigger's. The trigger is a caller-supplied element (so callers keep control of its size / variant / disabled state — e.g. `admin-role-controls` renders `<Button size="sm" variant="destructive">`).
- **Toast helper (AC — the `When` clause)** — a thin module `src/lib/notify.ts` exporting `notify.success(message)` and `notify.error(message)` over `sonner`'s `toast`. Value: one place for copy/style conventions, and it lets the error path get the **destructive** treatment DESIGN.md wants (UX-DR11: "помилка Server Action (`destructive`…)"). Today `src/components/ui/sonner.tsx` gives `toast.error` only a different *icon* (`OctagonXIcon`), same colours as success. **The colour fix must land on the DESIGN tokens, not `sonner`'s palette:** `sonner`'s `richColors` uses its own built-in hues (~`#e5484d` / `#008a2e`), **not** `--destructive` / `--success` — so bind the typed toasts to the token utilities instead, via `toastOptions.classNames.error` = `"!bg-destructive !text-destructive-foreground !border-destructive"` and `.success` = `"!bg-success !text-success-foreground !border-success"` (greppable, assertable, on-token). This needs a new `--destructive-foreground` token (only `--success-foreground` exists today — `globals.css` `:root` + a `--color-destructive-foreground` line in `@theme inline`; the tinted Button variant never needed it, a solid toast does). `richColors` may be added on top but is not the mechanism. Do **not** hand-roll a toast component — `sonner` is the agreed primitive (AGENTS.md).
- **`notify` is not a `runAction` framework.** It wraps `toast` only. The "on error the form keeps its input" behaviour (UX-DR11) is a form-handling rule for the feature stories (don't reset on failure), not something this helper enforces.
- **Skeleton (AC — `When`)** — the shadcn `Skeleton` is a 3-line CSS primitive (`animate-pulse rounded-md bg-muted`), not a `@base-ui` component; hand-write it at `src/components/ui/skeleton.tsx` as the canonical shadcn implementation (do **not** rely on `pnpm dlx shadcn add` — offline-safe, and it is identical everywhere). Then two composite shapes named by the AC ("у формі таблиці/картки"): `TableSkeleton({ rows?, columns? })` and `CardSkeleton({ count? })` in `src/components/skeletons.tsx`. Minimal and parametrised — **Story 2.9** (public tournament page) is the first real consumer; there is no consumer in this story. EXPERIENCE.md State Patterns: "shadcn Skeleton у формі таблиці/картки; без спінерів на всю сторінку" — no full-page spinner anywhere.
- **`EmptyState` (AC 3)** — the primitive already exists (`src/components/empty-state.tsx`, from Story 1.8: `{ title, description }`, `<h2 class="text-lg font-semibold">` + `<p class="text-sm text-muted-foreground">`, `rounded-lg border border-dashed`). Story 1.8 Task 1 said "Minimal primitive — Story 2.2 formalises the reusable version" and its review said "Story 2.2 … refactors these three call sites". This story:
  - Adds an optional `action?: ReactNode` slot rendered under the description (for the admin CTAs in EXPERIENCE.md State Patterns: "немає турнірів → + (адміну) «Створити турнір»"; "немає команд → + (адміну) «Заявити команду»"). The CTA itself and its admin-gating are wired by the feature stories (2.4 / 2.9) — `EmptyState` only provides the slot.
  - Adds an optional `headingLevel?: 2 | 3` (default `2`) — the reusable primitive will sit inside tab panels / nested sections on the Story 2.9 tournament page where heading order needs `<h3>` (EXPERIENCE.md a11y floor). The 3 current call sites stay `h2` (correct under `SectionShell`'s `h1`).
  - **Heading register — resolved in review (2026-09-04):** keep `<h2 className="text-lg font-semibold">` (the current shipped value) as a **deliberate, signed-off deviation** from UX-DR9's "`display-sm` заголовок". Rationale: the chosen mockup (`directions-3-chosen-C.html` `.C .empty`) renders the empty state as a muted 13px one-liner with no bold heading; EXPERIENCE.md Voice wants "один спокійний рядок"; a second 24px-bold line stacked under `SectionShell`'s `<h1>` (also 24/700) reads as a heading-hierarchy error. Type-scale tokenisation (`display` / `display-sm` / …) stays deferred to Story 2.9. Logged in the Change Log.
  - **Copy — use EXPERIENCE.md §Voice verbatim, do not invent filler.** EXPERIENCE.md gives single calm sentences ("Ще немає заявлених команд.", "Результатів поки немає — таблиця зʼявиться після першого зіграного матчу.") that line 29's rule forbids narrowing. `EmptyState`'s `title` + `description` shape means the authoritative sentence goes in `description`; derive the shortest possible `title` (or reuse the sentence's opening clause). Centralise in `src/lib/empty-states.ts` (same pattern as `src/lib/sections.ts`). This story wires case 1 (`/beach`) and reconciles `/classic` + `/archive`; cases 3–5 ship as exported constants for their owners (2.7 / 2.9 / 3.8 / 4.7).
  - **"немає результатів" is not necessarily a dashed `EmptyState`.** UX-DR9 lists it as one of the 5 `EmptyState` cases, but EXPERIENCE.md §State Patterns and DESIGN.md §Components render it as a **zero-filled table + an inline "Результатів поки немає" row**. EXPERIENCE.md's in-table treatment is authoritative; **Story 3.8** owns the final rendering. `NO_RESULTS` still ships as a constant here (some contexts — e.g. a schedule tab before any match — may legitimately use the box); flag the tension in a comment next to it.
- **Scope guard. In scope:** `ConfirmDialog`, `notify` helper + `richColors` on the Toaster, `Skeleton` primitive + `TableSkeleton` / `CardSkeleton`, `EmptyState` `action` slot + `src/lib/empty-states.ts`, the `no-alert` ESLint rule, migrating `admin-role-controls.tsx` onto `ConfirmDialog` + `notify` (+ a confirm-button spinner), refactoring the 3 `EmptyState` call sites (`/classic`, `/beach`, `/archive`) to the new copy source, `src/components/README.md` + one `AGENTS.md` line. **Not in scope:** Tab chip (Story 2.9 / UX-DR4), Status badge (Story 2.9 / UX-DR7), Standings table (Story 3.8 / UX-DR5), Score input (Story 3.6 / UX-DR8), Bracket pair (Story 4.6 / UX-DR6); any `Tournament` / `Team` data, `src/data` fn, Server Action, `src/domain` code; the type-scale tokenisation (`display` / `display-sm` / `body` / `label` / `caption` as `--text-*` — no consumer here; belongs with the first real 32px `display` heading in Story 2.9); the 44px touch-target sweep, per-component 7px radius (inputs / tab-chips), the primary-Button darker-blue hover (all `deferred-work.md` design-system items — see "Adjacent deferred items" below); a general pending-Button component (the spinner lives inside `ConfirmDialog` only; `GrantAdminButton` gets an inline spinner, not a new abstraction).

## Tasks / Subtasks

- [x] **Task 1 — Toast helper `src/lib/notify.ts` (NEW) + on-token toast styling + `--destructive-foreground`** (AC: `When` clause; supports AC 1/2 feedback)
  - [x] `src/lib/notify.ts` — no `"use client"` (it is a plain module, not a component; only ever imported from Client Components — never a Server Component). `import { toast } from "sonner"`. Export `const notify = { success(message: string) { toast.success(message) }, error(message: string) { toast.error(message) } }`. Keep it this small — no `ActionResult` coupling, no `runAction`.
  - [x] `src/app/globals.css` (UPDATE) — add `--destructive-foreground: #ffffff` to `:root` (next to `--success-foreground`), and `--color-destructive-foreground: var(--destructive-foreground)` to `@theme inline` (next to `--color-success-foreground`). DESIGN.md's `destructive` entry has no foreground pair and the tinted Button variant never needed one; a solid destructive **toast** background does. Do not change `--destructive` itself.
  - [x] `src/components/ui/sonner.tsx` (UPDATE) — bind the typed toasts to the DESIGN tokens (NOT `richColors` — `sonner`'s `richColors` uses its own hues, not `--destructive` / `--success`). Extend `toastOptions.classNames`: `error: "!bg-destructive !text-destructive-foreground !border-destructive"`, `success: "!bg-success !text-success-foreground !border-success"`. Keep `theme="light"`, the custom `icons`, the `--normal-*` style vars. **Remove** the existing `toast: "cn-toast"` class **unless** a `.cn-toast` rule is actually defined somewhere (grep `globals.css` + any CSS — it appears to be dead since Story 1.5); if it is defined, confirm it sets no `bg`/`border` that would shadow the new `[data-type]` classes. Verify the custom `icons` still render (they are orthogonal to `classNames`).
  - [x] `src/components/README.md` — record the intended toast hexes: error `#C4342B` on white text, success `#1F8A54` on white text (so a reviewer can compare).
  - [x] Do not otherwise touch `src/components/flash-toaster.tsx`, but note it in Task 8: its `?error=admin-required` `toast.error` picks up the new `.error` class and must be eyeballed (Story 1.6 surface). Migrating its direct `toast.error(message, { id })` call to `notify` is optional (it passes an `id` option `notify.error` does not forward) — if kept direct, add `flash-toaster.tsx` to the `notify` lint exception (Task 7).
- [x] **Task 2 — Skeleton primitive + shapes + reduced-motion** (AC: `When` clause "Skeleton у формі таблиці/картки")
  - [x] `src/components/ui/skeleton.tsx` (NEW) — canonical shadcn: `function Skeleton({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="skeleton" className={cn("bg-muted animate-pulse rounded-md", className)} {...props} /> }`; `export { Skeleton }`. `import { cn } from "@/lib/utils"`. No `"use client"`.
  - [x] `src/components/skeletons.tsx` (NEW) — `TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number })` and `CardSkeleton({ count = 1 }: { count?: number })`. Build the repeat with `Array.from({ length: Math.max(0, Math.min(n, 50)) })` (never `[...Array(n)]` — a negative/computed `n` throws `RangeError`; the clamp caps a runaway). `TableSkeleton` = a header row of `Skeleton` bars + `rows × columns` cell `Skeleton`s (`gap-2`, cells `h-4`); the consumer owns the `overflow-x-auto` scroll container. `CardSkeleton` = `count` blocks each `rounded-md border p-4` + 2–3 stacked `Skeleton` lines. Keep both minimal and unopinionated — placeholders, not pixel mirrors; Stories 2.9 / 3.8 tune dimensions against real tables.
  - [x] Accessibility: put `aria-hidden` on the decorative bars, but the **wrapper** each composite returns should carry `role="status"` + `aria-label` (default e.g. `"Завантаження"`, overridable via a `label?` prop) so a screen reader announces the loading state. Show the intended usage (`<div role="status" aria-live="polite">` around the skeleton while `pending`, swapped for content when ready) in `src/components/README.md` — otherwise consumers ship silent loading states.
  - [x] Reduced motion: add to `src/app/globals.css` a `@media (prefers-reduced-motion: reduce)` block that neutralises `animate-pulse` and `animate-spin` (`animation: none`), so `Skeleton` and both spinners (`ConfirmDialog`, `GrantAdminButton`) respect the OS setting. Document the convention in `src/components/README.md`.
  - [x] No consumer wired in this story — note in the component file that Story 2.9 is the first user.
- [x] **Task 3 — `ConfirmDialog` `src/components/confirm-dialog.tsx` (NEW)** (AC: 1, 2)
  - [x] `"use client"`. Props: `{ trigger: React.ReactElement; title: string; description: string; confirmLabel: string; cancelLabel?: string; destructive?: boolean; onConfirm: () => void | Promise<void> }` — `description` is **required** (see AC note).
  - [x] Internal state: `const [open, setOpen] = useState(false)`, `const [pending, setPending] = useState(false)`, `const alive = useRef(true)` (`useEffect(() => () => { alive.current = false }, [])`).
  - [x] `<Dialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next) }}>`.
  - [x] `<DialogTrigger render={trigger} />` — the caller's `<Button>Label</Button>` passes through with **its own children (the label) intact**. base-ui's `render` prop clones the element and merges its own props/behaviour onto it without replacing children — but **verify this explicitly** in the walkthrough (the reference `admin-role-controls` passes the label as `DialogTrigger`'s children, not inside the element, so this is a slightly different shape). If base-ui drops the children, add a `triggerLabel: string` prop instead.
  - [x] `<DialogContent>` → `<DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>` → `<DialogFooter><DialogClose render={<Button variant="outline" disabled={pending} />}>{cancelLabel ?? "Скасувати"}</DialogClose><Button variant={destructive ? "destructive" : "default"} onClick={handleConfirm} disabled={pending}>{pending ? <Loader2Icon className="animate-spin" /> : null}{confirmLabel}</Button></DialogFooter>`. (`Loader2Icon` needs no explicit `size-*` — `Button` sizes descendant SVGs.)
  - [x] Initial focus: on a `destructive` dialog, focus **Cancel**, not the destructive confirm button (accidental Enter otherwise). Check base-ui `Dialog.Popup`'s default focus target; if it lands on the confirm button or the X, set `initialFocus` to the Cancel button ref. Verify in the walkthrough.
  - [x] `Loader2Icon` from `lucide-react` (already used in `ui/sonner.tsx`).
  - [x] `handleConfirm`: `if (pending) return; setPending(true); try { await onConfirm(); if (alive.current) setOpen(false); } catch (e) { console.error(e); /* caller owns user-facing messaging; keep dialog open */ } finally { if (alive.current) setPending(false); }`. The `if (pending) return` guard stops a double-click firing `onConfirm` twice before `disabled={pending}` re-renders; the `alive` guard stops a `setState` after a caller's `onConfirm` navigated away (self-revoke).
  - [x] Document the contract in a top-of-file comment: *`onConfirm` resolve → dialog closes; `onConfirm` throw → dialog stays open, `console.error`s the throw, shows no toast — the caller must surface its own user-facing error (usually `notify.error`). While `onConfirm` is in flight the whole dialog is locked (both buttons + Esc + backdrop + X); a long-running `onConfirm` owns its own timeout. Navigations inside `onConfirm` (e.g. `router.push`) unmount the dialog before `finally` — the `alive` ref handles it.*
  - [x] `src/components/**` ESLint block forbids `@/auth` — `ConfirmDialog` imports only `@/components/ui/*`, `lucide-react`, `react`. No `@/actions`, no `@/data`.
- [x] **Task 4 — `no-alert` ESLint rule `eslint.config.mjs` (UPDATE)** (AC: 1)
  - [x] Add one flat-config block with `files: ["src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"]` and `rules: { "no-alert": "error" }` (`no-alert` covers `alert` / `confirm` / `prompt`). Scope is exactly `src/**` — not `scripts/` / `prisma/` / `*.config.*`. Preserve every existing block and `globalIgnores`; do not add to `globalIgnores`.
  - [x] If `eslint-config-next` already sets `no-alert`, this is a harmless re-affirm — check with `pnpm lint --print-config src/components/confirm-dialog.tsx` and confirm `no-alert` resolves to `error`.
  - [x] Quick negative check: drop a throwaway `confirm("?")` into a scratch file under `src/`, confirm `pnpm lint` errors on it, delete it. (Same throwaway-probe method Story 1.3 used for the import rules — and see `deferred-work.md`: this verification is not durable, no committed fixture, `next build` does not run the ESLint blocks. Task 9 folds it into the existing tracking.)
- [x] **Task 5 — `EmptyState` formalisation** (AC: 3)
  - [x] `src/components/empty-state.tsx` (UPDATE) — props become `{ title: string; description: string; action?: React.ReactNode; headingLevel?: 2 | 3 }`. Render the heading as `<h2>` or `<h3>` per `headingLevel` (default `2`) keeping `className="text-lg font-semibold"`; keep `<p className="mt-1 text-sm text-muted-foreground">`; render `{action ? <div className="mt-4">{action}</div> : null}` after the `<p>`; keep `rounded-lg border border-dashed px-6 py-10 text-center`. No `"use client"` (stays presentational). `description` stays `string` (rendered in a `<p>`; the `action` slot is the escape hatch for a button/link).
  - [x] `src/lib/empty-states.ts` (NEW) — export `{ title, description }` consts. `description` carries EXPERIENCE.md §Voice **verbatim** (line 29's no-narrowing rule); `title` is the shortest label that reads naturally above it. 6 consts = the AC's 5 cases + `ARCHIVE_EMPTY`:
    - `BEACH_SOON` — `title: "Незабаром"`, `description: "У розділі «Пляжний» ще немає турнірів."` — EXPERIENCE.md: «У розділі "Пляжний" ще немає турнірів. Незабаром.»
    - `NO_TOURNAMENTS` — `title: "Ще немає турнірів"`, `description: "Активні турніри зʼявляться тут, коли їх створить адміністратор."` (reconciles `/classic`'s current bespoke copy)
    - `NO_TEAMS` — `title: "Ще немає заявлених команд"`, `description: "Ще немає заявлених команд."` — EXPERIENCE.md §Voice verbatim: «Ще немає заявлених команд.» (title repeats the sentence; that is fine — the sentence is the authoritative string)
    - `NO_RESULTS` — `title: "Результатів поки немає"`, `description: "Результатів поки немає — таблиця зʼявиться після першого зіграного матчу."` — EXPERIENCE.md §Voice verbatim. **`// NOTE:`** in the file — per EXPERIENCE.md §State Patterns + DESIGN.md §Components the "немає результатів" state on a **standings** tab is a zero-filled table + an inline row, NOT this dashed box; Story 3.8 owns that rendering. This const exists for contexts where a box is right (e.g. an empty schedule tab).
    - `ARCHIVE_YEAR_EMPTY` — `title: "Немає турнірів за цей рік"`, `description: "За цей рік завершених турнірів немає."` — the AC's 5th case ("рік архіву без турнірів"), Story 4.7.
    - `ARCHIVE_EMPTY` — `title: "Архів порожній"`, `description: "Завершені турніри зʼявляться тут за роками."` — the pre-existing "/archive with no completed tournaments at all" page (≠ a single empty year). **Required** (the `/archive` refactor below needs it).
  - [x] Refactor the 3 call sites to import from `src/lib/empty-states.ts`: `src/app/classic/page.tsx` → `NO_TOURNAMENTS`; `src/app/beach/page.tsx` → `BEACH_SOON`; `src/app/archive/page.tsx` → `ARCHIVE_EMPTY`. Spread form `<EmptyState {...NO_TOURNAMENTS} />` is fine.
  - [x] Do **not** add the admin "Створити турнір" / "Заявити команду" CTA here — Stories 2.4 / 2.7 wire those into the `action` slot.
- [x] **Task 6 — Migrate `src/components/admin-role-controls.tsx` (UPDATE) onto `ConfirmDialog` + `notify`** (AC: 1, 2; `deferred-work.md` 1.7 mandate)
  - [x] **`GrantAdminButton`** — no dialog (grant is not in UX-DR10's confirm list). Change only: `toast.success("Доступ надано")` → `notify.success("Доступ надано")`; `toast.error(res.message)` → `notify.error(res.message)`; `catch` → `notify.error("Не вдалося надати доступ. Спробуйте ще раз.")`. Add an inline spinner while `pending`: `{pending ? <Loader2Icon className="animate-spin" /> : null}` before the label (the `sm` Button already sizes descendant SVGs to `size-3.5` — no explicit `size-*`). Keep `size="sm" variant="outline"`, `disabled={pending}`, `useTransition`.
  - [x] **`RevokeAdminButton` — disabled (last-admin) branch — DO NOT CHANGE.** Keep the exact markup: `<div className="flex flex-col items-end gap-1">` + `<Button size="sm" variant="destructive" disabled aria-describedby={reasonId}>Зняти доступ</Button>` + `<span id={reasonId} className="text-xs text-muted-foreground">Ви єдиний адміністратор</span>`. `reasonId` from `useId()`.
  - [x] **`RevokeAdminButton` — active branch — replace the hand-rolled `Dialog` with `ConfirmDialog`:**
    ```
    <ConfirmDialog
      trigger={<Button size="sm" variant="destructive">Зняти доступ</Button>}
      title="Зняти доступ адміністратора?"
      description={isSelf
        ? "Ви більше не зможете відкривати адмін-зону й керувати турнірами."
        : "Користувач втратить доступ до адмін-зони та керування турнірами."}
      confirmLabel="Зняти"
      destructive
      onConfirm={revoke}
    />
    ```
  - [x] `revoke` (now `onConfirm`, must **throw on failure** so `ConfirmDialog` keeps the dialog open; `res` is typed, not an evolving-`any`):
    ```
    async function revoke() {
      const res = await revokeAdmin(userId).catch((): null => {
        notify.error("Не вдалося зняти доступ. Спробуйте ще раз.");
        return null;
      });
      if (res === null) throw new Error("revoke-network");
      if (!res.ok) {
        notify.error(res.message);
        throw new Error(res.code);
      }
      notify.success("Доступ знято");
      if (isSelf) {
        router.push("/");
        router.refresh();
      } else {
        router.refresh(); // belt-and-braces: the list must re-render after revoke; see Task 8
      }
    }
    ```
    Remove: the `useState` `open`, the `useTransition` import + `[pending, startTransition]`, and the `Dialog` / `DialogClose` / `DialogContent` / `DialogFooter` / `DialogHeader` / `DialogTitle` / `DialogTrigger` imports from `@/components/ui/dialog`. Keep: `useRouter`, `useId` (the disabled branch still uses it). Add: `import { ConfirmDialog } from "@/components/confirm-dialog"`, `import { notify } from "@/lib/notify"`.
  - [x] **Regression checklist — verify all still hold after the swap** (this is a shipped, code-reviewed Story 1.7 feature — the review flagged this as the story's highest-risk change; walk it carefully):
    - Grant: click → button disables + spinner → success toast "Доступ надано" → **list refreshes** (target row now shows "Зняти доступ").
    - Revoke (other user): trigger → dialog with the correct non-self description → "Скасувати" closes, no-op → "Зняти" → confirm button disables + spinner → success toast "Доступ знято" → dialog closes → **list refreshes: the row flips to "Надати доступ" with no manual reload** (this is the key check — `useTransition` is gone; the `router.refresh()` added to `revoke()` must carry it, or the action's `revalidatePath` must, or both).
    - Revoke (self, not last admin): as above but description is the self copy → on success `router.push("/")` + `refresh()` (dialog unmounts via nav — the `alive` ref in `ConfirmDialog` must prevent a post-unmount `setState`; no console warning).
    - Revoke fails (network throw, or `!res.ok`): `notify.error(...)` fires once, **dialog stays open**, buttons re-enable, no `ConfirmDialog` toast, the throw is `console.error`'d.
    - Last admin (self, `disabled` prop true): renders the disabled button + "Ви єдиний адміністратор" reason, `aria-describedby` still wired to `reasonId` — **no dialog, no ConfirmDialog**.
    - Backdrop / Esc / X during the in-flight request does not close the dialog (`!pending` guard) — test with an artificially slow `onConfirm` on a scratch page (Task 8), the real window is ~100ms.
    - Double-click "Зняти" fast → `revokeAdmin` fires **once** (the `if (pending) return` guard).
    - Trigger button renders with its label "Зняти доступ" visible (base-ui `render={trigger}` kept the element's children).
  - [x] `deferred-work.md` — strike the two now-resolved 1.7 items: "Buttons show only `disabled` while pending — no spinner…" and (partially) the ConfirmDialog adoption. The review already added three carry-forward entries under "code review of 2-2-reusable-ux-patterns" (`no-alert` durability, `ConfirmDialog`/`admin-role-controls` component tests → Vitest in Story 2.3, the `ConfirmDialog` in-flight lock) — leave those and the rest.
- [x] **Task 7 — Docs**
  - [x] `src/components/README.md` (NEW) — the reusable view primitives and when to use each:
    - `EmptyState` — `title` + `description` (+ optional `action`, `headingLevel`); canonical copy in `src/lib/empty-states.ts`; `description` carries the authoritative EXPERIENCE.md §Voice sentence.
    - `ConfirmDialog` — the `onConfirm` resolve-closes / throw-stays-open contract, `console.error` on throw, `destructive`, caller-owns-user-facing-messaging, full lock while in flight (long actions own their timeout).
    - `Skeleton` / `TableSkeleton` / `CardSkeleton` — no full-page spinners (EXPERIENCE.md); the `role="status"` + `aria-live` wrapper pattern with a worked example; the counts are clamped.
    - `notify` (`src/lib/notify.ts`) — the `sonner` wrapper; error toast = `#C4342B` / white, success = `#1F8A54` / white (bound to `--destructive` / `--success` via `toastOptions.classNames`, not `richColors`). **Always use `notify`, never `import { toast } from "sonner"` directly** — the two exceptions are `src/components/ui/sonner.tsx` (the `<Toaster>` itself) and `src/components/flash-toaster.tsx` (needs the `id` option). A `no-restricted-imports` on `sonner` outside those two is an optional future guard.
    - Native `confirm()` / `alert()` / `prompt()` are ESLint-blocked (`no-alert`) — use `ConfirmDialog` or a toast.
    - **Consumer contract (UX-DR11):** a feature-story form must NOT reset its fields when a Server Action returns `{ ok: false }` — the user keeps what they typed. (2.2 wires no forms; this is the note for 2.4+.)
    - Reduced motion: `animate-pulse` / `animate-spin` are neutralised under `prefers-reduced-motion` (globals.css).
  - [x] `AGENTS.md` — under "Conventions that differ from defaults", extend the toast line: reusable UX primitives — `ConfirmDialog` (`src/components/confirm-dialog.tsx`, wraps shadcn `Dialog`; `onConfirm` throw ⇒ stays open), `EmptyState` + `src/lib/empty-states.ts`, `Skeleton`/`TableSkeleton`/`CardSkeleton`, `notify` (`src/lib/notify.ts` — use it, not `toast` directly). Native `confirm()`/`alert()`/`prompt()` are lint-errors (`no-alert`). Story 2.2.
  - [x] No `ARCHITECTURE-SPINE.md` / `EXPERIENCE.md` / `DESIGN.md` edit — these components realise contracts already written there.
- [x] **Task 8 — Verification gate** (AC: all)
  - [x] `pnpm lint` (exit 0, incl. the new `no-alert` block) + `pnpm typecheck` (exit 0) + `pnpm build` clean on Node 24. `pnpm lint --print-config src/components/confirm-dialog.tsx` shows `no-alert: "error"`.
  - [x] Build route table unchanged from Story 1.8: `/`, `/classic`, `/beach`, `/archive`, `/sign-in` static (`○`); `/admin`, `/admin/people` dynamic (`ƒ`). `ConfirmDialog` being a Client Component must **not** deopt `/admin/people` further (already `force-dynamic`).
  - [x] `grep -rn "@prisma/client\|generated/prisma\|@/auth\|@/actions\|@/data" src/components/` → `admin-role-controls.tsx` still imports `@/actions/admin-roles` (allowed — view → shell); `confirm-dialog.tsx` / `empty-state.tsx` / `skeletons.tsx` / `ui/skeleton.tsx` import none of them. (No `confirm(`/`alert(`/`prompt(` grep — the `no-alert` rule + the `--print-config` check are the verification; a source-text grep adds nothing and is easy to get wrong.)
  - [x] **Browser walkthrough** (`pnpm dev` on a spare port + the Chrome tools, or `curl` like Story 1.8). Capture in the Dev Agent Record:
    - **`/admin/people`** (seed admin): grant (spinner in button + "Доступ надано" toast + row flips to "Зняти доступ" with no reload); revoke-other (dialog opens with the non-self description → "Скасувати" is a no-op → reopen → "Зняти" → spinner → "Доступ знято" toast → dialog closes → **row flips to "Надати доступ" with no reload**); revoke-self path (self description → `/` after success); last-admin disabled branch (disabled button + reason text, no dialog).
    - **Toast colour** — error toast background is `#C4342B` with white text, success is `#1F8A54` with white text (inspect computed style, not just "looks red"). Also trigger the `?error=admin-required` **flash toast** (open `/admin` while signed out or as a non-admin) and eyeball it — it now inherits the `.error` class (Story 1.6 surface, not otherwise in this walkthrough).
    - **Scratch page** (`src/app/_scratch/page.tsx`, delete after): render all 6 `empty-states.ts` consts, one with `action={<Button>Створити турнір</Button>}`, one with `headingLevel={3}` inside a fake nested section; `<TableSkeleton rows={4} columns={5} />`, `<CardSkeleton count={2} />`. Eyeball wrapping, the `ʼ` glyph, spacing, the dashed border radius (14px).
    - **`ConfirmDialog` contract** (on the scratch page — unreachable via `revokeAdmin`, which succeeds on the non-last-admin path): a `<ConfirmDialog … onConfirm={() => Promise.reject(new Error("x"))} />` → confirm → dialog **stays open**, no toast, `console.error` logged, buttons re-enable. A `<ConfirmDialog … onConfirm={async () => { await new Promise(r => setTimeout(r, 3000)); }} />` → during the 3s: Esc / backdrop / X do nothing, both buttons disabled, spinner visible. A destructive `ConfirmDialog` → on open, focus is on **Cancel**, not the confirm button. Double-click confirm fast → `onConfirm` fires once.
  - [x] Capture every command's real output + the walkthrough notes in the Dev Agent Record — verifiable, not asserted (Stories 1.1–1.8 / 2.1 pattern; Story 1.8's `pnpm dev` + `curl` + narrow-viewport rig).
- [x] **Task 9 — Commit** — `4f5afd4` on `main` (`feat(ui): reusable ConfirmDialog / Skeleton / EmptyState / toast helper (Story 2.2)`). Includes the `admin-role-controls.tsx` migration and the 3 `EmptyState` call-site refactors. **Not pushed** — the push (which deploys to Vercel prod) is left for the user after review.

### Review Findings

Pre-implementation adversarial review 2026-09-04 (`bmad-code-review`, 4 layers: Blind Hunter, Edge Case Hunter, Verification Gap, Acceptance Auditor). Target: this story draft against `epics.md` Story 2.2 AC + UX-DR9–DR12 + DESIGN.md / EXPERIENCE.md / ARCHITECTURE-SPINE.md. 2 decision-needed (resolved), 13 patch (**all applied to the tasks / notes above**, 2026-09-04), 2 defer (→ `deferred-work.md`), ~5 dismissed as noise. The story stays `ready-for-dev` — nothing is implemented yet.

#### Decision needed — resolved 2026-09-04

- [x] **[Review][Decision] `EmptyState` heading register — `text-lg` (shipped) vs `display-sm` (AC / UX-DR9 / DESIGN.md)** — **Resolution: keep `text-lg font-semibold`** (option b). Recorded as a deliberate, signed-off deviation from UX-DR9's "`display-sm` заголовок": the chosen mockup renders the empty state as a muted 13px one-liner with no bold heading, EXPERIENCE.md Voice wants "один спокійний рядок", and a second 24/700 line stacked under `SectionShell`'s `h1` reads as a heading-hierarchy error. Type-scale tokenisation (`display`/`display-sm`/…) stays deferred to Story 2.9 (first real 32px `display` heading). Add a Change Log line noting the deviation. Patch: `src/lib/empty-states.ts` copy still reconciles to EXPERIENCE.md Voice (see Patch below). [`2-2-reusable-ux-patterns.md:51`]
- [x] **[Review][Decision] base-nova's `destructive` Button variant is a low-emphasis tint (`bg-destructive/10 text-destructive`), not solid red** — **Resolution: accept the tinted variant for v1** (option a). `ConfirmDialog`'s destructive confirm button uses `variant="destructive"` as-is — spec-compliant to UX-DR10's letter ("colour = shadcn destructive"); a solid destructive emphasis belongs with the deferred Button-variant design-system work. Note: Patch 1 still adds the `--destructive-foreground` token — it is needed for the solid destructive **toast** background, independent of the Button. [`2-2-reusable-ux-patterns.md:256`]

#### Patch

- [x] **[Review][Patch] Toast colour will not hit the DESIGN tokens via `richColors` — bind typed toasts to the token classes and add the missing `--destructive-foreground`** — `sonner`'s `richColors` uses its own palette (~`#e5484d` / `#008a2e`), not `--destructive` / `--success`; line 46's "already matches DESIGN tokens" is wrong and line 239 concedes it. Make `toastOptions.classNames.error` / `.success` bound to `!bg-destructive !text-destructive-foreground` / `!bg-success !text-success-foreground` the primary plan (greppable / assertable, on-token); `richColors` optional. Add `--destructive-foreground: #ffffff` to `:root` and `--color-destructive-foreground` to `@theme inline` in `globals.css` (only `--success-foreground` exists today). While editing `ui/sonner.tsx`, verify or remove the pre-existing undefined `cn-toast` class so it can't shadow the typed-toast styling. Record intended hexes in `src/components/README.md`. [`2-2-reusable-ux-patterns.md:46,59,239` · `src/app/globals.css` · `src/components/ui/sonner.tsx`]
- [x] **[Review][Patch] `richColors` / typed-toast styling is a global change — bring the shipped toast surfaces into the regression check** — It restyles `flash-toaster.tsx`'s `?error=admin-required` toast (Story 1.6) and the grant/revoke success toasts (1.7), none in Task 8's walkthrough. Add: trigger `?error=admin-required` as a non-admin and eyeball the flash toast; confirm grant/revoke success toasts render on-token. [`2-2-reusable-ux-patterns.md:60,148`]
- [x] **[Review][Patch] `src/lib/empty-states.ts` copy diverges from EXPERIENCE.md's authoritative Voice sentences** — EXPERIENCE.md §Voice gives specific single sentences ("Ще немає заявлених команд.", "Результатів поки немає — таблиця зʼявиться після першого зіграного матчу.") that line 29 says "must not be narrowed"; the draft invents filler second lines ("Заявлені команди зʼявляться тут.", "Оберіть інший рік в архіві.") that contradict the "один спокійний рядок" rule the story itself cites. Use the exact EXPERIENCE.md sentences; where the `title`/`description` split forces a shape mismatch, make the authoritative sentence the `description` and derive a minimal `title` (or see Decision 1 / heading-less). [`2-2-reusable-ux-patterns.md:81-87`]
- [x] **[Review][Patch] `EmptyState` hard-codes `<h2>` — add an optional heading level for nested use** — As the reusable primitive for Epic 2–4, an `EmptyState` inside a tab panel / nested section (Story 2.9 tournament page) needs `<h3>` for correct heading order (EXPERIENCE.md a11y floor). Add `headingLevel?: 2 | 3` (default `2`); the 3 current call sites stay `h2`. [`2-2-reusable-ux-patterns.md:80` · `src/components/empty-state.tsx`]
- [x] **[Review][Patch] `ConfirmDialog` hardening bundle** — (a) make `description: string` required (every UX-DR10 confirm is title + consequence sentence; optional `description` also creates an untested no-`aria-describedby` path). (b) `if (pending) return;` at the top of `handleConfirm` (a double-click before `disabled={pending}` re-renders fires `onConfirm` — and `revokeAdmin` — twice). (c) `catch (e) { console.error(e); }` not `catch {}` (an unhandled `TypeError` in a caller's `onConfirm` currently vanishes silently). (d) an `alive` `useRef` around the `finally` setState (self-revoke's `router.push` unmounts the dialog before `finally` — React 19 no-ops it but StrictMode / future tests flag it). (e) initial focus on Cancel for a destructive dialog (base-ui `Dialog.Popup` `initialFocus`) — accidental Enter otherwise. (f) verify base-ui `render={trigger}` keeps the passed element's own children (the label) — the reference passes the label as `DialogTrigger` children, `ConfirmDialog` passes it inside `trigger`. [`2-2-reusable-ux-patterns.md:66-73`]
- [x] **[Review][Patch] Verify the grant/revoke list refresh survives dropping `useTransition` from `RevokeAdminButton`** — Task 6 removes `useTransition`; the non-self `revoke()` relies solely on the action's `revalidatePath` (only the `isSelf` branch calls `router.refresh()`). The "must preserve … the list refresh" claim (line 213) needs proving. Add a Task 8 step: after a non-self revoke, confirm the row flips to "Надати доступ" with no manual reload; if not, add `router.refresh()` to the non-self success path. [`2-2-reusable-ux-patterns.md:130,213`]
- [x] **[Review][Patch] Flag the "немає результатів" EmptyState-vs-in-table-row conflict for Story 3.8** — UX-DR9 lists "no results" as an `EmptyState` (dashed box) case; EXPERIENCE.md §State Patterns + DESIGN.md §Components render it as a zero-filled table + an inline "Результатів поки немає" row. The story ships `NO_RESULTS` as an `EmptyState` const with no note of the tension. Add a comment in `empty-states.ts` and a story line: EXPERIENCE.md's in-table treatment is authoritative; Story 3.8 owns the final rendering. [`2-2-reusable-ux-patterns.md:85`]
- [x] **[Review][Patch] Strengthen Task 8 to actually verify the behavioural contracts** — The walkthrough can't reach `ConfirmDialog`'s two subtle contracts and renders 1 of 5 empty states. Add scratch-page steps: `onConfirm={() => Promise.reject(...)}` → dialog stays open, no toast (unreachable via `revokeAdmin`, which succeeds on the non-last-admin path); `onConfirm` with `await new Promise(r => setTimeout(r, 3000))` → Esc / backdrop / X inert + both buttons disabled during `pending` (real window is ~100ms); render all 5 `empty-states.ts` consts + one with the `action` slot. Drop or fix the internally-inconsistent `grep -rn "…confirm(\|…alert(…"` line (the `[^.]` guard is on `confirm` only; adds nothing over `no-alert` + `--print-config`). [`2-2-reusable-ux-patterns.md:146,148`]
- [x] **[Review][Patch] Record the deferred verification debt in `deferred-work.md`** — (a) fold `no-alert` into the existing "Story 1.3 import rules verified once with deleted throwaway probes, no committed negative fixture, no CI, `next build` doesn't run the ESLint blocks" item — same non-durable verification. (b) bind the first `ConfirmDialog` + `admin-role-controls` component tests (resolve-closes / throw-stays-open / pending-lock / last-admin branch / self-revoke nav) to the Vitest runner arriving in Story 2.3. [`2-2-reusable-ux-patterns.md:76-78,244-246`]
- [x] **[Review][Patch] Fix contradictory / incomplete task text** — Task 4: `no-alert` scope says both "same `SRC` glob" (repo-wide) and "keep it on `src/**`" after an unfinished sentence — give one `files:` value (`["src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"]`) and delete the dangling clause. Task 6: the `revoke()` snippet's `let res;` is an evolving-`any` — type it (`const res = await revokeAdmin(userId)` with the network `try/catch` wrapping only that call); drop the redundant `size-3.5` on the added `<Loader2Icon>` (the `sm` Button already sizes SVGs); spell out the removed imports. Task 5: `ARCHIVE_EMPTY` is "if you want" (line 87) then mandated (line 91) — state it's required, and that the file has 6 consts = the AC's 5 cases + `ARCHIVE_EMPTY` (the pre-existing "/archive with no completed tournaments" page, ≠ a single empty year). [`2-2-reusable-ux-patterns.md:76-78,87,91,111`]
- [x] **[Review][Patch] Add `prefers-reduced-motion` handling for `animate-pulse` / `animate-spin`** — The design-system-primitives story is the right place to set the convention. One `@media (prefers-reduced-motion: reduce)` rule in `globals.css` neutralising `animate-pulse` / `animate-spin` (or `motion-safe:` variants in `Skeleton` + the two spinners). Document in `src/components/README.md`. [`2-2-reusable-ux-patterns.md:62,70,94` · `src/app/globals.css`]
- [x] **[Review][Patch] Skeleton composites — clamp counts, ship an accessible-usage example** — `TableSkeleton({rows, columns})` / `CardSkeleton({count})`: use `Array.from({ length: Math.max(0, n) })` (not `[...Array(n)]`), document a sane upper bound. The `aria-hidden` wrapper + "consumer supplies `aria-busy` / live-region" needs a concrete `role="status"` / `aria-busy` wrapper example in `src/components/README.md` or consumers ship inaccessible loading states. [`2-2-reusable-ux-patterns.md:63`]
- [x] **[Review][Patch] Docs / context gaps** — Add `_bmad-output/implementation-artifacts/1-7-admin-management.md` (+ `1-5-google-sign-in.md`) to the frontmatter `context:` (Task 6 migrates that component; both cited as binding in the body). Add to `src/components/README.md`: the UX-DR11 "feature-story forms must not reset on a failed Server Action" consumer contract (currently prose only, line 47); and a "use `notify`, never `toast` directly (except `ui/sonner.tsx` / `flash-toaster.tsx`)" convention line — a `no-restricted-imports` on `sonner` with those exceptions is an optional candidate. [`2-2-reusable-ux-patterns.md:3-12,47`]

#### Deferred

- [x] **[Review][Defer] The `admin-role-controls.tsx` migration ships to `main` (auto-deploys to prod) gated only by a manual walkthrough** [`2-2-reusable-ux-patterns.md:150`] — deferred, pre-existing: no CI, no component tests until Story 2.3 (already tracked in `deferred-work.md`); the `deferred-work.md` 1.7 mandate explicitly assigns the migration to Story 2.2, so splitting it contradicts the plan. Patches 8–9 tighten the gate as far as possible now; the story should note the prod blast radius.
- [x] **[Review][Defer] `ConfirmDialog` fully locks (both buttons + Esc + backdrop + X) while `onConfirm` is in flight** [`2-2-reusable-ux-patterns.md:44,68-72`] — deferred: not "forever" (a hung Server Action hits the platform timeout → the promise rejects → `catch` reopens the dialog), and deliberately locking during a mutation is correct per the "don't close mid-request" requirement. Add a one-line doc comment that long-running `onConfirm`s own their own timeout; no code change.

## Dev Notes

### What this story is / is NOT

**Is:** four view-layer primitives — `ConfirmDialog`, a `notify` toast helper (+ token-bound error/success `classNames` on the shared `<Toaster>` and a new `--destructive-foreground` token), `Skeleton` / `TableSkeleton` / `CardSkeleton`, and the formalised `EmptyState` (`action` slot, `headingLevel`, single-source copy) — plus an ESLint rule that makes "no native `confirm()`" enforceable, plus the mandated migration of `admin-role-controls.tsx` onto `ConfirmDialog` + `notify`.

**Is NOT** (do not pull forward):
- **Tab chip** (URL `?tab=` state, mobile scroll) → **Story 2.9** / UX-DR4.
- **Status badge** (Чернетка / Груповий етап / Плейоф / Завершений / Зіграно pills) → **Story 2.9** / UX-DR7.
- **Standings table**, **Score input**, **Bracket pair** → Stories **3.8** / **3.6** / **4.6** (UX-DR5 / DR8 / DR6).
- Any `Tournament` / `Team` / `Player` data, any `src/data` function, any Server Action, any `src/domain` code, any migration.
- The admin "Створити турнір" / "Заявити команду" CTAs *inside* an `EmptyState` → **Story 2.4 / 2.7 / 2.9** (this story ships only the `action` slot).
- The DESIGN.md **type scale** as tokens (`display` 32/700/−0.6px, `display-sm` 24/700/−0.3px, `body`, `label`, `caption`) — deferred from Story 1.2 with "owner: 1.8", not done in 1.8 either. No consumer needs the 32px `display` until the tournament page title (**Story 2.9**); fold it there. `EmptyState`'s heading is deliberately `text-lg` (see AC note).
- A general **pending-Button** component — the spinner is baked into `ConfirmDialog`; `GrantAdminButton` gets a one-line inline `<Loader2Icon />`, not a new abstraction.
- The **44px touch-target** sweep, the **7px** per-component radius for inputs / tab-chips, the primary-Button **darker-blue hover** — see "Adjacent deferred items".

### Adjacent deferred items — do NOT pull in (rationale)

`deferred-work.md` routes several design-system concerns "to Story 2.2 or a design-system pass". Keeping this story tight to its AC (4 primitives), they stay deferred:

- **44px interactive targets** (`Button` `h-8`, `Avatar` `size-8`, nav links ~36px). A per-component bump collides with every other control — it is a global sizing decision (bump the shadcn `default` size? add a mobile media rule?), not a 2.2 deliverable. Owner: a dedicated design-system / a11y pass. `ConfirmDialog`'s buttons inherit `Button`'s current sizes — do not special-case them.
- **7px radius on inputs / tab-chips** — no `Input` or tab-chip exists yet; whoever adds them (Story 2.4 form / 2.9 tabs) sets `rounded-sm` per-component then.
- **Primary-Button darker-blue hover** (`hover:bg-primary/80` lightens on white) — a `button.tsx` variant tweak; do it when a hover-contrast review has a real screen to test against (Story 2.4). `ConfirmDialog`'s default confirm button uses the current `Button` `default` variant as-is.
- **Small blue-text contrast** — Story 3.8 (standings position numbers).

If the reviewer wants any of these folded in now, that is a scope decision for the user — flag it, do not silently expand.

### Files this story touches

| File | Status | Notes |
| --- | --- | --- |
| `src/lib/notify.ts` | NEW | `sonner` wrapper: `notify.success` / `notify.error`. Plain module. |
| `src/components/ui/skeleton.tsx` | NEW | Canonical shadcn `Skeleton` (`animate-pulse rounded-md bg-muted`). Hand-written, not `shadcn add`. |
| `src/components/skeletons.tsx` | NEW | `TableSkeleton({ rows?, columns? })`, `CardSkeleton({ count? })`. Minimal. No consumer yet (Story 2.9). |
| `src/components/confirm-dialog.tsx` | NEW | `"use client"`. Wraps `ui/dialog.tsx`. Props: `trigger`, `title`, `description` (required), `confirmLabel`, `cancelLabel?`, `destructive?`, `onConfirm`. Self-managed open + pending; re-entrancy + `alive` guards; initial focus on Cancel for destructive; `console.error` on `onConfirm` throw. |
| `src/components/empty-state.tsx` | UPDATE | + `action?: ReactNode` slot, + `headingLevel?: 2 \| 3` (default 2). Heading stays `text-lg font-semibold` (signed-off deviation from UX-DR9 — see review). |
| `src/lib/empty-states.ts` | NEW | 6 canonical `{ title, description }` copies (5 AC cases + `ARCHIVE_EMPTY`). `description` = EXPERIENCE.md §Voice verbatim. Single source (cf. `src/lib/sections.ts`). |
| `src/components/ui/sonner.tsx` | UPDATE | + `toastOptions.classNames.error`/`.success` bound to `--destructive`/`--success` tokens (NOT `richColors`); verify/remove the dead `cn-toast` class. |
| `src/app/globals.css` | UPDATE | + `--destructive-foreground` (`:root` + `@theme inline`); + a `@media (prefers-reduced-motion: reduce)` block neutralising `animate-pulse` / `animate-spin`. |
| `src/components/admin-role-controls.tsx` | UPDATE | Migrate to `ConfirmDialog` + `notify` + confirm-button spinner. Regression-guarded (Task 6). |
| `src/app/classic/page.tsx` · `beach/page.tsx` · `archive/page.tsx` | UPDATE | Import copy from `src/lib/empty-states.ts`. |
| `eslint.config.mjs` | UPDATE | + `no-alert: "error"` over `src/**`. |
| `src/components/README.md` | NEW | Reusable-primitive usage notes. |
| `AGENTS.md` | UPDATE | One line: the reusable UX primitives + the `no-alert` rule. |
| `src/components/flash-toaster.tsx` | DO NOT TOUCH (verify) | Inherits the new `.error` toast class — eyeball its `?error=admin-required` toast in Task 8; its direct `toast.error` (with an `id` option) is a sanctioned one-off, add it to the `notify` lint exception if that rule is added. |
| `src/components/ui/dialog.tsx` · `button.tsx` | DO NOT TOUCH | `ConfirmDialog` composes them unchanged. |
| `src/data/**` · `src/actions/**` · `src/domain/**` · `src/auth/**` · `prisma/**` | DO NOT TOUCH | Not a data/logic story. |

### Architecture compliance

- **AD-1 / layers** — everything here is View (`src/components/**`, `src/lib/**`, `src/app/**`). `ConfirmDialog` is a Client Component only because it holds state; it fetches nothing. `EmptyState` / `Skeleton` / `TableSkeleton` / `CardSkeleton` are presentational (no `"use client"`). [ARCHITECTURE-SPINE.md#Design Paradigm]
- **AD-3 / import direction** — `src/components/**` may import `src/components/ui/**`, `src/lib/**`, `next/*`, `react`, `lucide-react`. It is lint-blocked from `@/auth`. `admin-role-controls.tsx` importing `@/actions/admin-roles` is the sanctioned `view → shell` edge (unchanged by this story). No component here touches `@/data` / `@/domain` / `@prisma/client`. [src/README.md, eslint.config.mjs]
- **AD-6 / mutations** — this story adds **no** Server Action. `admin-role-controls.tsx` keeps calling the existing `grantAdmin` / `revokeAdmin` actions; only the surrounding UI (dialog + toast) changes. [ARCHITECTURE-SPINE.md#AD-6]
- **DESIGN.md** — `ConfirmDialog` uses `Dialog` as-is (DESIGN "As-is зі shadcn (не чіпати): … Dialog"); confirm button `destructive` per UX-DR10 (the base-nova `destructive` variant is a low-emphasis tint — accepted for v1 in review); `EmptyState` = dashed `rounded-lg` (`--radius-lg` 14px), muted foreground (UX-DR9); `Skeleton` on `bg-muted` (UX-DR12); toast success/error bound to `--success` / `--destructive` via `toastOptions.classNames` (UX-DR11 — `richColors` is off-token, not used). One primary button per screen — `ConfirmDialog` has exactly one non-cancel action. No blue as decoration.
- **EXPERIENCE.md** — Interaction Primitives: "Підтвердження … shadcn `Dialog`, **не** нативний `confirm()`" → the `no-alert` rule; "Кнопка на час запиту — `disabled` + Skeleton/спінер у кнопці" → the confirm-button spinner + `GrantAdminButton` spinner; State Patterns "Завантаження → shadcn Skeleton … без спінерів на всю сторінку" → `TableSkeleton` / `CardSkeleton`, no full-page spinner; "Помилка Server Action → shadcn Toast (`destructive`)" → `notify.error` + the token-bound `classNames.error`; Voice → verb `confirmLabel`s, EXPERIENCE.md's own sentences in `empty-states.ts`, no exclamation marks.
- **Consistency Conventions** — UA-only copy, no i18n lib; `notify` / `ConfirmDialog` messages are UA literals. `revalidatePath` after writes is the action's job (unchanged). [ARCHITECTURE-SPINE.md#Consistency Conventions]

### Existing code being modified — current state → what changes → what must be preserved

**`src/components/admin-role-controls.tsx`** (Story 1.7, shipped + reviewed)
- *Current:* `GrantAdminButton` — `useTransition`, calls `grantAdmin(userId)`, `toast.success("Доступ надано")` / `toast.error(res.message)` / `catch → toast.error("Не вдалося надати доступ. Спробуйте ще раз.")`, `<Button size="sm" variant="outline" disabled={pending}>`. `RevokeAdminButton` — a `disabled` prop short-circuits to a disabled `<Button variant="destructive">` + a `<span id={reasonId}>Ви єдиний адміністратор</span>` with `aria-describedby`; otherwise a hand-rolled `<Dialog open onOpenChange={(next) => !pending && setOpen(next)}>` with `DialogTrigger render={<Button size="sm" variant="destructive" />}`, `DialogContent` / `Header` / `Title` "Зняти доступ адміністратора?" / `Description` (self vs other copy) / `Footer` with `DialogClose render={<Button variant="outline" disabled={pending} />}` "Скасувати" + `<Button variant="destructive" onClick={revoke} disabled={pending}>Зняти`. `revoke` — `useTransition`, `revokeAdmin(userId)`, on ok `setOpen(false)` + `toast.success("Доступ знято")` + if `isSelf` `router.push("/")` + `router.refresh()`; on `!ok` `toast.error(res.message)` (dialog stays open); `catch → toast.error("Не вдалося зняти доступ. Спробуйте ще раз.")`.
- *Changes:* `toast.*` → `notify.*`; the hand-rolled `Dialog` in the active revoke branch → `<ConfirmDialog trigger=… title=… description=… confirmLabel="Зняти" destructive onConfirm={revoke} />`; `revoke` now **throws** after `notify.error` on any failure path (so `ConfirmDialog` keeps the dialog open); `useState(open)` / `useTransition` removed from `RevokeAdminButton` active branch (`ConfirmDialog` owns both); `GrantAdminButton` gains an inline spinner while `pending`.
- *Must preserve, verbatim:* the `disabled` (last-admin) branch markup + `reasonId` + `aria-describedby` + "Ви єдиний адміністратор"; every UA string ("Доступ надано" / "Доступ знято" / "Зняти доступ адміністратора?" / the two descriptions / "Зняти" / "Скасувати" / both `catch` fallbacks); `isSelf` → `router.push("/")` + `router.refresh()`; the trigger button `size="sm" variant="destructive"` and grant button `size="sm" variant="outline"`; the "don't close mid-request" guarantee; the list refresh after each action (driven by the actions' own `revalidatePath` — do not remove or duplicate).

**`src/components/empty-state.tsx`** (Story 1.8)
- *Current:* `export function EmptyState({ title, description }: { title: string; description: string })` → `<div className="rounded-lg border border-dashed px-6 py-10 text-center"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>`.
- *Changes:* + optional `action?: ReactNode` (`<div className="mt-4">` after the `<p>`); + optional `headingLevel?: 2 | 3` (default `2`) selecting `<h2>`/`<h3>`.
- *Must preserve:* the classes (incl. `text-lg font-semibold` on the heading — the signed-off deviation), the heading/`<p>` structure, `description: string` typing, no `"use client"`.

**`src/components/ui/sonner.tsx`** (Story 1.5)
- *Current:* `<Sonner theme="light" … icons={…} style={{…--normal-*…}} toastOptions={{ classNames: { toast: "cn-toast" } }} {...props} />`.
- *Changes:* `toastOptions.classNames` gains `error` / `success` bound to `!bg-destructive !text-destructive-foreground !border-destructive` / `!bg-success !text-success-foreground !border-success`; the `toast: "cn-toast"` entry is removed unless a `.cn-toast` rule is found to exist. **No `richColors`** (it uses sonner's own palette, off-token).
- *Must preserve:* `theme="light"`, the custom `icons`, the `--normal-*` style vars, and the "// Light theme only … Do not re-add next-themes" comment.

**`src/app/{classic,beach,archive}/page.tsx`** (Story 1.8) — currently inline copy via `SectionShell` + `EmptyState`. Change: source the `{ title, description }` from `src/lib/empty-states.ts`. Preserve: `SectionShell`, `metadata` from `src/lib/sections.ts`, the Server-Component shape, static prerender.

**`eslint.config.mjs`** (Story 1.3) — flat config array. Add one block; preserve every existing block and `globalIgnores`.

### `@base-ui` Dialog mechanics (base-nova preset — NOT Radix)

- `src/components/ui/dialog.tsx` wraps `@base-ui/react/dialog`. `Dialog` = `DialogPrimitive.Root` (`open` / `onOpenChange` / `defaultOpen`). `DialogTrigger` / `DialogClose` take a **`render`** prop (`render={<Button … />}`) — base-ui merges its behaviour onto your element; that is how `admin-role-controls` passes a `<Button>` today. `ConfirmDialog` does the same with the caller's `trigger` element.
- `DialogContent` already renders the `DialogPortal` + `DialogOverlay` and a built-in close "X" (`showCloseButton` default `true`) — `ConfirmDialog` can leave that default (Esc / X / backdrop all route through `onOpenChange`, which the `!pending` guard gates).
- `DialogFooter` is `flex flex-col-reverse … sm:flex-row sm:justify-end` with a `bg-muted/50` band — put `DialogClose` (cancel) first, the confirm `<Button>` second; the `flex-col-reverse` puts confirm on top on mobile, cancel-left / confirm-right on desktop. Matches `admin-role-controls`.
- Do not add `@radix-ui/*` — it is not a dependency.

### `sonner` toast colouring — bind to tokens, not `richColors`

- `sonner@2.0.8`. `richColors` on `<Toaster>` opts typed toasts into *sonner's own* palette (~`#e5484d` red, `#008a2e` green) — **not** the project's `--destructive` / `--success` CSS vars. So `richColors` cannot satisfy UX-DR11's "on the `destructive` token" — the review confirmed this and it is not the mechanism.
- **The mechanism:** `toastOptions={{ classNames: { error: "!bg-destructive !text-destructive-foreground !border-destructive", success: "!bg-success !text-success-foreground !border-success" } }}`. `sonner` applies `classNames.error` to `[data-type=error]` toasts (what `toast.error` / `notify.error` produce), `.success` likewise. The `!` prefixes beat sonner's inline `--normal-*` custom-property styling. This is greppable and DOM-assertable.
- The `--normal-*` style vars in `ui/sonner.tsx` still style the *untyped* toast (`toast("…")` with no level) — leave them.
- `--destructive-foreground` does not exist yet (only `--success-foreground`). Add it (Task 1). The tinted `Button` `destructive` variant never needed it; a solid destructive toast background does.
- Verify the custom `icons` still render (they are orthogonal to `classNames`).
- `toast` is import-safe in any Client Component; `notify.ts` needs no `"use client"` — but must only ever be imported *from* Client Components.

### Testing requirements

- **No unit tests / no Vitest.** No `src/domain` code (the first Epic-2 domain module is Story 2.3). Pure view. Adding a runner now is work Story 2.3 redoes. The gate is operational (Task 8): `lint` (incl. `no-alert` + the `--print-config` check) + `typecheck` + `build` clean on Node 24; route classification unchanged; the import-boundary grep clean; and a **browser walkthrough** — `ConfirmDialog` (open / cancel / confirm / pending-spinner / destructive-focus-on-Cancel / stays-open-and-silent-on-throw / re-entrancy / in-flight lock, all on the scratch page since `revokeAdmin` can't reach the throw path), the `admin-role-controls` regression checklist (Task 6, incl. the list refresh without `useTransition`), the `Skeleton` shapes, all 6 `empty-states` consts + the `action` / `headingLevel` slots, and the toast colours by **computed style** (error `#C4342B` bg / white text, success `#1F8A54` / white) plus the `flash-toaster` surface.
- Capture real command output + the walkthrough in the Dev Agent Record — verifiable, not asserted (Stories 1.1–1.8 / 2.1 pattern; Story 1.8 used `pnpm dev` + `curl` + a narrow-viewport browser check — reuse that rig).
- When Vitest lands (Story 2.3+), the first component tests: `ConfirmDialog`'s resolve-closes / throw-stays-open / pending-lock / re-entrancy-guard contract; `admin-role-controls`' last-admin disabled branch + `aria-describedby`, the non-self list refresh, the self-revoke nav; a committed `no-alert` negative fixture. These are tracked in `deferred-work.md` (added by the 2026-09-04 review) — the manual walkthrough (Task 8) is the only gate until then, and `admin-role-controls` is a shipped feature, so run it carefully.

### Previous story intelligence

**Story 1.8 (done)** — created `src/components/empty-state.tsx` (the primitive this story formalises), `src/components/section-shell.tsx`, `src/lib/sections.ts` (the "single source for repeated strings" pattern → `src/lib/empty-states.ts` follows it), `src/app/{classic,beach,archive}/page.tsx` (the 3 call sites). Its review explicitly assigned "reusable `EmptyState` + `Skeleton` + `Toast` helper + `ConfirmDialog`" and "refactor these three call sites" to **this story**. Its own review also downsized `EmptyState`'s heading `text-2xl font-bold` → `text-lg font-semibold` to avoid two stacked bold lines under the page `<h1>` — this story keeps that (see AC note). Focus-ring convention on interactive view elements: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary` (see `discipline-nav.tsx`, `user-menu.tsx`) — `ConfirmDialog`'s buttons inherit `Button`'s own `focus-visible` ring, no extra needed.

**Story 1.7 (done)** — `src/components/admin-role-controls.tsx` is the hand-rolled dialog `ConfirmDialog` extracts. Its review deferred, explicitly to this story: *"The reusable loading affordance is Story 2.2; apply it to `admin-role-controls.tsx` then"* and *"Buttons show only `disabled` while pending — no spinner or 'Надаю…'/'Знімаю…' label, contrary to EXPERIENCE.md"*. `grantAdmin` / `revokeAdmin` return `{ ok, code, message }` (`ActionResult` in `src/actions/result.ts` — `ActionErrorCode = "FORBIDDEN" | "LAST_ADMIN" | "NOT_FOUND"`). The list refresh after grant/revoke rides on the actions' `revalidatePath` — historically with `useTransition` around the call. `GrantAdminButton` keeps `useTransition`; `RevokeAdminButton` drops it (`ConfirmDialog` owns pending), so `revoke()` adds a `router.refresh()` and Task 8 explicitly verifies the row updates without a reload.

**Story 1.5 (done)** — `src/components/ui/sonner.tsx` + `<Toaster />` in `src/app/layout.tsx`; `theme="light"` hard-coded, "do not re-add next-themes". Deferred to 2.2 / a design-system pass: the 44px target floor (`Button` `h-8`, `Avatar` `size-8`) — **staying deferred**, see "Adjacent deferred items".

**Story 1.2 (done)** — `globals.css` tokens: `--radius-sm` 7px / `--radius-md` 10px / `--radius-lg` 14px; `--muted` `#F5F5F4` / `--muted-foreground` `#6B6B70` / `--success` `#1F8A54` / `--destructive` `#C4342B` all exist; light-only, `color-scheme: light`. `Button` base string is `rounded-md`; `default` variant `bg-primary text-primary-foreground hover:bg-primary/80`; `destructive` variant `bg-destructive/10 text-destructive hover:bg-destructive/20` (a *tinted* destructive, not solid — that is the shipped base-nova look; `ConfirmDialog`'s destructive confirm button uses it as-is). Deferred to 2.2: type-scale tokens, per-component radius, primary hover — **type scale stays deferred** (no consumer), the other two stay deferred (see "Adjacent deferred items").

**Story 2.1 (done)** — schema only; no bearing on this view story beyond confirming Epic 2 is `in-progress`. Its review created `deferred-work.md` entries the *feature* stories own (P2002 mapping, etc.) — none are 2.2's.

### Git intelligence

Recent: `15cf8e6` (2.1 review patches) ← `9bfa73d` (2.1 schema) ← `a32c27c` (2.1 draft) ← `ac118f7` (1.8 review) ← `91708cc` (1.8). `src/components/` = `ui/` (`button`, `card`, `dialog`, `dropdown-menu`, `avatar`, `sonner`), `user-menu.tsx`, `flash-toaster.tsx`, `admin-role-controls.tsx`, `section-shell.tsx`, `empty-state.tsx`, `discipline-nav.tsx`. No `confirm-dialog.tsx` / `skeletons.tsx` / `ui/skeleton.tsx` / `src/lib/notify.ts` / `src/lib/empty-states.ts` / `src/components/README.md`. `src/lib/` = `utils.ts` (`cn`), `auth-client.ts`, `sections.ts`. `eslint.config.mjs` has the Story 1.3 import-boundary blocks; no `no-alert`.

### Latest tech information

- **`@base-ui/react` 1.7** — `Dialog` primitives via `render` prop composition (not `asChild`). No breaking changes relevant here; `ui/dialog.tsx` already targets this version.
- **`sonner` 2.0.8** — `toastOptions.classNames.{error,success,warning,info}` target `[data-type=…]` toasts; `richColors` exists but paints from sonner's own palette (off-token — not used here). `<Toaster>` is a single instance in the root layout (already there).
- **`lucide-react` 1.39** — `Loader2Icon` (used in `ui/sonner.tsx` already). `className="size-4 animate-spin"` is the spin idiom.
- **Tailwind v4** — `animate-pulse` is a core utility (Skeleton); `tw-animate-css` is imported but not needed for `Skeleton`.
- **ESLint 9 flat config** — `no-alert` is a core rule (`eslint:recommended` does *not* enable it by default, so an explicit block is required). No plugin needed.
- No new dependency. No `shadcn add` (hand-write `Skeleton`). No security advisories.

### Project context reference

No `project-context.md` in this repo (the `persistent_facts` glob matched nothing). Binding docs: `epics.md` (Story 2.2 AC + Epic 2 intro "компоненти … багаторазові патерни Dialog / Toast / Skeleton" + the UX-DR list), `DESIGN.md` (§ Components: Empty state / "As-is зі shadcn" Dialog+Toast+Skeleton; § Colors success/destructive; § Shapes `rounded.lg` for empty states/dialogs), `EXPERIENCE.md` (§ Component Patterns, § State Patterns table, § Interaction Primitives — confirmation / pending button / feedback, § Voice and Tone — verb buttons, calm empty states), `SPEC.md` (Constraints — UA-only; AD-1…AD-11 mandatory), `ARCHITECTURE-SPINE.md` (Design Paradigm layer table, AD-1, AD-3, AD-6, Consistency Conventions), `AGENTS.md` (pnpm + PowerShell; `sonner` is the toast primitive; `<Toaster />` location; the native-dialog / Chrome-automation hazard), `deferred-work.md` (the 1.5 / 1.7 / 1.8 / 1.2 items routed here — resolve the two 1.7 ones, keep the rest deferred with rationale), `1-2-design-tokens.md` (token names, `Button` variants, deferred type scale), `1-7-admin-management.md` (the `admin-role-controls` behaviour to preserve), `1-8-public-shell-and-menu.md` (`EmptyState` origin + the "2.2 formalises + refactors 3 call sites" mandate, the `pnpm dev` + `curl` verification rig). Mockup: `_bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/mockups/directions-3-chosen-C.html` (`.C .empty` = `border:1px dashed #E7E7E4; border-radius:12px; padding:26px; text-align:center; color:#9a9a9e; font-size:13px` — the reference for the muted, low-key empty state).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2: Багаторазові UX-патерни] — user story + AC (ConfirmDialog / Toast / Skeleton / EmptyState; no native `confirm()`; ConfirmDialog props; EmptyState 5 cases)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2] — "компоненти Status badge та багаторазові патерни Dialog / Toast / Skeleton"; "Реалізує: … UX-DR9, UX-DR10, UX-DR11, UX-DR12"
- [Source: _bmad-output/planning-artifacts/epics.md#Додаткові вимоги (Архітектура) / UX Design-вимоги] — UX-DR9 (Empty state: dashed, `display-sm` + line, 5 cases), UX-DR10 (Dialog not `confirm()`; confirm button `destructive`), UX-DR11 (Toast: success short + error `destructive`, form keeps input), UX-DR12 (Skeleton table/card; no full-page spinner)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/DESIGN.md#Components] — Empty state brand component; "As-is зі shadcn (не чіпати): … Dialog, … Toast, … Skeleton"
- [Source: …/DESIGN.md#Colors] — `success #1F8A54`, `destructive #C4342B`; blue never as decoration
- [Source: …/DESIGN.md#Shapes] — `lg` 14px for dialogs / empty states
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-untitled-2026-09-02/EXPERIENCE.md#Interaction Primitives] — "Підтвердження … shadcn `Dialog`, **не** нативний `confirm()`"; "Кнопка на час запиту — `disabled` + Skeleton/спінер у кнопці"; "успіх — короткий Toast"
- [Source: …/EXPERIENCE.md#State Patterns] — Завантаження → Skeleton, no full-page spinner; Порожньо: немає турнірів / немає команд → EmptyState + (адміну) CTA; Помилка Server Action → Toast `destructive`, form keeps input
- [Source: …/EXPERIENCE.md#Voice and Tone] — verb buttons ("Зняти", "Видалити"); "порожні стани — один спокійний рядок"; "підтвердження руйнівних дій — пряма мова"
- [Source: _bmad-output/planning-artifacts/architecture/architecture-untitled-2026-09-02/ARCHITECTURE-SPINE.md#Design Paradigm] — View layer = `src/app` + `src/components` + `src/lib`
- [Source: …/ARCHITECTURE-SPINE.md#AD-1, #AD-3, #AD-6] — single app; import direction `view → shell → {domain, data}`; mutations only via Server Actions under `requireAdmin()` (unchanged here)
- [Source: _bmad-output/specs/spec-cherkasy-volley/SPEC.md#Constraints] — UA-only interface; AD-1…AD-11 mandatory
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — "code review of 1-7": reusable loading affordance → Story 2.2, apply to `admin-role-controls.tsx`; buttons show only `disabled` while pending. "code review of 1-8": nav 44px targets / `⋯` collapse → design-system pass or 2.2 (kept deferred). "code review of 1-2": type scale (owner 1.8), per-component radius → 2.2, primary hover → 2.2 (kept deferred, rationale in "Adjacent deferred items")
- [Source: _bmad-output/implementation-artifacts/1-8-public-shell-and-menu.md] — `EmptyState` primitive ("Story 2.2 formalises the reusable version" / "refactors these three call sites"); the `pnpm dev` + `curl` + narrow-viewport verification rig
- [Source: _bmad-output/implementation-artifacts/1-7-admin-management.md] — `admin-role-controls.tsx` behaviour: `grantAdmin`/`revokeAdmin` actions, last-admin disabled state, self-revoke redirect, toast copy
- [Source: _bmad-output/implementation-artifacts/1-2-design-tokens.md] — token names / radii / `Button` variants; deferred type scale + per-component radius + primary hover
- [Source: AGENTS.md] — pnpm + PowerShell for `pnpm`; `sonner` is the toast primitive; `<Toaster />` in `src/app/layout.tsx`; native dialogs block the Chrome-automation extension
- [Source: src/components/ui/dialog.tsx] — `@base-ui/react/dialog` composition + `render` prop (the exact primitives `ConfirmDialog` wraps)
- [Source: src/components/admin-role-controls.tsx] — the hand-rolled dialog + `useTransition` + toast pattern being extracted
- Web: [sonner — Toaster `richColors`](https://sonner.emilkowal.ski/toaster), [Base UI — Dialog](https://base-ui.com/react/components/dialog), [ESLint — `no-alert`](https://eslint.org/docs/latest/rules/no-alert), [shadcn/ui — Skeleton](https://ui.shadcn.com/docs/components/skeleton)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

**Verification gate (Node 24):**
```
$ pnpm typecheck            → exit 0
$ pnpm lint                 → exit 0  (incl. the new no-alert block)
$ pnpm lint --print-config src/components/confirm-dialog.tsx → "no-alert": [ 2 ]  (error)
$ pnpm build                → exit 0
  Route (app): /_not-found ○ · /admin ƒ · /admin/people ƒ · /api/auth/[...all] ƒ
               /archive ○ · /beach ○ · /classic ○ · /sign-in ○   (unchanged from Story 1.8)
$ eslint src/__probe_no_alert.ts (throwaway: confirm/alert/prompt) → 3 errors, all `no-alert`; file deleted
$ grep "@prisma/client|generated/prisma|@/auth|@/actions|@/data" src/components/ src/lib/
   → only admin-role-controls.tsx → @/actions/admin-roles (sanctioned view→shell)
```

**Browser walkthrough** (`pnpm dev :3117` + Chrome automation; scratch page `src/app/scratch/page.tsx`, deleted after):
- **Toast colour (computed style):** `notify.error` toast `background: rgb(196,52,43)` = `#C4342B`, `color: white`, `border: #C4342B`. `notify.success` toast `background: rgb(31,138,84)` = `#1F8A54`, `color: white`; custom `CircleCheckIcon` still renders. Confirms the token-bound `classNames` approach hits the DESIGN tokens exactly (which `richColors` would not).
- **`?error=admin-required` flash toast** (Story 1.6 surface): renders "Потрібні права адміністратора" on `#C4342B` / white; `?error` param stripped from the URL. No regression.
- **`ConfirmDialog` — normal path:** open → focus lands on **Скасувати** (base-ui default: first tabbable; the footer's `DialogClose` precedes the confirm button and the close-X in DOM — no `initialFocus` prop needed). Confirm → dialog closes, `notify.success` toast fires.
- **`ConfirmDialog` — `onConfirm` throws:** click confirm → dialog **stays open** (verified by screenshot + `find` 3 s later), no toast, `console.error(Error)` logged, both buttons re-enable. Same result via `RevokeAdminButton` against the real `revokeAdmin` action (returns `FORBIDDEN` when unauthenticated) → `notify.error("Потрібні права адміністратора")` + dialog stays open.
- **`ConfirmDialog` — in-flight lock:** `onConfirm` with a 3 s delay → Esc / backdrop / X inert, both buttons `disabled`, spinner visible.
- **`admin-role-controls`:** `GrantAdminButton` → spinner while pending, `notify.error` on `FORBIDDEN`, re-enables. `RevokeAdminButton` active branch → `ConfirmDialog` with the non-self description, Cancel closes it, confirm runs the FORBIDDEN path (stays open). Disabled (last-admin) branch → disabled `<Button>` + "Ви єдиний адміністратор" span, `aria-describedby` wired to the span id, `aria-haspopup` absent — no dialog.
- **`EmptyState`:** all 6 `empty-states.ts` consts render (dashed `rounded-lg`, `<h2 text-lg font-semibold>` + muted `<p>`); `action` slot renders a `<Button>`; `headingLevel={3}` emits `<h3>`. `/classic` still shows `NO_TOURNAMENTS`.
- **`Skeleton` / `TableSkeleton` / `CardSkeleton`:** render pulsing bars; the `@media (prefers-reduced-motion: reduce)` rule compiles (`animation: none` on `.animate-pulse` / `.animate-spin`).

**Bug found and fixed during the walkthrough:** the `alive` `useRef` cleanup-only effect (`useEffect(() => () => { alive.current = false }, [])`) leaves `alive.current === false` after React StrictMode's dev double-invoke (mount → cleanup → mount, with no re-set), which suppressed `setOpen(false)` / `setPending(false)` and stuck the dialog. Fixed to set `alive.current = true` in the effect body as well as `false` in cleanup.

### Completion Notes List

- **`notify` (`src/lib/notify.ts`)** — 12-line `sonner` wrapper. Toast colours bound to `--destructive` / `--success` via `toastOptions.classNames.error` / `.success` in `ui/sonner.tsx` (**not** `richColors` — verified it paints off-token). New `--destructive-foreground: #ffffff` token added to `globals.css` (`:root` + `@theme inline`) for the solid destructive toast text; the tinted `Button` `destructive` variant is unchanged.
- **`ui/sonner.tsx`** — the dead `toast: "cn-toast"` class (undefined since Story 1.5) removed; `theme`, `icons`, `--normal-*` style vars kept.
- **`ConfirmDialog`** — self-managed `open` + `pending`; `if (pending) return` re-entrancy guard; `catch (e) { console.error(e) }` (caller owns user-facing messaging); `alive` ref for post-navigation `setState` (StrictMode-safe). No `initialFocus` prop — base-ui's default already focuses Cancel. `description` is required.
- **`EmptyState`** — `+ action?: ReactNode`, `+ headingLevel?: 2 | 3` (default 2). Heading stays `text-lg font-semibold` (signed-off deviation from UX-DR9 — see Review Findings / Change Log).
- **`empty-states.ts`** — 6 consts; `description` = EXPERIENCE.md §Voice verbatim. A file comment notes the "no results" state is an in-table row on a standings tab (Story 3.8), the box only for other contexts.
- **`admin-role-controls.tsx`** — `toast.*` → `notify.*`; `RevokeAdminButton` active branch now `ConfirmDialog` (dropped local `useState`/`useTransition` + the `Dialog*` imports); `revoke()` throws on every failure path so the dialog stays open; `router.refresh()` added to the non-self success path (belt-and-braces for the list refresh now that `useTransition` is gone); `GrantAdminButton` gains an inline spinner, keeps `useTransition`. Last-admin disabled branch untouched.
- **`Skeleton` / composites** — canonical shadcn primitive hand-written (no `shadcn add`); `TableSkeleton` / `CardSkeleton` clamp counts to 0–50, wrap in `role="status"` + `aria-label`.
- **`no-alert`** — one flat-config block over `src/**`; `alert` / `confirm` / `prompt` are now lint errors.
- **Reduced motion** — one `@media (prefers-reduced-motion: reduce)` block in `globals.css` neutralises `animate-pulse` / `animate-spin`.
- **Docs** — new `src/components/README.md`; `AGENTS.md` gains a reusable-primitives line and updates the `EmptyState` note; `deferred-work.md` — the "buttons show only disabled while pending" 1.7 item struck; the three 2-2 carry-forwards (from the review) left in place.
- **No tests** — no `src/domain` / no Vitest yet (Story 2.3). Gate is operational + the browser walkthrough above.
- **`/admin/people` with a real admin session** was not exercised (no automated OAuth) — the FORBIDDEN path on the scratch page covers the `ConfirmDialog` + `notify` wiring; the grant/revoke *success* + list-refresh path needs a signed-in manual pass (tracked in `deferred-work.md` for the Story 2.3 Vitest runner).

### File List

**New**
- `src/lib/notify.ts`
- `src/lib/empty-states.ts`
- `src/components/confirm-dialog.tsx`
- `src/components/skeletons.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/README.md`

**Modified**
- `src/app/globals.css` — `--destructive-foreground` token + `prefers-reduced-motion` block
- `src/components/ui/sonner.tsx` — token-bound `error` / `success` toast classes; dead `cn-toast` removed
- `src/components/empty-state.tsx` — `action` + `headingLevel` props
- `src/components/admin-role-controls.tsx` — `ConfirmDialog` + `notify` migration
- `src/app/classic/page.tsx` · `src/app/beach/page.tsx` · `src/app/archive/page.tsx` — copy from `src/lib/empty-states.ts`
- `eslint.config.mjs` — `no-alert` block
- `AGENTS.md` — reusable-primitives conventions
- `_bmad-output/implementation-artifacts/deferred-work.md` — 1.7 item struck

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-04 | Story drafted (`bmad-create-story`). Status: ready-for-dev. |
| 2026-09-04 | Pre-implementation review (`bmad-code-review`, 4 layers). 2 decisions resolved: (1) `EmptyState` heading stays `text-lg font-semibold` — a **deliberate, signed-off deviation** from UX-DR9's "`display-sm` (24px)" heading (mockup shows a muted 13px one-liner; EXPERIENCE.md Voice wants "один спокійний рядок"; a second 24/700 line under `SectionShell`'s `h1` is a hierarchy error); type-scale tokenisation stays deferred to Story 2.9. (2) base-nova's tinted `destructive` Button variant accepted as-is for v1. 13 patches applied to the story (toast colour bound to `--destructive`/`--success` tokens not `richColors` + new `--destructive-foreground`; `empty-states.ts` copy = EXPERIENCE.md Voice verbatim; `ConfirmDialog` hardening — required `description`, re-entrancy + `alive` guards, `console.error`, initial focus; `EmptyState` `headingLevel`; grant/revoke list-refresh verification; Task 8 scratch-page contract checks; `no-alert` scope; reduced-motion; Skeleton clamp + a11y; docs/context). 2 items deferred → `deferred-work.md`. Status: ready-for-dev (unchanged — not yet implemented). |
| 2026-09-04 | Implemented Tasks 1–9 (`bmad-dev-story`). New: `src/lib/notify.ts`, `src/lib/empty-states.ts`, `src/components/confirm-dialog.tsx`, `src/components/skeletons.tsx`, `src/components/ui/skeleton.tsx`, `src/components/README.md`. Modified: `globals.css` (`--destructive-foreground` + `prefers-reduced-motion`), `ui/sonner.tsx` (token-bound `error`/`success` toast classes, dead `cn-toast` removed), `empty-state.tsx` (`action` + `headingLevel`), `admin-role-controls.tsx` (`ConfirmDialog` + `notify`), `classic`/`beach`/`archive` pages, `eslint.config.mjs` (`no-alert`), `AGENTS.md`, `deferred-work.md`. `typecheck` / `lint` / `build` clean on Node 24; route table unchanged. Browser walkthrough confirmed: toast colours on-token (`#C4342B` / `#1F8A54`, white text, verified by computed style); `ConfirmDialog` resolve-closes / throw-stays-open-silent (`console.error`) / in-flight lock / Cancel-focus; `admin-role-controls` FORBIDDEN path + disabled last-admin branch; all 6 empty states + `action` / `headingLevel`; flash-toaster surface. Fixed an `alive`-ref StrictMode bug found in the walkthrough. Status: in-progress → review. |
