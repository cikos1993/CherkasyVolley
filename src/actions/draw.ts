"use server";

import { revalidatePath } from "next/cache";

import { toActionError, type ActionResult } from "@/actions/result";
import { requireAdmin } from "@/auth/requireAdmin";
import { listEntriesForTournament } from "@/data/entries";
import { hasAnyGroupResult } from "@/data/matches";
import { listGroupEntryIds, saveDraw, saveRedraw } from "@/data/draw";
import { getTournamentForAdmin } from "@/data/tournaments";
import { checkTransition } from "@/domain/tournamentState";
import { checkCanRedraw } from "@/domain/redraw";
import { defaultShuffle, generateSchedule } from "@/domain/schedule";

/**
 * Runs the group-stage draw: seats every entered team into the tournament's
 * group, generates the round-robin calendar, and moves the tournament to
 * `GROUP_STAGE` — all atomically via `saveDraw`. A dedicated action rather
 * than a call into `transitionTournament` (see the story's Notes on AC
 * interpretation): it does domain work (seating, scheduling) that has
 * nothing to do with that action's generic shape, and reuses `checkTransition`
 * directly instead of duplicating the precondition.
 */
export async function drawTournament(tournamentId: string): Promise<ActionResult<undefined>> {
  try {
    await requireAdmin();

    const tournament = await getTournamentForAdmin(tournamentId);
    if (!tournament) {
      return { ok: false, code: "NOT_FOUND", message: "Турнір не знайдено." };
    }
    if (!tournament.group) {
      return { ok: false, code: "NOT_FOUND", message: "Групу турніру не знайдено." };
    }

    const entries = await listEntriesForTournament(tournamentId);
    const entryIds = entries.map((entry) => entry.id);

    const check = checkTransition(tournament.state, "GROUP_STAGE", {
      entryCount: entryIds.length,
      teamCount: tournament.teamCount,
    });
    if (!check.ok) {
      return { ok: false, code: check.code, message: check.message };
    }

    // `listEntriesForTournament` orders entries alphabetically by team name —
    // `generateSchedule`'s circle method fixes its first entry as an anchor
    // and rotates the rest, so without this shuffle the actual matchup
    // pattern (who plays whom, in which tour) would be a deterministic
    // function of team names, not a real draw. `generateSchedule`'s own
    // `shuffle` param only randomizes pair order within a tour and home/away.
    const shuffledEntryIds = defaultShuffle(entryIds);

    const schedule = generateSchedule(shuffledEntryIds, tournament.rounds);
    const pairings = schedule.map(({ homeEntryId, awayEntryId }) => ({
      homeEntryId,
      awayEntryId,
    }));

    await saveDraw(tournamentId, tournament.group.id, shuffledEntryIds, pairings);

    revalidatePath(tournament.discipline === "BEACH" ? "/beach" : "/classic");
    // The public tournament page renders the match calendar on its Розклад tab.
    revalidatePath(`/classic/${tournamentId}`);
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    revalidatePath("/admin/tournaments");

    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Re-runs the draw for an already-drawn tournament: deletes the current
 * `GROUP`-stage `Match` calendar and generates a new one from the same
 * seated entries (`GroupSlot` — never re-read from `TournamentEntry`, and
 * never itself modified). Gated by `checkCanRedraw`, not `checkTransition` —
 * `Tournament.state` doesn't change here.
 */
export async function redrawTournament(tournamentId: string): Promise<ActionResult<undefined>> {
  try {
    await requireAdmin();

    const tournament = await getTournamentForAdmin(tournamentId);
    if (!tournament) {
      return { ok: false, code: "NOT_FOUND", message: "Турнір не знайдено." };
    }
    if (!tournament.group) {
      return { ok: false, code: "NOT_FOUND", message: "Групу турніру не знайдено." };
    }

    const hasResults = await hasAnyGroupResult(tournamentId);
    const check = checkCanRedraw(tournament.state, hasResults);
    if (!check.ok) {
      return { ok: false, code: "PRECONDITION_FAILED", message: check.message };
    }

    const entryIds = await listGroupEntryIds(tournament.group.id);
    const shuffledEntryIds = defaultShuffle(entryIds);

    const schedule = generateSchedule(shuffledEntryIds, tournament.rounds);
    const pairings = schedule.map(({ homeEntryId, awayEntryId }) => ({
      homeEntryId,
      awayEntryId,
    }));

    await saveRedraw(tournamentId, tournament.group.id, pairings);

    revalidatePath(tournament.discipline === "BEACH" ? "/beach" : "/classic");
    // The public tournament page renders the match calendar on its Розклад tab.
    revalidatePath(`/classic/${tournamentId}`);
    revalidatePath(`/admin/tournaments/${tournamentId}`);

    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
