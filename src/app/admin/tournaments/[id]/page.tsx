import Link from "next/link";
import { notFound } from "next/navigation";

import { getTournamentForAdmin } from "@/data/tournaments";
import { LABELS as STATE_LABELS } from "@/domain/tournamentState";
import { SCORING_PRESET_LABELS, TOURNAMENT_TYPE_LABELS } from "@/lib/tournament-labels";

export async function generateMetadata({ params }: PageProps<"/admin/tournaments/[id]">) {
  const { id } = await params;
  const tournament = await getTournamentForAdmin(id);
  return { title: tournament?.name ?? "Турнір" };
}

export default async function AdminTournamentPage({
  params,
}: PageProps<"/admin/tournaments/[id]">) {
  const { id } = await params;
  const tournament = await getTournamentForAdmin(id);
  if (!tournament) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        <span aria-hidden>←</span> Адмін-зона
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{tournament.name}</h1>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Тип</dt>
        <dd>{TOURNAMENT_TYPE_LABELS[tournament.type]}</dd>
        <dt className="text-muted-foreground">Рік</dt>
        <dd className="tabular-nums">{tournament.year}</dd>
        <dt className="text-muted-foreground">Система очок</dt>
        <dd>{SCORING_PRESET_LABELS[tournament.scoringPreset]}</dd>
        <dt className="text-muted-foreground">Команд</dt>
        <dd className="tabular-nums">{tournament.teamCount}</dd>
        <dt className="text-muted-foreground">Кіл</dt>
        <dd className="tabular-nums">{tournament.rounds}</dd>
        <dt className="text-muted-foreground">Стан</dt>
        <dd>{STATE_LABELS[tournament.state]}</dd>
      </dl>
      <p className="mt-6 text-sm text-muted-foreground">
        Заявка команд і жеребкування — у наступних історіях.
      </p>
    </main>
  );
}
