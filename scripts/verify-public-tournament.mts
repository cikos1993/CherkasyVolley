import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Regression check for the public (role-blind) reads (src/data/tournaments.ts,
// src/data/entries.ts):
//   pnpm exec tsx scripts/verify-public-tournament.mts
// Self-cleaning — creates a DRAFT tournament and a GROUP_STAGE tournament
// (state forced directly via setTournamentState, bypassing
// transitionTournament's precondition, since this script only needs a
// non-DRAFT row to exist, not a real draw), each with one entered team.
// Asserts getPublicTournament/listPublicTournaments only ever see the
// GROUP_STAGE one, and that getEntryByTeam's scoping holds across two real
// tournaments (not just two entries in one). Leaves the database as it
// found it.

const { db } = await import("../src/data/client");
const { createTournamentRecord, setTournamentState, getPublicTournament, listPublicTournaments } =
  await import("../src/data/tournaments");
const { createEntry, deleteEntry, getEntryByTeam } = await import("../src/data/entries");

let failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failed++;
}

const stamp = Date.now();
const teamIds: string[] = [];
let draftTournamentId: string | null = null;
let liveTournamentId: string | null = null;
let draftEntryId: string | null = null;
let liveEntryId: string | null = null;

try {
  ({ id: draftTournamentId } = await createTournamentRecord({
    discipline: "CLASSIC",
    type: "CHAMPIONSHIP",
    name: `__verify_public_draft__${stamp}`,
    year: 2026,
    scoringPreset: "CLASSIC",
    teamCount: 2,
    rounds: 1,
  }));
  ({ id: liveTournamentId } = await createTournamentRecord({
    discipline: "CLASSIC",
    type: "CHAMPIONSHIP",
    name: `__verify_public_live__${stamp}`,
    year: 2026,
    scoringPreset: "CLASSIC",
    teamCount: 2,
    rounds: 1,
  }));
  await setTournamentState(liveTournamentId, "GROUP_STAGE");

  for (let i = 0; i < 2; i++) {
    const teamName = `__verify_public_team_${i}__${stamp}`;
    const team = await db.team.create({
      data: { name: teamName, nameKey: teamName.toLowerCase() },
    });
    teamIds.push(team.id);
  }

  ({ id: draftEntryId } = await createEntry(draftTournamentId, teamIds[0]));
  ({ id: liveEntryId } = await createEntry(liveTournamentId, teamIds[1]));

  check(
    "getPublicTournament sees the GROUP_STAGE tournament",
    (await getPublicTournament(liveTournamentId))?.id === liveTournamentId,
  );
  check(
    "getPublicTournament hides the DRAFT tournament",
    (await getPublicTournament(draftTournamentId)) === null,
  );

  const publicList = await listPublicTournaments();
  check(
    "listPublicTournaments includes the GROUP_STAGE tournament",
    publicList.some((t) => t.id === liveTournamentId),
  );
  check(
    "listPublicTournaments excludes the DRAFT tournament",
    !publicList.some((t) => t.id === draftTournamentId),
  );

  check(
    "getEntryByTeam finds a real entered team",
    (await getEntryByTeam(liveTournamentId, teamIds[1]))?.id === liveEntryId,
  );
  check(
    "getEntryByTeam returns null for a team never entered in that tournament",
    (await getEntryByTeam(liveTournamentId, teamIds[0])) === null,
  );

  // The bug this closes (Story 2.7/2.8 lesson, applied a third time):
  // getEntryByTeam must reject a real teamId paired with the *wrong*
  // tournament — a mismatched pair across two real tournaments, not just
  // a wrong entryId within one.
  check(
    "getEntryByTeam(draftTournamentId, teamIds[1]) returns null — team belongs to a different tournament",
    (await getEntryByTeam(draftTournamentId, teamIds[1])) === null,
  );
  check(
    "getEntryByTeam is visibility-agnostic — finds the DRAFT tournament's entry too (the page decides visibility, not this function)",
    (await getEntryByTeam(draftTournamentId, teamIds[0]))?.id === draftEntryId,
  );
} finally {
  if (draftEntryId) await deleteEntry(draftTournamentId!, draftEntryId).catch(() => undefined);
  if (liveEntryId) await deleteEntry(liveTournamentId!, liveEntryId).catch(() => undefined);
  if (draftTournamentId) {
    await db.tournament.delete({ where: { id: draftTournamentId } }).catch(() => undefined);
  }
  if (liveTournamentId) {
    await db.tournament.delete({ where: { id: liveTournamentId } }).catch(() => undefined);
  }
  for (const teamId of teamIds) {
    await db.team.delete({ where: { id: teamId } }).catch(() => undefined);
  }
}

if (draftTournamentId) {
  check(
    "throwaway DRAFT tournament deleted",
    (await db.tournament.findUnique({ where: { id: draftTournamentId } })) === null,
  );
}
if (liveTournamentId) {
  check(
    "throwaway GROUP_STAGE tournament deleted",
    (await db.tournament.findUnique({ where: { id: liveTournamentId } })) === null,
  );
}
for (const teamId of teamIds) {
  check(`throwaway team ${teamId} deleted`, (await db.team.findUnique({ where: { id: teamId } })) === null);
}

await db.$disconnect();
process.exit(failed ? 1 : 0);
