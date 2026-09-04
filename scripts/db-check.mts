import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Smoke-checks the runtime DB client against the live database:
//   pnpm exec tsx scripts/db-check.mts
const { db } = await import("../src/data/client");
const { Discipline } = await import("../src/generated/prisma/enums");

const [users, sessions, accounts, verifications, tournaments, groups, teams, entries, players] =
  await Promise.all([
    db.user.count(),
    db.session.count(),
    db.account.count(),
    db.verification.count(),
    db.tournament.count(),
    db.group.count(),
    db.team.count(),
    db.tournamentEntry.count(),
    db.player.count(),
  ]);

// Exercise an enum-typed filter so the generated types are checked end to end.
const classicTournaments = await db.tournament.findMany({
  where: { discipline: Discipline.CLASSIC },
  take: 100,
});

console.log({
  users,
  sessions,
  accounts,
  verifications,
  tournaments,
  groups,
  teams,
  entries,
  players,
  classicTournaments: classicTournaments.length,
});
await db.$disconnect();
