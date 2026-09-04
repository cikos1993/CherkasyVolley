import { Prisma } from "@/generated/prisma/client";
import type { TournamentState } from "@/generated/prisma/enums";

import { db } from "@/data/client";
import type { NewTournamentInput } from "@/domain/tournamentForm";

/**
 * Reads a tournament by id including drafts. Call only from an admin-guarded
 * path — the public list query filters `state != DRAFT` and `discipline = CLASSIC`
 * and lives in its own function.
 */
export function getTournamentForAdmin(id: string) {
  return db.tournament.findUnique({ where: { id } });
}

export function countTournamentEntries(tournamentId: string) {
  return db.tournamentEntry.count({ where: { tournamentId } });
}

/**
 * The only writer of `Tournament.state`. The transition must already have been
 * validated (see `src/domain/tournamentState`) — this function performs no
 * checks. Do not add another function that writes `state`.
 */
export function setTournamentState(id: string, state: TournamentState) {
  return db.tournament.update({ where: { id }, data: { state } });
}

/**
 * The only creator of a `Tournament`. Inserts the tournament and its single
 * `Group` in one statement. `state` is not set — it defaults to `DRAFT`; the
 * only path that changes it afterwards is `transitionTournament`.
 */
export function createTournamentRecord(input: NewTournamentInput): Promise<{ id: string }> {
  return db.tournament.create({
    data: {
      discipline: input.discipline,
      type: input.type,
      name: input.name,
      year: input.year,
      scoringPreset: input.scoringPreset,
      teamCount: input.teamCount,
      rounds: input.rounds,
      group: { create: {} },
    },
    select: { id: true },
  });
}

/** True when a write failed because it would break a unique constraint (Prisma P2002). */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
