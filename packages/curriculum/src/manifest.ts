import { z } from "zod";

/** Subject ids are catalog data (table `subjects`); this list mirrors the seed for validation. */
export const SUBJECT_IDS = ["espanol", "matematicas", "ciencias", "estudios_sociales", "ingles", "civica"] as const;
export type SubjectId = (typeof SUBJECT_IDS)[number];

export const SOURCE_KINDS = ["program", "spec_table", "practice"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/** Manifest kinds use the Spanish names from the SPEC; DB enum uses English. */
const manifestKind = z.enum(["programa", "tabla_especificaciones", "practica"]);
export const KIND_TO_DB: Record<z.infer<typeof manifestKind>, SourceKind> = {
  programa: "program",
  tabla_especificaciones: "spec_table",
  practica: "practice",
};

/** Inclusive 1-indexed PDF page range; `null` end = not mapped yet. */
const pageRange = z.tuple([z.number().int().positive(), z.number().int().positive().nullable()]);

const gradeRanges = z.object({
  content: z.array(pageRange),
  guidance: z.array(pageRange).optional(),
});

export const sourceEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: manifestKind,
  subject: z.enum(SUBJECT_IDS),
  cycle: z.string(),
  grades: z.array(z.number().int().min(1).max(12)).min(1),
  title: z.string().min(1),
  version: z.string(),
  url: z.url(),
  landingPage: z.url(),
  pdfPages: z.number().int().positive(),
  bytes: z.number().int().positive(),
  textExtractable: z.boolean(),
  gradeRanges: z.record(z.string(), gradeRanges),
  notes: z.string(),
});

export const manifestSchema = z.object({
  $comment: z.string().optional(),
  verifiedAt: z.string(),
  sources: z.array(sourceEntrySchema),
});

export type SourceEntry = z.infer<typeof sourceEntrySchema>;
export type SourceManifest = z.infer<typeof manifestSchema>;

/** Expands the page ranges for one grade (content + guidance), sorted and de-duplicated. */
export function pagesForGrade(entry: SourceEntry, grade: number): number[] {
  const ranges = entry.gradeRanges[String(grade)];
  if (!ranges) return [];
  const pages = new Set<number>();
  for (const [start, end] of [...ranges.content, ...(ranges.guidance ?? [])]) {
    if (end === null) throw new Error(`${entry.id}: page range for grade ${grade} is not fully mapped`);
    if (end < start || end > entry.pdfPages) throw new Error(`${entry.id}: invalid range ${start}-${end}`);
    for (let p = start; p <= end; p++) pages.add(p);
  }
  return [...pages].sort((a, b) => a - b);
}
