import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  AIOutputError,
  AIRefusalError,
  type BaseRequest,
  type ChatEvent,
  type ChatRequest,
  type Effort,
  type ProviderAdapter,
  type StructuredRequest,
  type StructuredResult,
  type TextResult,
  type Usage,
} from "../types";
import { runTool } from "../tools";

type ChatParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const DEFAULT_MAX_TOKENS = 16_000;
const DEFAULT_MAX_TOOL_ROUNDS = 4;

export interface OpenAIAdapterOptions {
  apiKey?: string;
  client?: OpenAI;
}

function toMessages(req: BaseRequest): ChatParam[] {
  return [
    ...(req.system ? [{ role: "system" as const, content: req.system }] : []),
    ...req.messages.map((m) => ({ role: m.role, content: m.content })),
  ];
}

/** OpenAI reasoning effort has fewer levels; only sent when configured (non-reasoning models reject it). */
function reasoningEffort(effort: Effort | undefined) {
  if (!effort) return {};
  const mapped = effort === "xhigh" || effort === "max" ? "high" : effort;
  return { reasoning_effort: mapped as OpenAI.ReasoningEffort };
}

function usageOf(usage: OpenAI.CompletionUsage | null | undefined): Usage {
  return { inputTokens: usage?.prompt_tokens ?? 0, outputTokens: usage?.completion_tokens ?? 0 };
}

export class OpenAIAdapter implements ProviderAdapter {
  readonly name = "openai" as const;
  private readonly client: OpenAI;

  constructor(options: OpenAIAdapterOptions = {}) {
    this.client = options.client ?? new OpenAI({ apiKey: options.apiKey });
  }

  async generateText(req: BaseRequest): Promise<TextResult> {
    const completion = await this.client.chat.completions.create(
      {
        model: req.model,
        messages: toMessages(req),
        max_completion_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...reasoningEffort(req.effort),
      },
      { signal: req.signal },
    );
    const choice = completion.choices[0];
    if (choice?.message.refusal) throw new AIRefusalError(choice.message.refusal);
    return { text: choice?.message.content ?? "", usage: usageOf(completion.usage), model: completion.model };
  }

  async generateStructured<Schema extends z.ZodType>(
    req: StructuredRequest<Schema>,
  ): Promise<StructuredResult<z.infer<Schema>>> {
    const completion = await this.client.chat.completions.parse(
      {
        model: req.model,
        messages: toMessages(req),
        max_completion_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        response_format: zodResponseFormat(req.schema, req.schemaName),
        ...reasoningEffort(req.effort),
      },
      { signal: req.signal },
    );
    const message = completion.choices[0]?.message;
    if (message?.refusal) throw new AIRefusalError(message.refusal);
    if (message?.parsed == null) {
      throw new AIOutputError(`Output did not match schema "${req.schemaName}"`);
    }
    return { data: message.parsed as z.infer<Schema>, usage: usageOf(completion.usage), model: completion.model };
  }

  async *streamChat(req: ChatRequest): AsyncIterable<ChatEvent> {
    const tools = req.tools ?? [];
    const byName = new Map(tools.map((t) => [t.name, t]));
    const apiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = tools.map((t) => {
      const { $schema: _ignored, ...parameters } = z.toJSONSchema(t.schema) as Record<string, unknown>;
      return { type: "function", function: { name: t.name, description: t.description, parameters } };
    });
    const messages = toMessages(req);
    const maxRounds = req.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS;
    let usage: Usage = { inputTokens: 0, outputTokens: 0 };
    let model = req.model;

    for (let round = 0; ; round++) {
      const stream = await this.client.chat.completions.create(
        {
          model: req.model,
          messages,
          max_completion_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
          stream: true,
          stream_options: { include_usage: true },
          ...(apiTools.length ? { tools: apiTools } : {}),
          ...reasoningEffort(req.effort),
        },
        { signal: req.signal },
      );

      let text = "";
      let finishReason = "unknown";
      const calls: { id: string; name: string; args: string }[] = [];
      for await (const chunk of stream) {
        model = chunk.model || model;
        if (chunk.usage) {
          const u = usageOf(chunk.usage);
          usage = { inputTokens: usage.inputTokens + u.inputTokens, outputTokens: usage.outputTokens + u.outputTokens };
        }
        const choice = chunk.choices[0];
        if (!choice) continue;
        if (choice.delta.content) {
          text += choice.delta.content;
          yield { type: "text", delta: choice.delta.content };
        }
        for (const tc of choice.delta.tool_calls ?? []) {
          const slot = (calls[tc.index] ??= { id: "", name: "", args: "" });
          if (tc.id) slot.id = tc.id;
          if (tc.function?.name) slot.name += tc.function.name;
          if (tc.function?.arguments) slot.args += tc.function.arguments;
        }
        if (choice.finish_reason) finishReason = choice.finish_reason;
      }

      if (finishReason !== "tool_calls" || calls.length === 0) {
        yield { type: "done", usage, model, stopReason: finishReason };
        return;
      }
      if (round >= maxRounds) {
        yield { type: "done", usage, model, stopReason: "tool_round_limit" };
        return;
      }

      messages.push({
        role: "assistant",
        content: text || null,
        tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args } })),
      });
      for (const call of calls) {
        let input: unknown;
        try {
          input = JSON.parse(call.args || "{}");
        } catch {
          input = undefined;
        }
        yield { type: "tool_call", name: call.name, input };
        const { output, isError } =
          input === undefined
            ? { output: "Invalid JSON arguments.", isError: true }
            : await runTool(byName.get(call.name), input);
        yield { type: "tool_result", name: call.name, output, isError };
        messages.push({ role: "tool", tool_call_id: call.id, content: output });
      }
    }
  }

  async embed(texts: string[], model: string): Promise<{ vectors: number[][]; usage: Usage }> {
    const response = await this.client.embeddings.create({ model, input: texts });
    return {
      vectors: response.data.map((d) => d.embedding),
      usage: { inputTokens: response.usage.prompt_tokens, outputTokens: 0 },
    };
  }
}
