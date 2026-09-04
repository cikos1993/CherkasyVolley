import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Regression check for the team create path (src/data/teams.ts):
//   pnpm exec tsx scripts/verify-team-create.mts
// Self-cleaning — creates a throwaway team, asserts the normalized name and
// case-folded nameKey, asserts a case/whitespace-different "duplicate" is
// rejected, then deletes it. Leaves the database as it found it.

const { db } = await import("../src/data/client");
const { createTeamRecord, TEAM_NAME_KEY_INDEX } = await import("../src/data/teams");
const { validateNewTeam } = await import("../src/domain/teamForm");
const { isUniqueViolation } = await import("../src/data/errors");

let failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failed++;
}

const stamp = Date.now();
const rawName = `  __verify_team__${stamp}   Спартак  `;

const parsed = validateNewTeam({ name: rawName });
if (!parsed.ok) throw new Error("expected validateNewTeam to succeed for a valid name");

let id: string | null = null;
let duplicateId: string | null = null;
try {
  ({ id } = await createTeamRecord(parsed.value));

  const row = await db.team.findUnique({ where: { id } });
  check("team row created", row !== null);
  check("name is trimmed and whitespace-collapsed", row?.name === parsed.value.name);
  check("nameKey is case-folded", row?.nameKey === parsed.value.name.toLowerCase());

  let duplicateRejected = false;
  try {
    // Same name, different case and whitespace — must collide on nameKey.
    const differentCasing = validateNewTeam({
      name: `  ${parsed.value.name.toUpperCase()}  `,
    });
    if (!differentCasing.ok) throw new Error("expected the re-cased name to validate");
    const duplicate = await createTeamRecord(differentCasing.value);
    // The constraint was supposed to reject this — record the id so the
    // cleanup below removes it too, so a regression here does not leak
    // debris even if the create above didn't throw.
    duplicateId = duplicate.id;
  } catch (error) {
    duplicateRejected = isUniqueViolation(error, TEAM_NAME_KEY_INDEX);
  }
  check("case/whitespace-different duplicate rejected as P2002 via nameKey", duplicateRejected);
} finally {
  if (duplicateId) await db.team.delete({ where: { id: duplicateId } }).catch(() => undefined);
  if (id) await db.team.delete({ where: { id } }).catch(() => undefined);
}

if (id) {
  const stillThere = await db.team.findUnique({ where: { id } });
  check("throwaway team deleted", stillThere === null);
}

await db.$disconnect();
process.exit(failed ? 1 : 0);
