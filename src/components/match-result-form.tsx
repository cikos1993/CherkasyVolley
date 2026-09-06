"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { editMatchResult, enterMatchResult, type MatchResultFormState } from "@/actions/matches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { matchSetSummary, type SetScore } from "@/domain/scoring";
import type { ScoringPreset, TournamentType } from "@/domain/tournamentForm";
import { MATCH_SETS_MAX, MATCH_SETS_MIN, targetScore } from "@/domain/validation";
import { notify } from "@/lib/notify";

type Row = { home: string; away: string };

type MatchResultFormProps = {
  tournamentId: string;
  matchId: string;
  preset: ScoringPreset;
  tournamentType: TournamentType;
  homeTeam: string;
  awayTeam: string;
  /** When set, the form is replaced by this read-only reason (e.g. the tournament is completed). */
  lockedReason?: string;
} & (
  | { mode?: "create" }
  | { mode: "edit"; initialSets: SetScore[]; onCancel: () => void }
);

function emptyRows(count: number): Row[] {
  return Array.from({ length: count }, () => ({ home: "", away: "" }));
}

function isScore(value: string): boolean {
  return /^\d{1,3}$/.test(value);
}

export function MatchResultForm(props: MatchResultFormProps) {
  const { tournamentId, matchId, preset, tournamentType, homeTeam, awayTeam } = props;
  const isEdit = props.mode === "edit";
  const router = useRouter();
  const [state, formAction, pending] = useActionState<MatchResultFormState, FormData>(
    (isEdit ? editMatchResult : enterMatchResult).bind(null, tournamentId, matchId),
    {},
  );
  const [rows, setRows] = useState<Row[]>(() =>
    props.mode === "edit"
      ? props.initialSets.map((set) => ({
          home: String(set.homePoints),
          away: String(set.awayPoints),
        }))
      : emptyRows(MATCH_SETS_MIN),
  );

  useEffect(() => {
    if (state.formError) notify.error(state.formError);
  }, [state]);

  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && Object.keys(state).length === 0) {
      if (props.mode === "edit") {
        notify.success("Зміни збережено");
        props.onCancel();
      } else {
        notify.success("Результат збережено");
      }
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, state, router, props]);

  // The live tally counts only the contiguous run of fully-filled sets from
  // set 1 — the same shape the server accepts.
  const summary = useMemo(() => {
    const contiguous: SetScore[] = [];
    for (const [index, row] of rows.entries()) {
      if (!isScore(row.home) || !isScore(row.away)) break;
      contiguous.push({ setNo: index + 1, homePoints: Number(row.home), awayPoints: Number(row.away) });
    }
    return matchSetSummary(contiguous);
  }, [rows]);

  function updateRow(index: number, field: keyof Row, value: string) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  if (props.lockedReason) {
    return <p className="text-sm text-muted-foreground">{props.lockedReason}</p>;
  }

  const canAddSet = preset === "CLASSIC" && rows.length < MATCH_SETS_MAX;
  const lastRow = rows[rows.length - 1];
  const canRemoveSet =
    preset === "CLASSIC" &&
    rows.length > MATCH_SETS_MIN &&
    lastRow.home === "" &&
    lastRow.away === "";

  return (
    <form action={formAction} className="grid max-w-md gap-4">
      <div className="grid gap-3">
        {rows.map((row, index) => {
          const setNo = index + 1;
          const error = state.setErrors?.[setNo];
          const errorId = error ? `set-${setNo}-error` : undefined;
          const target = targetScore(preset, tournamentType, setNo);
          return (
            <div key={setNo} className="grid gap-1.5">
              <div className="flex items-center gap-3">
                <span className="w-28 text-sm text-muted-foreground">
                  Партія {setNo} <span className="text-xs">(до {target})</span>
                </span>
                <Input
                  name={`home-${setNo}`}
                  inputMode="numeric"
                  maxLength={3}
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
                  maxLength={3}
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

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} aria-busy={pending} className="w-fit">
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          {isEdit ? "Зберегти зміни" : "Зберегти результат"}
        </Button>
        {props.mode === "edit" ? (
          <Button type="button" variant="outline" onClick={props.onCancel} disabled={pending}>
            Скасувати
          </Button>
        ) : null}
      </div>
    </form>
  );
}
