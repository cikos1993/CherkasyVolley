/**
 * Group-stage schedule generation (glossary "Жеребкування"). Pure — no
 * framework, no IO. Round-robin via the standard circle method; an odd
 * number of entries gets one synthetic bye slot per tour, never emitted as
 * a real pairing. `rounds` cycles repeat the identical pairing set — no
 * home/away swap between cycles (see the story's Notes on AC interpretation).
 */

export interface ScheduledPairing {
  round: number;
  tour: number;
  homeEntryId: string;
  awayEntryId: string;
}

const BYE = "__bye__";

function defaultShuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function circleMethodTours(ids: string[]): [string, string][][] {
  const n = ids.length;
  const numTours = n - 1;
  const fixed = ids[0];
  let rotating = ids.slice(1);
  const tours: [string, string][][] = [];

  for (let tour = 0; tour < numTours; tour++) {
    const current = [fixed, ...rotating];
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      pairs.push([current[i], current[n - 1 - i]]);
    }
    tours.push(pairs);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, rotating.length - 1)];
  }

  return tours;
}

/**
 * Every entry plays every other exactly once per cycle, `rounds` cycles.
 * `shuffle` reorders the pairs listed within one tour (FR-11's "порядок пар
 * у турах... випадковий") — injectable for deterministic tests, defaults to
 * a `Math.random`-based Fisher–Yates.
 */
export function generateSchedule(
  entryIds: string[],
  rounds: number,
  shuffle: <T>(items: T[]) => T[] = defaultShuffle,
): ScheduledPairing[] {
  const ids = entryIds.length % 2 === 0 ? entryIds : [...entryIds, BYE];
  const tours = circleMethodTours(ids);

  const schedule: ScheduledPairing[] = [];
  for (let round = 1; round <= rounds; round++) {
    tours.forEach((pairs, tourIndex) => {
      for (const [homeEntryId, awayEntryId] of shuffle(pairs)) {
        if (homeEntryId === BYE || awayEntryId === BYE) continue;
        schedule.push({ round, tour: tourIndex + 1, homeEntryId, awayEntryId });
      }
    });
  }
  return schedule;
}
