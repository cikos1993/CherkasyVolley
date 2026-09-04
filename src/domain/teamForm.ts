/**
 * Rules for the "add team" form: a single required name, normalized for
 * display and for uniqueness. Pure — no framework, no IO.
 */

export const TEAM_NAME_MAX = 120;

/** The one form field. Kept separate from `NewTeamInput` — `nameKey` is a
 * derived value, never a form field, and must not appear in `FieldErrors`. */
export type TeamField = "name";
export type FieldErrors = Partial<Record<TeamField, string>>;

export interface NewTeamInput {
  /** Trimmed, whitespace-collapsed display value. */
  name: string;
  /** Case-folded dedup key, derived from `name`. */
  nameKey: string;
}

export type NewTeamValidation =
  | { ok: true; value: NewTeamInput }
  | { ok: false; fieldErrors: FieldErrors };

type RawValue = FormDataEntryValue | null | undefined;
export type RawTeamInput = Partial<Record<TeamField, RawValue>>;

/** Trims and collapses internal whitespace runs to a single space. */
export function normalizeTeamName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Case-folds an already-normalized name into its dedup key. */
export function teamNameKey(normalizedName: string): string {
  return normalizedName.toLowerCase();
}

export function validateNewTeam(raw: RawTeamInput): NewTeamValidation {
  const fieldErrors: FieldErrors = {};

  const name = normalizeTeamName(raw.name == null ? "" : String(raw.name));
  if (name === "") fieldErrors.name = "Вкажіть назву команди.";
  else if (name.length > TEAM_NAME_MAX) {
    fieldErrors.name = `Назва не довша за ${TEAM_NAME_MAX} символів.`;
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  return { ok: true, value: { name, nameKey: teamNameKey(name) } };
}
