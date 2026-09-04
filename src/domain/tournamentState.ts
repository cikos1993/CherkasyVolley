/**
 * The tournament lifecycle. This module is the single source of truth for which
 * state changes are legal and what has to be true before each one.
 *
 * `canTransition` answers the edge-only question (used by the view to decide
 * which action to offer). `checkTransition` is the authoritative gate the
 * Server Action calls: it checks the edge *and* the precondition.
 */

/** Must stay identical to the `TournamentState` enum in `prisma/schema.prisma`. */
export type TournamentState = "DRAFT" | "GROUP_STAGE" | "PLAYOFF" | "COMPLETED";

/** Forward-only lifecycle: no backward edges, no skips, no self-transitions. */
export const TRANSITIONS: Record<TournamentState, readonly TournamentState[]> = {
  DRAFT: ["GROUP_STAGE"],
  GROUP_STAGE: ["PLAYOFF"],
  PLAYOFF: ["COMPLETED"],
  COMPLETED: [],
};

/** Ukrainian display names for each state (glossary "Стан турніру"). */
export const LABELS: Record<TournamentState, string> = {
  DRAFT: "Чернетка",
  GROUP_STAGE: "Груповий етап",
  PLAYOFF: "Плейоф",
  COMPLETED: "Завершений",
};

export type TransitionErrorCode = "INVALID_TRANSITION" | "PRECONDITION_FAILED";

export type TransitionCheck =
  | { ok: true }
  | { ok: false; code: TransitionErrorCode; message: string };

/**
 * Precondition inputs. Every field is optional so the signature stays stable as
 * the data model grows — a caller supplies only what the target state needs.
 */
export interface TransitionContext {
  /** DRAFT → GROUP_STAGE: number of enrolled entries. */
  entryCount?: number;
  /** DRAFT → GROUP_STAGE: the tournament's planned field size. */
  teamCount?: number;
  /** GROUP_STAGE → PLAYOFF: every group match has a recorded result. */
  allGroupMatchesPlayed?: boolean;
  /** PLAYOFF → COMPLETED: the final and the third-place match both have a result. */
  finalAndThirdPlacePlayed?: boolean;
}

// GROUP_STAGE → PLAYOFF and PLAYOFF → COMPLETED gate on match results, which are
// not part of the data model yet. Those predicates stay fail-closed: the
// transition is refused unless the caller proves the precondition holds. Wiring
// the real inputs belongs to whichever feature introduces match results.
const PRECONDITIONS: Partial<
  Record<TournamentState, (ctx: TransitionContext) => TransitionCheck>
> = {
  GROUP_STAGE: (ctx) => {
    if (ctx.entryCount === undefined || ctx.teamCount === undefined) {
      return { ok: false, code: "PRECONDITION_FAILED", message: "Стан заявок турніру невідомий." };
    }
    if (ctx.entryCount !== ctx.teamCount) {
      return {
        ok: false,
        code: "PRECONDITION_FAILED",
        message: `Жеребкування недоступне: заявлено ${ctx.entryCount} команд із ${ctx.teamCount}.`,
      };
    }
    return { ok: true };
  },
  PLAYOFF: (ctx) =>
    ctx.allGroupMatchesPlayed === true
      ? { ok: true }
      : {
          ok: false,
          code: "PRECONDITION_FAILED",
          message: "Плейоф недоступний: не всі групові матчі зіграно.",
        },
  COMPLETED: (ctx) =>
    ctx.finalAndThirdPlacePlayed === true
      ? { ok: true }
      : {
          ok: false,
          code: "PRECONDITION_FAILED",
          message: "Завершити турнір можна лише коли зіграно фінал і матч за 3-тє місце.",
        },
};

/** Edge-only check: is `to` a legal next state from `from`? Ignores preconditions. */
export function canTransition(from: TournamentState, to: TournamentState): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

/**
 * The authoritative transition gate. Returns `{ ok: true }` only when the edge
 * is legal and the target state's precondition (if any) is satisfied.
 */
export function checkTransition(
  from: TournamentState,
  to: TournamentState,
  ctx: TransitionContext = {},
): TransitionCheck {
  // `from` comes from the database and `to` crosses the action's serialization
  // boundary; tolerate an unknown value rather than throw, and fall back to the
  // raw code so the message never reads "undefined".
  const allowed = TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Неможливий перехід зі стану «${LABELS[from] ?? from}» до «${LABELS[to] ?? to}».`,
    };
  }

  const precondition = PRECONDITIONS[to];
  if (precondition) {
    const result = precondition(ctx);
    if (!result.ok) return result;
  }

  return { ok: true };
}
