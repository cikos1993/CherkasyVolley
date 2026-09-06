import { describe, expect, it } from "vitest";

import {
  advanceBracket,
  playoffPlacements,
  seedPlayoff,
  type PlayoffMatchState,
} from "./bracket";
import { type SetScore } from "./scoring";
import { type OrderedStandingsRow } from "./tiebreak";

function sets(...pairs: [number, number][]): SetScore[] {
  return pairs.map(([homePoints, awayPoints], index) => ({
    setNo: index + 1,
    homePoints,
    awayPoints,
  }));
}

const HOME_WIN = sets([25, 20], [25, 18], [25, 22]);
const AWAY_WIN = sets([20, 25], [18, 25], [22, 25]);

function orderedRow(entryId: string, needsManualSeed = false): OrderedStandingsRow {
  return {
    row: { entryId, played: 3, wins: 2, losses: 1, points: 6, setsWon: 6, setsLost: 3 },
    needsManualSeed,
  };
}

const TABLE: OrderedStandingsRow[] = [
  orderedRow("t1"),
  orderedRow("t2"),
  orderedRow("t3"),
  orderedRow("t4"),
];

function playedSemifinals(sf1Sets: SetScore[], sf2Sets: SetScore[]): PlayoffMatchState[] {
  return [
    { slot: "SF1", home: { entryId: "t1", seed: 1 }, away: { entryId: "t4", seed: 4 }, sets: sf1Sets },
    { slot: "SF2", home: { entryId: "t2", seed: 2 }, away: { entryId: "t3", seed: 3 }, sets: sf2Sets },
  ];
}

describe("seedPlayoff", () => {
  it("pairs seed 1 v seed 4 and seed 2 v seed 3, higher seed hosting", () => {
    const bracket = seedPlayoff(TABLE);

    expect(bracket.semifinals[0]).toMatchObject({
      slot: "SF1",
      stage: "SEMIFINAL",
      home: { entryId: "t1", seed: 1 },
      away: { entryId: "t4", seed: 4 },
      status: "READY",
    });
    expect(bracket.semifinals[1]).toMatchObject({
      slot: "SF2",
      stage: "SEMIFINAL",
      home: { entryId: "t2", seed: 2 },
      away: { entryId: "t3", seed: 3 },
      status: "READY",
    });
  });

  it("leaves the final and third-place match awaiting participants", () => {
    const bracket = seedPlayoff(TABLE);

    expect(bracket.final).toEqual({
      slot: "FINAL",
      stage: "FINAL",
      home: null,
      away: null,
      status: "AWAITING",
    });
    expect(bracket.thirdPlace).toEqual({
      slot: "THIRD_PLACE",
      stage: "THIRD_PLACE",
      home: null,
      away: null,
      status: "AWAITING",
    });
  });

  it("ignores rows past the top four", () => {
    const bracket = seedPlayoff([...TABLE, orderedRow("t5"), orderedRow("t6")]);
    const seeded = [
      bracket.semifinals[0].home,
      bracket.semifinals[0].away,
      bracket.semifinals[1].home,
      bracket.semifinals[1].away,
    ].map((participant) => participant?.entryId);

    expect(seeded).toEqual(["t1", "t4", "t2", "t3"]);
  });

  it("works with exactly four rows", () => {
    expect(() => seedPlayoff(TABLE)).not.toThrow();
  });

  it("throws a RangeError for fewer than four rows", () => {
    expect(() => seedPlayoff(TABLE.slice(0, 3))).toThrow(RangeError);
  });

  it("flags needsManualSeed when any of the top four came from the name fallback", () => {
    const table = [orderedRow("t1"), orderedRow("t2"), orderedRow("t3"), orderedRow("t4", true)];
    expect(seedPlayoff(table).needsManualSeed).toBe(true);
  });

  it("does not flag needsManualSeed when only a row outside the top four used the fallback", () => {
    const table = [...TABLE, orderedRow("t5", true)];
    expect(seedPlayoff(table).needsManualSeed).toBe(false);
  });

  it("never reports needsManualSeed on a clean table", () => {
    expect(seedPlayoff(TABLE).needsManualSeed).toBe(false);
  });
});

describe("advanceBracket", () => {
  it("fills the final with semifinal winners and the third-place match with losers", () => {
    // SF1: t1 beats t4. SF2: t3 beats t2.
    const bracket = advanceBracket(playedSemifinals(HOME_WIN, AWAY_WIN));

    expect(bracket.final).toMatchObject({
      slot: "FINAL",
      stage: "FINAL",
      home: { entryId: "t1" },
      away: { entryId: "t3" },
      status: "READY",
    });
    expect(bracket.thirdPlace).toMatchObject({
      home: { entryId: "t4" },
      away: { entryId: "t2" },
      status: "READY",
    });
  });

  it("keeps the final and third-place match fully awaiting until both semifinals are played", () => {
    const bracket = advanceBracket(playedSemifinals(HOME_WIN, []));

    expect(bracket.final).toMatchObject({ home: null, away: null, status: "AWAITING" });
    expect(bracket.thirdPlace).toMatchObject({ home: null, away: null, status: "AWAITING" });
    expect(bracket.semifinals[0].status).toBe("PLAYED");
    expect(bracket.semifinals[1].status).toBe("READY");
  });

  it("treats a level or empty semifinal set tally as no result", () => {
    const level = sets([25, 20], [20, 25]);
    const bracket = advanceBracket(playedSemifinals(level, HOME_WIN));

    expect(bracket.final.status).toBe("AWAITING");
  });

  it("re-derives the final when a semifinal result changes before the final is played", () => {
    // First: t1 beats t4 in SF1, so t1 goes to the final.
    const first = advanceBracket(playedSemifinals(HOME_WIN, HOME_WIN));
    expect(first.final).toMatchObject({ home: { entryId: "t1" }, away: { entryId: "t2" } });

    // SF1 corrected: t4 actually won. The final has no result yet, so it follows.
    const corrected = advanceBracket(playedSemifinals(AWAY_WIN, HOME_WIN));
    expect(corrected.final).toMatchObject({ home: { entryId: "t4" }, away: { entryId: "t2" } });
    expect(corrected.thirdPlace).toMatchObject({ home: { entryId: "t1" }, away: { entryId: "t3" } });
  });

  it("freezes the final once it has its own result, even if a semifinal is corrected", () => {
    const matches: PlayoffMatchState[] = [
      ...playedSemifinals(HOME_WIN, HOME_WIN), // t1 and t2 reach the final
      {
        slot: "FINAL",
        home: { entryId: "t1", seed: null },
        away: { entryId: "t2", seed: null },
        sets: HOME_WIN,
      },
    ];

    // SF1 corrected so t4 won — the final is already played, so it must not move.
    matches[0] = {
      slot: "SF1",
      home: { entryId: "t1", seed: 1 },
      away: { entryId: "t4", seed: 4 },
      sets: AWAY_WIN,
    };

    const bracket = advanceBracket(matches);
    expect(bracket.final).toMatchObject({
      home: { entryId: "t1" },
      away: { entryId: "t2" },
      status: "PLAYED",
    });
    // The third-place match has no result of its own, so it still re-derives:
    // with SF1 corrected, t1 is now the SF1 loser and meets the SF2 loser t3.
    expect(bracket.thirdPlace).toMatchObject({ home: { entryId: "t1" }, away: { entryId: "t3" } });
  });

  it("freezes the third-place match once it has its own result", () => {
    const matches: PlayoffMatchState[] = [
      ...playedSemifinals(HOME_WIN, HOME_WIN),
      {
        slot: "THIRD_PLACE",
        home: { entryId: "t4", seed: null },
        away: { entryId: "t3", seed: null },
        sets: HOME_WIN,
      },
    ];
    matches[1] = {
      slot: "SF2",
      home: { entryId: "t2", seed: 2 },
      away: { entryId: "t3", seed: 3 },
      sets: AWAY_WIN, // t3 now wins SF2
    };

    expect(advanceBracket(matches).thirdPlace).toMatchObject({
      home: { entryId: "t4" },
      away: { entryId: "t3" },
      status: "PLAYED",
    });
  });

  it("synthesises the final and third-place match when only the semifinals exist", () => {
    const bracket = advanceBracket(playedSemifinals(HOME_WIN, HOME_WIN));
    expect(bracket.final.slot).toBe("FINAL");
    expect(bracket.thirdPlace.slot).toBe("THIRD_PLACE");
  });

  it("resolves the same regardless of input order", () => {
    const ordered = advanceBracket(playedSemifinals(HOME_WIN, AWAY_WIN));
    const reversed = advanceBracket([...playedSemifinals(HOME_WIN, AWAY_WIN)].reverse());
    expect(reversed).toEqual(ordered);
  });

  it("reports needsManualSeed as false — the seed-time flag belongs to seedPlayoff", () => {
    expect(advanceBracket(playedSemifinals(HOME_WIN, HOME_WIN)).needsManualSeed).toBe(false);
  });
});

describe("playoffPlacements", () => {
  it("reads first and second from the final, third and fourth from the third-place match", () => {
    const matches: PlayoffMatchState[] = [
      {
        slot: "FINAL",
        home: { entryId: "t1", seed: null },
        away: { entryId: "t3", seed: null },
        sets: AWAY_WIN, // t3 wins the final
      },
      {
        slot: "THIRD_PLACE",
        home: { entryId: "t4", seed: null },
        away: { entryId: "t2", seed: null },
        sets: HOME_WIN, // t4 wins the third-place match
      },
    ];

    expect(playoffPlacements(matches)).toEqual({
      first: "t3",
      second: "t1",
      third: "t4",
      fourth: "t2",
    });
  });

  it("returns null for a place whose deciding match has no result", () => {
    const matches: PlayoffMatchState[] = [
      { slot: "FINAL", home: { entryId: "t1", seed: null }, away: { entryId: "t3", seed: null }, sets: HOME_WIN },
      { slot: "THIRD_PLACE", home: { entryId: "t4", seed: null }, away: { entryId: "t2", seed: null }, sets: [] },
    ];

    expect(playoffPlacements(matches)).toEqual({
      first: "t1",
      second: "t3",
      third: null,
      fourth: null,
    });
  });

  it("returns all nulls for an unplayed bracket", () => {
    expect(playoffPlacements([])).toEqual({
      first: null,
      second: null,
      third: null,
      fourth: null,
    });
  });
});
