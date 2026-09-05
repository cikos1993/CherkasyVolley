import { describe, expect, it } from "vitest";

import type { SetScore } from "./scoring";
import { targetScore, validateMatchScore, validateSetScore } from "./validation";

function set(setNo: number, homePoints: number, awayPoints: number): SetScore {
  return { setNo, homePoints, awayPoints };
}

describe("targetScore", () => {
  it("VETERAN plays every set to 15, regardless of preset or set number", () => {
    expect(targetScore("CLASSIC", "VETERAN", 1)).toBe(15);
    expect(targetScore("CLASSIC", "VETERAN", 5)).toBe(15);
    expect(targetScore("CUSTOM", "VETERAN", 2)).toBe(15);
  });

  it("non-VETERAN CLASSIC: sets 1-4 to 25, the decisive 5th to 15", () => {
    expect(targetScore("CLASSIC", "CHAMPIONSHIP", 1)).toBe(25);
    expect(targetScore("CLASSIC", "CHAMPIONSHIP", 4)).toBe(25);
    expect(targetScore("CLASSIC", "CHAMPIONSHIP", 5)).toBe(15);
  });

  it("non-VETERAN CUSTOM: every set to 25", () => {
    expect(targetScore("CUSTOM", "YOUTH", 1)).toBe(25);
    expect(targetScore("CUSTOM", "WOMEN", 3)).toBe(25);
  });
});

describe("validateSetScore", () => {
  it("accepts scores at the win-by-2 boundary", () => {
    expect(validateSetScore(25, 23, 25)).toEqual({ ok: true });
    expect(validateSetScore(26, 24, 25)).toEqual({ ok: true });
    expect(validateSetScore(27, 25, 25)).toEqual({ ok: true });
  });

  it("rejects a 1-point margin", () => {
    const result = validateSetScore(25, 24, 25);
    expect(result.ok).toBe(false);
  });

  it("rejects a score that never reaches the target", () => {
    const result = validateSetScore(20, 15, 25);
    expect(result.ok).toBe(false);
  });

  it("rejects negative or non-integer input", () => {
    expect(validateSetScore(-1, 10, 25).ok).toBe(false);
    expect(validateSetScore(25.5, 20, 25).ok).toBe(false);
  });
});

describe("validateMatchScore", () => {
  it("accepts a complete CLASSIC 3:2 match", () => {
    const sets = [
      set(1, 25, 20),
      set(2, 20, 25),
      set(3, 25, 18),
      set(4, 20, 25),
      set(5, 15, 10),
    ];
    expect(validateMatchScore(sets, "CLASSIC", "CHAMPIONSHIP")).toEqual({ ok: true });
  });

  it("rejects a CLASSIC match with a 4th set played after a 3:0 sweep", () => {
    const sets = [set(1, 25, 20), set(2, 25, 18), set(3, 25, 22), set(4, 25, 20)];
    expect(validateMatchScore(sets, "CLASSIC", "CHAMPIONSHIP").ok).toBe(false);
  });

  it("rejects an incomplete CLASSIC match (neither side reached 3 set wins)", () => {
    const sets = [set(1, 25, 20), set(2, 20, 25)];
    expect(validateMatchScore(sets, "CLASSIC", "CHAMPIONSHIP").ok).toBe(false);
  });

  it("accepts a complete CUSTOM match (exactly 3 sets)", () => {
    const sets = [set(1, 25, 20), set(2, 20, 25), set(3, 25, 22)];
    expect(validateMatchScore(sets, "CUSTOM", "CHAMPIONSHIP")).toEqual({ ok: true });
  });

  it("rejects a CUSTOM match with only 2 sets", () => {
    const sets = [set(1, 25, 20), set(2, 20, 25)];
    expect(validateMatchScore(sets, "CUSTOM", "CHAMPIONSHIP").ok).toBe(false);
  });

  it("rejects a CLASSIC match whose 5th set doesn't use the 15-point target", () => {
    const sets = [
      set(1, 25, 20),
      set(2, 20, 25),
      set(3, 25, 18),
      set(4, 20, 25),
      set(5, 10, 8), // never reaches the decisive set's 15-point target
    ];
    expect(validateMatchScore(sets, "CLASSIC", "CHAMPIONSHIP").ok).toBe(false);
  });
});
