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
import { readPlayoffMatchStates, savePlayoffAdvancement } from "@/data/playoff";
import { getTournamentForAdmin } from "@/data/tournaments";
import { checkCanEditSemifinalResult, type PlayoffResultEditCheck } from "@/domain/bracket";
import { validateMatchSchedule, type MatchScheduleFieldErrors } from "@/domain/matchSchedule";
import type { SetScore } from "@/domain/scoring";
import type { Discipline, ScoringPreset, TournamentType } from "@/domain/tournamentForm";
import { checkCanEditResults, type TournamentState } from "@/domain/tournamentState";
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

/**
 * After a semifinal result is entered, edited, or removed, re-derive the final
 * and third-place pairings (AD-5, "on write"). The `SetScore` write has
 * already committed; a failure here is logged and swallowed — the render path
 * re-runs `advanceBracket`, and the next result mutation retries this.
 */
async function advancePlayoffAfterSemifinal(stage: string, tournamentId: string) {
  if (stage !== "SEMIFINAL") return;
  try {
    await savePlayoffAdvancement(tournamentId);
  } catch (error) {
    console.error("savePlayoffAdvancement failed after a semifinal result", error);
  }
}

/**
 * Guards entering, correcting, or removing a semifinal result: once the final
 * or the third-place match has its own result, re-deriving the other from a
 * changed semifinal could place one team in two positions. A no-op (no query)
 * for any other stage.
 */
async function checkSemifinalResultEditable(
  stage: string,
  tournamentId: string,
): Promise<PlayoffResultEditCheck> {
  if (stage !== "SEMIFINAL") return { ok: true };
  return checkCanEditSemifinalResult(await readPlayoffMatchStates(tournamentId));
}

/**
 * Blocks entering / correcting / removing a result (or changing a schedule)
 * once the tournament is `COMPLETED` (FR-7 — its results are frozen). Server
 * enforcement; the UI also disables the controls (NFR-1: the button state is
 * not the control).
 */
function assertResultsEditable(state: TournamentState) {
  return checkCanEditResults(state);
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

  const editable = assertResultsEditable(tournament.state);
  if (!editable.ok) {
    return { formError: editable.message };
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
 * Records a match's result by set score — group or playoff (Story 4.3).
 * Validation is entirely `src/domain/validation.ts`'s `validateMatchScore` — a
 * set-specific message ("Партія N: …") is mapped back under that set's row,
 * anything else is a form-level error. First-entry only; a match that already
 * has a result is refused (editing is `editMatchResult`). A semifinal is
 * refused once a downstream match has a result (`checkCanEditSemifinalResult` —
 * unreachable through the gated paths, but defensive); otherwise, when the
 * match is a semifinal, the final / third-place pairings are re-derived
 * afterwards.
 *
 * Refused once the tournament is `COMPLETED` (`checkCanEditResults` — FR-7):
 * a completed tournament's results are frozen. Enterable in every earlier state.
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
  if (match.stage !== "GROUP" && (!match.homeEntry || !match.awayEntry)) {
    return { formError: "Учасників матчу ще не визначено." };
  }
  if (match.sets.length > 0) {
    return { formError: "Результат уже внесено." };
  }

  const editable = assertResultsEditable(match.tournament.state);
  if (!editable.ok) {
    return { formError: editable.message };
  }

  const gate = await checkSemifinalResultEditable(match.stage, tournamentId);
  if (!gate.ok) {
    return { formError: gate.message };
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

  await advancePlayoffAfterSemifinal(match.stage, tournamentId);
  revalidateMatchSurfaces(match.tournament.discipline, tournamentId, matchId);
  return {};
}

/**
 * Replaces a match's recorded result (group or playoff). Same validation and
 * revalidation as `enterMatchResult`; requires a result to already exist. A
 * semifinal edit re-derives the downstream pairings (only those not yet
 * played — the freeze rule lives in `advanceBracket`), and is refused once a
 * downstream match has been played (`checkCanEditSemifinalResult`). Refused
 * once the tournament is `COMPLETED` (`checkCanEditResults` — FR-7).
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
  if (match.sets.length === 0) {
    return { formError: "Результат ще не внесено." };
  }

  const editable = assertResultsEditable(match.tournament.state);
  if (!editable.ok) {
    return { formError: editable.message };
  }

  const gate = await checkSemifinalResultEditable(match.stage, tournamentId);
  if (!gate.ok) {
    return { formError: gate.message };
  }

  const parsed = parseAndValidate(formData, match.tournament.scoringPreset, match.tournament.type);
  if (!parsed.ok) return parsed.state;

  const saved = await replaceMatchResult(tournamentId, matchId, parsed.sets);
  if (!saved.ok) {
    return {
      formError: "Матч більше не існує — можливо, проведено пережеребкування. Оновіть сторінку.",
    };
  }

  await advancePlayoffAfterSemifinal(match.stage, tournamentId);
  revalidateMatchSurfaces(match.tournament.discipline, tournamentId, matchId);
  return {};
}

/**
 * Deletes a match's recorded result (group or playoff) — the match returns to
 * "not played" and the standings / bracket recompute on the next read. A
 * semifinal deletion clears any downstream pairing that was derived from it,
 * and is refused once a downstream match has been played
 * (`checkCanEditSemifinalResult`) or once the tournament is `COMPLETED`
 * (`checkCanEditResults` — FR-7). `ActionResult` shape (a confirm-button
 * action), the `removePlayer` template.
 */
export async function removeMatchResult(
  tournamentId: string,
  matchId: string,
): Promise<ActionResult<undefined>> {
  try {
    await requireAdmin();

    const match = await getMatchForResult(tournamentId, matchId);
    if (!match) {
      return { ok: false, code: "NOT_FOUND", message: "Матч не знайдено." };
    }

    const editable = assertResultsEditable(match.tournament.state);
    if (!editable.ok) {
      return { ok: false, code: "PRECONDITION_FAILED", message: editable.message };
    }

    const gate = await checkSemifinalResultEditable(match.stage, tournamentId);
    if (!gate.ok) {
      return { ok: false, code: "PRECONDITION_FAILED", message: gate.message };
    }

    const { count } = await deleteMatchResult(tournamentId, matchId);
    if (count === 0) {
      return { ok: false, code: "NOT_FOUND", message: "Результат уже видалено." };
    }

    await advancePlayoffAfterSemifinal(match.stage, tournamentId);
    revalidateMatchSurfaces(match.tournament.discipline, tournamentId, matchId);
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
