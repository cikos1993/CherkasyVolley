"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { addPlayer, editPlayer } from "@/actions/players";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FREE_TEXT_MAX, FULL_NAME_MAX, type PlayerField } from "@/domain/playerForm";
import { notify } from "@/lib/notify";

type FormValues = Record<PlayerField, string>;

const OPTIONAL_FIELDS: { name: PlayerField; label: string }[] = [
  { name: "birthDate", label: "Дата народження" },
  { name: "birthPlace", label: "Місце народження" },
  { name: "sportRank", label: "Спортивний розряд" },
  { name: "position", label: "Амплуа" },
  { name: "height", label: "Зріст" },
  { name: "weight", label: "Вага" },
];

function emptyValues(): FormValues {
  return {
    fullName: "",
    birthDate: "",
    birthPlace: "",
    sportRank: "",
    position: "",
    height: "",
    weight: "",
  };
}

type PlayerFormProps =
  | { mode?: "create"; tournamentId: string; entryId: string }
  | {
      mode: "edit";
      tournamentId: string;
      entryId: string;
      playerId: string;
      initial: FormValues;
      onCancel: () => void;
    };

export function PlayerForm(props: PlayerFormProps) {
  const router = useRouter();
  const action =
    props.mode === "edit"
      ? editPlayer.bind(null, props.tournamentId, props.entryId, props.playerId)
      : addPlayer.bind(null, props.tournamentId, props.entryId);
  const [state, formAction, pending] = useActionState(action, {});
  const [form, setForm] = useState<FormValues>(() =>
    props.mode === "edit" ? props.initial : emptyValues(),
  );
  // What was actually submitted, captured when `pending` rises — create mode
  // only clears the form if the admin hasn't since started typing the next
  // player's details (the `team-form.tsx` / Story 2.7 review pattern).
  const submitted = useRef<FormValues | null>(null);

  useEffect(() => {
    if (state.formError) notify.error(state.formError);
  }, [state]);

  // Clear-on-success (create) / close-on-success (edit), keyed off the falling
  // edge of `pending` — the same technique as `tournament-form.tsx`/`team-form.tsx`.
  const wasPending = useRef(false);
  useEffect(() => {
    if (!wasPending.current && pending) submitted.current = form;
    if (wasPending.current && !pending && !state.formError && !state.fieldErrors) {
      if (props.mode === "edit") {
        notify.success("Зміни збережено");
        props.onCancel();
      } else {
        setForm((current) =>
          submitted.current && current === submitted.current ? emptyValues() : current,
        );
        notify.success("Гравця додано");
      }
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, state, router, form, props]);

  const bind = (field: PlayerField) => ({
    value: form[field],
    onChange: (event: { target: { value: string } }) =>
      setForm((current) => ({ ...current, [field]: event.target.value })),
  });

  return (
    <form action={formAction} className="grid max-w-md gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="fullName">ПІБ</Label>
        <Input
          id="fullName"
          name="fullName"
          maxLength={FULL_NAME_MAX}
          aria-invalid={Boolean(state.fieldErrors?.fullName)}
          aria-describedby={state.fieldErrors?.fullName ? "fullName-error" : undefined}
          {...bind("fullName")}
        />
        {state.fieldErrors?.fullName ? (
          <p id="fullName-error" className="text-sm text-destructive">
            {state.fieldErrors.fullName}
          </p>
        ) : null}
      </div>

      {OPTIONAL_FIELDS.map(({ name, label }) => (
        <div key={name} className="grid gap-1.5">
          <Label htmlFor={name}>{label}</Label>
          <Input
            id={name}
            name={name}
            maxLength={FREE_TEXT_MAX}
            aria-invalid={Boolean(state.fieldErrors?.[name])}
            aria-describedby={state.fieldErrors?.[name] ? `${name}-error` : undefined}
            {...bind(name)}
          />
          {state.fieldErrors?.[name] ? (
            <p id={`${name}-error`} className="text-sm text-destructive">
              {state.fieldErrors[name]}
            </p>
          ) : null}
        </div>
      ))}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} aria-busy={pending} className="w-fit">
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          {props.mode === "edit" ? "Зберегти" : "Додати гравця"}
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
