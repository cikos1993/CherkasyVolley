/**
 * Group standings ordering (glossary "Таблиця групи"). Pure — no framework,
 * no IO. Chain (FR-17): points → head-to-head via a mini-table of just the
 * tied entries → total sets won → team name, flagged for manual admin
 * review. Each step only breaks ties the previous step left; a step that
 * doesn't fully resolve a tie (e.g. a head-to-head cycle) falls through to
 * the next.
 */

import { computeStandings, type MatchResult, type StandingsRow } from "@/domain/scoring";
import type { ScoringPreset } from "@/domain/tournamentForm";

export interface OrderedStandingsRow {
  row: StandingsRow;
  needsManualSeed: boolean;
}

function groupByKey<T>(items: T[], keyFn: (item: T) => number): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

function sortedKeysDesc(groups: Map<number, unknown>): number[] {
  return [...groups.keys()].sort((a, b) => b - a);
}

function resolveByNameFallback(
  group: StandingsRow[],
  teamNames: Record<string, string>,
): OrderedStandingsRow[] {
  if (group.length === 1) return [{ row: group[0], needsManualSeed: false }];
  const sorted = [...group].sort((a, b) =>
    (teamNames[a.entryId] ?? "").localeCompare(teamNames[b.entryId] ?? "", "uk"),
  );
  return sorted.map((row) => ({ row, needsManualSeed: true }));
}

function resolveBySetsWon(
  group: StandingsRow[],
  teamNames: Record<string, string>,
): OrderedStandingsRow[] {
  if (group.length === 1) return [{ row: group[0], needsManualSeed: false }];
  const bySetsWon = groupByKey(group, (row) => row.setsWon);
  return sortedKeysDesc(bySetsWon).flatMap((setsWon) =>
    resolveByNameFallback(bySetsWon.get(setsWon)!, teamNames),
  );
}

function resolveTiedGroup(
  group: StandingsRow[],
  matches: MatchResult[],
  preset: ScoringPreset,
  teamNames: Record<string, string>,
): OrderedStandingsRow[] {
  if (group.length === 1) return [{ row: group[0], needsManualSeed: false }];

  const tiedIds = group.map((row) => row.entryId);
  const tiedIdSet = new Set(tiedIds);
  const headToHeadMatches = matches.filter(
    (match) => tiedIdSet.has(match.homeEntryId) && tiedIdSet.has(match.awayEntryId),
  );
  const miniRows = computeStandings(tiedIds, headToHeadMatches, preset);
  const miniByPoints = groupByKey(miniRows, (row) => row.points);

  return sortedKeysDesc(miniByPoints).flatMap((miniPoints) => {
    const subGroupIds = new Set(miniByPoints.get(miniPoints)!.map((row) => row.entryId));
    const subGroup = group.filter((row) => subGroupIds.has(row.entryId));
    return resolveBySetsWon(subGroup, teamNames);
  });
}

/**
 * Orders group standings by the FR-17 tiebreak chain. `teamNames` maps
 * `entryId → team name`, used only by the final fallback step.
 */
export function orderStandings(
  rows: StandingsRow[],
  matches: MatchResult[],
  preset: ScoringPreset,
  teamNames: Record<string, string>,
): OrderedStandingsRow[] {
  const byPoints = groupByKey(rows, (row) => row.points);
  return sortedKeysDesc(byPoints).flatMap((points) =>
    resolveTiedGroup(byPoints.get(points)!, matches, preset, teamNames),
  );
}
