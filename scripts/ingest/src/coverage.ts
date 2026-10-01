import { chunksForGrade, type SourceEntry } from "@edukemonos/curriculum";
import type { GradeExtraction } from "./structure";

export interface Coverage {
  pages: number[];
  covered: number[];
  uncovered: number[];
}

/**
 * Which pages of the grade's content ranges have at least one unit or skill pointing at them.
 * Uncovered pages are not necessarily gaps (some are only examples or guidance), but each one
 * should be checked by a reviewer. This replaces a coverage check against external tables.
 */
export function pageCoverage(entry: SourceEntry, extraction: GradeExtraction): Coverage {
  const pages = chunksForGrade(entry, extraction.grade).flatMap((c) =>
    Array.from({ length: c.to - c.from + 1 }, (_, i) => c.from + i),
  );
  const cited = new Set<number>();
  for (const chunk of extraction.chunks) {
    for (const u of chunk.units) {
      cited.add(u.source_page);
      for (const s of u.skills) cited.add(s.page);
    }
  }
  return {
    pages,
    covered: pages.filter((p) => cited.has(p)),
    uncovered: pages.filter((p) => !cited.has(p)),
  };
}
