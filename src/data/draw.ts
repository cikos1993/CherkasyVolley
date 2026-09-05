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
