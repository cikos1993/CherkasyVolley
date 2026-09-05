import Link from "next/link";
import { notFound } from "next/navigation";

import { Roster } from "@/components/roster";
import { getEntryForAdmin } from "@/data/entries";
import { listPlayersForEntry } from "@/data/players";

export const metadata = { title: "Склад команди" };

export default async function AdminEntryRosterPage({
  params,
}: PageProps<"/admin/tournaments/[id]/entries/[entryId]">) {
  const { id, entryId } = await params;
  const entry = await getEntryForAdmin(id, entryId);
  if (!entry) notFound();

  const players = await listPlayersForEntry(entryId);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        href={`/admin/tournaments/${id}`}
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        <span aria-hidden>←</span> Турнір
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{entry.team.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Склад команди</p>

      <div className="mt-6">
        <Roster tournamentId={id} entryId={entryId} players={players} />
      </div>
    </main>
  );
}
