import "server-only";
import { createHash } from "node:crypto";
import { AIBudgetExceededError } from "@edukemonos/ai";
import { teacherSummaryPrompt, teacherSummarySchema, teacherSummarySystem, type TeacherSummary } from "@edukemonos/ai/teacher";
import type { Finding } from "@edukemonos/curriculum";
import { adminClient } from "@/lib/supabase/admin";
import { consumeQuota, serverAI } from "@/lib/tutor-server";

export interface StoredSummary {
  summary: TeacherSummary;
  createdAt: string;
}

/** Generations per teacher (or for the public demo) per day; cached results do not count. */
const DAILY_LIMIT = { teacher: 10, demo: 6 };

/** Same findings + same prompt version → same key, so a section is summarised once per change. */
export function summaryKey(findings: Finding[]): string {
  const basis = JSON.stringify([teacherSummarySystem.id, teacherSummarySystem.version, findings.map((f) => [f.id, f.title, f.evidence])]);
  return createHash("sha256").update(basis).digest("hex");
}

export async function cachedSummary(findings: Finding[]): Promise<StoredSummary | null> {
  if (!findings.length) return null;
  const { data, error } = await adminClient()
    .from("teacher_summaries")
    .select("summary, created_at")
    .eq("key", summaryKey(findings))
    .maybeSingle();
  if (error) {
    // Table not created yet (migration pending): the panel works without the cache.
    if (!/teacher_summaries/.test(error.message)) console.error("teacher summary read failed:", error.message);
    return null;
  }
  return data ? { summary: data.summary as TeacherSummary, createdAt: data.created_at } : null;
}

export type SummaryResult = { ok: true; stored: StoredSummary } | { ok: false; error: string };

/**
 * Writes the summary for a section's findings. Only counts and unit titles reach the model;
 * every number the teacher sees comes from the findings, not from the model.
 */
export async function summarize(opts: {
  findings: Finding[];
  sectionLabel: string;
  sectionId: string | null;
  actorId: string | null;
}): Promise<SummaryResult> {
  const { findings } = opts;
  if (!findings.length) return { ok: false, error: "Todavía no hay datos suficientes para un resumen." };
  const existing = await cachedSummary(findings);
  if (existing) return { ok: true, stored: existing };

  const quotaKey = opts.actorId ? `teacher_summary:${opts.actorId}` : "teacher_summary:demo";
  const limit = opts.actorId ? DAILY_LIMIT.teacher : DAILY_LIMIT.demo;
  if (!(await consumeQuota(quotaKey, limit, 86_400))) {
    return { ok: false, error: "Por hoy ya se generaron todos los resúmenes permitidos. Mañana se puede generar otro." };
  }

  try {
    const prompt = teacherSummaryPrompt(opts.sectionLabel, findings);
    const { data, model } = await serverAI().generateStructured(
      { role: "bulk", purpose: "teacher_summary", actorId: opts.actorId, sectionId: opts.sectionId },
      { system: prompt.system, messages: [{ role: "user", content: prompt.user }], schema: teacherSummarySchema, schemaName: "teacher_summary", maxTokens: 2_000 },
    );
    const valid = new Set(findings.map((f) => f.id));
    const summary: TeacherSummary = { resumen: data.resumen, acciones: data.acciones.filter((a) => valid.has(a.id)) };
    const createdAt = new Date().toISOString();
    const { error } = await adminClient()
      .from("teacher_summaries")
      .upsert({ key: summaryKey(findings), section_id: opts.sectionId, summary, model });
    if (error && !/teacher_summaries/.test(error.message)) console.error("teacher summary write failed:", error.message);
    return { ok: true, stored: { summary, createdAt } };
  } catch (error) {
    if (error instanceof AIBudgetExceededError) return { ok: false, error: "El resumen con IA no está disponible por hoy. Los hallazgos de abajo siguen siendo válidos." };
    console.error("teacher summary failed:", (error as Error).message);
    return { ok: false, error: "No se pudo generar el resumen ahora. Intenta de nuevo en un momento." };
  }
}
