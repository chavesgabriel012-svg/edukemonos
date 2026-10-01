import type Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AnthropicAdapter } from "../src/providers/anthropic";
import { OpenAIAdapter } from "../src/providers/openai";
import { defineTool } from "../src/tools";
import { AIRefusalError, type ChatEvent } from "../src/types";

const calculator = defineTool({
  name: "calculate",
  description: "Evaluates an arithmetic expression",
  schema: z.object({ expression: z.string() }),
  run: vi.fn(async ({ expression }: { expression: string }) => (expression === "2^3" ? "8" : "?")),
});

async function collect(it: AsyncIterable<ChatEvent>) {
  const out: ChatEvent[] = [];
  for await (const e of it) out.push(e);
  return out;
}

// ---------------------------------------------------------------- Anthropic
function anthropicMessage(content: unknown[], stop_reason: string, extra: object = {}) {
  return { model: "m", content, stop_reason, usage: { input_tokens: 10, output_tokens: 3 }, ...extra };
}

function fakeAnthropic(turns: ReturnType<typeof anthropicMessage>[]) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        create: vi.fn(async () => turns.shift()),
        stream: vi.fn((params: Record<string, unknown>) => {
          calls.push(structuredClone(params));
          const message = turns.shift()!;
          const texts = message.content.filter((b: any) => b.type === "text") as { text: string }[];
          return {
            async *[Symbol.asyncIterator]() {
              for (const t of texts) yield { type: "content_block_delta", delta: { type: "text_delta", text: t.text } };
            },
            finalMessage: async () => message,
          };
        }),
      },
    },
  };
  return { client: client as unknown as Anthropic, calls };
}

describe("AnthropicAdapter", () => {
  it("runs a tool round and sends all results back in one user message", async () => {
    const { client, calls } = fakeAnthropic([
      anthropicMessage([{ type: "tool_use", id: "t1", name: "calculate", input: { expression: "2^3" } }], "tool_use"),
      anthropicMessage([{ type: "text", text: "Da 8." }], "end_turn"),
    ]);
    const adapter = new AnthropicAdapter({ client });
    const events = await collect(
      adapter.streamChat({ model: "m", messages: [{ role: "user", content: "2^3?" }], tools: [calculator] }),
    );
    expect(events).toEqual([
      { type: "tool_call", name: "calculate", input: { expression: "2^3" } },
      { type: "tool_result", name: "calculate", output: "8", isError: false },
      { type: "text", delta: "Da 8." },
      { type: "done", usage: { inputTokens: 20, outputTokens: 6 }, model: "m", stopReason: "end_turn" },
    ]);
    const second = calls[1].messages as { role: string; content: any }[];
    expect(second.at(-1)).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "t1", content: "8", is_error: false }],
    });
    expect((calls[0].tools as any[])[0].input_schema).toMatchObject({ type: "object", required: ["expression"] });
    expect((calls[0].tools as any[])[0].input_schema.$schema).toBeUndefined();
  });

  it("returns invalid tool input to the model as an error instead of running the tool", async () => {
    const { client, calls } = fakeAnthropic([
      anthropicMessage([{ type: "tool_use", id: "t1", name: "calculate", input: { expr: 1 } }], "tool_use"),
      anthropicMessage([{ type: "text", text: "ok" }], "end_turn"),
    ]);
    await collect(new AnthropicAdapter({ client }).streamChat({ model: "m", messages: [], tools: [calculator] }));
    const result = (calls[1].messages as any[]).at(-1).content[0];
    expect(result.is_error).toBe(true);
  });

  it("does not run tools from a refused turn and stops at the round limit", async () => {
    const refused = fakeAnthropic([
      anthropicMessage([{ type: "tool_use", id: "t1", name: "calculate", input: { expression: "1" } }], "refusal"),
    ]);
    const events = await collect(new AnthropicAdapter({ client: refused.client }).streamChat({ model: "m", messages: [], tools: [calculator] }));
    expect(events.at(-1)).toMatchObject({ type: "done", stopReason: "refusal" });
    expect(events.some((e) => e.type === "tool_call")).toBe(false);

    const looping = fakeAnthropic([
      anthropicMessage([{ type: "tool_use", id: "a", name: "calculate", input: { expression: "1" } }], "tool_use"),
      anthropicMessage([{ type: "tool_use", id: "b", name: "calculate", input: { expression: "1" } }], "tool_use"),
    ]);
    const loopEvents = await collect(
      new AnthropicAdapter({ client: looping.client }).streamChat({ model: "m", messages: [], tools: [calculator], maxToolRounds: 1 }),
    );
    expect(loopEvents.at(-1)).toMatchObject({ type: "done", stopReason: "tool_round_limit" });
  });

  it("throws AIRefusalError on refused text generation", async () => {
    const { client } = fakeAnthropic([
      anthropicMessage([], "refusal", { stop_details: { type: "refusal", category: "cyber", explanation: null } }),
    ]);
    await expect(new AnthropicAdapter({ client }).generateText({ model: "m", messages: [] })).rejects.toBeInstanceOf(AIRefusalError);
  });

  it("adds the server-side fallback only when enabled", async () => {
    const { client, calls } = fakeAnthropic([anthropicMessage([{ type: "text", text: "x" }], "end_turn")]);
    await collect(new AnthropicAdapter({ client, fallbacks: "default" }).streamChat({ model: "m", messages: [] }));
    expect(calls[0]).toMatchObject({ fallbacks: "default", betas: ["server-side-fallback-2026-07-01"] });

    const off = fakeAnthropic([anthropicMessage([{ type: "text", text: "x" }], "end_turn")]);
    await collect(new AnthropicAdapter({ client: off.client }).streamChat({ model: "m", messages: [] }));
    expect(off.calls[0]).not.toHaveProperty("fallbacks");
  });
});

// ---------------------------------------------------------------- OpenAI
function chunk(delta: object, finish_reason: string | null = null, usage?: object) {
  return { model: "o", choices: [{ index: 0, delta, finish_reason }], usage };
}

function fakeOpenAI(turns: object[][]) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    chat: {
      completions: {
        create: vi.fn(async (params: Record<string, unknown>) => {
          calls.push(structuredClone(params));
          const chunks = turns.shift()!;
          return { async *[Symbol.asyncIterator]() { yield* chunks; } };
        }),
      },
    },
  };
  return { client: client as unknown as OpenAI, calls };
}

describe("OpenAIAdapter", () => {
  it("assembles streamed tool-call fragments, runs the tool and continues", async () => {
    const { client, calls } = fakeOpenAI([
      [
        chunk({ tool_calls: [{ index: 0, id: "c1", function: { name: "calculate", arguments: '{"expre' } }] }),
        chunk({ tool_calls: [{ index: 0, function: { arguments: 'ssion":"2^3"}' } }] }, "tool_calls"),
        { model: "o", choices: [], usage: { prompt_tokens: 7, completion_tokens: 2 } },
      ],
      [chunk({ content: "Da 8." }, "stop"), { model: "o", choices: [], usage: { prompt_tokens: 9, completion_tokens: 3 } }],
    ]);
    const events = await collect(
      new OpenAIAdapter({ client }).streamChat({ model: "o", system: "s", messages: [{ role: "user", content: "?" }], tools: [calculator] }),
    );
    expect(events).toEqual([
      { type: "tool_call", name: "calculate", input: { expression: "2^3" } },
      { type: "tool_result", name: "calculate", output: "8", isError: false },
      { type: "text", delta: "Da 8." },
      { type: "done", usage: { inputTokens: 16, outputTokens: 5 }, model: "o", stopReason: "stop" },
    ]);
    const msgs = calls[1].messages as any[];
    expect(msgs[0]).toEqual({ role: "system", content: "s" });
    expect(msgs.at(-1)).toEqual({ role: "tool", tool_call_id: "c1", content: "8" });
    expect(calls[0]).toMatchObject({ stream: true, stream_options: { include_usage: true } });
    expect(calls[0]).not.toHaveProperty("reasoning_effort");
  });
});
