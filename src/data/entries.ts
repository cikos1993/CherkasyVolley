import { db } from "@/data/client";

/**
 * A single entry, scoped by `(tournamentId, entryId)` together — never look
 * up an entry by `entryId` alone (see `deleteEntry`'s own note; the Story 2.7
 * code review found exactly that shape leaking a cross-tournament bug).
 * Returns `null` when the ids don't pair up, so callers get one gate for both
 * "doesn't exist" and "belongs to a different tournament".
 */
export function getEntryForAdmin(tournamentId: string, entryId: string) {
  return db.tournamentEntry.findFirst({
    where: { id: entryId, tournamentId },
    select: { id: true, teamId: true, team: { select: { id: true, name: true } } },
  });
}

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

/**
 * Looks up an entry by `(tournamentId, teamId)` together — the same
 * "never look up by the child id alone" discipline `getEntryForAdmin`
 * follows, keyed by `teamId` instead of `entryId` since that's what the
 * public roster route (`/classic/[tournament]/teams/[team]`) carries.
 * Deliberately does **not** filter tournament state or discipline — that
 * visibility decision belongs to the caller (see `getPublicTournament`),
 * which resolves whether the tournament is visible before ever calling this.
 */
export function getEntryByTeam(tournamentId: string, teamId: string) {
  return db.tournamentEntry.findFirst({
    where: { tournamentId, teamId },
    select: { id: true, team: { select: { id: true, name: true } } },
  });
}

/** The Postgres index backing `TournamentEntry`'s `@@unique([tournamentId, teamId])`. */
export const TOURNAMENT_ENTRY_NATURAL_KEY_INDEX = "tournament_entry_tournamentId_teamId_key";
