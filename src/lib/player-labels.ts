import type { PlayerField } from "@/domain/playerForm";

// Ukrainian display labels for the six optional roster fields (glossary
// "Гравець"). Single source shared by the form (player-form.tsx) and the
// read view (roster.tsx) so a rename can't desync the two.
export const PLAYER_OPTIONAL_FIELDS: { name: PlayerField; label: string }[] = [
  { name: "birthDate", label: "Дата народження" },
  { name: "birthPlace", label: "Місце народження" },
  { name: "sportRank", label: "Спортивний розряд" },
  { name: "position", label: "Амплуа" },
  { name: "height", label: "Зріст" },
  { name: "weight", label: "Вага" },
];
