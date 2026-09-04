import { describe, expect, it } from "vitest";

import {
  allowedTournamentTypes,
  resolveGroupStageFields,
  TOURNAMENT_TYPES,
  validateNewTournament,
  type RawTournamentInput,
} from "./tournamentForm";

const VALID: RawTournamentInput = {
  discipline: "CLASSIC",
  type: "CHAMPIONSHIP",
  name: "  Чемпіонат Черкащини  ",
  year: "2026",
  scoringPreset: "CLASSIC",
  teamCount: "6",
  rounds: "1",
};

describe("allowedTournamentTypes", () => {
  it("returns all four types for CLASSIC", () => {
    expect(allowedTournamentTypes("CLASSIC")).toEqual([
      "CHAMPIONSHIP",
      "VETERAN",
      "WOMEN",
      "YOUTH",
    ]);
    expect(allowedTournamentTypes("CLASSIC")).toBe(TOURNAMENT_TYPES);
  });

  it("returns nothing for BEACH (no create path in v1)", () => {
    expect(allowedTournamentTypes("BEACH")).toEqual([]);
  });
});

describe("validateNewTournament — valid input", () => {
  it("trims the name and coerces the numeric fields", () => {
    const result = validateNewTournament(VALID);
    expect(result).toEqual({
      ok: true,
      value: {
        discipline: "CLASSIC",
        type: "CHAMPIONSHIP",
        name: "Чемпіонат Черкащини",
        year: 2026,
        scoringPreset: "CLASSIC",
        teamCount: 6,
        rounds: 1,
      },
    });
  });

  it("accepts each allowed type and preset", () => {
    for (const type of TOURNAMENT_TYPES) {
      for (const scoringPreset of ["CLASSIC", "CUSTOM"] as const) {
        const result = validateNewTournament({ ...VALID, type, scoringPreset });
        expect(result.ok).toBe(true);
      }
    }
  });

  it("accepts the bound edges", () => {
    expect(
      validateNewTournament({ ...VALID, year: "2000", teamCount: "4", rounds: "1" }).ok,
    ).toBe(true);
    expect(
      validateNewTournament({ ...VALID, year: "2100", teamCount: "64", rounds: "10" }).ok,
    ).toBe(true);
  });
});

describe("validateNewTournament — field errors", () => {
  function errorsFor(patch: RawTournamentInput) {
    const result = validateNewTournament({ ...VALID, ...patch });
    if (result.ok) throw new Error("expected a validation failure");
    return result.fieldErrors;
  }

  it("name: empty, whitespace, too long", () => {
    expect(errorsFor({ name: "" })).toHaveProperty("name");
    expect(errorsFor({ name: "   " })).toHaveProperty("name");
    expect(errorsFor({ name: undefined })).toHaveProperty("name");
    expect(errorsFor({ name: "x".repeat(121) })).toHaveProperty("name");
  });

  it("year: below range, above range, not a number", () => {
    expect(errorsFor({ year: "1999" })).toHaveProperty("year");
    expect(errorsFor({ year: "2101" })).toHaveProperty("year");
    expect(errorsFor({ year: "abc" })).toHaveProperty("year");
    expect(errorsFor({ year: "2026.5" })).toHaveProperty("year");
    expect(errorsFor({ year: undefined })).toHaveProperty("year");
  });

  it("teamCount: below 4, above 64, not an integer", () => {
    expect(errorsFor({ teamCount: "3" })).toHaveProperty("teamCount");
    expect(errorsFor({ teamCount: "65" })).toHaveProperty("teamCount");
    expect(errorsFor({ teamCount: "5.5" })).toHaveProperty("teamCount");
  });

  it("rounds: below 1, above 10", () => {
    expect(errorsFor({ rounds: "0" })).toHaveProperty("rounds");
    expect(errorsFor({ rounds: "11" })).toHaveProperty("rounds");
  });

  it("type: missing or unknown", () => {
    expect(errorsFor({ type: undefined })).toHaveProperty("type");
    expect(errorsFor({ type: "FRIENDLY" })).toHaveProperty("type");
  });

  it("scoringPreset: missing or unknown", () => {
    expect(errorsFor({ scoringPreset: undefined })).toHaveProperty("scoringPreset");
    expect(errorsFor({ scoringPreset: "RALLY" })).toHaveProperty("scoringPreset");
  });

  it("BEACH discipline leaves no valid type", () => {
    const errors = errorsFor({ discipline: "BEACH", type: "CHAMPIONSHIP" });
    expect(errors).toHaveProperty("type");
  });

  it("reports every failing field at once, not just the first", () => {
    const result = validateNewTournament({
      discipline: "CLASSIC",
      type: "",
      name: "",
      year: "1000",
      scoringPreset: "",
      teamCount: "0",
      rounds: "0",
    });
    if (result.ok) throw new Error("expected a validation failure");
    expect(Object.keys(result.fieldErrors).sort()).toEqual(
      ["name", "rounds", "scoringPreset", "teamCount", "type", "year"].sort(),
    );
  });

  it("every message is a non-empty Ukrainian string", () => {
    const result = validateNewTournament({ discipline: "CLASSIC" });
    if (result.ok) throw new Error("expected a validation failure");
    for (const message of Object.values(result.fieldErrors)) {
      expect(message).toMatch(/[а-яіїєґ]/i);
    }
  });
});

describe("resolveGroupStageFields", () => {
  const submitted = { teamCount: "12", rounds: "3" };
  const current = { teamCount: 6, rounds: 1 };

  it("passes the submitted values through while DRAFT", () => {
    expect(resolveGroupStageFields("DRAFT", submitted, current)).toEqual(submitted);
  });

  it("discards the submitted values outside DRAFT, keeping the tournament's current ones", () => {
    for (const state of ["GROUP_STAGE", "PLAYOFF", "COMPLETED"] as const) {
      expect(resolveGroupStageFields(state, submitted, current)).toEqual({
        teamCount: "6",
        rounds: "1",
      });
    }
  });

  it("does this even when the submitted values are missing or malformed", () => {
    expect(resolveGroupStageFields("GROUP_STAGE", { teamCount: null, rounds: "abc" }, current)).toEqual(
      { teamCount: "6", rounds: "1" },
    );
  });
});
