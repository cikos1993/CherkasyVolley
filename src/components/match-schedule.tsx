"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckIcon, Loader2Icon } from "lucide-react";

import { scheduleMatch, type MatchScheduleFormState } from "@/actions/matches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VENUE_TEXT_MAX } from "@/domain/matchSchedule";
import { notify } from "@/lib/notify";

// UI hint only — `validateMatchSchedule` is the real year guard (2000–2100).
const DATETIME_MIN = "2000-01-01T00:00";
const DATETIME_MAX = "2100-12-31T23:59";

type MatchRow = {
  id: string;
  updatedAt: number;
  homeTeam: string;
  awayTeam: string;
  scheduledAtLocal: string;
  scheduledAtDisplay: string | null;
  venueText: string;
  resultSummary: string | null;
};

function MatchScheduleRow({
  tournamentId,
  match,
  locked,
}: {
  tournamentId: string;
  match: MatchRow;
  locked: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<MatchScheduleFormState, FormData>(
    scheduleMatch.bind(null, tournamentId, match.id),
    {},
  );
  const [scheduledAt, setScheduledAt] = useState(match.scheduledAtLocal);
  const [venueText, setVenueText] = useState(match.venueText);

  useEffect(() => {
    if (state.formError) notify.error(state.formError);
  }, [state]);

  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.formError && !state.fieldErrors) {
      notify.success("Розклад оновлено");
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, state, router]);

  const datetimeId = `sched-${match.id}`;
  const venueFieldId = `venue-${match.id}`;

  const scheduleMeta = [
    match.scheduledAtDisplay ?? "час не визначено",
    match.venueText || null,
  ].filter(Boolean);

  return (
    <li className="grid gap-3 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-medium">
          {match.homeTeam} — {match.awayTeam}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{scheduleMeta.join(" · ")}</span>
          <Link
            href={`/admin/tournaments/${tournamentId}/matches/${match.id}`}
            aria-label={
              match.resultSummary
                ? `Результат матчу ${match.homeTeam} — ${match.awayTeam}: ${match.resultSummary}`
                : `Внести результат матчу ${match.homeTeam} — ${match.awayTeam}`
            }
            className="underline underline-offset-4"
          >
            {match.resultSummary ? (
              <span className="inline-flex items-center gap-1 text-success">
                <CheckIcon className="size-4" aria-hidden />
                Результат: {match.resultSummary}
              </span>
            ) : (
              "Внести результат"
            )}
          </Link>
        </span>
      </div>

      {locked ? null : (
      <form
        action={formAction}
        aria-label={`Розклад матчу: ${match.homeTeam} — ${match.awayTeam}`}
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
      >
        <div className="grid gap-1.5">
          <Label htmlFor={datetimeId}>Дата й час</Label>
          <Input
            id={datetimeId}
            name="scheduledAt"
            type="datetime-local"
            min={DATETIME_MIN}
            max={DATETIME_MAX}
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
            aria-invalid={Boolean(state.fieldErrors?.scheduledAt)}
            aria-describedby={state.fieldErrors?.scheduledAt ? `${datetimeId}-error` : undefined}
          />
          {state.fieldErrors?.scheduledAt ? (
            <p id={`${datetimeId}-error`} className="text-sm text-destructive">
              {state.fieldErrors.scheduledAt}
            </p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={venueFieldId}>Місце проведення</Label>
          <Input
            id={venueFieldId}
            name="venueText"
            maxLength={VENUE_TEXT_MAX}
            value={venueText}
            onChange={(event) => setVenueText(event.target.value)}
            aria-invalid={Boolean(state.fieldErrors?.venueText)}
            aria-describedby={state.fieldErrors?.venueText ? `${venueFieldId}-error` : undefined}
          />
          {state.fieldErrors?.venueText ? (
            <p id={`${venueFieldId}-error`} className="text-sm text-destructive">
              {state.fieldErrors.venueText}
            </p>
          ) : null}
        </div>

        <Button type="submit" disabled={pending} aria-busy={pending} className="w-fit">
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          Зберегти
        </Button>
      </form>
      )}
    </li>
  );
}

export function MatchScheduleList({
  tournamentId,
  matches,
  locked = false,
}: {
  tournamentId: string;
  matches: MatchRow[];
  locked?: boolean;
}) {
  if (matches.length === 0) {
    return <p className="text-sm text-muted-foreground">Матчів у розкладі немає.</p>;
  }

  return (
    <>
      {locked ? (
        <p className="mb-3 text-sm text-muted-foreground">
          Турнір завершено — розклад зафіксовано.
        </p>
      ) : null}
      <ul className="divide-y">
        {matches.map((match) => (
          <MatchScheduleRow
            key={`${match.id}-${match.updatedAt}`}
            tournamentId={tournamentId}
            match={match}
            locked={locked}
          />
        ))}
      </ul>
    </>
  );
}
