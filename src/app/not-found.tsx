import Link from "next/link";

export const metadata = { title: "Сторінку не знайдено" };

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Сторінку не знайдено</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Такої сторінки немає.{" "}
        <Link href="/classic" className="underline underline-offset-4">
          На головну
        </Link>
      </p>
    </main>
  );
}
