import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Regression check for finishing a tournament (Story 4.5):
//   pnpm exec tsx scripts/verify-finish-tournament.mts
// Self-cleaning — one throwaway 4-team tournament: draw, record every group
// result, form the playoff, play both semifinals, then assert:
//   - finalAndThirdPlacePlayed is false until BOTH the final and the third-place
//     match have a result (playing only the final is not enough);
//   - checkTransition(PLAYOFF -> COMPLETED) is refused while the precondition is
//     unmet and allowed once both are played;
//   - checkCanEditResults blocks result editing only in COMPLETED;
//   - after setTournamentState(..., COMPLETED) the reloaded state trips the
//     result-edit lock (the action-layer wiring is the standing "no session
//     harness" gap — asserted at the predicate level, as verify-advance-bracket
//     does for the semifinal gate).
// Full teardown.

const { db } = await import("../src/data/client");
const { createTournamentRecord, getTournamentForAdmin, setTournamentState } = await import(
  "../src/data/tournaments"
);
const { createEntry, deleteEntry } = await import("../src/data/entries");
const { saveDraw } = await import("../src/data/draw");
const { createMatchResult, finalAndThirdPlacePlayed, getStandings } = await import(
  "../src/data/matches"
);
const { getPlayoffBracket, savePlayoffAdvancement, savePlayoffFormation } = await import(
  "../src/data/playoff"
);
const { seedPlayoff } = await import("../src/domain/bracket");
const { checkCanEditResults, checkTransition } = await import("../src/domain/tournamentState");

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
    name: `__verify_finish__${stamp}`,
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

  const semifinals = await db.match.findMany({ where: { tournamentId, stage: "SEMIFINAL" } });
  const sf1 = semifinals.find((match) => match.slot === "SF1")!;
  const sf2 = semifinals.find((match) => match.slot === "SF2")!;

  // --- both semifinals played, final / third-place not yet ---
  await createMatchResult(tournamentId, sf1.id, sweep(true)); // seed1 beats seed4
  await createMatchResult(tournamentId, sf2.id, sweep(true)); // seed2 beats seed3
  await savePlayoffAdvancement(tournamentId);

  check(
    "finalAndThirdPlacePlayed is false while the final and third-place have no result",
    (await finalAndThirdPlacePlayed(tournamentId)) === false,
  );
  check(
    "checkTransition PLAYOFF -> COMPLETED is refused (PRECONDITION_FAILED) before the deciders are played",
    (() => {
      const r = checkTransition("PLAYOFF", "COMPLETED", { finalAndThirdPlacePlayed: false });
      return !r.ok && r.code === "PRECONDITION_FAILED";
    })(),
  );

  const bracket = await getPlayoffBracket(tournamentId);

  // --- play the final only ---
  await createMatchResult(tournamentId, bracket.final.matchId!, sweep(true)); // seed1 wins
  check(
    "finalAndThirdPlacePlayed is still false when only the final is played",
    (await finalAndThirdPlacePlayed(tournamentId)) === false,
  );

  // --- play the third-place match ---
  await createMatchResult(tournamentId, bracket.thirdPlace.matchId!, sweep(true)); // seed4 wins
  check(
    "finalAndThirdPlacePlayed is true once both the final and third-place have a result",
    (await finalAndThirdPlacePlayed(tournamentId)) === true,
  );
  check(
    "checkTransition PLAYOFF -> COMPLETED is allowed once both deciders are played",
    checkTransition("PLAYOFF", "COMPLETED", { finalAndThirdPlacePlayed: true }).ok === true,
  );

  // --- the result-edit lock ---
  check(
    "checkCanEditResults allows editing in PLAYOFF",
    checkCanEditResults("PLAYOFF").ok === true,
  );
  check("checkCanEditResults blocks editing in COMPLETED", (() => {
    const r = checkCanEditResults("COMPLETED");
    return !r.ok && r.message.length > 0;
  })());

  // --- finish the tournament, then confirm the lock via the reloaded state ---
  await setTournamentState(tournamentId, "COMPLETED");
  const finished = await getTournamentForAdmin(tournamentId);
  check("tournament state is COMPLETED after the transition", finished?.state === "COMPLETED");
  check(
    "a result edit is blocked once the reloaded state is COMPLETED",
    finished !== null && checkCanEditResults(finished.state).ok === false,
  );
  check(
    "finalAndThirdPlacePlayed stays true in COMPLETED (results are frozen, not removed)",
    (await finalAndThirdPlacePlayed(tournamentId)) === true,
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
