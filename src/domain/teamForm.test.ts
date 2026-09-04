import { describe, expect, it } from "vitest";

import { normalizeTeamName, teamNameKey, TEAM_NAME_MAX, validateNewTeam } from "./teamForm";

describe("normalizeTeamName", () => {
  it("trims and collapses internal whitespace runs", () => {
    expect(normalizeTeamName("  Спартак   Черкаси  ")).toBe("Спартак Черкаси");
  });

  it("leaves an already-clean name untouched", () => {
    expect(normalizeTeamName("Дніпро-1")).toBe("Дніпро-1");
  });

  it("strips invisible zero-width characters", () => {
    expect(normalizeTeamName("Спартак \u200BЧеркаси")).toBe("Спартак Черкаси");
    expect(normalizeTeamName("\uFEFFСпартак Черкаси")).toBe("Спартак Черкаси");
  });

  it("NFKC-normalizes so compatible Unicode forms collapse to the same string", () => {
    // U+FF11 (fullwidth "1") NFKC-normalizes to U+0031 ("1").
    expect(normalizeTeamName("Дніпро-１")).toBe(normalizeTeamName("Дніпро-1"));
  });
});

describe("teamNameKey", () => {
  it("case-folds so differently-cased names collide", () => {
    const key = teamNameKey("Спартак Черкаси");
    expect(teamNameKey("спартак черкаси")).toBe(key);
    expect(teamNameKey("СПАРТАК ЧЕРКАСИ")).toBe(key);
  });

  it("is stable once whitespace is already collapsed by normalizeTeamName", () => {
    const a = teamNameKey(normalizeTeamName("  Спартак   Черкаси  "));
    const b = teamNameKey(normalizeTeamName("Спартак Черкаси"));
    expect(a).toBe(b);
  });
});

describe("validateNewTeam — valid input", () => {
  it("normalizes and returns the trimmed, whitespace-collapsed name plus its case-folded key", () => {
    const result = validateNewTeam({ name: "  Спартак   Черкаси  " });
    expect(result).toEqual({
      ok: true,
      value: { name: "Спартак Черкаси", nameKey: "спартак черкаси" },
    });
  });

  it("accepts a name exactly at the max length", () => {
    const name = "Т".repeat(TEAM_NAME_MAX);
    expect(validateNewTeam({ name }).ok).toBe(true);
  });
});

describe("validateNewTeam — field errors", () => {
  it("rejects empty or whitespace-only input", () => {
    for (const raw of ["", "   ", undefined, null]) {
      const result = validateNewTeam({ name: raw });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors).toHaveProperty("name");
    }
  });

  it("rejects a name over the max length", () => {
    const result = validateNewTeam({ name: "Т".repeat(TEAM_NAME_MAX + 1) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors).toHaveProperty("name");
  });

  it("every message is a non-empty Ukrainian string", () => {
    const result = validateNewTeam({ name: "" });
    if (result.ok) throw new Error("expected a validation failure");
    for (const message of Object.values(result.fieldErrors)) {
      expect(message).toMatch(/[а-яіїєґ]/i);
    }
  });
});
