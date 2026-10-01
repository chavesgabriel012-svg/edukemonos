import { AIConfigError, type Effort, type ModelRole, type ProviderName } from "./types";

export interface ModelPrice {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
}

export interface AIConfig {
  provider: ProviderName;
  models: Record<ModelRole, string>;
  embedModel: string | null;
  effort: Partial<Record<ModelRole, Effort>>;
  /** Anthropic only: server-side refusal fallback mode ("default"), or null to disable. */
  anthropicFallbacks: "default" | null;
  /** Prices for cost estimates, keyed by model id. Unknown models log cost as null. */
  prices: Record<string, ModelPrice>;
}

const EFFORTS: readonly Effort[] = ["low", "medium", "high", "xhigh", "max"];

type Env = Record<string, string | undefined>;

function required(env: Env, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new AIConfigError(`Missing environment variable ${key}`);
  return value;
}

function effortFrom(env: Env, key: string): Effort | undefined {
  const value = env[key]?.trim();
  if (!value) return undefined;
  if (!EFFORTS.includes(value as Effort)) {
    throw new AIConfigError(`${key} must be one of ${EFFORTS.join(", ")}`);
  }
  return value as Effort;
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

  return {
    provider,
    models: {
      bulk: required(env, "MODEL_BULK"),
      tutor: required(env, "MODEL_TUTOR"),
      verify: required(env, "MODEL_VERIFY"),
    },
    embedModel: env.MODEL_EMBED?.trim() || null,
    effort: {
      bulk: effortFrom(env, "AI_EFFORT_BULK"),
      tutor: effortFrom(env, "AI_EFFORT_TUTOR"),
      verify: effortFrom(env, "AI_EFFORT_VERIFY"),
    },
    anthropicFallbacks: fallbacks === "default" ? "default" : null,
    prices,
  };
}

export function estimateCostUsd(
  prices: Record<string, ModelPrice>,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const price = prices[model];
  if (!price) return null;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
