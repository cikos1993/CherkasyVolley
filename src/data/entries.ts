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
 * The only canceler of a `TournamentEntry`. Scoped by `tournamentId` **and**
 * `entryId` — `deleteMany` (not `delete`, which only accepts a unique where)
 * so a mismatched pair (an `entryId` from a different tournament) deletes
 * nothing instead of deleting the wrong tournament's entry. Returns
 * `{ count: 0 }` when no row matched (already gone, or the ids don't pair up)
 * — the caller maps that to a "not found" result. Cascades away the `Player`
 * roster (schema-level `onDelete: Cascade`, Story 2.1) when it does match.
 */
export function deleteEntry(tournamentId: string, entryId: string) {
  return db.tournamentEntry.deleteMany({ where: { id: entryId, tournamentId } });
}

/** The Postgres index backing `TournamentEntry`'s `@@unique([tournamentId, teamId])`. */
export const TOURNAMENT_ENTRY_NATURAL_KEY_INDEX = "tournament_entry_tournamentId_teamId_key";
