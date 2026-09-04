import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Regression check for the tournament edit/delete path (src/data/tournaments.ts):
//   pnpm exec tsx scripts/verify-tournament-edit-delete.mts
// Self-cleaning — creates a throwaway tournament (plus a team/entry/player to
// exercise the delete cascade), edits it, exercises the P2025 (not-found)
// branch, then deletes it and confirms every related row is gone. Leaves the
// database as it found it.

const { db } = await import("../src/data/client");
const {
  createTournamentRecord,
  updateTournamentRecord,
  deleteTournamentRecord,
  isRecordNotFound,
} = await import("../src/data/tournaments");

const stamp = Date.now();
const original = {
  discipline: "CLASSIC",
  type: "CHAMPIONSHIP",
  name: `__verify_edit__${stamp}`,
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

const { id } = await createTournamentRecord(original);
const team = await db.team.create({ data: { name: `__verify_edit_team__${stamp}` } });

try {
  const entry = await db.tournamentEntry.create({
    data: { tournamentId: id, teamId: team.id },
  });
  await db.player.create({ data: { entryId: entry.id, fullName: "Тестовий Гравець" } });

  const updated = {
    discipline: "CLASSIC",
    type: "VETERAN",
    name: `__verify_edit__${stamp}__renamed`,
    year: 2027,
    scoringPreset: "CUSTOM",
    teamCount: 8,
    rounds: 2,
  } as const;
  await updateTournamentRecord(id, updated);

  const row = await db.tournament.findUnique({ where: { id } });
  check("type updated", row?.type === updated.type);
  check("name updated", row?.name === updated.name);
  check("year updated", row?.year === updated.year);
  check("scoringPreset updated", row?.scoringPreset === updated.scoringPreset);
  check("teamCount updated", row?.teamCount === updated.teamCount);
  check("rounds updated", row?.rounds === updated.rounds);
  check("discipline unchanged", row?.discipline === original.discipline);
  check("state untouched (still DRAFT)", row?.state === "DRAFT");

  let updateNotFoundCaught = false;
  try {
    await updateTournamentRecord("__does-not-exist__", updated);
  } catch (error) {
    updateNotFoundCaught = isRecordNotFound(error);
  }
  check("update of a missing tournament reports P2025 via isRecordNotFound", updateNotFoundCaught);

  let deleteNotFoundCaught = false;
  try {
    await deleteTournamentRecord("__does-not-exist__");
  } catch (error) {
    deleteNotFoundCaught = isRecordNotFound(error);
  }
  check("delete of a missing tournament reports P2025 via isRecordNotFound", deleteNotFoundCaught);

  await deleteTournamentRecord(id);

  check("tournament deleted", (await db.tournament.findUnique({ where: { id } })) === null);
  check("group cascade-deleted", (await db.group.count({ where: { tournamentId: id } })) === 0);
  check(
    "entry cascade-deleted",
    (await db.tournamentEntry.count({ where: { tournamentId: id } })) === 0,
  );
  check("player cascade-deleted", (await db.player.count({ where: { entryId: entry.id } })) === 0);
} finally {
  await db.team.delete({ where: { id: team.id } }).catch(() => undefined);
  await db.tournament.delete({ where: { id } }).catch(() => undefined);
}

await db.$disconnect();
process.exit(failed ? 1 : 0);
