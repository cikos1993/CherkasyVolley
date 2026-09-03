import Link from "next/link";

import { getSessionUser } from "@/auth/requireAdmin";
import { countAdmins, listAuthenticatedUsers } from "@/data/users";
import { GrantAdminButton, RevokeAdminButton } from "@/components/admin-role-controls";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function initials(value: string): string {
  const parts = value.trim().split(/[\s@.]+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "?"}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export default async function AdminPeoplePage() {
  const [me, users, adminCount] = await Promise.all([
    getSessionUser(),
    listAuthenticatedUsers(),
    countAdmins(),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        ← Адмін-зона
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Керування адмінами</h1>
      <p className="mt-2 text-muted-foreground">
        Роль адміна дає доступ до керування турнірами.
      </p>

      {users.length === 0 ? (
        <p className="mt-6 text-muted-foreground">Ще ніхто не входив.</p>
      ) : (
        <ul className="mt-6 divide-y">
          {users.map((user) => {
            const label = user.name?.trim() ? user.name : user.email;
            const isSelf = user.id === me?.id;
            const lastAdmin = isSelf && adminCount <= 1;
            return (
              <li key={user.id} className="flex items-center gap-3 py-3">
                <Avatar>
                  {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                  <AvatarFallback>{initials(label)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {label}
                    {isSelf ? <span className="text-muted-foreground"> (ви)</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                {user.isAdmin ? (
                  <div className="flex flex-col items-end gap-1">
                    <RevokeAdminButton userId={user.id} isSelf={isSelf} disabled={lastAdmin} />
                    {lastAdmin ? (
                      <span className="text-xs text-muted-foreground">
                        Ви єдиний адміністратор
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <GrantAdminButton userId={user.id} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
