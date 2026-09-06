import { db } from "@/data/client";
import { allGroupMatchesPlayed } from "@/data/matches";
import { setTournamentState } from "@/data/tournaments";
import { Prisma } from "@/generated/prisma/client";
import {
  advanceBracket,
  type BracketPair,
  type BracketSlot,
  type PlayoffBracket,
  type PlayoffMatchState,
} from "@/domain/bracket";
import { matchScoreLabel, type SetScore } from "@/domain/scoring";

export type PlayoffFormationResult =
  | { ok: true }
  | { ok: false; reason: "already_formed" | "group_incomplete" };

/** The playoff `Match` stages, in bracket order. */
const PLAYOFF_STAGES = ["SEMIFINAL", "THIRD_PLACE", "FINAL"] as const;

/** The two downstream slots this story fills — with their identical stage/slot spelling. */
const DOWNSTREAM_SLOTS = ["THIRD_PLACE", "FINAL"] as const;

interface PlayoffMatchRow {
  id: string;
  slot: BracketSlot | null;
  homeEntryId: string | null;
  awayEntryId: string | null;
  scheduledAt: Date | null;
  venueText: string | null;
  homeEntry: { team: { name: string } } | null;
  awayEntry: { team: { name: string } } | null;
  sets: SetScore[];
}

/** One bracket pair, decorated with what an admin/public list needs (Story 4.3/4.6). */
export interface PlayoffBracketPairView {
  slot: BracketPair["slot"];
  stage: BracketPair["stage"];
  status: BracketPair["status"];
  matchId: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  score: string | null;
  scheduledAt: Date | null;
  venueText: string | null;
}

export interface PlayoffBracketView {
  semifinals: [PlayoffBracketPairView, PlayoffBracketPairView];
  thirdPlace: PlayoffBracketPairView;
  final: PlayoffBracketPairView;
}

function toMatchState(row: PlayoffMatchRow): PlayoffMatchState {
  return {
    slot: row.slot!,
    home: row.homeEntryId ? { entryId: row.homeEntryId, seed: null } : null,
    away: row.awayEntryId ? { entryId: row.awayEntryId, seed: null } : null,
    sets: row.sets,
  };
}

function readPlayoffRows(
  client: Prisma.TransactionClient | typeof db,
  tournamentId: string,
): Promise<PlayoffMatchRow[]> {
  return client.match.findMany({
    where: { tournamentId, stage: { in: [...PLAYOFF_STAGES] } },
    select: {
      id: true,
      slot: true,
      homeEntryId: true,
      awayEntryId: true,
      scheduledAt: true,
      venueText: true,
      homeEntry: { select: { team: { select: { name: true } } } },
      awayEntry: { select: { team: { select: { name: true } } } },
      sets: { select: { setNo: true, homePoints: true, awayPoints: true }, orderBy: { setNo: "asc" } },
    },
  });
}

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

/**
 * The current playoff bracket, resolved through `advanceBracket` (AD-5: the
 * sole participant-deriver, run on every read). Reads the up-to-four playoff
 * `Match` rows, hands them to the engine, and decorates each pair with the
 * `Match` id (null until the row exists), the team names, the score summary,
 * and the schedule. The shared read for this story's admin schedule section
 * and Story 4.6's public bracket — no admin-only fields.
 */
export async function getPlayoffBracket(tournamentId: string): Promise<PlayoffBracketView> {
  const rows = await readPlayoffRows(db, tournamentId);
  const bracket = advanceBracket(rows.map(toMatchState));

  const bySlot = new Map(rows.map((row) => [row.slot, row]));
  const teamNames = new Map<string, string>();
  for (const row of rows) {
    if (row.homeEntryId && row.homeEntry) teamNames.set(row.homeEntryId, row.homeEntry.team.name);
    if (row.awayEntryId && row.awayEntry) teamNames.set(row.awayEntryId, row.awayEntry.team.name);
  }

  const decorate = (pair: BracketPair): PlayoffBracketPairView => {
    const row = bySlot.get(pair.slot) ?? null;
    return {
      slot: pair.slot,
      stage: pair.stage,
      status: pair.status,
      matchId: row?.id ?? null,
      homeTeam: pair.home ? (teamNames.get(pair.home.entryId) ?? "—") : null,
      awayTeam: pair.away ? (teamNames.get(pair.away.entryId) ?? "—") : null,
      score: row ? matchScoreLabel(row.sets) : null,
      scheduledAt: row?.scheduledAt ?? null,
      venueText: row?.venueText ?? null,
    };
  };

  return {
    semifinals: [decorate(bracket.semifinals[0]), decorate(bracket.semifinals[1])],
    thirdPlace: decorate(bracket.thirdPlace),
    final: decorate(bracket.final),
  };
}

/**
 * Re-derives the final and third-place pairings after a semifinal-result
 * change and persists them onto their `Match` rows — the AD-5 "on write" call
 * (`advanceBracket` is the only place this is computed). One transaction with
 * `SELECT … FOR UPDATE` on the tournament row (serialises concurrent
 * advancement). For each downstream slot:
 *
 * - `PLAYED` — the pair has its own `SetScore` and is frozen; left untouched.
 * - `READY` — both semifinal results are in; the row is created if missing, or
 *   its two participant columns updated if they changed.
 * - `AWAITING` — a semifinal result is now missing/level; an existing row's
 *   participants are cleared to null (the row is kept — it may carry a
 *   schedule).
 *
 * Never touches a `SEMIFINAL` row. Idempotent — a no-op when nothing changed.
 */
export function savePlayoffAdvancement(tournamentId: string): Promise<void> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "tournament" WHERE id = ${tournamentId} FOR UPDATE`;

    const rows = await readPlayoffRows(tx, tournamentId);
    const bracket = advanceBracket(rows.map(toMatchState));
    const bySlot = new Map(rows.map((row) => [row.slot, row]));

    for (const slot of DOWNSTREAM_SLOTS) {
      const pair = slot === "FINAL" ? bracket.final : bracket.thirdPlace;
      const existing = bySlot.get(slot) ?? null;

      if (pair.status === "PLAYED") continue;

      if (pair.status === "READY" && pair.home && pair.away) {
        const homeEntryId = pair.home.entryId;
        const awayEntryId = pair.away.entryId;
        if (!existing) {
          await tx.match.create({
            data: { tournamentId, stage: slot, slot, groupId: null, homeEntryId, awayEntryId },
          });
        } else if (existing.homeEntryId !== homeEntryId || existing.awayEntryId !== awayEntryId) {
          await tx.match.update({
            where: { id: existing.id },
            data: { homeEntryId, awayEntryId },
          });
        }
        continue;
      }

      // AWAITING — clear a stale pairing left from an earlier, now-undone result.
      if (existing && (existing.homeEntryId !== null || existing.awayEntryId !== null)) {
        await tx.match.update({
          where: { id: existing.id },
          data: { homeEntryId: null, awayEntryId: null },
        });
      }
    }
  });
}
