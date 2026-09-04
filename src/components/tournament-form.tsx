"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";

import { createTournament } from "@/actions/tournaments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NAME_MAX,
  ROUNDS_MAX,
  ROUNDS_MIN,
  SCORING_PRESETS,
  TEAM_COUNT_MAX,
  TEAM_COUNT_MIN,
  TOURNAMENT_TYPES,
  YEAR_MAX,
  YEAR_MIN,
  type TournamentField,
} from "@/domain/tournamentForm";
import { notify } from "@/lib/notify";
import { SCORING_PRESET_LABELS, TOURNAMENT_TYPE_LABELS } from "@/lib/tournament-labels";

const selectClassName =
  "h-8 w-full rounded-sm border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

type FormValues = Record<TournamentField, string>;

// A function, not a module-level constant — `year` must be read per mount
// (per request when server-rendered), not once when the module is first
// loaded into a long-lived server process.
function initialValues(): FormValues {
  return {
    discipline: "CLASSIC",
    type: TOURNAMENT_TYPES[0],
    name: "",
    year: String(new Date().getFullYear()),
    scoringPreset: SCORING_PRESETS[0],
    teamCount: "",
    rounds: "1",
  };
}

function Field({
  name,
  label,
  error,
  children,
}: {
  name: TournamentField;
  label: string;
  error?: string;
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby"?: string;
  }) => ReactNode;
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
  const { fieldErrors } = state;

  // Controlled fields — React 19 resets an uncontrolled `<form action>` on
  // submit (and the base-ui Input ignores a changed `defaultValue`). Controlled
  // state is untouched by the reset, so a rejected submit keeps the user's input.
  const [form, setForm] = useState<FormValues>(initialValues);

  useEffect(() => {
    // Depend on `state` (a new object every submit), not `formError` alone —
    // two consecutive submits can return the identical error string, which
    // would not be a new dependency value and would silently skip the toast.
    if (state.formError) notify.error(state.formError);
  }, [state]);

  const bind = (field: TournamentField) => ({
    value: form[field],
    onChange: (event: { target: { value: string } }) =>
      setForm((current) => ({ ...current, [field]: event.target.value })),
  });

  return (
    <form action={formAction} className="grid max-w-md gap-5">
      <Field name="type" label="Тип турніру" error={fieldErrors?.type}>
        {(props) => (
          <select {...props} {...bind("type")} name="type" className={selectClassName}>
            {TOURNAMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {TOURNAMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field name="name" label="Назва" error={fieldErrors?.name}>
        {(props) => <Input {...props} {...bind("name")} name="name" maxLength={NAME_MAX} />}
      </Field>

      <Field name="year" label="Рік" error={fieldErrors?.year}>
        {(props) => (
          <Input {...props} {...bind("year")} name="year" type="number" min={YEAR_MIN} max={YEAR_MAX} />
        )}
      </Field>

      <Field name="scoringPreset" label="Система очок" error={fieldErrors?.scoringPreset}>
        {(props) => (
          <select
            {...props}
            {...bind("scoringPreset")}
            name="scoringPreset"
            className={selectClassName}
          >
            {SCORING_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {SCORING_PRESET_LABELS[preset]}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field name="teamCount" label="Кількість команд" error={fieldErrors?.teamCount}>
        {(props) => (
          <Input
            {...props}
            {...bind("teamCount")}
            name="teamCount"
            type="number"
            min={TEAM_COUNT_MIN}
            max={TEAM_COUNT_MAX}
          />
        )}
      </Field>

      <Field name="rounds" label="Кількість кіл" error={fieldErrors?.rounds}>
        {(props) => (
          <Input
            {...props}
            {...bind("rounds")}
            name="rounds"
            type="number"
            min={ROUNDS_MIN}
            max={ROUNDS_MAX}
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
