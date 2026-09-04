"use server";

import { revalidatePath } from "next/cache";

import { AdminRequiredError, requireAdmin } from "@/auth/requireAdmin";
import { isUniqueViolation } from "@/data/errors";
import { createTeamRecord, TEAM_NAME_KEY_INDEX } from "@/data/teams";
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
