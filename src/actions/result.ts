import { AdminRequiredError } from "@/auth/requireAdmin";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

/** Maps a thrown error to the client-facing failure shape. Re-throws control-flow
 * errors (e.g. Next's redirect) untouched. */
export function toActionError(error: unknown): { ok: false; code: string; message: string } {
  if (error instanceof AdminRequiredError) {
    return { ok: false, code: "FORBIDDEN", message: "Потрібні права адміністратора" };
  }
  throw error;
}
