// Ukrainian display names for the four playoff bracket slots, shared by the
// public bracket and the admin schedule section. The match screen keeps its own
// stage-keyed labels (it also covers GROUP and shows a slot-agnostic "Півфінал").

export const PLAYOFF_SLOT_LABELS = {
  SF1: "Півфінал 1",
  SF2: "Півфінал 2",
  THIRD_PLACE: "Матч за 3-тє місце",
  FINAL: "Фінал",
} as const;

export type PlayoffSlot = keyof typeof PLAYOFF_SLOT_LABELS;
