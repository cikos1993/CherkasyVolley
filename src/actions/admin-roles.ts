"use server";

import { revalidatePath } from "next/cache";

import { toActionError, type ActionResult } from "@/actions/result";
import { requireAdmin } from "@/auth/requireAdmin";
import { demoteFromAdmin, promoteToAdmin } from "@/data/users";

export async function grantAdmin(userId: string): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();
    const { outcome } = await promoteToAdmin(userId);
    if (outcome === "not_found") {
      return { ok: false, code: "NOT_FOUND", message: "Користувача не знайдено." };
    }
    revalidatePath("/admin/people");
    return { ok: true, data: { id: userId } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function revokeAdmin(userId: string): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();
    const { outcome } = await demoteFromAdmin(userId);
    if (outcome === "not_found") {
      return { ok: false, code: "NOT_FOUND", message: "Користувача не знайдено." };
    }
    if (outcome === "last_admin") {
      return {
        ok: false,
        code: "LAST_ADMIN",
        message: "Не можна зняти роль з останнього адміністратора.",
      };
    }
    revalidatePath("/admin/people");
    return { ok: true, data: { id: userId } };
  } catch (error) {
    return toActionError(error);
  }
}
