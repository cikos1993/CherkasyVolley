import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth/auth";

export class AdminRequiredError extends Error {
  constructor() {
    super("Admin role required");
    this.name = "AdminRequiredError";
  }
}

// `cache()` dedupes the session read (a DB round-trip — no cookie cache) across the
// layout, page, and any child that needs the user within one request.
export const getSessionUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

/**
 * First line of every Server Action. Throws {@link AdminRequiredError} before any
 * data access if the caller is not an admin.
 */
export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user?.isAdmin) throw new AdminRequiredError();
  return user;
}

/** Route guard for `/admin` layouts and pages — redirects instead of throwing. */
export async function requireAdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in?from=/admin");
  if (!user.isAdmin) redirect("/?error=admin-required");
  return user;
}
