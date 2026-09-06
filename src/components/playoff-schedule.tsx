import Link from "next/link";
import { CheckIcon } from "lucide-react";

export type PlayoffScheduleSlot = {
  key: string;
  label: string;
  matchId: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  score: string | null;
};

/**
 * Read-only list of the four playoff slots for the admin schedule page. A slot
 * with no `matchId` (the final / third-place match before both semifinals are
 * played) shows «очікує суперників» and carries no result link.
 */
export function PlayoffSchedule({
  tournamentId,
  slots,
}: {
  tournamentId: string;
  slots: PlayoffScheduleSlot[];
}) {
  return (
    <ul className="divide-y">
      {slots.map((slot) => {
        const decided = slot.homeTeam !== null && slot.awayTeam !== null;
        return (
          <li
            key={slot.key}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
          >
            <span className="font-medium">
              {slot.label}:{" "}
              <span className={decided ? "" : "text-muted-foreground"}>
                {decided ? `${slot.homeTeam} — ${slot.awayTeam}` : "очікує суперників"}
              </span>
            </span>
            {slot.matchId ? (
              <Link
                href={`/admin/tournaments/${tournamentId}/matches/${slot.matchId}`}
                className="text-sm underline underline-offset-4"
              >
                {slot.score ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <CheckIcon className="size-4" aria-hidden />
                    Результат: {slot.score}
                  </span>
                ) : (
                  "Внести результат"
                )}
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
