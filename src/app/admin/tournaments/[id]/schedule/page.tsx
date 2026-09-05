import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchScheduleList } from "@/components/match-schedule";
import { listGroupMatchesForTournament } from "@/data/matches";
import { getTournamentForAdmin } from "@/data/tournaments";
import { formatKyivDateTime, toKyivDateTimeLocalValue } from "@/domain/matchSchedule";
import { GROUP_NOT_DRAWN } from "@/lib/empty-states";

export const metadata = { title: "Розклад" };

function setSummary(sets: { homePoints: number; awayPoints: number }[]): string | null {
  if (sets.length === 0) return null;
  let home = 0;
  let away = 0;
  for (const set of sets) {
    if (set.homePoints > set.awayPoints) home += 1;
    else if (set.awayPoints > set.homePoints) away += 1;
  }
  return `${home}:${away}`;
}

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
    resultSummary: setSummary(match.sets),
  }));

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
    </main>
  );
}
