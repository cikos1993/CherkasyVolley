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

/** Admin read of every tournament (drafts included), for the `/admin/tournaments` list. */
export function listTournamentsForAdmin() {
  return db.tournament.findMany({
    orderBy: [{ year: "desc" }, { name: "asc" }],
    select: { id: true, name: true, type: true, year: true, state: true, discipline: true },
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

/**
 * True when a write failed because it would break a unique constraint (Prisma
 * P2002). Pass `indexName` to narrow to one specific constraint (its Postgres
 * index name, e.g. `"tournament_discipline_type_year_name_key"`) — otherwise a
 * P2002 from an unrelated constraint (e.g. `group_tournamentId_key`) would
 * match too and be misreported under whatever message the caller has for a
 * different one. With the `@prisma/adapter-pg` driver adapter, the index name
 * surfaces at `error.meta.driverAdapterError.cause.constraint.index`, not the
 * classic `error.meta.target` — this checks both shapes.
 */
export function isUniqueViolation(error: unknown, indexName?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  if (!indexName) return true;

  const meta = error.meta as
    | {
        target?: unknown;
        driverAdapterError?: { cause?: { constraint?: { index?: string } } };
      }
    | undefined;
  const target = meta?.target;
  if (Array.isArray(target) && target.includes(indexName)) return true;
  if (typeof target === "string" && target === indexName) return true;
  return meta?.driverAdapterError?.cause?.constraint?.index === indexName;
}

/**
 * True when a write failed because the target row no longer exists (Prisma
 * P2025) — a concurrent delete between the read and the write.
 */
export function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}
