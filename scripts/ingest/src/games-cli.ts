/**
 * Mini-game content for published units (fase 3, docs/producto/gamificacion.md §6).
 *
 *   pnpm games generate [--subject espanol|matematicas] [--grade 7|8|9] [--unit <id>] [--limit N] [--yes]
 *   pnpm games load     [same filters]   (cached results → draft items of kind game_*)
 *   pnpm games publish  [same filters]   (only what passed every check)
 *   pnpm games status   [same filters]   (re-runs the fixed checks, free)
 *   pnpm games archive  [same filters]   (re-verified copy to scripts/ingest/generated/games, versioned)
 *
 * Without filters: every published unit of Español and Matemáticas (7.º a 9.º).
 * `generate` spends money: without --yes it only prints an estimate. Units already in the cache are
 * skipped, and each AI step is cached as soon as it returns. If the spend fuse trips, the run stops
 * and everything generated so far is kept.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { AIBudgetExceededError, estimateCostUsd, loadAIConfig } from "@edukemonos/ai";
import { gameTarget } from "@edukemonos/curriculum";
import { scriptAI } from "./ai";
import { type ContentUnit, publishedUnits, unitBlock } from "./content";
import { dbFromEnv } from "./db";
import { archiveUnitGames, generateUnitGames, loadUnitGames, publishVerifiedGames, readUnitGames, reverifyGames, saveUnitGames } from "./games";

const envFile = join(import.meta.dirname, "../../../apps/web/.env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    subject: { type: "string" },
    grade: { type: "string" },
    unit: { type: "string" },
    limit: { type: "string" },
    concurrency: { type: "string" },
    yes: { type: "boolean", default: false },
  },
});

function requireDb() {
  const db = dbFromEnv();
  if (!db) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-side only)");
  return db;
}

async function selectUnits(): Promise<ContentUnit[]> {
  const db = requireDb();
  const subjects = values.subject ? [values.subject] : ["espanol", "matematicas"];
  const grades = values.grade ? [Number(values.grade)] : [7, 8, 9];
  let units: ContentUnit[] = [];
  for (const s of subjects) for (const g of grades) units.push(...(await publishedUnits(db, s, g)));
  if (values.unit) units = units.filter((u) => u.id === values.unit);
  if (values.limit) units = units.slice(0, Number(values.limit));
  return units;
}

/**
 * Pre-flight estimate per unit. ASSUMPTIONS until measured: ~3.5 characters per token, ~1,100
 * tokens of instructions, ~170 visible tokens per piece and ~120 per piece shown to the solver,
 * visible output × 1.6 for thinking, and ~250 tokens of solver reasoning per piece.
 */
function estimateUnitGames(u: ContentUnit) {
  const n = gameTarget(u.skills.length);
  const block = Math.round(unitBlock(u).length / 3.5);
  return { genIn: 1_100 + block, genOut: Math.round(n * 170 * 1.6), solveIn: 500 + n * 120, solveOut: n * (40 + 250) };
}

async function generate() {
  const units = await selectUnits();
  const pending = units.filter((u) => !readUnitGames(u.id));
  const config = loadAIConfig();
  const zero = { genIn: 0, genOut: 0, solveIn: 0, solveOut: 0 };
  const t = pending.map(estimateUnitGames).reduce(
    (a, b) => ({ genIn: a.genIn + b.genIn, genOut: a.genOut + b.genOut, solveIn: a.solveIn + b.solveIn, solveOut: a.solveOut + b.solveOut }),
    zero,
  );
  const usd =
    (estimateCostUsd(config.prices, config.models.bulk[0], t.genIn, t.genOut) ?? 0) +
    (estimateCostUsd(config.prices, config.models.verify[0], t.solveIn, t.solveOut) ?? 0);
  const pieces = pending.reduce((a, u) => a + gameTarget(u.skills.length), 0);
  console.log(
    `${units.length} unidades publicadas; ${units.length - pending.length} ya generadas, ${pending.length} por generar ` +
      `(${pending.length * 2} llamadas, hasta ${pieces} piezas). Generación con ${config.models.bulk[0]}, verificación con ${config.models.verify[0]}.\n` +
      `Estimado: ~${(t.genIn + t.solveIn).toLocaleString()} tokens de entrada y ~${(t.genOut + t.solveOut).toLocaleString()} de salida ≈ US$${usd.toFixed(2)}.`,
  );
  if (!values.yes) {
    console.log("No se llamó a la IA. Repite con --yes para ejecutar.");
    return;
  }
  const ai = scriptAI(requireDb());
  // A few units at a time; each unit's two calls stay in order. The spend fuse is checked before
  // every call, so a concurrent run overshoots it by at most the calls already in flight.
  const workers = Math.max(1, Math.min(8, Number(values.concurrency ?? 4)));
  let next = 0;
  let stopped = false;
  const work = async () => {
    while (!stopped && next < pending.length) {
      const k = next++;
      const u = pending[k];
      const label = `[${k + 1}/${pending.length}] ${u.subject_id} ${u.grade_id}.º · ${u.title}`;
      try {
        const g = await generateUnitGames(ai, u);
        saveUnitGames(g);
        const ok = g.pieces.filter((p) => p.verification.verified).length;
        console.log(`✓ ${label}: ${ok}/${g.pieces.length} piezas verificadas`);
      } catch (error) {
        if (error instanceof AIBudgetExceededError) {
          if (!stopped) console.log(`Se alcanzó el fusible de gasto (${error.message}). Lo generado hasta aquí quedó guardado.`);
          stopped = true;
          return;
        }
        console.log(`✗ ${label}: ${(error as Error).message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: workers }, work));
}

async function load() {
  const db = requireDb();
  for (const u of await selectUnits()) {
    const g = readUnitGames(u.id);
    if (!g) continue;
    const s = await loadUnitGames(db, u, g);
    console.log(s.skipped ? `${u.title}: ya tenía piezas de juego; no se tocó.` : `${u.title}: ${s.pieces} piezas (${s.verified} verificadas).`);
  }
}

async function publish() {
  const n = await publishVerifiedGames(requireDb(), (await selectUnits()).map((u) => u.id));
  console.log(`Publicadas ${n} piezas verificadas como "Generado con IA · pendiente de revisión". Lo que no pasó las verificaciones sigue en borrador.`);
}

async function status() {
  const units = await selectUnits();
  const cached = units.flatMap((u) => {
    const g = readUnitGames(u.id);
    return g ? [reverifyGames(u, g)] : [];
  });
  const pieces = cached.flatMap((g) => g.pieces);
  const byMechanic = new Map<string, [number, number]>();
  for (const p of pieces) {
    const [ok, all] = byMechanic.get(p.game.mechanic) ?? [0, 0];
    byMechanic.set(p.game.mechanic, [ok + (p.verification.verified ? 1 : 0), all + 1]);
  }
  console.log(`${units.length} unidades · en caché: ${cached.length} · piezas verificadas: ${pieces.filter((p) => p.verification.verified).length}/${pieces.length}`);
  for (const [m, [ok, all]] of byMechanic) console.log(`  ${m}: ${ok}/${all}`);
  const reasons = new Map<string, number>();
  for (const p of pieces) {
    for (const r of p.verification.reasons) {
      const key = r.replace(/: .*/, "");
      reasons.set(key, (reasons.get(key) ?? 0) + 1);
    }
  }
  if (reasons.size) console.log(`Motivos de lo no verificado: ${[...reasons].map(([r, n]) => `${r} (${n})`).join(", ")}`);
}

async function main() {
  switch (positionals[0]) {
    case "generate":
      return generate();
    case "load":
      return load();
    case "publish":
      return publish();
    case "status":
      return status();
    case "archive": {
      const n = (await selectUnits()).filter((u) => archiveUnitGames(u)).length;
      return console.log(`${n} unidades copiadas a scripts/ingest/generated/games.`);
    }
    default:
      console.log("Comandos: generate | load | publish | status | archive (ver encabezado de src/games-cli.ts)");
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Error: ${(error as Error).message}`);
  process.exitCode = 1;
});
