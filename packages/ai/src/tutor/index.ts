import { evaluateCalc } from "@edukemonos/curriculum";
import { z } from "zod";
import { renderPrompt } from "../prompts/define";
import { tutorSystem, tutorTurnContext } from "../prompts/tutor";
import { defineTool } from "../tools";
import type { ChatMessage, ToolDefinition } from "../types";
import { safetyNote, type SafetyFlag } from "./safety";

export { assumedGenderWords, filterTutorOutput, toNeutral, stripUnverifiedPhones, toTuteo, tutorOutputStream } from "./output";
export { safetyNote, screenStudentMessage, type SafetyFlag, type ScreenedInput } from "./safety";

/** Exact arithmetic for the tutor (SPEC §10): the model must not compute from memory. */
export const calculatorTool: ToolDefinition = defineTool({
  name: "calculadora",
  description:
    "Calcula una expresión aritmética exacta. Úsala para cualquier operación antes de afirmar un resultado, " +
    "también para comprobar el trabajo del estudiante. Acepta números, + − × ÷ * / ^, paréntesis, sqrt(), " +
    "gcd(a, b) (máximo común divisor), lcm(a, b) (mínimo común múltiplo) y mod(a, b) (residuo; si es 0, b divide a a). " +
    "Ejemplos: \"(5 + 7)^2\", \"2,5 × 4\", \"gcd(24, 36)\", \"mod(91, 7)\".",
  schema: z.object({ expression: z.string().max(200).describe("La expresión a calcular") }),
  run: async ({ expression }) => {
    const value = evaluateCalc(expression);
    if (value === null) return "No pude calcular esa expresión. Revisa que tenga solo números y operaciones.";
    const rounded = Math.round(value * 1e10) / 1e10;
    return `${expression} = ${String(rounded).replace(".", ",")}`;
  },
});

export interface TutorUnit {
  subject: string;
  grade: number;
  title: string;
  area: string | null;
  contents: string[];
  skills: string[];
  /** Published material (summary, explanation…), already trimmed to a size budget. */
  material: string;
}

export interface HelpResources {
  emergency: { name: string; phone: string; description: string };
  resources: { name: string; phone?: string; description?: string }[];
  trustedAdultMessage: string;
}

/** Phone numbers the tutor may give: only the verified help list. */
export function allowedPhones(h: HelpResources): string[] {
  return [h.emergency.phone, ...h.resources.flatMap((r) => (r.phone ? [r.phone] : []))];
}

export function helpResourcesText(h: HelpResources): string {
  const lines = [`- ${h.emergency.name}: ${h.emergency.phone}. ${h.emergency.description}`];
  for (const r of h.resources) lines.push(`- ${r.name}${r.phone ? `: ${r.phone}` : ""}${r.description ? `. ${r.description}` : ""}`);
  lines.push(`- ${h.trustedAdultMessage}`);
  return lines.join("\n");
}

const MATERIAL_BUDGET = 9_000; // characters of published material in the context (≈2,500 tokens)

export function unitContext(u: TutorUnit): string {
  const list = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- (sin datos)");
  const material = u.material.length > MATERIAL_BUDGET ? `${u.material.slice(0, MATERIAL_BUDGET)}\n[…]` : u.material;
  return [
    `Materia: ${u.subject} · Grado: ${u.grade}.º${u.area ? ` · Área: ${u.area}` : ""}`,
    `Unidad: ${u.title}`,
    `Contenidos:\n${list(u.contents)}`,
    `Habilidades o criterios del programa:\n${list(u.skills)}`,
    `Material publicado en Edukemonos:\n${material || "(todavía no hay material publicado)"}`,
  ].join("\n\n");
}

/** The cacheable system prompt: identical for every student of the unit. */
export function tutorSystemPrompt(u: TutorUnit, help: HelpResources): string {
  return renderPrompt(tutorSystem, { unitContext: unitContext(u), helpResources: helpResourcesText(help) });
}

export function masterySummary(skills: { name: string; score: number | null }[]): string {
  const known = skills.filter((s) => s.score !== null);
  if (!known.length) return "sin datos todavía.";
  return known.map((s) => `${s.name.slice(0, 80)}: ${Math.round(s.score! * 100)} %`).join("; ");
}

/**
 * Messages for one turn: earlier turns as they were, the new message with the student-specific
 * context in front. History is capped so long sessions stay cheap.
 */
export function tutorMessages(
  history: ChatMessage[],
  studentText: string,
  mastery: string,
  flags: SafetyFlag[],
  maxHistory = 12,
): ChatMessage[] {
  const recent = history.slice(-maxHistory);
  // The API needs the conversation to start with a user turn.
  while (recent.length && recent[0].role !== "user") recent.shift();
  const context = renderPrompt(tutorTurnContext, { mastery, note: safetyNote(flags) ?? "" });
  return [...recent, { role: "user", content: `${context}${studentText}` }];
}

export const WRITING_CATEGORIES = ["tildes", "b_v", "c_s_z", "h", "g_j", "mayusculas", "puntuacion", "concordancia", "cohesion"] as const;

export const writingFeedbackSchema = z.object({
  feedback: z.string().describe("Retroalimentación en Markdown para el estudiante"),
  errors: z.array(z.object({ category: z.enum(WRITING_CATEGORIES), count: z.number().int() })),
});
export type WritingFeedback = z.infer<typeof writingFeedbackSchema>;
