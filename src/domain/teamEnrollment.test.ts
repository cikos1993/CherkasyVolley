import { describe, expect, it } from "vitest";

import { checkCanEnroll, checkCanRemoveEntry } from "./teamEnrollment";

describe("checkCanEnroll", () => {
  it("allows enrollment while DRAFT and under capacity", () => {
    expect(checkCanEnroll("DRAFT", 0, 6)).toEqual({ ok: true });
    expect(checkCanEnroll("DRAFT", 5, 6)).toEqual({ ok: true });
  });

  it("rejects outside DRAFT, regardless of capacity", () => {
    for (const state of ["GROUP_STAGE", "PLAYOFF", "COMPLETED"] as const) {
      const result = checkCanEnroll(state, 0, 6);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/[а-яіїєґ]/i);
    }
  });

  it("rejects at capacity and beyond, naming the limit", () => {
    const atCapacity = checkCanEnroll("DRAFT", 6, 6);
    expect(atCapacity.ok).toBe(false);
    if (!atCapacity.ok) expect(atCapacity.message).toBe("Вже заявлено максимальну кількість команд (6).");

    expect(checkCanEnroll("DRAFT", 7, 6).ok).toBe(false);
  });

  it("checks state before capacity", () => {
    // Full AND wrong state — the state message wins, matching the AC's
    // primary gate (state) over the secondary one (capacity).
    const result = checkCanEnroll("GROUP_STAGE", 6, 6);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("Чернетка");
  });
});

describe("checkCanRemoveEntry", () => {
  it("allows cancellation while DRAFT", () => {
    expect(checkCanRemoveEntry("DRAFT")).toEqual({ ok: true });
  });

  it("rejects outside DRAFT", () => {
    for (const state of ["GROUP_STAGE", "PLAYOFF", "COMPLETED"] as const) {
      const result = checkCanRemoveEntry(state);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/[а-яіїєґ]/i);
    }
  });
});
