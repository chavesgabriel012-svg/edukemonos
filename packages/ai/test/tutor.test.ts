import { describe, expect, it } from "vitest";
import { calculatorTool, masterySummary, tutorMessages, tutorSystemPrompt, type TutorUnit } from "../src/tutor";
import { runTool } from "../src/tools";

const unit: TutorUnit = {
  subject: "Matemáticas",
  grade: 7,
  title: "Potencias",
  area: "Números",
  contents: ["Potencias"],
  skills: ["Calcular expresiones numéricas aplicando el concepto de potencia."],
  material: "### Resumen\nUna potencia es una multiplicación repetida.",
};
const help = { emergency: { name: "Emergencias", phone: "911", description: "Peligro inmediato." }, resources: [], trustedAdultMessage: "Habla con una persona adulta de confianza." };

describe("tutor", () => {
  it("builds the same system prompt for every student of a unit (cacheable), with the unit and help", () => {
    const a = tutorSystemPrompt(unit, help);
    expect(a).toBe(tutorSystemPrompt(unit, help));
    expect(a).toContain("Unidad: Potencias");
    expect(a).toContain("911");
    expect(a).toMatch(/calculadora/);
  });

  it("calculates exactly and in school notation", async () => {
    expect(await runTool(calculatorTool, { expression: "2,5 × 4" })).toEqual({ output: "2,5 × 4 = 10", isError: false });
    expect((await runTool(calculatorTool, { expression: "(5 + 7)^2" })).output).toBe("(5 + 7)^2 = 144");
    expect((await runTool(calculatorTool, { expression: "1/3" })).output).toBe("1/3 = 0,3333333333");
    expect((await runTool(calculatorTool, { expression: "x + 1" })).output).toMatch(/No pude calcular/);
  });

  it("puts the student-specific context only in the new turn and caps history", () => {
    const history = Array.from({ length: 20 }, (_, i) => ({ role: (i % 2 ? "assistant" : "user") as "user" | "assistant", content: `m${i}` }));
    const msgs = tutorMessages(history, "¿Qué es una potencia?", "Calcular…: 40 %", ["personal_data"]);
    expect(msgs.length).toBeLessThanOrEqual(13);
    expect(msgs[0].role).toBe("user");
    const last = msgs.at(-1)!;
    expect(last.content).toContain("40 %");
    expect(last.content).toMatch(/no comparta datos personales/);
    expect(last.content.endsWith("¿Qué es una potencia?")).toBe(true);
    expect(msgs.slice(0, -1).some((m) => m.content.includes("Contexto para el tutor"))).toBe(false);
  });

  it("summarizes mastery without names", () => {
    expect(masterySummary([])).toBe("sin datos todavía.");
    expect(masterySummary([{ name: "Calcular potencias", score: 0.42 }, { name: "Otra", score: null }])).toBe("Calcular potencias: 42 %");
  });
});
