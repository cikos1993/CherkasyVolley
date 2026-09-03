import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { SectionShell } from "@/components/section-shell";
import { ARCHIVE } from "@/lib/sections";

export const metadata: Metadata = { title: ARCHIVE.label };

export default function ArchivePage() {
  return (
    <SectionShell title={ARCHIVE.label}>
      <EmptyState
        title="Архів порожній"
        description="Завершені турніри зʼявляться тут за роками."
      />
    </SectionShell>
  );
}
