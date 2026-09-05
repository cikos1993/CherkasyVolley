"use server";

import { revalidatePath } from "next/cache";

import { toActionError, type ActionResult } from "@/actions/result";
import { AdminRequiredError, requireAdmin } from "@/auth/requireAdmin";
import { getEntryForAdmin } from "@/data/entries";
import { createPlayer, deletePlayer, updatePlayer } from "@/data/players";
import { validatePlayer, type FieldErrors } from "@/domain/playerForm";

export type PlayerFormState = {
  fieldErrors?: FieldErrors;
  formError?: string;
};

function rawFromFormData(formData: FormData) {
  return {
    fullName: formData.get("fullName"),
    birthDate: formData.get("birthDate"),
    birthPlace: formData.get("birthPlace"),
    sportRank: formData.get("sportRank"),
    position: formData.get("position"),
    height: formData.get("height"),
    weight: formData.get("weight"),
  };
}

/** Adds a player to an entry's roster. */
export async function addPlayer(
  tournamentId: string,
  entryId: string,
  _prev: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminRequiredError) {
      return { formError: "Потрібні права адміністратора." };
    }
    throw error;
  }

  const entry = await getEntryForAdmin(tournamentId, entryId);
  if (!entry) {
    return { formError: "Заявку не знайдено." };
  }

  const parsed = validatePlayer(rawFromFormData(formData));
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

  await createPlayer(entryId, parsed.value);

  revalidatePath(`/admin/tournaments/${tournamentId}/entries/${entryId}`);
  return {};
}

/** Edits an existing player. */
export async function editPlayer(
  tournamentId: string,
  entryId: string,
  playerId: string,
  _prev: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminRequiredError) {
      return { formError: "Потрібні права адміністратора." };
    }
    throw error;
  }

  const entry = await getEntryForAdmin(tournamentId, entryId);
  if (!entry) {
    return { formError: "Заявку не знайдено." };
  }

  const parsed = validatePlayer(rawFromFormData(formData));
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

  const { count } = await updatePlayer(entryId, playerId, parsed.value);
  if (count === 0) {
    return { formError: "Гравця вже видалено." };
  }

  revalidatePath(`/admin/tournaments/${tournamentId}/entries/${entryId}`);
  return {};
}

/** Removes a player from the roster. */
export async function removePlayer(
  tournamentId: string,
  entryId: string,
  playerId: string,
): Promise<ActionResult<undefined>> {
  try {
    await requireAdmin();

    const entry = await getEntryForAdmin(tournamentId, entryId);
    if (!entry) {
      return { ok: false, code: "NOT_FOUND", message: "Заявку не знайдено." };
    }

    const { count } = await deletePlayer(entryId, playerId);
    if (count === 0) {
      return { ok: false, code: "NOT_FOUND", message: "Гравця вже видалено." };
    }
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath(`/admin/tournaments/${tournamentId}/entries/${entryId}`);
  return { ok: true, data: undefined };
}
