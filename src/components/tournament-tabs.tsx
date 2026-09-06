import Link from "next/link";

export type TournamentTabKey = "standings" | "schedule" | "teams" | "playoff";

const TABS: { key: TournamentTabKey; label: string }[] = [
  { key: "standings", label: "Таблиця" },
  { key: "schedule", label: "Розклад" },
  { key: "teams", label: "Команди" },
  { key: "playoff", label: "Плейоф" },
];

/** Coerces a raw `?tab=` value to a known key, or `null` when it is absent or unknown. */
export function normalizeTournamentTab(raw: string | string[] | undefined): TournamentTabKey | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return TABS.some((tab) => tab.key === value) ? (value as TournamentTabKey) : null;
}

export function TournamentTabs({
  tournamentId,
  active,
  showPlayoff,
}: {
  tournamentId: string;
  active: TournamentTabKey;
  showPlayoff: boolean;
}) {
  const tabs = TABS.filter((tab) => tab.key !== "playoff" || showPlayoff);

  return (
    <div className="mt-6 flex gap-2 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={`/classic/${tournamentId}?tab=${tab.key}`}
            aria-current={isActive ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3 py-1 text-sm ${
              isActive
                ? "border-foreground text-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
