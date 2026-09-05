"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { drawTournament } from "@/actions/draw";
import { deleteTournament } from "@/actions/tournaments";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { checkTransition, type TournamentState } from "@/domain/tournamentState";
import { notify } from "@/lib/notify";

export function DeleteTournamentButton({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();

  async function remove(): Promise<boolean | void> {
    const res = await deleteTournament(tournamentId).catch((): null => {
      notify.error("Не вдалося видалити турнір. Спробуйте ще раз.");
      return null;
    });
    if (res === null) throw new Error("delete request failed");
    if (!res.ok) {
      notify.error(res.message);
      return false;
    }
    notify.success("Турнір видалено");
    router.push("/admin/tournaments");
  }

  return (
    <ConfirmDialog
      trigger={<Button variant="destructive">Видалити турнір</Button>}
      title="Видалити турнір?"
      description="Турнір і всі повʼязані заявки та склади будуть видалені."
      confirmLabel="Видалити"
      destructive
      onConfirm={remove}
    />
  );
}

export function DrawTournamentButton({
  tournamentId,
  state,
  entryCount,
  teamCount,
}: {
  tournamentId: string;
  state: TournamentState;
  entryCount: number;
  teamCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const check = checkTransition(state, "GROUP_STAGE", { entryCount, teamCount });

  function draw() {
    startTransition(async () => {
      try {
        const res = await drawTournament(tournamentId);
        if (res.ok) {
          notify.success("Жеребкування проведено");
          router.refresh();
        } else {
          notify.error(res.message);
        }
      } catch {
        notify.error("Не вдалося провести жеребкування. Спробуйте ще раз.");
      }
    });
  }

  return (
    <div className="grid gap-2">
      <Button type="button" onClick={draw} disabled={!check.ok || pending} aria-busy={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        Провести жеребкування
      </Button>
      {!check.ok ? <p className="text-xs text-muted-foreground">{check.message}</p> : null}
    </div>
  );
}
