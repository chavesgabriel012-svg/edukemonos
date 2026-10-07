"use server";

import { computeSectionMetrics } from "@edukemonos/curriculum";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { audit, demoSource, sectionSource } from "@/lib/teacher";
import { summarize, type SummaryResult } from "@/lib/teacher-summary";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createSection(_prev: { error?: string } | null, form: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await requireStaff("/docente");
  const name = String(form.get("name") ?? "").trim();
  const grade = Number(form.get("grade"));
  const institution = String(form.get("institution") ?? "").trim();
  const term = Number(form.get("term"));
  if (!name || name.length > 80) return { error: "Escribe un nombre para la sección (máximo 80 caracteres)." };
  if (![7, 8, 9].includes(grade)) return { error: "Elige el año de la sección." };
  const { data, error } = await supabase
    .from("sections")
    .insert({
      teacher_id: user.id,
      name,
      grade_id: grade,
      institution_text: institution.slice(0, 160) || null,
      current_term: [1, 2, 3].includes(term) ? term : null,
      join_code: "",
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("create section failed:", error?.message);
    return { error: "No se pudo crear la sección. Intenta de nuevo." };
  }
  redirect(`/docente/seccion/${data.id}`);
}

export async function regenerateCode(sectionId: string) {
  if (!UUID.test(sectionId)) return;
  const { supabase } = await requireStaff("/docente");
  const { error } = await supabase.rpc("regenerate_join_code", { p_section_id: sectionId });
  if (error) console.error("regenerate code failed:", error.message);
  revalidatePath(`/docente/seccion/${sectionId}`);
}

export async function setSectionActive(sectionId: string, active: boolean) {
  if (!UUID.test(sectionId)) return;
  const { supabase } = await requireStaff("/docente");
  const { error } = await supabase.from("sections").update({ active }).eq("id", sectionId);
  if (error) console.error("toggle section failed:", error.message);
  revalidatePath(`/docente/seccion/${sectionId}`);
  revalidatePath("/docente");
}

/** Takes the student out of the section: the teacher stops seeing their data (SPEC §12). */
export async function removeStudent(sectionId: string, studentId: string) {
  if (!UUID.test(sectionId) || !UUID.test(studentId)) return;
  const { supabase, user } = await requireStaff("/docente");
  const { error } = await supabase.from("section_members").delete().eq("section_id", sectionId).eq("student_id", studentId);
  if (error) {
    console.error("remove student failed:", error.message);
    return;
  }
  await audit(supabase, user.id, "remove_student", sectionId, studentId);
  redirect(`/docente/seccion/${sectionId}?retirado=1`);
}

/** "Resumen para el docente". target is a section id or "demo". */
export async function teacherSummary(target: string): Promise<SummaryResult> {
  if (target === "demo") {
    const source = await demoSource();
    const metrics = computeSectionMetrics(source.data);
    return summarize({ findings: metrics.findings, sectionLabel: label(source.section.gradeId, metrics), sectionId: null, actorId: null });
  }
  if (!UUID.test(target)) return { ok: false, error: "Sección no válida." };
  const { supabase, user } = await requireStaff("/docente");
  const source = await sectionSource(supabase, target, user.id);
  if (!source) return { ok: false, error: "Esta sección no es tuya." };
  const metrics = computeSectionMetrics(source.data);
  await audit(supabase, user.id, "ai_summary", target);
  return summarize({ findings: metrics.findings, sectionLabel: label(source.section.gradeId, metrics), sectionId: target, actorId: user.id });
}

function label(grade: number, metrics: ReturnType<typeof computeSectionMetrics>) {
  return `${grade}.º año, ${metrics.overview.students} estudiantes; materias: ${metrics.subjects.map((s) => s.subjectName).join(", ")}`;
}
