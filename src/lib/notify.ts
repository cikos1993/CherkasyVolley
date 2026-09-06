import { toast } from "sonner";

/**
 * The one place UI code raises toasts. Import this, not `sonner` directly, so
 * copy and styling stay consistent (errors render on the destructive token,
 * successes on the success token — see `components/ui/sonner.tsx`).
 */
export const notify = {
  success(message: string) {
    toast.success(message);
  },
  warning(message: string) {
    toast.warning(message);
  },
  error(message: string) {
    toast.error(message);
  },
};
