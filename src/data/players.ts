import { db } from "@/data/client";
import type { PlayerInput } from "@/domain/playerForm";

/** Every player on one entry's roster, ordered by name. */
export function listPlayersForEntry(entryId: string) {
  return db.player.findMany({ where: { entryId }, orderBy: { fullName: "asc" } });
}

/** The only creator of a `Player`. */
export function createPlayer(entryId: string, input: PlayerInput): Promise<{ id: string }> {
  return db.player.create({ data: { entryId, ...input }, select: { id: true } });
}

/**
 * The only updater of a `Player`. Scoped by `(entryId, playerId)` together
 * (`updateMany`, not `update`, which only accepts a unique where) — the same
 * cross-tournament scoping discipline `deleteEntry` established in Story 2.7,
 * applied here so a mismatched `entryId` updates nothing instead of editing a
 * player belonging to a different entry.
 */
export function updatePlayer(entryId: string, playerId: string, input: PlayerInput) {
  return db.player.updateMany({ where: { id: playerId, entryId }, data: input });
}

/** The only deleter of a `Player`. Same `(entryId, playerId)` scoping as `updatePlayer`. */
export function deletePlayer(entryId: string, playerId: string) {
  return db.player.deleteMany({ where: { id: playerId, entryId } });
}
