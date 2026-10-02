import { readFileSync } from "node:fs";
import { KIND_TO_DB, skillsFromOutcomes, type SourceEntry } from "@edukemonos/curriculum";
import { paths } from "./cache";
import type { Db } from "./db";
import type { DownloadMeta } from "./download";
import { pageMap, type PageTexts } from "./extract";
import type { GradeExtraction } from "./structure";

export const BUCKET = "curriculum-sources";

/** Registers the source (with hash and download date) and uploads the PDF to the private bucket. */
export async function upsertSource(db: Db, entry: SourceEntry, meta: DownloadMeta): Promise<string> {
  const storagePath = `${entry.id}.pdf`;
  await db.upload(BUCKET, storagePath, readFileSync(paths.pdf(entry.id)), "application/pdf");
  const [row] = await db.insert<{ id: string }>(
    "curriculum_sources",
    [
      {
        source_key: entry.id,
        kind: KIND_TO_DB[entry.kind],
        subject_id: entry.subject,
        cycle_id: entry.cycle,
        title: entry.title,
        version: entry.version,
        url: entry.url,
        storage_path: storagePath,
        sha256: meta.sha256,
        bytes: meta.bytes,
        pdf_pages: entry.pdfPages,
        downloaded_at: meta.downloadedAt,
      },
    ],
    { upsertOn: "source_key" },
  );
  return row.id;
}

/** Stores the page texts of the given ranges (reviewers see them next to each unit). */
export async function upsertPages(db: Db, sourceId: string, texts: PageTexts, pages: number[]): Promise<void> {
  const rows = pages
    .filter((p) => texts.pages[String(p)] !== undefined)
    .map((p) => ({ source_id: sourceId, page: p, text: texts.pages[String(p)], extracted_with: texts.extractedWith }));
  for (let i = 0; i < rows.length; i += 100) {
    await db.insert("curriculum_pages", rows.slice(i, i + 100), { upsertOn: "source_id,page", returning: false });
  }
}

export interface LoadSummary {
  deletedDrafts: number;
  units: number;
  skills: number;
  unitsWithIssues: number;
}

/**
 * Loads an extraction as DRAFT units. Idempotent: previous drafts of the same source and grade
 * are replaced; units a person already reviewed or published are never touched, and if any
 * exist the load stops so they are not duplicated (unless `allowAlongsideReviewed`).
 */
export async function loadExtraction(
  db: Db,
  entry: SourceEntry,
  sourceDbId: string,
  extraction: GradeExtraction,
  {
    runId,
    allowAlongsideReviewed = false,
    texts,
  }: { runId: string; allowAlongsideReviewed?: boolean; texts?: PageTexts },
): Promise<LoadSummary> {
  const reviewed = await db.select<{ id: string }>(
    "curriculum_units",
    `select=id&source_id=eq.${sourceDbId}&grade_id=eq.${extraction.grade}&status=neq.draft&limit=1`,
  );
  if (reviewed.length && !allowAlongsideReviewed) {
    throw new Error(
      `There are already reviewed/published units for ${entry.id} grade ${extraction.grade}; ` +
        "re-run with --alongside-reviewed to add new drafts next to them.",
    );
  }
  const deletedDrafts = await db.delete(
    "curriculum_units",
    `source_id=eq.${sourceDbId}&grade_id=eq.${extraction.grade}&status=eq.draft`,
  );

  let order = 0;
  let skills = 0;
  let unitsWithIssues = 0;
  let units = 0;
  for (const chunk of extraction.chunks) {
    const pages = texts ? pageMap(texts, chunk.chunk.from, chunk.chunk.to) : null;
    for (const [i, u] of chunk.units.entries()) {
      // Programs without a skills column: their evaluation criteria are the skills.
      const unitSkills = pages ? skillsFromOutcomes(u, pages) : u.skills;
      const derived = unitSkills !== u.skills;
      const issues = chunk.issues.filter((x) => x.unit === i);
      if (issues.length) unitsWithIssues++;
      const [row] = await db.insert<{ id: string }>("curriculum_units", [
        {
          cycle_id: entry.cycle,
          grade_id: extraction.grade,
          subject_id: entry.subject,
          area: u.area,
          title: u.title,
          term: u.term,
          learning_outcomes: u.learning_outcomes,
          contents: u.contents,
          source_id: sourceDbId,
          source_page: u.source_page,
          source_excerpt: u.source_excerpt,
          status: "draft",
          sort_order: order++,
          extraction_meta: {
            run_id: runId,
            model: chunk.model,
            prompt: extraction.prompt,
            extracted_with: extraction.extractedWith,
            pdf_sha256: extraction.pdfSha256,
            section: chunk.chunk,
            notes: chunk.notes || null,
            issues: issues.map(({ field, value, problem }) => ({ field, value, problem })),
          },
        },
      ]);
      units++;
      const skillRows = unitSkills.map((s, k) => ({
        unit_id: row.id,
        subject_id: entry.subject,
        grade_id: extraction.grade,
        code: s.code,
        name: s.text,
        description: derived ? "Criterio de evaluación del programa (el programa no trae habilidades específicas)" : null,
        source_page: s.page,
        sort_order: k,
      }));
      await db.insert("skills", skillRows, { returning: false });
      skills += skillRows.length;
    }
  }
  return { deletedDrafts, units, skills, unitsWithIssues };
}

export interface PublishUnitsSummary {
  published: number;
  held: { title: string; reason: string }[];
}

/**
 * Publishes the draft units of a source and grade that a reviewer would not be blocked on: no
 * open verification issue and at least one skill (same rules as /revisar). Used when the founder
 * authorizes publishing without a per-unit review. reviewed_by stays null, so it is visible that
 * no person reviewed them one by one.
 */
export async function publishDraftUnits(db: Db, sourceDbId: string, grade: number): Promise<PublishUnitsSummary> {
  const drafts = await db.select<{ id: string; title: string; extraction_meta: { issues?: unknown[] }; skills: { count: number }[] }>(
    "curriculum_units",
    `select=id,title,extraction_meta,skills(count)&source_id=eq.${sourceDbId}&grade_id=eq.${grade}&status=eq.draft`,
  );
  const held: PublishUnitsSummary["held"] = [];
  const ok: string[] = [];
  for (const u of drafts) {
    const issues = u.extraction_meta.issues?.length ?? 0;
    if (issues) held.push({ title: u.title, reason: `${issues} problema(s) de verificación` });
    else if ((u.skills[0]?.count ?? 0) === 0) held.push({ title: u.title, reason: "sin habilidades" });
    else ok.push(u.id);
  }
  const published = ok.length
    ? await db.update("curriculum_units", `id=in.(${ok.join(",")})&status=eq.draft`, { status: "published", reviewed_at: new Date().toISOString() })
    : 0;
  return { published, held };
}

export function readExtraction(sourceId: string, grade: number): GradeExtraction {
  return JSON.parse(readFileSync(paths.extraction(sourceId, grade), "utf8")) as GradeExtraction;
}
