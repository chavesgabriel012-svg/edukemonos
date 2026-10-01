import { describe, expect, it, vi } from "vitest";
import { createBudgetGuard, startOfDayCR, startOfMonthCR } from "../src/budget";
import { createAI } from "../src/client";
import { type AIConfig, loadAIConfig } from "../src/config";
import { supabaseSpendSource, supabaseUsageSink, type SupabaseLike } from "../src/supabase-store";
import {
  AIBudgetExceededError,
  AIConfigError,
  AIRefusalError,
  AIUnavailableError,
  type ChatEvent,
  type ProviderAdapter,
  type UsageRecord,
} from "../src/types";

const base: AIConfig = {
  provider: "anthropic",
  models: { bulk: ["b1"], tutor: ["haiku", "sonnet"], verify: ["v1"] },
  embedModel: null,
  effort: {},
  anthropicFallbacks: null,
  prices: { haiku: { input: 1, output: 5 }, sonnet: { input: 2, output: 10 }, b1: { input: 2, output: 10 }, v1: { input: 2, output: 10 } },
  budget: { dailyUsd: null, monthlyUsd: null },
};

const ok = (model: string) => ({ text: "hola", usage: { inputTokens: 1000, outputTokens: 100 }, model });

function adapter(behaviour: Record<string, () => unknown>): ProviderAdapter {
  const run = (model: string) => {
    const b = behaviour[model];
    if (!b) throw new Error(`unexpected model ${model}`);
    return b();
  };
  return {
    name: "anthropic",
    generateText: vi.fn(async (req) => run(req.model) as never),
    generateStructured: vi.fn(async (req) => run(req.model) as never),
    async *streamChat(req) {
      const r = run(req.model) as ChatEvent[] | Error;
      if (r instanceof Error) throw r;
      for (const e of r) {
        if ((e as unknown) instanceof Error) throw e;
        yield e;
      }
    },
  };
}

describe("fallback chain", () => {
  it("uses the next model when the first fails, and logs both attempts", async () => {
    const records: UsageRecord[] = [];
    const ai = createAI({
      config: base,
      sink: (r) => void records.push(r),
      adapter: adapter({ haiku: () => { throw new Error("529 overloaded"); }, sonnet: () => ok("sonnet") }),
    });
    const r = await ai.generateText({ role: "tutor", purpose: "tutor" }, { messages: [] });
    expect(r.model).toBe("sonnet");
    expect(records.map((x) => [x.model, x.success])).toEqual([["haiku", false], ["sonnet", true]]);
  });

  it("raises AIUnavailableError listing every failure when all models fail", async () => {
    const ai = createAI({
      config: base,
      adapter: adapter({ haiku: () => { throw new Error("down"); }, sonnet: () => { throw new Error("also down"); } }),
    });
    const err = await ai.generateText({ role: "tutor", purpose: "tutor" }, { messages: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(AIUnavailableError);
    expect((err as AIUnavailableError).attempts.map((a) => a.model)).toEqual(["haiku", "sonnet"]);
  });

  it("respects a refusal instead of asking another model", async () => {
    const sonnet = vi.fn(() => ok("sonnet"));
    const ai = createAI({ config: base, adapter: adapter({ haiku: () => { throw new AIRefusalError("no"); }, sonnet }) });
    await expect(ai.generateText({ role: "tutor", purpose: "tutor" }, { messages: [] })).rejects.toBeInstanceOf(AIRefusalError);
    expect(sonnet).not.toHaveBeenCalled();
  });

  it("falls back in streams only if nothing reached the student yet", async () => {
    const done: ChatEvent = { type: "done", usage: { inputTokens: 1, outputTokens: 1 }, model: "sonnet", stopReason: "end_turn" };
    const before = createAI({
      config: base,
      adapter: adapter({ haiku: () => new Error("overloaded"), sonnet: () => [{ type: "text", delta: "Hola" }, done] }),
    });
    const events: ChatEvent[] = [];
    for await (const e of before.streamChat({ role: "tutor", purpose: "tutor" }, { messages: [] })) events.push(e);
    expect(events.map((e) => e.type)).toEqual(["text", "done"]);

    const midway = createAI({
      config: base,
      adapter: adapter({ haiku: () => [{ type: "text", delta: "Ho" }, new Error("cut") as never], sonnet: () => [done] }),
    });
    const seen: ChatEvent[] = [];
    await expect(
      (async () => {
        for await (const e of midway.streamChat({ role: "tutor", purpose: "tutor" }, { messages: [] })) seen.push(e);
      })(),
    ).rejects.toThrow("cut");
    expect(seen).toEqual([{ type: "text", delta: "Ho" }]);
  });
});

describe("spend fuse", () => {
  it("computes Costa Rica day and month windows (UTC-6)", () => {
    // 2026-10-01 03:00 UTC is still 2026-09-30 21:00 in Costa Rica.
    const t = new Date("2026-10-01T03:00:00Z");
    expect(startOfDayCR(t).toISOString()).toBe("2026-09-30T06:00:00.000Z");
    expect(startOfMonthCR(t).toISOString()).toBe("2026-09-01T06:00:00.000Z");
  });

  it("blocks calls once the daily limit is reached and never touches the model", async () => {
    const spent = { value: 0.99 };
    const guard = createBudgetGuard({ dailyUsd: 1, monthlyUsd: 8 }, { spentSince: async () => spent.value });
    const haiku = vi.fn(() => ok("haiku"));
    const ai = createAI({ config: { ...base, budget: { dailyUsd: 1, monthlyUsd: 8 } }, budget: guard, adapter: adapter({ haiku, sonnet: haiku }) });
    await ai.generateText({ role: "tutor", purpose: "tutor" }, { messages: [] });
    spent.value = 1.0;
    const err = await ai.generateText({ role: "tutor", purpose: "tutor" }, { messages: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(AIBudgetExceededError);
    expect((err as AIBudgetExceededError).window).toBe("day");
    expect(haiku).toHaveBeenCalledTimes(1);
  });

  it("refuses to start with limits but no spend source", () => {
    expect(() => createAI({ config: { ...base, budget: { dailyUsd: 1, monthlyUsd: null } }, adapter: adapter({}) })).toThrow(AIConfigError);
    expect(() => createAI({ config: { ...base, budget: { dailyUsd: 1, monthlyUsd: null } }, adapter: adapter({}), budget: null })).not.toThrow();
  });

  it("refuses a config where a model has no price, because the fuse would be blind to it", () => {
    const env = {
      AI_PROVIDER: "anthropic",
      MODEL_TUTOR: "haiku, sonnet",
      MODEL_BULK: "sonnet",
      MODEL_VERIFY: "sonnet",
      AI_BUDGET_MONTHLY_USD: "8",
      AI_PRICES_JSON: JSON.stringify({ haiku: { input: 1, output: 5 } }),
    };
    expect(() => loadAIConfig(env)).toThrow(/no price for sonnet/);
    const okEnv = { ...env, AI_PRICES_JSON: JSON.stringify({ haiku: { input: 1, output: 5 }, sonnet: { input: 2, output: 10 } }) };
    expect(loadAIConfig(okEnv).models.tutor).toEqual(["haiku", "sonnet"]);
  });
});

describe("supabase store", () => {
  const fake = (rpcResult: { data: unknown; error: { message: string } | null }) => {
    const inserted: Record<string, unknown>[] = [];
    const db: SupabaseLike = {
      from: () => ({ insert: async (row) => (inserted.push(row), { error: null }) }),
      rpc: async () => rpcResult,
    };
    return { db, inserted };
  };

  it("reads the spend and fails closed when it cannot", async () => {
    expect(await supabaseSpendSource(fake({ data: [{ spent_usd: "0.42", unpriced_calls: 0 }], error: null }).db).spentSince(new Date())).toBe(0.42);
    await expect(supabaseSpendSource(fake({ data: null, error: { message: "timeout" } }).db).spentSince(new Date())).rejects.toThrow(/refusing/);
    await expect(supabaseSpendSource(fake({ data: [], error: null }).db).spentSince(new Date())).rejects.toThrow(/refusing/);
  });

  it("maps usage records to ai_usage columns", async () => {
    const { db, inserted } = fake({ data: null, error: null });
    await supabaseUsageSink(db)({
      provider: "anthropic", model: "haiku", purpose: "tutor", inputTokens: 10, outputTokens: 2,
      costUsdEstimate: 0.00002, latencyMs: 5, success: true, error: null, actorId: "a", sectionId: null,
    });
    expect(inserted[0]).toMatchObject({ model: "haiku", cost_usd_estimate: 0.00002, actor_id: "a", latency_ms: 5 });
  });
});

describe("diagnose", () => {
  it("probes every model in every chain and flags missing prices", async () => {
    const ai = createAI({
      config: { ...base, prices: { haiku: { input: 1, output: 5 } } },
      adapter: adapter({ haiku: () => ok("haiku"), sonnet: () => { throw new Error("404 model not found"); }, b1: () => ok("b1"), v1: () => ok("v1") }),
    });
    const rows = await ai.diagnose();
    expect(rows.filter((r) => r.status === "error").map((r) => r.model)).toEqual(["sonnet"]);
    expect(rows.filter((r) => r.status === "no_price").map((r) => r.model).sort()).toEqual(["b1", "sonnet", "v1"]);
  });
});
