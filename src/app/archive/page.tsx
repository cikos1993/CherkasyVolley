import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { SectionShell } from "@/components/section-shell";
import { ARCHIVE_EMPTY } from "@/lib/empty-states";
import { ARCHIVE } from "@/lib/sections";

export const metadata: Metadata = { title: ARCHIVE.label };

export default function ArchivePage() {
  return (
    <SectionShell title={ARCHIVE.label}>
      <EmptyState {...ARCHIVE_EMPTY} />
    </SectionShell>
  );
}
