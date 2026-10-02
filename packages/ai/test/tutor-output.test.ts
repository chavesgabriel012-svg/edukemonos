import { describe, expect, it } from "vitest";
import { stripUnverifiedPhones, toTuteo, tutorOutputStream } from "../src/tutor/output";

describe("toTuteo", () => {
  it("rewrites voseo into tuteo, keeping case", () => {
    expect(toTuteo("Podés intentarlo. Fijate bien y contame qué entendés.")).toBe("Puedes intentarlo. Fíjate bien y cuéntame qué entiendes.");
    expect(toTuteo("Lo que sentís es importante, vos importás. Llamá al 911.")).toBe("Lo que sientes es importante, tú importas. Llama al 911.");
    expect(toTuteo("Esto es para vos y quiero hablar con vos acá.")).toBe("Esto es para ti y quiero hablar contigo aquí.");
    expect(toTuteo("Recordá: cuidate y contale a un adulto. Intentalo.")).toBe("Recuerda: cuídate y cuéntale a un adulto. Inténtalo.");
  });

  it("leaves tuteo and ordinary words alone", () => {
    const t = "Tienes razón: calcula 2 × 3 y mira el resultado. Vosotros no, voseo sí.";
    expect(toTuteo(t)).toBe(t);
  });
});

describe("stripUnverifiedPhones", () => {
  it("keeps verified numbers and removes made-up ones", () => {
    expect(stripUnverifiedPhones("Llama al 911 o a la Línea PJN 2519-8700.", ["911"])).toBe("Llama al 911 o a la Línea PJN [número no verificado omitido].");
    expect(stripUnverifiedPhones("Llama al 1147 o al 2222-3333.", ["911", "2222-3333"])).toBe("Llama al 1147 o al 2222-3333.");
  });
});

describe("tutorOutputStream", () => {
  it("fixes forms and numbers split across chunks", () => {
    const s = tutorOutputStream(["911"]);
    const chunks = ["Si ", "que", "rés, habla con v", "os o llama al 25", "19-8700 ", "ya."];
    const out = chunks.map((c) => s.push(c)).join("") + s.flush();
    expect(out).toBe("Si quieres, habla contigo o llama al [número no verificado omitido] ya.");
  });
});
