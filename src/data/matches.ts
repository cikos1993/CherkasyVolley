import { db } from "@/data/client";
import { Prisma } from "@/generated/prisma/client";
import { computeStandings, type MatchResult } from "@/domain/scoring";
import { orderStandings, type OrderedStandingsRow } from "@/domain/tiebreak";

/**
 * The group standings table for a tournament — the sole `src/data → src/domain`
 * **value** call for standings (every prior `data → domain` edge was
 * type-only). Never stored (AD-4): recomputed fresh from `Match` + `SetScore`
 * every call. Entry ids come from `GroupSlot` (who the draw actually seated
 * into the group), not `TournamentEntry` directly — see the story's Notes on
 * AC interpretation. Returns `[]` if the tournament has no `Group` (shouldn't
 * happen — every tournament gets one at creation) or the group has no
 * `GroupSlot` rows yet (the real, expected case: a `DRAFT` tournament before
 * the draw).
 */
export async function getStandings(tournamentId: string): Promise<OrderedStandingsRow[]> {
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
  return orderStandings(rows, matches, tournament.scoringPreset, teamNames);
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
