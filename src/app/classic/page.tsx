import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { SectionShell } from "@/components/section-shell";
import { StatusBadge } from "@/components/status-badge";
import { listPublicTournaments } from "@/data/tournaments";
import { NO_TOURNAMENTS } from "@/lib/empty-states";
import { CLASSIC } from "@/lib/sections";
import { TOURNAMENT_TYPE_LABELS } from "@/lib/tournament-labels";

export const metadata: Metadata = { title: CLASSIC.label };

export default async function ClassicPage() {
  const tournaments = await listPublicTournaments();

  return (
    <SectionShell title={CLASSIC.label}>
      {tournaments.length === 0 ? (
        <EmptyState {...NO_TOURNAMENTS} />
      ) : (
        <ul className="divide-y">
          {tournaments.map((tournament) => (
            <li key={tournament.id} className="flex items-center justify-between gap-3 py-3">
              <Link
                href={`/classic/${tournament.id}`}
                className="text-sm underline underline-offset-4"
              >
                {tournament.name} · {TOURNAMENT_TYPE_LABELS[tournament.type]} · {tournament.year}
              </Link>
              <StatusBadge state={tournament.state} />
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}
