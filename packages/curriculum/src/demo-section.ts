/**
 * Demo section for the teacher panel (PLAN 5.5): synthetic, clearly labelled students over the real
 * published units. Deterministic (seeded), so the demo and its AI summary are the same every time.
 * Mastery comes from the same update rule the platform uses for real answers.
 */
import { pCorrect, updateMastery } from "./learning";
import { weekStartCR } from "./streak";
import type { PanelAttempt, PanelDiagnostic, PanelMastery, PanelStudent, PanelTutorSession, PanelUnit, PanelWriting, SectionData } from "./teacher";
import { tournamentWinners } from "./badges";
import { addWeeks } from "./streak";
import { memberPoints, snakeTeams, type TournamentReport, teamScore, tournamentStatus, tournamentWindow } from "./tournament";

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
  name: "7-3 · Matemáticas (demostración)",
  groupName: "7-3 (demostración)",
  subjectId: "matematicas",
  subjectName: "Matemáticas",
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
        // About one in five answers comes from a mini-game (fase 3); chosen by position, not by the random
        // generator, so the rest of the demo stays the same.
        attempts.push({ studentId: id, unitId: unit.id, isCorrect: correct, createdAt: when, context: attempts.length % 5 === 4 ? "game" : "practice" });
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

/** Weekly streak of the demo section (fictitious, labelled as demo): aggregates only. */
export const DEMO_STREAK = {
  students: 26,
  met_this_week: 15,
  with_streak: 18,
  longest: 7,
  target: 5,
  enabled: true,
  paused: false,
} as const;

/** Weekly goal and table of the demo section (fictitious, labelled as demo). */
export const DEMO_GOAL = {
  enabled: true,
  target: 15,
  progress: 11,
  paused: false,
  active_students: 24,
  history: [12, 14, 13, 15],
} as const;

export const DEMO_LEADERBOARD_SUMMARY = { members: 26, with_nickname: 21, hidden: 3 } as const;

/**
 * Demo of a teacher with several groups: Math in 7-1 and 7-4, Spanish in 7-1 (fictitious data,
 * labelled as demo). Each section is a demo section of a different size.
 */
export const DEMO_TEACHER_SECTIONS = [
  { id: "demo-71-mat", group: "7-1", subjectId: "matematicas", subjectName: "Matemáticas", students: 28 },
  { id: "demo-74-mat", group: "7-4", subjectId: "matematicas", subjectName: "Matemáticas", students: 22 },
  { id: "demo-71-esp", group: "7-1", subjectId: "espanol", subjectName: "Español", students: 28 },
] as const;

/** Fixed team names for the demo, from the safe list. */
const DEMO_TEAM_NAMES = ["Equipo Ceiba", "Equipo Quetzal", "Equipo Volcán", "Equipo Colibrí", "Equipo Tapir", "Equipo Orquídea", "Equipo Lapa", "Equipo Roble"];

/**
 * This week's tournament of the demo section (fictitious, labelled as demo): the students drafted
 * into teams by their mastery, as the database does, with made-up answers and mastery gains.
 * The topics are the three units the class worked most in the last week.
 */
export function buildDemoTournament(data: SectionData): TournamentReport {
  const r = rng(20261113);
  const unitOf = new Map(data.units.flatMap((u) => u.skillIds.map((k) => [k, u.id] as const)));
  // Friday to Sunday this week's is open; Monday to Thursday the demo shows last week's, closed.
  const thisWeek = weekStartCR(data.now);
  const open = tournamentStatus(thisWeek, data.now) === "open";
  const week = open ? thisWeek : addWeeks(thisWeek, -1);
  const recent = data.attempts.filter((a) => a.unitId && data.now.getTime() - Date.parse(a.createdAt) < 7 * 86_400_000);
  const byUnit = new Map<string, number>();
  for (const a of recent) byUnit.set(a.unitId!, (byUnit.get(a.unitId!) ?? 0) + 1);
  const topicUnits = [...byUnit.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);
  const topics = topicUnits.map((id) => data.units.find((u) => u.id === id)!.title);

  const level = (studentId: string) => {
    const scores = data.mastery.filter((m) => m.studentId === studentId && topicUnits.includes(unitOf.get(m.skillId) ?? "")).map((m) => m.score);
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.5;
  };
  const drafted = snakeTeams(data.students.map((s) => ({ id: s.id, level: level(s.id) })));
  const names = new Map(data.students.map((s) => [s.id, s.name]));
  const teams = drafted.map((ids, k) => {
    const members = ids.map((id) => {
      const played = r() > 0.15;
      const correct = played ? Math.floor(3 + r() * 8) : 0;
      const improvement = played ? Math.round(r() * 30) / 100 : 0;
      return { member: { student_id: id, name: names.get(id) ?? "", improvement: Math.round(improvement * 100), played, late: false }, points: memberPoints(correct, improvement) };
    });
    return {
      name: DEMO_TEAM_NAMES[k % DEMO_TEAM_NAMES.length],
      score: teamScore(members.map((m) => m.points)),
      members: members.map((m) => m.member).sort((a, b) => a.name.localeCompare(b.name, "es")),
    };
  }).sort((a, b) => b.score - a.score);

  const { opensAt, closesAt } = tournamentWindow(week);
  const current = tournamentWindow(thisWeek);
  return {
    enabled: true,
    status: open ? "open" : "upcoming",
    opens_at: current.opensAt.toISOString(),
    closes_at: current.closesAt.toISOString(),
    tournament: {
      id: "demo",
      week_start: week,
      opens_at: opensAt.toISOString(),
      closes_at: closesAt.toISOString(),
      closed: !open,
      winners: open ? [] : tournamentWinners(teams),
      topics,
      teams,
    },
  };
}

/** The guide's view of the demo group: the last tournament of each subject (fictitious). */
export function buildDemoGroupTournaments(math: TournamentReport): { section: string; subject: string; week_start: string; closed: boolean; winners: string[] }[] {
  const t = math.tournament;
  if (!t) return [];
  return [
    { section: "7-3 · Español", subject: "Español", week_start: t.week_start, closed: Boolean(t.closed), winners: t.closed ? ["Equipo Guanacaste"] : [] },
    { section: DEMO_SECTION.name, subject: DEMO_SECTION.subjectName, week_start: t.week_start, closed: Boolean(t.closed), winners: t.winners ?? [] },
  ];
}
