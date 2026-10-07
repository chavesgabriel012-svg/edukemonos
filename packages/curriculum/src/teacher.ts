/**
 * Teacher panel metrics (SPEC §11). Pure functions over a section's raw activity, shared by the real
 * panel (data read under RLS) and the demo (synthetic data). Every finding carries the numbers that
 * back it, so the panel can show "¿Cómo se calculó?" and the AI summary never sees names.
 */
import { STRONG, WEAK } from "./learning";

export interface PanelStudent {
  id: string;
  name: string;
  joinedAt: string;
}

export interface PanelUnit {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  area: string | null;
  sortOrder: number;
  skillIds: string[];
}

export interface PanelMastery {
  studentId: string;
  skillId: string;
  score: number;
  attempts: number;
  updatedAt: string;
}

export interface PanelAttempt {
  studentId: string;
  unitId: string | null;
  isCorrect: boolean | null;
  createdAt: string;
  context: string;
}

export interface PanelDiagnostic {
  studentId: string;
  subjectId: string;
  level: number;
  completedAt: string;
}

export interface PanelTutorSession {
  studentId: string;
  unitId: string | null;
  messageCount: number;
  startedAt: string;
}

export interface PanelWriting {
  studentId: string;
  category: string;
  count: number;
  createdAt: string;
}

export interface SectionData {
  students: PanelStudent[];
  units: PanelUnit[];
  mastery: PanelMastery[];
  attempts: PanelAttempt[];
  diagnostics: PanelDiagnostic[];
  tutor: PanelTutorSession[];
  writing: PanelWriting[];
  now: Date;
}

export const WRITING_LABELS: Record<string, string> = {
  tildes: "Tildes",
  b_v: "B y V",
  c_s_z: "C, S y Z",
  h: "H",
  g_j: "G y J",
  mayusculas: "Mayúsculas",
  puntuacion: "Puntuación",
  concordancia: "Concordancia",
  cohesion: "Cohesión",
};

const DAY = 86_400_000;
export const ACTIVE_DAYS = 7;
export const ACTIVITY_WINDOW_DAYS = 28;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pct = (x: number) => `${Math.round(x * 100)} %`;
/** Diagnostic level with a decimal comma, as written in Costa Rica: 3,2. */
export const formatLevel = (level: number) => level.toFixed(1).replace(".", ",");
const daysAgo = (now: Date, iso: string) => Math.floor((now.getTime() - new Date(iso).getTime()) / DAY);

export interface SubjectSummary {
  subjectId: string;
  subjectName: string;
}

export interface StudentRow {
  id: string;
  name: string;
  lastActive: string | null;
  daysInactive: number | null;
  active: boolean;
  attempts7: number;
  attemptsTotal: number;
  accuracy: number | null;
  /** Mean of the student's unit mastery over units with data. */
  mastery: number | null;
  unitsWithData: number;
  bySubject: Record<string, { mastery: number | null; level: number | null }>;
  tutorSessions: number;
  writingErrors: number;
  support: string[];
}

export interface UnitRow {
  unit: PanelUnit;
  mastery: number | null;
  studentsWithData: number;
  below: number;
  strong: number;
  tutorSessions: number;
}

export interface Finding {
  id: string;
  kind: "participation" | "weak_unit" | "strength" | "support" | "writing" | "tutor_topic" | "diagnostic";
  tone: "alerta" | "atencion" | "positivo" | "info";
  title: string;
  detail: string;
  /** "¿Cómo se calculó?": the numbers behind the finding, in plain language. */
  evidence: string;
}

export interface SectionMetrics {
  subjects: SubjectSummary[];
  overview: {
    students: number;
    active: number;
    attempts7: number;
    accuracy7: number | null;
    mastery: number | null;
    diagnostics: number;
    tutorSessions7: number;
  };
  students: StudentRow[];
  units: UnitRow[];
  /** studentId → unitId → mastery (null when the student has no data in the unit). */
  heat: Map<string, Map<string, number | null>>;
  writing: { category: string; label: string; count: number; students: number }[];
  activity: { day: string; attempts: number; tutor: number }[];
  diagnostics: { subjectId: string; subjectName: string; count: number; level: number | null }[];
  findings: Finding[];
}

/** The subject with the most student data, so the heatmap opens where there is something to see. */
export function busiestSubject(m: SectionMetrics): string {
  const score = (id: string) => m.units.filter((u) => u.unit.subjectId === id).reduce((a, u) => a + u.studentsWithData, 0);
  return [...m.subjects].sort((a, b) => score(b.subjectId) - score(a.subjectId))[0]?.subjectId ?? "";
}

/** Mean mastery of a unit's skills for one student; null without data. */
export function unitMastery(scores: Map<string, number>, unit: PanelUnit): number | null {
  return mean(unit.skillIds.flatMap((s) => (scores.has(s) ? [scores.get(s)!] : [])));
}

export function computeSectionMetrics(d: SectionData): SectionMetrics {
  const now = d.now;
  const recent = (iso: string) => daysAgo(now, iso) < ACTIVE_DAYS;
  const subjects: SubjectSummary[] = [];
  for (const u of [...d.units].sort((a, b) => a.subjectName.localeCompare(b.subjectName, "es"))) {
    if (!subjects.some((s) => s.subjectId === u.subjectId)) subjects.push({ subjectId: u.subjectId, subjectName: u.subjectName });
  }
  const units = [...d.units].sort((a, b) => a.subjectName.localeCompare(b.subjectName, "es") || a.sortOrder - b.sortOrder);

  const scoresBy = new Map<string, Map<string, number>>();
  for (const m of d.mastery) {
    if (!scoresBy.has(m.studentId)) scoresBy.set(m.studentId, new Map());
    scoresBy.get(m.studentId)!.set(m.skillId, m.score);
  }

  const heat = new Map<string, Map<string, number | null>>();
  for (const s of d.students) {
    const scores = scoresBy.get(s.id) ?? new Map<string, number>();
    heat.set(s.id, new Map(units.map((u) => [u.id, unitMastery(scores, u)])));
  }

  const latestDiag = new Map<string, PanelDiagnostic>();
  for (const g of d.diagnostics) {
    const key = `${g.studentId}:${g.subjectId}`;
    const prev = latestDiag.get(key);
    if (!prev || prev.completedAt < g.completedAt) latestDiag.set(key, g);
  }

  const students: StudentRow[] = d.students.map((s) => {
    const mine = d.attempts.filter((a) => a.studentId === s.id);
    const tutor = d.tutor.filter((t) => t.studentId === s.id);
    const graded = mine.filter((a) => a.isCorrect !== null);
    const stamps = [...mine.map((a) => a.createdAt), ...tutor.map((t) => t.startedAt),
      ...d.diagnostics.filter((g) => g.studentId === s.id).map((g) => g.completedAt)].sort();
    const lastActive = stamps.at(-1) ?? null;
    const row = heat.get(s.id)!;
    const unitValues = units.flatMap((u) => (row.get(u.id) != null ? [row.get(u.id)!] : []));
    const bySubject: StudentRow["bySubject"] = {};
    for (const sub of subjects) {
      const vals = units.filter((u) => u.subjectId === sub.subjectId).flatMap((u) => (row.get(u.id) != null ? [row.get(u.id)!] : []));
      bySubject[sub.subjectId] = { mastery: mean(vals), level: latestDiag.get(`${s.id}:${sub.subjectId}`)?.level ?? null };
    }
    const mastery = mean(unitValues);
    const daysInactive = lastActive ? daysAgo(now, lastActive) : null;
    const support: string[] = [];
    if (mastery !== null && mastery < WEAK) support.push(`dominio promedio de ${pct(mastery)}`);
    if (lastActive === null) {
      if (daysAgo(now, s.joinedAt) >= ACTIVE_DAYS) support.push("todavía no ha practicado");
    } else if (daysInactive! >= ACTIVE_DAYS) support.push(`sin actividad hace ${daysInactive} días`);
    return {
      id: s.id,
      name: s.name,
      lastActive,
      daysInactive,
      active: lastActive !== null && recent(lastActive),
      attempts7: mine.filter((a) => recent(a.createdAt)).length,
      attemptsTotal: mine.length,
      accuracy: graded.length ? graded.filter((a) => a.isCorrect).length / graded.length : null,
      mastery,
      unitsWithData: unitValues.length,
      bySubject,
      tutorSessions: tutor.length,
      writingErrors: d.writing.filter((w) => w.studentId === s.id).reduce((a, w) => a + w.count, 0),
      support,
    };
  });

  const tutorByUnit = new Map<string, number>();
  for (const t of d.tutor) if (t.unitId) tutorByUnit.set(t.unitId, (tutorByUnit.get(t.unitId) ?? 0) + 1);
  const unitRows: UnitRow[] = units.map((u) => {
    const vals = d.students.flatMap((s) => (heat.get(s.id)!.get(u.id) != null ? [heat.get(s.id)!.get(u.id)!] : []));
    return {
      unit: u,
      mastery: mean(vals),
      studentsWithData: vals.length,
      below: vals.filter((v) => v < WEAK).length,
      strong: vals.filter((v) => v >= STRONG).length,
      tutorSessions: tutorByUnit.get(u.id) ?? 0,
    };
  });

  const writingMap = new Map<string, { count: number; students: Set<string> }>();
  for (const w of d.writing) {
    if (!writingMap.has(w.category)) writingMap.set(w.category, { count: 0, students: new Set() });
    const e = writingMap.get(w.category)!;
    e.count += w.count;
    if (w.count > 0) e.students.add(w.studentId);
  }
  const writing = [...writingMap.entries()]
    .map(([category, v]) => ({ category, label: WRITING_LABELS[category] ?? category, count: v.count, students: v.students.size }))
    .sort((a, b) => b.count - a.count);

  const activity = Array.from({ length: ACTIVITY_WINDOW_DAYS }, (_, i) => {
    const day = new Date(now.getTime() - (ACTIVITY_WINDOW_DAYS - 1 - i) * DAY).toISOString().slice(0, 10);
    return {
      day,
      attempts: d.attempts.filter((a) => a.createdAt.slice(0, 10) === day).length,
      tutor: d.tutor.filter((t) => t.startedAt.slice(0, 10) === day).length,
    };
  });

  const diagnostics = subjects.map((sub) => {
    const levels = d.students.flatMap((s) => {
      const g = latestDiag.get(`${s.id}:${sub.subjectId}`);
      return g ? [g.level] : [];
    });
    return { ...sub, count: levels.length, level: mean(levels) };
  });

  const recentAttempts = d.attempts.filter((a) => recent(a.createdAt) && a.isCorrect !== null);
  const overview = {
    students: d.students.length,
    active: students.filter((s) => s.active).length,
    attempts7: d.attempts.filter((a) => recent(a.createdAt)).length,
    accuracy7: recentAttempts.length ? recentAttempts.filter((a) => a.isCorrect).length / recentAttempts.length : null,
    mastery: mean(students.flatMap((s) => (s.mastery !== null ? [s.mastery] : []))),
    diagnostics: new Set(d.diagnostics.map((g) => g.studentId)).size,
    tutorSessions7: d.tutor.filter((t) => recent(t.startedAt)).length,
  };

  return {
    subjects,
    overview,
    students,
    units: unitRows,
    heat,
    writing,
    activity,
    diagnostics,
    findings: findingsOf(overview, students, unitRows, writing, diagnostics),
  };
}

function findingsOf(
  overview: SectionMetrics["overview"],
  students: StudentRow[],
  units: UnitRow[],
  writing: SectionMetrics["writing"],
  diagnostics: SectionMetrics["diagnostics"],
): Finding[] {
  const out: Finding[] = [];
  const n = overview.students;
  if (n === 0) return out;

  const share = overview.active / n;
  out.push({
    id: "participacion",
    kind: "participation",
    tone: share >= 0.6 ? "positivo" : share >= 0.35 ? "atencion" : "alerta",
    title: `${overview.active} de ${n} estudiantes practicaron esta semana`,
    detail: share >= 0.6 ? "La mayoría de la sección está usando la plataforma." : "Una parte de la sección todavía no practica con regularidad.",
    evidence: `Se cuenta como activo a quien respondió un ejercicio, hizo un diagnóstico o usó el tutor en los últimos ${ACTIVE_DAYS} días: ${overview.active} de ${n} (${pct(share)}). En esos días se respondieron ${overview.attempts7} ejercicios${overview.accuracy7 !== null ? `, con ${pct(overview.accuracy7)} de aciertos` : ""}.`,
  });

  // Units the class finds hardest: enough students with data, lowest average.
  const minData = Math.max(3, Math.ceil(n * 0.25));
  const ranked = units.filter((u) => u.mastery !== null && u.studentsWithData >= minData);
  for (const u of [...ranked].sort((a, b) => a.mastery! - b.mastery!).filter((u) => u.mastery! < WEAK).slice(0, 3)) {
    out.push({
      id: `unidad-${u.unit.id}`,
      kind: "weak_unit",
      tone: "alerta",
      title: `Conviene reforzar «${u.unit.title}» (${u.unit.subjectName})`,
      detail: `${u.below} de ${u.studentsWithData} estudiantes con práctica en este tema están por debajo de ${pct(WEAK)} de dominio.`,
      evidence: `Promedio del dominio estimado en las habilidades de la unidad, entre los ${u.studentsWithData} estudiantes que la practicaron: ${pct(u.mastery!)}. Se considera dominio bajo menos de ${pct(WEAK)}. Solo se comparan unidades con al menos ${minData} estudiantes con datos.`,
    });
  }
  const best = [...ranked].sort((a, b) => b.mastery! - a.mastery!)[0];
  if (best && best.mastery! >= STRONG) {
    out.push({
      id: `fortaleza-${best.unit.id}`,
      kind: "strength",
      tone: "positivo",
      title: `La sección va muy bien en «${best.unit.title}»`,
      detail: `${best.strong} de ${best.studentsWithData} estudiantes tienen dominio alto en este tema.`,
      evidence: `Promedio del dominio estimado: ${pct(best.mastery!)} entre ${best.studentsWithData} estudiantes con datos. Dominio alto: ${pct(STRONG)} o más.`,
    });
  }

  const flagged = students.filter((s) => s.support.length > 0);
  if (flagged.length) {
    const low = flagged.filter((s) => s.mastery !== null && s.mastery < WEAK).length;
    const idle = flagged.filter((s) => s.support.some((r) => r.startsWith("sin actividad") || r.startsWith("todavía"))).length;
    out.push({
      id: "apoyo",
      kind: "support",
      tone: "atencion",
      title: `${flagged.length} ${flagged.length === 1 ? "estudiante podría" : "estudiantes podrían"} necesitar apoyo`,
      detail: "La lista con los nombres está en la sección «Estudiantes que podrían necesitar apoyo».",
      evidence: `${low} con dominio promedio menor a ${pct(WEAK)} y ${idle} sin actividad en los últimos ${ACTIVE_DAYS} días (un estudiante puede cumplir ambas condiciones).`,
    });
  }

  const totalErrors = writing.reduce((a, w) => a + w.count, 0);
  if (writing[0] && totalErrors > 0) {
    const top = writing[0];
    out.push({
      id: "escritura",
      kind: "writing",
      tone: "atencion",
      title: `En escritura, el error más frecuente es de ${top.label.toLowerCase()}`,
      detail: `Aparece en los textos de ${top.students} estudiantes.`,
      evidence: `De ${totalErrors} errores contados en las tareas de escritura de Español, ${top.count} (${pct(top.count / totalErrors)}) son de ${top.label.toLowerCase()}. Solo se guarda el conteo por tipo de error, no los textos.`,
    });
  }

  const asked = [...units].filter((u) => u.tutorSessions > 0).sort((a, b) => b.tutorSessions - a.tutorSessions)[0];
  if (asked) {
    const total = units.reduce((a, u) => a + u.tutorSessions, 0);
    out.push({
      id: `tutor-${asked.unit.id}`,
      kind: "tutor_topic",
      tone: "info",
      title: `El tema más consultado con Kemo es «${asked.unit.title}»`,
      detail: "Puede ser una buena señal para retomarlo en clase.",
      evidence: `${asked.tutorSessions} de ${total} conversaciones con el tutor fueron sobre este tema. El panel solo muestra el tema de cada conversación, nunca lo que el estudiante escribió.`,
    });
  }

  for (const g of diagnostics.filter((x) => x.level !== null && x.count >= 3)) {
    out.push({
      id: `diagnostico-${g.subjectId}`,
      kind: "diagnostic",
      tone: g.level! >= 3 ? "positivo" : "atencion",
      title: `Nivel promedio en el diagnóstico de ${g.subjectName}: ${formatLevel(g.level!)} de 5`,
      detail: g.level! >= 3 ? "En promedio, la sección está en lo esperado para el grado o arriba." : "En promedio, la sección está por debajo de lo esperado para el grado (nivel 3).",
      evidence: `Promedio del último diagnóstico de ${g.count} estudiantes. El nivel se estima con unas 10 preguntas adaptativas; 3 es lo esperado en el grado.`,
    });
  }
  return out;
}

const csvCell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per student, ready for a spreadsheet (UTF-8 with BOM so Excel shows the tildes). */
export function sectionCsv(m: SectionMetrics): string {
  const head = [
    "Estudiante", "Activo en los últimos 7 días", "Última actividad", "Ejercicios (7 días)", "Ejercicios (total)",
    "Aciertos (%)", "Dominio promedio (%)",
    ...m.subjects.flatMap((s) => [`Dominio ${s.subjectName} (%)`, `Nivel diagnóstico ${s.subjectName}`]),
    "Conversaciones con el tutor", "Errores de escritura", "Podría necesitar apoyo",
  ];
  const r = (x: number | null) => (x === null ? null : Math.round(x * 100));
  const rows = m.students.map((s) => [
    s.name, s.active ? "Sí" : "No", s.lastActive ? s.lastActive.slice(0, 10) : null, s.attempts7, s.attemptsTotal,
    r(s.accuracy), r(s.mastery),
    ...m.subjects.flatMap((sub) => [r(s.bySubject[sub.subjectId]?.mastery ?? null), s.bySubject[sub.subjectId]?.level != null ? formatLevel(s.bySubject[sub.subjectId].level!) : null]),
    s.tutorSessions, s.writingErrors, s.support.join("; ") || null,
  ]);
  return "﻿" + [head, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}
