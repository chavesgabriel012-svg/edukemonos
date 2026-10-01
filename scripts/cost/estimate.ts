/**
 * Edukemonos — Claude API cost estimate (per student, per section, one-off content generation).
 *
 * Run from the repo root (any of these):
 *   node scripts/cost/estimate.ts          # Node >= 22.18 runs TypeScript natively (repo requires 22.x/24.x)
 *   npx tsx scripts/cost/estimate.ts       # needs npm registry access to fetch tsx
 *   pnpm --filter @edukemonos/ingest exec tsx ../../scripts/cost/estimate.ts   # uses the workspace tsx
 * Save the report:  node scripts/cost/estimate.ts > /tmp/ai-costs-output.md
 *
 * IMPORTANT: every usage number in PARAMS (messages, characters, thinking tokens, active days,
 * cache-miss rate, units, items...) is an ASSUMPTION, not measured data. Replace them with real
 * numbers from the `ai_usage` table once the tutor runs (Phase 4). Prices are Anthropic list
 * prices; verify them at https://claude.com/pricing before deciding anything.
 *
 * Self-contained on purpose: no imports, no dependencies, no network, no API key.
 * Output: Markdown tables (Spanish headings) on stdout. See docs/ai-costs.md for the report.
 */

type ModelId =
  | "claude-opus-5-5"
  | "claude-sonnet-5-5"
  | "claude-haiku-4-5"
  | "gpt-6.1-sol"
  | "gpt-6-luna"
  | "gemini-3.8-flash"
  | "gemini-3.5-flash-lite";
type Role = "tutor" | "bulk" | "verify";
type Level = "low" | "typical" | "high";
type ProfileName = "light" | "typical" | "heavy" | "cap";

interface ModelInfo {
  label: string;
  /** USD per 1M tokens. */
  input: number;
  output: number;
  cacheRead: number;
  /** 5-minute TTL cache write (1.25x base input). */
  cacheWrite5m: number;
  /** 1-hour TTL cache write (2x base input). */
  cacheWrite1h: number;
  /** Message Batches API discount on every token (0.5 = 50% off). */
  batchFactor: number;
  /** Prefixes shorter than this silently do not cache (no error, no discount). */
  minCacheablePrefix: number;
  /** ASSUMPTION: tokens per character relative to the chars/token baseline (newer tokenizers count more). */
  tokenizerFactor: number;
  /** Whether the model thinks by default (thinking tokens are billed as output). */
  thinksByDefault: boolean;
}

interface Thinking {
  low: number;
  typical: number;
  high: number;
}

interface Mix {
  label: string;
  tutor: ModelId;
  bulk: ModelId;
  verify: ModelId;
  /** Multiplier on tutor-role thinking tokens: 1 = adaptive thinking at the model default; 0 = no thinking. */
  tutorThinkingMultiplier: number;
  note: string;
}

interface Profile {
  label: string;
  activeDaysPerMonth: number;
  sessionsPerActiveDay: number;
  messagesPerSession: number;
  extraPracticeRequestsPerMonth: number;
  writingFeedbackPerMonth: number;
  /** Per section, not per student. */
  teacherSummariesPerMonth: number;
  /** Share of a section's enrolled students who use the AI in a given month. */
  activeShareOfSection: number;
}

// ============================================================================================
// PARAMETERS — change anything here. Everything marked ASSUMPTION is a guess to be measured.
// ============================================================================================
const PARAMS = {
  prices: {
    source:
      "Claude: Anthropic list prices (USD / 1M tokens), confirmed at https://www.claude.com/pricing on 2026-10-01. " +
      "OpenAI and Gemini: official pricing pages read on 2026-10-01 (see docs/ai-models-study.md). Verify before deciding.",
    models: {
      "claude-opus-5-5": {
        label: "Claude Opus 5.5",
        input: 4.0,
        output: 20.0,
        cacheRead: 0.2, // 0.05x input
        cacheWrite5m: 5.0, // 1.25x input
        cacheWrite1h: 8.0, // 2x input
        batchFactor: 0.5,
        minCacheablePrefix: 512,
        tokenizerFactor: 1.15, // ASSUMPTION (range 1.0–1.35 vs older tokenizers)
        thinksByDefault: true, // cannot be disabled; default effort `medium`
      },
      "claude-sonnet-5-5": {
        label: "Claude Sonnet 5.5",
        input: 2.0,
        output: 10.0,
        cacheRead: 0.2,
        cacheWrite5m: 2.5,
        cacheWrite1h: 4.0,
        batchFactor: 0.5,
        minCacheablePrefix: 512,
        tokenizerFactor: 1.15, // ASSUMPTION (same tokenizer family as Opus 5.5)
        thinksByDefault: true, // adaptive, default effort `high`; `between_tools` turns it off
      },
      "claude-haiku-4-5": {
        label: "Claude Haiku 4.5",
        input: 1.0,
        output: 5.0,
        cacheRead: 0.1, // ~0.1x input
        cacheWrite5m: 1.25,
        cacheWrite1h: 2.0,
        batchFactor: 0.5,
        minCacheablePrefix: 4096,
        tokenizerFactor: 1.0, // older tokenizer = baseline
        thinksByDefault: false,
      },
      // --- Other providers (study docs/ai-models-study.md). Prices read from the official pages on
      // 2026-10-01: developers.openai.com/api/docs/pricing (Standard, short context) and
      // ai.google.dev/gemini-api/docs/pricing (paid tier). Verify before deciding.
      "gpt-6.1-sol": {
        label: "OpenAI gpt-6.1-sol",
        input: 2.0,
        output: 10.0,
        cacheRead: 0.1,
        cacheWrite5m: 2.5, // listed as "Cache writes"
        cacheWrite1h: 2.5, // ASSUMPTION: no separate 1h tier listed
        batchFactor: 0.5,
        minCacheablePrefix: 1024, // ASSUMPTION
        tokenizerFactor: 1.0, // ASSUMPTION
        thinksByDefault: true, // ASSUMPTION: reasoning model, same thinking volume as Claude
      },
      "gpt-6-luna": {
        label: "OpenAI gpt-6-luna",
        input: 0.1,
        output: 0.5,
        cacheRead: 0.01,
        cacheWrite5m: 0.125,
        cacheWrite1h: 0.125, // ASSUMPTION
        batchFactor: 0.5,
        minCacheablePrefix: 1024, // ASSUMPTION
        tokenizerFactor: 1.0, // ASSUMPTION
        thinksByDefault: true, // ASSUMPTION
      },
      "gemini-3.8-flash": {
        label: "Google Gemini 3.8 Flash (precio hasta 31/12/2026)",
        input: 0.75,
        output: 3.75, // includes thinking tokens
        cacheRead: 0.075,
        cacheWrite5m: 0.75, // ASSUMPTION: implicit caching, no write premium; storage fee ignored
        cacheWrite1h: 0.75,
        batchFactor: 0.5,
        minCacheablePrefix: 1024, // ASSUMPTION
        tokenizerFactor: 1.0, // ASSUMPTION
        thinksByDefault: true,
      },
      "gemini-3.5-flash-lite": {
        label: "Google Gemini 3.5 Flash-Lite",
        input: 0.3,
        output: 2.5, // includes thinking tokens
        cacheRead: 0.03,
        cacheWrite5m: 0.3, // ASSUMPTION: implicit caching, no write premium
        cacheWrite1h: 0.3,
        batchFactor: 0.5,
        minCacheablePrefix: 1024, // ASSUMPTION
        tokenizerFactor: 1.0, // ASSUMPTION
        thinksByDefault: true,
      },
    } satisfies Record<ModelId, ModelInfo>,
  },

  /** ASSUMPTION: optional, only to show colones. Check the BCCR reference rate. */
  crcPerUsd: 500,

  tokens: {
    /** ASSUMPTION: Spanish text ≈ 3.5 characters per token (baseline/older tokenizer). */
    charsPerToken: 3.5,
  },

  calendar: {
    /** ASSUMPTION: ~200 lesson days in the Costa Rican public-school year. */
    schoolDaysPerYear: 200,
    /** ASSUMPTION: ~10 months with classes (Feb–Dec minus mid-year break). */
    schoolMonthsPerYear: 10,
  },

  /** Thinking level used for the main tables; the sensitivity table shows all three. */
  thinkingLevel: "typical" as Level,

  tutor: {
    systemPromptChars: 6_000, // ASSUMPTION: versioned Socratic prompt + safety rules + hint ladder
    toolDefinitionTokens: 150, // ASSUMPTION: calculator tool schema
    unitContextChars: 15_000, // ASSUMPTION: learning outcomes + published material of the unit
    masteryChars: 600, // ASSUMPTION: per-skill mastery estimates (no name)
    studentMessageChars: 200, // ASSUMPTION: short messages from 12–15-year-olds
    replyChars: 700, // ASSUMPTION: short Socratic reply, one step at a time
    /** ASSUMPTION: thinking tokens per tutor turn (billed as output), at the model's default effort. */
    thinkingTokensPerTurn: { low: 150, typical: 400, high: 1_200 } as Thinking,
    /** ASSUMPTION: share of turns with one calculator tool round (extra request). Mostly Matemáticas. */
    toolRoundRate: 0.15,
    toolCallOutputTokens: 60, // ASSUMPTION
    toolResultTokens: 30, // ASSUMPTION
    /** ASSUMPTION: extra thinking after the tool result, as a share of the turn's thinking. */
    extraThinkingAfterToolShare: 0.3,
    /** ASSUMPTION: share of turns where the student takes > 5 min to reply, so the 5-min cache expired. */
    cacheMissRateBetweenTurns: 0.15,
    /**
     * ASSUMPTION: probability that, at session start, the stable prefix (system + unit context) is
     * already cached by another student on the same unit within the last 5 minutes. 0 = conservative.
     */
    sharedPrefixWarmRate: 0,
  },

  writingFeedback: {
    role: "tutor" as Role,
    systemPromptChars: 4_000, // ASSUMPTION
    rubricChars: 2_500, // ASSUMPTION: error categories (tildes, b/v, c/s/z, h, g/j, mayúsculas...)
    studentTextChars: 1_500, // ASSUMPTION: ~250 words
    feedbackChars: 1_500, // ASSUMPTION
    countsJsonTokens: 120, // ASSUMPTION: structured error counts
    thinkingTokens: { low: 300, typical: 800, high: 2_000 } as Thinking, // ASSUMPTION
  },

  extraPractice: {
    role: "bulk" as Role,
    instructionsChars: 8_000, // ASSUMPTION: item-generation prompt + format + style examples
    skillSpecChars: 800, // ASSUMPTION
    itemsPerRequest: 5, // ASSUMPTION
    tokensPerItem: 400, // ASSUMPTION: stem + 4 options + why each distractor is wrong
    thinkingTokens: { low: 800, typical: 2_000, high: 5_000 } as Thinking, // ASSUMPTION
    /** SPEC marks on-demand items as "no revisada"; set true to also run MODEL_VERIFY on each. */
    verifyEachItem: false,
  },

  teacherSummary: {
    role: "tutor" as Role, // ASSUMPTION: SPEC does not fix the model; quality-sensitive, low volume
    instructionsChars: 5_000, // ASSUMPTION
    aggregatedMetricsTokens: 3_000, // ASSUMPTION: aggregated metrics of ~35 students, never raw chat
    summaryChars: 2_500, // ASSUMPTION
    thinkingTokens: { low: 400, typical: 1_000, high: 3_000 } as Thinking, // ASSUMPTION
  },

  /** ASSUMPTION: usage profiles. `cap` = configured limits maxed every school day. */
  profiles: {
    light: {
      label: "Ligero",
      activeDaysPerMonth: 4,
      sessionsPerActiveDay: 1,
      messagesPerSession: 6,
      extraPracticeRequestsPerMonth: 1,
      writingFeedbackPerMonth: 0,
      teacherSummariesPerMonth: 2,
      activeShareOfSection: 0.5,
    },
    typical: {
      label: "Típico",
      activeDaysPerMonth: 8,
      sessionsPerActiveDay: 1,
      messagesPerSession: 10,
      extraPracticeRequestsPerMonth: 2,
      writingFeedbackPerMonth: 2,
      teacherSummariesPerMonth: 4,
      activeShareOfSection: 0.7,
    },
    heavy: {
      label: "Intenso",
      activeDaysPerMonth: 16,
      sessionsPerActiveDay: 1.5,
      messagesPerSession: 15,
      extraPracticeRequestsPerMonth: 6,
      writingFeedbackPerMonth: 4,
      teacherSummariesPerMonth: 8,
      activeShareOfSection: 0.85,
    },
    cap: {
      label: "Tope (límites al máximo)",
      activeDaysPerMonth: 20, // every school day (200 days / 10 months)
      sessionsPerActiveDay: 2, // TUTOR_MAX_MESSAGES_PER_DAY=60 / TUTOR_MAX_MESSAGES_PER_SESSION=30
      messagesPerSession: 30,
      extraPracticeRequestsPerMonth: 20, // ASSUMPTION: no limit configured yet; 1 per school day
      writingFeedbackPerMonth: 20, // ASSUMPTION: no limit configured yet; 1 per school day
      teacherSummariesPerMonth: 20, // ASSUMPTION: 1 per school day per section
      activeShareOfSection: 1,
    },
  } satisfies Record<ProfileName, Profile>,

  section: { students: 35 }, // ASSUMPTION
  scaleStudents: [1_000, 10_000], // registered students (only the active share costs money)

  mixes: {
    A: {
      label: "A (recomendado)",
      tutor: "claude-opus-5-5",
      bulk: "claude-sonnet-5-5",
      verify: "claude-opus-5-5",
      tutorThinkingMultiplier: 1,
      note: "Opus 5.5, thinking siempre activo, esfuerzo por defecto `medium`",
    },
    B: {
      label: "B",
      tutor: "claude-sonnet-5-5",
      bulk: "claude-sonnet-5-5",
      verify: "claude-opus-5-5",
      tutorThinkingMultiplier: 1, // ASSUMPTION: same thinking volume as Opus at its default
      note: "Sonnet 5.5, thinking adaptativo, esfuerzo por defecto `high`",
    },
    B0: {
      label: "B sin thinking",
      tutor: "claude-sonnet-5-5",
      bulk: "claude-sonnet-5-5",
      verify: "claude-opus-5-5",
      tutorThinkingMultiplier: 0,
      note: "Sonnet 5.5 con `thinking: {type: \"between_tools\"}` (esfuerzo high o menor)",
    },
    C: {
      label: "C",
      tutor: "claude-haiku-4-5",
      bulk: "claude-sonnet-5-5",
      verify: "claude-opus-5-5",
      tutorThinkingMultiplier: 0, // Haiku 4.5 does not think unless enabled
      note: "Haiku 4.5, sin thinking; caché mínimo 4.096 tokens",
    },
    C2: {
      label: "C2 todo económico",
      tutor: "claude-haiku-4-5",
      bulk: "claude-haiku-4-5",
      verify: "claude-sonnet-5-5",
      tutorThinkingMultiplier: 0,
      note: "Haiku 4.5 para tutor y generación; Sonnet 5.5 verifica",
    },
    D: {
      label: "D OpenAI sol",
      tutor: "gpt-6.1-sol",
      bulk: "claude-sonnet-5-5",
      verify: "claude-opus-5-5",
      tutorThinkingMultiplier: 1, // ASSUMPTION
      note: "Tutor gpt-6.1-sol (OpenAI); requiere consentimiento parental y ZDR para menores de 13",
    },
    E: {
      label: "E OpenAI luna",
      tutor: "gpt-6-luna",
      bulk: "claude-sonnet-5-5",
      verify: "claude-opus-5-5",
      tutorThinkingMultiplier: 1, // ASSUMPTION
      note: "Tutor gpt-6-luna (OpenAI); mismas condiciones que D",
    },
    G: {
      label: "G Gemini Flash (NO permitido)",
      tutor: "gemini-3.8-flash",
      bulk: "claude-sonnet-5-5",
      verify: "claude-opus-5-5",
      tutorThinkingMultiplier: 1, // ASSUMPTION
      note: "Solo referencia: los términos de la Gemini API prohíben apps para menores de 18",
    },
  } satisfies Record<string, Mix>,

  oneOff: {
    subjects: {
      matematicas: { label: "Matemáticas III Ciclo", pages: 110, charsPerPage: 3_400 }, // measured (pdftotext)
      espanol: { label: "Español 7.º–9.º", pages: 92, charsPerPage: 1_950 }, // measured (pdftotext)
    },
    structuring: {
      pagesPerCall: 8, // ASSUMPTION
      instructionsChars: 8_000, // ASSUMPTION: "extract, don't invent" rules + examples
      schemaTokens: 1_500, // ASSUMPTION: JSON schema of units
      outputShareOfPageTokens: 0.3, // ASSUMPTION: structured JSON incl. verbatim excerpts
      thinkingTokensPerCall: { low: 1_000, typical: 3_000, high: 8_000 } as Thinking, // ASSUMPTION
      reruns: 1.5, // ASSUMPTION: prompt iterations / retries
    },
    grades: 3, // 7.º, 8.º, 9.º
    unitsPerGradePerSubject: 6, // ASSUMPTION
    material: {
      inputTokens: 7_500, // ASSUMPTION: instructions + unit data + source excerpts
      outputTokens: 5_000, // ASSUMPTION: resumen + explicación + ejemplos + glosario
      thinkingTokens: { low: 1_000, typical: 3_000, high: 8_000 } as Thinking, // ASSUMPTION
      regenerations: 1.5, // ASSUMPTION: reviewer rejections → regenerate
    },
    items: {
      verifiedItemsPerUnit: 40, // ASSUMPTION: target bank size per unit
      discardRate: 0.2, // ASSUMPTION: share failing verification
      itemsPerCall: 10, // ASSUMPTION
      inputTokensPerCall: 9_500, // ASSUMPTION: instructions + unit material + style examples
      tokensPerItem: 400, // ASSUMPTION
      thinkingTokensPerCall: { low: 1_000, typical: 3_000, high: 8_000 } as Thinking, // ASSUMPTION
    },
    verify: {
      inputTokensPerItem: 2_100, // ASSUMPTION: verifier instructions + item (+ reading passage in Español)
      outputTokensPerItem: 400, // ASSUMPTION: independent solution + verdict
      thinkingTokensPerItem: { low: 400, typical: 1_000, high: 3_000 } as Thinking, // ASSUMPTION
    },
    evals: {
      casesPerSubject: 30, // SPEC §14
      subjects: 2,
      turnsPerCase: 4, // ASSUMPTION
      runs: 10, // ASSUMPTION: runs while tuning the prompt before launch
      prefixWarmRate: 0.9, // ASSUMPTION: cases run back-to-back, so the unit prefix is usually cached
      judgeInputTokens: 3_000, // ASSUMPTION: rubric + transcript
      judgeOutputTokens: 300, // ASSUMPTION
      judgeThinkingTokens: { low: 400, typical: 800, high: 2_000 } as Thinking, // ASSUMPTION
    },
  },
};

type Params = typeof PARAMS;

// ============================================================================================
// Model
// ============================================================================================

interface Tally {
  usd: number;
  input: number; // all input tokens (uncached + cache read + cache write)
  cacheRead: number;
  cacheWrite: number;
  output: number; // incl. thinking
  requests: number;
}

const zero = (): Tally => ({ usd: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, requests: 0 });

function add(a: Tally, b: Tally, k = 1): Tally {
  return {
    usd: a.usd + b.usd * k,
    input: a.input + b.input * k,
    cacheRead: a.cacheRead + b.cacheRead * k,
    cacheWrite: a.cacheWrite + b.cacheWrite * k,
    output: a.output + b.output * k,
    requests: a.requests + b.requests * k,
  };
}

const model = (p: Params, id: ModelId): ModelInfo => p.prices.models[id];
const tok = (p: Params, id: ModelId, chars: number) => (chars / p.tokens.charsPerToken) * model(p, id).tokenizerFactor;

/** Input-side cost of one request. `readable` = tokens of this prompt's prefix already in cache. */
function inputCost(p: Params, id: ModelId, input: number, readable: number, caching: boolean): Tally {
  const m = model(p, id);
  if (!caching || input < m.minCacheablePrefix) {
    return { ...zero(), usd: (input * m.input) / 1e6, input, requests: 1 };
  }
  const read = readable >= m.minCacheablePrefix ? Math.min(readable, input) : 0;
  const write = input - read;
  return {
    ...zero(),
    usd: (read * m.cacheRead + write * m.cacheWrite5m) / 1e6,
    input,
    cacheRead: read,
    cacheWrite: write,
    requests: 1,
  };
}

function outputCost(p: Params, id: ModelId, output: number): Tally {
  return { ...zero(), usd: (output * model(p, id).output) / 1e6, output };
}

/** Simple one-shot request, no caching (occasional calls). */
function oneShot(p: Params, id: ModelId, input: number, output: number, batch = false): Tally {
  const t = add(inputCost(p, id, input, 0, false), outputCost(p, id, output));
  if (batch) t.usd *= model(p, id).batchFactor;
  return t;
}

function roleModel(mix: Mix, role: Role): ModelId {
  return mix[role];
}

function thinkingFor(p: Params, mix: Mix, role: Role, t: Thinking, level: Level): number {
  const id = roleModel(mix, role);
  if (role === "tutor") return model(p, id).thinksByDefault ? t[level] * mix.tutorThinkingMultiplier : 0;
  return model(p, id).thinksByDefault ? t[level] : 0;
}

/** Expected cost of one tutor session of `turns` student messages. */
function tutorSession(p: Params, mix: Mix, turns: number, caching: boolean, level: Level): Tally {
  const id = mix.tutor;
  const T = p.tutor;
  const prefix = tok(p, id, T.systemPromptChars) + T.toolDefinitionTokens + tok(p, id, T.unitContextChars);
  const mastery = tok(p, id, T.masteryChars);
  const u = tok(p, id, T.studentMessageChars);
  const a = tok(p, id, T.replyChars);
  const th = thinkingFor(p, mix, "tutor", T.thinkingTokensPerTurn, level);
  const warm = T.sharedPrefixWarmRate;
  const miss = T.cacheMissRateBetweenTurns;

  // Cold start of a request: the stable prefix may be warm from another student on the same unit.
  const cold = (input: number) =>
    add(add(zero(), inputCost(p, id, input, prefix, caching), warm), inputCost(p, id, input, 0, caching), 1 - warm);

  let total = zero();
  let prevInput = 0;
  const toolExtraOut = T.toolCallOutputTokens + th * T.extraThinkingAfterToolShare;
  for (let k = 1; k <= turns; k++) {
    // History is replayed as visible text only (the adapter maps ChatMessage → string content).
    const input = prefix + mastery + (k - 1) * (u + a) + u;
    const main = k === 1 ? cold(input) : add(add(zero(), inputCost(p, id, input, prevInput, caching), 1 - miss), cold(input), miss);
    total = add(total, main);
    // Calculator tool round: second request re-sends the prompt + round-1 thinking/tool_use + tool result.
    const input2 = input + th + T.toolCallOutputTokens + T.toolResultTokens;
    total = add(total, inputCost(p, id, input2, input, caching), T.toolRoundRate);
    total = add(total, outputCost(p, id, a + th + T.toolRoundRate * toolExtraOut));
    prevInput = input;
  }
  return total;
}

function writingFeedback(p: Params, mix: Mix, level: Level): Tally {
  const W = p.writingFeedback;
  const id = roleModel(mix, W.role);
  const input = tok(p, id, W.systemPromptChars + W.rubricChars + W.studentTextChars);
  const output = tok(p, id, W.feedbackChars) + W.countsJsonTokens + thinkingFor(p, mix, W.role, W.thinkingTokens, level);
  return oneShot(p, id, input, output);
}

function verifyItem(p: Params, mix: Mix, level: Level, batch = false): Tally {
  const V = p.oneOff.verify;
  return oneShot(p, mix.verify, V.inputTokensPerItem, V.outputTokensPerItem + thinkingFor(p, mix, "verify", V.thinkingTokensPerItem, level), batch);
}

function extraPractice(p: Params, mix: Mix, level: Level): Tally {
  const E = p.extraPractice;
  const id = roleModel(mix, E.role);
  const input = tok(p, id, E.instructionsChars + p.tutor.unitContextChars + E.skillSpecChars);
  const output = E.itemsPerRequest * E.tokensPerItem + thinkingFor(p, mix, E.role, E.thinkingTokens, level);
  let t = oneShot(p, id, input, output);
  if (E.verifyEachItem) t = add(t, verifyItem(p, mix, level), E.itemsPerRequest);
  return t;
}

function teacherSummary(p: Params, mix: Mix, level: Level): Tally {
  const S = p.teacherSummary;
  const id = roleModel(mix, S.role);
  const input = tok(p, id, S.instructionsChars) + S.aggregatedMetricsTokens;
  const output = tok(p, id, S.summaryChars) + thinkingFor(p, mix, S.role, S.thinkingTokens, level);
  return oneShot(p, id, input, output);
}

interface StudentMonth {
  tutor: Tally;
  practice: Tally;
  writing: Tally;
  total: Tally;
  messages: number;
}

function studentMonth(p: Params, mix: Mix, prof: Profile, caching: boolean, level: Level): StudentMonth {
  const sessions = prof.activeDaysPerMonth * prof.sessionsPerActiveDay;
  const tutor = add(zero(), tutorSession(p, mix, prof.messagesPerSession, caching, level), sessions);
  const practice = add(zero(), extraPractice(p, mix, level), prof.extraPracticeRequestsPerMonth);
  const writing = add(zero(), writingFeedback(p, mix, level), prof.writingFeedbackPerMonth);
  return { tutor, practice, writing, total: add(add(tutor, practice), writing), messages: sessions * prof.messagesPerSession };
}

function sectionMonth(p: Params, mix: Mix, prof: Profile, caching: boolean, level: Level, students = p.section.students) {
  const perStudent = studentMonth(p, mix, prof, caching, level).total.usd;
  const studentsUsd = students * prof.activeShareOfSection * perStudent;
  const teacherUsd = prof.teacherSummariesPerMonth * teacherSummary(p, mix, level).usd;
  return { studentsUsd, teacherUsd, total: studentsUsd + teacherUsd };
}

function scaleMonth(p: Params, mix: Mix, prof: Profile, caching: boolean, level: Level, registered: number) {
  const perStudent = studentMonth(p, mix, prof, caching, level).total.usd;
  const sections = registered / p.section.students;
  return registered * prof.activeShareOfSection * perStudent + sections * prof.teacherSummariesPerMonth * teacherSummary(p, mix, level).usd;
}

interface OneOffLine {
  label: string;
  role: Role;
  tally: Tally;
}

function oneOff(p: Params, mix: Mix, level: Level, batch: boolean): OneOffLine[] {
  const O = p.oneOff;
  const lines: OneOffLine[] = [];

  // 1. Curriculum structuring over program pages.
  let structuring = zero();
  for (const s of Object.values(O.subjects)) {
    const calls = Math.ceil(s.pages / O.structuring.pagesPerCall);
    const pageTok = tok(p, mix.bulk, s.pages * s.charsPerPage);
    const input = calls * (tok(p, mix.bulk, O.structuring.instructionsChars) + O.structuring.schemaTokens) + pageTok;
    const output = pageTok * O.structuring.outputShareOfPageTokens + calls * thinkingFor(p, mix, "bulk", O.structuring.thinkingTokensPerCall, level);
    const t = oneShot(p, mix.bulk, input, output, batch);
    t.requests = calls;
    structuring = add(structuring, t, O.structuring.reruns);
  }
  lines.push({ label: "Estructuración curricular (programas → unidades)", role: "bulk", tally: structuring });

  const units = Object.keys(O.subjects).length * O.grades * O.unitsPerGradePerSubject;

  // 2. Study material per unit.
  const mat = oneShot(p, mix.bulk, O.material.inputTokens, O.material.outputTokens + thinkingFor(p, mix, "bulk", O.material.thinkingTokens, level), batch);
  lines.push({ label: `Material de estudio (${units} unidades)`, role: "bulk", tally: add(zero(), mat, units * O.material.regenerations) });

  // 3. Item bank generation.
  const generatedPerUnit = O.items.verifiedItemsPerUnit / (1 - O.items.discardRate);
  const callsPerUnit = generatedPerUnit / O.items.itemsPerCall;
  const itemCall = oneShot(
    p,
    mix.bulk,
    O.items.inputTokensPerCall,
    O.items.itemsPerCall * O.items.tokensPerItem + thinkingFor(p, mix, "bulk", O.items.thinkingTokensPerCall, level),
    batch,
  );
  lines.push({
    label: `Banco de ítems (${Math.round(generatedPerUnit * units)} generados → ${O.items.verifiedItemsPerUnit * units} verificados)`,
    role: "bulk",
    tally: add(zero(), itemCall, callsPerUnit * units),
  });

  // 4. Independent verification of every generated item.
  lines.push({ label: "Verificación independiente de cada ítem", role: "verify", tally: add(zero(), verifyItem(p, mix, level, batch), generatedPerUnit * units) });

  // 5. Tutor evals before launch (interactive, cached like real sessions) + judge.
  const E = O.evals;
  const cases = E.casesPerSubject * E.subjects * E.runs;
  const q = clone(p);
  q.tutor.sharedPrefixWarmRate = E.prefixWarmRate;
  q.tutor.cacheMissRateBetweenTurns = 0; // automated turns, no human pauses
  const evalSession = tutorSession(q, mix, E.turnsPerCase, true, level);
  const judge = oneShot(p, mix.verify, E.judgeInputTokens, E.judgeOutputTokens + thinkingFor(p, mix, "verify", E.judgeThinkingTokens, level), batch);
  lines.push({ label: `Evals del tutor (${E.casesPerSubject * E.subjects} casos × ${E.runs} corridas; tutor + juez)`, role: "tutor", tally: add(add(zero(), evalSession, cases), judge, cases) });
  return lines;
}

// ============================================================================================
// Output helpers
// ============================================================================================

function usd(x: number): string {
  if (x === 0) return "$0";
  if (Math.abs(x) < 0.01) return `$${x.toFixed(4)}`;
  if (Math.abs(x) < 1) return `$${x.toFixed(3)}`;
  if (Math.abs(x) < 100) return `$${x.toFixed(2)}`;
  return `$${Math.round(x).toLocaleString("en-US")}`;
}
const int = (x: number) => Math.round(x).toLocaleString("en-US");
const pct = (x: number) => `${x >= 0 ? "+" : ""}${Math.round(x * 100)}%`;
const crc = (p: Params, x: number) => `₡${Math.round(x * p.crcPerUsd).toLocaleString("en-US")}`;

function table(headers: string[], rows: (string | number)[][]): string {
  const line = (cells: (string | number)[]) => `| ${cells.join(" | ")} |`;
  return [line(headers), line(headers.map((_, i) => (i === 0 ? "---" : "---:"))), ...rows.map(line)].join("\n");
}

function clone(p: Params): Params {
  return JSON.parse(JSON.stringify(p)) as Params;
}

// ============================================================================================
// Report
// ============================================================================================

function main(p: Params): void {
  const L = p.thinkingLevel;
  const mixes = p.mixes as Record<string, Mix>;
  const profiles = p.profiles as Record<ProfileName, Profile>;
  const months = p.calendar.schoolMonthsPerYear;
  const out: string[] = [];
  const h = (s: string) => out.push(`\n## ${s}\n`);

  out.push("# Edukemonos — estimación de costo de IA (Claude API)");
  out.push(`\nTodos los volúmenes de uso son SUPUESTOS (ver PARAMS en el script). Precios: ${p.prices.source}`);
  out.push(`Nivel de thinking en tablas principales: \`${L}\`. Año lectivo supuesto: ${p.calendar.schoolDaysPerYear} días lectivos ≈ ${months} meses.`);

  h("1. Precios (USD por millón de tokens)");
  out.push(
    table(
      ["Modelo", "Entrada", "Salida (incl. thinking)", "Lectura de caché", "Escritura caché 5 min", "Escritura caché 1 h", "Batch", "Prefijo mínimo cacheable"],
      (Object.entries(p.prices.models) as [ModelId, ModelInfo][]).map(([id, m]) => [
        `${m.label} (\`${id}\`)`,
        usd(m.input),
        usd(m.output),
        usd(m.cacheRead),
        usd(m.cacheWrite5m),
        usd(m.cacheWrite1h),
        `${Math.round((1 - m.batchFactor) * 100)}% menos`,
        `${int(m.minCacheablePrefix)} tokens`,
      ]),
    ),
  );

  h("2. Tamaño estimado de un turno del tutor (tokens, escenario A)");
  {
    const id = mixes.A.tutor;
    const T = p.tutor;
    const prefix = tok(p, id, T.systemPromptChars) + T.toolDefinitionTokens + tok(p, id, T.unitContextChars);
    const ua = tok(p, id, T.studentMessageChars) + tok(p, id, T.replyChars);
    out.push(
      table(
        ["Parte", "Tokens"],
        [
          ["Prefijo estable (sistema + herramienta + contexto de la unidad)", int(prefix)],
          ["Dominio del estudiante", int(tok(p, id, T.masteryChars))],
          ["Mensaje del estudiante", int(tok(p, id, T.studentMessageChars))],
          ["Respuesta visible del tutor", int(tok(p, id, T.replyChars))],
          ["Historial que se agrega por turno (pregunta + respuesta)", int(ua)],
          [`Thinking por turno (${L})`, int(T.thinkingTokensPerTurn[L])],
          ["Entrada del turno 1", int(prefix + tok(p, id, T.masteryChars) + tok(p, id, T.studentMessageChars))],
          ["Entrada del turno 30", int(prefix + tok(p, id, T.masteryChars) + 29 * ua + tok(p, id, T.studentMessageChars))],
        ],
      ),
    );
  }

  h("3. Costo por estudiante ACTIVO (USD)");
  const rows3: (string | number)[][] = [];
  for (const mix of Object.values(mixes)) {
    for (const prof of Object.values(profiles)) {
      const c = studentMonth(p, mix, prof, true, L);
      const n = studentMonth(p, mix, prof, false, L);
      rows3.push([
        `${mix.label} · ${prof.label}`,
        int(c.messages),
        usd(c.total.usd),
        usd(n.total.usd),
        usd(c.total.usd * months),
        usd(n.total.usd * months),
        usd(c.total.usd / Math.max(c.messages, 1)),
      ]);
    }
  }
  out.push(
    table(["Mezcla · uso", "Mensajes/mes", "Mes con caché", "Mes sin caché", "Año con caché", "Año sin caché", "Por mensaje (con caché)"], rows3),
  );

  h("4. Desglose mensual por estudiante activo, con caché (USD)");
  const rows4: (string | number)[][] = [];
  for (const mix of Object.values(mixes)) {
    for (const prof of Object.values(profiles)) {
      const c = studentMonth(p, mix, prof, true, L);
      const tutorShareInput = c.tutor.cacheRead / Math.max(c.tutor.input, 1);
      rows4.push([
        `${mix.label} · ${prof.label}`,
        usd(c.tutor.usd),
        usd(c.practice.usd),
        usd(c.writing.usd),
        usd(c.total.usd),
        `${Math.round(tutorShareInput * 100)}%`,
        int(c.tutor.input),
        int(c.tutor.output),
      ]);
    }
  }
  out.push(
    table(["Mezcla · uso", "Tutor", "Práctica extra", "Retroalimentación de escritura", "Total", "Entrada del tutor leída de caché", "Tokens entrada tutor", "Tokens salida tutor"], rows4),
  );

  h("5. Sensibilidad al thinking (tokens de razonamiento por turno), con caché, USD por estudiante activo/mes");
  const rows5: (string | number)[][] = [];
  for (const mix of Object.values(mixes)) {
    for (const pk of ["typical", "cap"] as ProfileName[]) {
      rows5.push([
        `${mix.label} · ${profiles[pk].label}`,
        ...(["low", "typical", "high"] as Level[]).map((lv) => usd(studentMonth(p, mix, profiles[pk], true, lv).total.usd)),
      ]);
    }
  }
  out.push(table(["Mezcla · uso", `Bajo (${p.tutor.thinkingTokensPerTurn.low}/turno)`, `Típico (${p.tutor.thinkingTokensPerTurn.typical}/turno)`, `Alto (${p.tutor.thinkingTokensPerTurn.high}/turno)`], rows5));

  h(`6. Por sección de ${p.section.students} estudiantes (con caché, USD)`);
  const rows6: (string | number)[][] = [];
  for (const mix of Object.values(mixes)) {
    for (const prof of Object.values(profiles)) {
      const s = sectionMonth(p, mix, prof, true, L);
      rows6.push([`${mix.label} · ${prof.label}`, `${Math.round(prof.activeShareOfSection * 100)}%`, usd(s.studentsUsd), usd(s.teacherUsd), usd(s.total), usd(s.total * months)]);
    }
  }
  out.push(table(["Mezcla · uso", "Activos", "Estudiantes/mes", "Resumen docente/mes", "Sección/mes", "Sección/año"], rows6));
  out.push(`\nUn "Resumen para el docente" cuesta ${Object.values(mixes).map((m) => `${m.label}: ${usd(teacherSummary(p, m, L).usd)}`).join(" · ")}.`);

  h("7. A escala (estudiantes registrados; con caché, USD)");
  out.push("Solo la fracción activa del perfil genera costo; incluye un resumen docente por cada 35 estudiantes.\n");
  const rows7: (string | number)[][] = [];
  for (const mix of Object.values(mixes)) {
    for (const prof of Object.values(profiles)) {
      const cells: string[] = [];
      for (const n of p.scaleStudents) {
        const m = scaleMonth(p, mix, prof, true, L, n);
        cells.push(usd(m), usd(m * months));
      }
      rows7.push([`${mix.label} · ${prof.label}`, ...cells]);
    }
  }
  out.push(table(["Mezcla · uso", ...p.scaleStudents.flatMap((n) => [`${int(n)} / mes`, `${int(n)} / año`])], rows7));

  h("8. Costo único de generación de contenido (Español + Matemáticas 7.º–9.º, USD)");
  for (const mk of ["A"]) {
    const mix = mixes[mk];
    const std = oneOff(p, mix, L, false);
    const bat = oneOff(p, mix, L, true);
    const rows8 = std.map((l, i) => [
      l.label,
      model(p, mix[l.role]).label,
      int(l.tally.input),
      int(l.tally.output),
      usd(l.tally.usd),
      l.role === "tutor" ? "n/a (interactivo)" : usd(bat[i].tally.usd),
    ]);
    const totStd = std.reduce((s, l) => s + l.tally.usd, 0);
    const totBat = bat.reduce((s, l, i) => s + (std[i].role === "tutor" ? std[i].tally.usd : l.tally.usd), 0);
    rows8.push(["**Total**", "", "", "", `**${usd(totStd)}**`, `**${usd(totBat)}**`]);
    out.push(table(["Tarea", "Modelo", "Tokens entrada", "Tokens salida", "Estándar", "Con Batch API (50%)"], rows8));
    const lv = (["low", "high"] as Level[]).map((x) => `${x}: ${usd(oneOff(p, mix, x, false).reduce((s, l) => s + l.tally.usd, 0))}`);
    out.push(`\nSensibilidad al thinking (estándar) — ${lv.join(" · ")}. Las mezclas B y C solo cambian la fila de evals (el tutor).`);
  }

  h("9. Palancas: efecto estimado (A · Típico salvo indicación; USD por estudiante activo/mes, con caché)");
  {
    const base = studentMonth(p, mixes.A, profiles.typical, true, L).total.usd;
    const baseCap = studentMonth(p, mixes.A, profiles.cap, true, L).total.usd;
    const rows9: (string | number)[][] = [];
    const lever = (label: string, value: number, ref = base) => rows9.push([label, usd(ref), usd(value), pct(value / ref - 1)]);

    lever("Quitar el caché de prompts (como está hoy el adaptador)", studentMonth(p, mixes.A, profiles.typical, false, L).total.usd);
    {
      const q = clone(p);
      q.tutor.sharedPrefixWarmRate = 0.8;
      lever("Prefijo compartido caliente 80% (muchos estudiantes en la misma unidad)", studentMonth(q, mixes.A, profiles.typical, true, L).total.usd);
    }
    {
      const q = clone(p);
      for (const m of Object.values(q.prices.models) as ModelInfo[]) m.cacheWrite5m = m.cacheWrite1h;
      q.tutor.cacheMissRateBetweenTurns = 0.02; // ASSUMPTION: almost no student pauses > 1 h mid-session
      lever("Caché de 1 hora en vez de 5 min (escritura 2× en vez de 1,25×)", studentMonth(q, mixes.A, profiles.typical, true, L).total.usd);
    }
    {
      const q = clone(p);
      q.tutor.cacheMissRateBetweenTurns = 0.4;
      lever("Más pausas > 5 min entre mensajes (40% en vez de 15%)", studentMonth(q, mixes.A, profiles.typical, true, L).total.usd);
    }
    lever("Thinking bajo (esfuerzo `low`)", studentMonth(p, mixes.A, profiles.typical, true, "low").total.usd);
    lever("Thinking alto", studentMonth(p, mixes.A, profiles.typical, true, "high").total.usd);
    {
      const q = clone(p);
      q.tutor.unitContextChars = p.tutor.unitContextChars / 2;
      lever("Contexto de unidad a la mitad (solo la sección relevante)", studentMonth(q, mixes.A, profiles.typical, true, L).total.usd);
    }
    {
      const q = clone(p);
      q.tutor.replyChars = p.tutor.replyChars * 0.7;
      lever("Respuestas visibles 30% más cortas", studentMonth(q, mixes.A, profiles.typical, true, L).total.usd);
    }
    lever("Tutor con Sonnet 5.5 (mezcla B)", studentMonth(p, mixes.B, profiles.typical, true, L).total.usd);
    lever("Tutor con Sonnet 5.5 sin thinking (B0)", studentMonth(p, mixes.B0, profiles.typical, true, L).total.usd);
    lever("Tutor con Haiku 4.5 (mezcla C)", studentMonth(p, mixes.C, profiles.typical, true, L).total.usd);
    {
      const q = clone(p);
      q.profiles.cap.messagesPerSession = 20;
      lever("TOPE: límites 20/sesión y 40/día (en vez de 30 y 60)", studentMonth(q, mixes.A, q.profiles.cap, true, L).total.usd, baseCap);
    }
    {
      const q = clone(p);
      q.profiles.cap.messagesPerSession = 15;
      q.profiles.cap.sessionsPerActiveDay = 4;
      lever("TOPE: sesiones de 15 mensajes, 4 por día (mismos 60/día)", studentMonth(q, mixes.A, q.profiles.cap, true, L).total.usd, baseCap);
    }
    out.push(table(["Palanca", "Antes", "Después", "Cambio"], rows9));
    const std = oneOff(p, mixes.A, L, false).filter((l) => l.role !== "tutor").reduce((s, l) => s + l.tally.usd, 0);
    const bat = oneOff(p, mixes.A, L, true).filter((l) => l.role !== "tutor").reduce((s, l) => s + l.tally.usd, 0);
    out.push(`\nGeneración única sin evals: ${usd(std)} estándar → ${usd(bat)} con Batch API (${pct(bat / std - 1)}).`);
  }

  h("10. Cifras clave (A, con caché)");
  {
    const rows10: (string | number)[][] = [];
    for (const pk of ["typical", "cap"] as ProfileName[]) {
      const prof = profiles[pk];
      const m = studentMonth(p, mixes.A, prof, true, L).total.usd;
      const s = sectionMonth(p, mixes.A, prof, true, L);
      rows10.push([
        prof.label,
        usd(m),
        crc(p, m),
        usd(m * months),
        crc(p, m * months),
        usd(s.total),
        usd(s.total * months),
        ...p.scaleStudents.map((n) => usd(scaleMonth(p, mixes.A, prof, true, L, n) * months)),
      ]);
    }
    {
      const prof = profiles.cap;
      const m = studentMonth(p, mixes.A, prof, true, "high").total.usd;
      const s = sectionMonth(p, mixes.A, prof, true, "high");
      rows10.push([
        "Tope + thinking alto (peor caso)",
        usd(m),
        crc(p, m),
        usd(m * months),
        crc(p, m * months),
        usd(s.total),
        usd(s.total * months),
        ...p.scaleStudents.map((n) => usd(scaleMonth(p, mixes.A, prof, true, "high", n) * months)),
      ]);
    }
    out.push(
      table(
        ["Uso", "Estudiante/mes", "₡/mes (supuesto)", "Estudiante/año", "₡/año (supuesto)", "Sección/mes", "Sección/año", ...p.scaleStudents.map((n) => `${int(n)} est./año`)],
        rows10,
      ),
    );
    out.push(`\nColones al tipo de cambio supuesto de ₡${p.crcPerUsd}/USD (verificar BCCR).`);
  }

  console.log(out.join("\n"));
}

main(PARAMS);
