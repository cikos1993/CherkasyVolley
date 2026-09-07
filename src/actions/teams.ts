"use server";

import { revalidatePath } from "next/cache";

import { toActionError, type ActionResult } from "@/actions/result";
import { AdminRequiredError, requireAdmin } from "@/auth/requireAdmin";
import { isForeignKeyViolation, isRecordNotFound, isUniqueViolation } from "@/data/errors";
import { createTeamRecord, deleteTeamRecord, TEAM_NAME_KEY_INDEX } from "@/data/teams";
import { validateNewTeam, type TeamField } from "@/domain/teamForm";

export type TeamFormState = {
  fieldErrors?: Partial<Record<TeamField, string>>;
  formError?: string;
};

export async function createTeam(
  _prev: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminRequiredError) {
      return { formError: "Потрібні права адміністратора." };
    }
    throw error;
  }

  const parsed = validateNewTeam({ name: formData.get("name") });
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

  try {
    await createTeamRecord(parsed.value);
  } catch (error) {
    if (isUniqueViolation(error, TEAM_NAME_KEY_INDEX)) {
      return { formError: "Команда з такою назвою вже існує." };
    }
    throw error;
  }

  revalidatePath("/admin/teams");

  return {};
}

/**
 * Deletes a team from the directory. Refused (not thrown) when the team is
 * still entered in a tournament — `TournamentEntry.team` is `onDelete: Restrict`
 * so the row cannot go while any entry references it. `ActionResult` shape, the
 * `deleteTournament` template.
 */
export async function deleteTeam(teamId: string): Promise<ActionResult<undefined>> {
  try {
    await requireAdmin();
    await deleteTeamRecord(teamId);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return {
        ok: false,
        code: "PRECONDITION_FAILED",
        message: "Команда бере участь у турнірі — спершу зніміть її заявку.",
      };
    }
    if (isRecordNotFound(error)) {
      return { ok: false, code: "NOT_FOUND", message: "Команду не знайдено." };
    }
    return toActionError(error);
  }

  revalidatePath("/admin/teams");
  return { ok: true, data: undefined };
}
