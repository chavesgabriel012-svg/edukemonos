import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createAI } from "../src/client";
import type { AIConfig } from "../src/config";
import type { ProviderAdapter, UsageRecord } from "../src/types";

const config: AIConfig = {
  provider: "anthropic",
  models: { bulk: ["m-bulk"], tutor: ["m-tutor"], verify: ["m-verify"] },
  embedModel: null,
  effort: { tutor: "low" },
  anthropicFallbacks: null,
  prices: { "m-tutor": { input: 1, output: 5 } },
  budget: { dailyUsd: null, monthlyUsd: null },
};

function fakeAdapter(overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
  return {
    name: "anthropic",
    generateText: vi.fn(async (req) => ({ text: "hola", usage: { inputTokens: 10, outputTokens: 5 }, model: req.model })),
    generateStructured: vi.fn(async (req) => ({ data: { ok: true }, usage: { inputTokens: 1, outputTokens: 1 }, model: req.model })) as never,
    async *streamChat(req) {
      yield { type: "text", delta: "Hola" };
      yield { type: "done", usage: { inputTokens: 1_000_000, outputTokens: 0 }, model: req.model, stopReason: "end_turn" };
    },
    ...overrides,
  };
}

describe("createAI", () => {
  it("routes each role to its configured model and effort", async () => {
    const adapter = fakeAdapter();
    const ai = createAI({ config, adapter });
    await ai.generateText({ role: "tutor", purpose: "tutor" }, { messages: [{ role: "user", content: "x" }] });
    expect(adapter.generateText).toHaveBeenCalledWith(expect.objectContaining({ model: "m-tutor", effort: "low" }));
  });

  it("lets a call override the role's effort", async () => {
    const adapter = fakeAdapter();
    const ai = createAI({ config, adapter });
    await ai.generateText({ role: "tutor", purpose: "tutor" }, { messages: [], effort: "xhigh" });
    expect(adapter.generateText).toHaveBeenCalledWith(expect.objectContaining({ model: "m-tutor", effort: "xhigh" }));
  });

  it("logs usage with cost estimate and without any message text", async () => {
    const records: UsageRecord[] = [];
    const ai = createAI({ config, adapter: fakeAdapter(), sink: (r) => void records.push(r) });
    const events = [];
    for await (const e of ai.streamChat(
      { role: "tutor", purpose: "tutor", actorId: "anon-1" },
      { messages: [{ role: "user", content: "secreto" }] },
    )) {
      events.push(e);
    }
    expect(events.map((e) => e.type)).toEqual(["text", "done"]);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ model: "m-tutor", purpose: "tutor", success: true, costUsdEstimate: 1, actorId: "anon-1" });
    expect(JSON.stringify(records[0])).not.toContain("secreto");
  });

  it("prices a dated served model id with the configured model's price", async () => {
    // Anthropic answers a "claude-haiku-4-5" request as "claude-haiku-4-5-20251001".
    const records: UsageRecord[] = [];
    const dated = fakeAdapter({
      generateText: vi.fn(async () => ({ text: "ok", usage: { inputTokens: 1_000_000, outputTokens: 0 }, model: "m-tutor-20251001" })),
      async *streamChat() {
        yield { type: "done", usage: { inputTokens: 1_000_000, outputTokens: 0 }, model: "m-tutor-20251001", stopReason: "end_turn" };
      },
    });
    const ai = createAI({ config, adapter: dated, sink: (r) => void records.push(r) });
    await ai.generateText({ role: "tutor", purpose: "tutor" }, { messages: [] });
    for await (const _ of ai.streamChat({ role: "tutor", purpose: "tutor" }, { messages: [] })) void _;
    await ai.diagnose();
    // generateText, streamChat and the tutor diagnostic, in that order: all priced as m-tutor.
    expect(records.slice(0, 3).map((r) => [r.model, r.costUsdEstimate])).toEqual(Array(3).fill(["m-tutor-20251001", 1]));
    // The bulk diagnostic asked for m-bulk, which has no price: still null, not borrowed from elsewhere.
    expect(records[3]).toMatchObject({ purpose: "diagnostic", costUsdEstimate: null });
  });

  it("logs failures and rethrows", async () => {
    const records: UsageRecord[] = [];
    const adapter = fakeAdapter({ generateText: vi.fn(async () => { throw new Error("boom"); }) });
    const ai = createAI({ config, adapter, sink: (r) => void records.push(r) });
    await expect(ai.generateText({ role: "bulk", purpose: "bulk_material" }, { messages: [] })).rejects.toThrow("boom");
    expect(records[0]).toMatchObject({ success: false, error: "boom", model: "m-bulk" });
  });

  it("never lets a failing sink break the call", async () => {
    const ai = createAI({ config, adapter: fakeAdapter(), sink: () => { throw new Error("db down"); } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await ai.generateStructured(
      { role: "verify", purpose: "verify_item" },
      { messages: [], schema: z.object({ ok: z.boolean() }), schemaName: "check" },
    );
    expect(result.data).toEqual({ ok: true });
    spy.mockRestore();
  });

  it("refuses embeddings when not configured", async () => {
    const ai = createAI({ config, adapter: fakeAdapter() });
    await expect(ai.embed({ purpose: "other" }, ["x"])).rejects.toThrow(/Embeddings/);
  });
});
