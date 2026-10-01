/**
 * Curriculum ingest CLI.
 *
 *   pnpm ingest download  --source mep-prog-matematicas [--force]
 *   pnpm ingest extract   --source mep-prog-matematicas
 *   pnpm ingest structure --source mep-prog-matematicas --grade 7 [--yes]
 *   pnpm ingest load      --source mep-prog-matematicas --grade 7 [--alongside-reviewed]
 *   pnpm ingest coverage  --source mep-prog-matematicas --grade 7
 *   pnpm ingest run       --source mep-prog-matematicas --grade 7 --yes   (all of the above)
 *   pnpm ingest db-check
 *
 * Reads variables from the environment, or from apps/web/.env.local when it exists.
 * `structure` spends money: it prints an estimate and only calls the AI with --yes.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { estimateCostUsd, loadAIConfig } from "@edukemonos/ai";
import { chunksForGrade, manifestSchema, pagesForGrade, type SourceEntry } from "@edukemonos/curriculum";
import { scriptAI } from "./ai";
import { pageCoverage } from "./coverage";
import { dbFromEnv } from "./db";
import { downloadSource } from "./download";
import { extractPages, pageMap } from "./extract";
import { loadExtraction, readExtraction, upsertPages, upsertSource } from "./load";
import { formatPages, structureGrade } from "./structure";

const envFile = join(import.meta.dirname, "../../../apps/web/.env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    source: { type: "string" },
    grade: { type: "string" },
    force: { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
    "alongside-reviewed": { type: "boolean", default: false },
  },
});
const command = positionals[0];

const manifest = manifestSchema.parse(JSON.parse(readFileSync(join(import.meta.dirname, "..", "sources.json"), "utf8")));

function source(): SourceEntry {
  const entry = manifest.sources.find((s) => s.id === values.source);
  if (!entry) throw new Error(`--source must be one of: ${manifest.sources.map((s) => s.id).join(", ")}`);
  return entry;
}
function grade(): number {
  const g = Number(values.grade);
  if (![7, 8, 9].includes(g)) throw new Error("--grade must be 7, 8 or 9");
  return g;
}
function requireDb() {
  const db = dbFromEnv();
  if (!db) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-side only)");
  return db;
}

async function download(entry: SourceEntry) {
  const meta = await downloadSource(entry, { force: values.force });
  console.log(`${meta.fromCache ? "en caché" : "descargado"}: ${entry.id} · ${meta.bytes} bytes · sha256 ${meta.sha256.slice(0, 16)}…`);
  return meta;
}

/** Rough pre-flight estimate so nobody spends by surprise. */
function estimate(entry: SourceEntry, g: number, texts: ReturnType<typeof extractPages>) {
  const config = loadAIConfig();
  const model = config.models.bulk[0];
  const chunks = chunksForGrade(entry, g);
  const chars = chunks.reduce((n, c) => n + formatPages(pageMap(texts, c.from, c.to)).length, 0);
  const input = Math.round(chars / 3.5) + chunks.length * 1_200; // ASSUMPTION: ~3.5 chars/token + prompts/schema
  const output = Math.round(input * 0.35); // ASSUMPTION: units are a fraction of the source text
  const usd = estimateCostUsd(config.prices, model, input, output);
  return { model, calls: chunks.length, input, output, usd };
}

async function structure(entry: SourceEntry, g: number) {
  const meta = await download(entry);
  const texts = extractPages(entry.id, meta.sha256);
  const est = estimate(entry, g, texts);
  console.log(
    `Estructuración de ${entry.id} ${g}.º con ${est.model}: ${est.calls} llamadas, ` +
      `~${est.input.toLocaleString()} tokens de entrada y ~${est.output.toLocaleString()} de salida ` +
      `≈ US$${est.usd?.toFixed(3) ?? "?"} (estimado).`,
  );
  if (!values.yes) {
    console.log("No se llamó a la IA. Repite con --yes para ejecutar.");
    return null;
  }
  const ai = scriptAI(dbFromEnv());
  const result = await structureGrade(ai, entry, g, texts, {
    onChunk: (r) =>
      console.log(`  ${r.chunk.label} (págs. ${r.chunk.from}–${r.chunk.to}): ${r.units.length} unidades, ${r.issues.length} problemas de verificación`),
  });
  const cov = pageCoverage(entry, result);
  console.log(`Cobertura: ${cov.covered.length}/${cov.pages.length} páginas citadas. Sin citar: ${cov.uncovered.join(", ") || "ninguna"}`);
  return result;
}

async function load(entry: SourceEntry, g: number) {
  const db = requireDb();
  const meta = await download(entry);
  const texts = extractPages(entry.id, meta.sha256);
  const sourceDbId = await upsertSource(db, entry, meta);
  await upsertPages(db, sourceDbId, texts, pagesForGrade(entry, g));
  const summary = await loadExtraction(db, entry, sourceDbId, readExtraction(entry.id, g), {
    runId: randomUUID(),
    allowAlongsideReviewed: values["alongside-reviewed"],
    texts,
  });
  console.log(
    `Cargado como borrador: ${summary.units} unidades, ${summary.skills} habilidades ` +
      `(${summary.unitsWithIssues} con problemas de verificación; se reemplazaron ${summary.deletedDrafts} borradores anteriores).`,
  );
}

async function main() {
  switch (command) {
    case "download":
      for (const e of values.source ? [source()] : manifest.sources) await download(e);
      break;
    case "extract": {
      const e = source();
      const t = extractPages(e.id, (await download(e)).sha256);
      console.log(`${Object.keys(t.pages).length} páginas extraídas con ${t.extractedWith}`);
      break;
    }
    case "structure":
      await structure(source(), grade());
      break;
    case "load":
      await load(source(), grade());
      break;
    case "coverage": {
      const e = source();
      const cov = pageCoverage(e, readExtraction(e.id, grade()));
      console.log(`Citadas: ${cov.covered.join(", ")}\nSin citar: ${cov.uncovered.join(", ") || "ninguna"}`);
      break;
    }
    case "run":
      if ((await structure(source(), grade())) && values.yes) await load(source(), grade());
      break;
    case "db-check": {
      const db = requireDb();
      const subjects = await db.select<{ id: string }>("subjects", "select=id");
      const units = await db.select<{ id: string }>("curriculum_units", "select=id&limit=1000");
      console.log(`Conexión OK. Materias: ${subjects.length}. Unidades: ${units.length}.`);
      break;
    }
    default:
      console.log("Comandos: download | extract | structure | load | coverage | run | db-check (ver encabezado de src/cli.ts)");
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Error: ${(error as Error).message}`);
  process.exitCode = 1;
});
