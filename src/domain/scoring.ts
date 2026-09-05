/**
 * Match points and group standings per scoring preset (glossary "Система
 * очок"). Pure — no framework, no IO.
 */

import type { ScoringPreset } from "@/domain/tournamentForm";

export interface SetScore {
  setNo: number;
  homePoints: number;
  awayPoints: number;
}

export interface MatchResult {
  homeEntryId: string;
  awayEntryId: string;
  sets: SetScore[];
}

export interface StandingsRow {
  entryId: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
  setsWon: number;
  setsLost: number;
}

function countSetsWon(sets: SetScore[]): { homeSetsWon: number; awaySetsWon: number } {
  let homeSetsWon = 0;
  let awaySetsWon = 0;
  for (const set of sets) {
    if (set.homePoints > set.awayPoints) homeSetsWon++;
    else awaySetsWon++;
  }
  return { homeSetsWon, awaySetsWon };
}

/**
 * Points each side earns for a completed match. `CLASSIC`: 3/0 for a 3:0 or
 * 3:1 sweep, 2/1 for a 3:2 decider (FR-5). `CUSTOM`: exactly 3 sets always
 * played, 1 point per set won each side.
 */
export function matchPoints(
  sets: SetScore[],
  preset: ScoringPreset,
): { home: number; away: number } {
  const { homeSetsWon, awaySetsWon } = countSetsWon(sets);

  if (preset === "CUSTOM") {
    return { home: homeSetsWon, away: awaySetsWon };
  }

  const loserSetsWon = Math.min(homeSetsWon, awaySetsWon);
  const homeWon = homeSetsWon > awaySetsWon;
  const winnerPoints = loserSetsWon <= 1 ? 3 : 2;
  const loserPoints = loserSetsWon <= 1 ? 0 : 1;
  return homeWon
    ? { home: winnerPoints, away: loserPoints }
    : { home: loserPoints, away: winnerPoints };
}

/**
 * Group standings aggregated from every match result — never stored (AD-4),
 * always recomputed from `matches`. Ordering is `tiebreak.ts`'s job; this
 * returns rows in `entryIds` order.
 */
export function computeStandings(
  entryIds: string[],
  matches: MatchResult[],
  preset: ScoringPreset,
): StandingsRow[] {
  const rows = new Map<string, StandingsRow>(
    entryIds.map((entryId) => [
      entryId,
      { entryId, played: 0, wins: 0, losses: 0, points: 0, setsWon: 0, setsLost: 0 },
    ]),
  );

  for (const match of matches) {
    const homeRow = rows.get(match.homeEntryId);
    const awayRow = rows.get(match.awayEntryId);
    if (!homeRow || !awayRow) continue;

    const { homeSetsWon, awaySetsWon } = countSetsWon(match.sets);
    const { home: homePoints, away: awayPoints } = matchPoints(match.sets, preset);

    homeRow.played += 1;
    awayRow.played += 1;
    homeRow.points += homePoints;
    awayRow.points += awayPoints;
    homeRow.setsWon += homeSetsWon;
    homeRow.setsLost += awaySetsWon;
    awayRow.setsWon += awaySetsWon;
    awayRow.setsLost += homeSetsWon;

    if (homeSetsWon > awaySetsWon) {
      homeRow.wins += 1;
      awayRow.losses += 1;
    } else {
      awayRow.wins += 1;
      homeRow.losses += 1;
    }
  }

  return entryIds.map((entryId) => rows.get(entryId)!);
}
