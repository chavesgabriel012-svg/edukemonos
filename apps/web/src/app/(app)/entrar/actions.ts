"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestOrigin } from "@/lib/origin";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const next = safeNext(formData.get("next"));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect(`/entrar?error=correo&next=${encodeURIComponent(next)}`);

  const origin = requestOrigin(await headers());
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  if (error) redirect(`/entrar?error=envio&next=${encodeURIComponent(next)}`);
  redirect(`/entrar?enviado=1&next=${encodeURIComponent(next)}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
