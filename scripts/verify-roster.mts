import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Regression check for the roster (player) path (src/data/players.ts):
//   pnpm exec tsx scripts/verify-roster.mts
// Self-cleaning — creates a throwaway tournament, two teams and two entries,
// exercises create/update/delete on one entry's roster, proves update/delete
// scoped to the *other* entry's id are no-ops (the Story 2.7 lesson applied
// to players), then tears everything down. Leaves the database as it found it.

const { db } = await import("../src/data/client");
const { createTournamentRecord } = await import("../src/data/tournaments");
const { createEntry, deleteEntry } = await import("../src/data/entries");
const { listPlayersForEntry, createPlayer, updatePlayer, deletePlayer } = await import(
  "../src/data/players"
);

let failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failed++;
}

const stamp = Date.now();
const teamIds: string[] = [];
let tournamentId: string | null = null;
let entryId: string | null = null;
let otherEntryId: string | null = null;

try {
  ({ id: tournamentId } = await createTournamentRecord({
    discipline: "CLASSIC",
    type: "CHAMPIONSHIP",
    name: `__verify_roster__${stamp}`,
    year: 2026,
    scoringPreset: "CLASSIC",
    teamCount: 2,
    rounds: 1,
  }));

  for (let i = 0; i < 2; i++) {
    const teamName = `__verify_roster_team_${i}__${stamp}`;
    const team = await db.team.create({
      data: { name: teamName, nameKey: teamName.toLowerCase() },
    });
    teamIds.push(team.id);
  }

  ({ id: entryId } = await createEntry(tournamentId, teamIds[0]));
  ({ id: otherEntryId } = await createEntry(tournamentId, teamIds[1]));

  const minimalInput = {
    fullName: "Мінімальний Гравець",
    birthDate: null,
    birthPlace: null,
    sportRank: null,
    position: null,
    height: null,
    weight: null,
  };
  const minimal = await createPlayer(entryId, minimalInput);
  const minimalRow = await db.player.findUniqueOrThrow({ where: { id: minimal.id } });
  check(
    "createPlayer with only fullName stores every optional field as null",
    minimalRow.birthDate === null &&
      minimalRow.birthPlace === null &&
      minimalRow.sportRank === null &&
      minimalRow.position === null &&
      minimalRow.height === null &&
      minimalRow.weight === null,
  );

  const fullInput = {
    fullName: "Повний Гравець",
    birthDate: "2000-01-15",
    birthPlace: "Черкаси",
    sportRank: "КМС",
    position: "Діагональ",
    height: "195",
    weight: "88",
  };
  const full = await createPlayer(entryId, fullInput);
  const fullRow = await db.player.findUniqueOrThrow({ where: { id: full.id } });
  check(
    "createPlayer with every field filled stores each verbatim",
    fullRow.birthDate === fullInput.birthDate &&
      fullRow.birthPlace === fullInput.birthPlace &&
      fullRow.sportRank === fullInput.sportRank &&
      fullRow.position === fullInput.position &&
      fullRow.height === fullInput.height &&
      fullRow.weight === fullInput.weight,
  );

  check("listPlayersForEntry returns both players", (await listPlayersForEntry(entryId)).length === 2);

  const updated = await updatePlayer(entryId, minimal.id, {
    ...minimalInput,
    sportRank: "I розряд",
  });
  check("updatePlayer scoped to the correct entry updates one row", updated.count === 1);
  const afterUpdate = await db.player.findUniqueOrThrow({ where: { id: minimal.id } });
  check(
    "updatePlayer changed only the targeted field",
    afterUpdate.sportRank === "I розряд" && afterUpdate.fullName === minimalRow.fullName,
  );

  // The bug this closes (Story 2.7 lesson applied to players): updatePlayer /
  // deletePlayer must not touch a player scoped under the *wrong* entry — a
  // mismatched (entryId, playerId) pair must be a no-op, not a cross-entry write.
  const crossEntryUpdate = await updatePlayer(otherEntryId, minimal.id, {
    ...minimalInput,
    sportRank: "СМАЙВ",
  });
  check(
    "updatePlayer scoped to a different entry's id updates nothing",
    crossEntryUpdate.count === 0,
  );
  const afterCrossUpdate = await db.player.findUniqueOrThrow({ where: { id: minimal.id } });
  check(
    "the player is unchanged after the mismatched update attempt",
    afterCrossUpdate.sportRank === "I розряд",
  );

  const crossEntryDelete = await deletePlayer(otherEntryId, minimal.id);
  check(
    "deletePlayer scoped to a different entry's id deletes nothing",
    crossEntryDelete.count === 0,
  );
  check(
    "the player survives the mismatched delete attempt",
    (await db.player.findUnique({ where: { id: minimal.id } })) !== null,
  );

  const deleted = await deletePlayer(entryId, minimal.id);
  check("deletePlayer scoped to the correct entry deletes one row", deleted.count === 1);
  check("the deleted player is gone", (await db.player.findUnique({ where: { id: minimal.id } })) === null);
  check(
    "the other player survives",
    (await db.player.findUnique({ where: { id: full.id } })) !== null,
  );
} finally {
  if (entryId) await deleteEntry(tournamentId!, entryId).catch(() => undefined);
  if (otherEntryId) await deleteEntry(tournamentId!, otherEntryId).catch(() => undefined);
  if (tournamentId) await db.tournament.delete({ where: { id: tournamentId } }).catch(() => undefined);
  for (const teamId of teamIds) {
    await db.team.delete({ where: { id: teamId } }).catch(() => undefined);
  }
}

if (tournamentId) {
  check(
    "throwaway tournament deleted (cascades remaining entries + players)",
    (await db.tournament.findUnique({ where: { id: tournamentId } })) === null,
  );
}
for (const teamId of teamIds) {
  check(`throwaway team ${teamId} deleted`, (await db.team.findUnique({ where: { id: teamId } })) === null);
}

await db.$disconnect();
process.exit(failed ? 1 : 0);
