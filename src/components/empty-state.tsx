import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
  headingLevel = 2,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <div className="rounded-lg border border-dashed px-6 py-10 text-center">
      <Heading className="text-lg font-semibold">{title}</Heading>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
