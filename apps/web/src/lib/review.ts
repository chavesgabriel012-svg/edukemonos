import { type ExtractedUnit, type VerificationIssue, verifyUnits } from "@edukemonos/curriculum";

export type UnitStatus = "draft" | "reviewed" | "published" | "rejected";

export interface UnitRow {
  id: string;
  grade_id: number;
  subject_id: string;
  area: string | null;
  title: string;
  term: number | null;
  learning_outcomes: string[];
  contents: string[];
  source_id: string;
  source_page: number;
  source_excerpt: string;
  status: UnitStatus;
  reviewed_at: string | null;
  sort_order: number;
  extraction_meta: {
    issues?: { field: string; value: string; problem: string }[];
    section?: { label: string; from: number; to: number };
    notes?: string | null;
    model?: string;
    [key: string]: unknown;
  };
}

export interface SkillRow {
  id: string;
  code: string | null;
  name: string;
  sort_order: number;
  source_page: number | null;
}

export interface SkillInput {
  code: string | null;
  text: string;
  page: number;
}

export interface UnitEdit {
  title: string;
  area: string | null;
  term: number | null;
  contents: string[];
  learning_outcomes: string[];
  source_page: number;
  source_excerpt: string;
  skills: SkillInput[];
}

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

/**
 * Skills are edited one per line as "código | texto | página". Code and page are optional;
 * a missing page defaults to the unit's source page.
 */
export function parseSkills(text: string, defaultPage: number): SkillInput[] {
  return lines(text).map((line) => {
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length >= 3 && /^\d+$/.test(parts.at(-1)!)) {
      return { code: parts[0] || null, text: parts.slice(1, -1).join(" | "), page: Number(parts.at(-1)) };
    }
    if (parts.length === 2) return { code: parts[0] || null, text: parts[1], page: defaultPage };
    return { code: null, text: line, page: defaultPage };
  });
}

export function formatSkills(skills: SkillRow[], fallback: number): string {
  return skills.map((s) => `${s.code ?? ""} | ${s.name} | ${s.source_page ?? fallback}`).join("\n");
}

export function parseUnitForm(form: FormData): UnitEdit {
  const sourcePage = Number(form.get("source_page"));
  const termRaw = String(form.get("term") ?? "");
  return {
    title: String(form.get("title") ?? "").trim(),
    area: String(form.get("area") ?? "").trim() || null,
    term: termRaw === "" ? null : Number(termRaw),
    contents: lines(form.get("contents")),
    learning_outcomes: lines(form.get("learning_outcomes")),
    source_page: sourcePage,
    source_excerpt: String(form.get("source_excerpt") ?? "").trim(),
    skills: parseSkills(String(form.get("skills") ?? ""), sourcePage),
  };
}

/** Re-runs the same verbatim checks as the ingest pipeline on the reviewer's edited version. */
export function recheck(edit: UnitEdit, pages: Map<number, string>): VerificationIssue[] {
  const unit: ExtractedUnit = {
    title: edit.title,
    area: edit.area,
    term: edit.term,
    contents: edit.contents,
    learning_outcomes: edit.learning_outcomes,
    skills: edit.skills.map((s) => ({ code: s.code, text: s.text, page: s.page })),
    source_page: edit.source_page,
    source_excerpt: edit.source_excerpt,
  };
  const issues = verifyUnits([unit], pages);
  if (!edit.title) issues.push({ unit: 0, field: "page", value: "", problem: "falta el título" });
  if (edit.source_excerpt.length > 400) {
    issues.push({ unit: 0, field: "source_excerpt", value: edit.source_excerpt.slice(0, 80), problem: "extracto de más de 400 caracteres" });
  }
  return issues;
}

/** Pages needed to verify a unit: its section range when known, plus every page it cites (and the next one). */
export function pagesToLoad(unit: Pick<UnitRow, "source_page" | "extraction_meta">, skillPages: number[]): number[] {
  const set = new Set<number>();
  const s = unit.extraction_meta.section;
  if (s) for (let p = s.from; p <= s.to; p++) set.add(p);
  for (const p of [unit.source_page, ...skillPages]) {
    set.add(p);
    set.add(p + 1);
  }
  return [...set].sort((a, b) => a - b);
}

/** Field-level diff for the review log. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changes[key] = { from: before[key], to: after[key] };
  }
  return changes;
}

export function publishBlockers(unit: Pick<UnitRow, "extraction_meta" | "title">, skillCount: number): string[] {
  const blockers: string[] = [];
  const issues = unit.extraction_meta.issues ?? [];
  if (issues.length) blockers.push(`${issues.length} problema(s) de verificación sin resolver`);
  if (skillCount === 0) blockers.push("la unidad no tiene habilidades");
  return blockers;
}

export const STATUS_LABEL: Record<UnitStatus, string> = {
  draft: "Borrador",
  reviewed: "Revisada",
  published: "Publicada",
  rejected: "Rechazada",
};
