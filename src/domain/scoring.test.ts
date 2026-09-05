import { describe, expect, it } from "vitest";

import { computeStandings, matchPoints, type MatchResult, type SetScore } from "./scoring";

function sets(...pairs: [number, number][]): SetScore[] {
  return pairs.map(([homePoints, awayPoints], index) => ({
    setNo: index + 1,
    homePoints,
    awayPoints,
  }));
}

describe("matchPoints — CLASSIC", () => {
  it("3:0 sweep — winner 3, loser 0", () => {
    const result = matchPoints(sets([25, 20], [25, 18], [25, 22]), "CLASSIC");
    expect(result).toEqual({ home: 3, away: 0 });
  });

  it("3:1 — winner 3, loser 0", () => {
    const result = matchPoints(sets([25, 20], [20, 25], [25, 18], [25, 22]), "CLASSIC");
    expect(result).toEqual({ home: 3, away: 0 });
  });

  it("3:2 decider — winner 2, loser 1", () => {
    const result = matchPoints(
      sets([25, 20], [20, 25], [25, 18], [20, 25], [15, 10]),
      "CLASSIC",
    );
    expect(result).toEqual({ home: 2, away: 1 });
  });

  it("away side wins 3:2 — points mirrored", () => {
    const result = matchPoints(
      sets([20, 25], [25, 20], [18, 25], [25, 20], [10, 15]),
      "CLASSIC",
    );
    expect(result).toEqual({ home: 1, away: 2 });
  });
});

describe("matchPoints — CUSTOM", () => {
  it("3:0 — 3 points to the sweeping side, 0 to the other", () => {
    const result = matchPoints(sets([25, 20], [25, 18], [25, 22]), "CUSTOM");
    expect(result).toEqual({ home: 3, away: 0 });
  });

  it("2:1 — 2 points home, 1 point away", () => {
    const result = matchPoints(sets([25, 20], [20, 25], [25, 22]), "CUSTOM");
    expect(result).toEqual({ home: 2, away: 1 });
  });

  it("1:2 — 1 point home, 2 points away", () => {
    const result = matchPoints(sets([20, 25], [25, 20], [18, 25]), "CUSTOM");
    expect(result).toEqual({ home: 1, away: 2 });
  });

  it("0:3 — 0 points home, 3 points away", () => {
    const result = matchPoints(sets([20, 25], [18, 25], [22, 25]), "CUSTOM");
    expect(result).toEqual({ home: 0, away: 3 });
  });
});

describe("computeStandings", () => {
  it("aggregates played/wins/losses/points/sets across multiple matches", () => {
    const entryIds = ["A", "B", "C"];
    const matches: MatchResult[] = [
      { homeEntryId: "A", awayEntryId: "B", sets: sets([25, 20], [25, 18], [25, 22]) }, // A 3:0 B, CLASSIC -> A+3
      {
        homeEntryId: "B",
        awayEntryId: "C",
        sets: sets([25, 20], [20, 25], [25, 18], [20, 25], [15, 10]),
      }, // B 3:2 C, CLASSIC -> B+2, C+1
      { homeEntryId: "C", awayEntryId: "A", sets: sets([20, 25], [18, 25], [22, 25]) }, // A 3:0 C, CLASSIC -> A+3
    ];

    const rows = computeStandings(entryIds, matches, "CLASSIC");
    const byId = Object.fromEntries(rows.map((row) => [row.entryId, row]));

    expect(byId.A).toEqual({
      entryId: "A",
      played: 2,
      wins: 2,
      losses: 0,
      points: 6,
      setsWon: 6,
      setsLost: 0,
    });
    expect(byId.B).toEqual({
      entryId: "B",
      played: 2,
      wins: 1,
      losses: 1,
      points: 2,
      setsWon: 3,
      setsLost: 5,
    });
    expect(byId.C).toEqual({
      entryId: "C",
      played: 2,
      wins: 0,
      losses: 2,
      points: 1,
      setsWon: 2,
      setsLost: 6,
    });
  });

  it("an entry with no matches played gets a zeroed row, not omitted", () => {
    const rows = computeStandings(["A", "B"], [], "CLASSIC");
    expect(rows).toEqual([
      { entryId: "A", played: 0, wins: 0, losses: 0, points: 0, setsWon: 0, setsLost: 0 },
      { entryId: "B", played: 0, wins: 0, losses: 0, points: 0, setsWon: 0, setsLost: 0 },
    ]);
  });
});
