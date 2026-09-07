import Link from "next/link";
import { notFound } from "next/navigation";

import { Bracket, type BracketPairVM } from "@/components/bracket";
import { EmptyState } from "@/components/empty-state";
import { PlayoffPlacements } from "@/components/playoff-placements";
import { PublicSchedule } from "@/components/public-schedule";
import { StandingsTable } from "@/components/standings-table";
import { StatusBadge } from "@/components/status-badge";
import { listEntriesForTournament } from "@/data/entries";
import {
  getStandings,
  listGroupMatchesForTournament,
  publicScheduleRows,
  standingsTableRows,
} from "@/data/matches";
import { getPlayoffBracket, placementNames } from "@/data/playoff";
import { getArchivedTournament } from "@/data/tournaments";
import { NO_TEAMS } from "@/lib/empty-states";
import { TOURNAMENT_TYPE_LABELS } from "@/lib/tournament-labels";

async function resolve(year: string, id: string) {
  const tournament = await getArchivedTournament(id);
  if (!tournament || !/^\d+$/.test(year) || tournament.year !== Number(year)) return null;
  return tournament;
}

export async function generateMetadata({
  params,
}: PageProps<"/archive/[year]/[tournament]">) {
  const { year, tournament: id } = await params;
  const tournament = await resolve(year, id);
  return { title: tournament?.name ?? "Архів" };
}

export default async function ArchivedTournamentPage({
  params,
}: PageProps<"/archive/[year]/[tournament]">) {
  const { year, tournament: id } = await params;
  const tournament = await resolve(year, id);
  if (!tournament) notFound();

  const [standings, entries, matchRows, bracket] = await Promise.all([
    getStandings(id),
    listEntriesForTournament(id),
    listGroupMatchesForTournament(id),
    getPlayoffBracket(id),
  ]);

  const bracketPairs: BracketPairVM[] = [
    bracket.semifinals[0],
    bracket.semifinals[1],
    bracket.final,
    bracket.thirdPlace,
  ];

  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 py-8">
      <Link href="/archive" className="text-sm text-muted-foreground underline underline-offset-4">
        <span aria-hidden>←</span> Архів
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <h1 className="text-2xl font-bold">{tournament.name}</h1>
        <StatusBadge state={tournament.state} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {TOURNAMENT_TYPE_LABELS[tournament.type]} · {tournament.year}
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Таблиця</h2>
        <div className="mt-3">
          <StandingsTable
            rows={standingsTableRows(standings)}
            hasResults={standings.some((entry) => entry.row.played > 0)}
            tournamentName={tournament.name}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Розклад</h2>
        <div className="mt-3">
          <PublicSchedule matches={publicScheduleRows(matchRows)} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Команди</h2>
        <div className="mt-3">
          {entries.length === 0 ? (
            <EmptyState {...NO_TEAMS} />
          ) : (
            <ul className="divide-y">
              {entries.map((entry) => (
                <li key={entry.id} className="py-2">
                  <Link
                    href={`/classic/${id}/teams/${entry.teamId}`}
                    className="text-sm underline underline-offset-4"
                  >
                    {entry.team.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Плейоф</h2>
        <div className="mt-3 grid gap-6">
          <Bracket pairs={bracketPairs} />
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground">Місця</h3>
            <div className="mt-2">
              <PlayoffPlacements teamNames={placementNames(bracket.placements)} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
