import { db } from "@/data/client";

/**
 * Users who have signed in at least once — i.e. have a linked account row.
 * A bare `user` row (the seed admin before its first login) is excluded;
 * `session` rows expire, so account presence is the durable signal.
 */
export function listAuthenticatedUsers() {
  return db.user.findMany({
    where: { accounts: { some: {} } },
    orderBy: [{ isAdmin: "desc" }, { name: "asc" }, { email: "asc" }],
    select: { id: true, name: true, email: true, image: true, isAdmin: true, createdAt: true },
  });
}

export function countAdmins() {
  return db.user.count({ where: { isAdmin: true } });
}

type RoleChangeOutcome = { outcome: "ok" | "not_found" | "last_admin" };

export async function promoteToAdmin(id: string): Promise<RoleChangeOutcome> {
  const target = await db.user.findUnique({ where: { id }, select: { isAdmin: true } });
  if (!target) return { outcome: "not_found" };
  if (!target.isAdmin) await db.user.update({ where: { id }, data: { isAdmin: true } });
  return { outcome: "ok" };
}

/**
 * Clears `isAdmin`, unless the target is the only remaining admin. The count and
 * the update run in one transaction so two concurrent self-revokes cannot both
 * pass the check and leave the system with no admin.
 */
export function demoteFromAdmin(id: string): Promise<RoleChangeOutcome> {
  return db.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id }, select: { isAdmin: true } });
    if (!target) return { outcome: "not_found" };
    if (!target.isAdmin) return { outcome: "ok" };
    if ((await tx.user.count({ where: { isAdmin: true } })) <= 1) return { outcome: "last_admin" };
    await tx.user.update({ where: { id }, data: { isAdmin: false } });
    return { outcome: "ok" };
  });
}
