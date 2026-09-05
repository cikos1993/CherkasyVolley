import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Regression check for Story 3.4's redraw:
//   pnpm exec tsx scripts/verify-redraw.mts
// Self-cleaning — draws a throwaway 4-team tournament (the same direct
// checkTransition -> generateSchedule -> saveDraw sequence verify-draw.mts
// uses), then runs the redraw pipeline against it and asserts the old
// calendar is gone, a new one exists, GroupSlot/Tournament.state are
// untouched, and a result blocks any further redraw. Full teardown at
// the end.

const { db } = await import("../src/data/client");
const { createTournamentRecord, getTournamentForAdmin } = await import("../src/data/tournaments");
const { createEntry, deleteEntry } = await import("../src/data/entries");
const { saveDraw, listGroupEntryIds, saveRedraw } = await import("../src/data/draw");
const { hasAnyGroupResult } = await import("../src/data/matches");
const { checkTransition } = await import("../src/domain/tournamentState");
const { checkCanRedraw } = await import("../src/domain/redraw");
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
    name: `__verify_redraw__${stamp}`,
    year: 2026,
    scoringPreset: "CLASSIC",
    teamCount: 4,
    rounds: 1,
  }));

  const teamNames = ["Раз", "Два", "Три", "Штири"];
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

  const tournament = await getTournamentForAdmin(tournamentId);
  if (!tournament?.group) throw new Error("throwaway tournament has no group");

  const drawCheck = checkTransition(tournament.state, "GROUP_STAGE", {
    entryCount: entryIds.length,
    teamCount: tournament.teamCount,
  });
  if (!drawCheck.ok) throw new Error("setup draw precondition failed");

  const initialSchedule = generateSchedule(defaultShuffle(entryIds), tournament.rounds);
  const initialPairings = initialSchedule.map(({ homeEntryId, awayEntryId }) => ({
    homeEntryId,
    awayEntryId,
  }));
  await saveDraw(tournamentId, tournament.group.id, entryIds, initialPairings);

  check(
    "checkCanRedraw allows a redraw right after the draw (GROUP_STAGE, no results)",
    checkCanRedraw("GROUP_STAGE", false).ok,
  );

  const originalMatches = await db.match.findMany({ where: { tournamentId } });
  const originalMatchIds = new Set(originalMatches.map((match) => match.id));
  const expectedMatchCount = ((entryIds.length * (entryIds.length - 1)) / 2) * tournament.rounds;
  check(`the initial draw created ${expectedMatchCount} matches`, originalMatches.length === expectedMatchCount);

  const groupEntryIds = await listGroupEntryIds(tournament.group.id);
  check(
    "listGroupEntryIds returns the same 4 seated entries",
    groupEntryIds.length === entryIds.length &&
      new Set(groupEntryIds).size === entryIds.length &&
      groupEntryIds.every((id) => entryIds.includes(id)),
  );

  const redrawSchedule = generateSchedule(defaultShuffle(groupEntryIds), tournament.rounds);
  const redrawPairings = redrawSchedule.map(({ homeEntryId, awayEntryId }) => ({
    homeEntryId,
    awayEntryId,
  }));
  await saveRedraw(tournamentId, tournament.group.id, redrawPairings);

  const newMatches = await db.match.findMany({ where: { tournamentId } });
  check(`the redraw still has ${expectedMatchCount} matches`, newMatches.length === expectedMatchCount);
  check(
    "none of the original Match ids survive the redraw",
    newMatches.every((match) => !originalMatchIds.has(match.id)),
  );
  check(
    "every new match is stage GROUP with groupId and both entries set",
    newMatches.every(
      (match) =>
        match.stage === "GROUP" &&
        match.groupId === tournament.group!.id &&
        match.homeEntryId !== null &&
        match.awayEntryId !== null,
    ),
  );

  const slotsAfterRedraw = await db.groupSlot.findMany({ where: { groupId: tournament.group.id } });
  check(
    "GroupSlot is untouched by the redraw (same 4 entries seated)",
    slotsAfterRedraw.length === entryIds.length &&
      new Set(slotsAfterRedraw.map((slot) => slot.entryId)).size === entryIds.length &&
      slotsAfterRedraw.every((slot) => entryIds.includes(slot.entryId)),
  );

  const tournamentAfterRedraw = await db.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
  check("Tournament.state is still GROUP_STAGE after the redraw", tournamentAfterRedraw.state === "GROUP_STAGE");

  check("hasAnyGroupResult is false before any result is entered", !(await hasAnyGroupResult(tournamentId)));

  const firstMatch = newMatches[0];
  if (!firstMatch) throw new Error("expected at least one match after the redraw");
  await db.setScore.create({
    data: { matchId: firstMatch.id, setNo: 1, homePoints: 25, awayPoints: 20 },
  });

  check("hasAnyGroupResult is true once a result exists", await hasAnyGroupResult(tournamentId));
  check(
    "checkCanRedraw refuses a further redraw once a result exists",
    !checkCanRedraw("GROUP_STAGE", await hasAnyGroupResult(tournamentId)).ok,
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
