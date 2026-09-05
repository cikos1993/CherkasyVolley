import { describe, expect, it } from "vitest";

import { computeStandings, type MatchResult, type SetScore } from "./scoring";
import { orderStandings } from "./tiebreak";

function sets(...pairs: [number, number][]): SetScore[] {
  return pairs.map(([homePoints, awayPoints], index) => ({
    setNo: index + 1,
    homePoints,
    awayPoints,
  }));
}

function sweep(homeEntryId: string, awayEntryId: string): MatchResult {
  return { homeEntryId, awayEntryId, sets: sets([25, 10], [25, 10], [25, 10]) };
}

const names: Record<string, string> = { A: "Альфа", B: "Бета", C: "Гамма", D: "Дельта" };

describe("orderStandings", () => {
  it("orders purely by points when there are no ties", () => {
    const entryIds = ["A", "B", "C"];
    // A beats B and C; B beats C. Distinct point totals: A=6, B=3, C=0.
    const matches = [sweep("A", "B"), sweep("A", "C"), sweep("B", "C")];
    const rows = computeStandings(entryIds, matches, "CLASSIC");

    const ordered = orderStandings(rows, matches, "CLASSIC", names);
    expect(ordered.map((o) => o.row.entryId)).toEqual(["A", "B", "C"]);
    expect(ordered.every((o) => !o.needsManualSeed)).toBe(true);
  });

  it("breaks a 2-team points tie via the head-to-head mini-table", () => {
    // A and B meet twice (home-and-away), splitting points evenly under
    // CUSTOM — both finish on 3 points, but A won more sets in their own
    // head-to-head than B did.
    const matches: MatchResult[] = [
      { homeEntryId: "A", awayEntryId: "B", sets: sets([25, 20], [25, 18], [20, 25]) }, // A 2, B 1
      { homeEntryId: "B", awayEntryId: "A", sets: sets([25, 20], [20, 25], [20, 25]) }, // B 1, A 2
    ];
    const entryIds = ["A", "B"];
    const rows = computeStandings(entryIds, matches, "CUSTOM");
    expect(rows.map((r) => r.points)).toEqual([4, 2]);

    // Points already differ here (4 vs 2), so construct a genuine tie: give
    // B one more set win elsewhere against a third team worth exactly the
    // gap, while A and B's head-to-head stays decisively in A's favor.
    const withFiller: MatchResult[] = [
      ...matches,
      { homeEntryId: "B", awayEntryId: "C", sets: sets([25, 20], [25, 18]) }, // B +2 (2 sets)
    ];
    const allEntryIds = ["A", "B", "C"];
    const allRows = computeStandings(allEntryIds, withFiller, "CUSTOM");
    const tied = allRows.filter((r) => r.entryId === "A" || r.entryId === "B");
    expect(tied.map((r) => r.points).sort((a, b) => a - b)).toEqual([4, 4]);

    const ordered = orderStandings(tied, withFiller, "CUSTOM", names);
    // Head-to-head mini-table (only the A-vs-B matches): A won 4 sets total
    // across both legs, B won 2 — A ranks first, tie fully resolved.
    expect(ordered.map((o) => o.row.entryId)).toEqual(["A", "B"]);
    expect(ordered.every((o) => !o.needsManualSeed)).toBe(true);
  });

  it("breaks a 3-team tie via the mini-table when one team dominates the subset", () => {
    // A beats both B and C; B beats C — a clean subset hierarchy. External
    // filler wins even out the overall point totals without touching the
    // A/B/C head-to-head results themselves.
    const subset = [sweep("A", "B"), sweep("A", "C"), sweep("B", "C")];
    const withFiller: MatchResult[] = [
      ...subset,
      sweep("C", "D"),
      sweep("C", "D2"), // C: 0 (subset) + 6 (filler) = 6
      sweep("B", "D3"), // B: 3 (subset) + 3 (filler) = 6
      // A already has 6 from the subset alone.
    ];
    const allEntryIds = ["A", "B", "C", "D", "D2", "D3"];
    const allRows = computeStandings(allEntryIds, withFiller, "CLASSIC");
    const tied = allRows.filter((r) => ["A", "B", "C"].includes(r.entryId));
    expect(tied.map((r) => r.points).sort((a, b) => a - b)).toEqual([6, 6, 6]);

    const ordered = orderStandings(tied, withFiller, "CLASSIC", names);
    // Mini-table restricted to the A/B/C matches only: A=6 (beat both),
    // B=3 (beat only C), C=0 (lost both) — fully resolves the tie.
    expect(ordered.map((o) => o.row.entryId)).toEqual(["A", "B", "C"]);
    expect(ordered.every((o) => !o.needsManualSeed)).toBe(true);
  });

  it("a genuine 3-way cycle survives the mini-table and sets-won, falling to name + manual-seed flag", () => {
    // A beats B, B beats C, C beats A — each 3:0. Every team: one win (3
    // sets won, 0 lost) plus one loss (0 sets won, 3 lost) — identical
    // points, identical mini-table points, identical sets won.
    const entryIds = ["A", "B", "C"];
    const matches = [sweep("A", "B"), sweep("B", "C"), sweep("C", "A")];
    const rows = computeStandings(entryIds, matches, "CLASSIC");
    expect(rows.map((r) => r.points)).toEqual([3, 3, 3]);
    expect(rows.map((r) => r.setsWon)).toEqual([3, 3, 3]);

    const ordered = orderStandings(rows, matches, "CLASSIC", names);
    expect(ordered.every((o) => o.needsManualSeed)).toBe(true);
    // Deterministic fallback: Ukrainian-collated team name order (Альфа, Бета, Гамма).
    expect(ordered.map((o) => o.row.entryId)).toEqual(["A", "B", "C"]);
  });
});
