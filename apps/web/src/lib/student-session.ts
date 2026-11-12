import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Students study without an account: the first time they answer, they get an anonymous session
 * that keeps their progress on this device (and a recovery code can carry it to another one).
 * Lives outside the "use server" files so it is never exposed as an action.
 */
export async function studentClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) return { supabase, userId: data.user.id, error: null };
  const { data: signed, error } = await supabase.auth.signInAnonymously();
  if (error || !signed.user) {
    console.error("anonymous sign-in failed:", error?.message);
    return { supabase, userId: null, error: "No pudimos guardar tu progreso en este momento. Intenta de nuevo en un rato." };
  }
  return { supabase, userId: signed.user.id, error: null };
}
