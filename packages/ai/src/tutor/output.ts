/**
 * Deterministic output filter for the tutor. The model is told to use tuteo and never to give
 * phone numbers outside the verified help list, but evals showed it still drifts into voseo and
 * once made up a help-line number. Neither may reach a student, so both are fixed here, in code.
 */

// Voseo forms that are unambiguous in a tutor's reply → tuteo. Lower-case keys; case is restored.
const VOSEO: Record<string, string> = {
  tenés: "tienes", podés: "puedes", querés: "quieres", sabés: "sabes", sentís: "sientes", decís: "dices",
  entendés: "entiendes", pensás: "piensas", hacés: "haces", sos: "eres", contás: "cuentas", necesitás: "necesitas",
  creés: "crees", usás: "usas", escribís: "escribes", leés: "lees", venís: "vienes", seguís: "sigues",
  preferís: "prefieres", tratás: "tratas", buscás: "buscas", llegás: "llegas", mirás: "miras", hablás: "hablas",
  conocés: "conoces", recordás: "recuerdas", merecés: "mereces", importás: "importas",
  calculá: "calcula", mirá: "mira", fijate: "fíjate", fijáte: "fíjate", pensá: "piensa", intentá: "intenta",
  contame: "cuéntame", decime: "dime", hablá: "habla", llamá: "llama", leé: "lee", probá: "prueba",
  acordate: "acuérdate", tomá: "toma", vení: "ven", esperá: "espera", revisá: "revisa", respirá: "respira",
  buscá: "busca", preguntá: "pregunta", contá: "cuenta", escuchá: "escucha", tratá: "trata", animate: "anímate",
  pasame: "pásame", explicame: "explícame", mostrame: "muéstrame", avisame: "avísame", escribime: "escríbeme",
  recordá: "recuerda", cuidate: "cuídate", sentate: "siéntate", calmate: "cálmate", tranquilizate: "tranquilízate",
  dejá: "deja", hacé: "haz", poné: "pon", decí: "di", tené: "ten", andá: "ve", fijá: "fija", agregá: "agrega",
  completá: "completa", compará: "compara", elegí: "elige", sumá: "suma", restá: "resta", multiplicá: "multiplica",
  dividí: "divide", subrayá: "subraya", corregí: "corrige", leelo: "léelo", contale: "cuéntale", hablale: "háblale",
  decile: "dile", pedile: "pídele", buscalo: "búscalo", probalo: "pruébalo", intentalo: "inténtalo", hacelo: "hazlo",
  acá: "aquí", allá: "allí",
};
const PRONOUN_AFTER_PREPOSITION: Record<string, string> = { para: "ti", a: "ti", de: "ti", por: "ti", en: "ti", sin: "ti" };

function matchCase(source: string, target: string): string {
  if (source === source.toUpperCase() && source.length > 1) return target.toUpperCase();
  return source[0] === source[0].toUpperCase() ? target[0].toUpperCase() + target.slice(1) : target;
}

/** Rewrites voseo into tuteo on whole words. */
export function toTuteo(text: string): string {
  return text
    .replace(/\bcon vos\b/gi, (m) => matchCase(m, "contigo"))
    .replace(/\b(para|a|de|por|en|sin) vos\b/gi, (m, prep: string) => `${prep} ${PRONOUN_AFTER_PREPOSITION[prep.toLowerCase()]}`)
    .replace(/(?<![\p{L}])vos(?![\p{L}])/giu, (m) => matchCase(m, "tú"))
    .replace(/(?<![\p{L}])[\p{L}]+(?![\p{L}])/gu, (word) => {
      const t = VOSEO[word.toLowerCase()];
      return t ? matchCase(word, t) : word;
    });
}

const PHONE = /(?<!\d)(\+?506[\s-]?)?\d{4}[\s-]?\d{4}(?!\d)/g;

/** Removes phone numbers that are not in the verified list (911 has no 8 digits and always passes). */
export function stripUnverifiedPhones(text: string, allowed: string[]): string {
  const ok = new Set(allowed.map((p) => p.replace(/\D/g, "")));
  return text.replace(PHONE, (m) => (ok.has(m.replace(/\D/g, "").replace(/^506/, "")) || ok.has(m.replace(/\D/g, "")) ? m : "[número no verificado omitido]"));
}

export function filterTutorOutput(text: string, allowedPhones: string[]): string {
  return stripUnverifiedPhones(toTuteo(text), allowedPhones);
}

/**
 * Streaming version: holds back the last two words so a voseo form, "con vos" or a phone number
 * split across chunks is still caught. `push` returns what is safe to send now; `flush` the rest.
 */
export function tutorOutputStream(allowedPhones: string[]) {
  let pending = "";
  return {
    push(delta: string): string {
      pending += delta;
      const spaces = [...pending.matchAll(/\s/g)].map((m) => m.index!);
      if (spaces.length < 2) return "";
      const cut = spaces[spaces.length - 2] + 1;
      const ready = pending.slice(0, cut);
      pending = pending.slice(cut);
      return filterTutorOutput(ready, allowedPhones);
    },
    flush(): string {
      const rest = filterTutorOutput(pending, allowedPhones);
      pending = "";
      return rest;
    },
  };
}

// Gendered words a tutor might use to address the student. "solo/a", "lista" and "seguro/a" are
// left out: they are usually an adverb, a noun ("tu lista") or "seguro que…", not about the student.
const GENDERED = /(?<![\p{L}])(tranquil[oa]|cansad[oa]|preocupad[oa]|confundid[oa]|frustrad[oa]|agobiad[oa]|estresad[oa]|perdid[oa]|bienvenid[oa]|listo|atent[oa]|nervios[oa]|desanimad[oa]|asustad[oa])(?![\p{L}])/giu;

// Gendered forms that only refer to the student in context ("seguro que…" and "lo mismo" do not).
const GENDERED_PHRASES = /(?<![\p{L}])(?:(?:estés|estás|sientas|sientes|sentirte|eres|seas|estar) segur[oa]|(?:tú|ti) mism[oa])(?![\p{L}])/giu;

/**
 * Gendered words the tutor used that the student did not use first: the tutor assumed a gender.
 * Used by the evals; a student who writes "estoy cansada" may be answered with "cansada".
 */
export function assumedGenderWords(tutorText: string, studentText: string): string[] {
  const found = (text: string) => [...(text.match(GENDERED) ?? []), ...(text.match(GENDERED_PHRASES) ?? [])].map((w) => w.toLowerCase());
  const student = new Set(found(studentText));
  return [...new Set(found(tutorText))].filter((w) => !student.has(w));
}
