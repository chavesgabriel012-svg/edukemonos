import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { manifestSchema, pagesForGrade } from "../src";

const manifest = manifestSchema.parse(
  JSON.parse(readFileSync(join(import.meta.dirname, "../../../scripts/ingest/sources.json"), "utf8")),
);

describe("sources.json", () => {
  it("is valid and has unique ids", () => {
    const ids = manifest.sources.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contains exactly the 6 III Ciclo study programs and nothing else", () => {
    expect(manifest.sources.every((s) => s.kind === "programa")).toBe(true);
    expect(manifest.sources.map((s) => s.subject).sort()).toEqual(
      ["ciencias", "civica", "espanol", "estudios_sociales", "ingles", "matematicas"],
    );
  });

  it("rejects sources outside www.mep.go.cr (e.g. Educación Abierta)", () => {
    const dgec = { ...manifest.sources[0], url: "https://dgec.mep.go.cr/wp-content/uploads/x.pdf" };
    expect(() => manifestSchema.parse({ ...manifest, sources: [dgec] })).toThrow(/www\.mep\.go\.cr/);
    const practice = { ...manifest.sources[0], kind: "practica" };
    expect(() => manifestSchema.parse({ ...manifest, sources: [practice] })).toThrow();
  });

  it("maps Matemáticas 7.º to the III Ciclo section of the program", () => {
    const math = manifest.sources.find((s) => s.id === "mep-prog-matematicas")!;
    const pages = pagesForGrade(math, 7);
    expect(pages[0]).toBe(276);
    expect(pages.every((p) => p >= 273 && p <= 382)).toBe(true);
  });

  it("refuses to expand ranges that are not fully mapped yet", () => {
    const ciencias = manifest.sources.find((s) => s.id === "mep-prog-ciencias")!;
    expect(() => pagesForGrade(ciencias, 9)).toThrow(/not fully mapped/);
  });
});
