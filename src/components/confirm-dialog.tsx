"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { Loader2Icon } from "lucide-react";

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

/**
 * Confirmation gate for destructive or irreversible actions (delete, revoke,
 * finish). `onConfirm` resolving closes the dialog; `onConfirm` throwing keeps it
 * open and logs the error but shows no toast — the caller owns user-facing
 * messaging. The dialog is fully locked while `onConfirm` is in flight, so a
 * long-running action must impose its own timeout.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Скасувати",
  destructive = false,
  onConfirm,
}: {
  trigger: ReactElement;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function handleConfirm() {
    if (pending) return;
    setPending(true);
    try {
      await onConfirm();
      if (alive.current) setOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      if (alive.current) setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next);
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            {cancelLabel}
          </DialogClose>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
