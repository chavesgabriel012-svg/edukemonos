import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

/**
 * Supabase client bound to the visitor's session (RLS applies). Create one per request.
 * In Server Components cookies are read-only; the proxy refreshes the session instead.
 */
export async function createClient() {
  // Read cookies first: it marks the route as dynamic, so it is never prerendered at build time.
  const cookieStore = await cookies();
  const env = supabaseEnv();
  if (!env) throw new Error("Supabase no está configurado (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: the proxy keeps the session fresh.
        }
      },
    },
  });
}
