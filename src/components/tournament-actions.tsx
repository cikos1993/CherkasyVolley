"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { drawTournament, redrawTournament } from "@/actions/draw";
import { formPlayoff } from "@/actions/playoff";
import { deleteTournament, transitionTournament } from "@/actions/tournaments";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { checkCanRedraw } from "@/domain/redraw";
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

export function FormPlayoffButton({
  tournamentId,
  state,
  allGroupMatchesPlayed,
}: {
  tournamentId: string;
  state: TournamentState;
  allGroupMatchesPlayed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const check = checkTransition(state, "PLAYOFF", { allGroupMatchesPlayed });
  const caption =
    !check.ok && check.code === "PRECONDITION_FAILED"
      ? "Доступно коли всі матчі груп зіграно"
      : check.ok
        ? null
        : check.message;

  function form() {
    startTransition(async () => {
      try {
        const res = await formPlayoff(tournamentId);
        if (res.ok) {
          notify.success("Плейоф сформовано");
          if (res.data.needsManualSeed) {
            notify.warning(
              "Посів деяких команд визначено за назвою команди — перевірте таблицю групи.",
            );
          }
        } else {
          notify.error(res.message);
        }
      } catch {
        notify.error("Не вдалося сформувати плейоф. Спробуйте ще раз.");
      } finally {
        // Refresh on every outcome: on success the section disappears (state
        // is now PLAYOFF); on a failed race the stale precondition is corrected.
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-2">
      <Button type="button" onClick={form} disabled={!check.ok || pending} aria-busy={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        Сформувати плейоф
      </Button>
      {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
    </div>
  );
}

export function FinishTournamentButton({
  tournamentId,
  state,
  finalAndThirdPlacePlayed,
}: {
  tournamentId: string;
  state: TournamentState;
  finalAndThirdPlacePlayed: boolean;
}) {
  const router = useRouter();

  const check = checkTransition(state, "COMPLETED", { finalAndThirdPlacePlayed });
  const caption =
    !check.ok && check.code === "PRECONDITION_FAILED"
      ? "Доступно коли зіграно фінал і матч за 3-тє місце"
      : check.ok
        ? null
        : check.message;

  async function finish(): Promise<boolean | void> {
    const res = await transitionTournament(tournamentId, "COMPLETED").catch((): null => {
      notify.error("Не вдалося завершити турнір. Спробуйте ще раз.");
      return null;
    });
    if (res === null) throw new Error("finish request failed");
    if (!res.ok) {
      notify.error(res.message);
      return false;
    }
    notify.success("Турнір завершено");
    router.refresh();
  }

  return (
    <div className="grid gap-2">
      <ConfirmDialog
        trigger={
          <Button variant="destructive" disabled={!check.ok}>
            Завершити турнір
          </Button>
        }
        title="Завершити турнір?"
        description="Після цього результати редагувати не можна."
        confirmLabel="Завершити турнір"
        destructive
        onConfirm={finish}
      />
      {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
    </div>
  );
}

export function RedrawTournamentButton({
  tournamentId,
  state,
  hasResults,
}: {
  tournamentId: string;
  state: TournamentState;
  hasResults: boolean;
}) {
  const router = useRouter();

  const check = checkCanRedraw(state, hasResults);

  async function redraw(): Promise<boolean | void> {
    const res = await redrawTournament(tournamentId).catch((): null => {
      notify.error("Не вдалося пережеребкувати. Спробуйте ще раз.");
      return null;
    });
    if (res === null) throw new Error("redraw request failed");
    if (!res.ok) {
      notify.error(res.message);
      return false;
    }
    notify.success("Пережеребкування проведено");
    router.refresh();
  }

  return (
    <div className="grid gap-2">
      <ConfirmDialog
        trigger={
          <Button variant="destructive" disabled={!check.ok}>
            Пережеребкувати
          </Button>
        }
        title="Пережеребкувати?"
        description="Поточний календар матчів буде видалено і згенеровано новий."
        confirmLabel="Пережеребкувати"
        destructive
        onConfirm={redraw}
      />
      {!check.ok ? <p className="text-xs text-muted-foreground">{check.message}</p> : null}
    </div>
  );
}
