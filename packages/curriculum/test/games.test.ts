import { describe, expect, it } from "vitest";
import { checkErrorSteps, checkNumericPairs, gameIssues, type GeneratedGame, gradeGame, shuffleOf, splitGame, verifyGame } from "../src/games";

const base = { skill_index: 0, instruction: "Une cada término con su definición.", pairs: null, steps: null, stem: null, options: null, answer_index: null, correction: null, calc: null, explanation: "Porque sí." };
const pairs: GeneratedGame = { ...base, mechanic: "pairs", pairs: [
  { left: "Número primo", right: "Solo tiene dos divisores" }, { left: "Múltiplo", right: "Resultado de multiplicar por un entero" },
  { left: "Divisor", right: "Divide exacto a otro número" }, { left: "Número compuesto", right: "Tiene más de dos divisores" },
] };
const order: GeneratedGame = { ...base, mechanic: "order", instruction: "Ordena los pasos.", steps: ["Paréntesis", "Potencias", "Multiplicaciones y divisiones", "Sumas y restas"] };
const fill: GeneratedGame = { ...base, mechanic: "fill", instruction: "Completa.", stem: "El MCD de 24 y 36 es ___.", options: ["6", "12", "18", "72"], answer_index: 1, calc: "gcd(24, 36)" };
const findError: GeneratedGame = { ...base, mechanic: "find_error", instruction: "Encuentra el error.", steps: ["2 + 3 × 4 = 2 + 12", "2 + 12 = 15", "15 = 15"], answer_index: 1, correction: "2 + 12 = 14" };

describe("shuffleOf", () => {
  it("is deterministic, a permutation and never the identity", () => {
    expect(shuffleOf(5, "a")).toEqual(shuffleOf(5, "a"));
    expect([...shuffleOf(5, "a")].sort()).toEqual([0, 1, 2, 3, 4]);
    for (const seed of ["a", "b", "c", "d", "e", "f"]) expect(shuffleOf(4, seed)).not.toEqual([0, 1, 2, 3]);
  });
});

describe("splitGame and gradeGame", () => {
  it("pairs: the shown right column is shuffled and match points to the right shown position", () => {
    const { pub, answer } = splitGame(pairs, "seed");
    if (pub.mechanic !== "pairs" || answer.mechanic !== "pairs") throw new Error("shape");
    pub.left.forEach((l, i) => expect(pub.right[answer.match[i]]).toBe(pairs.pairs!.find((p) => p.left === l)!.right));
    expect(gradeGame(answer, answer.match)).toBe(true);
    expect(gradeGame(answer, [...answer.match].reverse())).toBe(false);
  });
  it("order: shown steps are shuffled; the answer rebuilds the correct order", () => {
    const { pub, answer } = splitGame(order, "seed");
    if (pub.mechanic !== "order" || answer.mechanic !== "order") throw new Error("shape");
    expect(answer.order.map((k) => pub.steps[k])).toEqual(order.steps);
    expect(pub.steps).not.toEqual(order.steps);
    expect(gradeGame(answer, answer.order)).toBe(true);
    expect(gradeGame(answer, [0, 1, 2])).toBe(false);
  });
  it("fill and find_error are graded by index; the public part has no answer", () => {
    const f = splitGame(fill, "s");
    expect(JSON.stringify(f.pub)).not.toContain("answer");
    expect(gradeGame(f.answer, 1)).toBe(true);
    expect(gradeGame(splitGame(findError, "s").answer, 0)).toBe(false);
  });
});

describe("gameIssues", () => {
  it("accepts well-formed pieces and rejects broken ones", () => {
    for (const g of [pairs, order, fill, findError]) expect(gameIssues(g, 1)).toEqual([]);
    expect(gameIssues({ ...pairs, pairs: pairs.pairs!.slice(0, 3) }, 1)).toContain("pairs necesita de 4 a 6 parejas");
    expect(gameIssues({ ...fill, stem: "Sin espacio" }, 1)).toContain("fill necesita un enunciado con «___»");
    expect(gameIssues({ ...findError, answer_index: 7 }, 1)).toContain("find_error sin paso con error válido");
    expect(gameIssues({ ...order, skill_index: 3 }, 1)).toContain("skill_index fuera de rango");
  });
});

describe("school notation in the math checks", () => {
  it("does not compare steps whose parts carry different units", () => {
    const steps = ["2 Mm = 2 × 10⁶ m = 2 000 000 m", "7 ms = 7 × 10⁻³ s = 0,007 s", "4 µg = 4 × 10⁻⁹ g = 0,000000004 g", "5 = 2 + 3"];
    expect(checkErrorSteps(steps, 2).status).toBe("passed");
  });
  it("reads a superscript minus and fractions around ÷", () => {
    expect(checkErrorSteps(["10⁻³ = 0,001", "3 − 1/2 ÷ 1/4 = 1", "2 × 3 = 5"], 2).status).toBe("passed");
  });
  it("accepts a root rounded to the places shown, and nothing looser", () => {
    expect(checkNumericPairs([{ left: "√26", right: "5" }, { left: "√50", right: "7" }, { left: "√99", right: "10" }]).status).toBe("passed");
    expect(checkNumericPairs([{ left: "√10", right: "3,16" }, { left: "3√2", right: "4,24" }]).status).toBe("passed");
    expect(checkNumericPairs([{ left: "√10", right: "3,1" }, { left: "3√2", right: "4,24" }]).status).toBe("failed");
    expect(checkNumericPairs([{ left: "1/3", right: "0" }, { left: "2", right: "2" }]).status).toBe("failed");
  });
});

describe("checkErrorSteps", () => {
  it("evaluates numeric steps: the marked step must be the only false one", () => {
    expect(checkErrorSteps(findError.steps!, 1)).toEqual({ status: "passed" });
    expect(checkErrorSteps(findError.steps!, 0).status).toBe("failed");
    expect(checkErrorSteps(["x + 2 = 5", "x = 3"], 0)).toEqual({ status: "not_applicable" });
  });
});

describe("verifyGame", () => {
  it("is verified when the solver agrees and mathjs agrees", () => {
    const seed = "unit:0";
    const { answer } = splitGame(order, seed);
    if (answer.mechanic !== "order") throw new Error("shape");
    const v = verifyGame(order, 1, seed, { game: 1, match: null, order: answer.order.map((x) => x + 1), choice: null, problems: "" });
    expect(v).toMatchObject({ verified: true, reasons: [] });
    expect(verifyGame(fill, 1, seed, { game: 1, match: null, order: null, choice: 1, problems: "" }).verified).toBe(true);
    expect(verifyGame(findError, 1, seed, { game: 1, match: null, order: null, choice: 2, problems: "" }).verified).toBe(true);
  });
  it("is not verified when the solver disagrees, reports problems, or the calculation fails", () => {
    expect(verifyGame(fill, 1, "s", { game: 1, match: null, order: null, choice: 0, problems: "" }).reasons).toContain("el verificador dio otra respuesta");
    expect(verifyGame(fill, 1, "s", { game: 1, match: null, order: null, choice: 1, problems: "Ambiguo" }).verified).toBe(false);
    expect(verifyGame({ ...fill, calc: "gcd(24, 30)" }, 1, "s", { game: 1, match: null, order: null, choice: 1, problems: "" }).reasons[0]).toMatch(/^cálculo/);
    expect(verifyGame(fill, 1, "s", undefined).reasons).toContain("el verificador no resolvió esta pieza");
  });
});

describe("math checks for chained steps, superscripts and numeric pairs", () => {
  it("evaluates chains and superscripts beyond ² and ³", () => {
    expect(checkErrorSteps(["2³ = 2 × 2 × 2 = 8", "3⁴ = 3 × 4 = 12", "10³ = 1000"], 1)).toEqual({ status: "passed" });
    expect(checkErrorSteps(["2⁵ = 32", "3⁴ = 81"], 0).status).toBe("failed");
  });
  it("checks pairs of operations and results", () => {
    expect(checkNumericPairs([{ left: "8 + 2 × 3", right: "14" }, { left: "(8 + 2) × 3", right: "30" }, { left: "2 + 3²", right: "11" }, { left: "(2 + 3)²", right: "25" }])).toEqual({ status: "passed" });
    expect(checkNumericPairs([{ left: "8 + 2 × 3", right: "30" }, { left: "(8 + 2) × 3", right: "14" }, { left: "1", right: "1" }, { left: "2", right: "2" }]).status).toBe("failed");
    expect(checkNumericPairs([{ left: "Primo", right: "Dos divisores" }, { left: "1", right: "1" }, { left: "2", right: "2" }, { left: "3", right: "3" }]).status).toBe("not_applicable");
  });
});
