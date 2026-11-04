/**
 * Fase 2 (docs/producto/gamificacion.md §5): weekly goal of a section and the nickname table.
 * The database computes both (section_goal(), section_leaderboard()); this is the same logic in
 * TypeScript for the demo and for tests that compare them.
 */

/** Mastery from which a skill counts as mastered (same as STRONG in learning.ts). */
export const MASTERED = 0.7;

/** Fewer ranked students than this and the table is not shown at all (nobody can be singled out). */
export const MIN_RANKED = 4;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * "Between all of us, we master X skills this week". Without history, half a skill per active
 * student; with history (skills mastered in the last school weeks), 10 % above the median, so the
 * goal follows the size and the level of the section. Never below 3.
 */
export function goalTarget(activeStudents: number, history: number[]): number {
  const active = Math.max(1, activeStudents);
  if (!history.some((h) => h > 0)) return Math.max(3, Math.ceil(0.5 * active));
  return Math.max(3, Math.ceil(1.1 * median(history)));
}

export interface LeaderboardEntry {
  id: string;
  nickname: string | null;
  hidden: boolean;
  /** Sum of the week's mastery changes (score_end − score_start), 0..n. */
  improvement: number;
}

export interface LeaderboardRow {
  nickname: string;
  /** Improvement in points (×100, rounded). */
  points: number;
  me: boolean;
}

/**
 * What one student sees: their own row and up to 2 classmates above and 2 below, never the full
 * ordered list and never the last place. Only students with a nickname, not hidden and with a
 * positive improvement are ranked; with fewer than MIN_RANKED, nothing is shown.
 */
export function leaderboardWindow(entries: LeaderboardEntry[], meId: string): LeaderboardRow[] {
  const ranked = entries
    .filter((e) => e.nickname && !e.hidden && e.improvement > 0)
    .sort((a, b) => b.improvement - a.improvement || a.id.localeCompare(b.id));
  if (ranked.length < MIN_RANKED) return [];
  const last = ranked[ranked.length - 1];
  const pool = last.id === meId ? ranked : ranked.slice(0, -1);
  const i = pool.findIndex((e) => e.id === meId);
  if (i === -1) return [];
  return pool.slice(Math.max(0, i - 2), i + 3).map((e) => ({ nickname: e.nickname!, points: Math.round(e.improvement * 100), me: e.id === meId }));
}

/** Safe nickname parts: Costa Rican nature + adjectives with no gender. Reviewed by people. */
export const NICKNAME_NOUNS = [
  "Tucán", "Colibrí", "Jaguar", "Quetzal", "Lapa", "Tortuga", "Delfín", "Manatí", "Danta", "Rana",
  "Mariposa", "Ballena", "Garza", "Pelícano", "Armadillo", "Ocelote", "Puma", "Iguana", "Oropéndola", "Momoto",
  "Guacamaya", "Coral", "Ceiba", "Guanacaste", "Orquídea", "Helecho", "Cacao", "Volcán", "Arrecife", "Bromelia",
  "Almendro", "Roble", "Cedro", "Yigüirro", "Tapir", "Venado", "Cocodrilo", "Mantarraya", "Luciérnaga", "Halcón",
] as const;

export const NICKNAME_ADJECTIVES = [
  "Azul", "Verde", "Veloz", "Feliz", "Audaz", "Valiente", "Brillante", "Alegre", "Amable", "Constante",
  "Gentil", "Fuerte", "Ágil", "Libre", "Leal", "Tenaz", "Radiante", "Paciente",
] as const;

/** "Tucán Azul 27": noun + adjective + a number 10–99, so names are unique across Eduka. */
export const NICKNAME_PATTERN = new RegExp(
  `^(${NICKNAME_NOUNS.join("|")}) (${NICKNAME_ADJECTIVES.join("|")}) ([1-9][0-9])$`,
  "u",
);

export function isSafeNickname(nickname: string): boolean {
  return NICKNAME_PATTERN.test(nickname);
}
