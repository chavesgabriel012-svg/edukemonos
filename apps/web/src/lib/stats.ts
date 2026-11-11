import "server-only";
import { supabaseEnv } from "@/lib/supabase/env";

/** What is published today, for the landing. Counted with the public key: only published rows are visible. */
export interface ContentStats {
  units: number;
  exercises: number;
  materials: number;
  writingTasks: number;
}

/** Counted in the database on 2026-11-11. Shown only when the live count cannot be read. */
const FALLBACK: ContentStats = { units: 96, exercises: 699, materials: 383, writingTasks: 104 };

async function count(path: string): Promise<number | null> {
  const env = supabaseEnv();
  if (!env) return null;
  try {
    const res = await fetch(`${env.url}/rest/v1/${path}&select=id&limit=1`, {
      headers: { apikey: env.anonKey, authorization: `Bearer ${env.anonKey}`, prefer: "count=exact" },
      next: { revalidate: 3600 },
    });
    const total = Number(res.headers.get("content-range")?.split("/")[1]);
    return res.ok && Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}

export async function contentStats(): Promise<ContentStats> {
  const [units, exercises, materials, writingTasks] = await Promise.all([
    count("curriculum_units?status=eq.published"),
    count("items?status=eq.published&kind=eq.single_choice&verified=eq.true"),
    count("materials?status=eq.published"),
    count("items?status=eq.published&kind=eq.open_writing"),
  ]);
  return {
    units: units ?? FALLBACK.units,
    exercises: exercises ?? FALLBACK.exercises,
    materials: materials ?? FALLBACK.materials,
    writingTasks: writingTasks ?? FALLBACK.writingTasks,
  };
}
