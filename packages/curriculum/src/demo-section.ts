/**
 * Demo section for the teacher panel (PLAN 5.5): synthetic, clearly labelled students over the real
 * published units. Deterministic (seeded), so the demo and its AI summary are the same every time.
 * Mastery comes from the same update rule the platform uses for real answers.
 */
import { pCorrect, updateMastery } from "./learning";
import type { PanelAttempt, PanelDiagnostic, PanelMastery, PanelStudent, PanelTutorSession, PanelUnit, PanelWriting, SectionData } from "./teacher";

/** Small, fast, seedable PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(r: () => number) {
  const u = Math.max(r(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

// Synthetic names: common first names with a letter, so no real student is implied.
const FIRST = [
  "Valeria", "Mateo", "Sofía", "Santiago", "Camila", "Daniel", "Isabella", "Sebastián", "Mariana", "Gabriel",
  "Ximena", "Josué", "Fernanda", "Andrés", "Natalia", "Emmanuel", "Allison", "Kendall", "Dayana", "Fabián",
  "Ashley", "Jefferson", "María José", "Esteban", "Hillary", "Joel",
];
const LETTERS = "ABCDEFGHJKLMNPRSTV";

export const DEMO_SECTION = {
  id: "demo",
  name: "7-3 (demostración)",
  gradeId: 7,
  institution: "Liceo de demostración",
  term: 2,
  joinCode: "DEMO23",
} as const;

const WRITING_WEIGHTS: [string, number][] = [
  ["tildes", 9], ["puntuacion", 6], ["mayusculas", 4], ["concordancia", 3], ["c_s_z", 3], ["b_v", 2], ["cohesion", 2], ["h", 1], ["g_j", 1],
];

/**
 * Builds the demo section. `units` are the real published units of the grade (all subjects);
 * the class has covered roughly the first half of each subject, and two of those units are hard for it.
 */
export function buildDemoSection(units: PanelUnit[], now = new Date(), studentCount = 26): SectionData {
  const r = rng(20261012);
  const day = 86_400_000;
  const at = (daysBack: number) => new Date(now.getTime() - daysBack * day - Math.floor(r() * 10) * 3_600_000).toISOString();

  const bySubject = new Map<string, PanelUnit[]>();
  for (const u of [...units].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!bySubject.has(u.subjectId)) bySubject.set(u.subjectId, []);
    bySubject.get(u.subjectId)!.push(u);
  }
  // Units "taught so far" and how well this class handles each one: mastery estimates ability
  // (it already discounts item difficulty), so a hard unit is one where the class's ability is lower.
  const taught: { unit: PanelUnit; offset: number }[] = [];
  for (const list of bySubject.values()) {
    const covered = list.slice(0, Math.max(3, Math.ceil(list.length / 2)));
    covered.forEach((unit, i) => taught.push({ unit, offset: i === 1 || i === covered.length - 1 ? -1.5 : i === 0 ? 1.1 : 0.3 + r() * 0.6 }));
  }

  const students: PanelStudent[] = [];
  const mastery: PanelMastery[] = [];
  const attempts: PanelAttempt[] = [];
  const diagnostics: PanelDiagnostic[] = [];
  const tutor: PanelTutorSession[] = [];
  const writing: PanelWriting[] = [];

  for (let i = 0; i < studentCount; i++) {
    const id = `demo-${String(i + 1).padStart(2, "0")}`;
    students.push({ id, name: `${FIRST[i % FIRST.length]} ${LETTERS[(i * 7) % LETTERS.length]}.`, joinedAt: new Date(now.getTime() - 40 * day).toISOString() });
    const ability = 0.95 + normal(r) * 0.8;
    // Activity profile: most students practise weekly, a few stopped, two never started.
    const profile = i % 13 === 5 ? "nunca" : i % 7 === 3 ? "dejo" : r() < 0.35 ? "alta" : "media";
    if (profile === "nunca") continue;
    const lastDay = profile === "dejo" ? 9 + Math.floor(r() * 10) : Math.floor(r() * 4);
    const perUnit = profile === "alta" ? 16 : profile === "media" ? 10 : 6;

    const scores = new Map<string, { score: number | null; n: number; last: string }>();
    for (const { unit, offset } of taught) {
      if (r() < (profile === "alta" ? 0.05 : 0.3)) continue;
      const count = Math.max(1, Math.round(perUnit * (0.6 + r() * 0.8)));
      const theta = ability + offset + normal(r) * 0.3;
      for (let k = 0; k < count; k++) {
        const itemDifficulty = Math.min(5, Math.max(1, Math.round(3 + normal(r) * 0.8)));
        const correct = r() < pCorrect(theta, itemDifficulty);
        const when = at(lastDay + Math.floor(r() * 24));
        attempts.push({ studentId: id, unitId: unit.id, isCorrect: correct, createdAt: when, context: "practice" });
        for (const skillId of unit.skillIds.slice(0, 1 + Math.floor(r() * unit.skillIds.length))) {
          const prev = scores.get(skillId) ?? { score: null, n: 0, last: when };
          scores.set(skillId, { score: updateMastery(prev.score, prev.n, itemDifficulty, correct), n: prev.n + 1, last: when > prev.last ? when : prev.last });
        }
      }
      // Students who struggle ask the tutor more.
      if (r() < (theta < -0.3 ? 0.6 : 0.15)) {
        tutor.push({ studentId: id, unitId: unit.id, messageCount: 2 * (1 + Math.floor(r() * 6)), startedAt: at(lastDay + Math.floor(r() * 20)) });
      }
    }
    for (const [skillId, v] of scores) {
      if (v.score !== null) mastery.push({ studentId: id, skillId, score: v.score, attempts: v.n, updatedAt: v.last });
    }
    for (const subjectId of bySubject.keys()) {
      if (r() < 0.75) {
        const level = Math.min(5, Math.max(1, 3 + (ability - 0.75) * 0.9 + normal(r) * 0.3));
        diagnostics.push({ studentId: id, subjectId, level: Math.round(level * 10) / 10, completedAt: at(20 + Math.floor(r() * 15)) });
      }
    }
    if (bySubject.has("espanol") && r() < 0.8) {
      const total = WRITING_WEIGHTS.reduce((a, [, w]) => a + w, 0);
      for (let t = 0; t < 1 + Math.floor(r() * 3); t++) {
        const createdAt = at(lastDay + Math.floor(r() * 20));
        for (let e = 0; e < 3 + Math.floor(r() * 6) + (ability < 0 ? 3 : 0); e++) {
          let x = r() * total;
          const [category] = WRITING_WEIGHTS.find(([, w]) => (x -= w) < 0) ?? WRITING_WEIGHTS[0];
          writing.push({ studentId: id, category, count: 1, createdAt });
        }
      }
    }
  }
  return { students, units, mastery, attempts, diagnostics, tutor, writing, now };
}
