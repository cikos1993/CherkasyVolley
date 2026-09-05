import { describe, expect, it } from "vitest";

import { checkCanRedraw } from "./redraw";

describe("checkCanRedraw", () => {
  it("allows a redraw while GROUP_STAGE with no results yet", () => {
    expect(checkCanRedraw("GROUP_STAGE", false)).toEqual({ ok: true });
  });

  it("rejects outside GROUP_STAGE, regardless of results", () => {
    for (const state of ["DRAFT", "PLAYOFF", "COMPLETED"] as const) {
      const result = checkCanRedraw(state, false);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/[а-яіїєґ]/i);
    }
  });

  it("rejects once a result exists", () => {
    const result = checkCanRedraw("GROUP_STAGE", true);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("результат");
  });

  it("checks state before results", () => {
    // Wrong state AND a result already exists — the state message wins,
    // matching checkCanEnroll's precedent (primary gate before secondary).
    const result = checkCanRedraw("DRAFT", true);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("Груповий етап");
  });
});
