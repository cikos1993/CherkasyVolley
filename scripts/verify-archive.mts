import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Regression check for the yearly archive reads and the /classic list filter:
//   pnpm exec tsx scripts/verify-archive.mts
// Self-cleaning — three throwaway tournaments (COMPLETED / GROUP_STAGE / DRAFT),
// state forced directly via setTournamentState (the list reads only care about
// the state column, not a real playoff). Asserts:
//   - listArchivedTournaments sees only the COMPLETED one, newest year first;
//   - getArchivedTournament is COMPLETED-only;
//   - listPublicTournaments now excludes COMPLETED but still includes GROUP_STAGE;
//   - getPublicTournament still resolves a COMPLETED tournament (a direct link);
//   - standingsTableRows numbers positions and marks the top four.
// Full teardown.

const { db } = await import("../src/data/client");
const {
  createTournamentRecord,
  setTournamentState,
  getPublicTournament,
  listPublicTournaments,
  getArchivedTournament,
  listArchivedTournaments,
} = await import("../src/data/tournaments");
const { standingsTableRows } = await import("../src/data/matches");

let failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failed++;
}

const stamp = Date.now();
let completedOld: string | null = null;
let completedNew: string | null = null;
let groupStage: string | null = null;
let draft: string | null = null;

const make = (name: string, year: number) =>
  createTournamentRecord({
    discipline: "CLASSIC",
    type: "CHAMPIONSHIP",
    name: `${name}__${stamp}`,
    year,
    scoringPreset: "CLASSIC",
    teamCount: 2,
    rounds: 1,
  });

try {
  ({ id: completedOld } = await make("__verify_archive_done_2024", 2024));
  ({ id: completedNew } = await make("__verify_archive_done_2026", 2026));
  ({ id: groupStage } = await make("__verify_archive_live", 2026));
  ({ id: draft } = await make("__verify_archive_draft", 2026));
  await setTournamentState(completedOld, "COMPLETED");
  await setTournamentState(completedNew, "COMPLETED");
  await setTournamentState(groupStage, "GROUP_STAGE");

  const archived = await listArchivedTournaments();
  const archivedIds = archived.map((t) => t.id);
  check(
    "listArchivedTournaments includes both COMPLETED tournaments",
    archivedIds.includes(completedOld) && archivedIds.includes(completedNew),
  );
  check(
    "listArchivedTournaments excludes the GROUP_STAGE and DRAFT tournaments",
    !archivedIds.includes(groupStage) && !archivedIds.includes(draft),
  );
  check(
    "listArchivedTournaments orders newest year first",
    archivedIds.indexOf(completedNew) < archivedIds.indexOf(completedOld),
  );

  check(
    "getArchivedTournament resolves a COMPLETED tournament",
    (await getArchivedTournament(completedNew))?.id === completedNew,
  );
  check(
    "getArchivedTournament returns null for a GROUP_STAGE tournament",
    (await getArchivedTournament(groupStage)) === null,
  );

  const publicIds = (await listPublicTournaments()).map((t) => t.id);
  check("listPublicTournaments excludes COMPLETED tournaments", !publicIds.includes(completedNew));
  check("listPublicTournaments includes the GROUP_STAGE tournament", publicIds.includes(groupStage));
  check("listPublicTournaments excludes the DRAFT tournament", !publicIds.includes(draft));
  check(
    "getPublicTournament still resolves a COMPLETED tournament (direct link)",
    (await getPublicTournament(completedNew))?.id === completedNew,
  );

  const fakeStandings = Array.from({ length: 5 }, (_, i) => ({
    row: { entryId: `e${i}`, played: 3, wins: 2, losses: 1, points: 6, setsWon: 6, setsLost: 3 },
    needsManualSeed: false,
    teamName: `T${i}`,
  }));
  const rows = standingsTableRows(fakeStandings);
  check(
    "standingsTableRows numbers positions 1..N",
    rows[0].position === 1 && rows[4].position === 5,
  );
  check(
    "standingsTableRows marks the top four when more than four teams",
    rows[0].qualifies && rows[3].qualifies && !rows[4].qualifies,
  );
  check(
    "standingsTableRows adds no marker with exactly four teams",
    standingsTableRows(fakeStandings.slice(0, 4)).every((r) => !r.qualifies),
  );
} finally {
  for (const id of [completedOld, completedNew, groupStage, draft]) {
    if (id) await db.tournament.delete({ where: { id } }).catch(() => undefined);
  }
}

for (const id of [completedOld, completedNew, groupStage, draft]) {
  if (id) {
    check(
      `throwaway tournament ${id} deleted`,
      (await db.tournament.findUnique({ where: { id } })) === null,
    );
  }
}

await db.$disconnect();
process.exit(failed ? 1 : 0);
