import { requireAdmin } from "@/lib/staff";

/**
 * A layout renders outside its own segment's loading.tsx boundary, so for anyone who is not an
 * Eduka admin notFound() fires before any streaming starts: a real 404, like a path that does not exist.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return children;
}
