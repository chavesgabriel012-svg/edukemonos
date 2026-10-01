import { describe, expect, it } from "vitest";
import { estimateCostUsd, loadAIConfig } from "../src/config";
import { AIConfigError } from "../src/types";

const base = { AI_PROVIDER: "anthropic", MODEL_BULK: "m-bulk", MODEL_TUTOR: "m-tutor", MODEL_VERIFY: "m-verify" };

describe("loadAIConfig", () => {
  it("reads models only from env", () => {
    const c = loadAIConfig(base);
    expect(c.models).toEqual({ bulk: ["m-bulk"], tutor: ["m-tutor"], verify: ["m-verify"] });
    expect(c.anthropicFallbacks).toBeNull();
  });

  it("fails loudly when a model or provider is missing", () => {
    expect(() => loadAIConfig({ ...base, MODEL_TUTOR: "" })).toThrow(AIConfigError);
    expect(() => loadAIConfig({ ...base, AI_PROVIDER: "other" })).toThrow(/AI_PROVIDER/);
  });

  it("validates effort and fallback settings", () => {
    expect(loadAIConfig({ ...base, AI_EFFORT_TUTOR: "low" }).effort.tutor).toBe("low");
    expect(() => loadAIConfig({ ...base, AI_EFFORT_TUTOR: "turbo" })).toThrow(/AI_EFFORT_TUTOR/);
    expect(loadAIConfig({ ...base, ANTHROPIC_FALLBACKS: "default" }).anthropicFallbacks).toBe("default");
  });
});

describe("estimateCostUsd", () => {
  it("uses configured prices and returns null for unknown models", () => {
    const prices = { a: { input: 2, output: 10 } };
    expect(estimateCostUsd(prices, "a", 1_000_000, 100_000)).toBeCloseTo(3);
    expect(estimateCostUsd(prices, "b", 10, 10)).toBeNull();
  });
});
