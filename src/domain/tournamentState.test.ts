import { describe, expect, it } from "vitest";

import {
  canTransition,
  checkTransition,
  TRANSITIONS,
  type TournamentState,
} from "./tournamentState";

const ALL_STATES: TournamentState[] = ["DRAFT", "GROUP_STAGE", "PLAYOFF", "COMPLETED"];

describe("TRANSITIONS table", () => {
  it("is exactly the forward-only lifecycle chain", () => {
    expect(TRANSITIONS).toEqual({
      DRAFT: ["GROUP_STAGE"],
      GROUP_STAGE: ["PLAYOFF"],
      PLAYOFF: ["COMPLETED"],
      COMPLETED: [],
    });
  });
});

describe("canTransition", () => {
  it("allows each forward edge", () => {
    expect(canTransition("DRAFT", "GROUP_STAGE")).toBe(true);
    expect(canTransition("GROUP_STAGE", "PLAYOFF")).toBe(true);
    expect(canTransition("PLAYOFF", "COMPLETED")).toBe(true);
  });

  it("rejects skips, backward edges and self-transitions, ignoring preconditions", () => {
    expect(canTransition("DRAFT", "PLAYOFF")).toBe(false);
    expect(canTransition("DRAFT", "COMPLETED")).toBe(false);
    expect(canTransition("GROUP_STAGE", "DRAFT")).toBe(false);
    expect(canTransition("PLAYOFF", "GROUP_STAGE")).toBe(false);
    expect(canTransition("COMPLETED", "DRAFT")).toBe(false);
    expect(canTransition("DRAFT", "DRAFT")).toBe(false);
  });
});

describe("checkTransition — legal edges with satisfied preconditions", () => {
  it("DRAFT → GROUP_STAGE when entry count matches the field size", () => {
    expect(checkTransition("DRAFT", "GROUP_STAGE", { entryCount: 6, teamCount: 6 })).toEqual({
      ok: true,
    });
  });

  it("GROUP_STAGE → PLAYOFF when all group matches are played", () => {
    expect(
      checkTransition("GROUP_STAGE", "PLAYOFF", { allGroupMatchesPlayed: true }),
    ).toEqual({ ok: true });
  });

  it("PLAYOFF → COMPLETED when the final and third-place match are played", () => {
    expect(
      checkTransition("PLAYOFF", "COMPLETED", { finalAndThirdPlacePlayed: true }),
    ).toEqual({ ok: true });
  });
});

describe("checkTransition — DRAFT → GROUP_STAGE precondition", () => {
  it("fails when the entry count does not match the field size", () => {
    const result = checkTransition("DRAFT", "GROUP_STAGE", { entryCount: 7, teamCount: 10 });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ code: "PRECONDITION_FAILED" });
    if (!result.ok) {
      expect(result.message).toContain("7");
      expect(result.message).toContain("10");
    }
  });

  it("fails closed when the counts are unknown", () => {
    expect(checkTransition("DRAFT", "GROUP_STAGE", {})).toMatchObject({
      ok: false,
      code: "PRECONDITION_FAILED",
    });
    expect(checkTransition("DRAFT", "GROUP_STAGE", { entryCount: 6 })).toMatchObject({
      ok: false,
      code: "PRECONDITION_FAILED",
    });
  });
});

describe("checkTransition — stub preconditions fail closed", () => {
  it("GROUP_STAGE → PLAYOFF without proof", () => {
    expect(checkTransition("GROUP_STAGE", "PLAYOFF", {})).toMatchObject({
      ok: false,
      code: "PRECONDITION_FAILED",
    });
    expect(
      checkTransition("GROUP_STAGE", "PLAYOFF", { allGroupMatchesPlayed: false }),
    ).toMatchObject({ ok: false, code: "PRECONDITION_FAILED" });
  });

  it("PLAYOFF → COMPLETED without proof", () => {
    expect(checkTransition("PLAYOFF", "COMPLETED", {})).toMatchObject({
      ok: false,
      code: "PRECONDITION_FAILED",
    });
    expect(
      checkTransition("PLAYOFF", "COMPLETED", { finalAndThirdPlacePlayed: false }),
    ).toMatchObject({ ok: false, code: "PRECONDITION_FAILED" });
  });
});

describe("checkTransition — illegal edges", () => {
  const illegal: [TournamentState, TournamentState][] = [
    ["DRAFT", "PLAYOFF"],
    ["DRAFT", "COMPLETED"],
    ["GROUP_STAGE", "COMPLETED"],
    ["GROUP_STAGE", "DRAFT"],
    ["PLAYOFF", "GROUP_STAGE"],
    ["PLAYOFF", "DRAFT"],
    ["COMPLETED", "PLAYOFF"],
    ["COMPLETED", "GROUP_STAGE"],
    ["COMPLETED", "DRAFT"],
    ["DRAFT", "DRAFT"],
    ["GROUP_STAGE", "GROUP_STAGE"],
    ["PLAYOFF", "PLAYOFF"],
    ["COMPLETED", "COMPLETED"],
  ];

  it.each(illegal)("%s → %s is INVALID_TRANSITION", (from, to) => {
    // Pass a fully-populated context to prove the edge check runs first.
    const result = checkTransition(from, to, {
      entryCount: 6,
      teamCount: 6,
      allGroupMatchesPlayed: true,
      finalAndThirdPlacePlayed: true,
    });
    expect(result).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("every transition out of COMPLETED is rejected", () => {
    for (const to of ALL_STATES) {
      expect(checkTransition("COMPLETED", to)).toMatchObject({ ok: false });
    }
  });
});

describe("checkTransition — failure messages", () => {
  it("are non-empty Ukrainian strings", () => {
    const invalid = checkTransition("DRAFT", "COMPLETED");
    const precondition = checkTransition("DRAFT", "GROUP_STAGE", { entryCount: 1, teamCount: 2 });
    for (const result of [invalid, precondition]) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message.length).toBeGreaterThan(0);
        expect(result.message).toMatch(/[а-яіїєґ]/i);
      }
    }
  });
});
