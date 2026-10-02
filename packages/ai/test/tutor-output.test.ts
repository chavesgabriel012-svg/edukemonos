import { describe, expect, it } from "vitest";
import { assumedGenderWords, stripUnverifiedPhones, toNeutral, toTuteo, tutorOutputStream } from "../src/tutor/output";

describe("toTuteo", () => {
  it("reads «sos una IA» from the tutor as «soy», not as voseo", () => {
    expect(toTuteo("Sos una IA y no puedo acompañarte en persona. Vos sos valiente.")).toBe("Soy una IA y no puedo acompañarte en persona. Tú eres valiente.");
  });
  it("rewrites the brand manual's example", () => {
    expect(toTuteo("Pensalo en una recta numérica: miralo con calma.")).toBe("Piénsalo en una recta numérica: míralo con calma.");
  });
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

describe("assumedGenderWords", () => {
  it("flags gendered words the student did not use first", () => {
    expect(assumedGenderWords("Tranquilo, ya llevas la mitad.", "ya me cansé")).toEqual(["tranquilo"]);
  });
  it("allows the form the student used for themselves", () => {
    expect(assumedGenderWords("Entiendo que estés cansada.", "Estoy cansada de esto")).toEqual([]);
  });
  it("flags gendered phrases about the student, not lookalikes", () => {
    expect(assumedGenderWords("Aunque no estés seguro, inténtalo tú mismo.", "")).toEqual(["estés seguro", "tú mismo"]);
    expect(assumedGenderWords("Seguro que lo logras; es lo mismo que antes.", "")).toEqual([]);
  });
  it("accepts doubled forms and the noun «la bienvenida»", () => {
    expect(assumedGenderWords("Hola, te doy la bienvenida. ¿Estás cansado o cansada? Hazlo tú mismo/a.", "")).toEqual([]);
  });
  it("ignores nouns and adverbs that only look gendered", () => {
    expect(assumedGenderWords("Tu lista está completa; solo falta el 36. Así tendrás el ensayo listo.", "")).toEqual([]);
  });
});

describe("toNeutral", () => {
  it("rewrites the common gendered phrases about the student", () => {
    expect(toNeutral("Aunque no estés seguro, inténtalo tú mismo.")).toBe("Aunque no tengas certeza, inténtalo por tu cuenta.");
    expect(toNeutral("Si no estás segura, confía en ti misma. Mereces sentirte seguro.")).toBe(
      "Si no tienes certeza, confía en ti. Mereces sentirte a salvo.",
    );
    expect(toNeutral("¡Bienvenida! Bienvenido a la unidad.")).toBe("¡Te doy la bienvenida! Te doy la bienvenida a la unidad.");
    expect(toNeutral("Muy bien. ¿Listo? Ahora el siguiente.")).toBe("Muy bien. ¿Seguimos? Ahora el siguiente.");
  });
  it("rewrites a doubled form whole", () => {
    expect(toNeutral("aunque no estés seguro o segura de la respuesta")).toBe("aunque no tengas certeza de la respuesta");
    expect(toNeutral("Hazlo tú mismo/a.")).toBe("Hazlo por tu cuenta.");
  });
  it("leaves lookalikes alone", () => {
    expect(toNeutral("Seguro que lo logras; es lo mismo que antes.")).toBe("Seguro que lo logras; es lo mismo que antes.");
  });
  it("works across stream chunks", () => {
    const s = tutorOutputStream([]);
    const out = ["Aunque no ", "estés ", "seg", "uro, hazlo ", "tú ", "mis", "mo."].map((d) => s.push(d)).join("") + s.flush();
    expect(out).toBe("Aunque no tengas certeza, hazlo por tu cuenta.");
    const t = tutorOutputStream([]);
    const doubled = ["Dime, aunque ", "no estés ", "seguro ", "o ", "segura ", "de la respuesta."].map((d) => t.push(d)).join("") + t.flush();
    expect(doubled).toBe("Dime, aunque no tengas certeza de la respuesta.");
  });
});
