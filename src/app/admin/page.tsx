import Link from "next/link";

export const metadata = { title: "Адмін-зона" };

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">Адмін-зона</h1>
      <p className="mt-2 text-muted-foreground">
        Керування турнірами зʼявиться в наступних історіях.
      </p>
      <nav className="mt-6">
        <Link href="/admin/people" className="text-sm underline underline-offset-4">
          Керування адмінами
        </Link>
      </nav>
    </main>
  );
}
