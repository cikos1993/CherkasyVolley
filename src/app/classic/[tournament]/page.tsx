import Link from "next/link";
import { notFound } from "next/navigation";

import { CompletedBanner } from "@/components/completed-banner";
import { EmptyState } from "@/components/empty-state";
import { PublicSchedule } from "@/components/public-schedule";
import { StandingsTable } from "@/components/standings-table";
import { StatusBadge } from "@/components/status-badge";
import { normalizeTournamentTab, TournamentTabs } from "@/components/tournament-tabs";
import { listEntriesForTournament } from "@/data/entries";
import { getStandings, listGroupMatchesForTournament } from "@/data/matches";
import { formatKyivDateTime } from "@/domain/matchSchedule";
import { matchScoreLabel } from "@/domain/scoring";
import { PLAYOFF_QUALIFIERS } from "@/domain/tiebreak";
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
  const standingsRows = standings.map((entry, index) => ({
    entryId: entry.row.entryId,
    position: index + 1,
    teamName: entry.teamName,
    played: entry.row.played,
    wins: entry.row.wins,
    losses: entry.row.losses,
    points: entry.row.points,
    setsWon: entry.row.setsWon,
    setsLost: entry.row.setsLost,
    // Only a distinction when some teams miss the cut — a group of exactly
    // PLAYOFF_QUALIFIERS advances whole, so the marker would be noise.
    qualifies: index < PLAYOFF_QUALIFIERS && standings.length > PLAYOFF_QUALIFIERS,
    needsManualSeed: entry.needsManualSeed,
  }));
  const standingsHaveResults = standings.some((entry) => entry.row.played > 0);
  const matches =
    activeTab === "schedule"
      ? (await listGroupMatchesForTournament(id)).map((match) => ({
          id: match.id,
          homeTeam: match.homeEntry?.team.name ?? "—",
          awayTeam: match.awayEntry?.team.name ?? "—",
          scheduledAtDisplay: match.scheduledAt ? formatKyivDateTime(match.scheduledAt) : null,
          venueText: match.venueText,
          resultSummary: matchScoreLabel(match.sets),
        }))
      : [];

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
          <p className="text-sm text-muted-foreground">
            Сітка плейофа зʼявиться в наступному оновленні.
          </p>
        ) : null}
      </div>
    </main>
  );
}
