import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchResultForm } from "@/components/match-result-form";
import { MatchResultPanel } from "@/components/match-result-panel";
import { getMatchForResult } from "@/data/matches";
import { formatKyivDateTime } from "@/domain/matchSchedule";

export const metadata = { title: "Матч" };

const STAGE_LABELS: Record<string, string> = {
  GROUP: "Груповий матч",
  SEMIFINAL: "Півфінал",
  THIRD_PLACE: "Матч за 3-тє місце",
  FINAL: "Фінал",
};

export default async function AdminMatchPage({
  params,
}: PageProps<"/admin/tournaments/[id]/matches/[matchId]">) {
  const { id, matchId } = await params;

  // `getMatchForResult` scopes by `tournamentId`; a non-null result means the
  // tournament exists (FK), so a separate tournament read would be dead weight.
  const match = await getMatchForResult(id, matchId);
  if (!match) notFound();

  const homeTeam = match.homeEntry?.team.name ?? "—";
  const awayTeam = match.awayEntry?.team.name ?? "—";
  const hasResult = match.sets.length > 0;

  const meta = [
    STAGE_LABELS[match.stage] ?? null,
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
          <MatchResultPanel
            tournamentId={id}
            matchId={matchId}
            preset={match.tournament.scoringPreset}
            tournamentType={match.tournament.type}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            sets={match.sets}
          />
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
