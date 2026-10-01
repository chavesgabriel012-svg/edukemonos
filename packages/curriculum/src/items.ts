import { create, all } from "mathjs";
import { z } from "zod";
import { normalizeForMatch } from "./text";

/**
 * Practice items generated from a published unit, and the automatic checks they must pass before
 * they can be published or used in the diagnostic (SPEC §8). The generator never grades itself:
 * an item is `verified` only when an independent solver agrees with its key and, when the answer is
 * a calculation, mathjs agrees too.
 */

// Plain types only (no length constraints): providers' structured outputs reject most of them.
// Shape rules are enforced afterwards by `structuralIssues`.
export const generatedChoiceItemSchema = z.object({
  skill_index: z.number().int().describe("Índice (desde 0) de la habilidad de la lista que evalúa este ítem"),
  difficulty: z.number().int().describe("1 = por debajo del grado, 3 = nivel del grado, 5 = reto"),
  reading_level: z
    .enum(["literal", "inferencial", "critica"])
    .nullable()
    .describe("Solo comprensión lectora de Español: nivel de lectura; null en los demás ítems"),
  stem: z.string().describe("Enunciado completo en Markdown (incluye el texto breve a leer si hace falta)"),
  options: z.array(z.string()).describe("Exactamente cuatro opciones, sin letras ni numeración"),
  correct_index: z.number().int().describe("Índice (0–3) de la única opción correcta"),
  explanation: z.string().describe("Por qué la opción correcta es correcta, paso a paso y en lenguaje del grado"),
  distractor_explanations: z
    .array(z.string())
    .describe("Cuatro textos alineados con las opciones: por qué cada opción incorrecta es incorrecta (vacío en la correcta)"),
  calc: z
    .object({
      expression: z.string().describe("Expresión de mathjs que calcula la respuesta con los datos del enunciado, p. ej. \"(5 + 7)^2\""),
    })
    .nullable()
    .describe("Obligatorio cuando la respuesta correcta es un número obtenido por cálculo; null si el ítem es conceptual"),
});

export const generatedWritingItemSchema = z.object({
  skill_index: z.number().int(),
  difficulty: z.number().int(),
  prompt: z.string().describe("Consigna de escritura en Markdown"),
  criteria: z.array(z.string()).describe("Criterios con los que se dará retroalimentación"),
});

export const generatedItemsSchema = z.object({
  items: z.array(generatedChoiceItemSchema),
  writing: z.array(generatedWritingItemSchema).describe("Solo Español: consignas de escritura abierta; vacío en otras materias"),
  notes: z.string().describe("Dudas o limitaciones; vacío si ninguna"),
});

export type GeneratedChoiceItem = z.infer<typeof generatedChoiceItemSchema>;
export type GeneratedWritingItem = z.infer<typeof generatedWritingItemSchema>;
export type GeneratedItems = z.infer<typeof generatedItemsSchema>;

/** What the independent solver returns. It never sees the key. */
export const solvedItemsSchema = z.object({
  answers: z.array(
    z.object({
      item: z.number().int().describe("Número del ítem tal como viene en la lista (desde 1)"),
      chosen_index: z.number().int().nullable().describe("Índice (0–3) de la opción que elegiste; null si ninguna o varias son correctas"),
      problems: z.string().describe("Ambigüedad, errores, más de una correcta, fuera del grado; vacío si ninguno"),
    }),
  ),
});
export type SolvedItems = z.infer<typeof solvedItemsSchema>;

/**
 * Repairs the one deviation seen in practice: three distractor explanations for four options
 * because the model left out the correct option's empty entry. Inserts it at the key. Anything
 * else is left as is for `structuralIssues` to flag.
 */
export function normalizeItem(item: GeneratedChoiceItem): GeneratedChoiceItem {
  const d = item.distractor_explanations;
  if (item.options.length === 4 && d.length === 3 && item.correct_index >= 0 && item.correct_index <= 3) {
    return { ...item, distractor_explanations: [...d.slice(0, item.correct_index), "", ...d.slice(item.correct_index)] };
  }
  return item;
}

const BANNED_OPTIONS = ["todas las anteriores", "ninguna de las anteriores", "todas las opciones", "a y b"];

/** Shape checks that do not need a model. Any issue keeps the item out of students' reach. */
export function structuralIssues(item: GeneratedChoiceItem, skillCount: number): string[] {
  const issues: string[] = [];
  if (!item.stem.trim()) issues.push("enunciado vacío");
  if (item.options.length !== 4) issues.push(`tiene ${item.options.length} opciones en vez de 4`);
  if (item.options.some((o) => !o.trim())) issues.push("hay una opción vacía");
  const normalized = item.options.map((o) => normalizeForMatch(o));
  if (new Set(normalized).size !== normalized.length) issues.push("hay opciones repetidas");
  if (normalized.some((o) => BANNED_OPTIONS.some((b) => o.includes(b)))) issues.push("usa «todas/ninguna de las anteriores»");
  if (!Number.isInteger(item.correct_index) || item.correct_index < 0 || item.correct_index > 3) issues.push("índice de respuesta fuera de 0–3");
  if (item.distractor_explanations.length !== item.options.length) issues.push("las explicaciones de distractores no calzan con las opciones");
  else if (item.distractor_explanations.some((d, i) => i !== item.correct_index && !d.trim())) issues.push("falta explicar algún distractor");
  if (!item.explanation.trim()) issues.push("falta la explicación");
  if (!Number.isInteger(item.difficulty) || item.difficulty < 1 || item.difficulty > 5) issues.push("dificultad fuera de 1–5");
  if (!Number.isInteger(item.skill_index) || item.skill_index < 0 || item.skill_index >= skillCount) issues.push("habilidad inexistente");
  return issues;
}

export function writingIssues(item: GeneratedWritingItem, skillCount: number): string[] {
  const issues: string[] = [];
  if (!item.prompt.trim()) issues.push("consigna vacía");
  if (item.criteria.filter((c) => c.trim()).length === 0) issues.push("sin criterios de retroalimentación");
  if (!Number.isInteger(item.difficulty) || item.difficulty < 1 || item.difficulty > 5) issues.push("dificultad fuera de 1–5");
  if (!Number.isInteger(item.skill_index) || item.skill_index < 0 || item.skill_index >= skillCount) issues.push("habilidad inexistente");
  return issues;
}

// A sandboxed mathjs: no import/createUnit/evaluate-from-inside, so a generated expression can only compute.
const math = create(all);
const evaluateExpression = math.evaluate.bind(math);
math.import(
  Object.fromEntries(
    ["import", "createUnit", "evaluate", "parse", "simplify", "derivative", "resolve", "reviver", "replacer"].map((name) => [
      name,
      () => {
        throw new Error(`${name} no está permitido`);
      },
    ]),
  ),
  { override: true },
);

const TOLERANCE = 1e-9;

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && "valueOf" in value) {
    const v = (value as { valueOf(): unknown }).valueOf();
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

/** Evaluates a generated expression. Returns null when it is not a finite real number. */
export function evaluateCalc(expression: string): number | null {
  try {
    return toNumber(evaluateExpression(cleanMath(expression)));
  } catch {
    return null;
  }
}

/** School notation → mathjs syntax: 2,5 → 2.5; × → *; ÷ → /; − → -; ² → ^2; √ → sqrt. */
function cleanMath(text: string): string {
  // NFC, not NFKC: NFKC turns "5²" into "52".
  return text
    .normalize("NFC")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/[−–—]/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/(\d)\s+(?=\d{3}(?!\d))/g, "$1") // 1 000 → 1000 (space as thousands separator)
    .replace(/(\d),(\d)/g, "$1.$2") // decimal comma
    .replace(/√\s*\(/g, "sqrt(")
    .replace(/√\s*(\d+(?:\.\d+)?)/g, "sqrt($1)");
}

/**
 * Reads the numeric value of an answer option such as "144", "−3/4", "2,5 cm²", "x = 5" or "25 %".
 * Returns null for anything that is not a plain number (text answers, expressions with variables).
 */
export function optionValue(option: string): number | null {
  let text = option
    .normalize("NFC")
    .trim()
    .replace(/^\$|\$$/g, "")
    .replace(/^[a-z]\s*=\s*/i, "")
    .replace(/^₡\s*/, "") // colones: "₡3 400"
    .replace(/\s*colones$/i, "");
  // Drop a trailing unit before converting superscripts: "12 cm²" is 12, not 12 cm^2.
  text = text.replace(/\s*(?:[a-záéíóúñ]+[²³]?|%|°)\s*$/i, "");
  text = cleanMath(text).trim();
  if (!/\d/.test(text) || !/^[-+*/^().\d\s]+$/.test(text.replace(/sqrt/g, ""))) return null;
  try {
    return toNumber(evaluateExpression(text));
  } catch {
    return null;
  }
}

export interface MathCheck {
  status: "passed" | "failed" | "not_applicable";
  computed?: number | null;
  detail?: string;
}

/**
 * Independent calculation check: evaluates `calc.expression` and requires that the correct option,
 * and only the correct option, has that value. The model's own key is never trusted here.
 */
export function checkCalculation(item: GeneratedChoiceItem): MathCheck {
  if (!item.calc) return { status: "not_applicable" };
  const computed = evaluateCalc(item.calc.expression);
  if (computed === null) return { status: "failed", computed, detail: `no se pudo evaluar «${item.calc.expression}»` };
  const values = item.options.map(optionValue);
  const equal = (v: number | null) => v !== null && Math.abs(v - computed) <= TOLERANCE * Math.max(1, Math.abs(computed));
  const matches = values.flatMap((v, i) => (equal(v) ? [i] : []));
  if (values[item.correct_index] === null) {
    return { status: "failed", computed, detail: "la opción correcta no es un número que se pueda comparar" };
  }
  if (matches.length === 1 && matches[0] === item.correct_index) return { status: "passed", computed };
  if (matches.length === 0) return { status: "failed", computed, detail: `ninguna opción vale ${computed}` };
  if (!matches.includes(item.correct_index)) return { status: "failed", computed, detail: `la clave no vale ${computed}; vale la opción ${matches[0] + 1}` };
  return { status: "failed", computed, detail: `más de una opción vale ${computed}` };
}

export interface ItemVerification {
  verified: boolean;
  structural: string[];
  solver: { chosen_index: number | null; agrees: boolean; problems: string } | null;
  math: MathCheck;
  reasons: string[];
}

/**
 * Combines the three checks. `verified` requires: no structural issue, the independent solver chose
 * the keyed option without reporting problems, and the calculation (when there is one) matches.
 * Math items whose answer is a number must come with a calculation.
 */
export function verifyItem(
  item: GeneratedChoiceItem,
  skillCount: number,
  solved: SolvedItems["answers"][number] | undefined,
  { requireCalcForNumericAnswers = false }: { requireCalcForNumericAnswers?: boolean } = {},
): ItemVerification {
  const structural = structuralIssues(item, skillCount);
  const math = checkCalculation(item);
  const solver = solved
    ? { chosen_index: solved.chosen_index, agrees: solved.chosen_index === item.correct_index, problems: solved.problems.trim() }
    : null;
  const reasons = [...structural];
  if (!solver) reasons.push("el verificador no respondió este ítem");
  else if (!solver.agrees) reasons.push(solver.chosen_index === null ? "el verificador no encontró una única respuesta" : `el verificador eligió la opción ${solver.chosen_index + 1}`);
  else if (solver.problems) reasons.push(`el verificador señaló: ${solver.problems}`);
  if (math.status === "failed") reasons.push(`cálculo: ${math.detail}`);
  if (
    requireCalcForNumericAnswers &&
    math.status === "not_applicable" &&
    item.options.length === 4 &&
    item.options.every((o) => optionValue(o) !== null)
  ) {
    reasons.push("respuesta numérica sin expresión de cálculo");
  }
  return { verified: reasons.length === 0, structural, solver, math, reasons };
}

/** How many items to ask for in a unit: about three per skill, bounded so cost stays predictable. */
export function itemTarget(skillCount: number): number {
  return Math.min(12, Math.max(6, skillCount * 3));
}
