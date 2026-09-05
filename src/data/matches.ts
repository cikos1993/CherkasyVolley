import { db } from "@/data/client";
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
      sets: { select: { setNo: true, homePoints: true, awayPoints: true } },
    },
  });

  // GROUP matches always have both entries set at creation (Story 3.3's
  // draw); the filter exists only to satisfy the type system's nullability
  // (Match.homeEntryId/awayEntryId are nullable for Epic 4's playoff rows).
  const matches: MatchResult[] = matchRows
    .filter((match) => match.homeEntryId && match.awayEntryId)
    .map((match) => ({
      homeEntryId: match.homeEntryId!,
      awayEntryId: match.awayEntryId!,
      sets: match.sets,
    }));

  const rows = computeStandings(entryIds, matches, tournament.scoringPreset);
  return orderStandings(rows, matches, tournament.scoringPreset, teamNames);
}
