"use server";

import { revalidatePath } from "next/cache";

import { toActionError, type ActionResult } from "@/actions/result";
import { requireAdmin } from "@/auth/requireAdmin";
import { allGroupMatchesPlayed, getStandings } from "@/data/matches";
import { savePlayoffFormation } from "@/data/playoff";
import { getTournamentForAdmin } from "@/data/tournaments";
import { seedPlayoff } from "@/domain/bracket";
import { PLAYOFF_QUALIFIERS } from "@/domain/tiebreak";
import { checkTransition } from "@/domain/tournamentState";

/**
 * Forms the playoff: seeds the two semifinals from the group table, creates
 * their `Match` rows, and moves the tournament to `PLAYOFF` — atomically via
 * `savePlayoffFormation`. A dedicated action rather than a call into
 * `transitionTournament` (the `drawTournament` precedent): it does domain
 * work (seeding) that the generic transition doesn't, and reuses
 * `checkTransition` directly. v1 has exactly one `Group` per tournament, so
 * the "multi-group not supported" clause of FR-19 needs no branch here.
 * Returns `needsManualSeed` so the caller can warn that the 4/5 cut-line was
 * settled by team name rather than a result.
 */
export async function formPlayoff(
  tournamentId: string,
): Promise<ActionResult<{ needsManualSeed: boolean }>> {
  try {
    await requireAdmin();

    const tournament = await getTournamentForAdmin(tournamentId);
    if (!tournament) {
      return { ok: false, code: "NOT_FOUND", message: "Турнір не знайдено." };
    }
    if (!tournament.group) {
      return { ok: false, code: "NOT_FOUND", message: "Групу турніру не знайдено." };
    }

    const allPlayed = await allGroupMatchesPlayed(tournamentId);
    const check = checkTransition(tournament.state, "PLAYOFF", {
      allGroupMatchesPlayed: allPlayed,
    });
    if (!check.ok) {
      return { ok: false, code: check.code, message: check.message };
    }

    const standings = await getStandings(tournamentId);
    if (standings.length < PLAYOFF_QUALIFIERS) {
      return {
        ok: false,
        code: "PRECONDITION_FAILED",
        message: "У групі менше ніж 4 команди — плейоф неможливий.",
      };
    }

    const bracket = seedPlayoff(standings);
    const result = await savePlayoffFormation(tournamentId, bracket);
    if (!result.ok) {
      return {
        ok: false,
        code: "PRECONDITION_FAILED",
        message:
          result.reason === "already_formed"
            ? "Плейоф уже сформовано — оновіть сторінку."
            : "Результат групового матчу зник — оновіть сторінку.",
      };
    }

    const publicRoot = tournament.discipline === "BEACH" ? "/beach" : "/classic";
    revalidatePath(publicRoot);
    // The public tournament page gains its «Плейоф» tab once the state flips.
    revalidatePath(`${publicRoot}/${tournamentId}`);
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    revalidatePath("/admin/tournaments");

    return { ok: true, data: { needsManualSeed: bracket.needsManualSeed } };
  } catch (error) {
    return toActionError(error);
  }
}
