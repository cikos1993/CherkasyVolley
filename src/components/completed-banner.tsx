/**
 * The «Турнір завершено» notice shown at the top of a completed tournament's
 * page (public and admin). One canonical string, one markup, `role="status"`
 * so assistive tech announces why the edit controls below are gone
 * (EXPERIENCE — State Patterns «Турнір завершено»; Accessibility Floor).
 */
export function CompletedBanner({ className }: { className?: string }) {
  return (
    <p
      role="status"
      className={`rounded-md border border-muted-foreground/40 bg-muted px-3 py-2 text-sm ${className ?? ""}`}
    >
      Турнір завершено. Результати зафіксовано.
    </p>
  );
}
