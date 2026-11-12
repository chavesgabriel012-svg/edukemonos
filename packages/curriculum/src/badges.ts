/**
 * Fase 5 (docs/producto/gamificacion.md §8): symbolic recognition. Only for mastery, never lost.
 * The database awards the badges (triggers on mastery and on a completed week); this is the same
 * logic in TypeScript for the UI and for the tests that compare both.
 */
import { MASTERED } from "./section-goal";

export const STREAK_MILESTONES = [4, 8, 12] as const;

export type BadgeKind = "skill_mastered" | "unit_mastered" | "first_week" | "streak_4" | "streak_8" | "streak_12";

export const BADGE_INFO: Record<BadgeKind, { title: string; description: string }> = {
  skill_mastered: { title: "Habilidad dominada", description: "Tu dominio estimado de una habilidad llegó a 70 %." },
  unit_mastered: { title: "Unidad dominada", description: "Todas las habilidades de un tema llegaron a 70 %." },
  first_week: { title: "Primera semana cumplida", description: "Cumpliste por primera vez la meta de ejercicios de una semana." },
  streak_4: { title: "Racha de 4 semanas", description: "Tu mejor racha llegó a 4 semanas seguidas." },
  streak_8: { title: "Racha de 8 semanas", description: "Tu mejor racha llegó a 8 semanas seguidas." },
  streak_12: { title: "Racha de 12 semanas", description: "Tu mejor racha llegó a 12 semanas seguidas." },
};

/** The streak badges a record (best streak, in weeks) has earned. */
export function streakBadges(record: number): BadgeKind[] {
  const out: BadgeKind[] = [];
  if (record >= 1) out.push("first_week");
  for (const m of STREAK_MILESTONES) if (record >= m) out.push(`streak_${m}` as BadgeKind);
  return out;
}

/** The next streak badge to earn, or null when all are earned. */
export function nextStreakBadge(record: number): { badge: BadgeKind; weeks: number } | null {
  if (record < 1) return { badge: "first_week", weeks: 1 };
  const m = STREAK_MILESTONES.find((x) => record < x);
  return m ? { badge: `streak_${m}` as BadgeKind, weeks: m } : null;
}

/** A unit is mastered when it has skills and every one of them is at 0.70 or more. */
export function unitMastered(skillScores: (number | null)[]): boolean {
  return skillScores.length > 0 && skillScores.every((s) => s !== null && s >= MASTERED);
}

/** The winning team(s) of a closed tournament: the highest score, if anybody scored. */
export function tournamentWinners(teams: { name: string; score: number }[]): string[] {
  if (!teams.length) return [];
  const top = Math.max(...teams.map((t) => t.score));
  if (top <= 0) return [];
  return teams.filter((t) => t.score === top).map((t) => t.name).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Verification code of a unit certificate: «7F3A2-9C01B». */
export const CERTIFICATE_CODE = /^[0-9A-F]{5}-[0-9A-F]{5}$/;

export function normalizeCertificateCode(raw: string): string {
  const hex = raw.toUpperCase().replace(/[^0-9A-F]/g, "");
  return hex.length === 10 ? `${hex.slice(0, 5)}-${hex.slice(5)}` : raw.trim().toUpperCase();
}
