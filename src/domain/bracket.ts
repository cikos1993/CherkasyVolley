/**
 * Playoff bracket seeding and advancement (glossary "Плейоф"). Pure — no
 * framework, no IO. The v1 playoff is a fixed four-team bracket: two
 * semifinals (seed 1 v 4, seed 2 v 3), then a third-place match and a final
 * whose participants are the semifinal losers and winners.
 *
 * `advanceBracket` is the single place next-round participants are derived,
 * for both the write path and rendering: a downstream pairing tracks the
 * semifinal results only until its own match has a recorded set — after that
 * it is frozen, so correcting a semifinal later cannot rewrite a match that
 * has already been played.
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
   * Group-standings seed (1–4) when the participant is known from seeding;
   * null once it is only known through advancement (a semifinal outcome).
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

const DOWNSTREAM_STAGE: Record<"THIRD_PLACE" | "FINAL", BracketStage> = {
  THIRD_PLACE: "THIRD_PLACE",
  FINAL: "FINAL",
};

interface MatchOutcome {
  winner: BracketParticipant;
  loser: BracketParticipant;
}

function indexBySlot(matches: PlayoffMatchState[]): Map<BracketSlot, PlayoffMatchState> {
  const bySlot = new Map<BracketSlot, PlayoffMatchState>();
  for (const match of matches) bySlot.set(match.slot, match);
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

/**
 * Builds the initial bracket from the ordered group standings. `standings`
 * must be ordered so index 0 is seed 1 (`orderStandings`'s contract). Uses
 * the top `PLAYOFF_QUALIFIERS` rows; the higher seed hosts. The final and
 * third-place match come back with no participants — `advanceBracket` fills
 * them once the semifinals are played.
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
    stage: DOWNSTREAM_STAGE[slot],
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
 * Resolves the current bracket from the state of its matches. The semifinals
 * pass through as stored. For the final and third-place match:
 *
 * - a match with a recorded set is frozen — its stored participants are
 *   returned unchanged (AD-5);
 * - otherwise, once both semifinals have a result, the final gets their
 *   winners and the third-place match their losers;
 * - otherwise both participants are undecided.
 *
 * Accepts two to four matches — a slot absent from `matches` is treated as
 * not yet created. Matches are matched by `slot`, not array order.
 */
export function advanceBracket(matches: PlayoffMatchState[]): PlayoffBracket {
  const bySlot = indexBySlot(matches);
  const sf1 = bySlot.get("SF1");
  const sf2 = bySlot.get("SF2");

  const semifinalPair = (slot: "SF1" | "SF2", match: PlayoffMatchState | undefined): BracketPair => ({
    slot,
    stage: "SEMIFINAL",
    home: match?.home ?? null,
    away: match?.away ?? null,
    status: hasOwnResult(match) ? "PLAYED" : "READY",
  });

  const sf1Outcome = matchOutcome(sf1);
  const sf2Outcome = matchOutcome(sf2);
  const bothSemifinalsPlayed = sf1Outcome !== null && sf2Outcome !== null;

  const downstream = (
    slot: "THIRD_PLACE" | "FINAL",
    fromSf1: BracketParticipant | null,
    fromSf2: BracketParticipant | null,
  ): BracketPair => {
    const match = bySlot.get(slot);
    const stage = DOWNSTREAM_STAGE[slot];

    if (hasOwnResult(match)) {
      return { slot, stage, home: match?.home ?? null, away: match?.away ?? null, status: "PLAYED" };
    }
    if (bothSemifinalsPlayed) {
      return { slot, stage, home: fromSf1, away: fromSf2, status: "READY" };
    }
    return { slot, stage, home: null, away: null, status: "AWAITING" };
  };

  return {
    semifinals: [semifinalPair("SF1", sf1), semifinalPair("SF2", sf2)],
    thirdPlace: downstream("THIRD_PLACE", sf1Outcome?.loser ?? null, sf2Outcome?.loser ?? null),
    final: downstream("FINAL", sf1Outcome?.winner ?? null, sf2Outcome?.winner ?? null),
    needsManualSeed: false,
  };
}

/**
 * Final placements 1–4 from the playoff results: the final decides first and
 * second, the third-place match decides third and fourth. A place is null
 * while its deciding match has no usable result. Never stored — recomputed
 * from match state (AD-4). Places 5+ come from the group table elsewhere.
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
