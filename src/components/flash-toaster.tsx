"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const FLASH_MESSAGES: Record<string, string> = {
  "admin-required": "Потрібні права адміністратора",
};

function FlashReader() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const error = searchParams.get("error");

  useEffect(() => {
    if (!error) return;
    const message = FLASH_MESSAGES[error];
    if (message) toast.error(message, { id: `flash-${error}` });

    const params = new URLSearchParams(searchParams.toString());
    params.delete("error");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [error, pathname, router, searchParams]);

  return null;
}

/**
 * Shows a one-shot toast for an `?error` query param, then strips just that param
 * so a refresh does not re-fire it. The reader sits in its own Suspense boundary
 * so `useSearchParams` does not opt static pages out of prerendering.
 */
export function FlashToaster() {
  return (
    <Suspense fallback={null}>
      <FlashReader />
    </Suspense>
  );
}
