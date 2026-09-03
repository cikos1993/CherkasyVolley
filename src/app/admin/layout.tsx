import { requireAdminPage } from "@/auth/requireAdmin";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdminPage();
  return <>{children}</>;
}
