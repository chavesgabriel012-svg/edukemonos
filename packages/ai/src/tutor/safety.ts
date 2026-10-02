/**
 * Input safety for the tutor (SPEC §4.5, §4.6, §10). Runs before anything reaches the model.
 *
 * - Personal data (phones, emails, cédulas, addresses) is replaced by a placeholder: the model
 *   never sees it and it is never stored.
 * - Signs of serious distress or risk are flagged: the tutor gets an instruction to respond with
 *   care and point to a trusted adult, and the app shows the help resources.
 *
 * Keyword lists are deliberately broad (a false alarm only shows a help card) and are checked
 * against accent-free, lower-case text.
 */

export type SafetyFlag = "personal_data" | "distress" | "abuse";

export interface ScreenedInput {
  /** Text to send to the model and store. */
  text: string;
  flags: SafetyFlag[];
}

const PLACEHOLDER = "[dato personal omitido]";

const PERSONAL_DATA: RegExp[] = [
  /[\w.+-]+@[\w-]+(\.[\w-]+)+/g, // email
  /\b\d\s?-?\s?\d{4}\s?-?\s?\d{4}\b/g, // cédula 1-2345-6789
  /(\+?506[\s-]?)?\b[2-8]\d{3}[\s-]?\d{4}\b/g, // Costa Rican phone 8888-8888
  /\b(vivo|mi casa (es|esta|queda)|mi direccion es)\b[^.!?\n]{0,80}/gi, // "vivo en ..." / address
  /\b(me llamo|mi nombre es)\s+\p{L}+(\s+\p{Lu}\p{L}+){0,3}/giu, // "me llamo Valeria Jiménez"
  /\b[Ss]oy\s+\p{Lu}\p{L}+(\s+\p{Lu}\p{L}+){1,3}/gu, // "soy Andrés Mora" (two capitalised words)
  /\b(estudio en|voy a|mi colegio es)\s+(el |la |al )?(liceo|colegio|escuela|ctp|instituto|unidad pedag)[^.,!?\n]{0,60}/giu, // school
];

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const DISTRESS = [
  "me quiero morir", "quiero morir", "quiero morirme", "no quiero vivir", "matarme", "me voy a matar", "suicid",
  "quitarme la vida", "hacerme dano", "me hago dano", "cortarme", "me corto", "autolesion", "no aguanto mas",
  "no vale la pena vivir", "mejor desaparecer", "nadie me quiere", "soy un estorbo", "soy una carga",
  "no tengo ganas de nada", "me siento muy solo", "me siento muy sola", "me siento vacio", "me siento vacia",
];
const ABUSE: RegExp[] = [
  /\b(me|nos) (pega|pegan|golpea|golpean|maltrata|maltratan|amenaza|amenazan)\b/,
  /\b(me|nos) (toca|tocan) sin\b/,
  /\babus(a|an|o)\b/,
  /tengo miedo de (volver|ir) a (mi )?casa/,
  /\b(me|nos) hacen (bullying|acoso)\b/,
];

export function screenStudentMessage(raw: string): ScreenedInput {
  const flags = new Set<SafetyFlag>();
  let text = raw.slice(0, 2_000);
  for (const pattern of PERSONAL_DATA) {
    text = text.replace(pattern, () => {
      flags.add("personal_data");
      return PLACEHOLDER;
    });
  }
  const folded = fold(raw);
  if (DISTRESS.some((k) => folded.includes(k))) flags.add("distress");
  if (ABUSE.some((k) => k.test(folded))) flags.add("abuse");
  return { text, flags: [...flags] };
}

/** One-turn instruction appended for the model when the message was flagged. */
export function safetyNote(flags: SafetyFlag[]): string | null {
  const notes: string[] = [];
  if (flags.includes("distress") || flags.includes("abuse")) {
    notes.push(
      "El mensaje del estudiante muestra posibles señales de malestar serio o de riesgo. Deja de lado el tema escolar: " +
        "responde con calidez y calma, sin juzgar ni hacer preguntas invasivas, valida lo que siente y anímale a hablar hoy " +
        "con una persona adulta de confianza (familia, docente u orientación del colegio). Si hay peligro inmediato, " +
        "menciona el 911. No des consejos médicos ni legales. La aplicación le mostrará los recursos de ayuda.",
    );
  }
  if (flags.includes("personal_data")) {
    notes.push("El estudiante incluyó datos personales que fueron omitidos. Recuérdale con amabilidad que no comparta datos personales aquí.");
  }
  return notes.length ? notes.join("\n") : null;
}
