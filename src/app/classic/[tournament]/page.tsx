import Link from "next/link";
import { notFound } from "next/navigation";

import { Bracket, type BracketPairVM } from "@/components/bracket";
import { CompletedBanner } from "@/components/completed-banner";
import { EmptyState } from "@/components/empty-state";
import { PlayoffPlacements } from "@/components/playoff-placements";
import { PublicSchedule } from "@/components/public-schedule";
import { StandingsTable } from "@/components/standings-table";
import { StatusBadge } from "@/components/status-badge";
import { normalizeTournamentTab, TournamentTabs } from "@/components/tournament-tabs";
import { listEntriesForTournament } from "@/data/entries";
import {
  getStandings,
  listGroupMatchesForTournament,
  publicScheduleRows,
  standingsTableRows,
} from "@/data/matches";
import { getPlayoffBracket, placementNames } from "@/data/playoff";
import { NO_TEAMS } from "@/lib/empty-states";
import { resolveTournament } from "../_lib/resolve-tournament";

export async function generateMetadata({ params }: PageProps<"/classic/[tournament]">) {
  const { tournament: id } = await params;
  const tournament = await resolveTournament(id);
  return { title: tournament?.name ?? "Турнір" };
}

export default async function PublicTournamentPage({
  params,
  searchParams,
}: PageProps<"/classic/[tournament]">) {
  const { tournament: id } = await params;
  const tournament = await resolveTournament(id);
  if (!tournament) notFound();

  const { tab } = await searchParams;
  const showPlayoff = tournament.state === "PLAYOFF" || tournament.state === "COMPLETED";
  // Таблиця is the landing tab once the group stage is under way (EXPERIENCE IA);
  // a DRAFT tournament (admin-preview only) has no standings, so land on Команди.
  const defaultTab = tournament.state === "DRAFT" ? "teams" : "standings";
  let activeTab = normalizeTournamentTab(tab) ?? defaultTab;
  if (activeTab === "playoff" && !showPlayoff) activeTab = defaultTab;

  const entries = activeTab === "teams" ? await listEntriesForTournament(id) : [];
  const standings = activeTab === "standings" ? await getStandings(id) : [];
  const standingsRows = standingsTableRows(standings);
  const standingsHaveResults = standings.some((entry) => entry.row.played > 0);

  const bracket = activeTab === "playoff" ? await getPlayoffBracket(id) : null;
  const bracketPairs: BracketPairVM[] = bracket
    ? [bracket.semifinals[0], bracket.semifinals[1], bracket.final, bracket.thirdPlace]
    : [];
  const placementTeamNames = bracket ? placementNames(bracket.placements) : [];
  const hasPlacements = placementTeamNames.some((name) => name !== null);

  const matches =
    activeTab === "schedule" ? publicScheduleRows(await listGroupMatchesForTournament(id)) : [];

  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 py-8">
      <Link href="/classic" className="text-sm text-muted-foreground underline underline-offset-4">
        <span aria-hidden>←</span> Класичний
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <h1 className="text-2xl font-bold">{tournament.name}</h1>
        <StatusBadge state={tournament.state} />
      </div>

      {tournament.state === "COMPLETED" ? <CompletedBanner className="mt-4" /> : null}

      <TournamentTabs tournamentId={id} active={activeTab} showPlayoff={showPlayoff} />

      <div className="mt-6">
        {activeTab === "standings" ? (
          <StandingsTable
            rows={standingsRows}
            hasResults={standingsHaveResults}
            tournamentName={tournament.name}
          />
        ) : null}

        {activeTab === "teams" ? (
          entries.length === 0 ? (
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
          )
        ) : null}

        {activeTab === "schedule" ? <PublicSchedule matches={matches} /> : null}

        {activeTab === "playoff" ? (
          <div className="grid gap-6">
            <Bracket pairs={bracketPairs} />
            {hasPlacements ? (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground">Місця</h2>
                <div className="mt-2">
                  <PlayoffPlacements teamNames={placementTeamNames} />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
