import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Regression check for the team delete path (src/data/teams.ts):
//   pnpm exec tsx scripts/verify-team-delete.mts
// Self-cleaning. Asserts: an unused team deletes cleanly; a team entered in a
// tournament refuses to delete (P2003 -> isForeignKeyViolation, the friendly
// "зніміть заявку" refusal); once the entry is removed the team deletes;
// deleting a gone team raises P2025.

const { db } = await import("../src/data/client");
const { createTeamRecord, deleteTeamRecord } = await import("../src/data/teams");
const { createTournamentRecord } = await import("../src/data/tournaments");
const { createEntry, deleteEntry } = await import("../src/data/entries");
const { isForeignKeyViolation, isRecordNotFound } = await import("../src/data/errors");

let failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failed++;
}

const stamp = Date.now();
let unusedId: string | null = null;
let enteredId: string | null = null;
let tournamentId: string | null = null;
let entryId: string | null = null;

try {
  ({ id: unusedId } = await createTeamRecord({
    name: `__verify_del_unused__${stamp}`,
    nameKey: `__verify_del_unused__${stamp}`.toLowerCase(),
  }));
  ({ id: enteredId } = await createTeamRecord({
    name: `__verify_del_entered__${stamp}`,
    nameKey: `__verify_del_entered__${stamp}`.toLowerCase(),
  }));
  ({ id: tournamentId } = await createTournamentRecord({
    discipline: "CLASSIC",
    type: "CHAMPIONSHIP",
    name: `__verify_del__${stamp}`,
    year: 2026,
    scoringPreset: "CLASSIC",
    teamCount: 2,
    rounds: 1,
  }));
  ({ id: entryId } = await createEntry(tournamentId, enteredId));

  await deleteTeamRecord(unusedId);
  check(
    "an unused team deletes cleanly",
    (await db.team.findUnique({ where: { id: unusedId } })) === null,
  );

  let blocked = false;
  try {
    await deleteTeamRecord(enteredId);
  } catch (error) {
    blocked = isForeignKeyViolation(error);
  }
  check("a team entered in a tournament is refused (P2003)", blocked);
  check(
    "the refused team still exists",
    (await db.team.findUnique({ where: { id: enteredId } })) !== null,
  );

  await deleteEntry(tournamentId, entryId);
  entryId = null;
  await deleteTeamRecord(enteredId);
  check(
    "after the entry is removed the team deletes",
    (await db.team.findUnique({ where: { id: enteredId } })) === null,
  );
  enteredId = null;

  let goneRejected = false;
  try {
    await deleteTeamRecord(unusedId);
  } catch (error) {
    goneRejected = isRecordNotFound(error);
  }
  check("deleting an already-gone team raises P2025", goneRejected);
} finally {
  if (tournamentId && entryId) await deleteEntry(tournamentId, entryId).catch(() => undefined);
  if (tournamentId) await db.tournament.delete({ where: { id: tournamentId } }).catch(() => undefined);
  for (const id of [unusedId, enteredId]) {
    if (id) await db.team.delete({ where: { id } }).catch(() => undefined);
  }
}

await db.$disconnect();
process.exit(failed ? 1 : 0);
