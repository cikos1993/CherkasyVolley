"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { createTeam } from "@/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TEAM_NAME_MAX } from "@/domain/teamForm";
import { notify } from "@/lib/notify";

export function TeamForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createTeam, {});
  const [name, setName] = useState("");
  // What was actually submitted, captured when `pending` rises — the clear-
  // on-success effect below only clears the field if the admin hasn't since
  // started typing a different (presumably next) team name.
  const submittedName = useRef<string | null>(null);

  useEffect(() => {
    if (state.formError) notify.error(state.formError);
  }, [state]);

  // Clear-on-success, keyed off the falling edge of `pending` (never fires on
  // mount, since `wasPending` starts `false`) — the same technique as
  // `tournament-form.tsx`'s edit-mode success effect, but here a clean submit
  // clears the field (ready for the next team) instead of keeping the value.
  const wasPending = useRef(false);
  useEffect(() => {
    if (!wasPending.current && pending) submittedName.current = name;
    if (wasPending.current && !pending && !state.formError && !state.fieldErrors) {
      setName((current) => (current === submittedName.current ? "" : current));
      notify.success("Команду додано");
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, state, router, name]);

  const errorId = "team-name-error";

  return (
    <form action={formAction} className="flex items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Назва команди</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={TEAM_NAME_MAX}
          aria-invalid={Boolean(state.fieldErrors?.name)}
          aria-describedby={state.fieldErrors?.name ? errorId : undefined}
        />
        {state.fieldErrors?.name ? (
          <p id={errorId} className="text-sm text-destructive">
            {state.fieldErrors.name}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        Додати команду
      </Button>
    </form>
  );
}
