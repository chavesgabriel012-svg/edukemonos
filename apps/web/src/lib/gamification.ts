import "server-only";
import { DEMO_GOAL, DEMO_LEADERBOARD_SUMMARY, DEMO_STREAK } from "@edukemonos/curriculum";
import type { SectionGoal } from "@/lib/sections";
import type { SupabaseClient } from "@supabase/supabase-js";

/** What the teacher sees about the weekly streak: aggregates, never one student's streak by name. */
export interface StreakSummary {
  students: number;
  met_this_week: number;
  with_streak: number;
  longest: number;
  target: number;
  enabled: boolean;
  paused: boolean;
}

export interface CalendarInfo {
  name: string;
  /** "oficial" (MEP) or the institution's name. */
  owner: string;
  year: number;
  classesStart: string;
  classesEnd: string;
  breaks: { startsOn: string; endsOn: string; label: string }[];
  periods: { startsOn: string; endsOn: string; label: string }[];
}

export interface SectionGamification {
  summary: StreakSummary;
  settings: { streakEnabled: boolean; weeklyTarget: number; goalEnabled: boolean; leaderboardEnabled: boolean };
  goal: SectionGoal | null;
  /** How many take part in the table; never who is where. */
  leaderboard: { members: number; with_nickname: number; hidden: number } | null;
  calendar: CalendarInfo | null;
  institutionId: string | null;
  /** Institutions the teacher belongs to (to attach the section to one) and whether they administer it. */
  institutions: { id: string; name: string; admin: boolean }[];
}

type CalendarRow = {
  name: string;
  school_year: number;
  classes_start: string;
  classes_end: string;
  institution_id: string | null;
  school_calendar_breaks: { starts_on: string; ends_on: string; label: string }[];
  school_calendar_periods: { starts_on: string; ends_on: string; label: string; sort_order: number }[];
};

const CALENDAR_COLUMNS =
  "name, school_year, classes_start, classes_end, institution_id, school_calendar_breaks(starts_on, ends_on, label), school_calendar_periods(starts_on, ends_on, label, sort_order)";

function toInfo(c: CalendarRow, owner: string): CalendarInfo {
  return {
    name: c.name,
    owner,
    year: c.school_year,
    classesStart: c.classes_start,
    classesEnd: c.classes_end,
    breaks: [...c.school_calendar_breaks].sort((a, b) => a.starts_on.localeCompare(b.starts_on)).map((b) => ({ startsOn: b.starts_on, endsOn: b.ends_on, label: b.label })),
    periods: [...c.school_calendar_periods].sort((a, b) => a.sort_order - b.sort_order).map((p) => ({ startsOn: p.starts_on, endsOn: p.ends_on, label: p.label })),
  };
}

/**
 * The calendar a section follows this school year (or the next one, between years): the
 * institution's if it has one, otherwise the official MEP calendar. Calendars are public data.
 */
export async function calendarFor(supabase: SupabaseClient, institution: { id: string; name: string } | null, now = new Date()): Promise<CalendarInfo | null> {
  const years = [now.getUTCFullYear(), now.getUTCFullYear() + 1];
  for (const year of years) {
    if (institution) {
      const { data } = await supabase.from("school_calendars").select(CALENDAR_COLUMNS).eq("institution_id", institution.id).eq("school_year", year).maybeSingle();
      if (data) return toInfo(data as unknown as CalendarRow, institution.name);
    }
    const { data } = await supabase.from("school_calendars").select(CALENDAR_COLUMNS).is("institution_id", null).eq("school_year", year).maybeSingle();
    if (data) return toInfo(data as unknown as CalendarRow, "oficial");
  }
  return null;
}

export async function sectionGamification(supabase: SupabaseClient, sectionId: string, teacherId: string): Promise<SectionGamification> {
  const [{ data: summary, error }, { data: settings }, { data: section }, { data: memberships }, { data: goal }, { data: board }] = await Promise.all([
    supabase.rpc("section_streak_summary", { p_section: sectionId }),
    supabase.from("section_settings").select("streak_enabled, weekly_target, goal_enabled, leaderboard_enabled").eq("section_id", sectionId).maybeSingle(),
    supabase.from("sections").select("institution_id, institutions(id, name)").eq("id", sectionId).maybeSingle(),
    supabase.from("institution_members").select("role, institutions(id, name)").eq("profile_id", teacherId),
    supabase.rpc("section_goal", { p_section: sectionId }),
    supabase.rpc("section_leaderboard_summary", { p_section: sectionId }),
  ]);
  if (error) throw new Error(error.message);
  const inst = (section?.institutions as unknown as { id: string; name: string } | null) ?? null;
  return {
    summary: summary as StreakSummary,
    settings: {
      streakEnabled: settings?.streak_enabled ?? true,
      weeklyTarget: settings?.weekly_target ?? 5,
      goalEnabled: settings?.goal_enabled ?? true,
      leaderboardEnabled: settings?.leaderboard_enabled ?? true,
    },
    goal: (goal as SectionGoal) ?? null,
    leaderboard: (board as SectionGamification["leaderboard"]) ?? null,
    calendar: await calendarFor(supabase, inst),
    institutionId: section?.institution_id ?? null,
    institutions: (memberships ?? []).flatMap((m) => {
      const i = m.institutions as unknown as { id: string; name: string } | null;
      return i ? [{ id: i.id, name: i.name, admin: m.role === "admin" }] : [];
    }),
  };
}

/** Demo section: fictitious aggregates and the official calendar, read-only. */
export async function demoGamification(supabase: SupabaseClient): Promise<SectionGamification> {
  return {
    summary: { ...DEMO_STREAK },
    settings: { streakEnabled: true, weeklyTarget: 5, goalEnabled: true, leaderboardEnabled: true },
    goal: { ...DEMO_GOAL, history: [...DEMO_GOAL.history] },
    leaderboard: { ...DEMO_LEADERBOARD_SUMMARY },
    calendar: await calendarFor(supabase, null),
    institutionId: null,
    institutions: [],
  };
}
