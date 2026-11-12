import { z } from "zod";
import { checkCalculation, evaluateCalc, optionValue } from "./items";

/**
 * Fase 3 (docs/producto/gamificacion.md §6): mini-games with FIXED mechanics. The code of each
 * mechanic is written and reviewed by people; the AI only writes the CONTENT of each piece, which
 * must pass the same independent checks as the practice items before it is published:
 *
 *   - another model solves the piece without seeing the answer and must agree;
 *   - when there is a calculation, mathjs recomputes it.
 *
 * A piece is stored as an item of kind game_<mechanic>: what the student sees goes to
 * `game_public`, the answer to `game_answer` (never sent to the browser before answering).
 */

export const GAME_MECHANICS = ["pairs", "order", "fill", "find_error"] as const;
export type GameMechanic = (typeof GAME_MECHANICS)[number];
/** The ghost race needs no content of its own: it uses the unit's verified exercises. */
export type GameMode = GameMechanic | "ghost_race";

export const GAME_LABELS: Record<GameMode, { name: string; how: string }> = {
  pairs: { name: "Parejas", how: "Une cada elemento con su pareja." },
  order: { name: "Ordena los pasos", how: "Pon los pasos en el orden correcto." },
  fill: { name: "Completa", how: "Elige lo que falta en el espacio." },
  find_error: { name: "Encuentra el error", how: "Toca el paso que tiene un error." },
  ghost_race: { name: "Carrera contra el fantasma", how: "Responde 8 preguntas. Gana quien acierta más; el tiempo no cuenta." },
};

// Plain, flat types (no unions or length limits): providers' structured outputs reject most of them.
// Shape rules are enforced afterwards by `gameIssues`.
export const generatedGameSchema = z.object({
  mechanic: z.enum(GAME_MECHANICS).describe("pairs, order, fill o find_error"),
  skill_index: z.number().int().describe("Índice (desde 0) de la habilidad de la lista que trabaja esta pieza"),
  instruction: z.string().describe("Consigna corta para el estudiante, con tuteo"),
  pairs: z
    .array(z.object({ left: z.string(), right: z.string() }))
    .nullable()
    .describe("Solo pairs: de 4 a 6 parejas correctas (izquierda ↔ derecha). null en las demás"),
  steps: z
    .array(z.string())
    .nullable()
    .describe("order: de 3 a 6 pasos EN EL ORDEN CORRECTO. find_error: de 3 a 6 pasos o frases, uno con error. null en las demás"),
  stem: z.string().nullable().describe("Solo fill: enunciado con un espacio «___». null en las demás"),
  options: z.array(z.string()).nullable().describe("Solo fill: exactamente cuatro opciones. null en las demás"),
  answer_index: z
    .number()
    .int()
    .nullable()
    .describe("fill: índice (0–3) de la opción correcta. find_error: índice (desde 0) del paso con error. null en las demás"),
  correction: z.string().nullable().describe("Solo find_error: cómo queda el paso corregido. null en las demás"),
  calc: z
    .string()
    .nullable()
    .describe("Solo fill de Matemáticas cuya respuesta es un número calculado: expresión de mathjs que lo calcula; null si no"),
  explanation: z.string().describe("Por qué la respuesta es la correcta, en lenguaje del grado"),
});

export const generatedGamesSchema = z.object({
  games: z.array(generatedGameSchema),
  notes: z.string().describe("Dudas o limitaciones; vacío si ninguna"),
});

export type GeneratedGame = z.infer<typeof generatedGameSchema>;

/** What the independent solver returns for each piece. It never sees the answer. */
export const solvedGamesSchema = z.object({
  answers: z.array(
    z.object({
      game: z.number().int().describe("Número de la pieza tal como viene en la lista (desde 1)"),
      match: z.array(z.number().int()).nullable().describe("pairs: para cada elemento de la izquierda (en orden), el número de su pareja de la derecha"),
      order: z.array(z.number().int()).nullable().describe("order: los números de los pasos en el orden correcto"),
      choice: z.number().int().nullable().describe("fill: índice (0–3) de la opción correcta. find_error: número del paso con error"),
      problems: z.string().describe("Ambigüedad, más de una respuesta posible, errores, fuera del grado; vacío si ninguno"),
    }),
  ),
});
export type SolvedGames = z.infer<typeof solvedGamesSchema>;

const between = (n: number, lo: number, hi: number) => n >= lo && n <= hi;
const blank = (s: string | null | undefined) => !s || !s.trim();

/** Shape checks that do not need a model. Any issue keeps the piece out of students' reach. */
export function gameIssues(g: GeneratedGame, skillCount: number): string[] {
  const issues: string[] = [];
  if (!between(g.skill_index, 0, skillCount - 1)) issues.push("skill_index fuera de rango");
  if (blank(g.instruction)) issues.push("sin consigna");
  if (blank(g.explanation)) issues.push("sin explicación");
  switch (g.mechanic) {
    case "pairs": {
      const p = g.pairs ?? [];
      if (!between(p.length, 4, 6)) issues.push("pairs necesita de 4 a 6 parejas");
      if (p.some((x) => blank(x.left) || blank(x.right))) issues.push("pareja vacía");
      const norm = (s: string) => s.trim().toLowerCase();
      if (new Set(p.map((x) => norm(x.left))).size !== p.length || new Set(p.map((x) => norm(x.right))).size !== p.length) {
        issues.push("parejas repetidas: la respuesta no sería única");
      }
      break;
    }
    case "order": {
      const s = g.steps ?? [];
      if (!between(s.length, 3, 6)) issues.push("order necesita de 3 a 6 pasos");
      if (s.some(blank)) issues.push("paso vacío");
      if (new Set(s.map((x) => x.trim().toLowerCase())).size !== s.length) issues.push("pasos repetidos");
      break;
    }
    case "fill": {
      const o = g.options ?? [];
      if (blank(g.stem) || !g.stem!.includes("___")) issues.push("fill necesita un enunciado con «___»");
      if (o.length !== 4) issues.push("fill necesita exactamente cuatro opciones");
      if (new Set(o.map((x) => x.trim().toLowerCase())).size !== o.length) issues.push("opciones repetidas");
      if (g.answer_index === null || !between(g.answer_index, 0, 3)) issues.push("fill sin respuesta válida");
      break;
    }
    case "find_error": {
      const s = g.steps ?? [];
      if (!between(s.length, 3, 6)) issues.push("find_error necesita de 3 a 6 pasos");
      if (s.some(blank)) issues.push("paso vacío");
      if (g.answer_index === null || !between(g.answer_index, 0, s.length - 1)) issues.push("find_error sin paso con error válido");
      if (blank(g.correction)) issues.push("find_error sin corrección");
      break;
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// What the student sees, and the answer kept apart
// ---------------------------------------------------------------------------

/** Deterministic permutation from a text (FNV-1a + Mulberry32), never the identity when n > 1. */
export function shuffleOf(n: number, seed: string): number[] {
  let h = 0x811c9dc5;
  for (const ch of seed) h = Math.imul(h ^ ch.codePointAt(0)!, 0x01000193) >>> 0;
  const rnd = () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  const p = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  if (n > 1 && p.every((v, i) => v === i)) p.push(p.shift()!);
  return p;
}

export type GamePublic =
  | { mechanic: "pairs"; instruction: string; left: string[]; right: string[] }
  | { mechanic: "order"; instruction: string; steps: string[] }
  | { mechanic: "fill"; instruction: string; stem: string; options: string[] }
  | { mechanic: "find_error"; instruction: string; steps: string[] };

export type GameAnswer =
  | { mechanic: "pairs"; match: number[] }
  | { mechanic: "order"; order: number[] }
  | { mechanic: "fill"; index: number }
  | { mechanic: "find_error"; index: number; correction: string };

/**
 * Splits a verified piece into what the browser may receive and the answer. Pairs: the right column
 * is shuffled and `match[i]` is the shown position of the pair of left[i]. Order: the steps are
 * shuffled and `order` lists the shown positions in the correct order.
 */
export function splitGame(g: GeneratedGame, seed: string): { pub: GamePublic; answer: GameAnswer } {
  switch (g.mechanic) {
    case "pairs": {
      const pairs = g.pairs!;
      const perm = shuffleOf(pairs.length, seed);           // shown position k shows pair perm[k]
      const right = perm.map((i) => pairs[i].right);
      const match = pairs.map((_, i) => perm.indexOf(i));
      return { pub: { mechanic: "pairs", instruction: g.instruction, left: pairs.map((p) => p.left), right }, answer: { mechanic: "pairs", match } };
    }
    case "order": {
      const steps = g.steps!;
      const perm = shuffleOf(steps.length, seed);
      return {
        pub: { mechanic: "order", instruction: g.instruction, steps: perm.map((i) => steps[i]) },
        answer: { mechanic: "order", order: steps.map((_, i) => perm.indexOf(i)) },
      };
    }
    case "fill":
      return {
        pub: { mechanic: "fill", instruction: g.instruction, stem: g.stem!, options: g.options! },
        answer: { mechanic: "fill", index: g.answer_index! },
      };
    case "find_error":
      return {
        pub: { mechanic: "find_error", instruction: g.instruction, steps: g.steps! },
        answer: { mechanic: "find_error", index: g.answer_index!, correction: g.correction! },
      };
  }
}

/** Grades an answer like submit_attempt() does in the database. */
export function gradeGame(answer: GameAnswer, given: number[] | number | null): boolean {
  switch (answer.mechanic) {
    case "pairs":
      return Array.isArray(given) && given.length === answer.match.length && given.every((v, i) => v === answer.match[i]);
    case "order":
      return Array.isArray(given) && given.length === answer.order.length && given.every((v, i) => v === answer.order[i]);
    case "fill":
    case "find_error":
      return typeof given === "number" && given === answer.index;
  }
}

// ---------------------------------------------------------------------------
// Independent verification
// ---------------------------------------------------------------------------

/** Pieces as the solver sees them: shuffled, numbered from 1, no answers, no explanations. */
export function gamesBlock(games: GeneratedGame[], seed: (i: number) => string): string {
  return games
    .map((g, i) => {
      const { pub } = splitGame(g, seed(i));
      const head = `### Pieza ${i + 1} · ${g.mechanic}\n${pub.instruction}`;
      switch (pub.mechanic) {
        case "pairs":
          return `${head}\nIzquierda:\n${pub.left.map((x, k) => `${k + 1}. ${x}`).join("\n")}\nDerecha:\n${pub.right.map((x, k) => `${k + 1}. ${x}`).join("\n")}`;
        case "order":
          return `${head}\nPasos (desordenados):\n${pub.steps.map((x, k) => `${k + 1}. ${x}`).join("\n")}`;
        case "fill":
          return `${head}\n${pub.stem}\n${pub.options.map((o, k) => `${k}) ${o}`).join("\n")}`;
        case "find_error":
          return `${head}\n${pub.steps.map((x, k) => `${k + 1}. ${x}`).join("\n")}`;
      }
    })
    .join("\n\n");
}

const numeric = (x: string): number | null => optionValue(x.trim()) ?? evaluateCalc(x.trim());
const same = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** Letters left after removing function names: the units of a part ("2 Mm" → "Mm"). */
const unitsOf = (part: string) => (part.replace(/\b(sqrt|gcd|lcm|abs|max|min|round|mcd|mcm)\b/g, "").match(/[A-Za-zµΩ°%]+/g) ?? []).join(" ");

/**
 * Truth of a step written as `a = b` or `a = b = c` with only numbers; null when it cannot be
 * evaluated, including when the parts carry different units ("2 Mm = 2 000 000 m").
 */
export function stepTruth(step: string): boolean | null {
  const parts = step.split("=");
  if (parts.length < 2) return null;
  if (new Set(parts.map(unitsOf)).size > 1) return null;
  const values = parts.map(numeric);
  if (values.some((v) => v === null)) return null;
  return values.every((v) => same(v!, values[0]!));
}

/**
 * Math check of a "find the error" piece: every step written as `a = b` (or `a = b = c`) with only
 * numbers is evaluated. When at least one step can be evaluated, the marked step must be the only
 * false one.
 */
export function checkErrorSteps(steps: string[], errorIndex: number): { status: "passed" | "failed" | "not_applicable"; detail?: string } {
  const truth = steps.map(stepTruth);
  if (truth.every((t) => t === null)) return { status: "not_applicable" };
  const wrong = truth.flatMap((t, i) => (t === false ? [i] : []));
  if (truth[errorIndex] === true) return { status: "failed", detail: `el paso ${errorIndex + 1} marcado como error es correcto` };
  if (wrong.some((i) => i !== errorIndex)) return { status: "failed", detail: `también es falso el paso ${wrong.find((i) => i !== errorIndex)! + 1}` };
  return { status: "passed" };
}

/**
 * An exact match, or, when the left side has a root (an irrational shown approximately), the right
 * side as a decimal rounded to the places it shows: √10 ≈ 3,16; √26 ≈ 5 (nearest whole number).
 */
function pairValueMatches(leftText: string, l: number, rightText: string, r: number): boolean {
  if (same(l, r)) return true;
  if (!/√|sqrt/.test(leftText) || !/^\s*[−-]?\d+(?:[.,]\d+)?\s*$/.test(rightText)) return false;
  const places = rightText.match(/[.,](\d+)/)?.[1].length ?? 0;
  return Math.abs(l - r) <= 0.5 * 10 ** -places + 1e-9;
}

/**
 * Math check of a pairs piece of operations and results: when every left side and every right side
 * is a number or a numeric expression, each left must equal its own right and no other.
 */
export function checkNumericPairs(pairs: { left: string; right: string }[]): { status: "passed" | "failed" | "not_applicable"; detail?: string } {
  const left = pairs.map((p) => numeric(p.left));
  const right = pairs.map((p) => numeric(p.right));
  if (left.some((v) => v === null) || right.some((v) => v === null)) return { status: "not_applicable" };
  for (const [i, l] of left.entries()) {
    if (!pairValueMatches(pairs[i].left, l!, pairs[i].right, right[i]!)) return { status: "failed", detail: `«${pairs[i].left}» no vale ${pairs[i].right}` };
    const others = right.flatMap((r, k) => (k !== i && pairValueMatches(pairs[i].left, l!, pairs[k].right, r!) ? [k] : []));
    if (others.length) return { status: "failed", detail: `«${pairs[i].left}» también vale lo de otra pareja` };
  }
  return { status: "passed" };
}

export interface GameVerification {
  verified: boolean;
  structural: string[];
  solver: { agrees: boolean; problems: string } | null;
  math: { status: "passed" | "failed" | "not_applicable"; detail?: string };
  reasons: string[];
}

/**
 * Combines the checks. `verified` requires: no structural issue, the solver gave the same answer
 * with no problems, and the calculation (fill with calc, or find_error with numeric steps) agrees.
 */
export function verifyGame(
  g: GeneratedGame,
  skillCount: number,
  seed: string,
  solved: SolvedGames["answers"][number] | undefined,
): GameVerification {
  const structural = gameIssues(g, skillCount);
  const reasons = [...structural];
  let solver: GameVerification["solver"] = null;
  let math: GameVerification["math"] = { status: "not_applicable" };
  if (structural.length === 0) {
    const { answer } = splitGame(g, seed);
    if (solved) {
      // The solver numbers pairs, order and find_error from 1; fill options from 0.
      const fromOne = (xs: number[] | null) => (xs ? xs.map((x) => x - 1) : null);
      const given =
        answer.mechanic === "pairs" ? fromOne(solved.match)
        : answer.mechanic === "order" ? fromOne(solved.order)
        : answer.mechanic === "find_error" ? (solved.choice === null ? null : solved.choice - 1)
        : solved.choice;
      solver = { agrees: gradeGame(answer, given), problems: solved.problems.trim() };
    }
    if (!solver) reasons.push("el verificador no resolvió esta pieza");
    else if (!solver.agrees) reasons.push("el verificador dio otra respuesta");
    else if (solver.problems) reasons.push(`el verificador señaló: ${solver.problems}`);
    if (g.mechanic === "fill" && g.calc) {
      const c = checkCalculation({
        skill_index: g.skill_index, difficulty: 3, reading_level: null, stem: g.stem!, options: g.options!,
        correct_index: g.answer_index!, explanation: g.explanation, distractor_explanations: ["", "", "", ""], calc: { expression: g.calc },
      });
      math = { status: c.status, detail: c.detail };
    } else if (g.mechanic === "find_error") {
      math = checkErrorSteps(g.steps!, g.answer_index!);
    } else if (g.mechanic === "pairs") {
      math = checkNumericPairs(g.pairs!);
    }
    if (math.status === "failed") reasons.push(`cálculo: ${math.detail}`);
  }
  return { verified: reasons.length === 0, structural, solver, math, reasons };
}

/** How many pieces to ask for per unit: one of each mechanic per skill, bounded to keep cost predictable. */
export function gameTarget(skillCount: number): number {
  return Math.min(16, Math.max(4, skillCount * 4));
}
