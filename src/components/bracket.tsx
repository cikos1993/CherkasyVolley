import { PLAYOFF_SLOT_LABELS, type PlayoffSlot } from "@/lib/playoff-labels";

export type BracketPairVM = {
  slot: PlayoffSlot;
  status: "AWAITING" | "READY" | "PLAYED";
  homeTeam: string | null;
  awayTeam: string | null;
  /** Set summary like "3:1" for a played pair, null otherwise. */
  score: string | null;
};

// DESIGN.md's `#B0B0B4` for the "awaiting" card has no theme token; `border-border`
// + `text-muted-foreground` are the closest utilities. The dashed border and the
// literal "очікує суперників" carry the state — never colour alone.
function BracketPairCard({ pair }: { pair: BracketPairVM }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{PLAYOFF_SLOT_LABELS[pair.slot]}</p>
      {pair.status === "AWAITING" ? (
        <div className="mt-1 rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground">
          очікує суперників
        </div>
      ) : (
        <div className="mt-1 flex min-w-0 items-center justify-between gap-3 rounded-md bg-muted px-3 py-2 text-sm">
          <span className="min-w-0 break-words">
            {pair.homeTeam} — {pair.awayTeam}
          </span>
          {pair.score ? (
            <span className="shrink-0 font-medium tabular-nums">{pair.score}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * Read-only playoff bracket for the public tournament page. The score plus the
 * placements list below carry the outcome, so a winning team is not emphasised
 * here. Pairs are matched by slot, not array order: semifinals go in the left
 * column, the final and third-place match in the right, collapsing to a single
 * stacked column below 640px.
 */
export function Bracket({ pairs }: { pairs: BracketPairVM[] }) {
  const semifinals = pairs.filter((pair) => pair.slot === "SF1" || pair.slot === "SF2");
  const decisive = pairs.filter((pair) => pair.slot === "FINAL" || pair.slot === "THIRD_PLACE");

  return (
    <section aria-label="Сітка плейофа" className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-3">
        {semifinals.map((pair) => (
          <BracketPairCard key={pair.slot} pair={pair} />
        ))}
      </div>
      <div className="grid gap-3">
        {decisive.map((pair) => (
          <BracketPairCard key={pair.slot} pair={pair} />
        ))}
      </div>
    </section>
  );
}
