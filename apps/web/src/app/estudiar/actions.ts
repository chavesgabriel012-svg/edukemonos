"use server";

import {
  DIAGNOSTIC_LENGTH,
  nextDifficulty,
  pickDiagnosticItem,
  pickPracticeItem,
  practiceTarget,
} from "@edukemonos/curriculum";
import { createClient } from "@/lib/supabase/server";
import type { PublicItem } from "@/lib/learn";

/**
 * Student-side Server Actions. They run as the visitor (RLS applies) and never see answer keys:
 * grading, mastery and diagnostic levels happen inside the database (submit_attempt,
 * finish_diagnostic). Any of them can be called by a direct POST, so each one checks its inputs.
 */

const ITEM_COLUMNS = "id, unit_id, skill_ids, kind, stem, options, difficulty, verified, reading_level, reviewer_id";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/**
 * Students study without an account: the first time they answer, they get an anonymous session
 * that keeps their progress on this device.
 */
async function studentClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) return { supabase, userId: data.user.id, error: null };
  const { data: signed, error } = await supabase.auth.signInAnonymously();
  if (error || !signed.user) {
    console.error("anonymous sign-in failed:", error?.message);
    return { supabase, userId: null, error: "No pudimos guardar tu progreso en este momento. Intenta de nuevo en un rato." };
  }
  return { supabase, userId: signed.user.id, error: null };
}

// ---------------------------------------------------------------------------
// Practice
// ---------------------------------------------------------------------------

/** Next practice item of a unit, chosen for the student's mastery and history. */
export async function nextPracticeItem(unitId: string, excludeId: string | null): Promise<ActionResult<PublicItem | null>> {
  if (!UUID.test(unitId)) return fail("Unidad inválida.");
  const supabase = await createClient();
  const { data: items, error } = await supabase
    .from("items")
    .select(ITEM_COLUMNS)
    .eq("unit_id", unitId)
    .eq("status", "published")
    .eq("kind", "single_choice")
    .returns<PublicItem[]>();
  if (error) return fail("No se pudieron cargar los ejercicios.");
  if (!items?.length) return { ok: true, data: null };

  const { data: auth } = await supabase.auth.getUser();
  let history: { item_id: string; is_correct: boolean | null; created_at: string }[] = [];
  let score: number | null = null;
  if (auth.user) {
    const skillIds = [...new Set(items.flatMap((i) => i.skill_ids))];
    const [{ data: attempts }, { data: mastery }] = await Promise.all([
      supabase.from("attempts").select("item_id, is_correct, created_at").eq("student_id", auth.user.id).in("item_id", items.map((i) => i.id)),
      supabase.from("mastery").select("score").eq("student_id", auth.user.id).in("skill_id", skillIds),
    ]);
    history = attempts ?? [];
    const scores = (mastery ?? []).map((m: { score: number }) => Number(m.score));
    score = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  }
  const exclude = excludeId && UUID.test(excludeId) ? excludeId : null;
  return { ok: true, data: pickPracticeItem(items, history, practiceTarget(score), exclude) };
}

export interface AnswerFeedback {
  is_correct: boolean | null;
  correct_index: number | null;
  explanation: string | null;
  distractor_explanations: string[] | null;
  /** false when practice had to grade without a session: the answer was not saved. */
  saved: boolean;
}

/** Grades an answer in the database (which also updates mastery) and returns the feedback. */
export async function answerItem(
  itemId: string,
  answerIndex: number,
  timeMs: number,
  diagnosticId: string | null = null,
): Promise<ActionResult<AnswerFeedback>> {
  if (!UUID.test(itemId) || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) return fail("Respuesta inválida.");
  if (diagnosticId !== null && !UUID.test(diagnosticId)) return fail("Diagnóstico inválido.");
  const { supabase, error: sessionError } = await studentClient();
  if (sessionError) {
    if (diagnosticId) return fail(sessionError);
    // Practice still works without a session (e.g. the per-IP anonymous sign-in limit in a
    // classroom): grade without saving, and say so.
    const { data, error } = await supabase.rpc("check_answer", { p_item_id: itemId, p_answer_index: answerIndex });
    if (error) return fail("No se pudo revisar tu respuesta. Intenta de nuevo.");
    return { ok: true, data: { ...(data as Omit<AnswerFeedback, "saved">), saved: false } };
  }
  const { data, error } = await supabase.rpc("submit_attempt", {
    p_item_id: itemId,
    p_answer_index: answerIndex,
    p_time_ms: Math.max(0, Math.min(Math.round(timeMs), 3_600_000)),
    p_context: diagnosticId ? "diagnostic" : "practice",
    p_diagnostic_id: diagnosticId,
  });
  if (error) {
    console.error("submit_attempt failed:", error.message);
    return fail("No se pudo revisar tu respuesta. Intenta de nuevo.");
  }
  return { ok: true, data: { ...(data as Omit<AnswerFeedback, "saved">), saved: true } };
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface DiagnosticStep {
  diagnosticId: string;
  item: PublicItem | null;
  answered: number;
  total: number;
}

async function diagnosticItems(supabase: Awaited<ReturnType<typeof createClient>>, subject: string, grade: number) {
  const { data: units } = await supabase
    .from("curriculum_units")
    .select("id")
    .eq("subject_id", subject)
    .eq("grade_id", grade)
    .eq("status", "published")
    .order("sort_order");
  const unitIds = (units ?? []).map((u: { id: string }) => u.id);
  if (!unitIds.length) return { unitIds, items: [] as PublicItem[] };
  const { data: items } = await supabase
    .from("items")
    .select(ITEM_COLUMNS)
    .in("unit_id", unitIds)
    .eq("status", "published")
    .eq("kind", "single_choice")
    .eq("verified", true)
    .returns<PublicItem[]>();
  return { unitIds, items: items ?? [] };
}

/** Next step of a diagnostic: the next item, or null when it is time to close it. */
export async function diagnosticStep(diagnosticId: string): Promise<ActionResult<DiagnosticStep>> {
  if (!UUID.test(diagnosticId)) return fail("Diagnóstico inválido.");
  const supabase = await createClient();
  const { data: diag } = await supabase
    .from("diagnostics")
    .select("id, subject_id, grade_id, status")
    .eq("id", diagnosticId)
    .maybeSingle();
  if (!diag || diag.status !== "in_progress") return fail("Este diagnóstico ya terminó.");

  const { unitIds, items } = await diagnosticItems(supabase, diag.subject_id, diag.grade_id);
  const { data: attempts } = await supabase
    .from("attempts")
    .select("item_id, is_correct, created_at")
    .eq("diagnostic_id", diagnosticId)
    .order("created_at");
  const byId = new Map(items.map((i) => [i.id, i]));
  const answered = (attempts ?? []).filter((a: { item_id: string }) => byId.has(a.item_id));
  const responses = answered.map((a: { item_id: string; is_correct: boolean | null }) => ({
    difficulty: byId.get(a.item_id)!.difficulty,
    correct: a.is_correct === true,
  }));
  const total = Math.min(DIAGNOSTIC_LENGTH, items.length);
  if (answered.length >= total) return { ok: true, data: { diagnosticId, item: null, answered: answered.length, total } };

  const used = answered.map((a: { item_id: string }) => a.item_id);
  const item = pickDiagnosticItem(items, used, used.map((id: string) => byId.get(id)!.unit_id), nextDifficulty(responses), unitIds);
  return { ok: true, data: { diagnosticId, item: item ? byId.get(item.id)! : null, answered: answered.length, total } };
}

export async function startDiagnostic(subject: string, grade: number): Promise<ActionResult<DiagnosticStep>> {
  if (!/^[a-z_]{2,40}$/.test(subject) || ![7, 8, 9].includes(grade)) return fail("Materia o grado inválido.");
  const { supabase, error: sessionError } = await studentClient();
  if (sessionError) return fail(sessionError);
  const { items } = await diagnosticItems(supabase, subject, grade);
  if (items.length < 4) return fail("Todavía no hay suficientes ejercicios verificados para un diagnóstico de esta materia.");
  const { data, error } = await supabase.rpc("start_diagnostic", { p_subject_id: subject, p_grade_id: grade });
  if (error || !data) {
    console.error("start_diagnostic failed:", error?.message);
    return fail("No se pudo iniciar el diagnóstico. Intenta de nuevo.");
  }
  return diagnosticStep(data as string);
}

export interface DiagnosticResult {
  status: "completed" | "abandoned";
  level?: number;
  answered?: number;
  correct?: number;
}

export async function finishDiagnostic(diagnosticId: string): Promise<ActionResult<DiagnosticResult>> {
  if (!UUID.test(diagnosticId)) return fail("Diagnóstico inválido.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finish_diagnostic", { p_diagnostic_id: diagnosticId });
  if (error) {
    console.error("finish_diagnostic failed:", error.message);
    return fail("No se pudo cerrar el diagnóstico.");
  }
  return { ok: true, data: data as DiagnosticResult };
}

// ---------------------------------------------------------------------------
// Sections and reports
// ---------------------------------------------------------------------------

export interface JoinState {
  error?: string;
  joined?: { section_name: string; grade_id: number };
}

export async function joinSection(_prev: JoinState, form: FormData): Promise<JoinState> {
  const code = String(form.get("code") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const consent = form.get("consent") === "on";
  if (!code) return { error: "Escribe el código que te dio tu docente." };
  if (!name || name.length > 60) return { error: "Escribe tu nombre (máximo 60 caracteres)." };
  if (!consent) return { error: "Para unirte necesitamos tu consentimiento." };
  const { supabase, error: sessionError } = await studentClient();
  if (sessionError) return { error: sessionError };
  const { data, error } = await supabase.rpc("join_section", { p_code: code, p_display_name: name, p_consent: consent });
  if (error) {
    if (/invalid or inactive code/.test(error.message)) return { error: "Ese código no existe o la sección ya no está activa. Revísalo con tu docente." };
    if (/staff accounts/.test(error.message)) return { error: "Las cuentas de docente o revisor no pueden unirse como estudiantes." };
    console.error("join_section failed:", error.message);
    return { error: "No pudimos unirte a la sección. Intenta de nuevo." };
  }
  const row = (data as { section_name: string; grade_id: number }[])[0];
  return { joined: row };
}

export interface ReportState {
  sent?: boolean;
  error?: string;
}

const REPORT_TARGETS = ["unit", "material", "item", "tutor_message"] as const;

/** "Reportar un error" (SPEC §4.4). Anyone can report; reviewers read reports. */
export async function reportError(_prev: ReportState, form: FormData): Promise<ReportState> {
  const targetType = String(form.get("target_type") ?? "");
  const targetId = String(form.get("target_id") ?? "");
  const comment = String(form.get("comment") ?? "").trim().slice(0, 2000);
  if (!(REPORT_TARGETS as readonly string[]).includes(targetType) || !UUID.test(targetId)) return { error: "No se pudo enviar el reporte." };
  if (comment.length < 3) return { error: "Cuéntanos brevemente qué está mal." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("reports")
    .insert({ target_type: targetType, target_id: targetId, comment, reporter_id: data.user?.id ?? null });
  if (error) {
    console.error("report insert failed:", error.message);
    return { error: "No se pudo enviar el reporte. Intenta de nuevo." };
  }
  return { sent: true };
}
