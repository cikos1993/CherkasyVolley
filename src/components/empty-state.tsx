import type { ReactNode } from "react";

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed px-6 py-10 text-center">
      <p className="text-2xl font-bold tracking-tight">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
