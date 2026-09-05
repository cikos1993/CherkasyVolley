/**
 * Set-score validation (glossary "Партія", "Результат матчу"). Pure — no
 * framework, no IO.
 */

import { homeWonSet, type SetScore } from "@/domain/scoring";
import type { ScoringPreset, TournamentType } from "@/domain/tournamentForm";

export type Validation = { ok: true } | { ok: false; message: string };

/**
 * Target set score. `VETERAN` plays every set to 15, regardless of preset.
 * Otherwise `CLASSIC`'s decisive 5th set is always 15; every other set is
 * 25. Fixed per FR-5's own `[NOTE FOR PM]` — v1 hardcodes this rather than
 * exposing a Tournament Rules field; not a gap (see the story's Notes on AC
 * interpretation for PRD Open Question #5, already resolved for v1).
 */
export function targetScore(
  preset: ScoringPreset,
  tournamentType: TournamentType,
  setNo: number,
): number {
  if (tournamentType === "VETERAN") return 15;
  if (preset === "CLASSIC" && setNo === 5) return 15;
  return 25;
}

/**
 * A set is won by reaching `target` with at least a 2-point lead — the same
 * win-by-2 rule for both presets (see Notes on AC interpretation: PRD states
 * it only under `CLASSIC`, but nothing there redefines what winning a set
 * means under `CUSTOM`). No upper cap on the winning score.
 */
export function validateSetScore(homePoints: number, awayPoints: number, target: number): Validation {
  if (
    !Number.isInteger(homePoints) ||
    !Number.isInteger(awayPoints) ||
    homePoints < 0 ||
    awayPoints < 0
  ) {
    return { ok: false, message: "Рахунок партії має бути невідʼємним цілим числом." };
  }

  const higher = Math.max(homePoints, awayPoints);
  const lower = Math.min(homePoints, awayPoints);

  if (higher < target) {
    return { ok: false, message: `Партія триває до ${target} очок.` };
  }
  if (higher - lower < 2) {
    return { ok: false, message: "Партія завершується з перевагою щонайменше 2 очок." };
  }
  return { ok: true };
}

/**
 * `CLASSIC`: 3–5 sets, ends the instant one side reaches 3 set wins (no set
 * after that point). `CUSTOM`: exactly 3 sets, always all 3 played (FR-5 —
 * there is no "match decided early" concept under this preset). `sets` must
 * be given in ascending, contiguous `setNo` order starting at 1 — the
 * decisiveness check below walks the array in order while `targetScore`
 * looks up each set's own `setNo`, so an out-of-order or gapped `sets`
 * array would silently apply the wrong target if this weren't checked.
 */
export function validateMatchScore(
  sets: SetScore[],
  preset: ScoringPreset,
  tournamentType: TournamentType,
): Validation {
  if (preset === "CUSTOM") {
    if (sets.length !== 3) {
      return { ok: false, message: "Кастомний пресет: рівно 3 партії." };
    }
  } else if (sets.length < 3 || sets.length > 5) {
    return { ok: false, message: "Класичний пресет: від 3 до 5 партій." };
  }

  for (const [index, set] of sets.entries()) {
    if (set.setNo !== index + 1) {
      return { ok: false, message: "Партії мають бути пронумеровані по порядку, без пропусків." };
    }
  }

  for (const set of sets) {
    const target = targetScore(preset, tournamentType, set.setNo);
    const result = validateSetScore(set.homePoints, set.awayPoints, target);
    if (!result.ok) {
      return { ok: false, message: `Партія ${set.setNo}: ${result.message}` };
    }
  }

  if (preset === "CLASSIC") {
    let homeWins = 0;
    let awayWins = 0;
    for (const [index, set] of sets.entries()) {
      if (homeWonSet(set)) homeWins++;
      else awayWins++;

      const isDecided = homeWins === 3 || awayWins === 3;
      const isLastSet = index === sets.length - 1;
      if (isDecided && !isLastSet) {
        return { ok: false, message: "Зайва партія після завершення матчу." };
      }
    }
    if (homeWins < 3 && awayWins < 3) {
      return { ok: false, message: "Матч не завершено — жодна сторона не виграла 3 партії." };
    }
  }

  return { ok: true };
}
