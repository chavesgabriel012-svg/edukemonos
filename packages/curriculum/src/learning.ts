/**
 * Mastery, adaptive diagnostic and study path (SPEC §9). Rationale and worked numbers live in
 * docs/diagnostic.md. The database applies the same formulas (supabase/migrations/
 * 20261004000100_student_learning.sql); supabase/tests checks that both give the same numbers.
 *
 * Model: a one-parameter logistic (Rasch-like) scale in logits.
 *   - item difficulty d ∈ 1..5 sits at b(d) = (d − 3) × 0.8   (3 = the grade's level)
 *   - P(correct | θ, d) = σ(θ − b(d))
 *   - mastery of a skill = σ(θ): chance of solving a grade-level item of that skill
 */

export const DIFFICULTY_STEP = 0.8;
export const MIN_SCORE = 0.02;
export const MAX_SCORE = 0.98;

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function itemLocation(difficulty: number): number {
  return (clamp(Math.round(difficulty), 1, 5) - 3) * DIFFICULTY_STEP;
}

export function pCorrect(theta: number, difficulty: number): number {
  return sigmoid(theta - itemLocation(difficulty));
}

/** θ from a stored score, clamped so a single lucky or unlucky answer is never "certain". */
export function thetaOf(score: number): number {
  const s = clamp(score, MIN_SCORE, MAX_SCORE);
  return Math.log(s / (1 - s));
}

/** Learning rate: large for the first answers, settling as evidence accumulates. */
export function kFactor(previousAttempts: number): number {
  return Math.max(0.3, 1.2 / (1 + 0.25 * Math.max(0, previousAttempts)));
}

/**
 * Elo-style update of one skill after one answer. `score` is null when there is no data yet
 * (prior θ = 0, i.e. 0.5). Returns the new score in [MIN_SCORE, MAX_SCORE].
 */
export function updateMastery(score: number | null, previousAttempts: number, difficulty: number, correct: boolean): number {
  const theta = score === null ? 0 : thetaOf(score);
  const next = theta + kFactor(previousAttempts) * ((correct ? 1 : 0) - pCorrect(theta, difficulty));
  return clamp(sigmoid(next), MIN_SCORE, MAX_SCORE);
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export const DIAGNOSTIC_LENGTH = 10;
export const DIAGNOSTIC_START_DIFFICULTY = 3;

export interface DiagnosticResponse {
  difficulty: number;
  correct: boolean;
}

/** Staircase: one step up after a correct answer, one down after a wrong one, within 1..5. */
export function nextDifficulty(responses: DiagnosticResponse[]): number {
  const last = responses.at(-1);
  if (!last) return DIAGNOSTIC_START_DIFFICULTY;
  return clamp(last.difficulty + (last.correct ? 1 : -1), 1, 5);
}

/**
 * Ability estimate after a diagnostic: maximum a posteriori with a standard normal prior
 * (Newton's method). The prior keeps all-correct or all-wrong runs finite.
 */
export function estimateAbility(responses: DiagnosticResponse[]): number {
  let theta = 0;
  for (let i = 0; i < 25; i++) {
    let gradient = -theta;
    let curvature = -1;
    for (const r of responses) {
      const p = pCorrect(theta, r.difficulty);
      gradient += (r.correct ? 1 : 0) - p;
      curvature -= p * (1 - p);
    }
    const step = gradient / curvature;
    theta -= step;
    if (Math.abs(step) < 1e-6) break;
  }
  return theta;
}

/** Level on the difficulty scale (3 = what the grade expects), one decimal. */
export function levelOf(theta: number): number {
  return Math.round(clamp(3 + theta / DIFFICULTY_STEP, 1, 5) * 10) / 10;
}

export interface CandidateItem {
  id: string;
  unit_id: string;
  difficulty: number;
}

/**
 * Picks the next diagnostic item: closest to the target difficulty, from the unit asked about
 * least so far (so the diagnostic covers the subject), never repeating an item. `units` gives
 * curriculum order for ties; `random` breaks remaining ties.
 */
export function pickDiagnosticItem(
  candidates: CandidateItem[],
  usedItemIds: string[],
  usedUnitIds: string[],
  target: number,
  units: string[],
  random: () => number = Math.random,
): CandidateItem | null {
  const used = new Set(usedItemIds);
  const pool = candidates.filter((c) => !used.has(c.id));
  if (pool.length === 0) return null;
  const unitCount = new Map<string, number>();
  for (const u of usedUnitIds) unitCount.set(u, (unitCount.get(u) ?? 0) + 1);
  const order = new Map(units.map((u, i) => [u, i]));
  const ranked = pool
    .map((c) => ({ c, key: [Math.abs(c.difficulty - target), unitCount.get(c.unit_id) ?? 0, order.get(c.unit_id) ?? 1e6] as const }))
    .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2]);
  const best = ranked.filter((r) => r.key[0] === ranked[0].key[0] && r.key[1] === ranked[0].key[1] && r.key[2] === ranked[0].key[2]);
  return best[Math.floor(random() * best.length)].c;
}

// ---------------------------------------------------------------------------
// Feedback and study path
// ---------------------------------------------------------------------------

export const STRONG = 0.7;
export const WEAK = 0.5;

/** Kind, non-labelling wording for a level (SPEC §9: avoid negative labels). */
export function levelMessage(level: number): string {
  if (level >= 3.5) return "Vas muy bien: dominas lo que se espera en este grado y puedes ir por retos.";
  if (level >= 2.5) return "Vas por buen camino: tienes la base del grado y hay temas que puedes afianzar.";
  return "Conviene repasar las bases: empieza por los temas sugeridos, paso a paso.";
}

export interface PathUnit {
  id: string;
  title: string;
  sort_order: number;
  skill_ids: string[];
}

export interface PathEntry {
  unit: PathUnit;
  /** Mean mastery of the unit's skills that have data; null when none has data yet. */
  mastery: number | null;
  status: "reforzar" | "por_explorar" | "dominado";
}

/**
 * Suggested route: units not yet mastered, in curriculum order (the programs present prerequisites
 * first), with the ones to reinforce ahead of the ones not explored yet. Mastered units go last.
 */
export function studyPath(units: PathUnit[], mastery: Map<string, number>): PathEntry[] {
  const entries: PathEntry[] = units.map((unit) => {
    const known = unit.skill_ids.flatMap((s) => (mastery.has(s) ? [mastery.get(s)!] : []));
    const m = known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
    const status = m === null ? "por_explorar" : m >= STRONG ? "dominado" : m < WEAK ? "reforzar" : "por_explorar";
    return { unit, mastery: m, status };
  });
  const rank = { reforzar: 0, por_explorar: 1, dominado: 2 } as const;
  return entries.sort((a, b) => rank[a.status] - rank[b.status] || a.unit.sort_order - b.unit.sort_order);
}

// ---------------------------------------------------------------------------
// Practice
// ---------------------------------------------------------------------------

/** Practice difficulty that suits a mastery score: the grade level ± how far the student is from it. */
export function practiceTarget(score: number | null): number {
  return score === null ? DIAGNOSTIC_START_DIFFICULTY : Math.round(levelOf(thetaOf(score)));
}

export interface PracticeHistory {
  item_id: string;
  is_correct: boolean | null;
  created_at: string;
}

/**
 * Next practice item of a unit: first the ones never answered, closest to the target difficulty;
 * once all were seen, the ones last answered wrong, then the least recently answered.
 */
export function pickPracticeItem<T extends { id: string; difficulty: number }>(
  items: T[],
  history: PracticeHistory[],
  target: number,
  excludeId: string | null = null,
  random: () => number = Math.random,
): T | null {
  const pool = items.filter((i) => i.id !== excludeId);
  if (pool.length === 0) return items[0] ?? null;
  const last = new Map<string, PracticeHistory>();
  for (const h of [...history].sort((a, b) => a.created_at.localeCompare(b.created_at))) last.set(h.item_id, h);
  const unseen = pool.filter((i) => !last.has(i.id));
  if (unseen.length) {
    const best = Math.min(...unseen.map((i) => Math.abs(i.difficulty - target)));
    const closest = unseen.filter((i) => Math.abs(i.difficulty - target) === best);
    return closest[Math.floor(random() * closest.length)];
  }
  return [...pool].sort((a, b) => {
    const ha = last.get(a.id)!;
    const hb = last.get(b.id)!;
    const wrong = Number(hb.is_correct === false) - Number(ha.is_correct === false);
    return wrong || ha.created_at.localeCompare(hb.created_at);
  })[0];
}
