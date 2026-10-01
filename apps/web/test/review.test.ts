import { describe, expect, it } from "vitest";
import { diff, pagesToLoad, parseSkills, publishBlockers, recheck } from "../src/lib/review";

const page276 =
  "Habilidades específicas\n1. Calcular expresiones\nnuméricas aplicando el\nconcepto de potencia y la\nnotación exponencial.\n" +
  "Es necesario retomar los algoritmos que permiten operar con\nnúmeros naturales.";

describe("parseSkills", () => {
  it("reads 'código | texto | página' lines with sensible defaults", () => {
    expect(parseSkills("1 | Calcular algo | 276\nSin código\n2 | Otra", 300)).toEqual([
      { code: "1", text: "Calcular algo", page: 276 },
      { code: null, text: "Sin código", page: 300 },
      { code: "2", text: "Otra", page: 300 },
    ]);
  });
});

describe("recheck", () => {
  const base = {
    title: "Potencias",
    area: "Números",
    term: null,
    contents: [],
    learning_outcomes: [],
    source_page: 276,
    source_excerpt: "Es necesario retomar los algoritmos que permiten operar con números naturales.",
    skills: [{ code: "1", text: "Calcular expresiones numéricas aplicando el concepto de potencia y la notación exponencial.", page: 276 }],
  };
  const pages = new Map([[276, page276]]);

  it("passes when the reviewer keeps text from the program", () => {
    expect(recheck(base, pages)).toEqual([]);
  });

  it("flags a reviewer edit that is no longer verbatim, and empty titles", () => {
    const issues = recheck({ ...base, title: "", source_excerpt: "Texto reescrito por el revisor." }, pages);
    expect(issues.map((i) => i.problem)).toEqual(["el extracto no aparece en la página citada", "falta el título"]);
  });
});

describe("helpers", () => {
  it("loads the section range plus cited pages and their next page", () => {
    expect(pagesToLoad({ source_page: 276, extraction_meta: { section: { label: "x", from: 276, to: 277 } } }, [280])).toEqual([276, 277, 280, 281]);
  });

  it("blocks publishing with open issues or no skills", () => {
    expect(publishBlockers({ title: "x", extraction_meta: { issues: [{ field: "skill", value: "", problem: "" }] } }, 0)).toHaveLength(2);
    expect(publishBlockers({ title: "x", extraction_meta: { issues: [] } }, 3)).toEqual([]);
  });

  it("diffs only changed fields", () => {
    expect(diff({ a: 1, b: [1] }, { a: 1, b: [2] })).toEqual({ b: { from: [1], to: [2] } });
  });
});
