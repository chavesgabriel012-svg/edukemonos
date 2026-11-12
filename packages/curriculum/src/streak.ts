/**
 * Weekly mastery streak (docs/producto/gamificacion.md §4). The database computes it in
 * private.streak_state(); this is the same logic in TypeScript, for the UI, the demo and tests
 * that compare both.
 *
 * - A week runs Monday to Sunday in Costa Rica time (UTC−6, no daylight saving time).
 * - A week is met with at least `target` DISTINCT items answered right that week, or a repair.
 * - Vacation weeks neither add nor break the streak.
 * - The current week adds when met and never breaks the streak while it is still running.
 */

const CR_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** Monday (YYYY-MM-DD) of the Costa Rica week that contains the instant. */
export function weekStartCR(instant: Date): string {
  const local = new Date(instant.getTime() - CR_OFFSET_MS);
  const isoDow = local.getUTCDay() === 0 ? 7 : local.getUTCDay();
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - (isoDow - 1) * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** The Monday `n` weeks after `week` (negative for before). */
export function addWeeks(week: string, n: number): string {
  return new Date(Date.parse(`${week}T00:00:00Z`) + n * 7 * DAY_MS).toISOString().slice(0, 10);
}

export interface StreakWeek {
  /** Monday, YYYY-MM-DD. */
  week: string;
  /** Distinct items answered right that week. */
  count: number;
  /** Vacation week by the student's calendars. */
  paused: boolean;
  /** A repair (comodín) was used on this week. */
  repaired: boolean;
}

export interface StreakState {
  current: number;
  record: number;
  weekCount: number;
  target: number;
  weekDone: boolean;
  paused: boolean;
  /** The last closed school week was missed after having a streak. */
  broken: boolean;
  /** Last closed school week, when it was missed and a streak came before it (repair candidate). */
  missedWeek: string | null;
}

/** Streak from the weeks between the first right answer and the current week (any order, gaps = 0). */
export function computeStreak(weeks: StreakWeek[], target: number, currentWeek: string): StreakState {
  const byWeek = new Map(weeks.map((w) => [w.week, w]));
  const first = weeks.filter((w) => w.count > 0 || w.repaired).map((w) => w.week).sort()[0];
  let streak = 0;
  let record = 0;
  let weekCount = 0;
  let paused = false;
  let lastClosed: string | null = null;
  let lastClosedMet = true;
  let beforeLast = 0;
  if (first) {
    for (let wk = first; wk <= currentWeek; wk = addWeeks(wk, 1)) {
      const w = byWeek.get(wk) ?? { week: wk, count: 0, paused: false, repaired: false };
      if (wk === currentWeek) {
        weekCount = w.count;
        paused = w.paused;
        if (!w.paused && w.count >= target) streak += 1;
      } else if (w.paused) {
        continue;
      } else {
        lastClosed = wk;
        beforeLast = streak;
        lastClosedMet = w.count >= target || w.repaired;
        streak = lastClosedMet ? streak + 1 : 0;
      }
      record = Math.max(record, streak);
    }
  }
  const missed = lastClosed !== null && !lastClosedMet;
  return {
    current: streak,
    record,
    weekCount,
    target,
    weekDone: weekCount >= target,
    paused,
    broken: missed && record > 0,
    missedWeek: missed && beforeLast > 0 ? lastClosed : null,
  };
}

export interface SchoolCalendar {
  classesStart: string;
  classesEnd: string;
  breaks: { startsOn: string; endsOn: string }[];
}

/** Class days (Monday to Friday, inside the school year, outside breaks) of a calendar in a week. */
export function classDays(calendar: SchoolCalendar, week: string): number {
  let n = 0;
  for (let k = 0; k < 5; k++) {
    const day = new Date(Date.parse(`${week}T00:00:00Z`) + k * DAY_MS).toISOString().slice(0, 10);
    if (day < calendar.classesStart || day > calendar.classesEnd) continue;
    if (calendar.breaks.some((b) => day >= b.startsOn && day <= b.endsOn)) continue;
    n += 1;
  }
  return n;
}

/** Official MEP 2027 calendar, as loaded by the migration. */
export const MEP_2027: SchoolCalendar & { periods: { startsOn: string; endsOn: string; label: string }[] } = {
  classesStart: "2027-03-01",
  classesEnd: "2027-11-30",
  breaks: [{ startsOn: "2027-07-02", endsOn: "2027-07-16" }],
  periods: [
    { startsOn: "2027-03-01", endsOn: "2027-07-01", label: "Primer semestre" },
    { startsOn: "2027-07-17", endsOn: "2027-11-30", label: "Segundo semestre" },
  ],
};

/**
 * Splits a school year into `count` periods of about the same number of weeks, cutting at the
 * breaks when possible: the starting point of the calendar form (2 semesters, 3 trimesters…).
 */
export function suggestPeriods(calendar: SchoolCalendar, count: number): { startsOn: string; endsOn: string; label: string }[] {
  const names: Record<number, string[]> = {
    1: ["Año lectivo"],
    2: ["Primer semestre", "Segundo semestre"],
    3: ["Primer trimestre", "Segundo trimestre", "Tercer trimestre"],
    4: ["Primer periodo", "Segundo periodo", "Tercer periodo", "Cuarto periodo"],
  };
  const n = Math.min(4, Math.max(1, Math.round(count)));
  const start = Date.parse(`${calendar.classesStart}T00:00:00Z`);
  const end = Date.parse(`${calendar.classesEnd}T00:00:00Z`);
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  const out: { startsOn: string; endsOn: string; label: string }[] = [];
  let from = start;
  for (let k = 1; k <= n; k++) {
    let to = k === n ? end : start + Math.round(((end - start) * k) / n);
    // Snap a cut that falls inside a break to the day before the break, and start after it.
    const inBreak = calendar.breaks.find((b) => iso(to) >= b.startsOn && iso(to) <= b.endsOn);
    let next = to + DAY_MS;
    if (k < n && inBreak) {
      to = Date.parse(`${inBreak.startsOn}T00:00:00Z`) - DAY_MS;
      next = Date.parse(`${inBreak.endsOn}T00:00:00Z`) + DAY_MS;
    }
    out.push({ startsOn: iso(from), endsOn: iso(to), label: names[n][k - 1] });
    from = next;
  }
  return out;
}
