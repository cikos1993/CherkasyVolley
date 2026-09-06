import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Regression check for playoff auto-advance (Story 4.3) + final placements and
// the semifinal-edit gate (Story 4.4):
//   pnpm exec tsx scripts/verify-advance-bracket.mts
// Self-cleaning — one throwaway 4-team tournament: draw, record every group
// result, form the playoff, then drive semifinal result entry / edit / delete
// directly against src/data and assert the FINAL / THIRD_PLACE rows are
// created, updated, frozen once played, and cleared when a semifinal result is
// undone; that getPlayoffBracket().placements resolve to team names once the
// deciding matches are played; and that checkCanEditSemifinalResult blocks a
// semifinal edit once a downstream match has a result. Also probes the
// tightened match_slot_stage_check. Full teardown.

const { db } = await import("../src/data/client");
const { createTournamentRecord, getTournamentForAdmin } = await import("../src/data/tournaments");
const { createEntry, deleteEntry } = await import("../src/data/entries");
const { saveDraw } = await import("../src/data/draw");
const { createMatchResult, deleteMatchResult, getStandings, replaceMatchResult } = await import(
  "../src/data/matches"
);
const { getPlayoffBracket, readPlayoffMatchStates, savePlayoffAdvancement, savePlayoffFormation } =
  await import("../src/data/playoff");
const { checkCanEditSemifinalResult, seedPlayoff } = await import("../src/domain/bracket");

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

try {
  ({ id: tournamentId } = await createTournamentRecord({
    discipline: "CLASSIC",
    type: "CHAMPIONSHIP",
    name: `__verify_advance__${stamp}`,
    year: 2026,
    scoringPreset: "CLASSIC",
    teamCount: 4,
    rounds: 1,
  }));

  // Team creation order = final ranking: teamIds[0] wins everything, [3] loses all.
  for (const name of ["Один", "Два", "Три", "Чотири"]) {
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

  const groupMatches = await db.match.findMany({
    where: { tournamentId, stage: "GROUP" },
    orderBy: { createdAt: "asc" },
  });
  for (const match of groupMatches) {
    const homeWins = rankOf[match.homeEntryId!] < rankOf[match.awayEntryId!];
    const result = await createMatchResult(tournamentId, match.id, sweep(homeWins));
    if (!result.ok) throw new Error(`group createMatchResult failed: ${result.reason}`);
  }

  const standings = await getStandings(tournamentId);
  const formation = await savePlayoffFormation(tournamentId, seedPlayoff(standings));
  if (!formation.ok) throw new Error(`savePlayoffFormation failed: ${formation.reason}`);
  const [seed1, seed2, seed3, seed4] = standings.map((row) => row.row.entryId);

  const semifinals = await db.match.findMany({ where: { tournamentId, stage: "SEMIFINAL" } });
  const sf1 = semifinals.find((match) => match.slot === "SF1")!;
  const sf2 = semifinals.find((match) => match.slot === "SF2")!;

  // --- neither semifinal played: final / third-place are AWAITING, no rows ---
  let bracket = await getPlayoffBracket(tournamentId);
  check(
    "before any semifinal result, final and third-place are AWAITING with no matchId",
    bracket.final.status === "AWAITING" &&
      bracket.final.matchId === null &&
      bracket.thirdPlace.status === "AWAITING" &&
      bracket.thirdPlace.matchId === null,
  );

  // --- one semifinal played: still AWAITING ---
  await createMatchResult(tournamentId, sf1.id, sweep(true)); // seed1 beats seed4
  await savePlayoffAdvancement(tournamentId);
  check(
    "after one semifinal, downstream still AWAITING (FR-20 'обох')",
    (await db.match.count({ where: { tournamentId, stage: { in: ["FINAL", "THIRD_PLACE"] } } })) === 0,
  );

  // --- both semifinals played: FINAL and THIRD_PLACE rows created ---
  await createMatchResult(tournamentId, sf2.id, sweep(true)); // seed2 beats seed3
  await savePlayoffAdvancement(tournamentId);

  const finalAfterBoth = await db.match.findFirst({ where: { tournamentId, stage: "FINAL" } });
  const thirdAfterBoth = await db.match.findFirst({ where: { tournamentId, stage: "THIRD_PLACE" } });
  check(
    "FINAL row: seed1 vs seed2, slot FINAL, groupId null",
    finalAfterBoth?.homeEntryId === seed1 &&
      finalAfterBoth?.awayEntryId === seed2 &&
      finalAfterBoth?.slot === "FINAL" &&
      finalAfterBoth?.groupId === null,
  );
  check(
    "THIRD_PLACE row: seed4 vs seed3, slot THIRD_PLACE",
    thirdAfterBoth?.homeEntryId === seed4 &&
      thirdAfterBoth?.awayEntryId === seed3 &&
      thirdAfterBoth?.slot === "THIRD_PLACE",
  );

  bracket = await getPlayoffBracket(tournamentId);
  check(
    "getPlayoffBracket reports final READY with team names and a matchId",
    bracket.final.status === "READY" &&
      bracket.final.matchId === finalAfterBoth!.id &&
      bracket.final.homeTeam === standings[0].teamName &&
      bracket.final.awayTeam === standings[1].teamName,
  );
  check(
    "placements are all null while the final and third-place are unplayed",
    bracket.placements.first === null &&
      bracket.placements.second === null &&
      bracket.placements.third === null &&
      bracket.placements.fourth === null,
  );
  check(
    "checkCanEditSemifinalResult allows the edit while no downstream match is played",
    (checkCanEditSemifinalResult(await readPlayoffMatchStates(tournamentId))).ok === true,
  );

  // --- edit a semifinal before the final is played: downstream re-derives ---
  await replaceMatchResult(tournamentId, sf1.id, sweep(false)); // seed4 now beats seed1
  await savePlayoffAdvancement(tournamentId);
  const finalAfterEdit = await db.match.findFirst({ where: { tournamentId, stage: "FINAL" } });
  const thirdAfterEdit = await db.match.findFirst({ where: { tournamentId, stage: "THIRD_PLACE" } });
  check(
    "editing SF1 before the final is played moves seed4 into the final, seed1 into third-place",
    finalAfterEdit?.homeEntryId === seed4 &&
      finalAfterEdit?.awayEntryId === seed2 &&
      thirdAfterEdit?.homeEntryId === seed1 &&
      thirdAfterEdit?.awayEntryId === seed3,
  );

  // --- play the final, then edit SF1 again: the final is frozen, third-place still moves ---
  await createMatchResult(tournamentId, finalAfterEdit!.id, sweep(true)); // seed4 wins the final

  const gateAfterFinal = checkCanEditSemifinalResult(await readPlayoffMatchStates(tournamentId));
  check(
    "checkCanEditSemifinalResult blocks a semifinal edit once the final has a result",
    !gateAfterFinal.ok && gateAfterFinal.message.length > 0,
  );
  bracket = await getPlayoffBracket(tournamentId);
  check(
    "placements 1 and 2 come from the played final; 3 and 4 stay null until the third-place match",
    bracket.placements.first?.teamName === standings[3].teamName &&
      bracket.placements.second?.teamName === standings[1].teamName &&
      bracket.placements.third === null &&
      bracket.placements.fourth === null,
  );

  await replaceMatchResult(tournamentId, sf1.id, sweep(true)); // seed1 beats seed4 again
  await savePlayoffAdvancement(tournamentId);
  const finalAfterFreeze = await db.match.findFirst({ where: { tournamentId, stage: "FINAL" } });
  const thirdAfterFreeze = await db.match.findFirst({ where: { tournamentId, stage: "THIRD_PLACE" } });
  check(
    "the played final is frozen — a later SF1 edit does not move it",
    finalAfterFreeze?.homeEntryId === seed4 && finalAfterFreeze?.awayEntryId === seed2,
  );
  check(
    "the unplayed third-place match still re-derives (seed4 is the new SF1 loser)",
    thirdAfterFreeze?.homeEntryId === seed4 && thirdAfterFreeze?.awayEntryId === seed3,
  );

  // --- delete a semifinal result: the unplayed downstream row is cleared ---
  await deleteMatchResult(tournamentId, sf1.id);
  await savePlayoffAdvancement(tournamentId);
  const finalAfterDelete = await db.match.findFirst({ where: { tournamentId, stage: "FINAL" } });
  const thirdAfterDelete = await db.match.findFirst({ where: { tournamentId, stage: "THIRD_PLACE" } });
  check(
    "deleting SF1's result leaves the frozen final and clears the third-place pairing",
    finalAfterDelete?.homeEntryId === seed4 &&
      thirdAfterDelete?.homeEntryId === null &&
      thirdAfterDelete?.awayEntryId === null,
  );

  // getPlayoffBracket decorates the emptied-but-kept third-place row as AWAITING
  // with no teams — the surface must render «очікує суперників» and no result
  // link, so entering a result on a participant-less playoff match is blocked.
  bracket = await getPlayoffBracket(tournamentId);
  check(
    "getPlayoffBracket reports the emptied third-place row as AWAITING with null teams",
    bracket.thirdPlace.status === "AWAITING" &&
      bracket.thirdPlace.homeTeam === null &&
      bracket.thirdPlace.awayTeam === null,
  );

  // --- re-enter SF1, then play the third-place match: all four placements resolve ---
  await createMatchResult(tournamentId, sf1.id, sweep(false)); // seed4 beats seed1 (SF1 had no result)
  await savePlayoffAdvancement(tournamentId);
  const thirdRederived = await db.match.findFirst({ where: { tournamentId, stage: "THIRD_PLACE" } });
  await createMatchResult(tournamentId, thirdRederived!.id, sweep(true)); // seed1 wins third place
  bracket = await getPlayoffBracket(tournamentId);
  check(
    "placements 1-4 resolve to the right team names once the final and third-place are played",
    bracket.placements.first?.teamName === standings[3].teamName &&
      bracket.placements.second?.teamName === standings[1].teamName &&
      bracket.placements.third?.teamName === standings[0].teamName &&
      bracket.placements.fourth?.teamName === standings[2].teamName,
  );

  // --- CHECK match_slot_stage_check: a slot must match its stage ---
  let mismatchRejected = false;
  try {
    await db.match.create({
      data: { tournamentId, stage: "SEMIFINAL", slot: "FINAL", groupId: null },
    });
  } catch {
    mismatchRejected = true;
  }
  check("CHECK rejects stage SEMIFINAL with slot FINAL", mismatchRejected);
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
