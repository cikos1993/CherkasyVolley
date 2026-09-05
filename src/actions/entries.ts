"use server";

import { revalidatePath } from "next/cache";

import { toActionError, type ActionResult } from "@/actions/result";
import { requireAdmin } from "@/auth/requireAdmin";
import { isRecordNotFound, isUniqueViolation } from "@/data/errors";
import {
  countTournamentEntries,
  createEntry,
  deleteEntry,
  TOURNAMENT_ENTRY_NATURAL_KEY_INDEX,
} from "@/data/entries";
import { getTournamentForAdmin } from "@/data/tournaments";
import { checkCanEnroll, checkCanRemoveEntry } from "@/domain/teamEnrollment";

/**
 * Enrolls a team from the directory into a tournament. Gated on `DRAFT` and
 * the field not being full (`checkCanEnroll`); a duplicate (team already
 * enrolled) is caught via the DB's own unique constraint.
 */
export async function enrollTeam(
  tournamentId: string,
  teamId: string,
): Promise<ActionResult<undefined>> {
  try {
    await requireAdmin();

    const tournament = await getTournamentForAdmin(tournamentId);
    if (!tournament) {
      return { ok: false, code: "NOT_FOUND", message: "Турнір не знайдено." };
    }

    const entryCount = await countTournamentEntries(tournamentId);
    const check = checkCanEnroll(tournament.state, entryCount, tournament.teamCount);
    if (!check.ok) {
      return { ok: false, code: "PRECONDITION_FAILED", message: check.message };
    }

    await createEntry(tournamentId, teamId);
  } catch (error) {
    if (isUniqueViolation(error, TOURNAMENT_ENTRY_NATURAL_KEY_INDEX)) {
      return { ok: false, code: "PRECONDITION_FAILED", message: "Ця команда вже заявлена в цей турнір." };
    }
    return toActionError(error);
  }

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  return { ok: true, data: undefined };
}

/**
 * Cancels a team's entry. Gated on `DRAFT` (`checkCanRemoveEntry`). Cascades
 * remove the entry's roster (schema-level `onDelete: Cascade`).
 */
export async function removeTeamEntry(
  tournamentId: string,
  entryId: string,
): Promise<ActionResult<undefined>> {
  try {
    await requireAdmin();

    const tournament = await getTournamentForAdmin(tournamentId);
    if (!tournament) {
      return { ok: false, code: "NOT_FOUND", message: "Турнір не знайдено." };
    }

    const check = checkCanRemoveEntry(tournament.state);
    if (!check.ok) {
      return { ok: false, code: "PRECONDITION_FAILED", message: check.message };
    }

    await deleteEntry(entryId);
  } catch (error) {
    if (isRecordNotFound(error)) {
      return { ok: false, code: "NOT_FOUND", message: "Заявку вже видалено." };
    }
    return toActionError(error);
  }

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  return { ok: true, data: undefined };
}
