"use server";

import { revalidatePath } from "next/cache";

import { toActionError, type ActionResult } from "@/actions/result";
import { requireAdmin } from "@/auth/requireAdmin";
import { countTournamentEntries, getTournamentForAdmin, setTournamentState } from "@/data/tournaments";
import {
  checkTransition,
  type TournamentState,
  type TransitionContext,
} from "@/domain/tournamentState";

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
