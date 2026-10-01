import { describe, expect, it } from "vitest";
import {
  checkCalculation,
  evaluateCalc,
  type GeneratedChoiceItem,
  itemTarget,
  normalizeItem,
  optionValue,
  structuralIssues,
  verifyItem,
  writingIssues,
} from "../src/items";

const item = (over: Partial<GeneratedChoiceItem> = {}): GeneratedChoiceItem => ({
  skill_index: 0,
  difficulty: 3,
  reading_level: null,
  stem: "¿Cuánto es (5 + 7)²?",
  options: ["144", "74", "24", "49"],
  correct_index: 0,
  explanation: "Primero se suma 5 + 7 = 12 y luego 12 × 12 = 144.",
  distractor_explanations: ["", "Se elevó solo el 7.", "Se multiplicó por 2 en vez de elevar.", "Se elevó solo el 7 al cuadrado."],
  calc: { expression: "(5 + 7)^2" },
  ...over,
});

describe("optionValue", () => {
  it.each([
    ["144", 144],
    ["−12", -12],
    ["2,5", 2.5],
    ["3/4", 0.75],
    ["-3/4", -0.75],
    ["12 cm²", 12],
    ["x = 5", 5],
    ["25 %", 25],
    ["1 000", 1000],
    ["5²", 25],
    ["√16", 4],
    ["2 × 3", 6],
    ["₡3 400", 3400],
    ["2 450 colones", 2450],
  ])("reads %s as %d", (text, value) => {
    expect(optionValue(text)).toBeCloseTo(value);
  });

  it.each(["Un triángulo isósceles", "2x + 3", "a y b", ""])("returns null for %j", (text) => {
    expect(optionValue(text)).toBeNull();
  });
});

describe("evaluateCalc", () => {
  it("computes school expressions", () => {
    expect(evaluateCalc("(5 + 7)^2")).toBe(144);
    expect(evaluateCalc("2,5 × 4")).toBe(10);
    expect(evaluateCalc("sqrt(81) - 3")).toBe(6);
  });

  it("refuses anything that is not a finite number or tries to escape the sandbox", () => {
    expect(evaluateCalc("1/0")).toBeNull();
    expect(evaluateCalc("x + 1")).toBeNull();
    expect(evaluateCalc('import({a: 1})')).toBeNull();
    expect(evaluateCalc('evaluate("1+1")')).toBeNull();
    expect(evaluateCalc("[1, 2]")).toBeNull();
  });
});

describe("checkCalculation", () => {
  it("passes only when the keyed option alone has the computed value", () => {
    expect(checkCalculation(item()).status).toBe("passed");
  });

  it("fails when the key points at another option", () => {
    const r = checkCalculation(item({ correct_index: 1 }));
    expect(r.status).toBe("failed");
    expect(r.detail).toMatch(/opción 1/);
  });

  it("fails when two options have the computed value", () => {
    expect(checkCalculation(item({ options: ["144", "144,0", "24", "49"] })).status).toBe("failed");
  });

  it("fails when no option has the computed value (a wrong key the model believed in)", () => {
    expect(checkCalculation(item({ calc: { expression: "5 + 7^2" } })).status).toBe("failed");
  });

  it("is not applicable to conceptual items", () => {
    expect(checkCalculation(item({ calc: null })).status).toBe("not_applicable");
  });
});

describe("structuralIssues", () => {
  it("accepts a well-formed item", () => {
    expect(structuralIssues(item(), 1)).toEqual([]);
  });

  it("rejects wrong option counts, duplicates, banned options and bad indexes", () => {
    expect(structuralIssues(item({ options: ["1", "2", "3"], distractor_explanations: ["", "a", "b"] }), 1)).toContain(
      "tiene 3 opciones en vez de 4",
    );
    expect(structuralIssues(item({ options: ["144", " 144 ", "24", "49"] }), 1)).toContain("hay opciones repetidas");
    expect(structuralIssues(item({ options: ["144", "74", "24", "Ninguna de las anteriores"] }), 1)).toContain(
      "usa «todas/ninguna de las anteriores»",
    );
    expect(structuralIssues(item({ correct_index: 4 }), 1)).toContain("índice de respuesta fuera de 0–3");
    expect(structuralIssues(item({ skill_index: 2 }), 2)).toContain("habilidad inexistente");
    expect(structuralIssues(item({ difficulty: 0 }), 1)).toContain("dificultad fuera de 1–5");
    expect(structuralIssues(item({ distractor_explanations: ["", "", "x", "y"] }), 1)).toContain("falta explicar algún distractor");
  });
});

describe("verifyItem", () => {
  const solved = (chosen_index: number | null, problems = "") => ({ item: 1, chosen_index, problems });

  it("verifies when structure, solver and calculation agree", () => {
    const v = verifyItem(item(), 1, solved(0));
    expect(v.verified).toBe(true);
    expect(v.reasons).toEqual([]);
  });

  it("does not verify when the independent solver disagrees", () => {
    const v = verifyItem(item({ calc: null }), 1, solved(2));
    expect(v.verified).toBe(false);
    expect(v.reasons).toContain("el verificador eligió la opción 3");
  });

  it("does not verify when the solver flags a problem, even if it agrees", () => {
    expect(verifyItem(item(), 1, solved(0, "dos opciones podrían ser correctas")).verified).toBe(false);
  });

  it("does not verify without a solver answer", () => {
    expect(verifyItem(item(), 1, undefined).verified).toBe(false);
  });

  it("does not verify when the calculation contradicts both the key and the solver", () => {
    const v = verifyItem(item({ calc: { expression: "5 + 7^2" } }), 1, solved(0));
    expect(v.verified).toBe(false);
    expect(v.math.status).toBe("failed");
  });

  it("requires a calculation for numeric math answers when asked to", () => {
    const v = verifyItem(item({ calc: null }), 1, solved(0), { requireCalcForNumericAnswers: true });
    expect(v.reasons).toContain("respuesta numérica sin expresión de cálculo");
    const conceptual = item({
      calc: null,
      options: ["Agudo", "Recto", "Obtuso", "Llano"],
      distractor_explanations: ["Mide menos de 90°.", "", "Mide más de 90°.", "Mide 180°."],
      stem: "¿Qué ángulo mide 90°?",
      correct_index: 1,
    });
    expect(verifyItem(conceptual, 1, solved(1), { requireCalcForNumericAnswers: true }).verified).toBe(true);
  });
});

describe("writingIssues and itemTarget", () => {
  it("checks writing prompts", () => {
    expect(writingIssues({ skill_index: 0, difficulty: 3, prompt: "Escribe…", criteria: ["Usa conectores"] }, 1)).toEqual([]);
    expect(writingIssues({ skill_index: 0, difficulty: 3, prompt: "", criteria: [] }, 1)).toEqual([
      "consigna vacía",
      "sin criterios de retroalimentación",
    ]);
  });

  it("asks for about three items per skill, between 6 and 12", () => {
    expect(itemTarget(1)).toBe(6);
    expect(itemTarget(3)).toBe(9);
    expect(itemTarget(8)).toBe(12);
  });
});

describe("normalizeItem", () => {
  it("inserts the missing empty explanation at the key when there are three for four options", () => {
    const fixed = normalizeItem(item({ correct_index: 1, distractor_explanations: ["a", "b", "c"] }));
    expect(fixed.distractor_explanations).toEqual(["a", "", "b", "c"]);
    expect(structuralIssues({ ...fixed, options: ["10", "144", "24", "49"] }, 1)).toEqual([]);
  });

  it("leaves anything else untouched", () => {
    const odd = item({ distractor_explanations: ["a", "b"] });
    expect(normalizeItem(odd)).toBe(odd);
  });
});
