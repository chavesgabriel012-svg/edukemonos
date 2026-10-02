import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Read-side helpers for the student pages. Everything here goes through RLS as the visitor. */

export const GRADES = [7, 8, 9] as const;
export type Grade = (typeof GRADES)[number];

export function parseGrade(value: string): Grade | null {
  const g = Number(value);
  return (GRADES as readonly number[]).includes(g) ? (g as Grade) : null;
}

export const GRADE_LABEL: Record<Grade, string> = { 7: "Sétimo", 8: "Octavo", 9: "Noveno" };

export interface Subject {
  id: string;
  name: string;
}

export interface UnitSummary {
  id: string;
  title: string;
  area: string | null;
  sort_order: number;
  skills: { id: string; name: string }[];
}

export interface Material {
  id: string;
  kind: "summary" | "explanation" | "worked_examples" | "glossary";
  content: string;
  reviewer_id: string | null;
  created_at: string;
}

export interface PublicItem {
  id: string;
  unit_id: string;
  skill_ids: string[];
  kind: "single_choice" | "open_writing";
  stem: string;
  options: string[] | null;
  difficulty: number;
  verified: boolean;
  reading_level: "literal" | "inferencial" | "critica" | null;
  reviewer_id: string | null;
}

/** The visitor's session, if any (students are anonymous Supabase users). */
export async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user ?? null };
}

/** Subjects with at least one published unit in the grade; the rest show as "próximamente". */
export async function subjectsForGrade(grade: Grade) {
  const supabase = await createClient();
  const [{ data: subjects }, { data: units }] = await Promise.all([
    supabase.from("subjects").select("id, name").order("sort"),
    supabase.from("curriculum_units").select("subject_id").eq("grade_id", grade).eq("status", "published"),
  ]);
  const available = new Set((units ?? []).map((u: { subject_id: string }) => u.subject_id));
  return (subjects ?? []).map((s: Subject) => ({ ...s, available: available.has(s.id) }));
}

export async function subjectName(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("subjects").select("name").eq("id", id).maybeSingle();
  return data?.name ?? null;
}

export async function unitsFor(subject: string, grade: Grade): Promise<UnitSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("curriculum_units")
    .select("id, title, area, sort_order, skills(id, name, sort_order)")
    .eq("subject_id", subject)
    .eq("grade_id", grade)
    .eq("status", "published")
    .order("sort_order");
  return (data ?? []).map((u: UnitSummary & { skills: { id: string; name: string; sort_order: number }[] }) => ({
    ...u,
    skills: [...u.skills].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

/** The student's mastery per skill (empty for visitors without a session). */
export async function masteryMap(skillIds: string[]): Promise<Map<string, number>> {
  const { supabase, user } = await currentUser();
  if (!user || skillIds.length === 0) return new Map();
  const { data } = await supabase.from("mastery").select("skill_id, score").eq("student_id", user.id).in("skill_id", skillIds);
  return new Map((data ?? []).map((m: { skill_id: string; score: number }) => [m.skill_id, Number(m.score)]));
}
