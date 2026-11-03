import { describe, expect, it } from "vitest";
import { addWeeks, classDays, computeStreak, MEP_2027, type StreakWeek, suggestPeriods, weekStartCR } from "../src/streak";

const wk = (week: string, count: number, extra: Partial<StreakWeek> = {}): StreakWeek => ({ week, count, paused: false, repaired: false, ...extra });

describe("weekStartCR", () => {
  it("uses Monday to Sunday in Costa Rica time", () => {
    expect(weekStartCR(new Date("2027-03-03T15:00:00Z"))).toBe("2027-03-01"); // Wednesday
    expect(weekStartCR(new Date("2027-03-08T05:59:00Z"))).toBe("2027-03-01"); // Sunday 23:59 in CR
    expect(weekStartCR(new Date("2027-03-08T06:00:00Z"))).toBe("2027-03-08"); // Monday 00:00 in CR
  });
  it("adds weeks", () => {
    expect(addWeeks("2027-03-01", 2)).toBe("2027-03-15");
    expect(addWeeks("2027-03-01", -1)).toBe("2027-02-22");
  });
});

describe("computeStreak", () => {
  it("counts met weeks in a row and adds the current week once it is met", () => {
    const s = computeStreak([wk("2027-03-01", 5), wk("2027-03-08", 7), wk("2027-03-15", 5)], 5, "2027-03-15");
    expect(s).toMatchObject({ current: 3, record: 3, weekCount: 5, weekDone: true, broken: false });
  });

  it("never breaks the streak during the current week", () => {
    const s = computeStreak([wk("2027-03-01", 5), wk("2027-03-08", 6), wk("2027-03-15", 1)], 5, "2027-03-15");
    expect(s).toMatchObject({ current: 2, weekCount: 1, weekDone: false, broken: false, missedWeek: null });
  });

  it("ends when a school week is missed, keeps the record and offers that week for a repair", () => {
    const s = computeStreak([wk("2027-03-01", 5), wk("2027-03-08", 5), wk("2027-03-15", 2)], 5, "2027-03-22");
    expect(s).toMatchObject({ current: 0, record: 2, broken: true, missedWeek: "2027-03-15" });
  });

  it("a repaired week counts as met", () => {
    const s = computeStreak([wk("2027-03-01", 5), wk("2027-03-08", 5), wk("2027-03-15", 2, { repaired: true }), wk("2027-03-22", 5)], 5, "2027-03-22");
    expect(s).toMatchObject({ current: 4, record: 4, broken: false });
  });

  it("vacation weeks neither add nor break", () => {
    const weeks = [wk("2027-06-21", 5), wk("2027-06-28", 5), wk("2027-07-05", 0, { paused: true }), wk("2027-07-12", 0, { paused: true }), wk("2027-07-19", 5)];
    expect(computeStreak(weeks, 5, "2027-07-19")).toMatchObject({ current: 3, record: 3, broken: false });
    expect(computeStreak(weeks, 5, "2027-07-12")).toMatchObject({ current: 2, paused: true });
  });

  it("does not offer a repair when there was no streak to save", () => {
    const s = computeStreak([wk("2027-03-01", 2)], 5, "2027-03-08");
    expect(s).toMatchObject({ current: 0, record: 0, broken: false, missedWeek: null });
  });

  it("only the last missed week can be repaired, not older ones", () => {
    const s = computeStreak([wk("2027-03-01", 5), wk("2027-03-08", 1), wk("2027-03-15", 0)], 5, "2027-03-22");
    expect(s).toMatchObject({ current: 0, record: 1, broken: true, missedWeek: null });
  });

  it("is empty for a student with no right answers", () => {
    expect(computeStreak([], 5, "2027-03-01")).toMatchObject({ current: 0, record: 0, weekCount: 0, broken: false });
  });
});

describe("school calendar", () => {
  it("counts class days, Monday to Friday, outside breaks", () => {
    expect(classDays(MEP_2027, "2027-03-01")).toBe(5);
    expect(classDays(MEP_2027, "2027-06-28")).toBe(4); // the break starts on Friday 2 July
    expect(classDays(MEP_2027, "2027-07-05")).toBe(0);
    expect(classDays(MEP_2027, "2027-07-12")).toBe(0);
    expect(classDays(MEP_2027, "2027-02-22")).toBe(0); // before classes
    expect(classDays(MEP_2027, "2027-11-29")).toBe(2); // Monday 29 and Tuesday 30
  });

  it("suggests 2 semesters that cut at the mid-year break, like the official calendar", () => {
    expect(suggestPeriods(MEP_2027, 2)).toEqual(MEP_2027.periods);
  });

  it("suggests 3 trimesters that cover the year without overlapping", () => {
    const p = suggestPeriods(MEP_2027, 3);
    expect(p.map((x) => x.label)).toEqual(["Primer trimestre", "Segundo trimestre", "Tercer trimestre"]);
    expect(p[0].startsOn).toBe("2027-03-01");
    expect(p[2].endsOn).toBe("2027-11-30");
    for (let k = 1; k < p.length; k++) expect(p[k].startsOn > p[k - 1].endsOn).toBe(true);
  });
});
