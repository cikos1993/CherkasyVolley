import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchScheduleList } from "@/components/match-schedule";
import { PlayoffPlacements, type PlayoffPlacementRow } from "@/components/playoff-placements";
import { PlayoffSchedule, type PlayoffScheduleSlot } from "@/components/playoff-schedule";
import { listGroupMatchesForTournament } from "@/data/matches";
import { getPlayoffBracket, type PlayoffBracketPairView } from "@/data/playoff";
import { getTournamentForAdmin } from "@/data/tournaments";
import { formatKyivDateTime, toKyivDateTimeLocalValue } from "@/domain/matchSchedule";
import { matchScoreLabel } from "@/domain/scoring";
import { GROUP_NOT_DRAWN } from "@/lib/empty-states";

export const metadata = { title: "Розклад" };

export default async function AdminTournamentSchedulePage({
  params,
}: PageProps<"/admin/tournaments/[id]/schedule">) {
  const { id } = await params;
  const tournament = await getTournamentForAdmin(id);
  if (!tournament) notFound();

  const backLink = (
    <Link
      href={`/admin/tournaments/${id}`}
      className="text-sm text-muted-foreground underline underline-offset-4"
    >
      <span aria-hidden>←</span> {tournament.name}
    </Link>
  );

  if (tournament.state === "DRAFT") {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        {backLink}
        <h1 className="mt-3 text-2xl font-bold">Розклад</h1>
        <p className="mt-4 text-sm text-muted-foreground">{GROUP_NOT_DRAWN.description}</p>
      </main>
    );
  }

  const matches = (await listGroupMatchesForTournament(id)).map((match) => ({
    id: match.id,
    updatedAt: match.updatedAt.getTime(),
    homeTeam: match.homeEntry?.team.name ?? "—",
    awayTeam: match.awayEntry?.team.name ?? "—",
    scheduledAtLocal: match.scheduledAt ? toKyivDateTimeLocalValue(match.scheduledAt) : "",
    scheduledAtDisplay: match.scheduledAt ? formatKyivDateTime(match.scheduledAt) : null,
    venueText: match.venueText ?? "",
    resultSummary: matchScoreLabel(match.sets),
  }));

  const inPlayoff = tournament.state === "PLAYOFF" || tournament.state === "COMPLETED";
  const bracket = inPlayoff ? await getPlayoffBracket(id) : null;

  const toSlot = (
    key: string,
    label: string,
    pair: PlayoffBracketPairView,
  ): PlayoffScheduleSlot => ({
    key,
    label,
    matchId: pair.matchId,
    homeTeam: pair.homeTeam,
    awayTeam: pair.awayTeam,
    score: pair.score,
  });

  const playoffSlots: PlayoffScheduleSlot[] = bracket
    ? [
        toSlot("SF1", "Півфінал 1", bracket.semifinals[0]),
        toSlot("SF2", "Півфінал 2", bracket.semifinals[1]),
        toSlot("THIRD_PLACE", "Матч за 3-тє місце", bracket.thirdPlace),
        toSlot("FINAL", "Фінал", bracket.final),
      ]
    : [];

  const placementRows: PlayoffPlacementRow[] = bracket
    ? [
        { label: "1-е місце", teamName: bracket.placements.first?.teamName ?? null },
        { label: "2-е місце", teamName: bracket.placements.second?.teamName ?? null },
        { label: "3-є місце", teamName: bracket.placements.third?.teamName ?? null },
        { label: "4-е місце", teamName: bracket.placements.fourth?.teamName ?? null },
      ]
    : [];
  const hasPlacements = placementRows.some((row) => row.teamName !== null);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      {backLink}
      <h1 className="mt-3 text-2xl font-bold">Розклад</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Дата, час і місце проведення матчів групового етапу. Час — київський.
      </p>
      <div className="mt-6">
        <MatchScheduleList tournamentId={id} matches={matches} />
      </div>

      {inPlayoff ? (
        <section className="mt-10 border-t pt-6">
          <h2 className="text-lg font-semibold">Плейоф</h2>
          <div className="mt-4">
            <PlayoffSchedule tournamentId={id} slots={playoffSlots} />
          </div>
          {hasPlacements ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-muted-foreground">Місця</h3>
              <div className="mt-2">
                <PlayoffPlacements rows={placementRows} />
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
