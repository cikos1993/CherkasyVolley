import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Regression check for the group-stage schema (Match/SetScore/GroupSlot) and
// its first real consumer, src/data/matches.ts's getStandings:
//   pnpm exec tsx scripts/verify-group-stage-schema.mts
// Self-cleaning — creates a throwaway tournament + 3 teams, seats all three
// into the tournament's Group via GroupSlot (simulating what Story 3.3's
// draw will later automate), hand-creates a small round-robin of GROUP
// matches with SetScores (the exact 3-way stats-cycle fixture from Story
// 3.1's own tiebreak.test.ts, reused here to prove the real DB-backed
// pipeline reproduces the same domain-level result), calls getStandings,
// and asserts the two new CHECK constraints reject a bad insert each. Full
// teardown at the end.

const { db } = await import("../src/data/client");
const { createTournamentRecord } = await import("../src/data/tournaments");
const { createEntry, deleteEntry } = await import("../src/data/entries");
const { getStandings } = await import("../src/data/matches");

let failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failed++;
}

const stamp = Date.now();
const teamIds: string[] = [];
const entryIds: string[] = [];
let tournamentId: string | null = null;
let groupId: string | null = null;

// A 3:0 B, B 3:0 C, C 3:0 A — a genuine stats cycle: every team has one win
// (3 sets won, 0 lost) and one loss (0 sets won, 3 lost), so points, the
// head-to-head mini-table, and total sets won are all tied, forcing the
// final name-fallback tiebreak (see Story 3.1's tiebreak.test.ts).
const sweepSets = [
  { setNo: 1, homePoints: 25, awayPoints: 10 },
  { setNo: 2, homePoints: 25, awayPoints: 10 },
  { setNo: 3, homePoints: 25, awayPoints: 10 },
];

try {
  ({ id: tournamentId } = await createTournamentRecord({
    discipline: "CLASSIC",
    type: "CHAMPIONSHIP",
    name: `__verify_group_stage__${stamp}`,
    year: 2026,
    scoringPreset: "CLASSIC",
    teamCount: 3,
    rounds: 1,
  }));

  const teamNames = ["Альфа", "Бета", "Гамма"];
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
  const [alphaEntryId, betaEntryId, gammaEntryId] = entryIds;

  ({ id: groupId } = await db.group.findUniqueOrThrow({ where: { tournamentId } }));

  for (const entryId of entryIds) {
    await db.groupSlot.create({ data: { groupId, entryId } });
  }

  await db.match.create({
    data: {
      tournamentId,
      groupId,
      stage: "GROUP",
      homeEntryId: alphaEntryId,
      awayEntryId: betaEntryId,
      sets: { create: sweepSets },
    },
  });
  await db.match.create({
    data: {
      tournamentId,
      groupId,
      stage: "GROUP",
      homeEntryId: betaEntryId,
      awayEntryId: gammaEntryId,
      sets: { create: sweepSets },
    },
  });
  await db.match.create({
    data: {
      tournamentId,
      groupId,
      stage: "GROUP",
      homeEntryId: gammaEntryId,
      awayEntryId: alphaEntryId,
      sets: { create: sweepSets },
    },
  });

  const standings = await getStandings(tournamentId);
  check("getStandings returns all 3 entries", standings.length === 3);
  check(
    "the 3-way cycle falls all the way to the name fallback, flagged for manual seed",
    standings.every((row) => row.needsManualSeed),
  );
  check(
    "final order matches Ukrainian-collated team names (Альфа, Бета, Гамма)",
    standings.map((row) => row.row.entryId).join(",") ===
      [alphaEntryId, betaEntryId, gammaEntryId].join(","),
  );
  check(
    "every row shows 1 win, 1 loss, 3 points, 3 sets won, 3 sets lost",
    standings.every(
      (row) =>
        row.row.wins === 1 &&
        row.row.losses === 1 &&
        row.row.points === 3 &&
        row.row.setsWon === 3 &&
        row.row.setsLost === 3,
    ),
  );

  const drafted = await createTournamentRecord({
    discipline: "CLASSIC",
    type: "CHAMPIONSHIP",
    name: `__verify_group_stage_draft__${stamp}`,
    year: 2026,
    scoringPreset: "CLASSIC",
    teamCount: 2,
    rounds: 1,
  });
  const preDrawStandings = await getStandings(drafted.id);
  check("a pre-draw tournament (no GroupSlot rows) returns an empty table", preDrawStandings.length === 0);
  await db.tournament.delete({ where: { id: drafted.id } });

  // A separate, minimal "clear winner" scenario — the far more common case
  // than the 3-way cycle above, and one the story's original verify script
  // never exercised through the real Prisma-to-domain pipeline.
  const clearWinner = await createTournamentRecord({
    discipline: "CLASSIC",
    type: "CHAMPIONSHIP",
    name: `__verify_group_stage_clear__${stamp}`,
    year: 2026,
    scoringPreset: "CLASSIC",
    teamCount: 2,
    rounds: 1,
  });
  const winnerTeam = await db.team.create({
    data: { name: `Переможець ${stamp}`, nameKey: `переможець ${stamp}`.toLowerCase() },
  });
  const loserTeam = await db.team.create({
    data: { name: `Переможений ${stamp}`, nameKey: `переможений ${stamp}`.toLowerCase() },
  });
  const { id: winnerEntryId } = await createEntry(clearWinner.id, winnerTeam.id);
  const { id: loserEntryId } = await createEntry(clearWinner.id, loserTeam.id);
  const { id: clearGroupId } = await db.group.findUniqueOrThrow({
    where: { tournamentId: clearWinner.id },
  });
  await db.groupSlot.create({ data: { groupId: clearGroupId, entryId: winnerEntryId } });
  await db.groupSlot.create({ data: { groupId: clearGroupId, entryId: loserEntryId } });
  await db.match.create({
    data: {
      tournamentId: clearWinner.id,
      groupId: clearGroupId,
      stage: "GROUP",
      homeEntryId: winnerEntryId,
      awayEntryId: loserEntryId,
      sets: { create: sweepSets },
    },
  });
  const clearStandings = await getStandings(clearWinner.id);
  check(
    "a clear 3:0 winner ranks first with 3 points, no manual seed needed",
    clearStandings[0]?.row.entryId === winnerEntryId &&
      clearStandings[0].row.points === 3 &&
      !clearStandings[0].needsManualSeed,
  );
  check(
    "the loser ranks second with 0 points",
    clearStandings[1]?.row.entryId === loserEntryId && clearStandings[1].row.points === 0,
  );
  await deleteEntry(clearWinner.id, winnerEntryId).catch(() => undefined);
  await deleteEntry(clearWinner.id, loserEntryId).catch(() => undefined);
  await db.tournament.delete({ where: { id: clearWinner.id } });
  await db.team.delete({ where: { id: winnerTeam.id } });
  await db.team.delete({ where: { id: loserTeam.id } });

  // CHECK constraint: a GROUP-stage match must have a non-null groupId.
  let groupStageCheckRejected = false;
  try {
    await db.match.create({
      data: { tournamentId, stage: "GROUP", groupId: null, homeEntryId: alphaEntryId, awayEntryId: betaEntryId },
    });
  } catch {
    groupStageCheckRejected = true;
  }
  check("CHECK match_group_stage_check rejects a GROUP match with a null groupId", groupStageCheckRejected);

  // CHECK constraint: a match's two entries must differ once both are known.
  let distinctEntriesCheckRejected = false;
  try {
    await db.match.create({
      data: {
        tournamentId,
        stage: "SEMIFINAL",
        homeEntryId: alphaEntryId,
        awayEntryId: alphaEntryId,
      },
    });
  } catch {
    distinctEntriesCheckRejected = true;
  }
  check(
    "CHECK match_distinct_entries_check rejects a match where home === away",
    distinctEntriesCheckRejected,
  );

  // CHECK constraint (code-review follow-up): a GROUP-stage match must have
  // both entries set, not just a non-null groupId.
  let groupEntriesRequiredCheckRejected = false;
  try {
    await db.match.create({
      data: { tournamentId, groupId, stage: "GROUP", homeEntryId: alphaEntryId, awayEntryId: null },
    });
  } catch {
    groupEntriesRequiredCheckRejected = true;
  }
  check(
    "CHECK match_group_entries_required_check rejects a GROUP match with a null awayEntryId",
    groupEntriesRequiredCheckRejected,
  );

  // CHECK constraint (code-review follow-up): SetScore.setNo must be 1-5.
  let setNoCheckRejected = false;
  try {
    const badMatch = await db.match.create({
      data: { tournamentId, groupId, stage: "GROUP", homeEntryId: alphaEntryId, awayEntryId: betaEntryId },
    });
    try {
      await db.setScore.create({ data: { matchId: badMatch.id, setNo: 0, homePoints: 25, awayPoints: 20 } });
    } catch {
      setNoCheckRejected = true;
    } finally {
      await db.match.delete({ where: { id: badMatch.id } }).catch(() => undefined);
    }
  } catch {
    // Match creation itself failing would also make this check meaningless —
    // treat as not-rejected so the assertion below reports it accurately.
  }
  check("CHECK set_score_set_no_check rejects setNo = 0", setNoCheckRejected);

  // CHECK constraint (from the original Task 2 migration): SetScore points
  // must be non-negative. Never actually tested until this fix pass.
  let pointsCheckRejected = false;
  try {
    const badMatch = await db.match.create({
      data: { tournamentId, groupId, stage: "GROUP", homeEntryId: alphaEntryId, awayEntryId: betaEntryId },
    });
    try {
      await db.setScore.create({ data: { matchId: badMatch.id, setNo: 1, homePoints: -1, awayPoints: 20 } });
    } catch {
      pointsCheckRejected = true;
    } finally {
      await db.match.delete({ where: { id: badMatch.id } }).catch(() => undefined);
    }
  } catch {
    // Match creation itself failing would also make this check meaningless —
    // treat as not-rejected so the assertion below reports it accurately.
  }
  check("CHECK set_score_points_check rejects a negative homePoints", pointsCheckRejected);
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
