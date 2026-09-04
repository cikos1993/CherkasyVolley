import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteTournamentButton } from "@/components/tournament-actions";
import { TournamentForm } from "@/components/tournament-form";
import { getTournamentForAdmin } from "@/data/tournaments";
import { LABELS as STATE_LABELS } from "@/domain/tournamentState";
import type { TournamentField } from "@/domain/tournamentForm";

// A static title, not `generateMetadata` reading the tournament: Next resolves
// metadata in a pass separate from the tree the `/admin` layout's auth redirect
// runs in, so a per-tournament title here would read admin-only data — and leak
// a draft tournament's name in <title> — ahead of that gate.
export const metadata = { title: "Турнір" };

const LOCKED_OUTSIDE_DRAFT: readonly TournamentField[] = ["teamCount", "rounds"];

export default async function AdminTournamentPage({
  params,
}: PageProps<"/admin/tournaments/[id]">) {
  const { id } = await params;
  const tournament = await getTournamentForAdmin(id);
  if (!tournament) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        href="/admin/tournaments"
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        <span aria-hidden>←</span> Турніри
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{tournament.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Стан: {STATE_LABELS[tournament.state]}
      </p>

      <div className="mt-6">
        <TournamentForm
          key={tournament.updatedAt.getTime()}
          mode="edit"
          tournamentId={tournament.id}
          initial={{
            discipline: tournament.discipline,
            type: tournament.type,
            name: tournament.name,
            year: String(tournament.year),
            scoringPreset: tournament.scoringPreset,
            teamCount: String(tournament.teamCount),
            rounds: String(tournament.rounds),
          }}
          locked={tournament.state === "DRAFT" ? [] : LOCKED_OUTSIDE_DRAFT}
        />
      </div>

      <div className="mt-10 border-t pt-6">
        <DeleteTournamentButton tournamentId={tournament.id} />
      </div>
    </main>
  );
}
