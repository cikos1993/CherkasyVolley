import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { listEntriesForTournament } from "@/data/entries";
import { NO_TEAMS } from "@/lib/empty-states";
import { resolveTournament } from "../_lib/resolve-tournament";

const STUB_TABS = ["Розклад", "Таблиця", "Плейоф"];

export async function generateMetadata({ params }: PageProps<"/classic/[tournament]">) {
  const { tournament: id } = await params;
  const tournament = await resolveTournament(id);
  return { title: tournament?.name ?? "Турнір" };
}

export default async function PublicTournamentPage({
  params,
}: PageProps<"/classic/[tournament]">) {
  const { tournament: id } = await params;
  const tournament = await resolveTournament(id);
  if (!tournament) notFound();

  const entries = await listEntriesForTournament(id);

  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 py-8">
      <Link href="/classic" className="text-sm text-muted-foreground underline underline-offset-4">
        <span aria-hidden>←</span> Класичний
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <h1 className="text-2xl font-bold">{tournament.name}</h1>
        <StatusBadge state={tournament.state} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <span className="rounded-full border border-foreground px-3 py-1 text-sm text-foreground">
          Команди
        </span>
        {STUB_TABS.map((label) => (
          <span
            key={label}
            aria-disabled="true"
            className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground"
          >
            {label}
          </span>
        ))}
      </div>

      <div className="mt-6">
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
    </main>
  );
}
