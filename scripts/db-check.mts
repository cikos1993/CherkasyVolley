import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Smoke-checks the runtime DB client against the live database:
//   pnpm exec tsx scripts/db-check.mts
const { db } = await import("../src/data/client");

const [users, sessions, accounts, verifications] = await Promise.all([
  db.user.count(),
  db.session.count(),
  db.account.count(),
  db.verification.count(),
]);

console.log({ users, sessions, accounts, verifications });
await db.$disconnect();
