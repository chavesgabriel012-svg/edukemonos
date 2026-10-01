/**
 * Minimal Supabase REST client for the ingest scripts (service role, server-side only).
 * Uses PostgREST and Storage over fetch so the scripts need no extra dependency.
 */
export interface Db {
  select<T>(table: string, query: string): Promise<T[]>;
  insert<T>(table: string, rows: object[], opts?: { upsertOn?: string; returning?: boolean }): Promise<T[]>;
  delete(table: string, query: string): Promise<number>;
  upload(bucket: string, path: string, body: Buffer, contentType: string): Promise<void>;
}

export function createDb(url: string, serviceRoleKey: string, fetchImpl: typeof fetch = fetch): Db {
  const base = url.replace(/\/$/, "");
  const auth = { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` };
  const check = async (res: Response, what: string) => {
    if (!res.ok) throw new Error(`${what}: HTTP ${res.status} ${(await res.text()).slice(0, 400)}`);
    return res;
  };
  return {
    async select(table, query) {
      const res = await check(await fetchImpl(`${base}/rest/v1/${table}?${query}`, { headers: auth }), `select ${table}`);
      return res.json();
    },
    async insert(table, rows, { upsertOn, returning = true } = {}) {
      if (rows.length === 0) return [];
      const prefer = [returning ? "return=representation" : "return=minimal"];
      if (upsertOn) prefer.push("resolution=merge-duplicates");
      const qs = upsertOn ? `?on_conflict=${upsertOn}` : "";
      const res = await check(
        await fetchImpl(`${base}/rest/v1/${table}${qs}`, {
          method: "POST",
          headers: { ...auth, "content-type": "application/json", prefer: prefer.join(",") },
          body: JSON.stringify(rows),
        }),
        `insert ${table}`,
      );
      return returning ? res.json() : [];
    },
    async delete(table, query) {
      const res = await check(
        await fetchImpl(`${base}/rest/v1/${table}?${query}`, { method: "DELETE", headers: { ...auth, prefer: "return=representation" } }),
        `delete ${table}`,
      );
      return ((await res.json()) as unknown[]).length;
    },
    async upload(bucket, path, body, contentType) {
      await check(
        await fetchImpl(`${base}/storage/v1/object/${bucket}/${path}`, {
          method: "POST",
          headers: { ...auth, "content-type": contentType, "x-upsert": "true" },
          body: new Uint8Array(body),
        }),
        `upload ${bucket}/${path}`,
      );
    },
  };
}

export function dbFromEnv(env: Record<string, string | undefined> = process.env): Db | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createDb(url, key) : null;
}
