"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/classic", label: "Класичний" },
  { href: "/beach", label: "Пляжний" },
  { href: "/archive", label: "Архів" },
] as const;

export function DisciplineNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {ITEMS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-sm bg-muted px-2.5 py-1.5 text-[13px] font-semibold text-foreground"
                : "rounded-sm px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
