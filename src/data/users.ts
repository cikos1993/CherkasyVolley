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

type GrantOutcome = { outcome: "ok" | "not_found" };
type RevokeOutcome = { outcome: "ok" | "not_found" | "last_admin" };

export async function promoteToAdmin(id: string): Promise<GrantOutcome> {
  const target = await db.user.findUnique({ where: { id }, select: { isAdmin: true } });
  if (!target) return { outcome: "not_found" };
  if (!target.isAdmin) await db.user.update({ where: { id }, data: { isAdmin: true } });
  return { outcome: "ok" };
}

/**
 * Clears `isAdmin`, unless the target is the only remaining admin. `FOR UPDATE`
 * locks the whole admin set for the transaction, so two concurrent revokes are
 * serialised and cannot both pass the count check and leave the system with no
 * admin.
 */
export function demoteFromAdmin(id: string): Promise<RevokeOutcome> {
  return db.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id }, select: { isAdmin: true } });
    if (!target) return { outcome: "not_found" };
    if (!target.isAdmin) return { outcome: "ok" };
    const admins = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "user" WHERE "isAdmin" = true FOR UPDATE`;
    if (admins.length <= 1) return { outcome: "last_admin" };
    await tx.user.update({ where: { id }, data: { isAdmin: false } });
    return { outcome: "ok" };
  });
}
