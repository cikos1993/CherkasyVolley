import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { SectionShell } from "@/components/section-shell";
import { BEACH_SOON } from "@/lib/empty-states";
import { BEACH } from "@/lib/sections";

export const metadata: Metadata = { title: BEACH.label };

export default function BeachPage() {
  return (
    <SectionShell title={BEACH.label}>
      <EmptyState {...BEACH_SOON} />
    </SectionShell>
  );
}
