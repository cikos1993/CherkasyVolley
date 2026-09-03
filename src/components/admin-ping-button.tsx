"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { adminPing } from "@/actions/admin-ping";
import { Button } from "@/components/ui/button";

export function AdminPingButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function check() {
    startTransition(async () => {
      try {
        const res = await adminPing();
        if (res.ok) {
          setResult(`ok — ${res.data.id}`);
          toast.success("Доступ підтверджено");
        } else {
          setResult(res.code);
          toast.error(res.message);
        }
      } catch {
        setResult("error");
        toast.error("Не вдалося перевірити доступ. Спробуйте ще раз.");
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={check} disabled={pending}>
        Перевірити доступ
      </Button>
      <span className="text-sm text-muted-foreground" aria-live="polite">
        {result}
      </span>
    </div>
  );
}
