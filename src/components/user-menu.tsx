"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(nameOrEmail: string): string {
  const parts = nameOrEmail.trim().split(/[\s@.]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}

export function UserMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return null;

  if (!session) {
    return (
      <Link
        href={`/sign-in?from=${encodeURIComponent(pathname)}`}
        className="text-sm underline underline-offset-4"
      >
        Увійти
      </Link>
    );
  }

  const { name, email, image } = session.user;
  const label = name ?? email;

  async function signOut() {
    await authClient.signOut();
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="size-8">
          {image ? <AvatarImage src={image} alt={label} /> : null}
          <AvatarFallback>{initials(label)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm">{name ?? "—"}</span>
          <span className="block text-xs text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>Вийти</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
