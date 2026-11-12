import "server-only";
import type { MyBadges } from "@edukemonos/curriculum";
import { createClient } from "@/lib/supabase/server";

/** The visitor's badges (and their best streak), or null without a student session. */
export async function myBadges(): Promise<MyBadges | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.is_anonymous) return null;
  const { data, error } = await supabase.rpc("my_badges");
  if (error) {
    console.error("my_badges failed:", error.message);
    return null;
  }
  return data as MyBadges;
}

export interface VerifiedCertificate {
  valid: boolean;
  unit?: string;
  subject?: string;
  grade?: number;
  earned_on?: string;
  skills?: string[];
}

/** Anyone can check a certificate code; the answer never says who earned it. */
export async function verifyCertificate(code: string): Promise<VerifiedCertificate> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_certificate", { p_code: code });
  if (error) {
    console.error("verify_certificate failed:", error.message);
    return { valid: false };
  }
  return data as VerifiedCertificate;
}

/** «12 de marzo de 2027», in Costa Rica. */
export function longDate(iso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00-06:00`) : new Date(iso);
  return d.toLocaleDateString("es-CR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Costa_Rica" });
}
