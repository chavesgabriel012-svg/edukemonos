/**
 * School rules for the team console: what a school's students see, the pasted invite list,
 * the spend traffic light and the go-live checklist. The database enforces visibility; this is
 * the same logic in TypeScript for the UI and for the tests that compare both.
 */

export type InstitutionStatus = "preparando" | "activo" | "pausado";
export type OfferingStatus = "pendiente" | "aprobado" | "retirado";

/** What one school's students may see. Only approved offerings are listed here. */
export interface Catalog {
  institutionId: string | null;
  status: InstitutionStatus | null;
  offerings: { gradeId: number; subjectId: string }[];
  hiddenUnitIds: string[];
}

/** No school (demo mode): everything is visible. */
export const DEMO_CATALOG: Catalog = { institutionId: null, status: null, offerings: [], hiddenUnitIds: [] };

export function isDemo(c: Catalog): boolean {
  return c.institutionId === null;
}

/** A subject is visible when the school approved that grade+subject; demo sees all. */
export function subjectVisible(c: Catalog, gradeId: number, subjectId: string): boolean {
  if (isDemo(c)) return true;
  return c.offerings.some((o) => o.gradeId === gradeId && o.subjectId === subjectId);
}

/** A unit is visible when its subject is visible and the school did not hide it. */
export function unitVisible(c: Catalog, unit: { id: string; gradeId: number; subjectId: string }): boolean {
  if (isDemo(c)) return true;
  return subjectVisible(c, unit.gradeId, unit.subjectId) && !c.hiddenUnitIds.includes(unit.id);
}

/** Grades with at least one approved offering; demo sees all. */
export function visibleGrades(c: Catalog, all: readonly number[]): number[] {
  if (isDemo(c)) return [...all];
  return all.filter((g) => c.offerings.some((o) => o.gradeId === g));
}

export interface InvitePerson {
  email: string;
  name: string;
  role: "teacher" | "admin";
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const HEADER = /^(correo|e-?mail)\b/;
const TEACHER_WORDS = ["docente", "profesor", "profesora", "teacher"];
const ADMIN_WORDS = ["coordinacion", "coordinador", "coordinadora", "admin"];

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/**
 * Parses a pasted list: one person per line as "email, name[, role]". Columns are separated by a
 * tab, `;` or `,` (first one found in the line, in that order). Blank lines and a header line
 * (first column starting with the word "correo" or "email", e.g. "Correo electrónico") are ignored. Role defaults to teacher. Invalid lines go to
 * `errors` with their 1-based line number; a repeated email goes once into `duplicates` and only
 * its first row is kept.
 */
export function parseInviteList(text: string): {
  people: InvitePerson[];
  errors: { line: number; text: string; reason: "email" | "name" | "role" }[];
  duplicates: string[];
} {
  const people: InvitePerson[] = [];
  const errors: { line: number; text: string; reason: "email" | "name" | "role" }[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();
  let first = true;

  text.split(/\r?\n/).forEach((raw, i) => {
    if (raw.trim() === "") return;
    const sep = raw.includes("\t") ? "\t" : raw.includes(";") ? ";" : ",";
    const cols = raw.split(sep).map((c) => c.trim());
    const isFirst = first;
    first = false;
    if (isFirst && !EMAIL.test(cols[0].toLowerCase()) && HEADER.test(fold(cols[0]))) return;

    const fail = (reason: "email" | "name" | "role") => errors.push({ line: i + 1, text: raw, reason });
    const email = cols[0].toLowerCase();
    if (!EMAIL.test(email)) return fail("email");
    const name = cols[1] ?? "";
    if (name.length < 1 || name.length > 80) return fail("name");
    let role: InvitePerson["role"] = "teacher";
    if (cols[2]) {
      const w = fold(cols[2]);
      if (ADMIN_WORDS.includes(w)) role = "admin";
      else if (!TEACHER_WORDS.includes(w)) return fail("role");
    }
    if (seen.has(email)) {
      if (!duplicates.includes(email)) duplicates.push(email);
      return;
    }
    seen.add(email);
    people.push({ email, name, role });
  });

  return { people, errors, duplicates };
}

export type SpendLevel = "ok" | "warn" | "over";

/** Monthly spend against budget: warn from 80 %, over from 100 %; no budget means ok. */
export function spendLevel(spentUsd: number, budgetUsd: number | null): SpendLevel {
  if (budgetUsd === null || budgetUsd <= 0) return "ok";
  const ratio = spentUsd / budgetUsd;
  if (ratio >= 1) return "over";
  if (ratio >= 0.8) return "warn";
  return "ok";
}

export interface SchoolChecklistInput {
  approvedOfferings: number;
  coordinatorsActive: number;
  invitesAccepted: number;
  invitesPending: number;
  groups: number;
  smtpReady: boolean;
}

/** What is still missing before a school can start. */
export function schoolChecklist(
  x: SchoolChecklistInput,
): { key: "program" | "coordination" | "teachers" | "groups" | "email"; done: boolean; label: string }[] {
  return [
    { key: "program", done: x.approvedOfferings > 0, label: "Programa aprobado por el colegio" },
    { key: "coordination", done: x.coordinatorsActive > 0, label: "Coordinación con acceso" },
    { key: "teachers", done: x.invitesAccepted > 0 && x.invitesPending === 0, label: "Docentes invitados y con acceso" },
    { key: "groups", done: x.groups > 0, label: "Grupos con código" },
    { key: "email", done: x.smtpReady, label: "Correo propio configurado" },
  ];
}
