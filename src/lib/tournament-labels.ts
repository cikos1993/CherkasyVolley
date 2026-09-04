import type { ScoringPreset, TournamentType } from "@/domain/tournamentForm";

// Ukrainian display names for the tournament enums (glossary "Тип турніру",
// "Система очок"). State labels live in `src/domain/tournamentState` (LABELS).

export const TOURNAMENT_TYPE_LABELS: Record<TournamentType, string> = {
  CHAMPIONSHIP: "Чемпіонат",
  VETERAN: "Ветеранський чемпіонат",
  WOMEN: "Жіночий чемпіонат",
  YOUTH: "Юнаки і дівчата",
};

export const SCORING_PRESET_LABELS: Record<ScoringPreset, string> = {
  CLASSIC: "Класичний",
  CUSTOM: "Кастомний",
};
