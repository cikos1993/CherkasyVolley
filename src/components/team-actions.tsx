"use client";

import { useRouter } from "next/navigation";

import { deleteTeam } from "@/actions/teams";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";

export function DeleteTeamButton({ teamId, teamName }: { teamId: string; teamName: string }) {
  const router = useRouter();

  async function remove(): Promise<boolean | void> {
    const res = await deleteTeam(teamId).catch((): null => {
      notify.error("Не вдалося видалити команду. Спробуйте ще раз.");
      return null;
    });
    if (res === null) throw new Error("delete team request failed");
    if (!res.ok) {
      notify.error(res.message);
      return false;
    }
    notify.success("Команду видалено");
    router.refresh();
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm" aria-label={`Видалити команду ${teamName}`}>
          Видалити
        </Button>
      }
      title="Видалити команду?"
      description={`Команду «${teamName}» буде видалено з довідника.`}
      confirmLabel="Видалити"
      destructive
      onConfirm={remove}
    />
  );
}
