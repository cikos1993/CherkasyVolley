import Link from "next/link";

import { TournamentForm } from "@/components/tournament-form";

export const metadata = { title: "Створити турнір" };

export default function NewTournamentPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        <span aria-hidden>←</span> Адмін-зона
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Створити турнір</h1>
      <div className="mt-6">
        <TournamentForm />
      </div>
    </main>
  );
}
