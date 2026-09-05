"use server";

import { revalidatePath } from "next/cache";

import { AdminRequiredError, requireAdmin } from "@/auth/requireAdmin";
import { updateMatchSchedule } from "@/data/matches";
import { getTournamentForAdmin } from "@/data/tournaments";
import { validateMatchSchedule, type MatchScheduleFieldErrors } from "@/domain/matchSchedule";

export type MatchScheduleFormState = {
  fieldErrors?: MatchScheduleFieldErrors;
  formError?: string;
};

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
  revalidatePath(`/classic/${tournamentId}`);
  return {};
}
