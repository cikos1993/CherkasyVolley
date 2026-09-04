/**
 * Rules for the "create tournament" form: which tournament types a discipline
 * allows, the numeric bounds, and a single validator that turns raw form values
 * into a typed tournament draft or a map of per-field errors.
 *
 * Pure — no framework, no IO. The unions below must stay identical to the enums
 * in `prisma/schema.prisma`.
 */

/** Must stay identical to the `TournamentState` enum in `src/domain/tournamentState.ts`. */
type TournamentState = "DRAFT" | "GROUP_STAGE" | "PLAYOFF" | "COMPLETED";

export type Discipline = "CLASSIC" | "BEACH";
export type TournamentType = "CHAMPIONSHIP" | "VETERAN" | "WOMEN" | "YOUTH";
export type ScoringPreset = "CLASSIC" | "CUSTOM";

export const TOURNAMENT_TYPES = [
  "CHAMPIONSHIP",
  "VETERAN",
  "WOMEN",
  "YOUTH",
] as const satisfies readonly TournamentType[];

export const SCORING_PRESETS = ["CLASSIC", "CUSTOM"] as const satisfies readonly ScoringPreset[];

/**
 * v1 has data only for CLASSIC (AD-9). BEACH is representable in the type but
 * has no create path, so it offers no types.
 */
export function allowedTournamentTypes(discipline: Discipline): readonly TournamentType[] {
  return discipline === "CLASSIC" ? TOURNAMENT_TYPES : [];
}

export const YEAR_MIN = 2000;
export const YEAR_MAX = 2100;
export const TEAM_COUNT_MIN = 4;
export const TEAM_COUNT_MAX = 64;
export const ROUNDS_MIN = 1;
export const ROUNDS_MAX = 10;
export const NAME_MAX = 120;

export interface NewTournamentInput {
  discipline: Discipline;
  type: TournamentType;
  name: string;
  year: number;
  scoringPreset: ScoringPreset;
  teamCount: number;
  rounds: number;
}

export type TournamentField = keyof NewTournamentInput;
export type FieldErrors = Partial<Record<TournamentField, string>>;

export type NewTournamentValidation =
  | { ok: true; value: NewTournamentInput }
  | { ok: false; fieldErrors: FieldErrors };

type RawValue = FormDataEntryValue | null | undefined;
export type RawTournamentInput = Partial<Record<TournamentField, RawValue>>;

/** Parses a form value as an integer, or null if it is missing / not an integer. */
function toInteger(raw: RawValue): number | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!/^-?\d+$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) ? n : null;
}

function inRange(n: number | null, min: number, max: number): n is number {
  return n !== null && n >= min && n <= max;
}

/**
 * Group-stage sizing (`teamCount` / `rounds`) is editable only while the
 * tournament is `DRAFT` (Story 2.5 AC 2). Outside `DRAFT`, discard whatever
 * was submitted and keep the tournament's current values — this is the
 * server-side half of the lock the edit form also renders as disabled
 * inputs, and is independent of what a request actually submits.
 */
export function resolveGroupStageFields(
  state: TournamentState,
  submitted: { teamCount: RawValue; rounds: RawValue },
  current: { teamCount: number; rounds: number },
): { teamCount: RawValue; rounds: RawValue } {
  if (state === "DRAFT") return submitted;
  return { teamCount: String(current.teamCount), rounds: String(current.rounds) };
}

export function validateNewTournament(raw: RawTournamentInput): NewTournamentValidation {
  const fieldErrors: FieldErrors = {};

  const discipline =
    raw.discipline === "CLASSIC" || raw.discipline === "BEACH" ? raw.discipline : null;
  if (discipline === null) fieldErrors.discipline = "Невідома дисципліна.";

  const typeText = raw.type == null ? "" : String(raw.type);
  const allowed = allowedTournamentTypes(discipline ?? "CLASSIC");
  const type = allowed.includes(typeText as TournamentType) ? (typeText as TournamentType) : null;
  if (type === null) fieldErrors.type = "Оберіть тип турніру.";

  const name = (raw.name == null ? "" : String(raw.name)).trim();
  if (name === "") fieldErrors.name = "Вкажіть назву турніру.";
  else if (name.length > NAME_MAX) fieldErrors.name = `Назва не довша за ${NAME_MAX} символів.`;

  const year = toInteger(raw.year);
  if (!inRange(year, YEAR_MIN, YEAR_MAX)) {
    fieldErrors.year = `Рік має бути від ${YEAR_MIN} до ${YEAR_MAX}.`;
  }

  const scoringPreset =
    raw.scoringPreset === "CLASSIC" || raw.scoringPreset === "CUSTOM" ? raw.scoringPreset : null;
  if (scoringPreset === null) fieldErrors.scoringPreset = "Оберіть систему очок.";

  const teamCount = toInteger(raw.teamCount);
  if (!inRange(teamCount, TEAM_COUNT_MIN, TEAM_COUNT_MAX)) {
    fieldErrors.teamCount = `Кількість команд — від ${TEAM_COUNT_MIN} до ${TEAM_COUNT_MAX}.`;
  }

  const rounds = toInteger(raw.rounds);
  if (!inRange(rounds, ROUNDS_MIN, ROUNDS_MAX)) {
    fieldErrors.rounds = `Кількість кіл — від ${ROUNDS_MIN} до ${ROUNDS_MAX}.`;
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  return {
    ok: true,
    value: {
      discipline: discipline as Discipline,
      type: type as TournamentType,
      name,
      year: year as number,
      scoringPreset: scoringPreset as ScoringPreset,
      teamCount: teamCount as number,
      rounds: rounds as number,
    },
  };
}
