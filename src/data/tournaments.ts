import type { TournamentState } from "@/generated/prisma/enums";

import { db } from "@/data/client";

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
