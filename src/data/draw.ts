import { db } from "@/data/client";
import { setTournamentState } from "@/data/tournaments";

export interface DrawPairing {
  homeEntryId: string;
  awayEntryId: string;
}

/**
 * Seats every entered team into the tournament's `Group` and creates its
 * `GROUP`-stage match calendar, then moves the tournament to `GROUP_STAGE` —
 * all in one transaction, so a partial failure can never leave `GroupSlot`/
 * `Match` rows on a tournament that's still `DRAFT` (or the reverse). Performs
 * no validation itself: the caller (`drawTournament`) must already have
 * confirmed the transition via `checkTransition` before calling this. Never
 * called again for a tournament that already has `GroupSlot` rows — a
 * redraw (Story 3.4) replaces `Match` rows through its own function.
 */
export function saveDraw(
  tournamentId: string,
  groupId: string,
  entryIds: string[],
  pairings: DrawPairing[],
): Promise<void> {
  return db.$transaction(async (tx) => {
    await tx.groupSlot.createMany({
      data: entryIds.map((entryId) => ({ groupId, entryId })),
    });
    await tx.match.createMany({
      data: pairings.map((pairing) => ({
        tournamentId,
        groupId,
        stage: "GROUP",
        homeEntryId: pairing.homeEntryId,
        awayEntryId: pairing.awayEntryId,
      })),
    });
    await setTournamentState(tournamentId, "GROUP_STAGE", tx);
  });
}

/**
 * Entry ids actually seated in a group (Story 3.4) — the source of truth for
 * "who's in this group," distinct from `TournamentEntry`/`listEntriesForTournament`,
 * which `saveDraw` reads before any `GroupSlot` exists. A redraw must reuse
 * these ids, not re-read entries, since group membership never changes here.
 */
export async function listGroupEntryIds(groupId: string): Promise<string[]> {
  const slots = await db.groupSlot.findMany({ where: { groupId }, select: { entryId: true } });
  return slots.map((slot) => slot.entryId);
}

/**
 * Deletes every `GROUP`-stage `Match` row for a tournament and recreates the
 * calendar from a fresh set of pairings, in one transaction. Never touches
 * `GroupSlot` or `Tournament.state` — a redraw only replaces the calendar,
 * not who's in the group or the tournament's lifecycle stage. Performs no
 * validation itself: the caller (`redrawTournament`) must already have
 * confirmed `checkCanRedraw` before calling this.
 */
export function saveRedraw(
  tournamentId: string,
  groupId: string,
  pairings: DrawPairing[],
): Promise<void> {
  return db.$transaction(async (tx) => {
    await tx.match.deleteMany({ where: { tournamentId, stage: "GROUP" } });
    await tx.match.createMany({
      data: pairings.map((pairing) => ({
        tournamentId,
        groupId,
        stage: "GROUP",
        homeEntryId: pairing.homeEntryId,
        awayEntryId: pairing.awayEntryId,
      })),
    });
  });
}
