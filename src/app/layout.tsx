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
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/classic" className="font-semibold whitespace-nowrap">
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
