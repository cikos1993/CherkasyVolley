import { Skeleton } from "@/components/ui/skeleton";

// Placeholders only — consumers style the real dimensions against their table.
const clamp = (n: number) => Math.max(0, Math.min(Math.floor(n), 50));
const range = (n: number) => Array.from({ length: clamp(n) }, (_, i) => i);

export function TableSkeleton({
  rows = 5,
  columns = 4,
  label = "Завантаження",
}: {
  rows?: number;
  columns?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-label={label} className="w-full">
      <div aria-hidden className="flex flex-col gap-2">
        {range(rows + 1).map((r) => (
          <div key={r} className="flex gap-2">
            {range(columns).map((c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({
  count = 1,
  label = "Завантаження",
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3">
      {range(count).map((i) => (
        <div key={i} aria-hidden className="rounded-md border p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}
