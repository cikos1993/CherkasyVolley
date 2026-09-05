import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Regression check for Story 3.3's draw — the first real caller of
// generateSchedule (Story 3.1) and the first real writer of GroupSlot/Match
// (Story 3.2):
//   pnpm exec tsx scripts/verify-draw.mts
// Self-cleaning — creates a throwaway 4-team DRAFT tournament, exercises the
// same pipeline drawTournament runs (checkTransition -> generateSchedule ->
// saveDraw) directly against src/data/src/domain, bypassing requireAdmin the
// same way every prior verify script does. Full teardown at the end.

const { db } = await import("../src/data/client");
const { createTournamentRecord, getTournamentForAdmin } = await import("../src/data/tournaments");
const { createEntry, deleteEntry } = await import("../src/data/entries");
const { saveDraw } = await import("../src/data/draw");
const { getStandings } = await import("../src/data/matches");
const { checkTransition } = await import("../src/domain/tournamentState");
const { defaultShuffle, generateSchedule } = await import("../src/domain/schedule");

let failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failed++;
}

const stamp = Date.now();
const teamIds: string[] = [];
const entryIds: string[] = [];
let tournamentId: string | null = null;

try {
  ({ id: tournamentId } = await createTournamentRecord({
    discipline: "CLASSIC",
    type: "CHAMPIONSHIP",
    name: `__verify_draw__${stamp}`,
    year: 2026,
    scoringPreset: "CLASSIC",
    teamCount: 4,
    rounds: 1,
  }));

  const teamNames = ["Один", "Два", "Три", "Чотири"];
  for (const name of teamNames) {
    const teamName = `${name} ${stamp}`;
    const team = await db.team.create({
      data: { name: teamName, nameKey: teamName.toLowerCase() },
    });
    teamIds.push(team.id);
  }
  for (const teamId of teamIds) {
    const { id } = await createEntry(tournamentId, teamId);
    entryIds.push(id);
  }

  // The precondition must refuse the draw when entries are short of teamCount
  // -- checked before any write happens, so no cleanup is needed either way.
  const shortCheck = checkTransition("DRAFT", "GROUP_STAGE", {
    entryCount: entryIds.length - 1,
    teamCount: 4,
  });
  check(
    "checkTransition refuses the draw when entryCount !== teamCount",
    !shortCheck.ok && shortCheck.code === "PRECONDITION_FAILED",
  );

  const tournament = await getTournamentForAdmin(tournamentId);
  if (!tournament?.group) throw new Error("throwaway tournament has no group");

  const fullCheck = checkTransition(tournament.state, "GROUP_STAGE", {
    entryCount: entryIds.length,
    teamCount: tournament.teamCount,
  });
  check("checkTransition allows the draw once entries match teamCount", fullCheck.ok);

  const shuffledEntryIds = defaultShuffle(entryIds);
  const schedule = generateSchedule(shuffledEntryIds, tournament.rounds);
  const pairings = schedule.map(({ homeEntryId, awayEntryId }) => ({ homeEntryId, awayEntryId }));
  await saveDraw(tournamentId, tournament.group.id, shuffledEntryIds, pairings);

  const slots = await db.groupSlot.findMany({ where: { groupId: tournament.group.id } });
  check("GroupSlot has exactly one row per entry", slots.length === entryIds.length);
  check(
    "every entry got seated exactly once",
    new Set(slots.map((slot) => slot.entryId)).size === entryIds.length,
  );

  const matches = await db.match.findMany({ where: { tournamentId } });
  const expectedMatchCount = ((entryIds.length * (entryIds.length - 1)) / 2) * tournament.rounds;
  check(
    `Match has exactly C(4,2) x rounds = ${expectedMatchCount} rows`,
    matches.length === expectedMatchCount,
  );
  check(
    "every match is stage GROUP with groupId and both entries set",
    matches.every(
      (match) =>
        match.stage === "GROUP" &&
        match.groupId === tournament.group!.id &&
        match.homeEntryId !== null &&
        match.awayEntryId !== null,
    ),
  );

  const refreshed = await db.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
  check("Tournament.state is now GROUP_STAGE", refreshed.state === "GROUP_STAGE");

  const standings = await getStandings(tournamentId);
  check("getStandings returns all 4 entries right after the draw", standings.length === 4);
  check(
    "every entry shows played: 0 (no SetScore rows yet)",
    standings.every((row) => row.row.played === 0),
  );

  // Prove saveDraw's transaction actually rolls back on partial failure,
  // rather than merely asserting the happy-path end state (the gap the
  // Story 3.3 code review's Verification Gap Reviewer flagged). A second
  // call against the same, already-seated group hits GroupSlot's
  // @@unique([groupId, entryId]) mid-transaction -- if the transaction
  // didn't roll back, this would leave a duplicate GroupSlot row for one
  // entry and skip seating the rest, or leave extra Match rows.
  let secondDrawRejected = false;
  try {
    await saveDraw(tournamentId, tournament.group.id, shuffledEntryIds, pairings);
  } catch {
    secondDrawRejected = true;
  }
  check("a second saveDraw on an already-drawn group throws", secondDrawRejected);

  const slotsAfterRetry = await db.groupSlot.findMany({ where: { groupId: tournament.group.id } });
  check(
    "GroupSlot row count unchanged after the rejected second draw",
    slotsAfterRetry.length === entryIds.length,
  );
  const matchesAfterRetry = await db.match.findMany({ where: { tournamentId } });
  check(
    "Match row count unchanged after the rejected second draw",
    matchesAfterRetry.length === expectedMatchCount,
  );
  const tournamentAfterRetry = await db.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
  check(
    "Tournament.state still GROUP_STAGE after the rejected second draw (no partial state)",
    tournamentAfterRetry.state === "GROUP_STAGE",
  );
} finally {
  if (tournamentId) {
    for (const entryId of entryIds) {
      await deleteEntry(tournamentId, entryId).catch(() => undefined);
    }
    await db.tournament.delete({ where: { id: tournamentId } }).catch(() => undefined);
  }
  for (const teamId of teamIds) {
    await db.team.delete({ where: { id: teamId } }).catch(() => undefined);
  }
}

if (tournamentId) {
  check(
    "throwaway tournament deleted (cascades group/slots/matches/sets)",
    (await db.tournament.findUnique({ where: { id: tournamentId } })) === null,
  );
}
for (const teamId of teamIds) {
  check(`throwaway team ${teamId} deleted`, (await db.team.findUnique({ where: { id: teamId } })) === null);
}

await db.$disconnect();
process.exit(failed ? 1 : 0);
