"use server";

import {
  DIAGNOSTIC_LENGTH,
  nextDifficulty,
  pickDiagnosticItem,
  pickPracticeItem,
  practiceTarget,
} from "@edukemonos/curriculum";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { studentClient } from "@/lib/student-session";
import type { GameResult, GameRunView, PieceFeedback } from "@/lib/games";
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
  /** A group (every subject of it) or a standalone section. */
  joined?: { kind: "group" | "section"; name: string; grade_id: number; subjects: string[] };
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
  // One code for everything: a group code puts the student in every subject of the group.
  const { data, error } = await supabase.rpc("join_with_code", { p_code: code, p_display_name: name, p_consent: consent });
  if (error) {
    if (/invalid or inactive code/.test(error.message)) return { error: "Ese código no existe o la sección ya no está activa. Revísalo con tu docente." };
    if (/staff accounts/.test(error.message)) return { error: "Las cuentas de docente o revisor no pueden unirse como estudiantes." };
    console.error("join_section failed:", error.message);
    return { error: "No pudimos unirte a la sección. Intenta de nuevo." };
  }
  return { joined: data as NonNullable<JoinState["joined"]> };
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

// ---------------------------------------------------------------------------
// Tutor and writing feedback
// ---------------------------------------------------------------------------

export interface TutorMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  safety_flags: string[];
}

/**
 * Makes sure the student has a session before the first tutor message, and returns their latest
 * conversation for this unit (their own rows only: RLS).
 */
export async function openTutor(unitId: string): Promise<ActionResult<{ sessionId: string | null; messages: TutorMessage[] }>> {
  if (!UUID.test(unitId)) return fail("Unidad inválida.");
  const { supabase, userId, error } = await studentClient();
  if (error || !userId) return fail(error ?? "No pudimos abrir tu sesión.");
  const { data: session } = await supabase
    .from("tutor_sessions")
    .select("id")
    .eq("student_id", userId)
    .eq("unit_id", unitId)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!session) return { ok: true, data: { sessionId: null, messages: [] } };
  const { data: messages } = await supabase
    .from("tutor_messages")
    .select("id, role, content, safety_flags")
    .eq("session_id", session.id)
    .in("role", ["user", "assistant"])
    .order("created_at");
  return { ok: true, data: { sessionId: session.id, messages: (messages ?? []) as TutorMessage[] } };
}

export interface WritingState {
  feedback?: string;
  error?: string;
}

/**
 * Feedback on an open writing task (Español). The text goes to the model once and is not stored;
 * only error counts per category are kept for the teacher (SPEC §6, §10).
 */
export async function writingFeedback(_prev: WritingState, form: FormData): Promise<WritingState> {
  const itemId = String(form.get("item_id") ?? "");
  const text = String(form.get("text") ?? "").trim();
  if (!UUID.test(itemId)) return { error: "Consigna inválida." };
  if (text.length < 20) return { error: "Escribe un poco más para poder darte retroalimentación." };
  if (text.length > 4_000) return { error: "Tu texto es muy largo; intenta con uno más corto (máximo unas 600 palabras)." };
  const { userId, error: sessionError } = await studentClient();
  if (sessionError || !userId) return { error: sessionError ?? "No pudimos abrir tu sesión." };

  const { adminClient } = await import("@/lib/supabase/admin");
  const { consumeQuota, serverAI, TUTOR_LIMITS } = await import("@/lib/tutor-server");
  const { screenStudentMessage, writingFeedbackSchema } = await import("@edukemonos/ai/tutor");
  const { renderPrompt, writingFeedbackSystem } = await import("@edukemonos/ai/prompts");
  const admin = adminClient();
  const { data: item } = await admin
    .from("items")
    .select("id, unit_id, stem, explanation, kind, status")
    .eq("id", itemId)
    .eq("kind", "open_writing")
    .eq("status", "published")
    .maybeSingle();
  if (!item) return { error: "Esta consigna no está disponible." };
  if (!(await consumeQuota(`writing:day:${userId}`, TUTOR_LIMITS.writingPerDay, 86_400))) {
    return { error: "Por hoy ya pediste todas las revisiones de escritura. Mañana puedes seguir." };
  }
  const screened = screenStudentMessage(text);
  try {
    const { data } = await serverAI().generateStructured(
      // Writing feedback must be exact (it names specific errors): the generation model, not the chat one.
      { role: "bulk", purpose: "writing_feedback", actorId: userId },
      {
        system: renderPrompt(writingFeedbackSystem, {}),
        messages: [
          { role: "user", content: `Consigna:\n${item.stem}\n\nCriterios:\n${item.explanation ?? ""}\n\nTexto del estudiante:\n${screened.text}` },
        ],
        schema: writingFeedbackSchema,
        schemaName: "writing_feedback",
        maxTokens: 2_000,
      },
    );
    const counts = data.errors.filter((e) => e.count > 0).map((e) => ({ student_id: userId, unit_id: item.unit_id, category: e.category, count: Math.min(e.count, 100) }));
    if (counts.length) {
      await admin.from("students").upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });
      const { error: insertError } = await admin.from("writing_feedback").insert(counts);
      if (insertError) console.error("writing_feedback insert failed:", insertError.message);
    }
    return { feedback: data.feedback };
  } catch (error) {
    console.error("writing feedback failed:", (error as Error).message);
    return { error: "No pudimos revisar tu texto ahora. Intenta de nuevo en un rato." };
  }
}

// ---------------------------------------------------------------------------
// Weekly streak (docs/producto/gamificacion.md §4)
// ---------------------------------------------------------------------------

/** Uses this period's repair (comodín) on the last missed week. The database checks it is allowed. */
export async function repairStreak(): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.is_anonymous) return fail("Primero resuelve un ejercicio para tener una racha.");
  const { data, error } = await supabase.rpc("use_streak_repair");
  if (error) {
    console.error("use_streak_repair failed:", error.message);
    return fail("No pudimos usar el comodín. Intenta de nuevo.");
  }
  if (!(data as { ok: boolean }).ok) return fail("El comodín ya no está disponible para esa semana.");
  return { ok: true, data: null };
}

/** Records that the rest reminder was shown (minutes only, no personal data). */
export async function logRestReminder(minutes: number): Promise<void> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const m = Math.min(600, Math.max(0, Math.round(Number(minutes) || 0)));
  const { error } = await supabase.from("events").insert({ actor_id: auth.user.id, name: "rest_reminder_shown", props: { minutes: m } });
  if (error) console.error("rest reminder event failed:", error.message);
}

// ---------------------------------------------------------------------------
// Nickname and the week's table (docs/producto/gamificacion.md §5)
// ---------------------------------------------------------------------------

export interface NicknameState {
  error?: string;
  saved?: boolean;
}

export async function chooseNickname(_prev: NicknameState, form: FormData): Promise<NicknameState> {
  const nickname = String(form.get("nickname") ?? "");
  if (!nickname) return { error: "Elige uno de los apodos." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.is_anonymous) return { error: "Primero resuelve un ejercicio o únete a tu sección." };
  const { data, error } = await supabase.rpc("choose_nickname", { p_nickname: nickname });
  if (error) {
    console.error("choose_nickname failed:", error.message);
    return { error: "No pudimos guardar tu apodo. Intenta de nuevo." };
  }
  const r = data as { ok: boolean; error?: string };
  if (!r.ok) return { error: r.error === "taken" ? "Alguien acaba de elegir ese apodo. Elige otro." : "Elige uno de los apodos de la lista." };
  revalidatePath("/mis-secciones");
  return { saved: true };
}

export async function setLeaderboardHidden(hidden: boolean): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.is_anonymous) return fail("Primero únete a tu sección.");
  const { error } = await supabase.rpc("set_leaderboard_hidden", { p_hidden: hidden });
  if (error) {
    console.error("set_leaderboard_hidden failed:", error.message);
    return fail("No pudimos guardar el cambio. Intenta de nuevo.");
  }
  revalidatePath("/mis-secciones");
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Mini-games (docs/producto/gamificacion.md §6). The database picks the pieces, grades every answer
// (context 'game', it counts for mastery like practice) and computes the result.
// ---------------------------------------------------------------------------

const GAME_MODES = ["pairs", "order", "fill", "find_error", "ghost_race"] as const;

export async function startGame(unitId: string, mode: string): Promise<ActionResult<GameRunView>> {
  if (!UUID.test(unitId) || !GAME_MODES.includes(mode as (typeof GAME_MODES)[number])) return fail("Juego inválido.");
  const { supabase, error: sessionError } = await studentClient();
  if (sessionError) return fail(sessionError);
  const { data, error } = await supabase.rpc("start_game_run", { p_unit: unitId, p_mode: mode });
  if (error) {
    console.error("start_game_run failed:", error.message);
    return fail("No pudimos empezar el juego. Intenta de nuevo.");
  }
  const r = data as { ok: boolean; error?: string } & GameRunView;
  if (!r.ok) return fail(r.error === "disabled" ? "Tu docente no usa los juegos en tu sección." : "Este juego todavía no tiene contenido en esta unidad.");
  return { ok: true, data: { run: r.run, mode: r.mode, rival: r.rival, pieces: r.pieces } };
}

/** `answer`: an option or step index (fill, find_error, race) or a list (pairs, order). */
export async function answerGamePiece(runId: string, itemId: string, answer: number | number[]): Promise<ActionResult<PieceFeedback>> {
  if (!UUID.test(runId) || !UUID.test(itemId)) return fail("Pieza inválida.");
  const list = Array.isArray(answer) ? answer.filter((x) => Number.isInteger(x) && x >= 0 && x < 20).slice(0, 10) : null;
  const index = !Array.isArray(answer) && Number.isInteger(answer) && answer >= 0 && answer < 20 ? answer : null;
  if (list === null && index === null) return fail("Respuesta inválida.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_attempt", {
    p_item_id: itemId,
    p_answer_index: index,
    p_answer_text: list ? JSON.stringify(list) : null,
    p_session_id: runId,
    p_context: "game",
  });
  if (error) {
    console.error("game answer failed:", error.message);
    return fail(/already answered/.test(error.message) ? "Ya respondiste esta pieza." : "No pudimos revisar tu respuesta. Intenta de nuevo.");
  }
  return { ok: true, data: data as PieceFeedback };
}

export async function finishGame(runId: string): Promise<ActionResult<GameResult>> {
  if (!UUID.test(runId)) return fail("Juego inválido.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finish_game_run", { p_run: runId });
  if (error) {
    console.error("finish_game_run failed:", error.message);
    return fail("No pudimos cerrar el juego, pero tus respuestas quedaron guardadas.");
  }
  return { ok: true, data: data as GameResult };
}
