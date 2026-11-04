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
  if (!name || name.length > 80) return { error: "Escriba un nombre para la sección (máximo 80 caracteres)." };
  if (![7, 8, 9].includes(grade)) return { error: "Elija el año de la sección." };
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
    return { error: "No se pudo crear la sección. Intente de nuevo." };
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

// ---------------------------------------------------------------------------
// Gamification settings (docs/producto/gamificacion.md §2.5): the teacher can only turn things off.
// ---------------------------------------------------------------------------

export interface SettingsState {
  saved?: boolean;
  error?: string;
}

export async function saveSectionSettings(sectionId: string, _prev: SettingsState, form: FormData): Promise<SettingsState> {
  if (!UUID.test(sectionId)) return { error: "Sección inválida." };
  const { supabase } = await requireStaff(`/docente/seccion/${sectionId}`);
  const target = Math.round(Number(form.get("weekly_target")));
  if (!Number.isFinite(target) || target < 1 || target > 50) return { error: "La meta semanal debe estar entre 1 y 50 ejercicios." };
  const { error } = await supabase
    .from("section_settings")
    .upsert({
      section_id: sectionId,
      streak_enabled: form.get("streak_enabled") === "on",
      weekly_target: target,
      goal_enabled: form.get("goal_enabled") === "on",
      leaderboard_enabled: form.get("leaderboard_enabled") === "on",
      updated_at: new Date().toISOString(),
    });
  if (error) {
    console.error("section settings failed:", error.message);
    return { error: "No se pudieron guardar los ajustes. Intente de nuevo." };
  }
  if (form.has("institution_id")) {
    const inst = String(form.get("institution_id") ?? "");
    const { error: instError } = await supabase.from("sections").update({ institution_id: UUID.test(inst) ? inst : null }).eq("id", sectionId);
    if (instError) {
      console.error("section institution failed:", instError.message);
      return { error: "No se pudo asociar la sección a esa institución." };
    }
  }
  revalidatePath(`/docente/seccion/${sectionId}`);
  return { saved: true };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Rows "starts_on|ends_on|label" posted by the calendar form, as JSON for the database. */
function rows(form: FormData, prefix: "break" | "period") {
  const starts = form.getAll(`${prefix}_starts_on`).map(String);
  const ends = form.getAll(`${prefix}_ends_on`).map(String);
  const labels = form.getAll(`${prefix}_label`).map(String);
  return starts
    .map((s, k) => ({ starts_on: s, ends_on: ends[k] ?? "", label: (labels[k] ?? "").trim().slice(0, 60) }))
    .filter((r) => DATE.test(r.starts_on) && DATE.test(r.ends_on));
}

export async function saveInstitutionCalendar(institutionId: string, _prev: SettingsState, form: FormData): Promise<SettingsState> {
  if (!UUID.test(institutionId)) return { error: "Institución inválida." };
  const { supabase } = await requireStaff(`/docente/institucion/${institutionId}`);
  const start = String(form.get("classes_start") ?? "");
  const end = String(form.get("classes_end") ?? "");
  if (!DATE.test(start) || !DATE.test(end) || end <= start) return { error: "Revise las fechas de inicio y fin de clases." };
  const periods = rows(form, "period");
  if (periods.length < 1 || periods.length > 4) return { error: "Defina entre 1 y 4 periodos." };
  if (periods.some((p) => p.label.length < 2)) return { error: "Cada periodo necesita un nombre (por ejemplo, «Primer trimestre»)." };
  const { error } = await supabase.rpc("save_institution_calendar", {
    p_institution: institutionId,
    p_year: Number(start.slice(0, 4)),
    p_classes_start: start,
    p_classes_end: end,
    p_breaks: rows(form, "break").map((b) => ({ ...b, label: b.label.length >= 2 ? b.label : "Vacaciones" })),
    p_periods: periods,
  });
  if (error) {
    if (/must not overlap|inside the school year/.test(error.message)) return { error: "Los periodos y las vacaciones deben estar dentro del año lectivo, y los periodos no pueden traslaparse." };
    if (/not an admin/.test(error.message)) return { error: "Solo quien administra la institución puede cambiar su calendario." };
    console.error("save calendar failed:", error.message);
    return { error: "No se pudo guardar el calendario. Intente de nuevo." };
  }
  revalidatePath(`/docente/institucion/${institutionId}`);
  return { saved: true };
}

export async function addInstitutionMember(institutionId: string, _prev: SettingsState, form: FormData): Promise<SettingsState> {
  if (!UUID.test(institutionId)) return { error: "Institución inválida." };
  const { supabase } = await requireStaff(`/docente/institucion/${institutionId}`);
  const email = String(form.get("email") ?? "").trim();
  const role = form.get("role") === "admin" ? "admin" : "teacher";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Escriba un correo válido." };
  const { data, error } = await supabase.rpc("add_institution_member", { p_institution: institutionId, p_email: email, p_role: role });
  if (error) {
    console.error("add member failed:", error.message);
    return { error: "No se pudo agregar a esa persona." };
  }
  if (!data) return { error: "Esa persona todavía no ha entrado a Eduka. Pídale que entre una vez al panel docente con ese correo y vuelva a intentarlo." };
  revalidatePath(`/docente/institucion/${institutionId}`);
  return { saved: true };
}
