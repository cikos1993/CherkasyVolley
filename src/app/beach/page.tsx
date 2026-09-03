import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Пляжний" };

export default function BeachPage() {
  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Пляжний</h1>
      <div className="mt-6">
        <EmptyState title="Незабаром">
          У розділі «Пляжний» ще немає турнірів.
        </EmptyState>
      </div>
    </main>
  );
}
