import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { AI } from "@edukemonos/ai";
import {
  generateItemsSystem,
  generateItemsUser,
  generateMaterialsSystem,
  generateMaterialsUser,
  renderPrompt,
  reviewMaterialsSystem,
  reviewMaterialsUser,
  solveItemsSystem,
  solveItemsUser,
} from "@edukemonos/ai/prompts";
import {
  checkMaterial,
  type GeneratedChoiceItem,
  generatedItemsSchema,
  generatedMaterialsSchema,
  type GeneratedWritingItem,
  type ItemVerification,
  itemTarget,
  MATERIAL_KINDS,
  type MaterialCheck,
  type MaterialKind,
  materialReviewSchema,
  normalizeItem,
  solvedItemsSchema,
  verifyItem,
  writingIssues,
} from "@edukemonos/curriculum";
import { ensureDir, paths } from "./cache";
import type { Db } from "./db";
import { GRADE_NAMES, SUBJECT_NAMES } from "./structure";

/**
 * Phase 2: study material and practice items for PUBLISHED units (SPEC §4.2, §8).
 *
 *   generate → material (bulk) + independent review (verify) + items (bulk) + independent solve (verify) + mathjs
 *   load     → draft rows in `materials` / `items`, each with its verification
 *   publish  → only what passed every check, marked as AI-generated and not yet reviewed by a teacher
 *
 * Every step is cached per unit, so a failed run never pays twice for what already succeeded.
 */

export interface ContentUnit {
  id: string;
  subject_id: string;
  grade_id: number;
  area: string | null;
  title: string;
  contents: string[];
  learning_outcomes: string[];
  source_excerpt: string;
  skills: { id: string; code: string | null; name: string }[];
}

export interface MaterialResult {
  kind: MaterialKind;
  content: string;
  check: MaterialCheck;
}

export interface ChoiceResult {
  item: GeneratedChoiceItem;
  verification: ItemVerification;
}

export interface WritingResult {
  item: GeneratedWritingItem;
  issues: string[];
}

export interface UnitContent {
  unitId: string;
  createdAt: string;
  models: { materials: string; review: string; items: string; solve: string };
  prompts: { materials: string; review: string; items: string; solve: string };
  materials: MaterialResult[];
  choice: ChoiceResult[];
  writing: WritingResult[];
  notes: { materials: string; items: string };
}

const promptRef = (p: { id: string; version: string }) => `${p.id}@${p.version}`;
export const PROMPTS = {
  materials: promptRef(generateMaterialsSystem),
  review: promptRef(reviewMaterialsSystem),
  items: promptRef(generateItemsSystem),
  solve: promptRef(solveItemsSystem),
};

const subjectName = (u: ContentUnit) => SUBJECT_NAMES[u.subject_id] ?? u.subject_id;
const gradeName = (u: ContentUnit) => GRADE_NAMES[u.grade_id] ?? `${u.grade_id}.º`;

/** The unit as the models see it: only curriculum data, never anything about students. */
export function unitBlock(u: ContentUnit): string {
  const list = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- (sin datos en el programa)");
  return [
    `Materia: ${subjectName(u)}`,
    `Grado: ${gradeName(u)}`,
    u.area ? `Área: ${u.area}` : null,
    `Unidad: ${u.title}`,
    `Contenidos:\n${list(u.contents)}`,
    `Criterios o resultados de aprendizaje:\n${list(u.learning_outcomes)}`,
    `Habilidades (número entre corchetes = skill_index):\n${u.skills.map((s, i) => `[${i}] ${s.name}`).join("\n")}`,
    `Extracto del programa oficial: "${u.source_excerpt}"`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function materialsBlock(m: Record<MaterialKind, string>): string {
  return MATERIAL_KINDS.map((k) => `=== ${k} ===\n${m[k]}`).join("\n\n");
}

/** Items as the solver sees them: no key, no explanations, no calculation. */
export function itemsBlock(items: GeneratedChoiceItem[]): string {
  return items
    .map((it, i) => `### Ítem ${i + 1}\n${it.stem}\n\n${it.options.map((o, k) => `${k}) ${o}`).join("\n")}`)
    .join("\n\n");
}

export function writingCount(u: ContentUnit): number {
  return u.subject_id === "espanol" ? 2 : 0;
}

/**
 * Caches each AI step of a unit as soon as it returns, so a later failure (or the spend fuse)
 * never pays again for the steps that already succeeded.
 */
function stepCache(unitId: string) {
  const file = paths.contentSteps(unitId);
  const saved: Record<string, unknown> = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  // Keyed by prompt version: changing a prompt redoes only the steps that use it.
  return async <T>(name: string, prompt: string, run: () => Promise<T>): Promise<T> => {
    const key = `${name}:${prompt}`;
    if (key in saved) return saved[key] as T;
    const value = await run();
    saved[key] = value;
    writeFileSync(ensureDir(file), JSON.stringify(saved, null, 2));
    return value;
  };
}

export async function generateUnitContent(
  ai: AI,
  u: ContentUnit,
  { log }: { log?: (msg: string) => void } = {},
): Promise<UnitContent> {
  if (u.skills.length === 0) throw new Error(`Unit ${u.id} has no skills`);
  const block = unitBlock(u);
  const step = stepCache(u.id);

  const mat = await step("materials", PROMPTS.materials, () => ai.generateStructured(
    { role: "bulk", purpose: "bulk_material" },
    {
      system: renderPrompt(generateMaterialsSystem, {}),
      messages: [{ role: "user", content: renderPrompt(generateMaterialsUser, { unitBlock: block }) }],
      schema: generatedMaterialsSchema,
      schemaName: "materials",
      maxTokens: 16_000,
    },
  ));
  log?.("material generado");
  const review = await step("review", PROMPTS.review, () => ai.generateStructured(
    { role: "verify", purpose: "verify_material" },
    {
      system: renderPrompt(reviewMaterialsSystem, {}),
      messages: [{ role: "user", content: renderPrompt(reviewMaterialsUser, { unitBlock: block, materialsBlock: materialsBlock(mat.data) }) }],
      schema: materialReviewSchema,
      schemaName: "material_review",
      maxTokens: 8_000,
    },
  ));
  log?.("material revisado");

  const gen = await step("items", PROMPTS.items, () => ai.generateStructured(
    { role: "bulk", purpose: "bulk_items" },
    {
      system: renderPrompt(generateItemsSystem, {}),
      messages: [
        {
          role: "user",
          content: renderPrompt(generateItemsUser, {
            unitBlock: block,
            itemCount: String(itemTarget(u.skills.length)),
            writingCount: String(writingCount(u)),
          }),
        },
      ],
      schema: generatedItemsSchema,
      schemaName: "items",
      // Above ~16k the SDK requires streaming (requests that may take over 10 minutes).
      maxTokens: 16_000,
    },
  ));
  log?.(`${gen.data.items.length} ítems generados`);
  const solved = gen.data.items.length
    ? await step("solve", PROMPTS.solve, () => ai.generateStructured(
        { role: "verify", purpose: "verify_item" },
        {
          system: renderPrompt(solveItemsSystem, {}),
          messages: [
            { role: "user", content: renderPrompt(solveItemsUser, { subject: subjectName(u), grade: gradeName(u), itemsBlock: itemsBlock(gen.data.items) }) },
          ],
          schema: solvedItemsSchema,
          schemaName: "solved_items",
          // The solver must actually work each item out: with default effort it answered six items in
          // ~140 tokens and got two wrong. Asking for its working in the output gets refused
          // (reasoning extraction), so it reasons internally at a higher effort instead.
          effort: "xhigh",
          maxTokens: 16_000,
        },
      ))
    : null;
  log?.("ítems resueltos por el verificador");

  const answers = new Map((solved?.data.answers ?? []).map((a) => [a.item, a]));
  const requireCalc = u.subject_id === "matematicas";
  return {
    unitId: u.id,
    createdAt: new Date().toISOString(),
    models: { materials: mat.model, review: review.model, items: gen.model, solve: solved?.model ?? "" },
    prompts: PROMPTS,
    materials: MATERIAL_KINDS.map((kind) => ({ kind, content: mat.data[kind], check: checkMaterial(kind, mat.data[kind], review.data) })),
    choice: gen.data.items.map(normalizeItem).map((item, i) => ({
      item,
      verification: verifyItem(item, u.skills.length, answers.get(i + 1), { requireCalcForNumericAnswers: requireCalc }),
    })),
    writing: gen.data.writing.map((item) => ({ item, issues: writingIssues(item, u.skills.length) })),
    notes: { materials: mat.data.notes, items: gen.data.notes },
  };
}

export function saveUnitContent(c: UnitContent): void {
  writeFileSync(ensureDir(paths.content(c.unitId)), JSON.stringify(c, null, 2));
}

export function readUnitContent(unitId: string): UnitContent | null {
  const file = paths.content(unitId);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as UnitContent) : null;
}

/** Published units of a subject and grade, with their skills in order. */
export async function publishedUnits(db: Db, subject: string, grade: number): Promise<ContentUnit[]> {
  const rows = await db.select<ContentUnit & { skills: { id: string; code: string | null; name: string; sort_order: number }[] }>(
    "curriculum_units",
    `select=id,subject_id,grade_id,area,title,contents,learning_outcomes,source_excerpt,skills(id,code,name,sort_order)` +
      `&subject_id=eq.${subject}&grade_id=eq.${grade}&status=eq.published&order=sort_order`,
  );
  return rows.map((r) => ({ ...r, skills: [...r.skills].sort((a, b) => a.sort_order - b.sort_order) }));
}

export interface LoadContentSummary {
  materials: number;
  items: number;
  verified: number;
  writing: number;
  replaced: number;
}

/**
 * Writes one unit's generated content as drafts. Replaces earlier unreviewed drafts of that unit;
 * anything a reviewer touched (reviewer_id set) or already published is never deleted.
 */
export async function loadUnitContent(db: Db, u: ContentUnit, c: UnitContent): Promise<LoadContentSummary> {
  const unreviewedDraft = `unit_id=eq.${u.id}&status=eq.draft&reviewer_id=is.null`;
  const replaced = (await db.delete("materials", unreviewedDraft)) + (await db.delete("items", `${unreviewedDraft}&origin=eq.bulk`));
  const [mp, mv] = c.prompts.materials.split("@");
  await db.insert(
    "materials",
    c.materials.map((m) => ({
      unit_id: u.id,
      kind: m.kind,
      content: m.content,
      status: "draft",
      model: c.models.materials,
      prompt_id: mp,
      prompt_version: mv,
      verification: { ok: m.check.ok, problems: m.check.problems, reviewed_with: c.models.review, review_prompt: c.prompts.review },
    })),
    { returning: false },
  );
  const [ip, iv] = c.prompts.items.split("@");
  const choiceRows = c.choice.map(({ item, verification }) => ({
    unit_id: u.id,
    skill_ids: u.skills[item.skill_index] ? [u.skills[item.skill_index].id] : [],
    kind: "single_choice",
    stem: item.stem,
    options: item.options,
    // Keep the DB constraint satisfiable for malformed items; they stay unverified drafts anyway.
    correct_index: item.options.length === 4 && item.correct_index >= 0 && item.correct_index <= 3 ? item.correct_index : null,
    explanation: item.explanation,
    distractor_explanations: item.distractor_explanations,
    difficulty: Math.min(5, Math.max(1, Math.round(item.difficulty))),
    reading_level: item.reading_level,
    verified: verification.verified,
    verification: { ...verification, calc: item.calc, solved_with: c.models.solve, solve_prompt: c.prompts.solve },
    status: "draft",
    origin: "bulk",
    model: c.models.items,
    prompt_id: ip,
    prompt_version: iv,
  }));
  // A malformed single-choice item cannot be stored as such (DB shape check): skip it, it is in the cache.
  const storable = choiceRows.filter((r) => r.options.length === 4 && r.correct_index !== null);
  const writingRows = c.writing.map(({ item, issues }) => ({
    unit_id: u.id,
    skill_ids: u.skills[item.skill_index] ? [u.skills[item.skill_index].id] : [],
    kind: "open_writing",
    stem: item.prompt,
    explanation: item.criteria.map((x) => `- ${x}`).join("\n"),
    difficulty: Math.min(5, Math.max(1, Math.round(item.difficulty))),
    verified: false,
    verification: { structural: issues, kind: "open_writing" },
    status: "draft",
    origin: "bulk",
    model: c.models.items,
    prompt_id: ip,
    prompt_version: iv,
  }));
  await db.insert("items", [...storable, ...writingRows], { returning: false });
  return {
    materials: c.materials.length,
    items: storable.length,
    verified: storable.filter((r) => r.verified).length,
    writing: writingRows.length,
    replaced,
  };
}

export interface PublishSummary {
  materials: number;
  items: number;
  writing: number;
}

/**
 * Publishes what passed every automatic check, for units that are themselves published.
 * Published without a reviewer: the app shows it as "Generado con IA · pendiente de revisión".
 */
export async function publishVerified(db: Db, unitIds: string[]): Promise<PublishSummary> {
  if (unitIds.length === 0) return { materials: 0, items: 0, writing: 0 };
  const inUnits = `unit_id=in.(${unitIds.join(",")})`;
  const materials = await db.update("materials", `${inUnits}&status=eq.draft&verification->>ok=eq.true`, { status: "published" });
  const items = await db.update("items", `${inUnits}&status=eq.draft&kind=eq.single_choice&verified=is.true`, { status: "published" });
  const writing = await db.update("items", `${inUnits}&status=eq.draft&kind=eq.open_writing&verification->>structural=eq.[]`, { status: "published" });
  return { materials, items, writing };
}
