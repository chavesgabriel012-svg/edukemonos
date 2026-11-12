/**
 * Fase 4 (docs/producto/gamificacion.md §7): the Friday tournament of a section. The database
 * builds and scores it (ensure_tournament(), private.tournament_scores()); this is the same logic
 * in TypeScript for the UI, the demo and the tests that compare both.
 *
 * - It opens on Friday at 00:00 and closes on Sunday at 23:59, Costa Rica time.
 * - Topics: the skills the section worked that week, at most MAX_TOPICS (the ones most students worked).
 * - Teams of 3 to 5 active students, balanced by mastery with a snake draft.
 * - Points: 1 per right answer to a tournament question (at most 10 count) plus 1 for every 0.05
 *   of mastery gained in the topics that week. Never for speed. A team scores the mean per member.
 * - A student sees their own team and the teams above the last one; never the last place.
 */
import { addWeeks } from "./streak";
import { NICKNAME_NOUNS } from "./section-goal";

/** Fewer active students than this and there is no tournament (two teams of 3 at least). */
export const MIN_PARTICIPANTS = 6;
export const TEAM_MAX = 5;
/** Right answers that count per student, so nobody carries the whole team. */
export const MAX_COUNTED_CORRECT = 10;
/** Questions a student gets in one tournament. */
export const QUESTIONS_PER_STUDENT = 10;
/** One point for every this much mastery gained in the topics during the week. */
export const IMPROVEMENT_STEP = 0.05;
/** The most worked skills of the week; more topics would make the tournament about everything. */
export const MAX_TOPICS = 8;

/** Team names: the same safe list as nicknames («Equipo Ceiba»). */
export const TEAM_NAMES = NICKNAME_NOUNS.map((n) => `Equipo ${n}`);

/** Byte order, the same as `collate "C"` in the database (localeCompare would ignore the hyphens of a uuid). */
const byBytes = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** How many teams for `n` active students: teams of at most 5, and none below MIN_PARTICIPANTS. */
export function teamCount(n: number): number {
  return n < MIN_PARTICIPANTS ? 0 : Math.ceil(n / TEAM_MAX);
}

export interface DraftStudent {
  id: string;
  /** Mean mastery in the tournament's topics (0.5 when there is no data). */
  level: number;
}

/**
 * Balanced teams with a snake draft over the students sorted by level (highest first; ties by id):
 * team order 0, 1, …, k−1, k−1, …, 0, 0, 1, … so every team gets strong and weaker students.
 */
export function snakeTeams(students: DraftStudent[]): string[][] {
  const k = teamCount(students.length);
  if (k === 0) return [];
  const teams: string[][] = Array.from({ length: k }, () => []);
  const sorted = [...students].sort((a, b) => b.level - a.level || byBytes(a.id, b.id));
  sorted.forEach((s, i) => {
    const round = Math.floor(i / k);
    const pos = i % k;
    teams[round % 2 === 0 ? pos : k - 1 - pos].push(s.id);
  });
  return teams;
}

/** A student who arrives after the teams were made joins the smallest one (the first, on a tie). */
export function lateJoinTeam(sizes: number[]): number {
  return sizes.reduce((best, size, i) => (size < sizes[best] ? i : best), 0);
}

/** Points of one member: right answers (at most 10) plus one per 0.05 of mastery gained. */
export function memberPoints(correct: number, improvement: number): number {
  // Rounded to 4 decimals first, so 0.15 gives 3 and not 2 (0.15 / 0.05 = 2.999… in floating point).
  const steps = Math.floor(Math.round(Math.max(0, improvement) * 10_000) / (IMPROVEMENT_STEP * 10_000));
  return Math.min(Math.max(0, correct), MAX_COUNTED_CORRECT) + steps;
}

/** A team's score: the mean of its members' points, one decimal, so big teams are not favoured. */
export function teamScore(points: number[]): number {
  if (!points.length) return 0;
  return Math.round((points.reduce((a, b) => a + b, 0) / points.length) * 10) / 10;
}

export interface TeamResult {
  id: string;
  name: string;
  score: number;
}

/**
 * The teams one student sees: their own and every team above the lowest score, by score. Teams
 * with the lowest score are left out unless it is the student's own (and then nothing marks it);
 * if every team has the same score, only their own is shown.
 */
export function visibleTeams(teams: TeamResult[], mine: string | null): (TeamResult & { me: boolean })[] {
  if (!teams.length) return [];
  const low = Math.min(...teams.map((t) => t.score));
  return [...teams]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "es"))
    .filter((t) => t.id === mine || t.score > low)
    .map((t) => ({ ...t, me: t.id === mine }));
}

export interface TopicRow {
  skillId: string;
  studentId: string;
  attempts: number;
}

/** The week's topics: skills worked by most students (then most attempts, then id), at most MAX_TOPICS. */
export function pickTopics(rows: TopicRow[]): string[] {
  const by = new Map<string, { students: Set<string>; attempts: number }>();
  for (const r of rows) {
    if (r.attempts <= 0) continue;
    const e = by.get(r.skillId) ?? { students: new Set<string>(), attempts: 0 };
    e.students.add(r.studentId);
    e.attempts += r.attempts;
    by.set(r.skillId, e);
  }
  return [...by.entries()]
    .sort(([a, x], [b, y]) => y.students.size - x.students.size || y.attempts - x.attempts || byBytes(a, b))
    .slice(0, MAX_TOPICS)
    .map(([id]) => id);
}

export type TournamentStatus = "upcoming" | "open" | "closed";

/** Friday 00:00 to the next Monday 00:00 (Costa Rica, UTC−6) of the week that starts on `week`. */
export function tournamentWindow(week: string): { opensAt: Date; closesAt: Date } {
  const at = (day: string) => new Date(`${day}T06:00:00Z`);
  const friday = new Date(Date.parse(`${week}T00:00:00Z`) + 4 * 86_400_000).toISOString().slice(0, 10);
  return { opensAt: at(friday), closesAt: at(addWeeks(week, 1)) };
}

export function tournamentStatus(week: string, now: Date): TournamentStatus {
  const { opensAt, closesAt } = tournamentWindow(week);
  if (now < opensAt) return "upcoming";
  return now < closesAt ? "open" : "closed";
}

// ---------------------------------------------------------------------------
// What the database returns (section_tournament(), section_tournament_report()), shared by the
// web and the demo.
// ---------------------------------------------------------------------------

export type TournamentPhase = "upcoming" | "open" | "closed" | "none";

/** A student's view: their team and points, and the teams above the last. Never names or ids. */
export interface StudentTournament {
  enabled: boolean;
  status?: TournamentPhase;
  opens_at?: string;
  closes_at?: string;
  tournament?: {
    id: string;
    week_start: string;
    opens_at: string;
    closes_at: string;
    /** Closed tournaments show their winners until the next one opens (fase 5). */
    closed?: boolean;
    winners?: string[];
    topics: string[];
    teams: { name: string; score: number; me: boolean }[];
    me: {
      team: string;
      team_size: number;
      team_score: number;
      answered: number;
      correct: number;
      counted: number;
      improvement_points: number;
      points: number;
      questions: number;
      started: boolean;
    } | null;
  } | null;
}

export interface TournamentReportMember {
  student_id: string;
  name: string;
  /** Mastery gained in the topics this week, in points (× 100). */
  improvement: number;
  played: boolean;
  late: boolean;
}

/** The teacher's view: every team, its score and what each student added to their mastery. */
export interface TournamentReport {
  enabled: boolean;
  status?: TournamentPhase;
  opens_at?: string;
  closes_at?: string;
  tournament?: {
    id: string;
    week_start: string;
    opens_at: string;
    closes_at: string;
    closed?: boolean;
    winners?: string[];
    topics: string[];
    teams: { name: string; score: number; members: TournamentReportMember[] }[];
  } | null;
}

/** The last tournament of each subject of a group, for its guide (group_tournaments()). */
export interface GroupTournament {
  section: string;
  subject: string;
  week_start: string;
  closed: boolean;
  winners: string[];
}
