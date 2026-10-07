import "server-only";
import {
  buildDemoSection,
  DEMO_SECTION,
  type PanelUnit,
  type SectionData,
} from "@edukemonos/curriculum";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export interface SectionInfo {
  id: string;
  name: string;
  gradeId: number;
  institution: string | null;
  term: number | null;
  joinCode: string;
  active: boolean;
  createdAt: string;
}

/** What every panel view gets: the section, its raw data and whether it is the demo. */
export interface PanelSource {
  section: SectionInfo;
  data: SectionData;
  demo: boolean;
  /** Base path for links: /docente/demo or /docente/seccion/<id>. */
  base: string;
}

/** ABC-123: easier to dictate in class. */
export const formatCode = (code: string) => (code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code);

const ACTIVITY_DAYS = 120;

/** PostgREST returns at most 1000 rows per request; page through larger reads. */
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/** Published units of a grade, all subjects, with their skills. Public data. */
export async function gradeUnits(supabase: SupabaseClient, grade: number): Promise<PanelUnit[]> {
  const { data, error } = await supabase
    .from("curriculum_units")
    .select("id, title, area, sort_order, subject_id, subjects(name), skills(id)")
    .eq("grade_id", grade)
    .eq("status", "published")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((u) => ({
    id: u.id,
    title: u.title,
    area: u.area,
    sortOrder: u.sort_order,
    subjectId: u.subject_id,
    subjectName: (u.subjects as unknown as { name: string } | null)?.name ?? u.subject_id,
    skillIds: ((u.skills ?? []) as { id: string }[]).map((s) => s.id),
  }));
}

export async function demoSource(): Promise<PanelSource> {
  const supabase = await createClient();
  const units = await gradeUnits(supabase, DEMO_SECTION.gradeId);
  // Anchor "now" to the day so the demo (and its cached AI summary) stays the same all day.
  const today = new Date();
  today.setUTCHours(18, 0, 0, 0);
  return {
    section: {
      id: DEMO_SECTION.id,
      name: DEMO_SECTION.name,
      gradeId: DEMO_SECTION.gradeId,
      institution: DEMO_SECTION.institution,
      term: DEMO_SECTION.term,
      joinCode: DEMO_SECTION.joinCode,
      active: true,
      createdAt: today.toISOString(),
    },
    data: buildDemoSection(units, today),
    demo: true,
    base: "/docente/demo",
  };
}

/**
 * A real section of the signed-in teacher. Everything is read with the teacher's session, so RLS
 * decides what is visible: only their own section, its members, and those students' activity
 * (never tutor transcripts). Returns null if the section is not theirs.
 */
export async function sectionSource(supabase: SupabaseClient, sectionId: string, teacherId: string): Promise<PanelSource | null> {
  const { data: s } = await supabase
    .from("sections")
    .select("id, name, grade_id, institution_text, current_term, join_code, active, created_at, teacher_id")
    .eq("id", sectionId)
    .maybeSingle();
  if (!s || s.teacher_id !== teacherId) return null;

  const [units, { data: members }] = await Promise.all([
    gradeUnits(supabase, s.grade_id),
    supabase.from("section_members").select("student_id, display_name, joined_at").eq("section_id", sectionId).order("display_name"),
  ]);
  const ids = (members ?? []).map((m) => m.student_id);
  const since = new Date(Date.now() - ACTIVITY_DAYS * 86_400_000).toISOString();
  type MasteryRow = { student_id: string; skill_id: string; score: number; attempts: number; updated_at: string };
  type AttemptRow = { student_id: string; item_id: string; is_correct: boolean | null; created_at: string; context: string };
  type DiagnosticRow = { student_id: string; subject_id: string; estimated_level: number | null; completed_at: string | null };
  type TutorRow = { student_id: string; unit_id: string | null; message_count: number; started_at: string };
  type WritingRow = { student_id: string; category: string; count: number; created_at: string };
  const [mastery, attempts, diagnostics, tutor, writing]: [MasteryRow[], AttemptRow[], DiagnosticRow[], TutorRow[], WritingRow[]] = ids.length
    ? await Promise.all([
        all<MasteryRow>((f, t) => supabase.from("mastery").select("student_id, skill_id, score, attempts, updated_at").in("student_id", ids).range(f, t)),
        all<AttemptRow>((f, t) => supabase.from("attempts").select("student_id, item_id, is_correct, created_at, context")
          .in("student_id", ids).gte("created_at", since).order("created_at").range(f, t)),
        all<DiagnosticRow>((f, t) => supabase.from("diagnostics").select("student_id, subject_id, estimated_level, completed_at")
          .in("student_id", ids).eq("status", "completed").range(f, t)),
        all<TutorRow>((f, t) => supabase.from("tutor_sessions").select("student_id, unit_id, message_count, started_at").in("student_id", ids).range(f, t)),
        all<WritingRow>((f, t) => supabase.from("writing_feedback").select("student_id, category, count, created_at").in("student_id", ids).range(f, t)),
      ])
    : [[], [], [], [], []];

  // Attempts point to items; map them to units of this grade.
  const itemIds = [...new Set(attempts.map((a) => a.item_id))];
  const unitOf = new Map<string, string>();
  for (let k = 0; k < itemIds.length; k += 200) {
    const chunk = itemIds.slice(k, k + 200);
    const { data } = await supabase.from("items").select("id, unit_id").in("id", chunk);
    for (const i of data ?? []) unitOf.set(i.id, i.unit_id);
  }

  return {
    section: {
      id: s.id,
      name: s.name,
      gradeId: s.grade_id,
      institution: s.institution_text,
      term: s.current_term,
      joinCode: s.join_code,
      active: s.active,
      createdAt: s.created_at,
    },
    data: {
      now: new Date(),
      units,
      students: (members ?? []).map((m) => ({ id: m.student_id, name: m.display_name, joinedAt: m.joined_at })),
      mastery: mastery.map((m) => ({ studentId: m.student_id, skillId: m.skill_id, score: Number(m.score), attempts: m.attempts, updatedAt: m.updated_at })),
      attempts: attempts.map((a) => ({ studentId: a.student_id, unitId: unitOf.get(a.item_id) ?? null, isCorrect: a.is_correct, createdAt: a.created_at, context: a.context })),
      diagnostics: diagnostics.flatMap((g) => (g.estimated_level !== null && g.completed_at
        ? [{ studentId: g.student_id, subjectId: g.subject_id, level: Number(g.estimated_level), completedAt: g.completed_at }] : [])),
      tutor: tutor.map((t) => ({ studentId: t.student_id, unitId: t.unit_id, messageCount: t.message_count, startedAt: t.started_at })),
      writing: writing.map((w) => ({ studentId: w.student_id, category: w.category, count: w.count, createdAt: w.created_at })),
    },
    demo: false,
    base: `/docente/seccion/${s.id}`,
  };
}

/** Access log (SPEC §12): who looked at which section or student, and exports. Never blocks the page. */
export async function audit(
  supabase: SupabaseClient,
  teacherId: string,
  action: "view_section" | "view_student" | "export_csv" | "remove_student" | "ai_summary",
  sectionId: string,
  studentId?: string,
) {
  const { error } = await supabase
    .from("teacher_audit_log")
    .insert({ teacher_id: teacherId, action, section_id: sectionId, student_id: studentId ?? null });
  if (error) console.error("audit insert failed:", error.message);
}
