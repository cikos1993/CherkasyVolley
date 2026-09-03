import type { Metadata } from "next";
import "./globals.css";

import { UserMenu } from "@/components/user-menu";

export const metadata: Metadata = {
  title: "Волейбол Черкащини",
  description:
    "Платформа турнірів Федерації волейболу Черкащини — розклад, таблиці, результати.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uk" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="flex justify-end px-4 py-2">
          <UserMenu />
        </header>
        {children}
      </body>
    </html>
  );
}
