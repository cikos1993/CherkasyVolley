import { describe, expect, it } from "vitest";

import { FREE_TEXT_MAX, FULL_NAME_MAX, validatePlayer } from "./playerForm";

describe("validatePlayer — valid input", () => {
  it("accepts every field filled", () => {
    const result = validatePlayer({
      fullName: "  Іван Петренко  ",
      birthDate: "1998-05-12",
      birthPlace: "Черкаси",
      sportRank: "мс",
      position: "діагональний",
      height: "195",
      weight: "88",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        fullName: "Іван Петренко",
        birthDate: "1998-05-12",
        birthPlace: "Черкаси",
        sportRank: "мс",
        position: "діагональний",
        height: "195",
        weight: "88",
      },
    });
  });

  it("accepts only fullName, leaving every optional field null", () => {
    const result = validatePlayer({ fullName: "Іван Петренко" });
    expect(result).toEqual({
      ok: true,
      value: {
        fullName: "Іван Петренко",
        birthDate: null,
        birthPlace: null,
        sportRank: null,
        position: null,
        height: null,
        weight: null,
      },
    });
  });

  it("treats whitespace-only optional fields as empty (null)", () => {
    const result = validatePlayer({ fullName: "Іван Петренко", birthPlace: "   " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.birthPlace).toBeNull();
  });

  it("accepts fields exactly at their max length", () => {
    const result = validatePlayer({
      fullName: "І".repeat(FULL_NAME_MAX),
      birthPlace: "Х".repeat(FREE_TEXT_MAX),
    });
    expect(result.ok).toBe(true);
  });
});

describe("validatePlayer — field errors", () => {
  it("rejects empty or whitespace-only fullName", () => {
    for (const raw of ["", "   ", undefined, null]) {
      const result = validatePlayer({ fullName: raw });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.fullName).toBe("Вкажіть ПІБ гравця.");
    }
  });

  it("rejects fullName over the max length", () => {
    const result = validatePlayer({ fullName: "І".repeat(FULL_NAME_MAX + 1) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.fullName).toBe(`ПІБ не довше за ${FULL_NAME_MAX} символів.`);
    }
  });

  it("rejects each optional field over its max length independently", () => {
    const fields = ["birthDate", "birthPlace", "sportRank", "position", "height", "weight"] as const;
    for (const field of fields) {
      const result = validatePlayer({ fullName: "Іван Петренко", [field]: "Х".repeat(FREE_TEXT_MAX + 1) });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors).toHaveProperty(field);
    }
  });

  it("reports every failing field at once, not just the first", () => {
    const result = validatePlayer({
      fullName: "",
      birthPlace: "Х".repeat(FREE_TEXT_MAX + 1),
      sportRank: "Х".repeat(FREE_TEXT_MAX + 1),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fieldErrors).sort()).toEqual(
        ["birthPlace", "fullName", "sportRank"].sort(),
      );
    }
  });

  it("every message is a non-empty Ukrainian string", () => {
    const result = validatePlayer({ fullName: "", weight: "Х".repeat(FREE_TEXT_MAX + 1) });
    if (result.ok) throw new Error("expected a validation failure");
    for (const message of Object.values(result.fieldErrors)) {
      expect(message).toMatch(/[а-яіїєґ]/i);
    }
  });
});
