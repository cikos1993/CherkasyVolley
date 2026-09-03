"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SECTIONS, isActiveSection } from "@/lib/sections";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function DisciplineNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Розділи" className="flex items-center gap-1">
      {SECTIONS.map(({ href, label }) => {
        const active = isActiveSection(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : active ? "true" : undefined}
            className={`rounded-sm px-2.5 py-2 text-[13px] transition-colors sm:py-1.5 ${FOCUS} ${
              active
                ? "bg-muted font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
