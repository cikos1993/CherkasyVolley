"use client";

import { useRouter } from "next/navigation";

import { deleteTournament } from "@/actions/tournaments";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
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
