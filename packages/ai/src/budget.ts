import type { AIBudget } from "./config";
import { AIBudgetExceededError } from "./types";

/** Costa Rica has no daylight saving time: always UTC-6. */
const CR_OFFSET_MS = -6 * 60 * 60 * 1000;

/** Start of the current calendar day in Costa Rica, as an absolute instant. */
export function startOfDayCR(now: Date): Date {
  const local = new Date(now.getTime() + CR_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - CR_OFFSET_MS);
}

/** Start of the current calendar month in Costa Rica, as an absolute instant. */
export function startOfMonthCR(now: Date): Date {
  const local = new Date(now.getTime() + CR_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - CR_OFFSET_MS);
}

export interface BudgetGuard {
  /** Throws AIBudgetExceededError when the daily or monthly fuse has tripped. */
  assertWithinBudget(): Promise<void>;
}

export interface SpendSource {
  /** Total estimated USD spent on AI since `since` (from `ai_usage`). */
  spentSince(since: Date): Promise<number>;
}

/**
 * Global spend fuse (Pulserival's `tope_gasto` idea, applied to a live app): before every AI
 * call, compare what was already spent today / this month with the limits. Concurrent calls can
 * overshoot by at most the cost of the calls in flight, so set the limits below the provider's
 * own spending limit.
 */
export function createBudgetGuard(
  budget: AIBudget,
  source: SpendSource,
  now: () => Date = () => new Date(),
): BudgetGuard {
  return {
    async assertWithinBudget() {
      const t = now();
      if (budget.dailyUsd != null) {
        const spent = await source.spentSince(startOfDayCR(t));
        if (spent >= budget.dailyUsd) throw new AIBudgetExceededError("day", spent, budget.dailyUsd);
      }
      if (budget.monthlyUsd != null) {
        const spent = await source.spentSince(startOfMonthCR(t));
        if (spent >= budget.monthlyUsd) throw new AIBudgetExceededError("month", spent, budget.monthlyUsd);
      }
    },
  };
}
