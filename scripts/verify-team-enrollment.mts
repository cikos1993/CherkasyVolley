import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Regression check for the team-enrollment path (src/data/entries.ts):
//   pnpm exec tsx scripts/verify-team-enrollment.mts
// Self-cleaning — creates a throwaway 2-team tournament, enrolls both teams,
// exercises the capacity precondition, the duplicate-entry P2002, a roster
// cascade on cancellation, then tears everything down. Leaves the database
// as it found it.

const { db } = await import("../src/data/client");
const { createTournamentRecord } = await import("../src/data/tournaments");
const {
  listEntriesForTournament,
  countTournamentEntries,
  createEntry,
  deleteEntry,
  TOURNAMENT_ENTRY_NATURAL_KEY_INDEX,
} = await import("../src/data/entries");
const { isUniqueViolation } = await import("../src/data/errors");
const { checkCanEnroll } = await import("../src/domain/teamEnrollment");

let failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failed++;
}

const stamp = Date.now();
const teamIds: string[] = [];
let tournamentId: string | null = null;

try {
  ({ id: tournamentId } = await createTournamentRecord({
    discipline: "CLASSIC",
    type: "CHAMPIONSHIP",
    name: `__verify_entry__${stamp}`,
    year: 2026,
    scoringPreset: "CLASSIC",
    teamCount: 2,
    rounds: 1,
  }));

  for (let i = 0; i < 2; i++) {
    const teamName = `__verify_entry_team_${i}__${stamp}`;
    const team = await db.team.create({
      data: { name: teamName, nameKey: teamName.toLowerCase() },
    });
    teamIds.push(team.id);
  }

  await createEntry(tournamentId, teamIds[0]);
  const entry2 = await createEntry(tournamentId, teamIds[1]);

  check("exactly 2 entries created", (await countTournamentEntries(tournamentId)) === 2);
  const entries = await listEntriesForTournament(tournamentId);
  check("listEntriesForTournament returns both, joined with team name", entries.length === 2);

  const capacityCheck = checkCanEnroll(
    "DRAFT",
    await countTournamentEntries(tournamentId),
    2,
  );
  check("checkCanEnroll reports the field full at capacity", !capacityCheck.ok);

  let duplicateRejected = false;
  try {
    await createEntry(tournamentId, teamIds[0]);
  } catch (error) {
    duplicateRejected = isUniqueViolation(error, TOURNAMENT_ENTRY_NATURAL_KEY_INDEX);
  }
  check("duplicate (same tournament+team) rejected as P2002", duplicateRejected);

  const player = await db.player.create({
    data: { entryId: entry2.id, fullName: "Тестовий Гравець" },
  });
  await deleteEntry(entry2.id);
  check("canceled entry gone", (await db.tournamentEntry.findUnique({ where: { id: entry2.id } })) === null);
  check(
    "its roster cascade-deleted",
    (await db.player.findUnique({ where: { id: player.id } })) === null,
  );
  check(
    "the other entry survives",
    (await countTournamentEntries(tournamentId)) === 1,
  );
} finally {
  if (tournamentId) await db.tournament.delete({ where: { id: tournamentId } }).catch(() => undefined);
  for (const teamId of teamIds) {
    await db.team.delete({ where: { id: teamId } }).catch(() => undefined);
  }
}

if (tournamentId) {
  check(
    "throwaway tournament deleted (cascades remaining entry)",
    (await db.tournament.findUnique({ where: { id: tournamentId } })) === null,
  );
}
for (const teamId of teamIds) {
  check(
    `throwaway team ${teamId} deleted`,
    (await db.team.findUnique({ where: { id: teamId } })) === null,
  );
}

await db.$disconnect();
process.exit(failed ? 1 : 0);
