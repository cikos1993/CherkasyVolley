import { describe, expect, it } from "vitest";

import {
  formatKyivDateTime,
  kyivOffsetMinutes,
  parseKyivDateTimeLocal,
  toKyivDateTimeLocalValue,
  validateMatchSchedule,
  VENUE_TEXT_MAX,
} from "./matchSchedule";

describe("kyivOffsetMinutes", () => {
  it("is +120 in winter (EET)", () => {
    expect(kyivOffsetMinutes(new Date("2026-01-15T12:00:00Z"))).toBe(120);
  });

  it("is +180 in summer (EEST)", () => {
    expect(kyivOffsetMinutes(new Date("2026-07-15T12:00:00Z"))).toBe(180);
  });
});

describe("parseKyivDateTimeLocal", () => {
  it("treats empty / nullish as no time set", () => {
    expect(parseKyivDateTimeLocal(null)).toEqual({ ok: true, value: null });
    expect(parseKyivDateTimeLocal(undefined)).toEqual({ ok: true, value: null });
    expect(parseKyivDateTimeLocal("")).toEqual({ ok: true, value: null });
    expect(parseKyivDateTimeLocal("   ")).toEqual({ ok: true, value: null });
  });

  it("interprets a summer wall-clock time as EEST", () => {
    const parsed = parseKyivDateTimeLocal("2026-07-13T11:00");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value?.toISOString()).toBe("2026-07-13T08:00:00.000Z");
  });

  it("interprets a winter wall-clock time as EET", () => {
    const parsed = parseKyivDateTimeLocal("2026-01-13T11:00");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value?.toISOString()).toBe("2026-01-13T09:00:00.000Z");
  });

  it("resolves a time just before the spring-forward switch on the winter side", () => {
    // 2026-03-29 01:00 Kyiv is still EET (+2); the switch is at 03:00 local.
    const parsed = parseKyivDateTimeLocal("2026-03-29T01:00");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value?.toISOString()).toBe("2026-03-28T23:00:00.000Z");
  });

  it("resolves a time just after the autumn fall-back switch on the winter side", () => {
    const parsed = parseKyivDateTimeLocal("2026-10-25T05:00");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value?.toISOString()).toBe("2026-10-25T03:00:00.000Z");
  });

  it("does not throw on the nonexistent spring-forward hour", () => {
    expect(parseKyivDateTimeLocal("2026-03-29T03:30").ok).toBe(true);
  });

  it("accepts an optional seconds component", () => {
    const parsed = parseKyivDateTimeLocal("2026-07-13T11:00:30");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value?.toISOString()).toBe("2026-07-13T08:00:30.000Z");
  });

  it("rejects a malformed string", () => {
    for (const bad of ["13.07.2026 11:00", "2026-07-13", "not a date", "2026-13-01T00:00"]) {
      expect(parseKyivDateTimeLocal(bad)).toEqual({ ok: false, error: "Некоректна дата або час." });
    }
  });

  it("rejects an impossible calendar date", () => {
    expect(parseKyivDateTimeLocal("2026-02-30T10:00").ok).toBe(false);
  });
});

describe("toKyivDateTimeLocalValue", () => {
  it("round-trips through parseKyivDateTimeLocal at minute precision", () => {
    for (const local of [
      "2026-01-13T11:00",
      "2026-07-13T11:00",
      "2026-03-29T05:00",
      "2026-10-25T05:00",
      "2026-12-31T23:59",
    ]) {
      const parsed = parseKyivDateTimeLocal(local);
      expect(parsed.ok).toBe(true);
      if (parsed.ok && parsed.value) expect(toKyivDateTimeLocalValue(parsed.value)).toBe(local);
    }
  });
});

describe("formatKyivDateTime", () => {
  it("renders the Kyiv-local date and time in Ukrainian", () => {
    const text = formatKyivDateTime(new Date("2026-07-13T08:00:00Z"));
    expect(text).toContain("2026");
    expect(text).toContain("13");
    expect(text).toContain("липня");
    expect(text).toContain("11:00");
  });
});

describe("validateMatchSchedule", () => {
  it("accepts a valid datetime and venue", () => {
    const result = validateMatchSchedule({ scheduledAt: "2026-07-13T11:00", venueText: "  СК «Спартак»  " });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.scheduledAt?.toISOString()).toBe("2026-07-13T08:00:00.000Z");
      expect(result.value.venueText).toBe("СК «Спартак»");
    }
  });

  it("stores an empty datetime and venue as null", () => {
    const result = validateMatchSchedule({ scheduledAt: "", venueText: "   " });
    expect(result).toEqual({ ok: true, value: { scheduledAt: null, venueText: null } });
  });

  it("reports a malformed datetime as a field error", () => {
    const result = validateMatchSchedule({ scheduledAt: "13/07/2026", venueText: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.scheduledAt).toBeTruthy();
  });

  it("rejects an over-long venue", () => {
    const result = validateMatchSchedule({ scheduledAt: null, venueText: "х".repeat(VENUE_TEXT_MAX + 1) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.venueText).toContain(String(VENUE_TEXT_MAX));
  });
});
