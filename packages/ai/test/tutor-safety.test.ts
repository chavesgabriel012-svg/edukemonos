import { describe, expect, it } from "vitest";
import { safetyNote, screenStudentMessage } from "../src/tutor/safety";

describe("screenStudentMessage", () => {
  it("removes personal data before it can reach the model", () => {
    const r = screenStudentMessage("Mi correo es ana.mora@gmail.com y mi cel 8888-1234, cédula 1-2345-6789. Vivo en San Pedro del lado del parque.");
    expect(r.text).not.toMatch(/gmail|8888|2345|San Pedro/);
    expect(r.text.match(/\[dato personal omitido\]/g)?.length).toBeGreaterThanOrEqual(4);
    expect(r.flags).toEqual(["personal_data"]);
  });

  it("leaves schoolwork alone, numbers included", () => {
    const r = screenStudentMessage("¿Cuánto es 2345 + 1234? En la recta numérica, ¿dónde está −3? Vivimos experiencias en el cuento.");
    expect(r.flags).toEqual([]);
    expect(r.text).toContain("2345 + 1234");
  });

  it("flags distress and abuse regardless of accents and case", () => {
    expect(screenStudentMessage("ya no aguanto MÁS, a veces quiero morirme").flags).toContain("distress");
    expect(screenStudentMessage("mi papá me pega cuando saco malas notas").flags).toContain("abuse");
    expect(screenStudentMessage("El personaje del cuento se quería morir de risa").flags).toEqual([]);
  });

  it("gives the model a care instruction only when needed", () => {
    expect(safetyNote([])).toBeNull();
    expect(safetyNote(["distress"])).toMatch(/adulta de confianza/);
    expect(safetyNote(["personal_data"])).toMatch(/no comparta datos personales/);
  });
});
