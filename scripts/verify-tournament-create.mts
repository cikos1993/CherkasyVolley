import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Regression check for the tournament create path (src/data/tournaments.ts):
//   pnpm exec tsx scripts/verify-tournament-create.mts
// Self-cleaning — creates a throwaway tournament, asserts the DRAFT state, the
// single Group, and the natural-key uniqueness, then deletes it (cascades the
// group). Leaves the database as it found it.

const { db } = await import("../src/data/client");
const { createTournamentRecord, isUniqueViolation, TOURNAMENT_NATURAL_KEY_INDEX } = await import(
  "../src/data/tournaments"
);

const name = `__verify__${Date.now()}`;
const input = {
  discipline: "CLASSIC",
  type: "CHAMPIONSHIP",
  name,
  year: 2026,
  scoringPreset: "CLASSIC",
  teamCount: 6,
  rounds: 1,
} as const;

let failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failed++;
}

const { id } = await createTournamentRecord(input);
try {
  const row = await db.tournament.findUnique({
    where: { id },
    include: { group: true },
  });
  check("tournament row created", row !== null);
  check("state defaults to DRAFT", row?.state === "DRAFT");
  check("scoring preset stored", row?.scoringPreset === "CLASSIC");
  check("name stored", row?.name === input.name);
  check("year stored", row?.year === input.year);
  check("type stored", row?.type === input.type);
  check("teamCount stored", row?.teamCount === input.teamCount);
  check("rounds stored", row?.rounds === input.rounds);
  check("exactly one Group row", row?.group != null);

  const groupCount = await db.group.count({ where: { tournamentId: id } });
  check("group count is 1", groupCount === 1);

  let duplicateRejected = false;
  try {
    const duplicate = await createTournamentRecord(input);
    // The constraint was supposed to reject this — if it did not, the row it
    // just created is a second, untracked tournament. Clean it up too so a
    // regression here does not itself leave debris behind.
    await db.tournament.delete({ where: { id: duplicate.id } });
  } catch (error) {
    duplicateRejected = isUniqueViolation(error, TOURNAMENT_NATURAL_KEY_INDEX);
  }
  check("duplicate (discipline+type+year+name) rejected as P2002", duplicateRejected);
} finally {
  await db.tournament.delete({ where: { id } });
}

const stillThere = await db.tournament.findUnique({ where: { id } });
check("throwaway tournament deleted (cascade)", stillThere === null);
check("no orphan group", (await db.group.count({ where: { tournamentId: id } })) === 0);

await db.$disconnect();
process.exit(failed ? 1 : 0);
