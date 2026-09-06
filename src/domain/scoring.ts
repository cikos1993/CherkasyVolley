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

/** The single "who won this set" comparison — the one place both this module and `validation.ts` read it from. */
export function homeWonSet(set: SetScore): boolean {
  return set.homePoints > set.awayPoints;
}

/**
 * Sets won per side — the "3:1"-style tally shown next to a match, computed on
 * read and never hand-entered (AC 2). Every surface that displays a match
 * result derives it from here so the number can't drift between the admin
 * screen, the schedule list and the public page. A tied set (impossible for a
 * validated result — `validateSetScore` enforces win-by-2) counts for neither
 * side rather than being silently credited to one.
 */
export function matchSetSummary(sets: SetScore[]): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const set of sets) {
    if (set.homePoints > set.awayPoints) home += 1;
    else if (set.awayPoints > set.homePoints) away += 1;
  }
  return { home, away };
}

/** Human "X:Y" label for a match's set tally, or `null` when no sets are recorded. */
export function matchScoreLabel(sets: SetScore[]): string | null {
  if (sets.length === 0) return null;
  const { home, away } = matchSetSummary(sets);
  return `${home}:${away}`;
}

function countSetsWon(sets: SetScore[]): { homeSetsWon: number; awaySetsWon: number } {
  const { home, away } = matchSetSummary(sets);
  return { homeSetsWon: home, awaySetsWon: away };
}

/**
 * Points each side earns for a completed match. `CLASSIC`: 3/0 for a 3:0 or
 * 3:1 sweep, 2/1 for a 3:2 decider (FR-5). `CUSTOM`: exactly 3 sets always
 * played, 1 point per set won each side. Trusts `sets` already passed
 * `validation.ts`'s `validateMatchScore` — this module does not re-validate
 * set counts, scores, or ordering itself.
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
 * returns rows in `entryIds` order. Trusts every match's `sets` already
 * passed `validateMatchScore` (see `matchPoints`'s note) and that `matches`
 * never contains a self-paired entry or `entryIds` a duplicate — both are
 * structurally prevented upstream (`TournamentEntry`'s DB uniqueness,
 * `schedule.ts`'s circle method), not re-checked here.
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
