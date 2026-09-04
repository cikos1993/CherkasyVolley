"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { toActionError, type ActionResult } from "@/actions/result";
import { AdminRequiredError, requireAdmin } from "@/auth/requireAdmin";
import {
  countTournamentEntries,
  createTournamentRecord,
  getTournamentForAdmin,
  isUniqueViolation,
  setTournamentState,
} from "@/data/tournaments";
import {
  checkTransition,
  type TournamentState,
  type TransitionContext,
} from "@/domain/tournamentState";
import { validateNewTournament, type TournamentField } from "@/domain/tournamentForm";

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

    const check = checkTransition(tournament.state, targetState, context);
    if (!check.ok) {
      return { ok: false, code: check.code, message: check.message };
    }

    await setTournamentState(tournamentId, targetState);

    // Refresh the public discipline section, and the archive once a tournament is
    // completed. The per-tournament admin page arrives with a later story.
    revalidatePath(tournament.discipline === "BEACH" ? "/beach" : "/classic");
    if (targetState === "COMPLETED") revalidatePath("/archive");
    revalidatePath(`/admin/tournaments/${tournamentId}`);

    return { ok: true, data: { state: targetState } };
  } catch (error) {
    return toActionError(error);
  }
}

/** Fields the form submits and the action echoes back so an invalid submit keeps its input. */
const FORM_FIELDS = ["type", "name", "year", "scoringPreset", "teamCount", "rounds"] as const;

export type CreateTournamentState = {
  fieldErrors?: Partial<Record<TournamentField, string>>;
  formError?: string;
  values?: Partial<Record<TournamentField, string>>;
};

export async function createTournament(
  _prev: CreateTournamentState,
  formData: FormData,
): Promise<CreateTournamentState> {
  const values: Partial<Record<TournamentField, string>> = {};
  for (const field of FORM_FIELDS) values[field] = String(formData.get(field) ?? "");

  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminRequiredError) {
      return { formError: "Потрібні права адміністратора.", values };
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
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };

  let id: string;
  try {
    ({ id } = await createTournamentRecord(parsed.value));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { formError: "Турнір з такою назвою вже існує за цей рік.", values };
    }
    throw error;
  }

  redirect(`/admin/tournaments/${id}`);
}
