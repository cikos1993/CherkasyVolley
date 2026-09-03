import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Архів" };

export default function ArchivePage() {
  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Архів</h1>
      <div className="mt-6">
        <EmptyState title="Архів порожній">
          Завершені турніри зʼявляться тут за роками.
        </EmptyState>
      </div>
    </main>
  );
}
