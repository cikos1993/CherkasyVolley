import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Regression check for Story 3.5's match scheduling:
//   pnpm exec tsx scripts/verify-match-schedule.mts
// Self-cleaning — draws two throwaway 4-team tournaments, then against the
// first one exercises updateMatchSchedule / listGroupMatchesForTournament
// directly (bypassing requireAdmin, like every prior verify script) and
// asserts: the write lands, a mismatched (tournamentId, matchId) pair writes
// nothing, clearing to null works, an already-recorded SetScore survives a
// reschedule, and the list read is scoped + ordered correctly. Full teardown.

const { db } = await import("../src/data/client");
const { createTournamentRecord, getTournamentForAdmin } = await import("../src/data/tournaments");
const { createEntry, deleteEntry } = await import("../src/data/entries");
const { saveDraw } = await import("../src/data/draw");
const { listGroupMatchesForTournament, updateMatchSchedule } = await import("../src/data/matches");
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

async function drawThrowawayTournament(suffix: string): Promise<string> {
  const { id: tournamentId } = await createTournamentRecord({
    discipline: "CLASSIC",
    type: "CHAMPIONSHIP",
    name: `__verify_schedule_${suffix}__${stamp}`,
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
  return tournamentId;
}

try {
  const tournamentId = await drawThrowawayTournament("a");
  const otherTournamentId = await drawThrowawayTournament("b");

  const matches = await listGroupMatchesForTournament(tournamentId);
  check("listGroupMatchesForTournament returns C(4,2) = 6 matches", matches.length === 6);
  check(
    "every returned match has both team names",
    matches.every((m) => m.homeEntry?.team.name && m.awayEntry?.team.name),
  );

  const targetId = matches[0].id;
  const when = new Date("2026-06-13T08:00:00.000Z");

  const first = await updateMatchSchedule(tournamentId, targetId, {
    scheduledAt: when,
    venueText: "СК «Спартак»",
  });
  check("updateMatchSchedule reports count 1 for a matching pair", first.count === 1);

  const afterSet = await db.match.findUniqueOrThrow({ where: { id: targetId } });
  check(
    "scheduledAt / venueText persisted",
    afterSet.scheduledAt?.getTime() === when.getTime() && afterSet.venueText === "СК «Спартак»",
  );

  const mismatch = await updateMatchSchedule(otherTournamentId, targetId, {
    scheduledAt: null,
    venueText: "нікуди",
  });
  check("updateMatchSchedule reports count 0 for a cross-tournament pair", mismatch.count === 0);
  const afterMismatch = await db.match.findUniqueOrThrow({ where: { id: targetId } });
  check(
    "the row is untouched after the mismatched write",
    afterMismatch.scheduledAt?.getTime() === when.getTime() &&
      afterMismatch.venueText === "СК «Спартак»",
  );

  const cleared = await updateMatchSchedule(tournamentId, targetId, {
    scheduledAt: null,
    venueText: null,
  });
  check("clearing to null reports count 1", cleared.count === 1);
  const afterClear = await db.match.findUniqueOrThrow({ where: { id: targetId } });
  check(
    "scheduledAt / venueText are null after clearing",
    afterClear.scheduledAt === null && afterClear.venueText === null,
  );

  const setScore = await db.setScore.create({
    data: { matchId: targetId, setNo: 1, homePoints: 25, awayPoints: 20 },
  });
  await updateMatchSchedule(tournamentId, targetId, {
    scheduledAt: when,
    venueText: "інший зал",
  });
  const setAfterReschedule = await db.setScore.findUnique({ where: { id: setScore.id } });
  check(
    "an already-recorded SetScore survives a reschedule unchanged",
    setAfterReschedule?.homePoints === 25 && setAfterReschedule?.awayPoints === 20,
  );

  // Schedule a second match to an EARLIER instant than targetId, so the list
  // order actually distinguishes asc from desc (with one scheduled match,
  // nulls-last alone would satisfy either direction).
  const earlierId = matches[1].id;
  const earlier = new Date("2026-06-10T08:00:00.000Z");
  await updateMatchSchedule(tournamentId, earlierId, { scheduledAt: earlier, venueText: null });

  const ordered = await listGroupMatchesForTournament(tournamentId);
  const earlierPos = ordered.findIndex((m) => m.id === earlierId);
  const targetPos = ordered.findIndex((m) => m.id === targetId);
  check("earlier-scheduled match precedes the later one", earlierPos === 0 && earlierPos < targetPos);
  check(
    "both scheduled matches precede every unscheduled one",
    ordered.slice(0, 2).every((m) => m.scheduledAt !== null) &&
      ordered.slice(2).every((m) => m.scheduledAt === null),
  );

  // A SEMIFINAL match on the same tournament must be invisible to the GROUP read
  // and immune to the GROUP-scoped write.
  const semifinal = await db.match.create({
    data: { tournamentId, stage: "SEMIFINAL", groupId: null, homeEntryId: null, awayEntryId: null },
  });
  const playoffWrite = await updateMatchSchedule(tournamentId, semifinal.id, {
    scheduledAt: earlier,
    venueText: "не має спрацювати",
  });
  check("updateMatchSchedule refuses a non-GROUP match (count 0)", playoffWrite.count === 0);
  const semifinalAfter = await db.match.findUniqueOrThrow({ where: { id: semifinal.id } });
  check(
    "the SEMIFINAL match is untouched by the GROUP-scoped write",
    semifinalAfter.scheduledAt === null && semifinalAfter.venueText === null,
  );

  const withPlayoff = await listGroupMatchesForTournament(tournamentId);
  check(
    "listGroupMatchesForTournament still returns only the 6 GROUP matches",
    withPlayoff.length === 6 && !withPlayoff.some((m) => m.id === semifinal.id),
  );
} finally {
  for (const tournamentId of tournamentIds) {
    const entries = await db.tournamentEntry.findMany({ where: { tournamentId }, select: { id: true } });
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
    `throwaway tournament ${tournamentId} deleted (cascades group/slots/matches/sets)`,
    (await db.tournament.findUnique({ where: { id: tournamentId } })) === null,
  );
}
for (const teamId of teamIds) {
  check(
    `throwaway team ${teamId} deleted`,
    (await db.team.findUnique({ where: { id: teamId } })) === null,
  );
}

await db.$disconnect();
process.exit(failed ? 1 : 0);
