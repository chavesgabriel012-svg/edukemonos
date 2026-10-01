import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  AIOutputError,
  AIRefusalError,
  type BaseRequest,
  type ChatEvent,
  type ChatRequest,
  type ProviderAdapter,
  type StructuredRequest,
  type StructuredResult,
  type TextResult,
  type Usage,
} from "../types";
import { runTool } from "../tools";

type BetaMessage = Anthropic.Beta.BetaMessage;
type BetaMessageParam = Anthropic.Beta.BetaMessageParam;

const DEFAULT_MAX_TOKENS = 16_000;
const DEFAULT_MAX_TOOL_ROUNDS = 4;
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export interface AnthropicAdapterOptions {
  apiKey?: string;
  /** Opt-in server-side refusal fallback (`fallbacks: "default"`). */
  fallbacks?: "default" | null;
  /** Injectable for tests. */
  client?: Anthropic;
}

/** Zod → JSON Schema for `input_schema`. Anthropic does not accept the `$schema` key. */
export function toolInputSchema(schema: z.ZodType): Anthropic.Beta.BetaTool["input_schema"] {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest as Anthropic.Beta.BetaTool["input_schema"];
}

function usageOf(message: BetaMessage): Usage {
  return {
    inputTokens:
      message.usage.input_tokens +
      (message.usage.cache_read_input_tokens ?? 0) +
      (message.usage.cache_creation_input_tokens ?? 0),
    outputTokens: message.usage.output_tokens,
  };
}

function addUsage(a: Usage, b: Usage): Usage {
  return { inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens };
}

function textOf(message: BetaMessage): string {
  return message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function assertNotRefused(message: BetaMessage): void {
  if (message.stop_reason === "refusal") {
    const category = message.stop_details?.category ?? null;
    throw new AIRefusalError(`The model declined this request${category ? ` (${category})` : ""}.`, category);
  }
}

export class AnthropicAdapter implements ProviderAdapter {
  readonly name = "anthropic" as const;
  private readonly client: Anthropic;
  private readonly fallbacks: "default" | null;

  constructor(options: AnthropicAdapterOptions = {}) {
    this.client = options.client ?? new Anthropic({ apiKey: options.apiKey });
    this.fallbacks = options.fallbacks ?? null;
  }

  /** Request fields shared by every call. Thinking is left at the model's default. */
  private common(req: BaseRequest) {
    return {
      model: req.model,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(req.system ? { system: req.system } : {}),
      ...(this.fallbacks ? { betas: [FALLBACK_BETA], fallbacks: this.fallbacks } : {}),
    };
  }

  async generateText(req: BaseRequest): Promise<TextResult> {
    const message = await this.client.beta.messages.create(
      {
        ...this.common(req),
        messages: req.messages,
        ...(req.effort ? { output_config: { effort: req.effort } } : {}),
      },
      { signal: req.signal },
    );
    assertNotRefused(message);
    return { text: textOf(message), usage: usageOf(message), model: message.model };
  }

  async generateStructured<Schema extends z.ZodType>(
    req: StructuredRequest<Schema>,
  ): Promise<StructuredResult<z.infer<Schema>>> {
    const message = await this.client.beta.messages.parse(
      {
        ...this.common(req),
        messages: req.messages,
        output_config: {
          format: betaZodOutputFormat(req.schema),
          ...(req.effort ? { effort: req.effort } : {}),
        },
      },
      { signal: req.signal },
    );
    assertNotRefused(message);
    if (message.parsed_output == null) {
      throw new AIOutputError(`Output did not match schema "${req.schemaName}" (stop: ${message.stop_reason})`);
    }
    return { data: message.parsed_output as z.infer<Schema>, usage: usageOf(message), model: message.model };
  }

  async *streamChat(req: ChatRequest): AsyncIterable<ChatEvent> {
    const tools = req.tools ?? [];
    const byName = new Map(tools.map((t) => [t.name, t]));
    const apiTools: Anthropic.Beta.BetaTool[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: toolInputSchema(t.schema),
      // eager_input_streaming stays off on purpose: tool inputs here are tiny (an expression),
      // and a server-validated input avoids re-issuing a turn whose text already reached the student.
    }));
    const messages: BetaMessageParam[] = req.messages.map((m) => ({ role: m.role, content: m.content }));
    const maxRounds = req.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS;
    let usage: Usage = { inputTokens: 0, outputTokens: 0 };
    let model = req.model;

    for (let round = 0; ; round++) {
      const stream = this.client.beta.messages.stream(
        {
          ...this.common(req),
          messages,
          ...(apiTools.length ? { tools: apiTools } : {}),
          ...(req.effort ? { output_config: { effort: req.effort } } : {}),
        },
        { signal: req.signal },
      );

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "text", delta: event.delta.text };
        }
      }
      const message = await stream.finalMessage();
      usage = addUsage(usage, usageOf(message));
      model = message.model;

      const toolUses = message.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
      );
      // Never run tools from a refused or truncated turn.
      if (
        message.stop_reason !== "tool_use" ||
        toolUses.length === 0
      ) {
        yield { type: "done", usage, model, stopReason: message.stop_reason ?? "unknown" };
        return;
      }
      if (round >= maxRounds) {
        yield { type: "done", usage, model, stopReason: "tool_round_limit" };
        return;
      }

      messages.push({ role: "assistant", content: message.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const call of toolUses) {
        yield { type: "tool_call", name: call.name, input: call.input };
        const { output, isError } = await runTool(byName.get(call.name), call.input);
        yield { type: "tool_result", name: call.name, output, isError };
        results.push({ type: "tool_result", tool_use_id: call.id, content: output, is_error: isError });
      }
      // All results go back in a single user message.
      messages.push({ role: "user", content: results });
    }
  }
}
