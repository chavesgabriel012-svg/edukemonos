import type { z } from "zod";
import { type AIConfig, estimateCostUsd, loadAIConfig } from "./config";
import { AnthropicAdapter } from "./providers/anthropic";
import { OpenAIAdapter } from "./providers/openai";
import {
  AIConfigError,
  type ChatEvent,
  type ChatMessage,
  type ModelRole,
  type ProviderAdapter,
  type Purpose,
  type StructuredResult,
  type TextResult,
  type ToolDefinition,
  type Usage,
  type UsageRecord,
  type UsageSink,
} from "./types";

export interface CallContext {
  role: ModelRole;
  purpose: Purpose;
  /** Anonymous student id or teacher id. Never a name. */
  actorId?: string | null;
  sectionId?: string | null;
}

export interface CallInput {
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface CreateAIOptions {
  config?: AIConfig;
  /** Override the adapter (tests, or a future provider). */
  adapter?: ProviderAdapter;
  /** Where usage rows go (the web app writes them to `ai_usage`). */
  sink?: UsageSink;
  env?: Record<string, string | undefined>;
}

export function createAdapter(config: AIConfig, env: Record<string, string | undefined> = process.env): ProviderAdapter {
  if (config.provider === "anthropic") {
    return new AnthropicAdapter({ apiKey: env.ANTHROPIC_API_KEY, fallbacks: config.anthropicFallbacks });
  }
  return new OpenAIAdapter({ apiKey: env.OPENAI_API_KEY });
}

export function createAI(options: CreateAIOptions = {}) {
  const config = options.config ?? loadAIConfig(options.env);
  const adapter = options.adapter ?? createAdapter(config, options.env);
  const sink = options.sink;

  async function log(ctx: CallContext, model: string, started: number, usage: Usage | null, error: unknown) {
    if (!sink) return;
    const record: UsageRecord = {
      provider: adapter.name,
      model,
      purpose: ctx.purpose,
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
      costUsdEstimate: usage ? estimateCostUsd(config.prices, model, usage.inputTokens, usage.outputTokens) : null,
      latencyMs: Math.round(performance.now() - started),
      success: error == null,
      error: error == null ? null : String((error as Error).message ?? error).slice(0, 500),
      actorId: ctx.actorId ?? null,
      sectionId: ctx.sectionId ?? null,
    };
    try {
      await sink(record);
    } catch (sinkError) {
      // Usage logging must never break a student's request.
      console.error("ai_usage sink failed", sinkError);
    }
  }

  function request(ctx: CallContext, input: CallInput) {
    return {
      model: config.models[ctx.role],
      effort: config.effort[ctx.role],
      system: input.system,
      messages: input.messages,
      maxTokens: input.maxTokens,
      signal: input.signal,
    };
  }

  return {
    config,
    provider: adapter.name,

    async generateText(ctx: CallContext, input: CallInput): Promise<TextResult> {
      const started = performance.now();
      const req = request(ctx, input);
      try {
        const result = await adapter.generateText(req);
        await log(ctx, result.model, started, result.usage, null);
        return result;
      } catch (error) {
        await log(ctx, req.model, started, null, error);
        throw error;
      }
    },

    async generateStructured<Schema extends z.ZodType>(
      ctx: CallContext,
      input: CallInput & { schema: Schema; schemaName: string },
    ): Promise<StructuredResult<z.infer<Schema>>> {
      const started = performance.now();
      const req = { ...request(ctx, input), schema: input.schema, schemaName: input.schemaName };
      try {
        const result = await adapter.generateStructured(req);
        await log(ctx, result.model, started, result.usage, null);
        return result;
      } catch (error) {
        await log(ctx, req.model, started, null, error);
        throw error;
      }
    },

    async *streamChat(
      ctx: CallContext,
      input: CallInput & { tools?: ToolDefinition[]; maxToolRounds?: number },
    ): AsyncIterable<ChatEvent> {
      const started = performance.now();
      const req = { ...request(ctx, input), tools: input.tools, maxToolRounds: input.maxToolRounds };
      try {
        for await (const event of adapter.streamChat(req)) {
          if (event.type === "done") await log(ctx, event.model, started, event.usage, null);
          yield event;
        }
      } catch (error) {
        await log(ctx, req.model, started, null, error);
        throw error;
      }
    },

    async embed(ctx: Omit<CallContext, "role">, texts: string[]): Promise<number[][]> {
      if (!adapter.embed || !config.embedModel) {
        throw new AIConfigError(`Embeddings are not available for provider "${adapter.name}" or MODEL_EMBED is unset`);
      }
      const started = performance.now();
      const fullCtx = { ...ctx, role: "bulk" as const };
      try {
        const { vectors, usage } = await adapter.embed(texts, config.embedModel);
        await log(fullCtx, config.embedModel, started, usage, null);
        return vectors;
      } catch (error) {
        await log(fullCtx, config.embedModel, started, null, error);
        throw error;
      }
    },
  };
}

export type AI = ReturnType<typeof createAI>;
