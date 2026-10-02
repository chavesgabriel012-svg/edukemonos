import { describe, expect, it } from "vitest";
import { contentLabel, currentMaterials, type ItemRow, itemCheckSummary, type MaterialRow } from "../src/lib/content-review";

const material = (over: Partial<MaterialRow>): MaterialRow => ({
  id: "m",
  kind: "summary",
  content: "…",
  status: "draft",
  reviewer_id: null,
  reviewed_at: null,
  model: null,
  created_at: "2026-10-03T00:00:00Z",
  verification: {},
  ...over,
});

describe("contentLabel", () => {
  it("tells apart automatic publication from a teacher's review", () => {
    expect(contentLabel({ status: "published", reviewer_id: null })).toBe("Generado con IA · pendiente de revisión");
    expect(contentLabel({ status: "published", reviewer_id: "r1" })).toBe("Generado con IA · revisado por docente");
    expect(contentLabel({ status: "draft", reviewer_id: null })).toMatch(/no visible/);
    expect(contentLabel({ status: "rejected", reviewer_id: "r1" })).toBe("Rechazado");
  });
});

describe("currentMaterials", () => {
  it("keeps the newest non-rejected row per kind, in reading order", () => {
    const rows = [
      material({ id: "old", kind: "summary", created_at: "2026-10-01T00:00:00Z" }),
      material({ id: "new", kind: "summary", created_at: "2026-10-02T00:00:00Z" }),
      material({ id: "bad", kind: "summary", created_at: "2026-10-03T00:00:00Z", status: "rejected" }),
      material({ id: "g", kind: "glossary" }),
    ];
    expect(currentMaterials(rows).map((m) => m.id)).toEqual(["new", "g"]);
  });
});

describe("itemCheckSummary", () => {
  const item = (over: Partial<ItemRow>): ItemRow => ({
    id: "i", kind: "single_choice", skill_ids: [], stem: "", options: ["a", "b", "c", "d"], correct_index: 0,
    explanation: "", distractor_explanations: null, difficulty: 3, reading_level: null, verified: false,
    status: "draft", reviewer_id: null, created_at: "", verification: {}, ...over,
  });

  it("explains why an item is or is not verified", () => {
    expect(itemCheckSummary(item({ verified: true, verification: { math: { status: "passed" } } }))).toMatch(/cálculo exacto/);
    expect(itemCheckSummary(item({ verification: { reasons: ["el verificador eligió la opción 3"] } }))).toBe(
      "No verificado: el verificador eligió la opción 3",
    );
    expect(itemCheckSummary(item({ kind: "open_writing", options: null }))).toMatch(/no entra al diagnóstico/);
  });
});
