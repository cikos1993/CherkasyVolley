import { TrophyIcon } from "lucide-react";

export type PlayoffPlacementRow = {
  label: string;
  teamName: string | null;
};

/**
 * Read-only list of the final placements 1–4 for the admin schedule page.
 * Computed from the playoff results (never stored). A place stays «матч не
 * зіграно» until its deciding match — the final for 1–2, the third-place match
 * for 3–4 — has a result. The ordinal label is the cue, not colour or the icon.
 */
export function PlayoffPlacements({ rows }: { rows: PlayoffPlacementRow[] }) {
  return (
    <ol className="divide-y">
      {rows.map((row, index) => (
        <li key={row.label} className="flex items-baseline gap-3 py-2">
          <span className="w-20 shrink-0 text-sm text-muted-foreground">{row.label}</span>
          {row.teamName ? (
            <span className="inline-flex items-center gap-1.5 font-medium">
              {index === 0 ? <TrophyIcon className="size-4 text-success" aria-hidden /> : null}
              {row.teamName}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">матч не зіграно</span>
          )}
        </li>
      ))}
    </ol>
  );
}
