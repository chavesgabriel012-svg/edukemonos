import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appearsVerbatim, type ExtractedUnit, normalizeForMatch, skillsFromOutcomes, verifyUnits } from "../src";

// Two pages of the official MEP Mathematics program (pp. 276–277, 7.º año, Números) as produced by
// `pdftotext` in its default mode. Kept short and only for testing the verbatim checks.
const raw = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/mat-276-277.json"), "utf8")) as Record<string, string>;
const pages = new Map(Object.entries(raw).map(([k, v]) => [Number(k), v]));

const unit = (over: Partial<ExtractedUnit> = {}): ExtractedUnit => ({
  title: "Números naturales: operaciones",
  area: "Números",
  term: null,
  contents: ["Combinación de operaciones"],
  learning_outcomes: [],
  skills: [
    { code: "1", text: "Calcular expresiones numéricas aplicando el concepto de potencia y la notación exponencial.", page: 276 },
    { code: "2", text: "Resolver una combinación de operaciones que involucre o no el uso de paréntesis.", page: 276 },
  ],
  source_page: 276,
  source_excerpt: "Es necesario retomar los algoritmos que permiten operar con números naturales.",
  ...over,
});

describe("normalizeForMatch", () => {
  it("joins words split across lines and unifies spacing and case", () => {
    expect(normalizeForMatch("Operacio-\nnes  de   SUMA")).toBe("operaciones de suma");
  });
});

describe("verifyUnits against real program pages", () => {
  it("accepts text copied from the program, even when the PDF wraps it across lines", () => {
    expect(appearsVerbatim("Resolver una combinación de operaciones que involucre o no el uso de paréntesis.", pages.get(276)!)).toBe(true);
    expect(verifyUnits([unit()], pages)).toEqual([]);
  });

  it("flags paraphrased skills, invented excerpts and wrong pages", () => {
    const issues = verifyUnits(
      [
        unit({
          skills: [{ code: "1", text: "Resolver ejercicios de potencias con base diez.", page: 276 }],
          source_excerpt: "El estudiante dominará las potencias en una semana.",
          contents: ["Fracciones egipcias"],
        }),
        unit({ source_page: 300 }),
      ],
      pages,
    );
    expect(issues.map((i) => [i.unit, i.field])).toEqual([
      [0, "source_excerpt"],
      [0, "skill"],
      [0, "content"],
      [1, "page"],
    ]);
  });

  it("rejects a term the document does not support", () => {
    expect(verifyUnits([unit({ term: 4 })], pages).map((i) => i.field)).toEqual(["term"]);
  });
});

describe("skillsFromOutcomes", () => {
  const pages = new Map([
    [42, "1. Distinguir el uso de la tilde diacrítica en los monosílabos.\n2. Otro texto."],
    [43, "3. Describir los usos de la “v” y “b”, así como los homófonos más utilizados."],
  ]);
  const unit = {
    title: "Ortografía",
    area: null,
    term: null,
    contents: [],
    learning_outcomes: [
      "Distinguir el uso de la tilde diacrítica en los monosílabos.",
      "Describir los usos de la “v” y “b”, así como los homófonos más utilizados.",
      "Un criterio que no está en el programa.",
    ],
    skills: [],
    source_page: 42,
    source_excerpt: "Distinguir el uso de la tilde",
  };

  it("turns verbatim criteria into skills with the page where each one appears, skipping the rest", () => {
    expect(skillsFromOutcomes(unit, pages)).toEqual([
      { code: null, text: unit.learning_outcomes[0], page: 42 },
      { code: null, text: unit.learning_outcomes[1], page: 43 },
    ]);
  });

  it("keeps the extracted skills when there are any", () => {
    const skills = [{ code: "1", text: "Calcular", page: 42 }];
    expect(skillsFromOutcomes({ ...unit, skills }, pages)).toBe(skills);
  });
});
