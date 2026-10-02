import { z } from "zod";

/** Subject ids are catalog data (table `subjects`); this list mirrors the seed for validation. */
export const SUBJECT_IDS = ["espanol", "matematicas", "ciencias", "estudios_sociales", "ingles", "civica"] as const;
export type SubjectId = (typeof SUBJECT_IDS)[number];

/**
 * Only official study programs (formal education) are curriculum sources. Educación Abierta
 * (DGEC) specification tables and practice tests were dropped by the founder on 2026-10-01.
 */
export const SOURCE_KINDS = ["program"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/** Manifest kinds use the Spanish names from the SPEC; DB enum uses English. */
const manifestKind = z.enum(["programa"]);
export const KIND_TO_DB: Record<z.infer<typeof manifestKind>, SourceKind> = {
  programa: "program",
};

/** The only host curriculum documents may come from. */
export const OFFICIAL_SOURCE_HOST = "www.mep.go.cr";

/** Inclusive 1-indexed PDF page range; `null` end = not mapped yet. */
const pageRange = z.tuple([z.number().int().positive(), z.number().int().positive().nullable()]);

const gradeRanges = z
  .object({
    content: z.array(pageRange),
    guidance: z.array(pageRange).optional(),
    /** Optional section name for each `content` range (e.g. the Mathematics areas). */
    labels: z.array(z.string()).optional(),
  })
  .refine((r) => !r.labels || r.labels.length === r.content.length, {
    message: "labels must have one entry per content range",
  });

/** One contiguous block of pages to process together, with its section label. */
export interface PageChunk {
  label: string;
  /** The program's own name for the section (e.g. "Números"); null when the label is just a page range. */
  area: string | null;
  from: number;
  to: number;
}

/** Content ranges for a grade as labelled chunks. Throws if a range is not fully mapped. */
export function chunksForGrade(entry: SourceEntry, grade: number): PageChunk[] {
  const ranges = entry.gradeRanges[String(grade)];
  if (!ranges) throw new Error(`${entry.id}: no page ranges for grade ${grade}`);
  return ranges.content.map(([from, to], i) => {
    if (to === null) throw new Error(`${entry.id}: page range for grade ${grade} is not fully mapped`);
    if (to < from || to > entry.pdfPages) throw new Error(`${entry.id}: invalid range ${from}-${to}`);
    const area = ranges.labels?.[i] ?? null;
    return { label: area ?? `Páginas ${from}–${to}`, area, from, to };
  });
}

export const sourceEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: manifestKind,
  subject: z.enum(SUBJECT_IDS),
  cycle: z.string(),
  grades: z.array(z.number().int().min(1).max(12)).min(1),
  title: z.string().min(1),
  version: z.string(),
  url: z.url().refine((u) => new URL(u).hostname === OFFICIAL_SOURCE_HOST, {
    message: `sources must be hosted on ${OFFICIAL_SOURCE_HOST}`,
  }),
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
