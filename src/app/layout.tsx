import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

import { DisciplineNav } from "@/components/discipline-nav";
import { FlashToaster } from "@/components/flash-toaster";
import { UserMenu } from "@/components/user-menu";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: { default: "Волейбол Черкащини", template: "%s · Волейбол Черкащини" },
  description:
    "Платформа турнірів Федерації волейболу Черкащини — розклад, таблиці, результати.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uk" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-2">
          <div className="flex items-center gap-3 sm:gap-5">
            <Link
              href="/classic"
              className="hidden shrink-0 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:block"
            >
              Волейбол Черкащини
            </Link>
            <DisciplineNav />
          </div>
          <UserMenu />
        </header>
        {children}
        <Toaster />
        <FlashToaster />
      </body>
    </html>
  );
}
