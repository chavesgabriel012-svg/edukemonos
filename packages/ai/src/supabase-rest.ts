import type { SupabaseLike } from "./supabase-store";

/**
 * Tiny PostgREST client implementing SupabaseLike with fetch, for scripts (ingest, diagnose)
 * that should not pull in @supabase/supabase-js. Uses the service role key: server-side only.
 */
export function supabaseRest(url: string, serviceRoleKey: string): SupabaseLike {
  const headers = {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
  };
  const base = url.replace(/\/$/, "");
  const call = async (path: string, body: unknown, extra: Record<string, string> = {}) => {
    const res = await fetch(`${base}/rest/v1/${path}`, { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(body) });
    const text = await res.text();
    if (!res.ok) return { data: null, error: { message: `HTTP ${res.status}: ${text.slice(0, 300)}` } };
    return { data: text ? JSON.parse(text) : null, error: null };
  };
  return {
    from: (table) => ({
      insert: async (row) => {
        const { error } = await call(table, row, { prefer: "return=minimal" });
        return { error };
      },
    }),
    rpc: (fn, args) => call(`rpc/${fn}`, args),
  };
}
