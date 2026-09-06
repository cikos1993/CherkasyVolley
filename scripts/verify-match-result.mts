import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Regression check for Story 3.6's match-result entry:
//   pnpm exec tsx scripts/verify-match-result.mts
// Self-cleaning — draws two throwaway 4-team tournaments (one CLASSIC, one
// CUSTOM), then exercises createMatchResult directly (bypassing requireAdmin,
// like every prior verify script) and asserts: a result persists and
// getStandings reflects it per preset; a second entry is refused ("exists");
// a cross-tournament pair and a SEMIFINAL match are refused ("not_found").
// Full teardown.

const { db } = await import("../src/data/client");
const { createTournamentRecord, getTournamentForAdmin } = await import("../src/data/tournaments");
const { createEntry, deleteEntry } = await import("../src/data/entries");
const { saveDraw } = await import("../src/data/draw");
const { getStandings, createMatchResult, SET_SCORE_NATURAL_KEY_INDEX } = await import(
  "../src/data/matches"
);
const { isUniqueViolation } = await import("../src/data/errors");
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

async function drawThrowawayTournament(
  suffix: string,
  scoringPreset: "CLASSIC" | "CUSTOM",
): Promise<{ tournamentId: string; entryIds: string[]; matchIds: string[] }> {
  const { id: tournamentId } = await createTournamentRecord({
    discipline: "CLASSIC",
    type: "CHAMPIONSHIP",
    name: `__verify_result_${suffix}__${stamp}`,
    year: 2026,
    scoringPreset,
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
  const transitionCheck = checkTransition(tournament.state, "GROUP_STAGE", {
    entryCount: 4,
    teamCount: 4,
  });
  if (!transitionCheck.ok) throw new Error("throwaway draw precondition failed");

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
  return { tournamentId, entryIds, matchIds: matches.map((m) => m.id) };
}

try {
  const classic = await drawThrowawayTournament("classic", "CLASSIC");
  const custom = await drawThrowawayTournament("custom", "CUSTOM");

  // --- CLASSIC: a 3:0 sweep ---
  const targetMatch = await db.match.findUniqueOrThrow({
    where: { id: classic.matchIds[0] },
    select: { homeEntryId: true, awayEntryId: true },
  });
  const saved = await createMatchResult(classic.tournamentId, classic.matchIds[0], [
    { setNo: 1, homePoints: 25, awayPoints: 20 },
    { setNo: 2, homePoints: 25, awayPoints: 18 },
    { setNo: 3, homePoints: 25, awayPoints: 22 },
  ]);
  check("createMatchResult ok for a valid CLASSIC 3:0", saved.ok === true);

  const setCount = await db.setScore.count({ where: { matchId: classic.matchIds[0] } });
  check("3 SetScore rows persisted", setCount === 3);

  // The concurrent-race path in createMatchResult relies on
  // SET_SCORE_NATURAL_KEY_INDEX matching the real constraint name — exercise
  // it directly (the createMatchResult "exists" case exits via the _count
  // branch and never reaches the P2002 catch).
  let dupError: unknown;
  try {
    await db.setScore.create({
      data: { matchId: classic.matchIds[0], setNo: 1, homePoints: 25, awayPoints: 15 },
    });
  } catch (error) {
    dupError = error;
  }
  check(
    "a duplicate (matchId, setNo) is recognised by isUniqueViolation(SET_SCORE_NATURAL_KEY_INDEX)",
    isUniqueViolation(dupError, SET_SCORE_NATURAL_KEY_INDEX),
  );

  const standings = await getStandings(classic.tournamentId);
  const homeRow = standings.find((s) => s.row.entryId === targetMatch.homeEntryId);
  const awayRow = standings.find((s) => s.row.entryId === targetMatch.awayEntryId);
  check(
    "getStandings: CLASSIC winner has played 1, wins 1, points 3, setsWon 3",
    homeRow?.row.played === 1 &&
      homeRow.row.wins === 1 &&
      homeRow.row.points === 3 &&
      homeRow.row.setsWon === 3 &&
      homeRow.row.setsLost === 0,
  );
  check(
    "getStandings: CLASSIC loser has losses 1, points 0",
    awayRow?.row.losses === 1 && awayRow.row.points === 0,
  );

  // --- a second entry on the same match is refused ---
  const again = await createMatchResult(classic.tournamentId, classic.matchIds[0], [
    { setNo: 1, homePoints: 25, awayPoints: 10 },
    { setNo: 2, homePoints: 25, awayPoints: 10 },
    { setNo: 3, homePoints: 25, awayPoints: 10 },
  ]);
  check("second createMatchResult on the same match → exists", !again.ok && again.reason === "exists");
  check(
    "still exactly 3 SetScore rows after the refused second entry",
    (await db.setScore.count({ where: { matchId: classic.matchIds[0] } })) === 3,
  );

  // --- cross-tournament pair is refused ---
  const crossTournament = await createMatchResult(custom.tournamentId, classic.matchIds[1], [
    { setNo: 1, homePoints: 25, awayPoints: 20 },
    { setNo: 2, homePoints: 25, awayPoints: 20 },
    { setNo: 3, homePoints: 25, awayPoints: 20 },
  ]);
  check(
    "createMatchResult with a cross-tournament matchId → not_found",
    !crossTournament.ok && crossTournament.reason === "not_found",
  );

  // --- a SEMIFINAL match is refused (stage scope) ---
  const semifinal = await db.match.create({
    data: {
      tournamentId: classic.tournamentId,
      stage: "SEMIFINAL",
      slot: "SF1",
      groupId: null,
      homeEntryId: null,
      awayEntryId: null,
    },
  });
  const playoffResult = await createMatchResult(classic.tournamentId, semifinal.id, [
    { setNo: 1, homePoints: 25, awayPoints: 20 },
    { setNo: 2, homePoints: 25, awayPoints: 20 },
    { setNo: 3, homePoints: 25, awayPoints: 20 },
  ]);
  check(
    "createMatchResult on a SEMIFINAL match → not_found",
    !playoffResult.ok && playoffResult.reason === "not_found",
  );

  // --- CUSTOM: 2:1, 1 point per set won ---
  const customMatch = await db.match.findUniqueOrThrow({
    where: { id: custom.matchIds[0] },
    select: { homeEntryId: true, awayEntryId: true },
  });
  const customSaved = await createMatchResult(custom.tournamentId, custom.matchIds[0], [
    { setNo: 1, homePoints: 25, awayPoints: 20 },
    { setNo: 2, homePoints: 18, awayPoints: 25 },
    { setNo: 3, homePoints: 25, awayPoints: 22 },
  ]);
  check("createMatchResult ok for a valid CUSTOM 2:1", customSaved.ok === true);

  const customStandings = await getStandings(custom.tournamentId);
  const customHome = customStandings.find((s) => s.row.entryId === customMatch.homeEntryId);
  const customAway = customStandings.find((s) => s.row.entryId === customMatch.awayEntryId);
  check(
    "getStandings: CUSTOM home earns 2 points (sets won), away earns 1",
    customHome?.row.points === 2 && customAway?.row.points === 1,
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
