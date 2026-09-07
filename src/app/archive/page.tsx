import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { SectionShell } from "@/components/section-shell";
import { getPlayoffBracket, placementNames } from "@/data/playoff";
import { listArchivedTournaments } from "@/data/tournaments";
import { ARCHIVE_EMPTY } from "@/lib/empty-states";
import { ARCHIVE } from "@/lib/sections";
import { TOURNAMENT_TYPE_LABELS } from "@/lib/tournament-labels";

export const metadata: Metadata = { title: ARCHIVE.label };

const PLACE_LABELS = ["1", "2", "3", "4"] as const;

export default async function ArchivePage() {
  const tournaments = await listArchivedTournaments();

  if (tournaments.length === 0) {
    return (
      <SectionShell title={ARCHIVE.label}>
        <EmptyState {...ARCHIVE_EMPTY} />
      </SectionShell>
    );
  }

  const placementsById = new Map<string, (string | null)[]>();
  await Promise.all(
    tournaments.map(async (tournament) => {
      const bracket = await getPlayoffBracket(tournament.id);
      placementsById.set(tournament.id, placementNames(bracket.placements));
    }),
  );

  const byYear = new Map<number, typeof tournaments>();
  for (const tournament of tournaments) {
    const list = byYear.get(tournament.year) ?? [];
    list.push(tournament);
    byYear.set(tournament.year, list);
  }

  return (
    <SectionShell title={ARCHIVE.label}>
      <div className="grid gap-8">
        {[...byYear.entries()].map(([year, yearTournaments]) => (
          <section key={year}>
            <h2 className="text-lg font-semibold">{year}</h2>
            <ul className="mt-3 divide-y">
              {yearTournaments.map((tournament) => {
                const places = placementsById.get(tournament.id) ?? [];
                return (
                  <li key={tournament.id} className="grid gap-1 py-3">
                    <Link
                      href={`/archive/${year}/${tournament.id}`}
                      className="text-sm underline underline-offset-4"
                    >
                      {tournament.name} · {TOURNAMENT_TYPE_LABELS[tournament.type]}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {PLACE_LABELS.map((label, index) => `${label}. ${places[index] ?? "—"}`).join(
                        " · ",
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </SectionShell>
  );
}
