import { db } from "@/data/client";
import type { NewTeamInput } from "@/domain/teamForm";

/**
 * Every team, ordered by name. No draft/privacy concept like `Tournament` —
 * a team is equally visible everywhere it's read from; the caller's own auth
 * context (or lack of one) decides who may call this.
 */
export function listTeams() {
  return db.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

/** The only creator of a `Team`. `nameKey` is computed by the caller (the
 * domain validator), never re-derived here. */
export function createTeamRecord(input: NewTeamInput): Promise<{ id: string }> {
  return db.team.create({
    data: { name: input.name, nameKey: input.nameKey },
    select: { id: true },
  });
}

/**
 * Deletes a team. `TournamentEntry.team` is `onDelete: Restrict`, so a team
 * that is entered in any tournament raises `P2003` (`isForeignKeyViolation`);
 * the caller turns that into a friendly refusal. `P2025` when the row is
 * already gone.
 */
export function deleteTeamRecord(id: string) {
  return db.team.delete({ where: { id } });
}

/** The Postgres index backing `Team`'s `nameKey @unique`. */
export const TEAM_NAME_KEY_INDEX = "team_nameKey_key";
