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
