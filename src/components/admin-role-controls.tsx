"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { grantAdmin, revokeAdmin } from "@/actions/admin-roles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function GrantAdminButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();

  function grant() {
    startTransition(async () => {
      try {
        const res = await grantAdmin(userId);
        if (res.ok) toast.success("Доступ надано");
        else toast.error(res.message);
      } catch {
        toast.error("Не вдалося надати доступ. Спробуйте ще раз.");
      }
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={grant} disabled={pending}>
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
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

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

  function revoke() {
    startTransition(async () => {
      try {
        const res = await revokeAdmin(userId);
        if (res.ok) {
          setOpen(false);
          toast.success("Доступ знято");
          if (isSelf) {
            router.push("/");
            router.refresh();
          }
        } else {
          toast.error(res.message);
        }
      } catch {
        toast.error("Не вдалося зняти доступ. Спробуйте ще раз.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger render={<Button size="sm" variant="destructive" />}>
        Зняти доступ
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Зняти доступ адміністратора?</DialogTitle>
          <DialogDescription>
            {isSelf
              ? "Ви більше не зможете відкривати адмін-зону й керувати турнірами."
              : "Користувач втратить доступ до адмін-зони та керування турнірами."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Скасувати
          </DialogClose>
          <Button variant="destructive" onClick={revoke} disabled={pending}>
            Зняти
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
