"use client";

import { useId, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { grantAdmin, revokeAdmin } from "@/actions/admin-roles";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";

export function GrantAdminButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();

  function grant() {
    startTransition(async () => {
      try {
        const res = await grantAdmin(userId);
        if (res.ok) notify.success("Доступ надано");
        else notify.error(res.message);
      } catch {
        notify.error("Не вдалося надати доступ. Спробуйте ще раз.");
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={grant}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? <Loader2Icon className="animate-spin" /> : null}
      Надати доступ
    </Button>
  );
}

export function RevokeAdminButton({
  userId,
  isSelf = false,
  disabled = false,
}: {
  userId: string;
  isSelf?: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const reasonId = useId();

  if (disabled) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button size="sm" variant="destructive" disabled aria-describedby={reasonId}>
          Зняти доступ
        </Button>
        <span id={reasonId} className="text-xs text-muted-foreground">
          Ви єдиний адміністратор
        </span>
      </div>
    );
  }

  async function revoke(): Promise<boolean | void> {
    const res = await revokeAdmin(userId).catch((): null => {
      notify.error("Не вдалося зняти доступ. Спробуйте ще раз.");
      return null;
    });
    if (res === null) throw new Error("revoke request failed");
    if (!res.ok) {
      notify.error(res.message);
      return false;
    }
    notify.success("Доступ знято");
    if (isSelf) {
      // The current route is now forbidden to this user — leave it, don't refresh
      // it (a refresh would redirect through the admin-required flash toast).
      router.replace("/");
      return;
    }
    router.refresh();
  }

  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="destructive">
          Зняти доступ
        </Button>
      }
      title="Зняти доступ адміністратора?"
      description={
        isSelf
          ? "Ви більше не зможете відкривати адмін-зону й керувати турнірами."
          : "Користувач втратить доступ до адмін-зони та керування турнірами."
      }
      confirmLabel="Зняти"
      destructive
      onConfirm={revoke}
    />
  );
}
