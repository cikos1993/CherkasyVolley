import { TrophyIcon } from "lucide-react";

const PLACE_LABELS = ["1-е місце", "2-е місце", "3-тє місце", "4-е місце"] as const;

/**
 * Read-only list of the final placements 1–4 for the admin schedule page.
 * `teamNames` is the four places in order; a `null` entry is a place whose
 * deciding match — the final for 1–2, the third-place match for 3–4 — has no
 * result yet. Computed from the playoff results, never stored. The ordinal
 * label is the cue, not colour or the icon.
 */
export function PlayoffPlacements({ teamNames }: { teamNames: (string | null)[] }) {
  return (
    <ol className="divide-y" aria-label="Фінальні місця плейофа">
      {PLACE_LABELS.map((label, index) => {
        const teamName = teamNames[index] ?? null;
        return (
          <li key={label} className="flex items-baseline gap-3 py-2">
            <span className="w-20 shrink-0 text-sm text-muted-foreground">{label}</span>
            {teamName ? (
              <span className="inline-flex items-center gap-1.5 font-medium">
                {index === 0 ? <TrophyIcon className="size-4 text-primary" aria-hidden /> : null}
                {teamName}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">— (матч не зіграно)</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
