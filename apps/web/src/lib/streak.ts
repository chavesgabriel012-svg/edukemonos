import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface StreakStatus {
  visible: boolean;
  current: number;
  record: number;
  week_start: string;
  week_count: number;
  target: number;
  week_done: boolean;
  paused: boolean;
  broken: boolean;
  can_repair: boolean;
  repair_week: string | null;
  repair_period: string | null;
}

/** The visitor's weekly streak, or null without a student session. Computed in the database. */
export async function streakStatus(): Promise<StreakStatus | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.is_anonymous) return null;
  const { data, error } = await supabase.rpc("streak_status");
  if (error) {
    console.error("streak_status failed:", error.message);
    return null;
  }
  return data as StreakStatus;
}
