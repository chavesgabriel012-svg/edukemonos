import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface SectionGoal {
  enabled: boolean;
  week_start?: string;
  target?: number;
  progress?: number;
  paused?: boolean;
  active_students?: number;
  history?: number[];
}

export interface Leaderboard {
  enabled: boolean;
  enough?: boolean;
  rows?: { nickname: string; points: number; me: boolean }[];
  me?: { nickname: string | null; hidden: boolean; points: number } | null;
}

export interface StudentSection {
  id: string;
  name: string;
  gradeId: number;
  goal: SectionGoal | null;
  leaderboard: Leaderboard | null;
}

/** The visitor's sections with this week's goal and table (computed in the database). */
export async function studentSections(): Promise<{ sections: StudentSection[]; groups: { name: string; gradeId: number }[]; nickname: string | null; hidden: boolean; signedIn: boolean }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.is_anonymous) return { sections: [], groups: [], nickname: null, hidden: false, signedIn: false };
  const { data: groupRows } = await supabase.from("group_members").select("groups(name, grade_id)").eq("student_id", auth.user.id);
  const groups = (groupRows ?? []).flatMap((r) => {
    const g = r.groups as unknown as { name: string; grade_id: number } | null;
    return g ? [{ name: g.name, gradeId: g.grade_id }] : [];
  });
  const [{ data: members }, { data: me }] = await Promise.all([
    supabase.from("section_members").select("section_id, sections(id, name, grade_id)").eq("student_id", auth.user.id).order("joined_at"),
    supabase.from("students").select("nickname, leaderboard_hidden").eq("id", auth.user.id).maybeSingle(),
  ]);
  const sections = await Promise.all(
    (members ?? []).flatMap((m) => {
      const s = m.sections as unknown as { id: string; name: string; grade_id: number } | null;
      if (!s) return [];
      return [(async () => {
        const [goal, board] = await Promise.all([
          supabase.rpc("section_goal", { p_section: s.id }),
          supabase.rpc("section_leaderboard", { p_section: s.id }),
        ]);
        if (goal.error) console.error("section_goal failed:", goal.error.message);
        if (board.error) console.error("section_leaderboard failed:", board.error.message);
        return { id: s.id, name: s.name, gradeId: s.grade_id, goal: (goal.data as SectionGoal) ?? null, leaderboard: (board.data as Leaderboard) ?? null };
      })()];
    }),
  );
  return { sections, groups, nickname: me?.nickname ?? null, hidden: me?.leaderboard_hidden ?? false, signedIn: true };
}

/** Six free nicknames to choose from. */
export async function nicknameOptions(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nickname_options");
  if (error) {
    console.error("nickname_options failed:", error.message);
    return [];
  }
  return (data as string[]) ?? [];
}
