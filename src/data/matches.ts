import { db } from "@/data/client";
import { isRecordNotFound, isUniqueViolation } from "@/data/errors";
import { Prisma } from "@/generated/prisma/client";
import type { MatchScheduleInput } from "@/domain/matchSchedule";
import { computeStandings, type MatchResult, type SetScore } from "@/domain/scoring";
import { orderStandings, type OrderedStandingsRow } from "@/domain/tiebreak";

/** An ordered standings row with its team's display name attached (Story 3.8). */
export type StandingsView = OrderedStandingsRow & { teamName: string };

/**
 * The group standings table for a tournament — the sole `src/data → src/domain`
 * **value** call for standings (every prior `data → domain` edge was
 * type-only). Never stored (AD-4): recomputed fresh from `Match` + `SetScore`
 * every call. Entry ids come from `GroupSlot` (who the draw actually seated
 * into the group), not `TournamentEntry` directly — see the story's Notes on
 * AC interpretation. Returns `[]` if the tournament has no `Group` (shouldn't
 * happen — every tournament gets one at creation) or the group has no
 * `GroupSlot` rows yet (the real, expected case: a `DRAFT` tournament before
 * the draw). Each row carries `teamName` for the public «Таблиця» tab.
 */
export async function getStandings(tournamentId: string): Promise<StandingsView[]> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { scoringPreset: true, group: { select: { id: true } } },
  });
  if (!tournament?.group) return [];

  const slots = await db.groupSlot.findMany({
    where: { groupId: tournament.group.id },
    select: { entryId: true, entry: { select: { team: { select: { name: true } } } } },
  });
  if (slots.length === 0) return [];

  const entryIds = slots.map((slot) => slot.entryId);
  const teamNames = Object.fromEntries(
    slots.map((slot) => [slot.entryId, slot.entry.team.name]),
  );

  const matchRows = await db.match.findMany({
    where: { tournamentId, stage: "GROUP" },
    select: {
      homeEntryId: true,
      awayEntryId: true,
      sets: {
        select: { setNo: true, homePoints: true, awayPoints: true },
        orderBy: { setNo: "asc" },
      },
    },
  });

  // GROUP matches always have both entries set at creation (Story 3.3's
  // draw, and enforced by the match_group_entries_required_check CHECK) —
  // the entry filter exists only to satisfy the type system's nullability
  // (Match.homeEntryId/awayEntryId are nullable for Epic 4's playoff rows).
  // The sets.length check is load-bearing: a scheduled-but-unplayed match
  // (the normal state for most of a group stage, between the draw and
  // result entry — Story 3.6/3.7) has zero SetScore rows. computeStandings
  // trusts every MatchResult it's given represents a completed match — an
  // empty sets array would count as a 0:0 result and, per its win/loss tie
  // rule, silently credit the away side a win and match points.
  const matches: MatchResult[] = matchRows
    .filter((match) => match.homeEntryId && match.awayEntryId && match.sets.length > 0)
    .map((match) => ({
      homeEntryId: match.homeEntryId!,
      awayEntryId: match.awayEntryId!,
      sets: match.sets,
    }));

  const rows = computeStandings(entryIds, matches, tournament.scoringPreset);
  return orderStandings(rows, matches, tournament.scoringPreset, teamNames).map((ordered) => ({
    ...ordered,
    teamName: teamNames[ordered.row.entryId] ?? "—",
  }));
}

/**
 * Every `GROUP`-stage match of a tournament with the two team names, the
 * planned time/venue, and any set scores — the shared read for the public
 * «Розклад» tab and the admin schedule page. Ordered chronologically
 * (`scheduledAt` ascending, unscheduled matches last), then `createdAt` for a
 * stable order within each bucket. Visibility-agnostic: the caller resolves
 * whether the tournament is public before calling this (the same split
 * `getEntryByTeam` follows).
 */
export function listGroupMatchesForTournament(tournamentId: string) {
  return db.match.findMany({
    where: { tournamentId, stage: "GROUP" },
    orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    select: {
      id: true,
      scheduledAt: true,
      venueText: true,
      updatedAt: true,
      homeEntry: { select: { team: { select: { name: true } } } },
      awayEntry: { select: { team: { select: { name: true } } } },
      sets: {
        select: { setNo: true, homePoints: true, awayPoints: true },
        orderBy: { setNo: "asc" },
      },
    },
  });
}

/**
 * Sets the planned time and venue of one `GROUP` match. Scoped by
 * `(tournamentId, matchId)` together and `stage: "GROUP"` via `updateMany`
 * (never `update`, which needs a unique where) — a mismatched pair or a
 * playoff match updates nothing and returns `{ count: 0 }`. Writes only the
 * two scheduling columns; `SetScore` rows are a separate table and are never
 * touched here, so an already-recorded result is unaffected.
 */
export function updateMatchSchedule(
  tournamentId: string,
  matchId: string,
  input: MatchScheduleInput,
) {
  return db.match.updateMany({
    where: { id: matchId, tournamentId, stage: "GROUP" },
    data: { scheduledAt: input.scheduledAt, venueText: input.venueText },
  });
}

/**
 * Whether any `GROUP`-stage match of this tournament has a recorded set
 * score yet. The sole read backing `checkCanRedraw`'s (Story 3.4) "no
 * results yet" gate — once true, a redraw must be refused. `client` defaults
 * to the shared `db` instance; `saveRedraw` (`src/data/draw.ts`) passes its
 * transaction client to re-check this inside the same transaction as the
 * delete, closing the TOCTOU window between the action's outer check and
 * the write (review fix, Story 3.4).
 */
export async function hasAnyGroupResult(
  tournamentId: string,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<boolean> {
  const setScore = await client.setScore.findFirst({
    where: { match: { tournamentId, stage: "GROUP" } },
    select: { id: true },
  });
  return setScore !== null;
}

/**
 * Whether every `GROUP`-stage match of this tournament has a recorded result —
 * the precondition for `checkTransition(..., "PLAYOFF", ...)` (FR-19). Distinct
 * from `hasAnyGroupResult`, which answers "is there *any* result". One query
 * (not two `count`s) so the row set is a single snapshot. The empty match list
 * rejects the vacuous "0 of 0" (an undrawn tournament — not reachable at
 * `GROUP_STAGE`, but explicit). "Has a result" means "has a `SetScore` row" —
 * `createMatchResult` writes all sets in one transaction, so a partial set
 * list can't occur. `client` takes a transaction client so
 * `savePlayoffFormation` can re-check inside its own transaction, closing the
 * window between the action's outer check and the write.
 */
export async function allGroupMatchesPlayed(
  tournamentId: string,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<boolean> {
  const matches = await client.match.findMany({
    where: { tournamentId, stage: "GROUP" },
    select: { _count: { select: { sets: true } } },
  });
  return matches.length > 0 && matches.every((match) => match._count.sets > 0);
}

/** The Postgres index backing `SetScore`'s `@@unique([matchId, setNo])`. */
export const SET_SCORE_NATURAL_KEY_INDEX = "set_score_matchId_setNo_key";

/**
 * One match with the two team names, its stage/schedule, any existing
 * `SetScore` rows, and the tournament's scoring preset / type / discipline —
 * everything the match screen (`/admin/tournaments/[id]/matches/[matchId]`)
 * and `enterMatchResult` need. Scoped by the `(tournamentId, matchId)` pair;
 * `null` when they don't match (the `getEntryForAdmin` discipline).
 */
export function getMatchForResult(tournamentId: string, matchId: string) {
  return db.match.findFirst({
    where: { id: matchId, tournamentId },
    select: {
      id: true,
      stage: true,
      scheduledAt: true,
      venueText: true,
      homeEntry: { select: { team: { select: { name: true } } } },
      awayEntry: { select: { team: { select: { name: true } } } },
      sets: {
        select: { setNo: true, homePoints: true, awayPoints: true },
        orderBy: { setNo: "asc" },
      },
      tournament: { select: { scoringPreset: true, type: true, discipline: true } },
    },
  });
}

/**
 * Records a group match's result. One transaction: the match must exist,
 * belong to `tournamentId`, be `stage: "GROUP"`, and have **no** `SetScore`
 * rows yet — this is first-entry only (editing is Story 3.7). The caller
 * (`enterMatchResult`) has already validated `sets` through
 * `src/domain/validation.ts`; this function performs no score validation. A
 * concurrent second entry that races past the `_count` check trips
 * `@@unique([matchId, setNo])` inside the transaction and is reported as
 * `"exists"`; a concurrent redraw that deletes the match mid-transaction
 * trips a foreign-key / record-not-found error and is reported as
 * `"not_found"`. Neither is thrown.
 */
export async function createMatchResult(
  tournamentId: string,
  matchId: string,
  sets: SetScore[],
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "exists" }> {
  try {
    return await db.$transaction(async (tx) => {
      const match = await tx.match.findFirst({
        where: { id: matchId, tournamentId, stage: "GROUP" },
        select: { id: true, _count: { select: { sets: true } } },
      });
      if (!match) return { ok: false as const, reason: "not_found" as const };
      if (match._count.sets > 0) return { ok: false as const, reason: "exists" as const };

      await tx.setScore.createMany({ data: sets.map((set) => ({ ...set, matchId })) });
      return { ok: true as const };
    });
  } catch (error) {
    if (isUniqueViolation(error, SET_SCORE_NATURAL_KEY_INDEX)) {
      return { ok: false, reason: "exists" };
    }
    if (isMissingMatch(error)) {
      return { ok: false, reason: "not_found" };
    }
    throw error;
  }
}

// A concurrent redraw that removed the match mid-write surfaces as a `P2003`
// FK violation from `createMany`; `P2025` is kept as defence in case a future
// caller uses `update`/`delete` (which raise it) instead of the `*Many` forms.
function isMissingMatch(error: unknown): boolean {
  return (
    isRecordNotFound(error) ||
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003")
  );
}

/**
 * Replaces a group match's result with a fresh set of scores — the edit path
 * (Story 3.7). One transaction: the match must exist, belong to `tournamentId`,
 * be `stage: "GROUP"`, and **still have a result** (re-checked in the tx, so a
 * `deleteMatchResult` landing between the caller's guard and this write can't
 * be silently resurrected); then every existing `SetScore` row is deleted and
 * the new ones inserted. An empty `sets` array is refused (that is a delete, not
 * an edit). A concurrent redraw (`P2003`) or concurrent editor (`P2002`) is
 * reported as `"not_found"`, not thrown.
 */
export async function replaceMatchResult(
  tournamentId: string,
  matchId: string,
  sets: SetScore[],
): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
  if (sets.length === 0) return { ok: false, reason: "not_found" };
  try {
    return await db.$transaction(async (tx) => {
      const match = await tx.match.findFirst({
        where: { id: matchId, tournamentId, stage: "GROUP" },
        select: { _count: { select: { sets: true } } },
      });
      if (!match || match._count.sets === 0) {
        return { ok: false as const, reason: "not_found" as const };
      }

      await tx.setScore.deleteMany({ where: { matchId } });
      await tx.setScore.createMany({ data: sets.map((set) => ({ ...set, matchId })) });
      return { ok: true as const };
    });
  } catch (error) {
    if (isUniqueViolation(error, SET_SCORE_NATURAL_KEY_INDEX) || isMissingMatch(error)) {
      return { ok: false, reason: "not_found" };
    }
    throw error;
  }
}

/**
 * Deletes a group match's result (Story 3.7) — every `SetScore` row of the
 * match, returning it to the "not played" state. Scoped by the nested `match`
 * filter (`tournamentId` + `stage: "GROUP"`), so a cross-tournament `matchId`
 * or an already-empty match deletes nothing (`{ count: 0 }`).
 */
export function deleteMatchResult(
  tournamentId: string,
  matchId: string,
): Promise<{ count: number }> {
  return db.setScore.deleteMany({
    where: { matchId, match: { tournamentId, stage: "GROUP" } },
  });
}
