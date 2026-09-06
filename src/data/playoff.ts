import { db } from "@/data/client";
import { allGroupMatchesPlayed } from "@/data/matches";
import { setTournamentState } from "@/data/tournaments";
import type { PlayoffBracket } from "@/domain/bracket";

export type PlayoffFormationResult =
  | { ok: true }
  | { ok: false; reason: "already_formed" | "group_incomplete" };

/**
 * Creates the two semifinal `Match` rows from a seeded bracket and moves the
 * tournament to `PLAYOFF` — all in one transaction, so a partial failure can
 * never leave `SEMIFINAL` rows on a tournament that's still `GROUP_STAGE` (or
 * the reverse). A `SELECT … FOR UPDATE` on the tournament row serialises
 * concurrent formations (`saveDraw` gets the same guarantee from `GroupSlot`'s
 * unique index; the playoff has no such index). Two conditions are re-checked
 * inside the transaction and **reported, not thrown** — both are normal races,
 * not invariant violations: the playoff is already formed (a concurrent or
 * double-submitted call landed first), and a group match lost its result
 * after the caller's `checkTransition`. `groupId` is null: the
 * `match_group_stage_check` CHECK requires it for any non-`GROUP` stage.
 */
export function savePlayoffFormation(
  tournamentId: string,
  bracket: PlayoffBracket,
): Promise<PlayoffFormationResult> {
  const rows = bracket.semifinals.map((semifinal) => {
    if (!semifinal.home || !semifinal.away) {
      throw new Error("savePlayoffFormation: a seeded semifinal is missing a participant");
    }
    return {
      tournamentId,
      stage: "SEMIFINAL" as const,
      slot: semifinal.slot === "SF2" ? ("SF2" as const) : ("SF1" as const),
      groupId: null,
      homeEntryId: semifinal.home.entryId,
      awayEntryId: semifinal.away.entryId,
    };
  });

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "tournament" WHERE id = ${tournamentId} FOR UPDATE`;

    if (!(await allGroupMatchesPlayed(tournamentId, tx))) {
      return { ok: false as const, reason: "group_incomplete" as const };
    }
    const existingSemifinals = await tx.match.count({
      where: { tournamentId, stage: "SEMIFINAL" },
    });
    if (existingSemifinals > 0) {
      return { ok: false as const, reason: "already_formed" as const };
    }

    await tx.match.createMany({ data: rows });
    await setTournamentState(tournamentId, "PLAYOFF", tx);
    return { ok: true as const };
  });
}
