import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchResultForm } from "@/components/match-result-form";
import { getMatchForResult } from "@/data/matches";
import { formatKyivDateTime } from "@/domain/matchSchedule";
import { matchSetSummary } from "@/domain/scoring";

export const metadata = { title: "Матч" };

export default async function AdminMatchPage({
  params,
}: PageProps<"/admin/tournaments/[id]/matches/[matchId]">) {
  const { id, matchId } = await params;

  // `getMatchForResult` scopes by `tournamentId`; a non-null result means the
  // tournament exists (FK), so a separate tournament read would be dead weight.
  const match = await getMatchForResult(id, matchId);
  if (!match || match.stage !== "GROUP") notFound();

  const homeTeam = match.homeEntry?.team.name ?? "—";
  const awayTeam = match.awayEntry?.team.name ?? "—";
  const hasResult = match.sets.length > 0;
  const summary = matchSetSummary(match.sets);

  const meta = [
    match.scheduledAt ? formatKyivDateTime(match.scheduledAt) : "час не визначено",
    match.venueText || null,
  ].filter(Boolean);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        href={`/admin/tournaments/${id}/schedule`}
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        <span aria-hidden>←</span> Розклад
      </Link>
      <h1 className="mt-3 text-2xl font-bold">
        {homeTeam} — {awayTeam}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{meta.join(" · ")}</p>

      <div className="mt-6">
        {hasResult ? (
          <div className="grid gap-4">
            <ul className="grid gap-1">
              {match.sets.map((set) => (
                <li key={set.setNo} className="flex items-center gap-3 text-sm">
                  <span className="w-20 text-muted-foreground">Партія {set.setNo}</span>
                  <span className="tabular-nums">
                    {set.homePoints} : {set.awayPoints}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-sm">
              Рахунок у партіях:{" "}
              <span className="font-medium tabular-nums">
                {summary.home} : {summary.away}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              Виправлення й видалення результату — у наступному оновленні.
            </p>
          </div>
        ) : (
          <MatchResultForm
            tournamentId={id}
            matchId={matchId}
            preset={match.tournament.scoringPreset}
            tournamentType={match.tournament.type}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
          />
        )}
      </div>
    </main>
  );
}
