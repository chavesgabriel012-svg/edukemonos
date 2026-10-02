import { z } from "zod";

/** The four study materials of a unit (SPEC §8), each one Markdown. */
export const MATERIAL_KINDS = ["summary", "explanation", "worked_examples", "glossary"] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export const generatedMaterialsSchema = z.object({
  summary: z.string().describe("Resumen en Markdown"),
  explanation: z.string().describe("Explicación paso a paso en Markdown"),
  worked_examples: z.string().describe("Ejemplos resueltos en Markdown"),
  glossary: z.string().describe("Glosario en Markdown"),
  notes: z.string().describe("Limitaciones o dudas sobre la unidad; vacío si ninguna"),
});
export type GeneratedMaterials = z.infer<typeof generatedMaterialsSchema>;

/** A material rewritten to fix the problems the independent review found. */
export const repairedMaterialSchema = z.object({
  content: z.string().describe("El material completo, corregido, en Markdown"),
  notes: z.string().describe("Qué cambiaste; vacío si nada"),
});
export type RepairedMaterial = z.infer<typeof repairedMaterialSchema>;

/** Independent review of the materials. An "error" keeps that material from students. */
export const materialReviewSchema = z.object({
  problems: z.array(
    z.object({
      material: z.enum(MATERIAL_KINDS),
      severity: z.enum(["error", "sugerencia"]).describe("error: conceptual, de cálculo, fuera de la unidad o del grado; sugerencia: mejora menor"),
      quote: z.string().describe("Fragmento textual del material donde está el problema"),
      explanation: z.string().describe("Qué está mal y cómo corregirlo"),
    }),
  ),
});
export type MaterialReview = z.infer<typeof materialReviewSchema>;

export interface MaterialCheck {
  ok: boolean;
  problems: MaterialReview["problems"];
}

/** Shape checks plus the reviewer's errors for one material. */
export function checkMaterial(kind: MaterialKind, content: string, review: MaterialReview | null): MaterialCheck {
  const problems = (review?.problems ?? []).filter((p) => p.material === kind);
  const local: MaterialReview["problems"] = [];
  if (content.trim().length < 80) {
    local.push({ material: kind, severity: "error", quote: content.slice(0, 80), explanation: "el material está vacío o es demasiado corto" });
  }
  if (/\\\(|\\\[|\$\$|\\frac|\\sqrt/.test(content)) {
    local.push({ material: kind, severity: "error", quote: content.match(/\\\(|\\\[|\$\$|\\frac|\\sqrt/)![0], explanation: "usa LaTeX, que la app no muestra; debe usar notación escolar" });
  }
  const all = [...local, ...problems];
  return { ok: review !== null && !all.some((p) => p.severity === "error"), problems: all };
}
