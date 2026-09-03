"use server";

import { requireAdmin } from "@/auth/requireAdmin";
import { toActionError, type ActionResult } from "@/actions/result";

// Minimal action that proves server-side role enforcement, independent of the UI.
export async function adminPing(): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdmin();
    return { ok: true, data: { id: user.id } };
  } catch (error) {
    return toActionError(error);
  }
}
