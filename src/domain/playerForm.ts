/**
 * Rules for the roster (player) form: one required full name, six optional
 * free-text fields. Pure — no framework, no IO.
 */

export const FULL_NAME_MAX = 120;
export const FREE_TEXT_MAX = 60;

export interface PlayerInput {
  fullName: string;
  birthDate: string | null;
  birthPlace: string | null;
  sportRank: string | null;
  position: string | null;
  height: string | null;
  weight: string | null;
}

export type PlayerField = keyof PlayerInput;
export type FieldErrors = Partial<Record<PlayerField, string>>;

export type PlayerValidation =
  | { ok: true; value: PlayerInput }
  | { ok: false; fieldErrors: FieldErrors };

type RawValue = FormDataEntryValue | null | undefined;
export type RawPlayerInput = Partial<Record<PlayerField, RawValue>>;

const OPTIONAL_FIELDS = [
  "birthDate",
  "birthPlace",
  "sportRank",
  "position",
  "height",
  "weight",
] as const satisfies readonly PlayerField[];

const OPTIONAL_FIELD_LABELS: Record<(typeof OPTIONAL_FIELDS)[number], string> = {
  birthDate: "Дата народження",
  birthPlace: "Місце народження",
  sportRank: "Спортивний розряд",
  position: "Амплуа",
  height: "Зріст",
  weight: "Вага",
};

function trimmed(raw: RawValue): string {
  return raw == null ? "" : String(raw).trim();
}

export function validatePlayer(raw: RawPlayerInput): PlayerValidation {
  const fieldErrors: FieldErrors = {};

  const fullName = trimmed(raw.fullName);
  if (fullName === "") fieldErrors.fullName = "Вкажіть ПІБ гравця.";
  else if (fullName.length > FULL_NAME_MAX) {
    fieldErrors.fullName = `ПІБ не довше за ${FULL_NAME_MAX} символів.`;
  }

  const optional: Record<(typeof OPTIONAL_FIELDS)[number], string | null> = {
    birthDate: null,
    birthPlace: null,
    sportRank: null,
    position: null,
    height: null,
    weight: null,
  };

  for (const field of OPTIONAL_FIELDS) {
    const value = trimmed(raw[field]);
    if (value === "") {
      optional[field] = null;
    } else if (value.length > FREE_TEXT_MAX) {
      fieldErrors[field] = `${OPTIONAL_FIELD_LABELS[field]} — не довше за ${FREE_TEXT_MAX} символів.`;
    } else {
      optional[field] = value;
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  return { ok: true, value: { fullName, ...optional } };
}
