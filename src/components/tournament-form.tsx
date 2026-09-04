"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { createTournament, updateTournament } from "@/actions/tournaments";
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
  locked,
  children,
}: {
  name: TournamentField;
  label: string;
  error?: string;
  locked?: boolean;
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby"?: string;
    disabled?: boolean;
  }) => ReactNode;
}) {
  const errorId = `${name}-error`;
  const lockedId = `${name}-locked`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children({
        id: name,
        "aria-invalid": Boolean(error),
        "aria-describedby": error ? errorId : locked ? lockedId : undefined,
        disabled: locked,
      })}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : locked ? (
        <p id={lockedId} className="text-xs text-muted-foreground">
          Змінити можна лише в стані «Чернетка».
        </p>
      ) : null}
    </div>
  );
}

type TournamentFormProps =
  | { mode?: "create" }
  | {
      mode: "edit";
      tournamentId: string;
      initial: FormValues;
      locked?: readonly TournamentField[];
    };

export function TournamentForm(props: TournamentFormProps) {
  const mode = props.mode ?? "create";
  const router = useRouter();
  const action = props.mode === "edit" ? updateTournament.bind(null, props.tournamentId) : createTournament;
  const [state, formAction, pending] = useActionState(action, {});
  const { fieldErrors } = state;
  const locked = props.mode === "edit" ? (props.locked ?? []) : [];

  // Controlled fields — React 19 resets an uncontrolled `<form action>` on
  // submit (and the base-ui Input ignores a changed `defaultValue`). Controlled
  // state is untouched by the reset, so a rejected submit keeps the user's input.
  const [form, setForm] = useState<FormValues>(() =>
    props.mode === "edit" ? props.initial : initialValues(),
  );

  useEffect(() => {
    // Depend on `state` (a new object every submit), not `formError` alone —
    // two consecutive submits can return the identical error string, which
    // would not be a new dependency value and would silently skip the toast.
    if (state.formError) notify.error(state.formError);
  }, [state]);

  // Edit-only success toast, keyed off the falling edge of `pending` rather
  // than `state`'s identity — fires once a submit actually completes without
  // an error, never on mount (`wasPending` starts `false`).
  const wasPending = useRef(false);
  useEffect(() => {
    if (mode === "edit" && wasPending.current && !pending && !state.formError && !state.fieldErrors) {
      notify.success("Зміни збережено");
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, state, mode, router]);

  const bind = (field: TournamentField) => ({
    value: form[field],
    onChange: (event: { target: { value: string } }) =>
      setForm((current) => ({ ...current, [field]: event.target.value })),
  });

  return (
    <form action={formAction} className="grid max-w-md gap-5">
      <Field name="type" label="Тип турніру" error={fieldErrors?.type} locked={locked.includes("type")}>
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

      <Field name="name" label="Назва" error={fieldErrors?.name} locked={locked.includes("name")}>
        {(props) => <Input {...props} {...bind("name")} name="name" maxLength={NAME_MAX} />}
      </Field>

      <Field name="year" label="Рік" error={fieldErrors?.year} locked={locked.includes("year")}>
        {(props) => (
          <Input {...props} {...bind("year")} name="year" type="number" min={YEAR_MIN} max={YEAR_MAX} />
        )}
      </Field>

      <Field
        name="scoringPreset"
        label="Система очок"
        error={fieldErrors?.scoringPreset}
        locked={locked.includes("scoringPreset")}
      >
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

      <Field
        name="teamCount"
        label="Кількість команд"
        error={fieldErrors?.teamCount}
        locked={locked.includes("teamCount")}
      >
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

      <Field
        name="rounds"
        label="Кількість кіл"
        error={fieldErrors?.rounds}
        locked={locked.includes("rounds")}
      >
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
        {mode === "edit" ? "Зберегти зміни" : "Створити турнір"}
      </Button>
    </form>
  );
}
