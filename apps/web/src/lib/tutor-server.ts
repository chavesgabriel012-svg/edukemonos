import "server-only";
import { type AI, createAI, createBudgetGuard, loadAIConfig, supabaseSpendSource, supabaseUsageSink } from "@edukemonos/ai";
import type { HelpResources, TutorUnit } from "@edukemonos/ai/tutor";
import helpResourcesJson from "../../../../config/help-resources.json";
import { adminClient } from "@/lib/supabase/admin";

export const helpResources = helpResourcesJson as HelpResources;

/** Limits from the environment (SPEC §10, §15), with the defaults of .env.example. */
/** Days a tutor transcript is kept before the daily purge deletes it (SPEC §12; pending legal review). */
export const RETENTION_DAYS_CHAT = Math.max(1, Number(process.env.RETENTION_DAYS_CHAT ?? 30));

export const TUTOR_LIMITS = {
  perSession: Number(process.env.TUTOR_MAX_MESSAGES_PER_SESSION ?? 30),
  perDay: Number(process.env.TUTOR_MAX_MESSAGES_PER_DAY ?? 60),
  writingPerDay: Number(process.env.WRITING_FEEDBACK_MAX_PER_DAY ?? 20),
  maxOutputTokens: 1_024,
};

let cached: AI | null = null;

/** AI client for the web server: usage goes to ai_usage and the spend fuse reads it back. */
export function serverAI(): AI {
  if (cached) return cached;
  const admin = adminClient();
  cached = createAI({
    config: loadAIConfig(),
    sink: supabaseUsageSink(admin),
    budget: createBudgetGuard(loadAIConfig().budget, supabaseSpendSource(admin)),
  });
  return cached;
}

/** Fixed-window counter in Postgres (serverless memory is not reliable). True when allowed. */
export async function consumeQuota(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await adminClient().rpc("consume_quota", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) throw new Error(`quota check failed: ${error.message}`);
  return data === true;
}

const MATERIAL_ORDER = ["summary", "explanation", "worked_examples", "glossary"];

/** A published unit as the tutor sees it, plus its skills (ids and names). */
export async function tutorUnit(unitId: string): Promise<{ unit: TutorUnit; skills: { id: string; name: string }[] } | null> {
  const admin = adminClient();
  const { data: u } = await admin
    .from("curriculum_units")
    .select("id, title, area, grade_id, contents, status, subjects(name), skills(id, name, sort_order)")
    .eq("id", unitId)
    .eq("status", "published")
    .maybeSingle();
  if (!u) return null;
  const { data: mats } = await admin
    .from("materials")
    .select("kind, content, created_at")
    .eq("unit_id", unitId)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  const latest = MATERIAL_ORDER.flatMap((k) => (mats ?? []).filter((m) => m.kind === k).slice(0, 1));
  const skills = [...((u.skills as { id: string; name: string; sort_order: number }[]) ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  return {
    unit: {
      subject: (u.subjects as unknown as { name: string } | null)?.name ?? "",
      grade: u.grade_id,
      title: u.title,
      area: u.area,
      contents: u.contents ?? [],
      skills: skills.map((s) => s.name),
      material: latest.map((m) => m.content).join("\n\n"),
    },
    skills: skills.map(({ id, name }) => ({ id, name })),
  };
}
