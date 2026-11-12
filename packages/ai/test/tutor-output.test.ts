import { describe, expect, it } from "vitest";
import { assumedGenderWords, filterTutorOutput, normalizeLetters, stripMetaNotes, stripUnverifiedPhones, toNeutral, toTuteo, tutorOutputStream } from "../src/tutor/output";

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
  it("holds the longest phrases until they can be rewritten", () => {
    const words = "Cuando te sientas un poco más tranquilo, recuerda que no tienes que cargar con todo esto sola. Resuelve solo la parte que falta.".split(/(?<= )/);
    const s = tutorOutputStream([]);
    const out = words.map((w) => s.push(w)).join("") + s.flush();
    expect(out).toBe("Cuando sientas un poco más de calma, recuerda que no tienes que cargar con todo esto sin apoyo. Resuelve solo la parte que falta.");
  });
});

describe("normalizeLetters", () => {
  it("turns lookalike Cyrillic and Greek letters inside Latin words into Latin ones", () => {
    // mat-12 (Sonnet 5.5, 2026-11-02): «segurо» with a Cyrillic «о» (U+043E).
    expect(normalizeLetters("segurо")).toBe("seguro");
    expect(normalizeLetters("саsa y mοmento")).toBe("casa y momento");
  });
  it("leaves words fully written in another script alone", () => {
    expect(normalizeLetters("Привет, hola")).toBe("Привет, hola");
  });
  it("lets the gender filter see the word", () => {
    expect(filterTutorOutput("Dime qué piensas, aunque no estés seguro o segurо de la respuesta.", [])).toBe(
      "Dime qué piensas, aunque no tengas certeza de la respuesta.",
    );
  });
});

describe("toNeutral, forms from the 2026-11-02 runs", () => {
  const cases: [string, string, string][] = [
    ["tranquilo (vocative)", "Tranquilo, no hace falta que compartas tu dirección.", "Con calma, no hace falta que compartas tu dirección."],
    ["tranquila (vocative)", "Hola. ¡Tranquila! Vamos paso a paso.", "Hola. ¡Con calma! Vamos paso a paso."],
    ["tranquilo/a", "Cuando te sientas un poco más tranquilo/a, seguimos.", "Cuando sientas un poco más de calma, seguimos."],
    ["frustrado", "Es normal que te sientas frustrado con la materia.", "Es normal que sientas frustración con la materia."],
    ["frustrado/a", "Entiendo que estés frustrado/a; es normal sentirse frustrado o frustrada.", "Entiendo que sientas frustración; es normal sentir frustración."],
    ["nervioso/a", "Si estás nervioso/a antes del examen, respira.", "Si sientes nervios antes del examen, respira."],
    ["nerviosa", "Es normal que te sientas muy nerviosa.", "Es normal que sientas muchos nervios."],
    ["preocupado/a", "Si estás preocupado/a por la nota, hablemos.", "Si sientes preocupación por la nota, hablemos."],
    ["preocupada", "Entiendo que te sientas preocupada.", "Entiendo que sientas preocupación."],
    ["seguro/a", "Revísalo otra vez para estar seguro/a de que da lo mismo.", "Revísalo otra vez para tener certeza de que da lo mismo."],
    ["obligado/a", "No estás obligado a cargar esto solo.", "No tienes que cargar esto sin apoyo."],
    ["obligado/a doubled", "No te sientas obligada o obligado a contarlo todo.", "No sientas que debes contarlo todo."],
    ["preparado/a", "Repasemos para que llegues preparado al examen.", "Repasemos para que llegues con buena preparación al examen."],
    ["preparada", "¿Ya estás preparada para el siguiente paso?", "¿Ya tienes todo a punto para el siguiente paso?"],
    ["interesado/a", "Si estás interesado en derivadas, pregúntale a tu docente.", "Si tienes interés en derivadas, pregúntale a tu docente."],
    ["respetado/a", "Mereces sentirte respetado y a salvo en tu colegio.", "Mereces sentirte a salvo y con respeto en tu colegio."],
    ["respetada", "Mereces sentirte respetada.", "Mereces recibir respeto."],
    ["atascado/a", "Cuando llevas rato atascado, descansa un poco.", "Cuando llevas rato sin avanzar, descansa un poco."],
    ["atascada", "Si te sientes atascada, dime.", "Si sientes que no avanzas, dime."],
    ["solo (estás)", "No estás solo en esto.", "No estás sin apoyo en esto."],
    ["solo/a (estás)", "Recuerda que no estás solo/a y que hay personas que te quieren.", "Recuerda que no estás sin apoyo y que hay personas que te quieren."],
    ["solo (cargar)", "No tienes que cargar con esto solo.", "No tienes que cargar con esto sin apoyo."],
    ["sola (enfrentar)", "Es importante que no enfrentes la amenaza sola.", "Es importante que no enfrentes la amenaza sin apoyo."],
    ["sola (quedarse)", "Que no te quedes sola con ese dolor.", "Que no te quedes sin apoyo con ese dolor."],
    ["sola (estás)", "No estás sola; hay personas que quieren apoyarte.", "No estás sin apoyo; hay personas que quieren apoyarte."],
    ["solo (hazlo)", "Ahora hazlo solo.", "Ahora hazlo por tu cuenta."],
  ];
  it.each(cases)("%s", (_form, input, expected) => {
    expect(toNeutral(input)).toBe(expected);
  });
});

describe("toNeutral leaves uses that are not about the student alone", () => {
  it.each([
    "Muy bien, solo falta un paso.",
    "Resuelve solo la parte que se multiplica.",
    "Cuando retomes, empecemos por una sola potencia.",
    "Vamos a un ritmo tranquilo, con pausas.",
    "El texto no dice que la persona está nerviosa.",
    "¿Crees que Ana está feliz, preocupada o algo más?",
    "Seguro que lo logras; es lo mismo que antes.",
    "Estás solo a un paso de la respuesta.",
    "Hazlo solo con la calculadora.",
    "El material preparado para la unidad está abajo.",
    "Es un tema interesante: el número está atascado entre 3 y 4.",
  ])("%s", (text) => {
    expect(toNeutral(text)).toBe(text);
  });
});

describe("assumedGenderWords, third person and lookalikes", () => {
  it("does not flag a gendered word about someone else", () => {
    expect(assumedGenderWords("El texto no dice que la persona está nerviosa. ¿Qué pistas ves?", "")).toEqual([]);
    expect(assumedGenderWords("¿Crees que Ana está feliz, preocupada o algo más?", "")).toEqual([]);
  });
  it("still flags the student's own", () => {
    expect(assumedGenderWords("Entiendo que estés nerviosa.", "")).toEqual(["nerviosa"]);
  });
  it("sees words with lookalike letters", () => {
    expect(assumedGenderWords("aunque no estés segurо", "")).toEqual(["estés seguro"]);
  });
});

describe("toNeutral, forms from the second round of 2026-11-02 (prompt v11)", () => {
  const cases: [string, string, string][] = [
    ["No, tranquilo (mat-19)", "No, tranquilo. No necesito tu correo.", "No, con calma. No necesito tu correo."],
    ["Oye, tranquila", "Oye, tranquila, vamos paso a paso.", "Oye, con calma, vamos paso a paso."],
    ["no te preocupes, tranquilo", "No te preocupes, tranquilo. Lo vemos de nuevo.", "No te preocupes, con calma. Lo vemos de nuevo."],
    ["cargarlo solo (mat-20)", "No tienes que cargarlo solo.", "No tienes que cargarlo sin apoyo."],
    ["cargarla sola", "No deberías cargarla sola, habla con alguien.", "No deberías cargarla sin apoyo, habla con alguien."],
    ["resolverlo tú solo (esp-22)", "No tienes que resolverlo tú solo.", "No tienes que resolverlo por tu cuenta."],
    ["enfrentarlo tú sola", "No tienes que enfrentarlo tú sola ni callarlo.", "No tienes que enfrentarlo sin apoyo ni callarlo."],
    ["tú solo", "¿Lo hiciste tú solo?", "¿Lo hiciste por tu cuenta?"],
    ["tú solo/a", "Inténtalo tú solo/a y me cuentas.", "Inténtalo por tu cuenta y me cuentas."],
    ["acompañado (mat-20)", "Quiero que te sientas acompañado.", "Quiero que tengas compañía."],
    ["acompañada", "Mereces sentirte acompañada.", "Mereces tener compañía."],
    ["cansado (mat-31)", "Es normal sentirse cansado después de tanto estudiar.", "Es normal sentir cansancio después de tanto estudiar."],
    ["cansada", "Si estás muy cansada, descansa un rato.", "Si sientes mucho cansancio, descansa un rato."],
    ["molesto (mat-29)", "Entiendo que estés molesto con la tarea.", "Entiendo que sientas molestia con la tarea."],
    ["confundido/a", "Es normal que te sientas confundido/a al principio.", "Es normal que sientas confusión al principio."],
    ["agobiada", "Si te sientes agobiada, respira.", "Si sientes agobio, respira."],
    ["estresado", "Veo que estás un poco estresado.", "Veo que sientes algo de estrés."],
    ["desanimada", "No quiero que te sientas desanimada.", "No quiero que sientas desánimo."],
    ["asustado", "Es normal estar asustado antes de un examen.", "Es normal sentir miedo antes de un examen."],
  ];
  it.each(cases)("%s", (_form, input, expected) => {
    expect(toNeutral(input)).toBe(expected);
  });

  it.each([
    "Tú solo tienes que sumar los exponentes.",
    "Busca un lugar tranquilo para estudiar.",
    "Ese ruido es molesto, pero sigamos.",
    "El signo va acompañado de un número.",
    "Puedes usarlo solo cuando la base es la misma.",
    "No, tranquilo no es un sustantivo: es un adjetivo.",
  ])("leaves alone: %s", (text) => {
    expect(toNeutral(text)).toBe(text);
  });
});

describe("stripMetaNotes", () => {
  it("removes the model's notes about its own rules", () => {
    // mat-19 and esp-19 (Haiku 5.5 low, prompt v11).
    expect(filterTutorOutput("No, tranquilo... perdón, sin género. No necesito tu correo.", [])).toBe("No, con calma. No necesito tu correo.");
    expect(stripMetaNotes("Gracias por contármelo (evito género). Lo que sientes importa.")).toBe("Gracias por contármelo. Lo que sientes importa.");
    expect(stripMetaNotes("No, con calma... perdón, sin nombres ni datos personales. Sigamos.")).toBe("No, con calma. Sigamos.");
  });
  it("leaves ordinary parentheses and apologies alone", () => {
    const t = "El género (masculino o femenino) del sustantivo decide el artículo. Perdón, me equivoqué en el paso 2 (era 3 + 8).";
    expect(stripMetaNotes(t)).toBe(t);
  });
  it("works across stream chunks", () => {
    const s = tutorOutputStream([]);
    const out = "No, tranquilo... perdón, sin género. No necesito tu correo ni tu dirección para guardar tu avance.".split(/(?<= )/).map((w) => s.push(w)).join("") + s.flush();
    expect(out).toBe("No, con calma. No necesito tu correo ni tu dirección para guardar tu avance.");
  });
});

describe("assumedGenderWords, adjectives of a noun", () => {
  it("does not flag a gendered word that describes a thing or someone else", () => {
    // mat-24 failed twice on this false positive.
    expect(assumedGenderWords("Busca un lugar tranquilo y respira.", "")).toEqual([]);
    expect(assumedGenderWords("¿Cómo ayudarías a una persona muy cansada?", "")).toEqual([]);
  });
  it("still flags the student's own", () => {
    expect(assumedGenderWords("Busca un lugar tranquilo. Tranquilo, lo vemos de nuevo.", "")).toEqual(["tranquilo"]);
  });
});
