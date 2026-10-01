/** Generated material and items as reviewers see them (Phase 2). */

export type ContentStatus = "draft" | "published" | "rejected";
export type MaterialKind = "summary" | "explanation" | "worked_examples" | "glossary";

export interface MaterialRow {
  id: string;
  kind: MaterialKind;
  content: string;
  status: ContentStatus;
  reviewer_id: string | null;
  reviewed_at: string | null;
  model: string | null;
  created_at: string;
  verification: {
    ok?: boolean;
    problems?: { material: string; severity: "error" | "sugerencia"; quote: string; explanation: string }[];
    edited_by_reviewer?: boolean;
  };
}

export interface ItemRow {
  id: string;
  kind: "single_choice" | "open_writing";
  skill_ids: string[];
  stem: string;
  options: string[] | null;
  correct_index: number | null;
  explanation: string | null;
  distractor_explanations: string[] | null;
  difficulty: number;
  reading_level: "literal" | "inferencial" | "critica" | null;
  verified: boolean;
  status: ContentStatus;
  reviewer_id: string | null;
  created_at: string;
  verification: {
    reasons?: string[];
    structural?: string[];
    math?: { status: "passed" | "failed" | "not_applicable"; computed?: number | null; detail?: string };
    solver?: { chosen_index: number | null; agrees: boolean; problems: string } | null;
  };
}

export const MATERIAL_LABEL: Record<MaterialKind, string> = {
  summary: "Resumen",
  explanation: "Explicación paso a paso",
  worked_examples: "Ejemplos resueltos",
  glossary: "Glosario",
};
export const MATERIAL_ORDER: MaterialKind[] = ["summary", "explanation", "worked_examples", "glossary"];

export const READING_LABEL = { literal: "Literal", inferencial: "Inferencial", critica: "Crítica" } as const;

/**
 * The label students and reviewers see (SPEC §4.4). Published content without a reviewer passed
 * the automatic checks only; a reviewer's approval is what makes it "revisado".
 */
export function contentLabel(row: { status: ContentStatus; reviewer_id: string | null }): string {
  if (row.status === "rejected") return "Rechazado";
  if (row.status === "draft") return "Borrador · no visible para estudiantes";
  return row.reviewer_id ? "Generado con IA · revisado por docente" : "Generado con IA · pendiente de revisión";
}

/** The newest row of each material kind (regenerations add rows; reviewers act on the current one). */
export function currentMaterials(rows: MaterialRow[]): MaterialRow[] {
  const byKind = new Map<MaterialKind, MaterialRow>();
  for (const row of [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    if (row.status !== "rejected" && !byKind.has(row.kind)) byKind.set(row.kind, row);
  }
  return MATERIAL_ORDER.flatMap((k) => (byKind.has(k) ? [byKind.get(k)!] : []));
}

/** Why an item is (not) usable, in one line for the reviewer. */
export function itemCheckSummary(item: ItemRow): string {
  if (item.kind === "open_writing") {
    const s = item.verification.structural ?? [];
    return s.length ? `Problemas: ${s.join("; ")}` : "Consigna de escritura (no entra al diagnóstico)";
  }
  if (item.verified) {
    return item.verification.math?.status === "passed"
      ? "Verificado: el verificador y el cálculo exacto coinciden con la clave"
      : "Verificado: el verificador coincide con la clave";
  }
  const reasons = item.verification.reasons ?? [];
  return reasons.length ? `No verificado: ${reasons.join("; ")}` : "No verificado";
}

export interface ContentCounts {
  materialsPublished: number;
  materialsDraft: number;
  itemsPublished: number;
  itemsVerified: number;
  itemsDraft: number;
}

export function contentCounts(materials: MaterialRow[], items: ItemRow[]): ContentCounts {
  return {
    materialsPublished: materials.filter((m) => m.status === "published").length,
    materialsDraft: materials.filter((m) => m.status === "draft").length,
    itemsPublished: items.filter((i) => i.status === "published").length,
    itemsVerified: items.filter((i) => i.verified).length,
    itemsDraft: items.filter((i) => i.status === "draft").length,
  };
}
