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

// The gendered phrases the model still slips into (evals of prompt v5 and v6), rewritten to a neutral
// form that keeps the sentence grammatical. A doubled form ("seguro o segura") is rewritten whole.
const NEUTRAL: [RegExp, (m: string) => string][] = [
  [/(?<![\p{L}])(estés|estás) segur[oa](?:\/[oa]| o segur[oa])?(?![\p{L}])/giu, (m) => (/^est[eé]s/i.test(m) ? "tengas certeza" : "tienes certeza")],
  [/(?<![\p{L}])sentirte segur[oa](?:\/[oa]| o segur[oa])?(?![\p{L}])/giu, () => "sentirte a salvo"],
  [/(?<![\p{L}])tú mism[oa](?:\/[oa]| o mism[oa])?(?![\p{L}])/giu, () => "por tu cuenta"],
  [/(?<![\p{L}])ti mism[oa](?:\/[oa]| o mism[oa])?(?![\p{L}])/giu, () => "ti"],
  // Capitalized or after "¡" it opens a greeting: "¡Bienvenida a la unidad!".
  [/(?:(?<=¡)bienvenid[oa]|(?<![\p{L}])Bienvenid[oa])(?:\/[oa]| o bienvenid[oa])?(?![\p{L}])/gu, () => "te doy la bienvenida"],
];

/** Rewrites the most common gendered phrases about the student into neutral ones. */
export function toNeutral(text: string): string {
  return NEUTRAL.reduce(
    (t, [re, to]) => t.replace(re, (m: string) => matchCase(m, to(m))),
    text,
  );
}

export function filterTutorOutput(text: string, allowedPhones: string[]): string {
  return stripUnverifiedPhones(toNeutral(toTuteo(text)), allowedPhones);
}

/**
 * Streaming version. Each push filters the whole reply so far and sends only the part that can no
 * longer change: everything but the last four words, so a phrase that is still arriving (a voseo
 * form, "con vos", a phone number, "estés seguro o segura") is rewritten before any of it is sent.
 * `push` returns what is safe to send now; `flush` the rest.
 */
const HOLD_WORDS = 4;

export function tutorOutputStream(allowedPhones: string[]) {
  let raw = "";
  let sent = 0;
  return {
    push(delta: string): string {
      raw += delta;
      const filtered = filterTutorOutput(raw, allowedPhones);
      const spaces = [...filtered.matchAll(/\s/g)].map((m) => m.index!);
      if (spaces.length < HOLD_WORDS) return "";
      const cut = spaces[spaces.length - HOLD_WORDS] + 1;
      if (cut <= sent) return "";
      const out = filtered.slice(sent, cut);
      sent = cut;
      return out;
    },
    flush(): string {
      const out = filterTutorOutput(raw, allowedPhones).slice(sent);
      raw = "";
      sent = 0;
      return out;
    },
  };
}

// Gendered words a tutor might use to address the student. "solo/a", "lista" and "seguro/a" are
// left out: they are usually an adverb, a noun ("tu lista") or "seguro que…", not about the student.
const GENDERED = /(?<![\p{L}])(tranquil[oa]|cansad[oa]|preocupad[oa]|confundid[oa]|frustrad[oa]|agobiad[oa]|estresad[oa]|perdid[oa]|bienvenid[oa]|listo|atent[oa]|respetad[oa]|nervios[oa]|desanimad[oa]|asustad[oa])(?![\p{L}])/giu;

const DOUBLED = /(?<![\p{L}])(\p{L}+)[oa](?:\/[oa]| o \1[oa])(?![\p{L}])/giu;

// Gendered forms that only refer to the student in context ("seguro que…" and "lo mismo" do not).
const GENDERED_PHRASES = /(?<![\p{L}])(?:(?:estés|estás|sientas|sientes|sentirte|eres|seas|estar) segur[oa]|(?:tú|ti) mism[oa])(?![\p{L}])/giu;

/**
 * Gendered words the tutor used that the student did not use first: the tutor assumed a gender.
 * Used by the evals; a student who writes "estoy cansada" may be answered with "cansada".
 */
export function assumedGenderWords(tutorText: string, studentText: string): string[] {
  const found = (raw: string) => {
    // "seguro o segura", "seguro/a" and the noun in "te doy la bienvenida" are already neutral.
    const text = raw.replace(DOUBLED, "").replace(/(?<![\p{L}])la bienvenida(?![\p{L}])/giu, "");
    return [...(text.match(GENDERED) ?? []), ...(text.match(GENDERED_PHRASES) ?? [])].map((w) => w.toLowerCase());
  };
  const student = new Set(found(studentText));
  return [...new Set(found(tutorText))].filter((w) => !student.has(w));
}
