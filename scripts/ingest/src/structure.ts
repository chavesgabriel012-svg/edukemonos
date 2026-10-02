import { writeFileSync } from "node:fs";
import type { AI } from "@edukemonos/ai";
import { renderPrompt, structureCurriculumSystem, structureCurriculumUser } from "@edukemonos/ai/prompts";
import {
  chunksForGrade,
  type ExtractedUnit,
  extractionSchema,
  type PageChunk,
  type SourceEntry,
  type VerificationIssue,
  verifyUnits,
} from "@edukemonos/curriculum";
import { ensureDir, paths } from "./cache";
import { pageMap, type PageTexts } from "./extract";

/** Display names used inside prompts. Mirrors supabase/seed.sql. */
export const SUBJECT_NAMES: Record<string, string> = {
  espanol: "Español",
  matematicas: "Matemáticas",
  ciencias: "Ciencias",
  estudios_sociales: "Estudios Sociales",
  ingles: "Inglés",
  civica: "Educación Cívica",
};
export const GRADE_NAMES: Record<number, string> = { 7: "Sétimo año", 8: "Octavo año", 9: "Noveno año" };

/** Excerpts are short quotes with attribution, not copies of the document. */
export const MAX_EXCERPT_CHARS = 400;

export interface ChunkResult {
  chunk: PageChunk;
  model: string;
  units: ExtractedUnit[];
  issues: VerificationIssue[];
  notes: string;
}

export interface GradeExtraction {
  sourceId: string;
  grade: number;
  pdfSha256: string;
  extractedWith: string;
  prompt: { system: string; user: string };
  createdAt: string;
  chunks: ChunkResult[];
}

export function formatPages(pages: Map<number, string>): string {
  return [...pages].map(([n, t]) => `=== PÁGINA ${n} ===\n${t.trim()}`).join("\n\n");
}

/** Extra checks on top of the verbatim ones. */
function policyIssues(units: ExtractedUnit[]): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  units.forEach((u, i) => {
    if (u.source_excerpt.length > MAX_EXCERPT_CHARS) {
      issues.push({ unit: i, field: "source_excerpt", value: u.source_excerpt.slice(0, 80), problem: `extracto de más de ${MAX_EXCERPT_CHARS} caracteres` });
    }
    if (u.skills.length === 0 && u.contents.length === 0 && u.learning_outcomes.length === 0) {
      issues.push({ unit: i, field: "skill", value: u.title, problem: "unidad sin habilidades, contenidos ni resultados" });
    }
  });
  return issues;
}

/**
 * Extracts draft units for one grade of one program, chunk by chunk (one AI call each), and
 * verifies every quoted string against the page text. Nothing here is published: the output
 * is a draft for /revisar.
 */
export async function structureGrade(
  ai: AI,
  entry: SourceEntry,
  grade: number,
  texts: PageTexts,
  { onChunk }: { onChunk?: (r: ChunkResult) => void } = {},
): Promise<GradeExtraction> {
  const result: GradeExtraction = {
    sourceId: entry.id,
    grade,
    pdfSha256: texts.sha256,
    extractedWith: texts.extractedWith,
    prompt: {
      system: `${structureCurriculumSystem.id}@${structureCurriculumSystem.version}`,
      user: `${structureCurriculumUser.id}@${structureCurriculumUser.version}`,
    },
    createdAt: new Date().toISOString(),
    chunks: [],
  };
  const system = renderPrompt(structureCurriculumSystem, {});
  for (const chunk of chunksForGrade(entry, grade)) {
    const pages = pageMap(texts, chunk.from, chunk.to);
    const user = renderPrompt(structureCurriculumUser, {
      subject: SUBJECT_NAMES[entry.subject] ?? entry.subject,
      grade: GRADE_NAMES[grade] ?? `${grade}.º`,
      documentTitle: entry.title,
      documentVersion: entry.version,
      section: chunk.label,
      pagesText: formatPages(pages),
    });
    const { data, model } = await ai.generateStructured(
      { role: "bulk", purpose: "structure_curriculum" },
      { system, messages: [{ role: "user", content: user }], schema: extractionSchema, schemaName: "curriculum_units", maxTokens: 16_000 },
    );
    // Only a real section name becomes the area; "Páginas 70–100" is not one.
    const units = data.units.map((u) => ({ ...u, area: u.area ?? chunk.area }));
    const chunkResult: ChunkResult = {
      chunk,
      model,
      units,
      issues: [...verifyUnits(units, pages), ...policyIssues(units)],
      notes: data.notes,
    };
    result.chunks.push(chunkResult);
    onChunk?.(chunkResult);
  }
  writeFileSync(ensureDir(paths.extraction(entry.id, grade)), JSON.stringify(result, null, 2));
  return result;
}
