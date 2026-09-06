// Canonical empty-state copy. `description` holds the authoritative sentence
// from the UX Voice guide; `title` (optional) is a short label above it. One
// source so the wording cannot drift between screens.

export const BEACH_SOON = {
  title: "Незабаром",
  description: "У розділі «Пляжний» ще немає турнірів.",
} as const;

export const NO_TOURNAMENTS = {
  title: "Ще немає турнірів",
  description: "Активні турніри зʼявляться тут, коли їх створить адміністратор.",
} as const;

export const NO_TEAMS = {
  description: "Ще немає заявлених команд.",
} as const;

export const NO_PLAYERS = {
  description: "Ще немає гравців у складі.",
} as const;

// Shown on the Розклад / Таблиця tabs before a tournament is drawn (EXPERIENCE.md
// States table). Reachable via the admin draft-preview fallback.
export const GROUP_NOT_DRAWN = {
  description: "Групу буде сформовано після жеребкування.",
} as const;

// The standings tab's "no results" state is a zero-filled table with this
// inline row (not an `EmptyState` box) — see the Voice guide.
export const NO_RESULTS = {
  description: "Результатів поки немає.",
} as const;

export const ARCHIVE_YEAR_EMPTY = {
  title: "Немає турнірів за цей рік",
  description: "За цей рік завершених турнірів немає.",
} as const;

export const ARCHIVE_EMPTY = {
  title: "Архів порожній",
  description: "Завершені турніри зʼявляться тут за роками.",
} as const;
