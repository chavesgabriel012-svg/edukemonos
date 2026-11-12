"use server";

import { headers } from "next/headers";
import { clientIp } from "@/lib/origin";
import { studentClient } from "@/lib/student-session";
import { createClient } from "@/lib/supabase/server";
import { consumeQuota } from "@/lib/tutor-server";

/**
 * Personal recovery code (docs/producto/gamificacion.md §3.1). Creating returns the code once;
 * redeeming moves the progress of the code's owner to this device's anonymous session. Both
 * run inside the database (create_recovery_code, redeem_recovery_code), which keeps only a hash.
 */

export interface CreateCodeState {
  code?: string;
  error?: string;
}

export async function createRecoveryCode(): Promise<CreateCodeState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Todavía no tienes progreso en este dispositivo. Resuelve tu primer ejercicio y vuelve aquí." };
  if (!auth.user.is_anonymous) return { error: "Las cuentas de docente o revisor no usan código de recuperación." };
  const { data, error } = await supabase.rpc("create_recovery_code");
  if (error) {
    if (/too many codes/.test(error.message)) return { error: "Ya creaste varios códigos en la última hora. Intenta más tarde." };
    console.error("create_recovery_code failed:", error.message);
    return { error: "No pudimos crear tu código. Intenta de nuevo." };
  }
  return { code: data as string };
}

export interface RedeemState {
  done?: { alreadyHere: boolean; attempts: number; sections: number };
  error?: string;
  /** What the student typed, so a typo does not mean typing all 12 characters again. */
  value?: string;
}

const GENERIC = "No pudimos recuperar tu progreso. Intenta de nuevo en un rato.";

export async function redeemRecoveryCode(_prev: RedeemState, form: FormData): Promise<RedeemState> {
  const code = String(form.get("code") ?? "").slice(0, 40);
  return { ...(await redeem(code)), value: code };
}

async function redeem(code: string): Promise<RedeemState> {
  if (code.replace(/[^0-9a-z]/gi, "").length !== 12) return { error: "El código tiene 12 letras y números, como K7QM-4RTX-9PZC." };

  // The database limits guesses per session; this limits them per network, since anyone can open
  // many anonymous sessions.
  try {
    if (!(await consumeQuota(`recovery_ip:${clientIp(await headers())}`, 20, 3600))) {
      return { error: "Hubo demasiados intentos desde esta red. Espera una hora e intenta de nuevo." };
    }
  } catch (error) {
    console.error("recovery quota failed:", (error as Error).message);
    return { error: GENERIC };
  }

  const { supabase, error: sessionError } = await studentClient();
  if (sessionError) return { error: sessionError };
  const { data, error } = await supabase.rpc("redeem_recovery_code", { p_code: code });
  if (error) {
    if (/staff accounts/.test(error.message)) return { error: "Las cuentas de docente o revisor no usan código de recuperación." };
    console.error("redeem_recovery_code failed:", error.message);
    return { error: GENERIC };
  }
  const r = data as { ok: boolean; error?: string; already_here?: boolean; moved?: { attempts: number; sections: number } };
  if (!r.ok) {
    if (r.error === "rate_limited") return { error: "Hiciste varios intentos seguidos. Espera 15 minutos e intenta de nuevo." };
    return { error: "Ese código no existe o ya se reemplazó por uno nuevo. Revísalo letra por letra." };
  }
  return { done: { alreadyHere: Boolean(r.already_here), attempts: r.moved?.attempts ?? 0, sections: r.moved?.sections ?? 0 } };
}
