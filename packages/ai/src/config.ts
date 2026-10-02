import { AIConfigError, type Effort, type ModelRole, type ProviderName } from "./types";

export interface ModelPrice {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
}

export interface AIBudget {
  /** USD per calendar day (Costa Rica time). null = no daily fuse. */
  dailyUsd: number | null;
  /** USD per calendar month (Costa Rica time). null = no monthly fuse. */
  monthlyUsd: number | null;
}

export interface AIConfig {
  provider: ProviderName;
  /** Ordered model chain per role: the first that answers wins (Pulserival pattern). */
  models: Record<ModelRole, string[]>;
  embedModel: string | null;
  effort: Partial<Record<ModelRole, Effort>>;
  /** Anthropic only: server-side refusal fallback mode ("default"), or null to disable. */
  anthropicFallbacks: "default" | null;
  /** Prices for cost estimates, keyed by model id. */
  prices: Record<string, ModelPrice>;
  budget: AIBudget;
}

const EFFORTS: readonly Effort[] = ["low", "medium", "high", "xhigh", "max"];
const ROLES: readonly ModelRole[] = ["bulk", "tutor", "verify"];

type Env = Record<string, string | undefined>;

function required(env: Env, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new AIConfigError(`Missing environment variable ${key}`);
  return value;
}

/** "a, b" -> ["a", "b"]. Order matters: it is the fallback order. */
function modelChain(env: Env, key: string): string[] {
  const chain = required(env, key)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (new Set(chain).size !== chain.length) throw new AIConfigError(`${key} lists a model twice`);
  return chain;
}

function effortFrom(env: Env, key: string): Effort | undefined {
  const value = env[key]?.trim();
  if (!value) return undefined;
  if (!EFFORTS.includes(value as Effort)) {
    throw new AIConfigError(`${key} must be one of ${EFFORTS.join(", ")}`);
  }
  return value as Effort;
}

function usdFrom(env: Env, key: string): number | null {
  const value = env[key]?.trim();
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new AIConfigError(`${key} must be a positive number of USD`);
  return n;
}

/**
 * Reads the AI configuration from environment variables. Model identifiers are never
 * hard-coded: set them from the providers' current documentation (see .env.example).
 */
export function loadAIConfig(env: Env = process.env): AIConfig {
  const provider = required(env, "AI_PROVIDER");
  if (provider !== "anthropic" && provider !== "openai") {
    throw new AIConfigError(`AI_PROVIDER must be "anthropic" or "openai", got "${provider}"`);
  }

  let prices: Record<string, ModelPrice> = {};
  if (env.AI_PRICES_JSON?.trim()) {
    try {
      prices = JSON.parse(env.AI_PRICES_JSON) as Record<string, ModelPrice>;
    } catch {
      throw new AIConfigError("AI_PRICES_JSON is not valid JSON");
    }
  }

  const fallbacks = env.ANTHROPIC_FALLBACKS?.trim();
  if (fallbacks && fallbacks !== "default" && fallbacks !== "off") {
    throw new AIConfigError(`ANTHROPIC_FALLBACKS must be "default" or "off"`);
  }

  const config: AIConfig = {
    provider,
    models: {
      bulk: modelChain(env, "MODEL_BULK"),
      tutor: modelChain(env, "MODEL_TUTOR"),
      verify: modelChain(env, "MODEL_VERIFY"),
    },
    embedModel: env.MODEL_EMBED?.trim() || null,
    effort: {
      bulk: effortFrom(env, "AI_EFFORT_BULK"),
      tutor: effortFrom(env, "AI_EFFORT_TUTOR"),
      verify: effortFrom(env, "AI_EFFORT_VERIFY"),
    },
    anthropicFallbacks: fallbacks === "default" ? "default" : null,
    prices,
    budget: {
      dailyUsd: usdFrom(env, "AI_BUDGET_DAILY_USD"),
      monthlyUsd: usdFrom(env, "AI_BUDGET_MONTHLY_USD"),
    },
  };
  assertPricesCoverModels(config);
  return config;
}

/**
 * With a spend fuse configured, every model must have a price. A model without one would be
 * logged at $0 and the fuse would never trip (lesson learned in Pulserival).
 */
export function assertPricesCoverModels(config: AIConfig): void {
  if (config.budget.dailyUsd == null && config.budget.monthlyUsd == null) return;
  const models = new Set(ROLES.flatMap((r) => config.models[r]));
  if (config.embedModel) models.add(config.embedModel);
  const missing = [...models].filter((m) => !config.prices[m]);
  if (missing.length) {
    throw new AIConfigError(
      `AI_PRICES_JSON has no price for ${missing.join(", ")}; the spend fuse would be blind to them`,
    );
  }
}

/** Anthropic's prompt-cache multipliers on the input price (reads 0.1×, 5-minute writes 1.25×). */
export const CACHE_READ_FACTOR = 0.1;
export const CACHE_WRITE_FACTOR = 1.25;

export function estimateCostUsd(
  prices: Record<string, ModelPrice>,
  model: string,
  inputTokens: number,
  outputTokens: number,
  cache: { readTokens?: number; writeTokens?: number } = {},
): number | null {
  const price = prices[model];
  if (!price) return null;
  const read = cache.readTokens ?? 0;
  const write = cache.writeTokens ?? 0;
  const uncached = Math.max(0, inputTokens - read - write);
  const input = uncached + read * CACHE_READ_FACTOR + write * CACHE_WRITE_FACTOR;
  return (input * price.input + outputTokens * price.output) / 1_000_000;
}
