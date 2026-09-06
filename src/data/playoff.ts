import { db } from "@/data/client";
import { allGroupMatchesPlayed } from "@/data/matches";
import { setTournamentState } from "@/data/tournaments";
import type { MatchSlot } from "@/generated/prisma/enums";

export interface PlayoffSemifinalRow {
  slot: MatchSlot;
  homeEntryId: string;
  awayEntryId: string;
}

/**
 * Creates the two semifinal `Match` rows from a seeded bracket and moves the
 * tournament to `PLAYOFF` — all in one transaction, so a partial failure can
 * never leave `SEMIFINAL` rows on a tournament that's still `GROUP_STAGE` (or
 * the reverse). Performs no validation itself: the caller (`formPlayoff`)
 * must already have confirmed the transition via `checkTransition`. Two
 * re-checks run inside the transaction, closing the window between the
 * action's checks and this write: `allGroupMatchesPlayed` (a group result
 * could have been deleted) and "no semifinal exists yet" (a concurrent
 * second formation could have landed). `groupId` is null: the
 * `match_group_stage_check` CHECK requires it for any non-`GROUP` stage.
 */
export function savePlayoffFormation(
  tournamentId: string,
  semifinals: PlayoffSemifinalRow[],
): Promise<void> {
  return db.$transaction(async (tx) => {
    if (!(await allGroupMatchesPlayed(tournamentId, tx))) {
      throw new Error(
        "savePlayoffFormation: a group match lost its result after the precondition check — aborting",
      );
    }
    const existingSemifinals = await tx.match.count({
      where: { tournamentId, stage: "SEMIFINAL" },
    });
    if (existingSemifinals > 0) {
      throw new Error("savePlayoffFormation: the playoff is already formed — aborting");
    }
    await tx.match.createMany({
      data: semifinals.map((semifinal) => ({
        tournamentId,
        stage: "SEMIFINAL" as const,
        slot: semifinal.slot,
        groupId: null,
        homeEntryId: semifinal.homeEntryId,
        awayEntryId: semifinal.awayEntryId,
      })),
    });
    await setTournamentState(tournamentId, "PLAYOFF", tx);
  });
}
