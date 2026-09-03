import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { SectionShell } from "@/components/section-shell";
import { CLASSIC } from "@/lib/sections";

export const metadata: Metadata = { title: CLASSIC.label };

export default function ClassicPage() {
  return (
    <SectionShell title={CLASSIC.label}>
      <EmptyState
        title="Ще немає турнірів"
        description="Активні турніри зʼявляться тут, коли їх створить адміністратор."
      />
    </SectionShell>
  );
}
