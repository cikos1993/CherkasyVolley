import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Regression check for the admin-role data layer (src/data/users.ts):
//   pnpm exec tsx scripts/verify-admin-roles.mts
// Non-destructive — never demotes an admin. When exactly one admin exists it
// asserts demoteFromAdmin refuses (returns "last_admin" without writing).

const { db } = await import("../src/data/client");
const { countAdmins, promoteToAdmin, demoteFromAdmin } = await import("../src/data/users");

const MISSING_ID = "cknonexistent0000000000000";
let failed = 0;

function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failed++;
}

const before = await countAdmins();
check(`at least one admin exists (count=${before})`, before >= 1);
check("promoteToAdmin(missing) -> not_found", (await promoteToAdmin(MISSING_ID)).outcome === "not_found");
check("demoteFromAdmin(missing) -> not_found", (await demoteFromAdmin(MISSING_ID)).outcome === "not_found");

const admins = await db.user.findMany({ where: { isAdmin: true }, select: { id: true } });
if (admins.length === 1) {
  check("demoteFromAdmin(sole admin) -> last_admin", (await demoteFromAdmin(admins[0].id)).outcome === "last_admin");
  check("promoteToAdmin(existing admin) -> ok (idempotent)", (await promoteToAdmin(admins[0].id)).outcome === "ok");
} else {
  console.log(`skip  sole-admin assertions (adminCount=${admins.length})`);
}

check(`admin count unchanged (${before})`, (await countAdmins()) === before);

await db.$disconnect();
process.exit(failed ? 1 : 0);
