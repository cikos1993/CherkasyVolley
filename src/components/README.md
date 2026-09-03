# `src/components` — shared view primitives

Presentational and interaction building blocks. Domain-free: no `@/data`,
`@/domain`, `@/actions` (the one exception is `admin-role-controls.tsx`, which
calls its Server Actions — the sanctioned `view → shell` edge), and no `@/auth`
(use `@/lib/auth-client`). shadcn/base-nova primitives live in `ui/`.

## `notify` (`@/lib/notify`)

The single entry point for toasts. **Import `notify`, never `sonner`'s `toast`
directly** — the only exceptions are `ui/sonner.tsx` (the `<Toaster>`) and
`flash-toaster.tsx` (needs the `id` option to de-dupe the URL-param toast).

- `notify.success(message)` — short confirmation. Renders on the success token
  (`#1F8A54` background, white text).
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

- `onConfirm` resolves → the dialog closes.
- `onConfirm` throws → the dialog stays open, the error is `console.error`d, and
  **no toast is shown**. The caller owns user-facing messaging: call
  `notify.error(...)` inside `onConfirm` before re-throwing on the failure paths.
- The whole dialog (both buttons, Esc, backdrop, close X) is locked while
  `onConfirm` is in flight; a long-running action must impose its own timeout.
- `description` is required — every confirmation states what will happen.

## `EmptyState` (`@/components/empty-state`) + `@/lib/empty-states`

Dashed-border block: `title`, `description`, optional `action` (an admin CTA),
optional `headingLevel` (`2` default, `3` for nested sections so heading order
stays correct). Canonical copy lives in `@/lib/empty-states` — `description`
carries the authoritative sentence from the UX Voice guide; spread it:
`<EmptyState {...NO_TOURNAMENTS} />`.

## `Skeleton` / `TableSkeleton` / `CardSkeleton`

`ui/skeleton` is the primitive; `skeletons.tsx` has the table / card shapes.
Loading states use these — **never a full-page spinner**. Each composite renders
a `role="status"` wrapper; wrap the swap so a screen reader hears it:

```tsx
{pending ? <TableSkeleton rows={6} columns={5} /> : <StandingsTable … />}
```

Counts are clamped (0–50). The consumer owns any `overflow-x-auto` scroll
container around a `TableSkeleton`.

## Motion

`animate-pulse` and `animate-spin` are switched off under
`prefers-reduced-motion` (see `app/globals.css`).

## No native dialogs

`alert()` / `confirm()` / `prompt()` are ESLint errors (`no-alert`). Use
`ConfirmDialog` or a toast.
