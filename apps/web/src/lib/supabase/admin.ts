import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for the few server-side writes the API roles may not do: tutor messages,
 * AI usage, quotas, writing-feedback counts. Never import this from client code. Every caller
 * must have checked who the user is first.
 */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
