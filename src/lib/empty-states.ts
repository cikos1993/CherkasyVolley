// Canonical empty-state copy. `description` holds the authoritative sentence
// from the UX Voice guide; `title` is a short label above it. One source so the
// wording cannot drift between screens.

export const BEACH_SOON = {
  title: "Незабаром",
  description: "У розділі «Пляжний» ще немає турнірів.",
} as const;

export const NO_TOURNAMENTS = {
  title: "Ще немає турнірів",
  description: "Активні турніри зʼявляться тут, коли їх створить адміністратор.",
} as const;

export const NO_TEAMS = {
  title: "Ще немає заявлених команд",
  description: "Ще немає заявлених команд.",
} as const;

// On a standings tab the "no results" state is a zero-filled table with an
// inline row, not this box — see the Voice guide. This const is for other
// contexts (e.g. an empty schedule tab).
export const NO_RESULTS = {
  title: "Результатів поки немає",
  description:
    "Результатів поки немає — таблиця зʼявиться після першого зіграного матчу.",
} as const;

export const ARCHIVE_YEAR_EMPTY = {
  title: "Немає турнірів за цей рік",
  description: "За цей рік завершених турнірів немає.",
} as const;

export const ARCHIVE_EMPTY = {
  title: "Архів порожній",
  description: "Завершені турніри зʼявляться тут за роками.",
} as const;
