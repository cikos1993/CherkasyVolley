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
 * finish).
 *
 * - `onConfirm` resolves (or returns anything but `false`) → the dialog closes.
 * - `onConfirm` returns `false` → the dialog stays open, nothing is logged. Use
 *   this for a handled failure the caller has already surfaced (a toast).
 * - `onConfirm` throws → the dialog stays open and the error is `console.error`d
 *   (an unexpected exception, not a normal failure).
 *
 * The dialog is fully locked while `onConfirm` is in flight, so a long-running
 * action must impose its own timeout. On a destructive dialog initial focus is
 * put on Cancel so an immediate Enter does not confirm.
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
  onConfirm: () => boolean | void | Promise<boolean | void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const alive = useRef(true);
  const running = useRef(false);
  const cancelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function handleConfirm() {
    if (running.current) return;
    running.current = true;
    setPending(true);
    try {
      const result = await onConfirm();
      if (alive.current && result !== false) setOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      running.current = false;
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
      {/* Destructive dialogs open with focus on Cancel, so an immediate Enter
          does not confirm. base-ui's default already lands on the first tabbable
          (Cancel, first in the footer) — this makes it explicit. */}
      <DialogContent
        initialFocus={destructive ? () => cancelRef.current : undefined}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose
            render={
              <Button
                ref={(el) => {
                  cancelRef.current = el;
                }}
                variant="outline"
                disabled={pending}
              />
            }
          >
            {cancelLabel}
          </DialogClose>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
