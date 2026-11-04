import { describe, expect, it } from "vitest";
import { buildDemoSection, computeSectionMetrics, originSummary, type PanelUnit, sectionSnapshot } from "../src";

const units: PanelUnit[] = [1, 2, 3, 4].map((k) => ({
  id: `u${k}`, title: `Unidad ${k}`, area: null, sortOrder: k, subjectId: "matematicas", subjectName: "Matemáticas", skillIds: [`s${k}a`, `s${k}b`],
}));

describe("sectionSnapshot", () => {
  it("has the same numbers as the section's panel", () => {
    const m = computeSectionMetrics(buildDemoSection(units, new Date("2027-03-10T18:00:00Z"), 20));
    const snap = sectionSnapshot(m);
    expect(snap).toMatchObject({ students: m.overview.students, active: m.overview.active, attempts7: m.overview.attempts7, mastery: m.overview.mastery });
    expect(snap.activeShare).toBeCloseTo(m.overview.active / m.overview.students);
    expect(snap.support.map((s) => s.id).sort()).toEqual(m.students.filter((s) => s.support.length).map((s) => s.id).sort());
  });

  it("lists first who has more reasons for support", () => {
    const m = computeSectionMetrics(buildDemoSection(units, new Date("2027-03-10T18:00:00Z"), 20));
    const counts = sectionSnapshot(m).support.map((s) => s.reasons.length);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it("an empty section has no shares", () => {
    const m = computeSectionMetrics({ now: new Date(), units, students: [], mastery: [], attempts: [], diagnostics: [], tutor: [], writing: [] });
    expect(sectionSnapshot(m)).toMatchObject({ students: 0, activeShare: null, support: [] });
  });
});

describe("answers by origin", () => {
  it("labels every answer with where it came from, and the demo includes games", () => {
    const m = computeSectionMetrics(buildDemoSection(units, new Date("2027-03-10T18:00:00Z"), 20));
    const all = m.students.reduce((a, s) => a + Object.values(s.byOrigin).reduce((x, y) => x + y, 0), 0);
    expect(all).toBe(m.students.reduce((a, s) => a + s.attemptsTotal, 0));
    expect(m.students.some((s) => s.byOrigin.game > 0)).toBe(true);
    expect(originSummary({ game: 5, practice: 12, diagnostic: 3 })).toBe("práctica 12 · diagnóstico 3 · juegos 5");
    expect(originSummary({})).toBe("");
  });
});
