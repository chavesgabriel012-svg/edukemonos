/**
 * Study material and practice items for published units (Phase 2).
 *
 *   pnpm content generate --subject matematicas --grade 7 [--unit <id>] [--limit N] [--yes] [--force]
 *   pnpm content load     --subject matematicas --grade 7     (cached results → draft rows)
 *   pnpm content publish  --subject matematicas --grade 7     (only what passed every check)
 *   pnpm content repair   --subject matematicas --grade 7 [--yes]  (fix material the review held back)
 *   pnpm content status   --subject matematicas --grade 7
 *
 * `generate` spends money: without --yes it only prints an estimate. Each unit is cached as soon as
 * it is generated, and units already in the cache are skipped. --force rebuilds them, but each AI
 * step is cached by prompt version, so only steps whose prompt changed are paid for again.
 * If the spend fuse trips, the run stops and everything generated so far is kept.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { AIBudgetExceededError, estimateCostUsd, loadAIConfig } from "@edukemonos/ai";
import { itemTarget } from "@edukemonos/curriculum";
import { scriptAI } from "./ai";
import {
  applyRepairs,
  type ContentUnit,
  generateUnitContent,
  loadUnitContent,
  publishedUnits,
  publishVerified,
  readUnitContent,
  repairUnitMaterials,
  saveUnitContent,
  writingCount,
} from "./content";
import { dbFromEnv } from "./db";

const envFile = join(import.meta.dirname, "../../../apps/web/.env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    subject: { type: "string" },
    grade: { type: "string" },
    unit: { type: "string" },
    limit: { type: "string" },
    yes: { type: "boolean", default: false },
    force: { type: "boolean", default: false },
  },
});
const command = positionals[0];

const SUBJECTS = ["espanol", "matematicas", "ciencias", "estudios_sociales", "ingles", "civica"];

function args() {
  const subject = values.subject ?? "";
  const grade = Number(values.grade);
  if (!SUBJECTS.includes(subject)) throw new Error(`--subject must be one of: ${SUBJECTS.join(", ")}`);
  if (![7, 8, 9].includes(grade)) throw new Error("--grade must be 7, 8 or 9");
  return { subject, grade };
}

function requireDb() {
  const db = dbFromEnv();
  if (!db) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-side only)");
  return db;
}

/**
 * Pre-flight estimate per unit. ASSUMPTIONS until measured: ~3.5 characters per token, ~1,000
 * tokens of instructions per call, ~4,500 visible tokens of material, ~450 per item, ~150 per
 * solved item, and visible output × 1.6 for thinking (the curriculum run measured ~1.6×).
 */
function estimateUnit(u: ContentUnit): { input: number; output: number } {
  const block = Math.round(JSON.stringify(u).length / 3.5);
  const n = itemTarget(u.skills.length);
  const w = writingCount(u);
  const material = 4_500;
  const items = n * 450 + w * 250;
  const input = 4 * (1_000 + block) + material + items; // review sees the material; solver sees the items
  const output = Math.round((material + 900 + items + n * 150) * 1.6);
  return { input, output };
}

async function selectUnits(subject: string, grade: number): Promise<ContentUnit[]> {
  const db = requireDb();
  let units = await publishedUnits(db, subject, grade);
  if (values.unit) units = units.filter((u) => u.id === values.unit);
  if (values.limit) units = units.slice(0, Number(values.limit));
  return units;
}

async function generate() {
  const { subject, grade } = args();
  const db = requireDb();
  const units = await selectUnits(subject, grade);
  if (units.length === 0) {
    console.log(`No hay unidades publicadas de ${subject} ${grade}.º. Publícalas en /revisar primero.`);
    return;
  }
  // Skip units already generated: in the local cache, or (if the container lost it) already in Supabase.
  const ids = units.map((u) => u.id).join(",");
  const inDb = new Set(
    ids ? (await db.select<{ unit_id: string }>("materials", `select=unit_id&unit_id=in.(${ids})`)).map((r) => r.unit_id) : [],
  );
  const pending = units.filter((u) => values.force || (!readUnitContent(u.id) && !inDb.has(u.id)));
  const config = loadAIConfig();
  const totals = pending.map(estimateUnit).reduce((a, b) => ({ input: a.input + b.input, output: a.output + b.output }), { input: 0, output: 0 });
  // Generation and verification may use different models: price each share with its own model.
  const usd =
    (estimateCostUsd(config.prices, config.models.bulk[0], totals.input * 0.5, totals.output * 0.75) ?? 0) +
    (estimateCostUsd(config.prices, config.models.verify[0], totals.input * 0.5, totals.output * 0.25) ?? 0);
  console.log(
    `${units.length} unidades publicadas; ${units.length - pending.length} ya generadas, ${pending.length} por generar ` +
      `(${pending.length * 4} llamadas). Estimado: ~${totals.input.toLocaleString()} tokens de entrada y ` +
      `~${totals.output.toLocaleString()} de salida ≈ US$${usd.toFixed(2)}.`,
  );
  if (!values.yes) {
    console.log("No se llamó a la IA. Repite con --yes para ejecutar.");
    return;
  }
  const ai = scriptAI(db);
  for (const [k, u] of pending.entries()) {
    const label = `[${k + 1}/${pending.length}] ${u.title}`;
    try {
      const content = await generateUnitContent(ai, u, { log: (m) => console.log(`  ${label}: ${m}`) });
      saveUnitContent(content);
      const s = await loadUnitContent(db, u, content);
      if (s.skipped) {
        console.log(`✓ ${label}: generado y guardado en caché; la unidad ya tenía contenido publicado, así que no se cargó.`);
        continue;
      }
      const okMaterials = content.materials.filter((m) => m.check.ok).length;
      console.log(
        `✓ ${label}: material ${okMaterials}/${content.materials.length} aprobado por el revisor; ` +
          `ítems ${s.verified}/${content.choice.length} verificados; ${s.writing} consignas de escritura.`,
      );
    } catch (error) {
      if (error instanceof AIBudgetExceededError) {
        console.log(`Se alcanzó el fusible de gasto (${error.message}). Lo generado hasta aquí quedó guardado.`);
        return;
      }
      console.log(`✗ ${label}: ${(error as Error).message}`);
    }
  }
}

async function load() {
  const { subject, grade } = args();
  const db = requireDb();
  for (const u of await selectUnits(subject, grade)) {
    const content = readUnitContent(u.id);
    if (!content) continue;
    const s = await loadUnitContent(db, u, content);
    if (s.skipped) {
      console.log(`${u.title}: ya tiene contenido publicado o revisado; no se tocó (usa repair o /revisar).`);
      continue;
    }
    console.log(`${u.title}: ${s.materials} materiales, ${s.items} ítems (${s.verified} verificados), ${s.writing} consignas.`);
  }
}

async function repair() {
  const { subject, grade } = args();
  const db = requireDb();
  const units = (await selectUnits(subject, grade)).flatMap((u) => {
    const c = readUnitContent(u.id);
    return c && c.materials.some((m) => !m.check.ok) ? [{ u, c }] : [];
  });
  const count = units.reduce((n, x) => n + x.c.materials.filter((m) => !m.check.ok).length, 0);
  console.log(`${count} materiales retenidos por la revisión en ${units.length} unidades (2 llamadas cada uno, ~US$0,05).`);
  if (!values.yes || count === 0) {
    if (count) console.log("No se llamó a la IA. Repite con --yes para ejecutar.");
    return;
  }
  const ai = scriptAI(db);
  for (const { u, c } of units) {
    try {
      const { content, repaired } = await repairUnitMaterials(ai, u, c, { log: (m) => console.log(`  ${u.title}: ${m}`) });
      saveUnitContent(content);
      await applyRepairs(db, u, content, repaired);
    } catch (error) {
      if (error instanceof AIBudgetExceededError) {
        console.log(`Se alcanzó el fusible de gasto (${error.message}).`);
        return;
      }
      console.log(`✗ ${u.title}: ${(error as Error).message}`);
    }
  }
  await publish();
}

async function publish() {
  const { subject, grade } = args();
  const units = await selectUnits(subject, grade);
  const s = await publishVerified(requireDb(), units.map((u) => u.id));
  console.log(
    `Publicado como "Generado con IA · pendiente de revisión": ${s.materials} materiales, ${s.items} ítems verificados, ` +
      `${s.writing} consignas de escritura. Lo que no pasó las verificaciones sigue en borrador en /revisar.`,
  );
}

async function status() {
  const { subject, grade } = args();
  const db = requireDb();
  const units = await selectUnits(subject, grade);
  const ids = units.map((u) => u.id).join(",");
  if (!ids) return console.log("Sin unidades publicadas.");
  const materials = await db.select<{ status: string }>("materials", `select=status&unit_id=in.(${ids})`);
  const items = await db.select<{ status: string; verified: boolean; kind: string }>("items", `select=status,verified,kind&unit_id=in.(${ids})`);
  const count = <T>(xs: T[], f: (x: T) => boolean) => xs.filter(f).length;
  console.log(
    `${units.length} unidades publicadas · en caché: ${units.filter((u) => readUnitContent(u.id)).length}\n` +
      `Materiales: ${count(materials, (m) => m.status === "published")} publicados, ${count(materials, (m) => m.status === "draft")} en borrador\n` +
      `Ítems: ${count(items, (i) => i.status === "published")} publicados, ${count(items, (i) => i.verified)} verificados, ` +
      `${count(items, (i) => i.status === "draft")} en borrador, ${count(items, (i) => i.kind === "open_writing")} de escritura`,
  );
}

async function main() {
  switch (command) {
    case "generate":
      return generate();
    case "load":
      return load();
    case "publish":
      return publish();
    case "repair":
      return repair();
    case "status":
      return status();
    default:
      console.log("Comandos: generate | load | publish | repair | status (ver encabezado de src/content-cli.ts)");
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Error: ${(error as Error).message}`);
  process.exitCode = 1;
});
