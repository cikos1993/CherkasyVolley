import Link from "next/link";

export const metadata = { title: "Адмін-зона" };

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">Адмін-зона</h1>
      <nav className="mt-6 grid gap-2 text-sm">
        <Link href="/admin/tournaments" className="underline underline-offset-4">
          Турніри
        </Link>
        <Link href="/admin/teams" className="underline underline-offset-4">
          Команди
        </Link>
        <Link href="/admin/people" className="underline underline-offset-4">
          Керування адмінами
        </Link>
      </nav>
    </main>
  );
}
