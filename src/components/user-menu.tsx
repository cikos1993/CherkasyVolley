"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(value: string): string {
  const parts = value.trim().split(/[\s@.]+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "?"}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export function UserMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);

  // The sign-in page has its own CTA; no menu there.
  if (pathname === "/sign-in") return <div className="size-8" aria-hidden />;

  // Reserve the slot so the header does not shift when the session resolves.
  if (isPending) return <div className="size-8" aria-hidden />;

  if (!session) {
    const from =
      typeof window !== "undefined" ? pathname + window.location.search : pathname;
    return (
      <Link
        href={`/sign-in?from=${encodeURIComponent(from)}`}
        className="rounded-sm px-1 text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Увійти
      </Link>
    );
  }

  const { name, email, image } = session.user;
  const label = name?.trim() ? name : email;

  async function signOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.replace("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Меню користувача"
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="size-8">
          {image ? <AvatarImage src={image} alt="" /> : null}
          <AvatarFallback>{initials(label)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5">
          <p className="text-sm">{name?.trim() ? name : "—"}</p>
          <p className="text-xs text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} disabled={signingOut}>
          Вийти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
