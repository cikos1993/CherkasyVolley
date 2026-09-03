import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { SectionShell } from "@/components/section-shell";
import { NO_TOURNAMENTS } from "@/lib/empty-states";
import { CLASSIC } from "@/lib/sections";

export const metadata: Metadata = { title: CLASSIC.label };

export default function ClassicPage() {
  return (
    <SectionShell title={CLASSIC.label}>
      <EmptyState {...NO_TOURNAMENTS} />
    </SectionShell>
  );
}
