import { db } from "@/data/client";

/**
 * Every entry in a tournament, with its team's id/name joined in. Admin read
 * — the only caller so far is the tournament management page, already
 * gated by `requireAdminPage()`.
 */
export function listEntriesForTournament(tournamentId: string) {
  return db.tournamentEntry.findMany({
    where: { tournamentId },
    orderBy: { team: { name: "asc" } },
    select: { id: true, teamId: true, team: { select: { id: true, name: true } } },
  });
}

/** Moved from `src/data/tournaments.ts` (Story 2.3) — entry-owned, not tournament-owned. */
export function countTournamentEntries(tournamentId: string) {
  return db.tournamentEntry.count({ where: { tournamentId } });
}

/** The only creator of a `TournamentEntry`. */
export function createEntry(tournamentId: string, teamId: string): Promise<{ id: string }> {
  return db.tournamentEntry.create({ data: { tournamentId, teamId }, select: { id: true } });
}

/**
 * The only canceler of a `TournamentEntry`. Cascades away its `Player`
 * roster (schema-level `onDelete: Cascade`, Story 2.1) — no separate
 * cleanup needed.
 */
export function deleteEntry(entryId: string) {
  return db.tournamentEntry.delete({ where: { id: entryId } });
}

/** The Postgres index backing `TournamentEntry`'s `@@unique([tournamentId, teamId])`. */
export const TOURNAMENT_ENTRY_NATURAL_KEY_INDEX = "tournament_entry_tournamentId_teamId_key";
