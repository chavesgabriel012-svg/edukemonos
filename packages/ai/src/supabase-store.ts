import type { SpendSource } from "./budget";
import type { UsageRecord, UsageSink } from "./types";

/**
 * Minimal shape of a Supabase client (service role) so this package does not depend on
 * @supabase/supabase-js. Pass `createClient(url, serviceRoleKey)`.
 */
export interface SupabaseLike {
  from(table: string): { insert(row: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }> };
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

/** Writes one `ai_usage` row per call (or failed attempt). */
export function supabaseUsageSink(db: SupabaseLike): UsageSink {
  return async (r: UsageRecord) => {
    const { error } = await db.from("ai_usage").insert({
      provider: r.provider,
      model: r.model,
      purpose: r.purpose,
      input_tokens: r.inputTokens,
      output_tokens: r.outputTokens,
      cost_usd_estimate: r.costUsdEstimate,
      latency_ms: r.latencyMs,
      success: r.success,
      error: r.error,
      actor_id: r.actorId ?? null,
      section_id: r.sectionId ?? null,
    });
    if (error) throw new Error(`ai_usage insert failed: ${error.message}`);
  };
}

/**
 * Reads spend from `ai_spend_usd_since`. Fails closed: if the spend cannot be read, the call
 * is refused, because a fuse that cannot see the meter must not let money through.
 */
export function supabaseSpendSource(db: SupabaseLike): SpendSource {
  return {
    async spentSince(since: Date) {
      const { data, error } = await db.rpc("ai_spend_usd_since", { p_since: since.toISOString() });
      if (error) throw new Error(`AI spend check failed, refusing the call: ${error.message}`);
      const row = (Array.isArray(data) ? data[0] : data) as { spent_usd?: number | string } | undefined;
      const spent = Number(row?.spent_usd ?? NaN);
      if (!Number.isFinite(spent)) throw new Error("AI spend check returned no number, refusing the call");
      return spent;
    },
  };
}
