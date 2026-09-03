import type { ReactNode } from "react";

export function SectionShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <div className="mt-6">{children}</div>
    </main>
  );
}
