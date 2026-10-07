import { describe, expect, it } from "vitest";
import { buildDemoSection, computeSectionMetrics, sectionCsv, type PanelUnit, type SectionData } from "../src";

const now = new Date("2026-10-12T12:00:00Z");
const days = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

const units: PanelUnit[] = [
  { id: "u1", title: "Potencias", subjectId: "matematicas", subjectName: "Matemáticas", area: "Números", sortOrder: 1, skillIds: ["s1", "s2"] },
  { id: "u2", title: "Fracciones", subjectId: "matematicas", subjectName: "Matemáticas", area: "Números", sortOrder: 2, skillIds: ["s3"] },
  { id: "u3", title: "Tilde diacrítica", subjectId: "espanol", subjectName: "Español", area: null, sortOrder: 1, skillIds: ["s4"] },
];

function fixture(): SectionData {
  return {
    now,
    units,
    students: ["a", "b", "c", "d"].map((id) => ({ id, name: `Estudiante ${id.toUpperCase()}`, joinedAt: days(30) })),
    mastery: [
      { studentId: "a", skillId: "s1", score: 0.9, attempts: 5, updatedAt: days(1) },
      { studentId: "a", skillId: "s2", score: 0.7, attempts: 5, updatedAt: days(1) },
      { studentId: "a", skillId: "s3", score: 0.3, attempts: 4, updatedAt: days(1) },
      { studentId: "b", skillId: "s1", score: 0.4, attempts: 3, updatedAt: days(2) },
      { studentId: "b", skillId: "s3", score: 0.2, attempts: 3, updatedAt: days(2) },
      { studentId: "c", skillId: "s3", score: 0.35, attempts: 3, updatedAt: days(10) },
    ],
    attempts: [
      { studentId: "a", unitId: "u1", isCorrect: true, createdAt: days(1), context: "practice" },
      { studentId: "a", unitId: "u2", isCorrect: false, createdAt: days(1), context: "practice" },
      { studentId: "b", unitId: "u1", isCorrect: false, createdAt: days(2), context: "practice" },
      { studentId: "c", unitId: "u2", isCorrect: false, createdAt: days(10), context: "practice" },
    ],
    diagnostics: [{ studentId: "a", subjectId: "matematicas", level: 3.4, completedAt: days(5) }],
    tutor: [{ studentId: "b", unitId: "u2", messageCount: 6, startedAt: days(2) }],
    writing: [
      { studentId: "a", category: "tildes", count: 3, createdAt: days(3) },
      { studentId: "b", category: "tildes", count: 1, createdAt: days(3) },
      { studentId: "b", category: "puntuacion", count: 2, createdAt: days(3) },
    ],
  };
}

describe("computeSectionMetrics", () => {
  const m = computeSectionMetrics(fixture());

  it("counts activity in the last 7 days", () => {
    expect(m.overview).toMatchObject({ students: 4, active: 2, attempts7: 3, diagnostics: 1, tutorSessions7: 1 });
    expect(m.overview.accuracy7).toBeCloseTo(1 / 3);
  });

  it("averages mastery per unit over the unit's skills with data", () => {
    expect(m.heat.get("a")!.get("u1")).toBeCloseTo(0.8);
    expect(m.heat.get("b")!.get("u1")).toBeCloseTo(0.4);
    expect(m.heat.get("d")!.get("u1")).toBeNull();
    const u2 = m.units.find((u) => u.unit.id === "u2")!;
    expect(u2).toMatchObject({ studentsWithData: 3, below: 3, tutorSessions: 1 });
    expect(u2.mastery).toBeCloseTo((0.3 + 0.2 + 0.35) / 3);
  });

  it("flags students with low mastery or no recent activity, with the reason", () => {
    const byId = Object.fromEntries(m.students.map((s) => [s.id, s.support]));
    expect(byId.a).toEqual([]);
    expect(byId.b[0]).toMatch(/dominio promedio/);
    expect(byId.c.join(" ")).toMatch(/sin actividad hace 10 días/);
    expect(byId.d).toEqual(["todavía no ha practicado"]);
  });

  it("explains every finding with the numbers behind it, without names", () => {
    const ids = m.findings.map((f) => f.id);
    expect(ids).toContain("participacion");
    expect(ids).toContain("unidad-u2");
    expect(ids).toContain("apoyo");
    expect(ids).toContain("escritura");
    for (const f of m.findings) {
      expect(f.evidence.length).toBeGreaterThan(20);
      expect(JSON.stringify(f)).not.toMatch(/Estudiante [A-D]/);
    }
    expect(m.findings.find((f) => f.id === "escritura")!.evidence).toMatch(/4 \(67 %\) son de tildes/);
  });

  it("exports one CSV row per student", () => {
    const csv = sectionCsv(m);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.trim().split("\n")).toHaveLength(5);
    expect(csv).toMatch(/Estudiante A,Sí,/);
    expect(csv).toMatch(/3,4/);
  });
});

describe("buildDemoSection", () => {
  const many: PanelUnit[] = ["matematicas", "espanol"].flatMap((subjectId) =>
    Array.from({ length: 10 }, (_, i) => ({
      id: `${subjectId}-${i}`, title: `Tema ${i + 1}`, subjectId, subjectName: subjectId === "espanol" ? "Español" : "Matemáticas",
      area: null, sortOrder: i, skillIds: [`${subjectId}-${i}-a`, `${subjectId}-${i}-b`],
    })),
  );

  it("is deterministic", () => {
    const a = buildDemoSection(many, now);
    const b = buildDemoSection(many, now);
    expect(a.attempts.length).toBe(b.attempts.length);
    expect(a.mastery).toEqual(b.mastery);
  });

  it("gives the panel something to say", () => {
    const m = computeSectionMetrics(buildDemoSection(many, now));
    expect(m.overview.students).toBe(26);
    expect(m.overview.active).toBeGreaterThan(10);
    expect(m.overview.active).toBeLessThan(26);
    expect(m.findings.some((f) => f.kind === "weak_unit")).toBe(true);
    expect(m.findings.some((f) => f.kind === "support")).toBe(true);
    expect(m.findings.some((f) => f.kind === "writing")).toBe(true);
    expect(m.students.some((s) => s.support.includes("todavía no ha practicado"))).toBe(true);
  });
});
