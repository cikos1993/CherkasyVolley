import { AdminPingButton } from "@/components/admin-ping-button";

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">Адмін-зона</h1>
      <p className="mt-2 text-muted-foreground">
        Керування турнірами зʼявиться в наступних історіях.
      </p>
      <div className="mt-6">
        <AdminPingButton />
      </div>
    </main>
  );
}
