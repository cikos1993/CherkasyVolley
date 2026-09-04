"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect } from "react";
import { Loader2Icon } from "lucide-react";

import { createTournament } from "@/actions/tournaments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ROUNDS_MAX,
  ROUNDS_MIN,
  SCORING_PRESETS,
  TEAM_COUNT_MAX,
  TEAM_COUNT_MIN,
  TOURNAMENT_TYPES,
  YEAR_MAX,
  YEAR_MIN,
  type ScoringPreset,
  type TournamentField,
  type TournamentType,
} from "@/domain/tournamentForm";
import { notify } from "@/lib/notify";

const TYPE_LABELS: Record<TournamentType, string> = {
  CHAMPIONSHIP: "Чемпіонат",
  VETERAN: "Ветеранський чемпіонат",
  WOMEN: "Жіночий чемпіонат",
  YOUTH: "Юнаки і дівчата",
};

const PRESET_LABELS: Record<ScoringPreset, string> = {
  CLASSIC: "Класичний",
  CUSTOM: "Кастомний",
};

const selectClassName =
  "h-8 w-full rounded-sm border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

function Field({
  name,
  label,
  error,
  children,
}: {
  name: TournamentField;
  label: string;
  error?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const errorId = `${name}-error`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children({
        id: name,
        "aria-invalid": Boolean(error),
        "aria-describedby": error ? errorId : undefined,
      })}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TournamentForm() {
  const [state, formAction, pending] = useActionState(createTournament, {});
  const { fieldErrors, values, formError } = state;

  useEffect(() => {
    if (formError) notify.error(formError);
  }, [formError]);

  return (
    <form action={formAction} className="grid max-w-md gap-5">
      <Field name="type" label="Тип турніру" error={fieldErrors?.type}>
        {(props) => (
          <select
            {...props}
            name="type"
            className={selectClassName}
            defaultValue={values?.type ?? TOURNAMENT_TYPES[0]}
          >
            {TOURNAMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field name="name" label="Назва" error={fieldErrors?.name}>
        {(props) => (
          <Input {...props} name="name" defaultValue={values?.name ?? ""} maxLength={120} />
        )}
      </Field>

      <Field name="year" label="Рік" error={fieldErrors?.year}>
        {(props) => (
          <Input
            {...props}
            name="year"
            type="number"
            min={YEAR_MIN}
            max={YEAR_MAX}
            defaultValue={values?.year ?? String(new Date().getFullYear())}
          />
        )}
      </Field>

      <Field name="scoringPreset" label="Система очок" error={fieldErrors?.scoringPreset}>
        {(props) => (
          <select
            {...props}
            name="scoringPreset"
            className={selectClassName}
            defaultValue={values?.scoringPreset ?? SCORING_PRESETS[0]}
          >
            {SCORING_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {PRESET_LABELS[preset]}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field name="teamCount" label="Кількість команд" error={fieldErrors?.teamCount}>
        {(props) => (
          <Input
            {...props}
            name="teamCount"
            type="number"
            min={TEAM_COUNT_MIN}
            max={TEAM_COUNT_MAX}
            defaultValue={values?.teamCount ?? ""}
          />
        )}
      </Field>

      <Field name="rounds" label="Кількість кіл" error={fieldErrors?.rounds}>
        {(props) => (
          <Input
            {...props}
            name="rounds"
            type="number"
            min={ROUNDS_MIN}
            max={ROUNDS_MAX}
            defaultValue={values?.rounds ?? "1"}
          />
        )}
      </Field>

      <Button type="submit" disabled={pending} aria-busy={pending} className="w-fit">
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        Створити турнір
      </Button>
    </form>
  );
}
