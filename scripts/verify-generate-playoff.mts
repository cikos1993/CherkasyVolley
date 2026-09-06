import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Regression check for Story 4.2's playoff formation — the first real writer of
// SEMIFINAL Match rows and the first real GROUP_STAGE -> PLAYOFF transition:
//   pnpm exec tsx scripts/verify-generate-playoff.mts
// Self-cleaning — bypasses requireAdmin the same way every prior verify script
// does. Two throwaway 4-team tournaments:
//   1. clean ranking -> allGroupMatchesPlayed false/true, checkTransition
//      refusal, savePlayoffFormation seeds SF1/SF2 (1v4, 2v3) and flips state,
//      a second formation reports `already_formed`, the match_slot_stage_check
//      CHECK rejects a slot-less playoff match and a slotted group match;
//   2. a 3-way top-of-table cycle -> seedPlayoff.needsManualSeed, and the
//      in-transaction allGroupMatchesPlayed re-check aborts formation with
//      `group_incomplete` (writing nothing) after a group result is deleted.
// Full teardown at the end.

const { db } = await import("../src/data/client");
const { createTournamentRecord, getTournamentForAdmin } = await import("../src/data/tournaments");
const { createEntry, deleteEntry } = await import("../src/data/entries");
const { saveDraw } = await import("../src/data/draw");
const { allGroupMatchesPlayed, createMatchResult, getStandings } = await import("../src/data/matches");
const { savePlayoffFormation } = await import("../src/data/playoff");
const { seedPlayoff } = await import("../src/domain/bracket");
const { checkTransition } = await import("../src/domain/tournamentState");

let failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failed++;
}

const sweep = (homeWins: boolean) =>
  [1, 2, 3].map((setNo) => ({
    setNo,
    homePoints: homeWins ? 25 : 10,
    awayPoints: homeWins ? 10 : 25,
  }));

const stamp = Date.now();
const teamIds: string[] = [];
const entryIds: string[] = [];
let tournamentId: string | null = null;

const tie: { tournamentId: string | null; teamIds: string[]; entryIds: string[] } = {
  tournamentId: null,
  teamIds: [],
  entryIds: [],
};

try {
  ({ id: tournamentId } = await createTournamentRecord({
    discipline: "CLASSIC",
    type: "CHAMPIONSHIP",
    name: `__verify_playoff__${stamp}`,
    year: 2026,
    scoringPreset: "CLASSIC",
    teamCount: 4,
    rounds: 1,
  }));

  // Team creation order = strength order: teamIds[0] beats everyone, [3] loses all.
  for (const name of ["Альфа", "Бета", "Гамма", "Дельта"]) {
    const teamName = `${name} ${stamp}`;
    const team = await db.team.create({ data: { name: teamName, nameKey: teamName.toLowerCase() } });
    teamIds.push(team.id);
  }
  for (const teamId of teamIds) {
    const { id } = await createEntry(tournamentId, teamId);
    entryIds.push(id);
  }
  const rankOf = Object.fromEntries(entryIds.map((entryId, index) => [entryId, index]));

  const tournament = await getTournamentForAdmin(tournamentId);
  if (!tournament?.group) throw new Error("throwaway tournament has no group");

  const pairings: { homeEntryId: string; awayEntryId: string }[] = [];
  for (let i = 0; i < entryIds.length; i++) {
    for (let j = i + 1; j < entryIds.length; j++) {
      pairings.push({ homeEntryId: entryIds[i], awayEntryId: entryIds[j] });
    }
  }
  await saveDraw(tournamentId, tournament.group.id, entryIds, pairings);

  const matches = await db.match.findMany({
    where: { tournamentId, stage: "GROUP" },
    orderBy: { createdAt: "asc" },
  });
  check("draw created C(4,2) = 6 group matches", matches.length === 6);

  // Record every group result except the last — the stronger team (lower rank) wins.
  for (const match of matches.slice(0, -1)) {
    const homeWins = rankOf[match.homeEntryId!] < rankOf[match.awayEntryId!];
    const result = await createMatchResult(tournamentId, match.id, sweep(homeWins));
    if (!result.ok) throw new Error(`createMatchResult failed: ${result.reason}`);
  }

  check(
    "allGroupMatchesPlayed is false while one group match has no result",
    (await allGroupMatchesPlayed(tournamentId)) === false,
  );
  const earlyCheck = checkTransition("GROUP_STAGE", "PLAYOFF", { allGroupMatchesPlayed: false });
  check(
    "checkTransition refuses the playoff while a group match is unplayed",
    !earlyCheck.ok && earlyCheck.code === "PRECONDITION_FAILED",
  );

  const lastMatch = matches[matches.length - 1];
  const lastHomeWins = rankOf[lastMatch.homeEntryId!] < rankOf[lastMatch.awayEntryId!];
  const lastResult = await createMatchResult(tournamentId, lastMatch.id, sweep(lastHomeWins));
  if (!lastResult.ok) throw new Error(`createMatchResult failed: ${lastResult.reason}`);

  check(
    "allGroupMatchesPlayed is true once every group match has a result",
    (await allGroupMatchesPlayed(tournamentId)) === true,
  );

  const standings = await getStandings(tournamentId);
  check(
    "standings order is Альфа > Бета > Гамма > Дельта",
    standings.map((row) => rankOf[row.row.entryId]).join(",") === "0,1,2,3",
  );

  const bracket = seedPlayoff(standings);
  const formation = await savePlayoffFormation(tournamentId, bracket);
  check("savePlayoffFormation succeeded", formation.ok);

  const playoffMatches = await db.match.findMany({
    where: { tournamentId, stage: "SEMIFINAL" },
  });
  check("two SEMIFINAL Match rows were created", playoffMatches.length === 2);
  check(
    "every semifinal has groupId null and a slot",
    playoffMatches.every((match) => match.groupId === null && match.slot !== null),
  );

  const sf1 = playoffMatches.find((match) => match.slot === "SF1");
  const sf2 = playoffMatches.find((match) => match.slot === "SF2");
  check(
    "SF1 pairs seed 1 (home) against seed 4 (away)",
    sf1?.homeEntryId === standings[0].row.entryId && sf1?.awayEntryId === standings[3].row.entryId,
  );
  check(
    "SF2 pairs seed 2 (home) against seed 3 (away)",
    sf2?.homeEntryId === standings[1].row.entryId && sf2?.awayEntryId === standings[2].row.entryId,
  );

  const afterFormation = await db.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
  check("Tournament.state is now PLAYOFF", afterFormation.state === "PLAYOFF");

  // A second formation reports `already_formed` and writes nothing.
  const second = await savePlayoffFormation(tournamentId, bracket);
  check(
    "a second savePlayoffFormation reports already_formed",
    !second.ok && second.reason === "already_formed",
  );
  check(
    "SEMIFINAL row count unchanged after the rejected second formation",
    (await db.match.count({ where: { tournamentId, stage: "SEMIFINAL" } })) === 2,
  );

  // CHECK match_slot_stage_check: a playoff match needs a slot; a GROUP match must not have one.
  let semifinalWithoutSlotRejected = false;
  try {
    await db.match.create({ data: { tournamentId, stage: "SEMIFINAL", groupId: null } });
  } catch {
    semifinalWithoutSlotRejected = true;
  }
  check("CHECK rejects a SEMIFINAL match with a null slot", semifinalWithoutSlotRejected);

  let groupWithSlotRejected = false;
  try {
    await db.match.create({
      data: {
        tournamentId,
        stage: "GROUP",
        groupId: tournament.group.id,
        slot: "SF1",
        homeEntryId: entryIds[0],
        awayEntryId: entryIds[1],
      },
    });
  } catch {
    groupWithSlotRejected = true;
  }
  check("CHECK rejects a GROUP match with a slot", groupWithSlotRejected);

  // --- second throwaway: a 3-way top-of-table cycle (needsManualSeed) + the
  //     in-transaction allGroupMatchesPlayed re-check (TOCTOU) ---
  ({ id: tie.tournamentId } = await createTournamentRecord({
    discipline: "CLASSIC",
    type: "CHAMPIONSHIP",
    name: `__verify_playoff_tie__${stamp}`,
    year: 2026,
    scoringPreset: "CLASSIC",
    teamCount: 4,
    rounds: 1,
  }));
  for (const name of ["Схід", "Захід", "Північ", "Південь"]) {
    const teamName = `${name} ${stamp}`;
    const team = await db.team.create({ data: { name: teamName, nameKey: teamName.toLowerCase() } });
    tie.teamIds.push(team.id);
  }
  for (const teamId of tie.teamIds) {
    const { id } = await createEntry(tie.tournamentId, teamId);
    tie.entryIds.push(id);
  }
  const [x, y, z, loser] = tie.entryIds;
  const tieTournament = await getTournamentForAdmin(tie.tournamentId);
  if (!tieTournament?.group) throw new Error("tie tournament has no group");
  // x>y, y>z, z>x (cycle); x, y, z each sweep the loser. All three end level on
  // points, head-to-head and sets — forced to the deterministic name fallback.
  const tiePairs: { homeEntryId: string; awayEntryId: string }[] = [
    { homeEntryId: x, awayEntryId: y },
    { homeEntryId: y, awayEntryId: z },
    { homeEntryId: z, awayEntryId: x },
    { homeEntryId: x, awayEntryId: loser },
    { homeEntryId: y, awayEntryId: loser },
    { homeEntryId: z, awayEntryId: loser },
  ];
  await saveDraw(tie.tournamentId, tieTournament.group.id, tie.entryIds, tiePairs);
  const tieMatches = await db.match.findMany({
    where: { tournamentId: tie.tournamentId, stage: "GROUP" },
    orderBy: { createdAt: "asc" },
  });
  for (const match of tieMatches) {
    // Every pairing above is listed home-wins.
    const result = await createMatchResult(tie.tournamentId, match.id, sweep(true));
    if (!result.ok) throw new Error(`tie createMatchResult failed: ${result.reason}`);
  }

  const tieStandings = await getStandings(tie.tournamentId);
  check(
    "the 3-way cycle forces needsManualSeed on the seeded bracket",
    seedPlayoff(tieStandings).needsManualSeed === true,
  );

  // Delete one group result, then form the playoff — the in-transaction
  // re-check must abort with `group_incomplete` and write nothing.
  await db.setScore.deleteMany({ where: { matchId: tieMatches[0].id } });
  const incomplete = await savePlayoffFormation(tie.tournamentId, seedPlayoff(tieStandings));
  check(
    "savePlayoffFormation aborts when a group result vanished mid-flow",
    !incomplete.ok && incomplete.reason === "group_incomplete",
  );
  check(
    "no SEMIFINAL rows written and state unchanged after the aborted formation",
    (await db.match.count({ where: { tournamentId: tie.tournamentId, stage: "SEMIFINAL" } })) === 0 &&
      (await db.tournament.findUniqueOrThrow({ where: { id: tie.tournamentId } })).state === "GROUP_STAGE",
  );
} finally {
  for (const scope of [{ tournamentId, entryIds, teamIds }, tie]) {
    if (scope.tournamentId) {
      for (const entryId of scope.entryIds) {
        await deleteEntry(scope.tournamentId, entryId).catch(() => undefined);
      }
      await db.tournament.delete({ where: { id: scope.tournamentId } }).catch(() => undefined);
    }
    for (const teamId of scope.teamIds) {
      await db.team.delete({ where: { id: teamId } }).catch(() => undefined);
    }
  }
}

for (const id of [tournamentId, tie.tournamentId]) {
  if (id) {
    check(
      `throwaway tournament ${id} deleted (cascades group/slots/matches/sets)`,
      (await db.tournament.findUnique({ where: { id } })) === null,
    );
  }
}
for (const teamId of [...teamIds, ...tie.teamIds]) {
  check(`throwaway team ${teamId} deleted`, (await db.team.findUnique({ where: { id: teamId } })) === null);
}

await db.$disconnect();
process.exit(failed ? 1 : 0);
