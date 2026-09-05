/**
 * Precondition for re-running the draw on an already-drawn tournament.
 * Pure — no framework, no IO. Not a `checkTransition` edge: `Tournament.state`
 * never changes during a redraw (it stays `GROUP_STAGE` before and after) —
 * this gates a same-state, repeatable-until-a-result-exists action instead.
 */

import type { TournamentState } from "@/domain/tournamentState";

export type RedrawCheck = { ok: true } | { ok: false; message: string };

export function checkCanRedraw(state: TournamentState, hasResults: boolean): RedrawCheck {
  if (state !== "GROUP_STAGE") {
    return { ok: false, message: "Пережеребкування можливе лише у стані «Груповий етап»." };
  }
  if (hasResults) {
    return { ok: false, message: "Пережеребкування недоступне: уже внесено результат матчу." };
  }
  return { ok: true };
}
