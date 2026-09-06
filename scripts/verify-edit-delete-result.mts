import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Regression check for Story 3.7's edit / delete result (src/data/matches.ts):
//   pnpm exec tsx scripts/verify-edit-delete-result.mts
// Self-cleaning — draws a throwaway CLASSIC 4-team tournament, records a
// result, then exercises replaceMatchResult (edit) and deleteMatchResult
// directly (bypassing requireAdmin, like every prior verify script) and
// asserts getStandings recomputes on edit and un-counts the match on delete,
// plus the not_found / stage-scope guards. Full teardown.

const { db } = await import("../src/data/client");
const { createTournamentRecord, getTournamentForAdmin } = await import("../src/data/tournaments");
const { createEntry, deleteEntry } = await import("../src/data/entries");
const { saveDraw } = await import("../src/data/draw");
const { getStandings, createMatchResult, replaceMatchResult, deleteMatchResult } = await import(
  "../src/data/matches"
);
const { checkTransition } = await import("../src/domain/tournamentState");
const { defaultShuffle, generateSchedule } = await import("../src/domain/schedule");

let failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failed++;
}

const stamp = Date.now();
const teamIds: string[] = [];
const tournamentIds: string[] = [];

async function drawThrowaway(suffix: string): Promise<{ tournamentId: string; matchIds: string[] }> {
  const { id: tournamentId } = await createTournamentRecord({
    discipline: "CLASSIC",
    type: "CHAMPIONSHIP",
    name: `__verify_edit_${suffix}__${stamp}`,
    year: 2026,
    scoringPreset: "CLASSIC",
    teamCount: 4,
    rounds: 1,
  });
  tournamentIds.push(tournamentId);

  const entryIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const name = `Команда ${suffix}-${i} ${stamp}`;
    const team = await db.team.create({ data: { name, nameKey: name.toLowerCase() } });
    teamIds.push(team.id);
    const { id } = await createEntry(tournamentId, team.id);
    entryIds.push(id);
  }

  const tournament = await getTournamentForAdmin(tournamentId);
  if (!tournament?.group) throw new Error("throwaway tournament has no group");
  if (!checkTransition(tournament.state, "GROUP_STAGE", { entryCount: 4, teamCount: 4 }).ok) {
    throw new Error("throwaway draw precondition failed");
  }

  const shuffled = defaultShuffle(entryIds);
  const pairings = generateSchedule(shuffled, 1).map(({ homeEntryId, awayEntryId }) => ({
    homeEntryId,
    awayEntryId,
  }));
  await saveDraw(tournamentId, tournament.group.id, shuffled, pairings);

  const matches = await db.match.findMany({
    where: { tournamentId, stage: "GROUP" },
    select: { id: true },
  });
  return { tournamentId, matchIds: matches.map((m) => m.id) };
}

try {
  const main = await drawThrowaway("main");
  const other = await drawThrowaway("other");
  const matchId = main.matchIds[0];
  const { homeEntryId, awayEntryId } = await db.match.findUniqueOrThrow({
    where: { id: matchId },
    select: { homeEntryId: true, awayEntryId: true },
  });

  // A second group match with its own result — nothing done to matchId may
  // touch it (this is what proves deleteMatchResult / replaceMatchResult are
  // scoped by matchId, not just by tournament+stage).
  const otherMatchId = main.matchIds[1];
  await createMatchResult(main.tournamentId, otherMatchId, [
    { setNo: 1, homePoints: 25, awayPoints: 10 },
    { setNo: 2, homePoints: 25, awayPoints: 10 },
    { setNo: 3, homePoints: 25, awayPoints: 10 },
  ]);

  // --- a schedule stamped on matchId — an edit must not disturb it ---
  const whenBefore = new Date("2026-06-13T08:00:00.000Z");
  await db.match.update({
    where: { id: matchId },
    data: { scheduledAt: whenBefore, venueText: "СК «Спартак»" },
  });

  // --- record a 3:0 ---
  await createMatchResult(main.tournamentId, matchId, [
    { setNo: 1, homePoints: 25, awayPoints: 20 },
    { setNo: 2, homePoints: 25, awayPoints: 18 },
    { setNo: 3, homePoints: 25, awayPoints: 22 },
  ]);
  const s1 = await getStandings(main.tournamentId);
  const home1 = s1.find((s) => s.row.entryId === homeEntryId);
  check("after 3:0 — home has points 3, wins 1", home1?.row.points === 3 && home1.row.wins === 1);

  // --- scoping guards (run while both results still exist) ---
  const crossReplace = await replaceMatchResult(other.tournamentId, matchId, [
    { setNo: 1, homePoints: 25, awayPoints: 20 },
    { setNo: 2, homePoints: 25, awayPoints: 20 },
    { setNo: 3, homePoints: 25, awayPoints: 20 },
  ]);
  check(
    "replaceMatchResult with a cross-tournament matchId → not_found",
    !crossReplace.ok && crossReplace.reason === "not_found",
  );
  const crossDelete = await deleteMatchResult(other.tournamentId, matchId);
  check("deleteMatchResult with a cross-tournament matchId → count 0", crossDelete.count === 0);
  check(
    "the cross-tournament attempts left matchId's 3 SetScore rows intact",
    (await db.setScore.count({ where: { matchId } })) === 3,
  );

  const semifinal = await db.match.create({
    data: {
      tournamentId: main.tournamentId,
      stage: "SEMIFINAL",
      groupId: null,
      homeEntryId: null,
      awayEntryId: null,
    },
  });
  const playoffReplace = await replaceMatchResult(main.tournamentId, semifinal.id, [
    { setNo: 1, homePoints: 25, awayPoints: 20 },
    { setNo: 2, homePoints: 25, awayPoints: 20 },
    { setNo: 3, homePoints: 25, awayPoints: 20 },
  ]);
  check(
    "replaceMatchResult on a SEMIFINAL match → not_found",
    !playoffReplace.ok && playoffReplace.reason === "not_found",
  );
  check(
    "deleteMatchResult on a SEMIFINAL match → count 0",
    (await deleteMatchResult(main.tournamentId, semifinal.id)).count === 0,
  );
  check(
    "replaceMatchResult refuses an empty sets array → not_found",
    !(await replaceMatchResult(main.tournamentId, matchId, [])).ok,
  );

  // --- edit to a 3:2 (win-by-2, decisive 5th to 15) ---
  const edited = await replaceMatchResult(main.tournamentId, matchId, [
    { setNo: 1, homePoints: 25, awayPoints: 20 },
    { setNo: 2, homePoints: 20, awayPoints: 25 },
    { setNo: 3, homePoints: 25, awayPoints: 18 },
    { setNo: 4, homePoints: 20, awayPoints: 25 },
    { setNo: 5, homePoints: 15, awayPoints: 13 },
  ]);
  check("replaceMatchResult ok for a valid 3:2", edited.ok === true);
  check(
    "exactly 5 SetScore rows after the edit",
    (await db.setScore.count({ where: { matchId } })) === 5,
  );
  const s2 = await getStandings(main.tournamentId);
  const home2 = s2.find((s) => s.row.entryId === homeEntryId);
  const away2 = s2.find((s) => s.row.entryId === awayEntryId);
  check(
    "getStandings recomputed — 3:2 now gives home 2 points, away 1",
    home2?.row.points === 2 && away2?.row.points === 1 && home2.row.wins === 1,
  );
  const matchAfterEdit = await db.match.findUniqueOrThrow({ where: { id: matchId } });
  check(
    "the edit did not touch scheduledAt / venueText",
    matchAfterEdit.scheduledAt?.getTime() === whenBefore.getTime() &&
      matchAfterEdit.venueText === "СК «Спартак»",
  );
  check(
    "the edit left the other match's result intact",
    (await db.setScore.count({ where: { matchId: otherMatchId } })) === 3,
  );

  // --- delete → match un-counted, nothing else touched ---
  const removed = await deleteMatchResult(main.tournamentId, matchId);
  check("deleteMatchResult removed all 5 SetScore rows", removed.count === 5);
  check("0 SetScore rows after the delete", (await db.setScore.count({ where: { matchId } })) === 0);
  check(
    "the delete left the other match's result intact",
    (await db.setScore.count({ where: { matchId: otherMatchId } })) === 3,
  );
  const s3 = await getStandings(main.tournamentId);
  const home3 = s3.find((s) => s.row.entryId === homeEntryId);
  check(
    "getStandings no longer counts the deleted match — home played 0, points 0",
    home3?.row.played === 0 && home3.row.points === 0,
  );
  check(
    "the other match still counts — exactly its 2 entries show played 1",
    s3.filter((s) => s.row.played === 1).length === 2,
  );

  const tournamentAfter = await db.tournament.findUniqueOrThrow({ where: { id: main.tournamentId } });
  check(
    "neither edit nor delete changed Tournament.state",
    tournamentAfter.state === "GROUP_STAGE",
  );
} finally {
  for (const tournamentId of tournamentIds) {
    const entries = await db.tournamentEntry.findMany({
      where: { tournamentId },
      select: { id: true },
    });
    for (const entry of entries) {
      await deleteEntry(tournamentId, entry.id).catch(() => undefined);
    }
    await db.tournament.delete({ where: { id: tournamentId } }).catch(() => undefined);
  }
  for (const teamId of teamIds) {
    await db.team.delete({ where: { id: teamId } }).catch(() => undefined);
  }
}

for (const tournamentId of tournamentIds) {
  check(
    `throwaway tournament ${tournamentId} deleted (cascades matches/sets)`,
    (await db.tournament.findUnique({ where: { id: tournamentId } })) === null,
  );
}

await db.$disconnect();
process.exit(failed ? 1 : 0);
