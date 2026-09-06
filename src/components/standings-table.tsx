import { EmptyState } from "@/components/empty-state";
import { GROUP_NOT_DRAWN, NO_RESULTS } from "@/lib/empty-states";

type StandingsTableRow = {
  entryId: string;
  position: number;
  teamName: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
  setsWon: number;
  setsLost: number;
  qualifies: boolean;
  needsManualSeed: boolean;
};

const QUALIFIES_HINT = "Виходить у плейоф";

const STAT_HEADERS: { abbr: string; full: string }[] = [
  { abbr: "З", full: "Зіграно" },
  { abbr: "В", full: "Перемоги" },
  { abbr: "П", full: "Поразки" },
  { abbr: "Очки", full: "Очки" },
  { abbr: "ВП", full: "Виграні партії" },
  { abbr: "ПП", full: "Програні партії" },
];

export function StandingsTable({
  rows,
  hasResults,
  tournamentName,
}: {
  rows: StandingsTableRow[];
  hasResults: boolean;
  tournamentName: string;
}) {
  if (rows.length === 0) {
    return <EmptyState {...GROUP_NOT_DRAWN} />;
  }

  const anyQualifier = rows.some((row) => row.qualifies);
  const anyManualSeed = rows.some((row) => row.needsManualSeed);

  return (
    <div>
      <div
        className="overflow-x-auto"
        role="region"
        aria-label={`Турнірна таблиця: ${tournamentName}`}
        tabIndex={0}
      >
        <table className="w-full text-sm">
          <caption className="sr-only">Турнірна таблиця групи</caption>
          <thead>
            <tr className="border-b text-muted-foreground">
              <th scope="col" className="py-2 pr-3 text-center font-medium">
                №
              </th>
              <th scope="col" className="py-2 pr-3 text-left font-medium">
                Команда
              </th>
              {STAT_HEADERS.map((header) => (
                <th
                  key={header.abbr}
                  scope="col"
                  aria-label={header.full}
                  className="px-2 py-2 text-center font-medium"
                >
                  {header.abbr === header.full ? (
                    header.abbr
                  ) : (
                    <abbr title={header.full} className="no-underline">
                      {header.abbr}
                    </abbr>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.entryId} className="border-b">
                <td className="py-2 pr-3 text-center tabular-nums">
                  {row.qualifies ? (
                    <span className="font-bold text-primary" title={QUALIFIES_HINT}>
                      {row.position}
                      <span className="sr-only"> — {QUALIFIES_HINT}</span>
                    </span>
                  ) : (
                    row.position
                  )}
                  {row.needsManualSeed ? (
                    <>
                      <span aria-hidden> *</span>
                      <span className="sr-only">
                        {" "}
                        — місце визначено за назвою команди, потрібен ручний розсів
                      </span>
                    </>
                  ) : null}
                </td>
                <th scope="row" className="py-2 pr-3 text-left font-normal">
                  {row.teamName}
                </th>
                <td className="px-2 py-2 text-center tabular-nums">{row.played}</td>
                <td className="px-2 py-2 text-center tabular-nums">{row.wins}</td>
                <td className="px-2 py-2 text-center tabular-nums">{row.losses}</td>
                <td className="px-2 py-2 text-center font-medium tabular-nums">{row.points}</td>
                <td className="px-2 py-2 text-center tabular-nums">{row.setsWon}</td>
                <td className="px-2 py-2 text-center tabular-nums">{row.setsLost}</td>
              </tr>
            ))}
            {!hasResults ? (
              <tr>
                <td colSpan={8} className="py-3 text-muted-foreground">
                  {NO_RESULTS.description}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {anyQualifier || anyManualSeed ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {anyQualifier ? "Синім — позиції, що виходять у плейоф." : null}
          {anyQualifier && anyManualSeed ? " · " : null}
          {anyManualSeed
            ? "* — місце визначено за назвою команди; потрібен ручний розсів."
            : null}
        </p>
      ) : null}
    </div>
  );
}
