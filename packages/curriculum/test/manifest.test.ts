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

  it("covers the 6 programs, 6 spec tables and 18 practices of III Ciclo", () => {
    const byKind = (k: string) => manifest.sources.filter((s) => s.kind === k).length;
    expect([byKind("programa"), byKind("tabla_especificaciones"), byKind("practica")]).toEqual([6, 6, 18]);
  });

  it("only points at official MEP domains", () => {
    for (const s of manifest.sources) {
      expect(new URL(s.url).hostname).toMatch(/(^|\.)mep\.go\.cr$/);
    }
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
