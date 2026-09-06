"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { toActionError, type ActionResult } from "@/actions/result";
import { AdminRequiredError, requireAdmin } from "@/auth/requireAdmin";
import { isRecordNotFound, isUniqueViolation } from "@/data/errors";
import { countTournamentEntries } from "@/data/entries";
import { finalAndThirdPlacePlayed } from "@/data/matches";
import {
  createTournamentRecord,
  deleteTournamentRecord,
  getTournamentForAdmin,
  setTournamentState,
  TOURNAMENT_NATURAL_KEY_INDEX,
  updateTournamentRecord,
} from "@/data/tournaments";
import {
  checkTransition,
  type TournamentState,
  type TransitionContext,
} from "@/domain/tournamentState";
import {
  resolveGroupStageFields,
  validateNewTournament,
  type TournamentField,
} from "@/domain/tournamentForm";

/**
 * The only sanctioned way to change `Tournament.state`. Validates the transition
 * (edge + precondition) through `src/domain/tournamentState` before writing.
 */
export async function transitionTournament(
  tournamentId: string,
  targetState: TournamentState,
): Promise<ActionResult<{ state: TournamentState }>> {
  try {
    await requireAdmin();

    const tournament = await getTournamentForAdmin(tournamentId);
    if (!tournament) {
      return { ok: false, code: "NOT_FOUND", message: "Турнір не знайдено." };
    }

    const context: TransitionContext = {};
    if (targetState === "GROUP_STAGE") {
      context.entryCount = await countTournamentEntries(tournamentId);
      context.teamCount = tournament.teamCount;
    }
    if (targetState === "COMPLETED") {
      context.finalAndThirdPlacePlayed = await finalAndThirdPlacePlayed(tournamentId);
    }

    const check = checkTransition(tournament.state, targetState, context);
    if (!check.ok) {
      return { ok: false, code: check.code, message: check.message };
    }

    await setTournamentState(tournamentId, targetState);

    // Refresh every surface the transition changes: the public discipline list
    // and the per-tournament page (the «Плейоф» tab, the «Турнір завершено»
    // banner), the admin tournament list + schedule page, and the archive once
    // a tournament is completed.
    const publicRoot = tournament.discipline === "BEACH" ? "/beach" : "/classic";
    revalidatePath(publicRoot);
    revalidatePath(`${publicRoot}/${tournamentId}`);
    if (targetState === "COMPLETED") revalidatePath("/archive");
    revalidatePath("/admin/tournaments");
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    revalidatePath(`/admin/tournaments/${tournamentId}/schedule`);
    // Every open match screen — its edit/entry affordances flip once COMPLETED.
    revalidatePath("/admin/tournaments/[id]/matches/[matchId]", "page");

    return { ok: true, data: { state: targetState } };
  } catch (error) {
    return toActionError(error);
  }
}

export type CreateTournamentState = {
  fieldErrors?: Partial<Record<TournamentField, string>>;
  formError?: string;
};

export async function createTournament(
  _prev: CreateTournamentState,
  formData: FormData,
): Promise<CreateTournamentState> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminRequiredError) {
      return { formError: "Потрібні права адміністратора." };
    }
    throw error;
  }

  const parsed = validateNewTournament({
    discipline: "CLASSIC",
    type: formData.get("type"),
    name: formData.get("name"),
    year: formData.get("year"),
    scoringPreset: formData.get("scoringPreset"),
    teamCount: formData.get("teamCount"),
    rounds: formData.get("rounds"),
  });
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

  let id: string;
  try {
    ({ id } = await createTournamentRecord(parsed.value));
  } catch (error) {
    if (isUniqueViolation(error, TOURNAMENT_NATURAL_KEY_INDEX)) {
      return { formError: "Турнір з такою назвою вже існує за цей рік." };
    }
    throw error;
  }

  revalidatePath("/admin/tournaments");
  redirect(`/admin/tournaments/${id}`);
}

/**
 * Edits an existing tournament. Blocked entirely once `COMPLETED` (FR-7 — an
 * archived tournament is frozen, `scoringPreset` especially: it drives how the
 * public standings recompute). Otherwise `type` / `name` / `year` /
 * `scoringPreset` are editable; `teamCount` / `rounds` are substituted from the
 * tournament's current DB values whenever `state !== "DRAFT"` — the fields the
 * form disables are re-enforced here regardless of what a forged request submits.
 */
export async function updateTournament(
  tournamentId: string,
  _prev: CreateTournamentState,
  formData: FormData,
): Promise<CreateTournamentState> {
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
  if (tournament.state === "COMPLETED") {
    return { formError: "Турнір завершено — його дані редагувати не можна." };
  }

  const { teamCount, rounds } = resolveGroupStageFields(
    tournament.state,
    { teamCount: formData.get("teamCount"), rounds: formData.get("rounds") },
    { teamCount: tournament.teamCount, rounds: tournament.rounds },
  );
  const parsed = validateNewTournament({
    discipline: tournament.discipline,
    type: formData.get("type"),
    name: formData.get("name"),
    year: formData.get("year"),
    scoringPreset: formData.get("scoringPreset"),
    teamCount,
    rounds,
  });
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

  try {
    await updateTournamentRecord(tournamentId, parsed.value);
  } catch (error) {
    if (isUniqueViolation(error, TOURNAMENT_NATURAL_KEY_INDEX)) {
      return { formError: "Турнір з такою назвою вже існує за цей рік." };
    }
    if (isRecordNotFound(error)) {
      return { formError: "Турнір не знайдено." };
    }
    throw error;
  }

  revalidatePath("/admin/tournaments");
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(tournament.discipline === "BEACH" ? "/beach" : "/classic");
  revalidatePath("/archive");

  return {};
}

/**
 * Deletes a tournament. Cascades remove its group, entries, and rosters
 * (schema-level `onDelete: Cascade` — see `src/data/tournaments.ts`).
 */
export async function deleteTournament(
  tournamentId: string,
): Promise<ActionResult<undefined>> {
  try {
    await requireAdmin();
    await deleteTournamentRecord(tournamentId);
  } catch (error) {
    if (isRecordNotFound(error)) {
      return { ok: false, code: "NOT_FOUND", message: "Турнір не знайдено." };
    }
    return toActionError(error);
  }

  revalidatePath("/admin/tournaments");
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/classic");
  revalidatePath("/archive");

  return { ok: true, data: undefined };
}
