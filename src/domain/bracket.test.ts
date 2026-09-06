import { describe, expect, it } from "vitest";

import {
  advanceBracket,
  checkCanEditSemifinalResult,
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
    expect(() => seedPlayoff([])).toThrow(RangeError);
  });

  it("follows the array order it is given, not the rows' stats", () => {
    // Row 0 has the weakest record; a seedPlayoff that re-sorted internally
    // would put it last instead of at seed 1.
    const weakestFirst: OrderedStandingsRow[] = [
      { row: { entryId: "t1", played: 3, wins: 0, losses: 3, points: 0, setsWon: 0, setsLost: 9 }, needsManualSeed: false },
      orderedRow("t2"),
      orderedRow("t3"),
      { row: { entryId: "t4", played: 3, wins: 3, losses: 0, points: 9, setsWon: 9, setsLost: 0 }, needsManualSeed: false },
    ];
    const bracket = seedPlayoff(weakestFirst);
    expect(bracket.semifinals[0].home?.entryId).toBe("t1");
    expect(bracket.semifinals[0].away?.entryId).toBe("t4");
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

  it("reports an absent semifinal as AWAITING, not READY", () => {
    const bracket = advanceBracket([
      { slot: "SF1", home: { entryId: "t1", seed: 1 }, away: { entryId: "t4", seed: 4 }, sets: [] },
    ]);

    expect(bracket.semifinals[0].status).toBe("READY");
    expect(bracket.semifinals[1]).toMatchObject({ home: null, away: null, status: "AWAITING" });
  });

  it("throws when two matches claim the same slot", () => {
    expect(() =>
      advanceBracket([
        { slot: "SF1", home: { entryId: "t1", seed: 1 }, away: { entryId: "t4", seed: 4 }, sets: [] },
        { slot: "SF1", home: { entryId: "t2", seed: 2 }, away: { entryId: "t3", seed: 3 }, sets: [] },
      ]),
    ).toThrow(/slot SF1/);
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
    // SF1: t1 beats t4. SF2: t2 beats t3.
    const bracket = advanceBracket(playedSemifinals(HOME_WIN, HOME_WIN));
    expect(bracket.final).toMatchObject({
      slot: "FINAL",
      stage: "FINAL",
      home: { entryId: "t1" },
      away: { entryId: "t2" },
      status: "READY",
    });
    expect(bracket.thirdPlace).toMatchObject({
      slot: "THIRD_PLACE",
      stage: "THIRD_PLACE",
      home: { entryId: "t4" },
      away: { entryId: "t3" },
      status: "READY",
    });
  });

  it("resolves a fully populated four-slot bracket end to end", () => {
    const matches: PlayoffMatchState[] = [
      ...playedSemifinals(HOME_WIN, HOME_WIN), // t1, t2 win; t4, t3 lose
      { slot: "FINAL", home: { entryId: "t1", seed: 1 }, away: { entryId: "t2", seed: 2 }, sets: AWAY_WIN },
      { slot: "THIRD_PLACE", home: { entryId: "t4", seed: 4 }, away: { entryId: "t3", seed: 3 }, sets: HOME_WIN },
    ];
    const bracket = advanceBracket(matches);

    expect(bracket.semifinals.map((s) => s.status)).toEqual(["PLAYED", "PLAYED"]);
    expect(bracket.final).toMatchObject({
      home: { entryId: "t1" },
      away: { entryId: "t2" },
      status: "PLAYED",
    });
    expect(bracket.thirdPlace).toMatchObject({
      home: { entryId: "t4" },
      away: { entryId: "t3" },
      status: "PLAYED",
    });
  });

  it("round-trips seedPlayoff output through advanceBracket", () => {
    const seeded = seedPlayoff(TABLE);
    const matches: PlayoffMatchState[] = seeded.semifinals.map((sf, index) => ({
      slot: sf.slot,
      home: sf.home,
      away: sf.away,
      sets: index === 0 ? HOME_WIN : AWAY_WIN, // SF1: t1 wins; SF2: t3 wins
    }));

    const advanced = advanceBracket(matches);
    expect(advanced.final).toMatchObject({
      home: { entryId: "t1" },
      away: { entryId: "t3" },
      status: "READY",
    });
    expect(advanced.thirdPlace).toMatchObject({
      home: { entryId: "t4" },
      away: { entryId: "t2" },
      status: "READY",
    });
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

  it("fills 3rd and 4th while 1st and 2nd stay null when only the third-place match is played", () => {
    const matches: PlayoffMatchState[] = [
      { slot: "FINAL", home: { entryId: "t1", seed: null }, away: { entryId: "t3", seed: null }, sets: [] },
      { slot: "THIRD_PLACE", home: { entryId: "t4", seed: null }, away: { entryId: "t2", seed: null }, sets: AWAY_WIN },
    ];

    expect(playoffPlacements(matches)).toEqual({
      first: null,
      second: null,
      third: "t2",
      fourth: "t4",
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

describe("checkCanEditSemifinalResult", () => {
  it("allows the edit for an empty bracket", () => {
    expect(checkCanEditSemifinalResult([])).toEqual({ ok: true });
  });

  it("allows the edit when only the two semifinals are played", () => {
    expect(checkCanEditSemifinalResult(playedSemifinals(HOME_WIN, HOME_WIN))).toEqual({ ok: true });
  });

  it("allows the edit when a downstream row exists but has no result yet", () => {
    const matches: PlayoffMatchState[] = [
      ...playedSemifinals(HOME_WIN, HOME_WIN),
      { slot: "FINAL", home: { entryId: "t1", seed: null }, away: { entryId: "t2", seed: null }, sets: [] },
      { slot: "THIRD_PLACE", home: { entryId: "t4", seed: null }, away: { entryId: "t3", seed: null }, sets: [] },
    ];
    expect(checkCanEditSemifinalResult(matches)).toEqual({ ok: true });
  });

  it("blocks the edit once the final has a result", () => {
    const matches: PlayoffMatchState[] = [
      ...playedSemifinals(HOME_WIN, HOME_WIN),
      { slot: "FINAL", home: { entryId: "t1", seed: null }, away: { entryId: "t2", seed: null }, sets: HOME_WIN },
    ];
    const check = checkCanEditSemifinalResult(matches);
    expect(check.ok).toBe(false);
    expect(check.ok === false && check.message.length).toBeGreaterThan(0);
  });

  it("blocks the edit once the third-place match has a result", () => {
    const matches: PlayoffMatchState[] = [
      ...playedSemifinals(HOME_WIN, HOME_WIN),
      { slot: "THIRD_PLACE", home: { entryId: "t4", seed: null }, away: { entryId: "t3", seed: null }, sets: AWAY_WIN },
    ];
    expect(checkCanEditSemifinalResult(matches).ok).toBe(false);
  });

  it("blocks the edit when both downstream matches are played", () => {
    const matches: PlayoffMatchState[] = [
      ...playedSemifinals(HOME_WIN, HOME_WIN),
      { slot: "FINAL", home: { entryId: "t1", seed: null }, away: { entryId: "t2", seed: null }, sets: HOME_WIN },
      { slot: "THIRD_PLACE", home: { entryId: "t4", seed: null }, away: { entryId: "t3", seed: null }, sets: AWAY_WIN },
    ];
    expect(checkCanEditSemifinalResult(matches).ok).toBe(false);
  });
});
