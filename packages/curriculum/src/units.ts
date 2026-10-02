import { z } from "zod";
import { findOnPage, appearsVerbatim } from "./text";

/**
 * What the structuring model must return for one chunk of a study program. Every string that
 * claims to come from the document is checked verbatim afterwards (see `verifyUnits`).
 * Kept to plain types (no length constraints) so it works with providers' structured outputs.
 */
export const extractedSkillSchema = z.object({
  code: z.string().nullable().describe("Número de la habilidad tal como aparece en el documento (p. ej. \"1\"), o null"),
  text: z.string().describe("Texto de la habilidad copiado tal cual del documento"),
  page: z.number().int().describe("Página del PDF donde aparece la habilidad"),
});

export const extractedUnitSchema = z.object({
  title: z.string().describe("Título corto de la unidad, tomado de los conocimientos del documento"),
  area: z.string().nullable().describe("Área o eje del documento (p. ej. \"Números\"), o null si no hay"),
  term: z.number().int().nullable().describe("Trimestre 1, 2 o 3 SOLO si el documento lo indica para esta unidad; si no, null"),
  contents: z.array(z.string()).describe("Conocimientos o contenidos copiados tal cual del documento"),
  learning_outcomes: z.array(z.string()).describe("Resultados de aprendizaje o criterios de evaluación copiados tal cual; vacío si no hay"),
  skills: z.array(extractedSkillSchema),
  source_page: z.number().int().describe("Página del PDF donde empieza la unidad"),
  source_excerpt: z.string().describe("Una o dos oraciones copiadas tal cual de source_page que respaldan la unidad"),
});

export const extractionSchema = z.object({
  units: z.array(extractedUnitSchema),
  notes: z.string().describe("Problemas encontrados (texto ilegible, tablas cortadas, etc.); vacío si ninguno"),
});

export type ExtractedUnit = z.infer<typeof extractedUnitSchema>;
export type Extraction = z.infer<typeof extractionSchema>;

export interface VerificationIssue {
  unit: number;
  field: "source_excerpt" | "skill" | "content" | "learning_outcome" | "page" | "term";
  value: string;
  problem: string;
}

/**
 * Checks an extraction against the page texts it came from. Nothing is invented if every check
 * passes; anything that fails is reported so a reviewer sees it before publishing.
 */
export function verifyUnits(units: ExtractedUnit[], pages: Map<number, string>): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const all = [...pages.values()].join("\n");
  units.forEach((u, i) => {
    if (!pages.has(u.source_page)) {
      issues.push({ unit: i, field: "page", value: String(u.source_page), problem: "página fuera del rango enviado" });
    } else if (findOnPage(u.source_excerpt, pages, u.source_page) === null) {
      issues.push({ unit: i, field: "source_excerpt", value: u.source_excerpt, problem: "el extracto no aparece en la página citada" });
    }
    if (u.term !== null && ![1, 2, 3].includes(u.term)) {
      issues.push({ unit: i, field: "term", value: String(u.term), problem: "trimestre inválido" });
    }
    for (const s of u.skills) {
      if (findOnPage(s.text, pages, s.page) === null) {
        issues.push({ unit: i, field: "skill", value: s.text, problem: `la habilidad no aparece en la página ${s.page}` });
      }
    }
    for (const c of u.contents) {
      if (!appearsVerbatim(c, all)) issues.push({ unit: i, field: "content", value: c, problem: "el contenido no aparece en el texto enviado" });
    }
    for (const o of u.learning_outcomes) {
      if (!appearsVerbatim(o, all)) issues.push({ unit: i, field: "learning_outcome", value: o, problem: "el resultado no aparece en el texto enviado" });
    }
  });
  return issues;
}

/**
 * Some programs (Español 2017) have no "habilidades específicas" column: what is assessed are the
 * "criterios de evaluación", which the extraction stores as learning outcomes. For those units each
 * outcome becomes a skill, with the page where it appears verbatim. Outcomes that cannot be found
 * on any page are skipped, so nothing unverifiable becomes a skill.
 */
export function skillsFromOutcomes(unit: ExtractedUnit, pages: Map<number, string>): ExtractedUnit["skills"] {
  if (unit.skills.length > 0) return unit.skills;
  const order = [unit.source_page, ...[...pages.keys()].filter((p) => p !== unit.source_page).sort((a, b) => a - b)];
  return unit.learning_outcomes.flatMap((text) => {
    // Prefer the page that holds the whole criterion; fall back to one where it starts and continues.
    const page =
      order.find((p) => appearsVerbatim(text, pages.get(p) ?? "")) ?? order.find((p) => findOnPage(text, pages, p) !== null);
    return page === undefined ? [] : [{ code: null, text, page }];
  });
}
