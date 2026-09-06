import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Regression check for Story 4.2's playoff formation — the first real writer of
// SEMIFINAL Match rows and the first real GROUP_STAGE -> PLAYOFF transition:
//   pnpm exec tsx scripts/verify-generate-playoff.mts
// Self-cleaning — creates a throwaway 4-team tournament, draws it, records every
// group result, then exercises the pipeline formPlayoff runs (allGroupMatchesPlayed
// -> checkTransition -> getStandings -> seedPlayoff -> savePlayoffFormation)
// directly against src/data/src/domain, bypassing requireAdmin the same way every
// prior verify script does. Full teardown at the end.

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
  const semifinals = bracket.semifinals.map((semifinal) => ({
    slot: semifinal.slot,
    homeEntryId: semifinal.home!.entryId,
    awayEntryId: semifinal.away!.entryId,
  }));
  await savePlayoffFormation(tournamentId, semifinals);

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

  // Prove the transaction rolls back: a second formation must throw on the
  // "playoff already formed" guard and leave no extra SEMIFINAL rows.
  let secondFormationRejected = false;
  try {
    await savePlayoffFormation(tournamentId, semifinals);
  } catch {
    secondFormationRejected = true;
  }
  check("a second savePlayoffFormation throws", secondFormationRejected);
  const semifinalsAfterRetry = await db.match.count({
    where: { tournamentId, stage: "SEMIFINAL" },
  });
  check("SEMIFINAL row count unchanged after the rejected second formation", semifinalsAfterRetry === 2);
  const tournamentAfterRetry = await db.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
  check("Tournament.state still PLAYOFF after the rejected second formation", tournamentAfterRetry.state === "PLAYOFF");
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
