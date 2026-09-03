import { requireAdminPage } from "@/auth/requireAdmin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdminPage();
  return <>{children}</>;
}
