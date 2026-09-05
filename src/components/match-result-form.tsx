"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { enterMatchResult, type MatchResultFormState } from "@/actions/matches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { matchSetSummary } from "@/domain/scoring";
import { notify } from "@/lib/notify";

type Row = { home: string; away: string };

const MIN_SETS = 3;
const MAX_SETS = 5;

function emptyRows(count: number): Row[] {
  return Array.from({ length: count }, () => ({ home: "", away: "" }));
}

function isScore(value: string): boolean {
  return /^\d+$/.test(value);
}

export function MatchResultForm({
  tournamentId,
  matchId,
  preset,
  homeTeam,
  awayTeam,
}: {
  tournamentId: string;
  matchId: string;
  preset: "CLASSIC" | "CUSTOM";
  homeTeam: string;
  awayTeam: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<MatchResultFormState, FormData>(
    enterMatchResult.bind(null, tournamentId, matchId),
    {},
  );
  const [rows, setRows] = useState<Row[]>(() => emptyRows(MIN_SETS));

  useEffect(() => {
    if (state.formError) notify.error(state.formError);
  }, [state]);

  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.formError && !state.setErrors) {
      notify.success("Результат збережено");
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, state, router]);

  const summary = useMemo(() => {
    const complete = rows
      .map((row, index) => ({ ...row, setNo: index + 1 }))
      .filter((row) => isScore(row.home) && isScore(row.away))
      .map((row) => ({ setNo: row.setNo, homePoints: Number(row.home), awayPoints: Number(row.away) }));
    return matchSetSummary(complete);
  }, [rows]);

  function updateRow(index: number, field: keyof Row, value: string) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  const canAddSet = preset === "CLASSIC" && rows.length < MAX_SETS;
  const lastRow = rows[rows.length - 1];
  const canRemoveSet =
    preset === "CLASSIC" && rows.length > MIN_SETS && lastRow.home === "" && lastRow.away === "";

  return (
    <form action={formAction} className="grid max-w-md gap-4">
      <div className="grid gap-3">
        {rows.map((row, index) => {
          const setNo = index + 1;
          const error = state.setErrors?.[setNo];
          const errorId = error ? `set-${setNo}-error` : undefined;
          return (
            <div key={setNo} className="grid gap-1.5">
              <div className="flex items-center gap-3">
                <span className="w-20 text-sm text-muted-foreground">Партія {setNo}</span>
                <Input
                  name={`home-${setNo}`}
                  inputMode="numeric"
                  aria-label={`${homeTeam}, партія ${setNo}`}
                  aria-invalid={Boolean(error)}
                  aria-describedby={errorId}
                  className="w-16 text-center tabular-nums"
                  value={row.home}
                  onChange={(event) => updateRow(index, "home", event.target.value)}
                />
                <span aria-hidden className="text-muted-foreground">
                  :
                </span>
                <Input
                  name={`away-${setNo}`}
                  inputMode="numeric"
                  aria-label={`${awayTeam}, партія ${setNo}`}
                  aria-invalid={Boolean(error)}
                  aria-describedby={errorId}
                  className="w-16 text-center tabular-nums"
                  value={row.away}
                  onChange={(event) => updateRow(index, "away", event.target.value)}
                />
              </div>
              {error ? (
                <p id={errorId} className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {preset === "CLASSIC" ? (
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canAddSet}
            onClick={() => setRows((current) => [...current, { home: "", away: "" }])}
          >
            Додати партію
          </Button>
          {canRemoveSet ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRows((current) => current.slice(0, -1))}
            >
              Прибрати партію
            </Button>
          ) : null}
        </div>
      ) : null}

      <p className="text-sm">
        Рахунок у партіях:{" "}
        <span className="font-medium tabular-nums">
          {summary.home} : {summary.away}
        </span>
        <span className="text-muted-foreground"> (рахується автоматично)</span>
      </p>

      {state.formError ? <p className="text-sm text-destructive">{state.formError}</p> : null}

      <Button type="submit" disabled={pending} aria-busy={pending} className="w-fit">
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        Зберегти результат
      </Button>
    </form>
  );
}
