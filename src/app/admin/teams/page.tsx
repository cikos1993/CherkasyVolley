import Link from "next/link";

import { TeamForm } from "@/components/team-form";
import { listTeams } from "@/data/teams";

export const metadata = { title: "Команди" };

export default async function AdminTeamsPage() {
  const teams = await listTeams();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        <span aria-hidden>←</span> Адмін-зона
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Команди</h1>

      <div className="mt-6">
        <TeamForm />
      </div>

      {teams.length === 0 ? (
        <p className="mt-6 text-muted-foreground">Ще немає команд.</p>
      ) : (
        <ul className="mt-6 divide-y">
          {teams.map((team) => (
            <li key={team.id} className="py-3 text-sm">
              {team.name}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
