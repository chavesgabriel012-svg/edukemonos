import { describe, expect, it } from "vitest";
import {
  DEMO_CATALOG,
  isDemo,
  parseInviteList,
  schoolChecklist,
  spendLevel,
  subjectVisible,
  unitVisible,
  visibleGrades,
  type Catalog,
} from "../src/institutions";

const school: Catalog = {
  institutionId: "i1",
  status: "activo",
  offerings: [{ gradeId: 7, subjectId: "matematicas" }],
  hiddenUnitIds: [],
};
const unit = (gradeId: number, id = "u1") => ({ id, gradeId, subjectId: "matematicas" });

describe("catalog visibility", () => {
  it("demo shows everything", () => {
    expect(isDemo(DEMO_CATALOG)).toBe(true);
    expect(isDemo(school)).toBe(false);
    expect(unitVisible(DEMO_CATALOG, unit(9))).toBe(true);
    expect(subjectVisible(DEMO_CATALOG, 9, "fisica")).toBe(true);
  });
  it("a school sees only its approved offerings", () => {
    expect(unitVisible(school, unit(7))).toBe(true);
    expect(unitVisible(school, unit(8))).toBe(false);
    expect(subjectVisible(school, 7, "matematicas")).toBe(true);
    expect(subjectVisible(school, 7, "ciencias")).toBe(false);
  });
  it("a hidden unit is not visible", () => {
    expect(unitVisible({ ...school, hiddenUnitIds: ["u1"] }, unit(7))).toBe(false);
  });
  it("visibleGrades keeps only grades with an offering", () => {
    expect(visibleGrades(school, [7, 8, 9])).toEqual([7]);
    expect(visibleGrades(DEMO_CATALOG, [7, 8, 9])).toEqual([7, 8, 9]);
  });
});

describe("parseInviteList", () => {
  it("handles header, tabs, commas, blank lines and role words", () => {
    const text = "correo\tnombre\trol\nAna@Colegio.cr \tAna Mora\tCoordinación\n\nluis@colegio.cr, Luis Rojas\n";
    expect(parseInviteList(text)).toEqual({
      people: [
        { email: "ana@colegio.cr", name: "Ana Mora", role: "admin" },
        { email: "luis@colegio.cr", name: "Luis Rojas", role: "teacher" },
      ],
      errors: [],
      duplicates: [],
    });
  });
  it("reports errors with original line numbers and duplicates once", () => {
    const text = "no-es-correo, X\nana@c.cr, Ana\nANA@c.cr; Ana B; docente\nbeto@c.cr, Beto, rector";
    const r = parseInviteList(text);
    expect(r.errors).toEqual([
      { line: 1, text: "no-es-correo, X", reason: "email" },
      { line: 4, text: "beto@c.cr, Beto, rector", reason: "role" },
    ]);
    expect(r.duplicates).toEqual(["ana@c.cr"]);
    expect(r.people).toEqual([{ email: "ana@c.cr", name: "Ana", role: "teacher" }]);
  });
  it("rejects missing or too long names", () => {
    const r = parseInviteList(`a@c.cr\nb@c.cr, ${"x".repeat(81)}`);
    expect(r.errors.map((e) => [e.line, e.reason])).toEqual([[1, "name"], [2, "name"]]);
  });
  it("accepts role words without accents or case", () => {
    for (const w of ["docente", "Profesor", "PROFESORA", "teacher"]) {
      expect(parseInviteList(`a@c.cr, A, ${w}`).people[0].role).toBe("teacher");
    }
    for (const w of ["coordinación", "Coordinacion", "coordinador", "COORDINADORA", "admin"]) {
      expect(parseInviteList(`a@c.cr, A, ${w}`).people[0].role).toBe("admin");
    }
  });
});

describe("spendLevel", () => {
  it("ok under 80 %, warn from 80 %, over from 100 %", () => {
    expect(spendLevel(10, null)).toBe("ok");
    expect(spendLevel(31.9, 40)).toBe("ok");
    expect(spendLevel(32, 40)).toBe("warn");
    expect(spendLevel(40, 40)).toBe("over");
  });
});

describe("schoolChecklist", () => {
  const zero = { approvedOfferings: 0, coordinatorsActive: 0, invitesAccepted: 0, invitesPending: 0, groups: 0, smtpReady: false };
  it("starts with five undone items", () => {
    const c = schoolChecklist(zero);
    expect(c.map((i) => i.key)).toEqual(["program", "coordination", "teachers", "groups", "email"]);
    expect(c.every((i) => !i.done)).toBe(true);
  });
  it("teachers needs accepted invites and none pending", () => {
    const done = (x: Partial<typeof zero>) => schoolChecklist({ ...zero, ...x }).find((i) => i.key === "teachers")!.done;
    expect(done({ invitesAccepted: 2, invitesPending: 0 })).toBe(true);
    expect(done({ invitesAccepted: 2, invitesPending: 1 })).toBe(false);
    expect(done({ invitesAccepted: 0, invitesPending: 0 })).toBe(false);
  });
  it("email needs smtpReady; the rest follow their counts", () => {
    const c = schoolChecklist({ ...zero, smtpReady: true, approvedOfferings: 1, coordinatorsActive: 1, groups: 1 });
    expect(c.filter((i) => i.done).map((i) => i.key)).toEqual(["program", "coordination", "groups", "email"]);
  });
});
