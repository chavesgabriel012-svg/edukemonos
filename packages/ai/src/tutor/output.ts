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
  pensalo: "piénsalo", miralo: "míralo", escribilo: "escríbelo", revisalo: "revísalo",
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
    // "Sos una IA" from the tutor is a slip for "soy", not voseo: the tutor is talking about itself.
    .replace(/(?<![\p{L}])sos(?= (?:una? )?(?:IA|inteligencia artificial|tutor|programa|Kemo)(?![\p{L}]))/giu, (m) => matchCase(m, "soy"))
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

// Letters from other scripts that look like Latin ones. A model once wrote «segurо» with a Cyrillic
// «о», which no filter or check recognized. Only words that also contain Latin letters are touched,
// so a word fully written in another script is left as it is.
const LOOKALIKE: Record<string, string> = {
  а: "a", е: "e", о: "o", р: "p", с: "c", у: "y", х: "x", і: "i", ј: "j", ѕ: "s", һ: "h", ԁ: "d", ԛ: "q", ԝ: "w",
  А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", Х: "X", І: "I", Ј: "J", Ѕ: "S",
  α: "a", ο: "o", ρ: "p", ν: "v", ι: "i", κ: "k", τ: "t", υ: "u",
  Α: "A", Β: "B", Ε: "E", Ζ: "Z", Η: "H", Ι: "I", Κ: "K", Μ: "M", Ν: "N", Ο: "O", Ρ: "P", Τ: "T", Υ: "Y", Χ: "X",
};
const LOOKALIKE_CHARS = new RegExp(`[${Object.keys(LOOKALIKE).join("")}]`, "gu");

/** NFC plus lookalike letters (Cyrillic, Greek) inside otherwise Latin words → Latin. */
export function normalizeLetters(text: string): string {
  return text.normalize("NFC").replace(/[\p{L}\p{M}]+/gu, (word) =>
    /\p{Script=Latin}/u.test(word) ? word.replace(LOOKALIKE_CHARS, (c) => LOOKALIKE[c]) : word,
  );
}

// A gendered word, also in its doubled forms ("solo/a", "solo o sola"), which are rewritten whole.
const g = (stem: string) => `${stem}[oa](?:\\/[oa]| o ${stem}[oa])?`;
const W = (body: string, flags = "giu") => new RegExp(`(?<![\\p{L}])(?:${body})(?![\\p{L}])`, flags);

// Feelings the tutor attributes to the student, as a noun: "te sientas frustrado" → "sientas frustración".
// `much` is the "muy" form ("muy nervioso" → "muchos nervios"); `verb` is the verb that takes the noun.
const FEELINGS: { stem: string; noun: string; much: string; verb: "sentir" | "tener" }[] = [
  { stem: "tranquil", noun: "calma", much: "mucha calma", verb: "sentir" },
  { stem: "frustrad", noun: "frustración", much: "mucha frustración", verb: "sentir" },
  { stem: "nervios", noun: "nervios", much: "muchos nervios", verb: "sentir" },
  { stem: "preocupad", noun: "preocupación", much: "mucha preocupación", verb: "sentir" },
  { stem: "interesad", noun: "interés", much: "mucho interés", verb: "tener" },
];
// The student's verb before the adjective → the same person of "sentir" / "tener".
const FEEL_VERBS: Record<string, { sentir: string; tener: string }> = {
  "te sientas": { sentir: "sientas", tener: "tengas" },
  "te sientes": { sentir: "sientes", tener: "tienes" },
  "te sentías": { sentir: "sentías", tener: "tenías" },
  sentirte: { sentir: "sentir", tener: "tener" },
  sentirse: { sentir: "sentir", tener: "tener" },
  estés: { sentir: "sientas", tener: "tengas" },
  estás: { sentir: "sientes", tener: "tienes" },
  estabas: { sentir: "sentías", tener: "tenías" },
  estar: { sentir: "sentir", tener: "tener" },
};
const FEEL_VERB = Object.keys(FEEL_VERBS).join("|");
const DEGREE = "un poco más|un poco|algo más|más|muy";

function feelingRule(f: (typeof FEELINGS)[number]): [RegExp, (m: string, ...groups: string[]) => string] {
  return [
    W(`(${FEEL_VERB}) (?:(${DEGREE}) )?${g(f.stem)}`),
    (_m, verb, degree) => {
      const v = FEEL_VERBS[verb.toLowerCase()][f.verb];
      const d = degree?.toLowerCase();
      if (!d) return `${v} ${f.noun}`;
      if (d === "muy") return `${v} ${f.much}`;
      if (d === "más") return `${v} más ${f.noun}`;
      return `${v} ${d === "un poco" ? "algo de" : `${d} de`} ${f.noun}`;
    },
  ];
}

// The gendered phrases the model still slips into (evals of prompt v5 to v10), rewritten to a neutral
// form that keeps the sentence grammatical. Each one needs a context that refers to the student (a verb
// in second person, a vocative at the start of a sentence), so "un ritmo tranquilo", "una sola
// potencia", "solo falta un paso" or "la persona está nerviosa" are left alone.
const NEUTRAL: [RegExp, (m: string, ...groups: string[]) => string][] = [
  [W(`(estés|estás) ${g("segur")}`), (m) => (/^est[eé]s/i.test(m) ? "tengas certeza" : "tienes certeza")],
  [W(`estar ${g("segur")}`), () => "tener certeza"],
  [W(`(?:sentirte|te sientas|te sientes) ${g("respetad")} y a salvo`), () => "sentirte a salvo y con respeto"],
  [W(`(sentirte|te sientas|te sientes) ${g("segur")}`), (_m, v) => `${v} a salvo`],
  [W(`(sentirte|te sientas|te sientes|ser|seas|eres) ${g("respetad")}`), (_m, v) => `${({ sentirte: "recibir", ser: "recibir", "te sientas": "recibas", seas: "recibas", "te sientes": "recibes", eres: "recibes" } as Record<string, string>)[v.toLowerCase()]} respeto`],
  [W(`tú ${g("mism")}`), () => "por tu cuenta"],
  [W(`ti ${g("mism")}`), () => "ti"],
  [/¿list[oa](?:\/[oa]| o list[oa])?\?/giu, () => "¿Seguimos?"],
  // Capitalized or after "¡" it opens a greeting: "¡Bienvenida a la unidad!".
  [/(?:(?<=¡)bienvenid[oa]|(?<![\p{L}])Bienvenid[oa])(?:\/[oa]| o bienvenid[oa])?(?![\p{L}])/gu, () => "te doy la bienvenida"],
  // "Tranquilo, no hace falta…" / "¡Tranquila!": a vocative at the start of a sentence.
  [new RegExp(`(?<=^|[.!?:;]\\s+|[¡¿]|\\n\\s*)${g("[Tt]ranquil")}(?=\\s*[,.!;:])`, "gu"), () => "con calma"],
  ...FEELINGS.map(feelingRule),
  // Alone: "no estás solo" → "no estás sin apoyo"; "cargar con esto solo" → "cargar con esto sin apoyo".
  // Not the adverb: "estás solo a un paso", "estás solo un ejercicio atrás".
  [W(`(estés|estás|estar|estabas|te quedes|quedarte|te quedas|te sientas|te sientes|sentirte) ${g("sol")}(?!\\s+(?:a|al|un|una|uno|unos|unas|te|le|les|por|para|de|del|que|\\d)(?![\\p{L}]))`), (_m, v) => `${v} sin apoyo`],
  [W(`((?:cargar|cargues|cargas|enfrentar|enfrentes|enfrentas|afrontar|afrontes|lidiar|lidies|pasar|pases|vivir|vivas)(?: [\\p{L}]+){0,4}) ${g("sol")}(?=\\s*(?:[,.;:!?)]|$| y | ni ))`), (_m, phrase) => `${phrase} sin apoyo`],
  [W(`(hazlo|hacerlo|inténtalo|intentarlo|resuélvelo|resolverlo|pruébalo|probarlo) ${g("sol")}(?=\\s*(?:[,.;:!?)]|$))`), (_m, v) => `${v} por tu cuenta`],
  // "No estás obligado a cargar esto" → "No tienes que cargar esto".
  [W(`(estés|estás|estar) ${g("obligad")} a`), (_m, v) => `${({ estés: "tengas", estás: "tienes", estar: "tener" } as Record<string, string>)[v.toLowerCase()]} que`],
  [W(`(te sientas|te sientes|sentirte) ${g("obligad")} a`), (_m, v) => `${({ "te sientas": "sientas", "te sientes": "sientes", sentirte: "sentir" } as Record<string, string>)[v.toLowerCase()]} que debes`],
  // "para que llegues preparado al examen" → "para que llegues con buena preparación al examen".
  [W(`(llegues|llegar|llegas|vayas|ir) ${g("preparad")}`), (_m, v) => `${v} con buena preparación`],
  [W(`(estés|estás|estar) ${g("preparad")}`), (_m, v) => `${({ estés: "tengas", estás: "tienes", estar: "tener" } as Record<string, string>)[v.toLowerCase()]} todo a punto`],
  [W(`(te sientas|te sientes|sentirte) ${g("preparad")}`), (_m, v) => `${({ "te sientas": "sientas", "te sientes": "sientes", sentirte: "sentir" } as Record<string, string>)[v.toLowerCase()]} confianza`],
  // "Cuando llevas rato atascado" → "Cuando llevas rato sin avanzar".
  [W(`((?:estés|estás|estar|estabas|te quedes|te quedas|quedarte)|(?:llevas|lleves)(?: [\\p{L}]+){0,2}) ${g("atascad")}`), (_m, v) => `${v} sin avanzar`],
  [W(`(te sientas|te sientes|sentirte) ${g("atascad")}`), (_m, v) => `${({ "te sientas": "sientas", "te sientes": "sientes", sentirte: "sentir" } as Record<string, string>)[v.toLowerCase()]} que no avanzas`],
];

/** Rewrites the gendered phrases about the student into neutral ones. */
export function toNeutral(text: string): string {
  return NEUTRAL.reduce((t, [re, to]) => t.replace(re, (m: string, ...groups: string[]) => matchCase(m, to(m, ...groups))), normalizeLetters(text));
}

export function filterTutorOutput(text: string, allowedPhones: string[]): string {
  return stripUnverifiedPhones(toNeutral(toTuteo(normalizeLetters(text))), allowedPhones);
}

/**
 * Streaming version. Each push filters the whole reply so far and sends only the part that can no
 * longer change: everything but the last eight words, so a phrase that is still arriving (a voseo
 * form, "con vos", a phone number, "te sientas un poco más tranquilo", "cargar con todo esto sola")
 * is rewritten before any of it is sent. Eight covers the longest phrase in NEUTRAL plus the word after it.
 * `push` returns what is safe to send now; `flush` the rest.
 */
const HOLD_WORDS = 8;

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

// Gendered words a tutor might use to address the student. "solo/a", "listo/a" and "seguro/a" are
// left out: they are usually an adverb, a noun ("tu lista") or "seguro que…", not about the student.
const GENDERED = /(?<![\p{L}])(tranquil[oa]|cansad[oa]|preocupad[oa]|confundid[oa]|frustrad[oa]|agobiad[oa]|estresad[oa]|perdid[oa]|bienvenid[oa]|atent[oa]|respetad[oa]|nervios[oa]|desanimad[oa]|asustad[oa])(?![\p{L}])/giu;

// A gendered word about someone else, in third person: "la persona está nerviosa", "si está feliz,
// preocupada o algo más". The tutor uses tuteo, so these never refer to the student.
const THIRD_PERSON = /(?<![\p{L}])(?:está|esté|estaba|estuvo|están|estaban|se siente|se sentía|se sintió|parece|parecía|se ve|se veía|quedó)\s+(?:(?:muy|más|un poco|algo)\s+)?(?:[\p{L}]+(?:,\s*|\s+o\s+|\s+y\s+)){0,3}[\p{L}]+/giu;

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
    const text = normalizeLetters(raw).replace(THIRD_PERSON, "").replace(DOUBLED, "").replace(/(?<![\p{L}])la bienvenida(?![\p{L}])/giu, "");
    return [...(text.match(GENDERED) ?? []), ...(text.match(GENDERED_PHRASES) ?? [])].map((w) => w.toLowerCase());
  };
  const student = new Set(found(studentText));
  return [...new Set(found(tutorText))].filter((w) => !student.has(w));
}
