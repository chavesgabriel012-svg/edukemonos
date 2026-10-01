/**
 * pnpm ai:diagnose
 *
 * Checks the AI setup before spending a real run on it (Pulserival's `cli diagnostico`):
 *  - the configuration loads (models, prices for every model when a fuse is set),
 *  - every model of every chain answers a tiny request (a few tokens each),
 *  - and, if Supabase variables are present, today's and this month's spend vs. the fuse.
 *
 * Reads variables from the environment, or from apps/web/.env.local when it exists.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { startOfDayCR, startOfMonthCR } from "../budget";
import { createAI } from "../client";
import { loadAIConfig } from "../config";
import { supabaseRest } from "../supabase-rest";
import { supabaseSpendSource, supabaseUsageSink } from "../supabase-store";

const envFile = join(import.meta.dirname, "../../../../apps/web/.env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const config = loadAIConfig();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = url && key ? supabaseRest(url, key) : null;

console.log(`Proveedor: ${config.provider}`);
for (const role of ["tutor", "bulk", "verify"] as const) {
  console.log(`  ${role.padEnd(7)} ${config.models[role].join(" → ")}`);
}
const { dailyUsd, monthlyUsd } = config.budget;
console.log(`Fusible: diario ${dailyUsd ?? "sin tope"} USD · mensual ${monthlyUsd ?? "sin tope"} USD`);

if (db) {
  const spend = supabaseSpendSource(db);
  const now = new Date();
  const [day, month] = await Promise.all([spend.spentSince(startOfDayCR(now)), spend.spentSince(startOfMonthCR(now))]);
  console.log(`Gasto estimado: hoy $${day.toFixed(4)} · este mes $${month.toFixed(4)}`);
} else {
  console.log("Gasto: sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, no se puede leer ai_usage.");
}

// The probe itself costs a few tokens per model; it is logged to ai_usage when Supabase is set.
const ai = createAI({ config, sink: db ? supabaseUsageSink(db) : undefined, budget: null });
console.log("\nProbando cada modelo con una llamada mínima…");
const rows = await ai.diagnose();
for (const r of rows) {
  const mark = r.status === "ok" ? "OK " : r.status === "no_price" ? "!! " : "ERR";
  console.log(`${mark} ${r.role.padEnd(7)} #${r.position} ${r.model}: ${r.detail}`);
}
if (rows.some((r) => r.status !== "ok")) process.exitCode = 1;
