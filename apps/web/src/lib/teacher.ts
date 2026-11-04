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
  /** Subject of a subject section; null = every subject (standalone section or a guide's group view). */
  subjectId: string | null;
  subjectName: string | null;
  /** The group a subject section belongs to: students join with the group's code. */
  group: { id: string; name: string; joinCode: string } | null;
}

/** What every panel view gets: the section, its raw data and whether it is the demo. */
export interface PanelSource {
  section: SectionInfo;
  data: SectionData;
  demo: boolean;
  /** Base path for links: /docente/demo, /docente/seccion/<id> or /docente/grupo/<id>/panel. */
  base: string;
  /** A teacher's section, or a guide's view of a whole group. */
  kind: "section" | "group";
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

/** Published units of a grade (all subjects, or one), with their skills. Public data. */
export async function gradeUnits(supabase: SupabaseClient, grade: number, subjectId: string | null = null): Promise<PanelUnit[]> {
  let query = supabase
    .from("curriculum_units")
    .select("id, title, area, sort_order, subject_id, subjects(name), skills(id)")
    .eq("grade_id", grade)
    .eq("status", "published");
  if (subjectId) query = query.eq("subject_id", subjectId);
  const { data, error } = await query.order("sort_order");
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

/**
 * Demo: a Math section of group 7-3 (what a subject teacher sees), or with `guide` the whole group
 * in every subject (what its guide sees). Fictitious students over the real units.
 */
export async function demoSource(guide = false): Promise<PanelSource> {
  const supabase = await createClient();
  const units = await gradeUnits(supabase, DEMO_SECTION.gradeId, guide ? null : DEMO_SECTION.subjectId);
  // Anchor "now" to the day so the demo (and its cached AI summary) stays the same all day.
  const today = new Date();
  today.setUTCHours(18, 0, 0, 0);
  return {
    section: {
      id: DEMO_SECTION.id,
      name: guide ? DEMO_SECTION.groupName : DEMO_SECTION.name,
      gradeId: DEMO_SECTION.gradeId,
      institution: DEMO_SECTION.institution,
      term: DEMO_SECTION.term,
      joinCode: DEMO_SECTION.joinCode,
      active: true,
      createdAt: today.toISOString(),
      subjectId: guide ? null : DEMO_SECTION.subjectId,
      subjectName: guide ? null : DEMO_SECTION.subjectName,
      group: { id: "demo", name: DEMO_SECTION.groupName, joinCode: DEMO_SECTION.joinCode },
    },
    data: buildDemoSection(units, today),
    demo: true,
    base: guide ? "/docente/demo/guia" : "/docente/demo",
    kind: guide ? "group" : "section",
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
    .select("id, name, grade_id, institution_text, current_term, join_code, active, created_at, teacher_id, subject_id, subjects(name), groups(id, name, join_code)")
    .eq("id", sectionId)
    .maybeSingle();
  if (!s || s.teacher_id !== teacherId) return null;
  const group = s.groups as unknown as { id: string; name: string; join_code: string } | null;

  const [units, { data: members }] = await Promise.all([
    gradeUnits(supabase, s.grade_id, s.subject_id),
    supabase.from("section_members").select("student_id, display_name, joined_at").eq("section_id", sectionId).order("display_name"),
  ]);
  const data = await learningData(supabase, units, members ?? [], s.subject_id);
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
      subjectId: s.subject_id,
      subjectName: (s.subjects as unknown as { name: string } | null)?.name ?? null,
      group: group ? { id: group.id, name: group.name, joinCode: group.join_code } : null,
    },
    data,
    demo: false,
    base: `/docente/seccion/${s.id}`,
    kind: "section",
  };
}

/**
 * A guide's view of their group: every student of the group in every subject. RLS lets a guide
 * read all subjects of the group's students and nothing else. Null if the teacher is not its guide.
 */
export async function groupSource(supabase: SupabaseClient, groupId: string, teacherId: string): Promise<PanelSource | null> {
  const { data: g } = await supabase
    .from("groups")
    .select("id, name, grade_id, join_code, active, created_at, guide_id, institutions(name)")
    .eq("id", groupId)
    .maybeSingle();
  if (!g || g.guide_id !== teacherId) return null;
  const [units, { data: members }] = await Promise.all([
    gradeUnits(supabase, g.grade_id),
    supabase.from("group_members").select("student_id, display_name, joined_at").eq("group_id", groupId).order("display_name"),
  ]);
  return {
    section: {
      id: g.id,
      name: g.name,
      gradeId: g.grade_id,
      institution: (g.institutions as unknown as { name: string } | null)?.name ?? null,
      term: null,
      joinCode: g.join_code,
      active: g.active,
      createdAt: g.created_at,
      subjectId: null,
      subjectName: null,
      group: { id: g.id, name: g.name, joinCode: g.join_code },
    },
    data: await learningData(supabase, units, members ?? [], null),
    demo: false,
    base: `/docente/grupo/${g.id}/panel`,
    kind: "group",
  };
}

/**
 * Learning data of some students, read with the teacher's session (RLS decides what is visible:
 * a subject teacher only gets their subject). `subjectId` also filters explicitly, so a teacher
 * who is a guide too still sees only the section's subject in a section.
 */
async function learningData(
  supabase: SupabaseClient,
  units: PanelUnit[],
  members: { student_id: string; display_name: string; joined_at: string }[],
  subjectId: string | null,
): Promise<SectionData> {
  const ids = members.map((m) => m.student_id);
  const bySubject = <T,>(q: T): T => (subjectId ? (q as unknown as { eq: (column: string, value: string) => T }).eq("subject_id", subjectId) : q);
  const since = new Date(Date.now() - ACTIVITY_DAYS * 86_400_000).toISOString();
  type MasteryRow = { student_id: string; skill_id: string; score: number; attempts: number; updated_at: string };
  type AttemptRow = { student_id: string; item_id: string; is_correct: boolean | null; created_at: string; context: string };
  type DiagnosticRow = { student_id: string; subject_id: string; estimated_level: number | null; completed_at: string | null };
  type TutorRow = { student_id: string; unit_id: string | null; message_count: number; started_at: string };
  type WritingRow = { student_id: string; category: string; count: number; created_at: string };
  const [mastery, attempts, diagnostics, tutor, writing]: [MasteryRow[], AttemptRow[], DiagnosticRow[], TutorRow[], WritingRow[]] = ids.length
    ? await Promise.all([
        all<MasteryRow>((f, t) => bySubject(supabase.from("mastery").select("student_id, skill_id, score, attempts, updated_at").in("student_id", ids)).range(f, t)),
        all<AttemptRow>((f, t) => bySubject(supabase.from("attempts").select("student_id, item_id, is_correct, created_at, context")
          .in("student_id", ids).gte("created_at", since)).order("created_at").range(f, t)),
        all<DiagnosticRow>((f, t) => bySubject(supabase.from("diagnostics").select("student_id, subject_id, estimated_level, completed_at")
          .in("student_id", ids).eq("status", "completed")).range(f, t)),
        all<TutorRow>((f, t) => bySubject(supabase.from("tutor_sessions").select("student_id, unit_id, message_count, started_at").in("student_id", ids)).range(f, t)),
        all<WritingRow>((f, t) => bySubject(supabase.from("writing_feedback").select("student_id, category, count, created_at").in("student_id", ids)).range(f, t)),
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
    now: new Date(),
    units,
    students: members.map((m) => ({ id: m.student_id, name: m.display_name, joinedAt: m.joined_at })),
    mastery: mastery.map((m) => ({ studentId: m.student_id, skillId: m.skill_id, score: Number(m.score), attempts: m.attempts, updatedAt: m.updated_at })),
    attempts: attempts.map((a) => ({ studentId: a.student_id, unitId: unitOf.get(a.item_id) ?? null, isCorrect: a.is_correct, createdAt: a.created_at, context: a.context })),
    diagnostics: diagnostics.flatMap((g) => (g.estimated_level !== null && g.completed_at
      ? [{ studentId: g.student_id, subjectId: g.subject_id, level: Number(g.estimated_level), completedAt: g.completed_at }] : [])),
    tutor: tutor.map((t) => ({ studentId: t.student_id, unitId: t.unit_id, messageCount: t.message_count, startedAt: t.started_at })),
    writing: writing.map((w) => ({ studentId: w.student_id, category: w.category, count: w.count, createdAt: w.created_at })),
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
