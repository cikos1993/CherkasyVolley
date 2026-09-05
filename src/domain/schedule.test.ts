import { describe, expect, it } from "vitest";

import { generateSchedule } from "./schedule";

const identityShuffle = <T>(items: T[]): T[] => items;

function pairKey(homeEntryId: string, awayEntryId: string): string {
  return [homeEntryId, awayEntryId].sort().join("-");
}

function allUnorderedPairs(ids: string[]): string[] {
  const pairs: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push(pairKey(ids[i], ids[j]));
    }
  }
  return pairs.sort();
}

describe("generateSchedule", () => {
  it("4 teams, 1 round — every pair appears exactly once, 3 tours of 2 matches", () => {
    const ids = ["A", "B", "C", "D"];
    const schedule = generateSchedule(ids, 1, identityShuffle);

    expect(schedule).toHaveLength(6);
    expect(new Set(schedule.map((m) => m.tour)).size).toBe(3);
    for (const tour of [1, 2, 3]) {
      expect(schedule.filter((m) => m.tour === tour)).toHaveLength(2);
    }
    expect(schedule.map((m) => pairKey(m.homeEntryId, m.awayEntryId)).sort()).toEqual(
      allUnorderedPairs(ids),
    );
  });

  it("4 teams, 2 rounds — every pairing doubles, one full cycle per round", () => {
    const ids = ["A", "B", "C", "D"];
    const schedule = generateSchedule(ids, 2, identityShuffle);

    expect(schedule).toHaveLength(12);
    expect(schedule.filter((m) => m.round === 1)).toHaveLength(6);
    expect(schedule.filter((m) => m.round === 2)).toHaveLength(6);

    const counts = new Map<string, number>();
    for (const match of schedule) {
      const key = pairKey(match.homeEntryId, match.awayEntryId);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect([...counts.values()]).toEqual(Array(6).fill(2));
  });

  it("5 teams (odd) — a bye tour per team, no match ever involves the bye slot", () => {
    const ids = ["A", "B", "C", "D", "E"];
    const schedule = generateSchedule(ids, 1, identityShuffle);

    expect(schedule).toHaveLength(10);
    for (const match of schedule) {
      expect(ids).toContain(match.homeEntryId);
      expect(ids).toContain(match.awayEntryId);
    }

    // 5 tours; each team plays in exactly 4 of them (sits out exactly 1).
    const tours = new Set(schedule.map((m) => m.tour));
    expect(tours.size).toBe(5);
    for (const entryId of ids) {
      const toursPlayed = new Set(
        schedule
          .filter((m) => m.homeEntryId === entryId || m.awayEntryId === entryId)
          .map((m) => m.tour),
      );
      expect(toursPlayed.size).toBe(4);
    }

    expect(schedule.map((m) => pairKey(m.homeEntryId, m.awayEntryId)).sort()).toEqual(
      allUnorderedPairs(ids),
    );
  });

  it("home/away assignment is controlled by shuffle, not fixed to one entry", () => {
    // The circle method's "fixed" anchor entry (entryIds[0]) is `pair[0]`
    // in every pairing it's constructed with. Reversing every shuffled
    // array (both the pair order and each pair's own two elements) must
    // flip that entry to the away slot in all of its matches — proving
    // home/away genuinely depends on `shuffle`, not on circle-method
    // position (the bug this closes: entryIds[0] used to be home 100% of
    // the time regardless of `shuffle`).
    const reverseShuffle = <T>(items: T[]): T[] => [...items].reverse();
    const ids = ["A", "B", "C", "D"];
    const schedule = generateSchedule(ids, 1, reverseShuffle);

    const matchesWithA = schedule.filter((m) => m.homeEntryId === "A" || m.awayEntryId === "A");
    expect(matchesWithA).toHaveLength(3);
    expect(matchesWithA.every((m) => m.awayEntryId === "A")).toBe(true);
  });

  it("6 teams — same even-count guarantees as 4 teams, scaled up", () => {
    const ids = ["A", "B", "C", "D", "E", "F"];
    const schedule = generateSchedule(ids, 1, identityShuffle);

    expect(schedule).toHaveLength(15);
    expect(new Set(schedule.map((m) => m.tour)).size).toBe(5);
    for (const tour of [1, 2, 3, 4, 5]) {
      expect(schedule.filter((m) => m.tour === tour)).toHaveLength(3);
    }
    expect(schedule.map((m) => pairKey(m.homeEntryId, m.awayEntryId)).sort()).toEqual(
      allUnorderedPairs(ids),
    );
  });
});
