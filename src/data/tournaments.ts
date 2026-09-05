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

/** Admin read of every tournament (drafts included), for the `/admin/tournaments` list. */
export function listTournamentsForAdmin() {
  return db.tournament.findMany({
    orderBy: [{ year: "desc" }, { name: "asc" }],
    select: { id: true, name: true, type: true, year: true, state: true, discipline: true },
  });
}

/**
 * The sole public (role-blind) single-tournament read — AD-7. Filters
 * `state != DRAFT` and `discipline = CLASSIC` unconditionally; never accepts
 * a role or session to relax that. Callers that need a draft-preview
 * exception (e.g. an admin viewing their own draft's public page) fall back
 * to `getTournamentForAdmin` themselves after this returns `null` — that
 * decision belongs to the view layer, not here.
 */
export function getPublicTournament(id: string) {
  return db.tournament.findFirst({
    where: { id, state: { not: "DRAFT" }, discipline: "CLASSIC" },
  });
}

/** The public `/classic` listing — same filter as `getPublicTournament`, every match. */
export function listPublicTournaments() {
  return db.tournament.findMany({
    where: { state: { not: "DRAFT" }, discipline: "CLASSIC" },
    orderBy: [{ year: "desc" }, { name: "asc" }],
    select: { id: true, name: true, type: true, year: true, state: true },
  });
}

/**
 * The second (and, alongside `createTournamentRecord`, only) writer of
 * `Tournament`. Never writes `discipline` (fixed at creation, AD-9) or `state`
 * (AD-8 — `setTournamentState` stays the sole writer of that column).
 */
export function updateTournamentRecord(id: string, input: NewTournamentInput) {
  return db.tournament.update({
    where: { id },
    data: {
      type: input.type,
      name: input.name,
      year: input.year,
      scoringPreset: input.scoringPreset,
      teamCount: input.teamCount,
      rounds: input.rounds,
    },
    select: { id: true },
  });
}

/**
 * Deletes a `Tournament`. Cascades (schema-level `onDelete: Cascade`) remove
 * its `Group`, `TournamentEntry` rows, and their `Player` rosters in the same
 * statement.
 */
export function deleteTournamentRecord(id: string) {
  return db.tournament.delete({ where: { id } });
}

/** The Postgres index backing `Tournament`'s `@@unique([discipline, type, year, name])`. */
export const TOURNAMENT_NATURAL_KEY_INDEX = "tournament_discipline_type_year_name_key";
