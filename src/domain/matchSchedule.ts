/**
 * Match scheduling rules: converting between an admin's Europe/Kyiv wall-clock
 * input and the UTC instant stored on `Match.scheduledAt`, formatting that
 * instant back for display, and validating the schedule form. Pure — no
 * framework, no IO.
 *
 * Kyiv is UTC+2 in winter (EET) and UTC+3 in summer (EEST). An HTML
 * `datetime-local` value carries no zone, so the offset has to be resolved
 * per-date. `Intl.DateTimeFormat` with `timeZone: "Europe/Kyiv"` gives it
 * from the runtime's own IANA database — no timezone library (the project
 * keeps external dependencies to a minimum).
 */

import { YEAR_MAX, YEAR_MIN } from "./tournamentForm";

export const VENUE_TEXT_MAX = 120;

type RawValue = FormDataEntryValue | null | undefined;

const KYIV_PARTS_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Kyiv",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const KYIV_DISPLAY_FMT = new Intl.DateTimeFormat("uk-UA", {
  timeZone: "Europe/Kyiv",
  hourCycle: "h23",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function kyivParts(date: Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of KYIV_PARTS_FMT.formatToParts(date)) {
    if (part.type !== "literal") out[part.type] = part.value;
  }
  return out;
}

/** Europe/Kyiv's offset ahead of UTC, in minutes (120 in winter, 180 in summer), at instant `utc`. */
export function kyivOffsetMinutes(utc: Date): number {
  const p = kyivParts(utc);
  const wallAsUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  const realSeconds = Math.floor(utc.getTime() / 1000) * 1000;
  return Math.round((wallAsUtc - realSeconds) / 60000);
}

export type ParsedSchedule =
  | { ok: true; value: Date | null }
  | { ok: false; error: string };

/**
 * Interprets a `datetime-local` string as Europe/Kyiv wall-clock time and
 * returns the matching UTC `Date`. Empty input means "no time set" and
 * returns `null`. The offset is guessed from the naive instant, then
 * re-checked at the corrected instant so a value near a DST switch lands on
 * the right side of it.
 */
export function parseKyivDateTimeLocal(raw: string | null | undefined): ParsedSchedule {
  if (raw == null) return { ok: true, value: null };
  const text = raw.trim();
  if (text === "") return { ok: true, value: null };

  const match = LOCAL_RE.exec(text);
  if (!match) return { ok: false, error: "Некоректна дата або час." };

  const [, y, mo, d, h, mi, s] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = s ? Number(s) : 0;

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    return { ok: false, error: "Некоректна дата або час." };
  }
  if (year < YEAR_MIN || year > YEAR_MAX) {
    return { ok: false, error: `Рік має бути від ${YEAR_MIN} до ${YEAR_MAX}.` };
  }

  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const rollCheck = new Date(naiveUtc);
  if (
    rollCheck.getUTCFullYear() !== year ||
    rollCheck.getUTCMonth() !== month - 1 ||
    rollCheck.getUTCDate() !== day
  ) {
    return { ok: false, error: "Некоректна дата або час." };
  }

  const firstOffset = kyivOffsetMinutes(new Date(naiveUtc));
  let ts = naiveUtc - firstOffset * 60000;
  const secondOffset = kyivOffsetMinutes(new Date(ts));
  if (secondOffset !== firstOffset) ts = naiveUtc - secondOffset * 60000;

  return { ok: true, value: new Date(ts) };
}

/** The `datetime-local` value (`YYYY-MM-DDTHH:mm`) for `date` in Kyiv local time — seeds the edit input. */
export function toKyivDateTimeLocalValue(date: Date): string {
  const p = kyivParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Kyiv-local display string, e.g. "13 червня 2026 р., 11:00". */
export function formatKyivDateTime(date: Date): string {
  return KYIV_DISPLAY_FMT.format(date);
}

export interface MatchScheduleInput {
  scheduledAt: Date | null;
  venueText: string | null;
}

export type MatchScheduleFieldErrors = { scheduledAt?: string; venueText?: string };

export type MatchScheduleValidation =
  | { ok: true; value: MatchScheduleInput }
  | { ok: false; fieldErrors: MatchScheduleFieldErrors };

/**
 * Validates the schedule form. An empty datetime or venue is valid and stored
 * as `null` (not `""`), matching `Match`'s nullable columns.
 */
export function validateMatchSchedule(raw: {
  scheduledAt: RawValue;
  venueText: RawValue;
}): MatchScheduleValidation {
  const fieldErrors: MatchScheduleFieldErrors = {};

  const parsed = parseKyivDateTimeLocal(typeof raw.scheduledAt === "string" ? raw.scheduledAt : null);
  let scheduledAt: Date | null = null;
  if (parsed.ok) scheduledAt = parsed.value;
  else fieldErrors.scheduledAt = parsed.error;

  let venueText: string | null = null;
  const venue = raw.venueText == null ? "" : String(raw.venueText).trim();
  if (venue.length > VENUE_TEXT_MAX) {
    fieldErrors.venueText = `Місце проведення — не довше за ${VENUE_TEXT_MAX} символів.`;
  } else if (venue !== "") {
    venueText = venue;
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, value: { scheduledAt, venueText } };
}
