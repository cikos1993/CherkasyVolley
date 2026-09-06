import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PublicSchedule } from "@/components/public-schedule";
import { StatusBadge } from "@/components/status-badge";
import { normalizeTournamentTab, TournamentTabs } from "@/components/tournament-tabs";
import { listEntriesForTournament } from "@/data/entries";
import { listGroupMatchesForTournament } from "@/data/matches";
import { formatKyivDateTime } from "@/domain/matchSchedule";
import { matchScoreLabel } from "@/domain/scoring";
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
  // The Таблиця panel is Story 3.8; until then its chip is hidden (like Плейоф
  // below PLAYOFF) and a direct ?tab=standings falls back to Команди.
  const showStandings = false;
  let activeTab = normalizeTournamentTab(tab);
  if (activeTab === "standings" && !showStandings) activeTab = "teams";
  if (activeTab === "playoff" && !showPlayoff) activeTab = "teams";

  const entries = activeTab === "teams" ? await listEntriesForTournament(id) : [];
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

      <TournamentTabs
        tournamentId={id}
        active={activeTab}
        showStandings={showStandings}
        showPlayoff={showPlayoff}
      />

      <div className="mt-6">
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
