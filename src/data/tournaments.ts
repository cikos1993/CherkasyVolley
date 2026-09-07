import type { TournamentState } from "@/generated/prisma/enums";

import { db } from "@/data/client";
import { Prisma } from "@/generated/prisma/client";
import type { NewTournamentInput } from "@/domain/tournamentForm";

/**
 * Reads a tournament by id including drafts, and with **no discipline
 * filter** — callers that need one must apply it themselves (see
 * `src/app/classic/_lib/resolve-tournament.ts`'s admin-preview fallback).
 * Call only from an admin-checked path: either a Server Action under
 * `requireAdmin()`/`requireAdminPage()`, or a read-only page-level preview
 * gated by an inline `user?.isAdmin` check via `getSessionUser()` (neither
 * of the former two fits a preview that must fail gracefully with `null`
 * rather than throw or redirect). The public list query filters
 * `state != DRAFT` and `discipline = CLASSIC` and lives in its own function.
 * Includes the tournament's `Group` id (one per tournament, created
 * alongside it — see `createTournamentRecord`) so callers like
 * `drawTournament` don't need a second query to find it.
 */
export function getTournamentForAdmin(id: string) {
  return db.tournament.findUnique({
    where: { id },
    include: { group: { select: { id: true } } },
  });
}

/**
 * The only writer of `Tournament.state`. The transition must already have been
 * validated (see `src/domain/tournamentState`) — this function performs no
 * checks. Do not add another function that writes `state`. `client` defaults
 * to the shared `db` instance; pass a `Prisma.TransactionClient` (from
 * `db.$transaction`) to write the state atomically alongside other writes —
 * see `src/data/draw.ts`'s `saveDraw`.
 */
export function setTournamentState(
  id: string,
  state: TournamentState,
  client: Prisma.TransactionClient | typeof db = db,
) {
  return client.tournament.update({ where: { id }, data: { state } });
}

/**
 * The only creator of a `Tournament`. Inserts the tournament and its single
 * `Group` in one statement. `state` is not set — it defaults to `DRAFT`; the
 * only path that changes it afterwards is `transitionTournament`.
 */
export function createTournamentRecord(input: NewTournamentInput): Promise<{ id: string }> {
  return db.tournament.create({
    data: {
      discipline: input.discipline,
      type: input.type,
      name: input.name,
      year: input.year,
      scoringPreset: input.scoringPreset,
      teamCount: input.teamCount,
      rounds: input.rounds,
      group: { create: {} },
    },
    select: { id: true },
  });
}

/** Admin read of every tournament (drafts included), for the `/admin/tournaments` list. */
export function listTournamentsForAdmin() {
  return db.tournament.findMany({
    orderBy: [{ year: "desc" }, { name: "asc" }],
    select: { id: true, name: true, type: true, year: true, state: true, discipline: true },
  });
}

/**
 * The sole public (role-blind) single-tournament read — AD-7. Filters
 * `state != DRAFT` and `discipline = CLASSIC` unconditionally; never accepts
 * a role or session to relax that. Callers that need a draft-preview
 * exception (e.g. an admin viewing their own draft's public page) fall back
 * to `getTournamentForAdmin` themselves after this returns `null` — that
 * decision belongs to the view layer, not here.
 */
export function getPublicTournament(id: string) {
  return db.tournament.findFirst({
    where: { id, state: { not: "DRAFT" }, discipline: "CLASSIC" },
  });
}

/**
 * The public `/classic` listing — tournaments currently being played. A
 * `COMPLETED` tournament drops out of this list and shows up in `/archive`
 * instead (a direct `/classic/[tournament]` link to it still resolves via
 * `getPublicTournament`).
 */
export function listPublicTournaments() {
  return db.tournament.findMany({
    where: { state: { in: ["GROUP_STAGE", "PLAYOFF"] }, discipline: "CLASSIC" },
    orderBy: [{ year: "desc" }, { name: "asc" }],
    select: { id: true, name: true, type: true, year: true, state: true },
  });
}

/** One completed tournament for the read-only archive — the `getPublicTournament` sibling. */
export function getArchivedTournament(id: string) {
  return db.tournament.findFirst({
    where: { id, state: "COMPLETED", discipline: "CLASSIC" },
  });
}

/** Every completed CLASSIC tournament, newest year first, for the `/archive` list. */
export function listArchivedTournaments() {
  return db.tournament.findMany({
    where: { state: "COMPLETED", discipline: "CLASSIC" },
    orderBy: [{ year: "desc" }, { name: "asc" }],
    select: { id: true, name: true, type: true, year: true },
  });
}

/**
 * The second (and, alongside `createTournamentRecord`, only) writer of
 * `Tournament`. Never writes `discipline` (fixed at creation, AD-9) or `state`
 * (AD-8 — `setTournamentState` stays the sole writer of that column).
 */
export function updateTournamentRecord(id: string, input: NewTournamentInput) {
  return db.tournament.update({
    where: { id },
    data: {
      type: input.type,
      name: input.name,
      year: input.year,
      scoringPreset: input.scoringPreset,
      teamCount: input.teamCount,
      rounds: input.rounds,
    },
    select: { id: true },
  });
}

/**
 * Deletes a `Tournament`. Cascades (schema-level `onDelete: Cascade`) remove
 * its `Group`, `TournamentEntry` rows, and their `Player` rosters in the same
 * statement.
 */
export function deleteTournamentRecord(id: string) {
  return db.tournament.delete({ where: { id } });
}

/** The Postgres index backing `Tournament`'s `@@unique([discipline, type, year, name])`. */
export const TOURNAMENT_NATURAL_KEY_INDEX = "tournament_discipline_type_year_name_key";
