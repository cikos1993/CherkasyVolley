import { AdminRequiredError } from "@/auth/requireAdmin";

export type ActionErrorCode = "FORBIDDEN" | "LAST_ADMIN" | "NOT_FOUND";

export type ActionError = { ok: false; code: ActionErrorCode; message: string };

export type ActionResult<T = undefined> = { ok: true; data: T } | ActionError;

/** Maps a thrown error to the client-facing failure shape. Re-throws control-flow
 * errors (e.g. Next's redirect) untouched. */
export function toActionError(error: unknown): ActionError {
  if (error instanceof AdminRequiredError) {
    return { ok: false, code: "FORBIDDEN", message: "Потрібні права адміністратора" };
  }
  throw error;
}
