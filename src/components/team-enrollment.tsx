"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";

import { enrollTeam, removeTeamEntry } from "@/actions/entries";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { checkCanEnroll } from "@/domain/teamEnrollment";
import type { TournamentState } from "@/domain/tournamentState";
import { NO_TEAMS } from "@/lib/empty-states";
import { notify } from "@/lib/notify";

const selectClassName =
  "h-8 w-full rounded-sm border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

type Entry = { id: string; teamId: string; team: { id: string; name: string } };
type Team = { id: string; name: string };

export function TeamEnrollment({
  tournamentId,
  state,
  teamCount,
  entries,
  availableTeams,
}: {
  tournamentId: string;
  state: TournamentState;
  teamCount: number;
  entries: Entry[];
  availableTeams: Team[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedTeamId, setSelectedTeamId] = useState(availableTeams[0]?.id ?? "");
  // `availableTeams` changes after every enroll/remove (via `router.refresh()`),
  // which can leave `selectedTeamId` pointing at a team no longer in the list
  // (e.g. the one just enrolled) — fall back to the current first option
  // instead of rendering a `<select>` with no matching `<option>`.
  const effectiveTeamId = availableTeams.some((team) => team.id === selectedTeamId)
    ? selectedTeamId
    : (availableTeams[0]?.id ?? "");

  const enrollCheck = checkCanEnroll(state, entries.length, teamCount);
  const directoryExhausted = availableTeams.length === 0 && entries.length > 0;
  const directoryEmpty = availableTeams.length === 0 && entries.length === 0;

  function enroll() {
    if (!effectiveTeamId) return;
    startTransition(async () => {
      const res = await enrollTeam(tournamentId, effectiveTeamId);
      if (res.ok) {
        notify.success("Команду заявлено");
        router.refresh();
      } else {
        notify.error(res.message);
      }
    });
  }

  async function remove(entryId: string): Promise<boolean | void> {
    const res = await removeTeamEntry(tournamentId, entryId).catch((): null => {
      notify.error("Не вдалося зняти заявку. Спробуйте ще раз.");
      return null;
    });
    if (res === null) throw new Error("remove entry request failed");
    if (!res.ok) {
      notify.error(res.message);
      return false;
    }
    notify.success("Заявку знято");
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      {directoryEmpty ? (
        <p className="text-sm text-muted-foreground">
          Немає жодної команди в довіднику.{" "}
          <Link href="/admin/teams" className="underline underline-offset-4">
            Додати команду
          </Link>
        </p>
      ) : (
        <div className="flex items-end gap-3">
          <select
            className={selectClassName}
            value={effectiveTeamId}
            onChange={(event) => setSelectedTeamId(event.target.value)}
            disabled={!enrollCheck.ok || directoryExhausted || pending}
          >
            {availableTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            onClick={enroll}
            disabled={!enrollCheck.ok || directoryExhausted || pending || !effectiveTeamId}
            aria-busy={pending}
          >
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            Заявити
          </Button>
        </div>
      )}
      {!enrollCheck.ok ? (
        <p className="text-xs text-muted-foreground">{enrollCheck.message}</p>
      ) : directoryExhausted ? (
        <p className="text-xs text-muted-foreground">
          Усі команди з довідника вже заявлені в цей турнір.
        </p>
      ) : null}

      {entries.length === 0 ? (
        <EmptyState {...NO_TEAMS} />
      ) : (
        <ul className="divide-y">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>{entry.team.name}</span>
              {state === "DRAFT" ? (
                <ConfirmDialog
                  trigger={
                    <Button size="sm" variant="destructive">
                      Зняти
                    </Button>
                  }
                  title="Зняти заявку команди?"
                  description={`Заявку команди «${entry.team.name}» та її склад буде видалено.`}
                  confirmLabel="Зняти"
                  destructive
                  onConfirm={() => remove(entry.id)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
