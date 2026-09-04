/**
 * Preconditions for enrolling a team into a tournament and for canceling an
 * existing entry. Pure — no framework, no IO. Both gate on the same state
 * restriction (`DRAFT`-only, Story 2.7 AC-interpretation); enrollment also
 * gates on the field not being full.
 */

import type { TournamentState } from "@/domain/tournamentState";

export type EnrollmentCheck = { ok: true } | { ok: false; message: string };

export function checkCanEnroll(
  state: TournamentState,
  currentEntryCount: number,
  teamCount: number,
): EnrollmentCheck {
  if (state !== "DRAFT") {
    return { ok: false, message: "Заявити команду можна лише у стані «Чернетка»." };
  }
  if (currentEntryCount >= teamCount) {
    return { ok: false, message: `Уже заявлено максимальну кількість команд (${teamCount}).` };
  }
  return { ok: true };
}

export function checkCanRemoveEntry(state: TournamentState): EnrollmentCheck {
  if (state !== "DRAFT") {
    return { ok: false, message: "Зняти заявку можна лише у стані «Чернетка»." };
  }
  return { ok: true };
}
