import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicRoster } from "@/components/public-roster";
import { getSessionUser } from "@/auth/requireAdmin";
import { getEntryByTeam } from "@/data/entries";
import { listPlayersForEntry } from "@/data/players";
import { getPublicTournament, getTournamentForAdmin } from "@/data/tournaments";

async function resolveTournament(id: string) {
  const tournament = await getPublicTournament(id);
  if (tournament) return tournament;

  const user = await getSessionUser();
  if (!user?.isAdmin) return null;

  return getTournamentForAdmin(id);
}

export async function generateMetadata({
  params,
}: PageProps<"/classic/[tournament]/teams/[team]">) {
  const { tournament: tournamentId, team: teamId } = await params;
  const entry = await getEntryByTeam(tournamentId, teamId);
  return { title: entry?.team.name ?? "Склад команди" };
}

export default async function PublicTeamRosterPage({
  params,
}: PageProps<"/classic/[tournament]/teams/[team]">) {
  const { tournament: tournamentId, team: teamId } = await params;

  const tournament = await resolveTournament(tournamentId);
  if (!tournament) notFound();

  const entry = await getEntryByTeam(tournamentId, teamId);
  if (!entry) notFound();

  const players = await listPlayersForEntry(entry.id);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        href={`/classic/${tournamentId}`}
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        <span aria-hidden>←</span> {tournament.name}
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{entry.team.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Склад команди</p>

      <div className="mt-6">
        <PublicRoster players={players} />
      </div>
    </main>
  );
}
