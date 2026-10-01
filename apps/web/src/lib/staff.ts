import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StaffRole = "teacher" | "reviewer" | "admin";

/**
 * Returns the signed-in staff member, or redirects to /entrar. Uses getUser(), which validates
 * the session with Supabase Auth instead of trusting the cookie.
 */
export async function requireStaff(next: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user || data.user.is_anonymous) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  const { data: profile } = await supabase.from("profiles").select("role, display_name").eq("id", data.user.id).single();
  return { supabase, user: data.user, role: (profile?.role ?? null) as StaffRole | null };
}

/** Reviewers and admins only. Everyone else gets a clear message, not the data (RLS also blocks it). */
export async function requireReviewer(next: string) {
  const staff = await requireStaff(next);
  return { ...staff, allowed: staff.role === "reviewer" || staff.role === "admin" };
}
