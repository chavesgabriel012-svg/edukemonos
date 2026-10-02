import { type AI, createAI, createBudgetGuard, loadAIConfig, supabaseRest, supabaseSpendSource, supabaseUsageSink } from "@edukemonos/ai";
import type { Db } from "./db";

/** AI client for the scripts: usage goes to ai_usage and the spend fuse reads it back. */
export function scriptAI(db: Db | null): AI {
  const config = loadAIConfig();
  const hasFuse = config.budget.dailyUsd != null || config.budget.monthlyUsd != null;
  if (hasFuse && !db) throw new Error("The spend fuse is configured but Supabase is not: refusing to spend blind.");
  const rest = db ? supabaseRest(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) : null;
  return createAI({
    config,
    sink: rest ? supabaseUsageSink(rest) : undefined,
    budget: rest ? createBudgetGuard(config.budget, supabaseSpendSource(rest)) : null,
  });
}
