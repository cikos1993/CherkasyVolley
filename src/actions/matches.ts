"use server";

import { revalidatePath } from "next/cache";

import { toActionError, type ActionResult } from "@/actions/result";
import { AdminRequiredError, requireAdmin } from "@/auth/requireAdmin";
import {
  createMatchResult,
  deleteMatchResult,
  getMatchForResult,
  replaceMatchResult,
  updateMatchSchedule,
} from "@/data/matches";
import { getTournamentForAdmin } from "@/data/tournaments";
import { validateMatchSchedule, type MatchScheduleFieldErrors } from "@/domain/matchSchedule";
import type { SetScore } from "@/domain/scoring";
import type { Discipline, ScoringPreset, TournamentType } from "@/domain/tournamentForm";
import { MATCH_SETS_MAX, validateMatchScore } from "@/domain/validation";

export type MatchScheduleFormState = {
  fieldErrors?: MatchScheduleFieldErrors;
  formError?: string;
};

export type MatchResultFormState = {
  setErrors?: Record<number, string>;
  formError?: string;
};

// A volleyball set score is at most two digits in practice; the cap also keeps
// an over-long digit string from parsing to a value that overflows the int4
// `SetScore` columns. The set-count decision is left to `validateMatchScore`.
const SCORE_TOKEN = /^\d{1,3}$/;

type ParsedSets = { ok: true; sets: SetScore[] } | { ok: false; state: MatchResultFormState };

/** Reads `home-N` / `away-N` pairs from the form into a contiguous set list. */
function parseSetsFromForm(formData: FormData): ParsedSets {
  const setErrors: Record<number, string> = {};
  const present: number[] = [];
  const raw: { setNo: number; home: string; away: string }[] = [];

  for (let setNo = 1; setNo <= MATCH_SETS_MAX; setNo++) {
    const home = String(formData.get(`home-${setNo}`) ?? "").trim();
    const away = String(formData.get(`away-${setNo}`) ?? "").trim();
    if (home === "" && away === "") continue;
    present.push(setNo);
    raw.push({ setNo, home, away });
  }

  if (present.some((setNo, index) => setNo !== index + 1)) {
    return { ok: false, state: { formError: "Заповніть партії по порядку, без пропусків." } };
  }

  const sets: SetScore[] = [];
  for (const { setNo, home, away } of raw) {
    if (!SCORE_TOKEN.test(home) || !SCORE_TOKEN.test(away)) {
      setErrors[setNo] = "Вкажіть рахунок партії цілим невідʼємним числом.";
      continue;
    }
    sets.push({ setNo, homePoints: Number(home), awayPoints: Number(away) });
  }

  if (Object.keys(setErrors).length > 0) return { ok: false, state: { setErrors } };
  // An empty list is valid to parse — `validateMatchScore` produces the
  // preset-correct "not enough sets" message.
  return { ok: true, sets };
}

/**
 * Parses the form and runs the sole validator. A set-specific
 * `validateMatchScore` message ("Партія N: …") is mapped back under that set's
 * row; anything else is a form-level error. Shared by `enterMatchResult` and
 * `editMatchResult`.
 */
function parseAndValidate(
  formData: FormData,
  preset: ScoringPreset,
  tournamentType: TournamentType,
): ParsedSets {
  const parsed = parseSetsFromForm(formData);
  if (!parsed.ok) return parsed;

  const check = validateMatchScore(parsed.sets, preset, tournamentType);
  if (check.ok) return parsed;

  const setSpecific = /^Партія (\d+): (.+)$/.exec(check.message);
  return {
    ok: false,
    state: setSpecific
      ? { setErrors: { [Number(setSpecific[1])]: setSpecific[2] } }
      : { formError: check.message },
  };
}

/** Revalidates every surface a match result appears on. */
function revalidateMatchSurfaces(discipline: Discipline, tournamentId: string, matchId: string) {
  const publicRoot = discipline === "BEACH" ? "/beach" : "/classic";
  revalidatePath(`${publicRoot}/${tournamentId}`);
  revalidatePath(`/admin/tournaments/${tournamentId}/schedule`);
  revalidatePath(`/admin/tournaments/${tournamentId}/matches/${matchId}`);
  revalidatePath(`/admin/tournaments/${tournamentId}`);
}

/** Sets a group match's planned date/time and venue. Leaves any recorded result untouched. */
export async function scheduleMatch(
  tournamentId: string,
  matchId: string,
  _prev: MatchScheduleFormState,
  formData: FormData,
): Promise<MatchScheduleFormState> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminRequiredError) {
      return { formError: "Потрібні права адміністратора." };
    }
    throw error;
  }

  const tournament = await getTournamentForAdmin(tournamentId);
  if (!tournament) {
    return { formError: "Турнір не знайдено." };
  }

  const parsed = validateMatchSchedule({
    scheduledAt: formData.get("scheduledAt"),
    venueText: formData.get("venueText"),
  });
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

  const { count } = await updateMatchSchedule(tournamentId, matchId, parsed.value);
  if (count === 0) {
    return { formError: "Матч не знайдено." };
  }

  revalidatePath(`/admin/tournaments/${tournamentId}/schedule`);
  revalidatePath(`/${tournament.discipline === "BEACH" ? "beach" : "classic"}/${tournamentId}`);
  return {};
}

/**
 * Records a group match's result by set score. Validation is entirely
 * `src/domain/validation.ts`'s `validateMatchScore` — a set-specific message
 * ("Партія N: …") is mapped back under that set's row, anything else is a
 * form-level error. First-entry only; a match that already has a result is
 * refused (editing is Story 3.7).
 *
 * No `Tournament.state` guard: a group result is enterable in any state, the
 * same latitude `scheduleMatch` / `players.ts` take. Reaching `PLAYOFF` with an
 * unfilled group match is prevented upstream by the `allGroupMatchesPlayed`
 * precondition on the `GROUP_STAGE → PLAYOFF` transition (Story 4.2).
 */
export async function enterMatchResult(
  tournamentId: string,
  matchId: string,
  _prev: MatchResultFormState,
  formData: FormData,
): Promise<MatchResultFormState> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminRequiredError) {
      return { formError: "Потрібні права адміністратора." };
    }
    throw error;
  }

  const match = await getMatchForResult(tournamentId, matchId);
  if (!match) {
    return { formError: "Матч не знайдено." };
  }
  if (match.stage !== "GROUP") {
    return { formError: "Результат можна вносити лише для матчів групового етапу." };
  }
  if (match.sets.length > 0) {
    return { formError: "Результат уже внесено." };
  }

  const parsed = parseAndValidate(formData, match.tournament.scoringPreset, match.tournament.type);
  if (!parsed.ok) return parsed.state;

  const saved = await createMatchResult(tournamentId, matchId, parsed.sets);
  if (!saved.ok) {
    return {
      formError:
        saved.reason === "exists"
          ? "Результат уже внесено."
          : "Матч більше не існує — можливо, проведено пережеребкування. Оновіть сторінку.",
    };
  }

  revalidateMatchSurfaces(match.tournament.discipline, tournamentId, matchId);
  return {};
}

/**
 * Replaces a group match's recorded result (Story 3.7). Same validation and
 * revalidation as `enterMatchResult`; requires a result to already exist (the
 * create path handles a fresh match). No `Tournament.state` guard — a
 * `COMPLETED` lock on result editing is FR-7 / Story 4.5.
 */
export async function editMatchResult(
  tournamentId: string,
  matchId: string,
  _prev: MatchResultFormState,
  formData: FormData,
): Promise<MatchResultFormState> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminRequiredError) {
      return { formError: "Потрібні права адміністратора." };
    }
    throw error;
  }

  const match = await getMatchForResult(tournamentId, matchId);
  if (!match) {
    return { formError: "Матч не знайдено." };
  }
  if (match.stage !== "GROUP") {
    return { formError: "Результат можна вносити лише для матчів групового етапу." };
  }
  if (match.sets.length === 0) {
    return { formError: "Результат ще не внесено." };
  }

  const parsed = parseAndValidate(formData, match.tournament.scoringPreset, match.tournament.type);
  if (!parsed.ok) return parsed.state;

  const saved = await replaceMatchResult(tournamentId, matchId, parsed.sets);
  if (!saved.ok) {
    return {
      formError: "Матч більше не існує — можливо, проведено пережеребкування. Оновіть сторінку.",
    };
  }

  revalidateMatchSurfaces(match.tournament.discipline, tournamentId, matchId);
  return {};
}

/**
 * Deletes a group match's recorded result (Story 3.7) — the match returns to
 * "not played" and the standings recompute on the next read. `ActionResult`
 * shape (a confirm-button action, not a form), the `removePlayer` template.
 */
export async function removeMatchResult(
  tournamentId: string,
  matchId: string,
): Promise<ActionResult<undefined>> {
  try {
    await requireAdmin();

    const match = await getMatchForResult(tournamentId, matchId);
    if (!match || match.stage !== "GROUP") {
      return { ok: false, code: "NOT_FOUND", message: "Матч не знайдено." };
    }

    const { count } = await deleteMatchResult(tournamentId, matchId);
    if (count === 0) {
      return { ok: false, code: "NOT_FOUND", message: "Результат уже видалено." };
    }

    revalidateMatchSurfaces(match.tournament.discipline, tournamentId, matchId);
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
