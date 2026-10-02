import type { z } from "zod";
import type { BudgetGuard } from "./budget";
import { type AIConfig, estimateCostUsd, loadAIConfig } from "./config";
import { AnthropicAdapter } from "./providers/anthropic";
import { OpenAIAdapter } from "./providers/openai";
import {
  AIBudgetExceededError,
  AIConfigError,
  AIRefusalError,
  AIUnavailableError,
  type ChatEvent,
  type ChatMessage,
  type Effort,
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
  /** Overrides the role's configured effort for this call (e.g. a verifier that must reason hard). */
  effort?: Effort;
  signal?: AbortSignal;
}

export interface CreateAIOptions {
  config?: AIConfig;
  /** Override the adapter (tests, or a future provider). */
  adapter?: ProviderAdapter;
  /** Where usage rows go (the web app writes them to `ai_usage`). */
  sink?: UsageSink;
  /**
   * Spend fuse. Required when AI_BUDGET_* limits are set; pass `null` only to disable it on
   * purpose (e.g. a local script with no database).
   */
  budget?: BudgetGuard | null;
  env?: Record<string, string | undefined>;
}

export interface DiagnosticRow {
  role: ModelRole;
  model: string;
  position: number;
  status: "ok" | "error" | "no_price";
  detail: string;
}

export function createAdapter(config: AIConfig, env: Record<string, string | undefined> = process.env): ProviderAdapter {
  if (config.provider === "anthropic") {
    // Claude Code cloud sessions strip ANTHROPIC_API_KEY from the environment (it is reserved for
    // the agent's own auth), so scripts run there read the key from EDUKEMONOS_ANTHROPIC_API_KEY.
    const apiKey = env.ANTHROPIC_API_KEY || env.EDUKEMONOS_ANTHROPIC_API_KEY;
    return new AnthropicAdapter({ apiKey, fallbacks: config.anthropicFallbacks });
  }
  return new OpenAIAdapter({ apiKey: env.OPENAI_API_KEY });
}

/**
 * Errors that must NOT move on to the next model: a refusal is respected (another model must not
 * be used to get around it), a tripped fuse stops spending, bad config and cancellations are final.
 */
function isFinal(error: unknown, signal?: AbortSignal): boolean {
  return (
    error instanceof AIRefusalError ||
    error instanceof AIBudgetExceededError ||
    error instanceof AIConfigError ||
    signal?.aborted === true ||
    (error as Error)?.name === "AbortError"
  );
}

const errorText = (error: unknown) => String((error as Error)?.message ?? error).slice(0, 500);

export function createAI(options: CreateAIOptions = {}) {
  const config = options.config ?? loadAIConfig(options.env);
  const adapter = options.adapter ?? createAdapter(config, options.env);
  const sink = options.sink;
  const hasLimits = config.budget.dailyUsd != null || config.budget.monthlyUsd != null;
  if (hasLimits && options.budget === undefined) {
    throw new AIConfigError(
      "AI_BUDGET_* limits are set but no spend source was given; pass `budget` (or null to disable on purpose)",
    );
  }
  const budget = options.budget ?? null;

  /**
   * `model` is what the provider says served the call (e.g. "claude-haiku-4-5-20251001"), which may
   * not be a key of AI_PRICES_JSON; `requested` is the configured id, priced by config validation.
   * Pricing falls back to it so a dated id never logs a null cost the spending fuse can't see.
   */
  async function log(ctx: CallContext, model: string, started: number, usage: Usage | null, error: unknown, requested = model) {
    if (!sink) return;
    const record: UsageRecord = {
      provider: adapter.name,
      model,
      purpose: ctx.purpose,
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
      costUsdEstimate: usage
        ? (estimateCostUsd(config.prices, model, usage.inputTokens, usage.outputTokens) ??
          estimateCostUsd(config.prices, requested, usage.inputTokens, usage.outputTokens))
        : null,
      latencyMs: Math.round(performance.now() - started),
      success: error == null,
      error: error == null ? null : errorText(error),
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

  function request(ctx: CallContext, input: CallInput, model: string) {
    return {
      model,
      effort: input.effort ?? config.effort[ctx.role],
      system: input.system,
      messages: input.messages,
      maxTokens: input.maxTokens,
      signal: input.signal,
    };
  }

  /**
   * Tries each model of the role's chain in order. Every failed attempt is logged (not only the
   * final failure), so "why did the tutor go quiet?" always has an answer in `ai_usage`.
   */
  async function withFallback<T extends { model: string; usage: Usage }>(
    ctx: CallContext,
    signal: AbortSignal | undefined,
    call: (model: string) => Promise<T>,
  ): Promise<T> {
    const attempts: { model: string; error: string }[] = [];
    for (const model of config.models[ctx.role]) {
      if (budget) await budget.assertWithinBudget();
      const started = performance.now();
      try {
        const result = await call(model);
        await log(ctx, result.model, started, result.usage, null, model);
        return result;
      } catch (error) {
        await log(ctx, model, started, null, error);
        if (isFinal(error, signal)) throw error;
        attempts.push({ model, error: errorText(error) });
      }
    }
    throw new AIUnavailableError(attempts);
  }

  return {
    config,
    provider: adapter.name,

    generateText(ctx: CallContext, input: CallInput): Promise<TextResult> {
      return withFallback(ctx, input.signal, (model) => adapter.generateText(request(ctx, input, model)));
    },

    generateStructured<Schema extends z.ZodType>(
      ctx: CallContext,
      input: CallInput & { schema: Schema; schemaName: string },
    ): Promise<StructuredResult<z.infer<Schema>>> {
      return withFallback(ctx, input.signal, (model) =>
        adapter.generateStructured({ ...request(ctx, input, model), schema: input.schema, schemaName: input.schemaName }),
      );
    },

    /**
     * Streams a tutor turn. Falls back to the next model only if the failure happens before
     * anything reached the student; a mid-stream failure is rethrown (re-asking would repeat text).
     */
    async *streamChat(
      ctx: CallContext,
      input: CallInput & { tools?: ToolDefinition[]; maxToolRounds?: number },
    ): AsyncIterable<ChatEvent> {
      const attempts: { model: string; error: string }[] = [];
      for (const model of config.models[ctx.role]) {
        if (budget) await budget.assertWithinBudget();
        const started = performance.now();
        let emitted = false;
        try {
          const req = { ...request(ctx, input, model), tools: input.tools, maxToolRounds: input.maxToolRounds };
          for await (const event of adapter.streamChat(req)) {
            if (event.type === "done") await log(ctx, event.model, started, event.usage, null, model);
            emitted = true;
            yield event;
          }
          return;
        } catch (error) {
          await log(ctx, model, started, null, error);
          if (emitted || isFinal(error, input.signal)) throw error;
          attempts.push({ model, error: errorText(error) });
        }
      }
      throw new AIUnavailableError(attempts);
    },

    async embed(ctx: Omit<CallContext, "role">, texts: string[]): Promise<number[][]> {
      if (!adapter.embed || !config.embedModel) {
        throw new AIConfigError(`Embeddings are not available for provider "${adapter.name}" or MODEL_EMBED is unset`);
      }
      if (budget) await budget.assertWithinBudget();
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

    /**
     * Calls every configured model once with a tiny request (Pulserival's `diagnostico`).
     * A truncated answer counts as OK: the model did respond. Cost is a few tokens per model.
     */
    async diagnose(): Promise<DiagnosticRow[]> {
      const rows: DiagnosticRow[] = [];
      for (const role of ["tutor", "bulk", "verify"] as const) {
        const chain = config.models[role];
        for (const [i, model] of chain.entries()) {
          const base = { role, model, position: i + 1 };
          if (!config.prices[model]) {
            rows.push({ ...base, status: "no_price", detail: "sin precio en AI_PRICES_JSON: el costo se registraría vacío" });
          }
          const started = performance.now();
          try {
            const r = await adapter.generateText({
              model,
              messages: [{ role: "user", content: "Responde solo: ok" }],
              maxTokens: 64,
            });
            await log({ role, purpose: "diagnostic" }, r.model, started, r.usage, null, model);
            rows.push({ ...base, status: "ok", detail: `respondió (${r.usage.outputTokens} tokens de salida)` });
          } catch (error) {
            await log({ role, purpose: "diagnostic" }, model, started, null, error);
            rows.push({ ...base, status: "error", detail: errorText(error) });
          }
        }
      }
      return rows;
    },
  };
}

export type AI = ReturnType<typeof createAI>;
