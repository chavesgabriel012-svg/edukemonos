import { describe, expect, it } from "vitest";
import { buildDemoSection, computeSectionMetrics, type PanelUnit, sectionSnapshot } from "../src";

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
