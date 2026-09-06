/**
 * Playoff bracket seeding and advancement (glossary "Плейоф", FR-19–21). Pure
 * — no framework, no IO. The v1 playoff is a fixed four-team bracket: two
 * semifinals (seed 1 v 4, seed 2 v 3), then a third-place match and a final
 * whose participants are the semifinal losers and winners.
 *
 * `advanceBracket` is the single place next-round participants are derived,
 * for both the write path and rendering (AD-5): a downstream pairing tracks
 * the semifinal results only until its own match has a recorded set — after
 * that it is frozen, so correcting a semifinal later cannot rewrite a match
 * that has already been played.
 */

import { matchSetSummary, type SetScore } from "@/domain/scoring";
import { PLAYOFF_QUALIFIERS, type OrderedStandingsRow } from "@/domain/tiebreak";

/**
 * The four fixed positions in a v1 bracket. The two semifinals share one
 * `MatchStage.SEMIFINAL` in the database; `SF1`/`SF2` tell them apart here.
 */
export type BracketSlot = "SF1" | "SF2" | "THIRD_PLACE" | "FINAL";

/**
 * Kept identical to the `MatchStage` enum in `prisma/schema.prisma` so the
 * data layer maps `BracketPair.stage` to `Match.stage` without a lookup.
 */
export type BracketStage = "SEMIFINAL" | "THIRD_PLACE" | "FINAL";

export interface BracketParticipant {
  entryId: string;
  /**
   * Group-standings seed (1–4) for a team placed by `seedPlayoff`. A team that
   * reaches a later round keeps the seed it carried out of its semifinal; a
   * caller that synthesises a participant without a known seed uses null.
   */
  seed: number | null;
}

/**
 * `AWAITING` — at least one participant is undecided (a semifinal without a
 * result); `READY` — both known, no result of its own yet; `PLAYED` — has a
 * recorded set and is therefore frozen.
 */
export type BracketPairStatus = "AWAITING" | "READY" | "PLAYED";

export interface BracketPair {
  slot: BracketSlot;
  stage: BracketStage;
  home: BracketParticipant | null;
  away: BracketParticipant | null;
  status: BracketPairStatus;
}

export interface PlayoffBracket {
  semifinals: [BracketPair, BracketPair];
  thirdPlace: BracketPair;
  final: BracketPair;
  /**
   * True when any of the four seeds came from the standings' name fallback
   * (`needsManualSeed`) — the order at the 1–4 cut-line is then a
   * tiebreak-by-name, not a sporting result. Display-only; v1 has no reseed
   * flow. Only `seedPlayoff` sets this; `advanceBracket` reports `false`.
   */
  needsManualSeed: boolean;
}

/**
 * One playoff match as currently persisted. The data layer maps the
 * tournament's `Match` rows and their `SetScore`s into this shape; a match a
 * caller has not created yet is simply absent from the array.
 */
export interface PlayoffMatchState {
  slot: BracketSlot;
  home: BracketParticipant | null;
  away: BracketParticipant | null;
  sets: SetScore[];
}

export interface PlayoffPlacements {
  first: string | null;
  second: string | null;
  third: string | null;
  fourth: string | null;
}

interface MatchOutcome {
  winner: BracketParticipant;
  loser: BracketParticipant;
}

/**
 * Indexes matches by slot. Rejects a duplicate slot: unlike the group table,
 * nothing in the schema stops the data layer from producing two `SF1` rows
 * (both semifinals persist as `MatchStage.SEMIFINAL`), so a collision here is
 * a real bug rather than something to resolve silently.
 */
function indexBySlot(matches: PlayoffMatchState[]): Map<BracketSlot, PlayoffMatchState> {
  const bySlot = new Map<BracketSlot, PlayoffMatchState>();
  for (const match of matches) {
    if (bySlot.has(match.slot)) {
      throw new Error(`advanceBracket: two matches for slot ${match.slot}`);
    }
    bySlot.set(match.slot, match);
  }
  return bySlot;
}

/**
 * Winner and loser of a played match, or null when it has no usable result:
 * no sets recorded, a participant still undecided, or a level set tally.
 * Set scores are trusted as already validated (the same stance `scoring.ts`
 * takes) — the winner is the side that took more sets.
 */
function matchOutcome(match: PlayoffMatchState | undefined): MatchOutcome | null {
  if (!match || !match.home || !match.away || match.sets.length === 0) return null;
  const { home, away } = matchSetSummary(match.sets);
  if (home === away) return null;
  return home > away
    ? { winner: match.home, loser: match.away }
    : { winner: match.away, loser: match.home };
}

function hasOwnResult(match: PlayoffMatchState | undefined): boolean {
  return match !== undefined && match.sets.length > 0;
}

function pairStatus(
  home: BracketParticipant | null,
  away: BracketParticipant | null,
  match: PlayoffMatchState | undefined,
): BracketPairStatus {
  if (hasOwnResult(match)) return "PLAYED";
  return home && away ? "READY" : "AWAITING";
}

/**
 * Builds the initial bracket from the ordered group standings (FR-19).
 * `standings` must be the output of `orderStandings` — ordered so index 0 is
 * seed 1, and free of duplicate entries (the same trust `scoring.ts` places
 * in its inputs). The bracket is fixed at `PLAYOFF_QUALIFIERS` teams / two
 * semifinals; the pairings below are hardwired to that size (seed 1 v 4,
 * seed 2 v 3), higher seed hosting. The final and third-place match come
 * back with no participants — `advanceBracket` fills them once the
 * semifinals are played.
 */
export function seedPlayoff(standings: OrderedStandingsRow[]): PlayoffBracket {
  if (standings.length < PLAYOFF_QUALIFIERS) {
    throw new RangeError(
      `seedPlayoff: need at least ${PLAYOFF_QUALIFIERS} ordered standings rows, got ${standings.length}`,
    );
  }

  const seedOf = (position: number): BracketParticipant => ({
    entryId: standings[position - 1].row.entryId,
    seed: position,
  });

  const semifinal = (slot: "SF1" | "SF2", homeSeed: number, awaySeed: number): BracketPair => ({
    slot,
    stage: "SEMIFINAL",
    home: seedOf(homeSeed),
    away: seedOf(awaySeed),
    status: "READY",
  });

  const tbd = (slot: "THIRD_PLACE" | "FINAL"): BracketPair => ({
    slot,
    stage: slot,
    home: null,
    away: null,
    status: "AWAITING",
  });

  return {
    semifinals: [semifinal("SF1", 1, 4), semifinal("SF2", 2, 3)],
    thirdPlace: tbd("THIRD_PLACE"),
    final: tbd("FINAL"),
    needsManualSeed: standings.slice(0, PLAYOFF_QUALIFIERS).some((row) => row.needsManualSeed),
  };
}

/**
 * Resolves the current bracket from the state of its matches (FR-20). The
 * semifinals pass through as stored. For the final and third-place match:
 *
 * - a match with a recorded set is frozen — its stored participants are
 *   returned unchanged (AD-5);
 * - otherwise, once both semifinals have a result, the final gets their
 *   winners and the third-place match their losers;
 * - otherwise both participants are undecided.
 *
 * Accepts two to four matches — a slot absent from `matches` is treated as
 * not yet created. Matches are matched by `slot`, not array order. Trusts a
 * self-consistent set: it does not detect a team appearing in two slots
 * (e.g. a semifinal corrected after a later-round match was already played).
 */
export function advanceBracket(matches: PlayoffMatchState[]): PlayoffBracket {
  const bySlot = indexBySlot(matches);
  const sf1 = bySlot.get("SF1");
  const sf2 = bySlot.get("SF2");

  const semifinalPair = (slot: "SF1" | "SF2", match: PlayoffMatchState | undefined): BracketPair => {
    const home = match?.home ?? null;
    const away = match?.away ?? null;
    return { slot, stage: "SEMIFINAL", home, away, status: pairStatus(home, away, match) };
  };

  const sf1Outcome = matchOutcome(sf1);
  const sf2Outcome = matchOutcome(sf2);
  const bothSemifinalsPlayed = sf1Outcome !== null && sf2Outcome !== null;

  const downstream = (
    slot: "THIRD_PLACE" | "FINAL",
    fromSf1: BracketParticipant | null,
    fromSf2: BracketParticipant | null,
  ): BracketPair => {
    const match = bySlot.get(slot);

    if (hasOwnResult(match)) {
      return {
        slot,
        stage: slot,
        home: match?.home ?? null,
        away: match?.away ?? null,
        status: "PLAYED",
      };
    }
    if (bothSemifinalsPlayed) {
      return { slot, stage: slot, home: fromSf1, away: fromSf2, status: "READY" };
    }
    return { slot, stage: slot, home: null, away: null, status: "AWAITING" };
  };

  return {
    semifinals: [semifinalPair("SF1", sf1), semifinalPair("SF2", sf2)],
    thirdPlace: downstream("THIRD_PLACE", sf1Outcome?.loser ?? null, sf2Outcome?.loser ?? null),
    final: downstream("FINAL", sf1Outcome?.winner ?? null, sf2Outcome?.winner ?? null),
    needsManualSeed: false,
  };
}

/**
 * Final placements 1–4 from the playoff results (FR-21): the final decides
 * first and second, the third-place match decides third and fourth. A place
 * is null while its deciding match has no usable result. Never stored —
 * recomputed from match state (AD-4). Places 5+ come from the group table
 * elsewhere.
 */
export function playoffPlacements(matches: PlayoffMatchState[]): PlayoffPlacements {
  const bySlot = indexBySlot(matches);
  const finalOutcome = matchOutcome(bySlot.get("FINAL"));
  const thirdPlaceOutcome = matchOutcome(bySlot.get("THIRD_PLACE"));

  return {
    first: finalOutcome?.winner.entryId ?? null,
    second: finalOutcome?.loser.entryId ?? null,
    third: thirdPlaceOutcome?.winner.entryId ?? null,
    fourth: thirdPlaceOutcome?.loser.entryId ?? null,
  };
}

export type PlayoffResultEditCheck = { ok: true } | { ok: false; message: string };

/**
 * Whether a semifinal result may still be corrected or removed. `advanceBracket`
 * trusts a self-consistent set of matches; it does not detect a team ending up
 * in two positions. Once the final or the third-place match has its own set,
 * that pairing is frozen but the other still re-derives from the corrected
 * semifinal — which can place a frozen finalist into third place as well. The
 * fix is to block the upstream edit while a downstream match has been played;
 * before then, correcting a semifinal only re-pairs the downstream matches.
 */
export function checkCanEditSemifinalResult(matches: PlayoffMatchState[]): PlayoffResultEditCheck {
  const downstreamPlayed = matches.some(
    (match) =>
      (match.slot === "FINAL" || match.slot === "THIRD_PLACE") && match.sets.length > 0,
  );
  if (downstreamPlayed) {
    return {
      ok: false,
      message:
        "Виправлення недоступне: результат наступного матчу плейофа вже внесено. Спершу приберіть його.",
    };
  }
  return { ok: true };
}
