import Link from "next/link";

import { listTournamentsForAdmin } from "@/data/tournaments";
import { LABELS as STATE_LABELS } from "@/domain/tournamentState";
import { TOURNAMENT_TYPE_LABELS } from "@/lib/tournament-labels";

export const metadata = { title: "Турніри" };

export default async function AdminTournamentsPage() {
  const tournaments = await listTournamentsForAdmin();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        <span aria-hidden>←</span> Адмін-зона
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Турніри</h1>
      <Link
        href="/admin/tournaments/new"
        className="mt-2 inline-block text-sm underline underline-offset-4"
      >
        Створити турнір
      </Link>

      {tournaments.length === 0 ? (
        <p className="mt-6 text-muted-foreground">Ще немає турнірів.</p>
      ) : (
        <ul className="mt-6 divide-y">
          {tournaments.map((t) => (
            <li key={t.id} className="py-3">
              <Link
                href={`/admin/tournaments/${t.id}`}
                className="flex items-center justify-between gap-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm">{t.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {TOURNAMENT_TYPE_LABELS[t.type]} · <span className="tabular-nums">{t.year}</span> ·{" "}
                  {STATE_LABELS[t.state]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
