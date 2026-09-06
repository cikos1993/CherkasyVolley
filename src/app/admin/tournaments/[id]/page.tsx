import Link from "next/link";
import { notFound } from "next/navigation";

import {
  DeleteTournamentButton,
  DrawTournamentButton,
  FinishTournamentButton,
  FormPlayoffButton,
  RedrawTournamentButton,
} from "@/components/tournament-actions";
import { CompletedBanner } from "@/components/completed-banner";
import { TeamEnrollment } from "@/components/team-enrollment";
import { TournamentForm } from "@/components/tournament-form";
import { listEntriesForTournament } from "@/data/entries";
import { allGroupMatchesPlayed, finalAndThirdPlacePlayed, hasAnyGroupResult } from "@/data/matches";
import { listTeams } from "@/data/teams";
import { getTournamentForAdmin } from "@/data/tournaments";
import { LABELS as STATE_LABELS } from "@/domain/tournamentState";
import type { TournamentField } from "@/domain/tournamentForm";

// A static title, not `generateMetadata` reading the tournament: Next resolves
// metadata in a pass separate from the tree the `/admin` layout's auth redirect
// runs in, so a per-tournament title here would read admin-only data — and leak
// a draft tournament's name in <title> — ahead of that gate.
export const metadata = { title: "Турнір" };

const LOCKED_OUTSIDE_DRAFT: readonly TournamentField[] = ["teamCount", "rounds"];
const LOCKED_WHEN_COMPLETED: readonly TournamentField[] = [
  "type",
  "name",
  "year",
  "scoringPreset",
  "teamCount",
  "rounds",
];

export default async function AdminTournamentPage({
  params,
}: PageProps<"/admin/tournaments/[id]">) {
  const { id } = await params;
  const [tournament, teams, entries, hasResults, groupStageComplete, playoffComplete] =
    await Promise.all([
      getTournamentForAdmin(id),
      listTeams(),
      listEntriesForTournament(id),
      hasAnyGroupResult(id),
      allGroupMatchesPlayed(id),
      finalAndThirdPlacePlayed(id),
    ]);
  if (!tournament) notFound();

  const isCompleted = tournament.state === "COMPLETED";

  const enrolledTeamIds = new Set(entries.map((entry) => entry.teamId));
  const availableTeams = teams.filter((team) => !enrolledTeamIds.has(team.id));

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

      {isCompleted ? <CompletedBanner className="mt-4" /> : null}

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
          locked={
            isCompleted
              ? LOCKED_WHEN_COMPLETED
              : tournament.state === "DRAFT"
                ? []
                : LOCKED_OUTSIDE_DRAFT
          }
          lockedHint={isCompleted ? "Турнір завершено — дані зафіксовано." : undefined}
        />
      </div>

      <section className="mt-10 border-t pt-6">
        <h2 className="text-lg font-semibold">Команди</h2>
        <div className="mt-4">
          <TeamEnrollment
            tournamentId={tournament.id}
            state={tournament.state}
            teamCount={tournament.teamCount}
            entries={entries}
            availableTeams={availableTeams}
          />
        </div>
      </section>

      {tournament.state === "DRAFT" ? (
        <section className="mt-10 border-t pt-6">
          <h2 className="text-lg font-semibold">Жеребкування</h2>
          <div className="mt-4">
            <DrawTournamentButton
              tournamentId={tournament.id}
              state={tournament.state}
              entryCount={entries.length}
              teamCount={tournament.teamCount}
            />
          </div>
        </section>
      ) : null}

      {tournament.state === "GROUP_STAGE" ? (
        <section className="mt-10 border-t pt-6">
          <h2 className="text-lg font-semibold">Жеребкування</h2>
          <div className="mt-4">
            <RedrawTournamentButton
              tournamentId={tournament.id}
              state={tournament.state}
              hasResults={hasResults}
            />
          </div>
        </section>
      ) : null}

      {tournament.state === "GROUP_STAGE" ? (
        <section className="mt-10 border-t pt-6">
          <h2 className="text-lg font-semibold">Плейоф</h2>
          <div className="mt-4">
            <FormPlayoffButton
              tournamentId={tournament.id}
              state={tournament.state}
              allGroupMatchesPlayed={groupStageComplete}
            />
          </div>
        </section>
      ) : null}

      {tournament.state !== "DRAFT" ? (
        <section className="mt-10 border-t pt-6">
          <h2 className="text-lg font-semibold">Розклад</h2>
          <div className="mt-4">
            <Link
              href={`/admin/tournaments/${tournament.id}/schedule`}
              className="text-sm underline underline-offset-4"
            >
              Керувати розкладом матчів
            </Link>
          </div>
        </section>
      ) : null}

      {tournament.state === "PLAYOFF" ? (
        <section className="mt-10 border-t pt-6">
          <h2 className="text-lg font-semibold">Завершення</h2>
          <div className="mt-4">
            <FinishTournamentButton
              tournamentId={tournament.id}
              state={tournament.state}
              finalAndThirdPlacePlayed={playoffComplete}
            />
          </div>
        </section>
      ) : null}

      <div className="mt-10 border-t pt-6">
        <DeleteTournamentButton tournamentId={tournament.id} />
      </div>
    </main>
  );
}
