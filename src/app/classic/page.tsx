import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Класичний" };

export default function ClassicPage() {
  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Класичний</h1>
      <div className="mt-6">
        <EmptyState title="Ще немає турнірів">
          Активні турніри зʼявляться тут, коли їх створить адміністратор.
        </EmptyState>
      </div>
    </main>
  );
}
