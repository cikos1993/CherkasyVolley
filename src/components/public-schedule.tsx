import { GROUP_NOT_DRAWN } from "@/lib/empty-states";

type MatchRow = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  scheduledAtDisplay: string | null;
  venueText: string | null;
  resultSummary: string | null;
};

export function PublicSchedule({ matches }: { matches: MatchRow[] }) {
  if (matches.length === 0) {
    return <p className="text-sm text-muted-foreground">{GROUP_NOT_DRAWN.description}</p>;
  }

  return (
    <ul className="divide-y">
      {matches.map((match) => (
        <li key={match.id} className="grid gap-1 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="font-medium">
              {match.homeTeam} — {match.awayTeam}
            </span>
            {match.resultSummary ? (
              <span className="text-sm tabular-nums">{match.resultSummary}</span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {match.scheduledAtDisplay ?? "час не визначено"}
            {match.venueText ? ` · ${match.venueText}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
