-- Fase 1 (docs/producto/gamificacion.md §2.6, §4): institutions, school calendars with editable
-- periods, per-section settings, and the weekly mastery streak with one repair per period.
--
-- A week runs Monday to Sunday in Costa Rica time (UTC-6, no daylight saving time). A week is
-- "met" with at least weekly_target DISTINCT items answered right that week, in any context.
-- Vacation weeks (no class day in the calendar) neither add nor break a streak.

-- ---------------------------------------------------------------------------
-- Institutions: the id that will let each school have its own Eduka.
-- ---------------------------------------------------------------------------
create type public.institution_role as enum ('admin', 'teacher');

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  -- Short, URL-safe name for a future per-institution address (e.g. eduka.cr/liceo-x). Optional.
  slug text unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  calendar_id uuid,                  -- the institution's calendar for the current school year
  created_at timestamptz not null default now()
);

create table public.institution_members (
  institution_id uuid not null references public.institutions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.institution_role not null default 'teacher',
  created_at timestamptz not null default now(),
  primary key (institution_id, profile_id)
);
create index institution_members_profile_idx on public.institution_members (profile_id);

alter table public.sections add column institution_id uuid references public.institutions (id) on delete set null;
create index sections_institution_idx on public.sections (institution_id);

-- ---------------------------------------------------------------------------
-- School calendars: one per year. institution_id null = official MEP calendar.
-- ---------------------------------------------------------------------------
create table public.school_calendars (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  school_year smallint not null check (school_year between 2020 and 2100),
  classes_start date not null,
  classes_end date not null,
  institution_id uuid references public.institutions (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (classes_end > classes_start),
  check (extract(year from classes_start) = school_year)
);
create unique index school_calendars_official_year on public.school_calendars (school_year) where institution_id is null;
create unique index school_calendars_institution_year on public.school_calendars (institution_id, school_year) where institution_id is not null;

create table public.school_calendar_breaks (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.school_calendars (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  label text not null check (char_length(btrim(label)) between 2 and 60),
  check (ends_on >= starts_on)
);
create index school_calendar_breaks_calendar_idx on public.school_calendar_breaks (calendar_id);

-- Periods for the streak repair: 2 semesters, 3 trimesters or whatever the institution uses.
create table public.school_calendar_periods (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.school_calendars (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  label text not null check (char_length(btrim(label)) between 2 and 60),
  sort_order smallint not null default 0,
  check (ends_on >= starts_on)
);
create index school_calendar_periods_calendar_idx on public.school_calendar_periods (calendar_id);

alter table public.institutions
  add constraint institutions_calendar_fk foreign key (calendar_id) references public.school_calendars (id) on delete set null;

-- Official MEP 2027 calendar: classes from 1 March to 30 November, mid-year break 2–16 July,
-- two semesters (a period ends where the break starts).
insert into public.school_calendars (id, name, school_year, classes_start, classes_end)
values ('00000000-0000-4000-8000-0000000c2027', 'MEP 2027', 2027, '2027-03-01', '2027-11-30');
insert into public.school_calendar_breaks (calendar_id, starts_on, ends_on, label)
values ('00000000-0000-4000-8000-0000000c2027', '2027-07-02', '2027-07-16', 'Vacaciones de medio año');
insert into public.school_calendar_periods (calendar_id, starts_on, ends_on, label, sort_order) values
  ('00000000-0000-4000-8000-0000000c2027', '2027-03-01', '2027-07-01', 'Primer semestre', 1),
  ('00000000-0000-4000-8000-0000000c2027', '2027-07-17', '2027-11-30', 'Segundo semestre', 2);

-- ---------------------------------------------------------------------------
-- Per-section settings. No row = defaults: everything on, 5 exercises a week.
-- The teacher never has to touch this; they can only turn things off.
-- ---------------------------------------------------------------------------
create table public.section_settings (
  section_id uuid primary key references public.sections (id) on delete cascade,
  streak_enabled boolean not null default true,
  weekly_target smallint not null default 5 check (weekly_target between 1 and 50),
  updated_at timestamptz not null default now()
);

-- One repair (comodín) per period, for one missed week.
create table public.streak_repairs (
  student_id uuid not null references public.students (id) on delete cascade,
  week_start date not null,
  period_key text not null,
  created_at timestamptz not null default now(),
  primary key (student_id, week_start),
  unique (student_id, period_key)
);

create index attempts_correct_idx on public.attempts (student_id, created_at) where is_correct;

-- ---------------------------------------------------------------------------
-- Week and calendar helpers
-- ---------------------------------------------------------------------------
create function private.week_start_cr(p_ts timestamptz)
returns date
language sql immutable set search_path = ''
as $$
  select ((p_ts at time zone 'UTC') - interval '6 hours')::date
         - (extract(isodow from (p_ts at time zone 'UTC') - interval '6 hours')::integer - 1)
$$;

-- Monday 00:00 in Costa Rica as an instant.
create function private.week_start_instant(p_week date)
returns timestamptz
language sql immutable set search_path = ''
as $$ select (p_week::timestamp + interval '6 hours') at time zone 'UTC' $$;

-- Class days (Monday to Friday, inside the school year, outside breaks) of a calendar in a week.
create function private.class_days(p_calendar uuid, p_week date)
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer
  from generate_series(p_week, p_week + 4, interval '1 day') d
  join public.school_calendars c on c.id = p_calendar
  where d::date between c.classes_start and c.classes_end
    and not exists (
      select 1 from public.school_calendar_breaks b
      where b.calendar_id = c.id and d::date between b.starts_on and b.ends_on
    )
$$;

-- The calendars that apply to a student in a school year, the first one being the main one
-- (the earliest section joined). Section with an institution: the institution's calendar for that
-- year; otherwise, or with no section, the official one.
create function private.student_calendars(p_student uuid, p_year integer)
returns table (calendar_id uuid, ord bigint)
language sql stable security definer set search_path = ''
as $$
  with official as (
    select c.id from public.school_calendars c where c.institution_id is null and c.school_year = p_year
  ),
  per_section as (
    select coalesce(
             (select ic.id from public.school_calendars ic where ic.id = i.calendar_id and ic.school_year = p_year),
             (select ic.id from public.school_calendars ic where ic.institution_id = i.id and ic.school_year = p_year),
             (select id from official)
           ) as calendar_id,
           m.joined_at
    from public.section_members m
    join public.sections s on s.id = m.section_id
    left join public.institutions i on i.id = s.institution_id
    where m.student_id = p_student
  )
  select calendar_id, row_number() over (order by min(joined_at))
  from (
    select calendar_id, joined_at from per_section
    union all
    select id, 'infinity'::timestamptz from official where not exists (select 1 from per_section)
  ) x
  where calendar_id is not null
  group by calendar_id
$$;

-- A week is paused when ANY of the student's calendars has no class day in it. With no calendar
-- for that year (e.g. before MEP 2027 is loaded) every week counts normally.
create function private.week_paused(p_student uuid, p_week date)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from private.student_calendars(p_student, extract(year from p_week + 3)::integer) c
    where private.class_days(c.calendar_id, p_week) = 0
  )
$$;

-- Period of a week for the repair rule: the period of the main calendar that contains the week's
-- first class day. Without a calendar, the half of the year.
create function private.week_period(p_student uuid, p_week date)
returns table (period_key text, label text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  cal uuid;
  first_day date;
begin
  select c.calendar_id into cal
  from private.student_calendars(p_student, extract(year from p_week + 3)::integer) c
  order by c.ord limit 1;

  if cal is null then
    return query select
      'y' || extract(year from p_week + 3)::text || '-h' || (case when extract(month from p_week + 3) <= 6 then '1' else '2' end),
      (case when extract(month from p_week + 3) <= 6 then 'Primera mitad del año' else 'Segunda mitad del año' end);
    return;
  end if;

  select min(d::date) into first_day
  from generate_series(p_week, p_week + 4, interval '1 day') d
  join public.school_calendars c on c.id = cal
  where d::date between c.classes_start and c.classes_end
    and not exists (select 1 from public.school_calendar_breaks b where b.calendar_id = c.id and d::date between b.starts_on and b.ends_on);

  return query
  select p.id::text, p.label from public.school_calendar_periods p
  where p.calendar_id = cal and coalesce(first_day, p_week) between p.starts_on and p.ends_on
  order by p.sort_order limit 1;
end;
$$;

-- Weekly target: the lowest of the student's sections (default 5).
create function private.student_weekly_target(p_student uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select coalesce(min(coalesce(ss.weekly_target, 5)), 5)::integer
  from public.section_members m
  left join public.section_settings ss on ss.section_id = m.section_id
  where m.student_id = p_student
$$;

-- The streak is shown unless EVERY section of the student turned it off.
create function private.streak_visible(p_student uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select not exists (select 1 from public.section_members m where m.student_id = p_student)
      or exists (
        select 1 from public.section_members m
        left join public.section_settings ss on ss.section_id = m.section_id
        where m.student_id = p_student and coalesce(ss.streak_enabled, true)
      )
$$;

-- ---------------------------------------------------------------------------
-- Streak state. Same rules as computeStreak() in @edukemonos/curriculum (tested against it).
-- ---------------------------------------------------------------------------
create function private.streak_state(p_student uuid, p_now timestamptz)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  cur_week date := private.week_start_cr(p_now);
  target integer := private.student_weekly_target(p_student);
  first_week date;
  r record;
  paused boolean;
  streak integer := 0;
  best integer := 0;
  week_count integer := 0;
  week_paused boolean := false;
  last_closed date;            -- most recent closed week that was not a vacation week
  last_closed_met boolean;
  before_last integer := 0;    -- streak right before that week
  per record;
  can_repair boolean := false;
  repair_label text;
begin
  select private.week_start_cr(min(a.created_at)) into first_week
  from public.attempts a where a.student_id = p_student and a.is_correct;

  if first_week is not null then
    for r in
      select w::date as wk,
             (select count(distinct a.item_id)::integer from public.attempts a
              where a.student_id = p_student and a.is_correct
                and a.created_at >= private.week_start_instant(w::date)
                and a.created_at < private.week_start_instant(w::date + 7)
                and a.created_at <= p_now) as cnt,
             exists (select 1 from public.streak_repairs s where s.student_id = p_student and s.week_start = w::date) as repaired
      from generate_series(first_week, cur_week, interval '7 days') w
      order by w
    loop
      paused := private.week_paused(p_student, r.wk);
      if r.wk = cur_week then
        week_count := r.cnt;
        week_paused := paused;
        if not paused and r.cnt >= target then
          streak := streak + 1;
        end if;
      elsif paused then
        continue;
      else
        last_closed := r.wk;
        before_last := streak;
        last_closed_met := r.cnt >= target or r.repaired;
        if last_closed_met then
          streak := streak + 1;
        else
          streak := 0;
        end if;
      end if;
      best := greatest(best, streak);
    end loop;
  end if;

  if last_closed is not null and not last_closed_met and before_last > 0 then
    select * into per from private.week_period(p_student, last_closed);
    can_repair := per.period_key is not null and not exists (
      select 1 from public.streak_repairs s where s.student_id = p_student and s.period_key = per.period_key
    );
    repair_label := case when can_repair then per.label end;
  end if;

  return jsonb_build_object(
    'visible', private.streak_visible(p_student),
    'current', streak,
    'record', best,
    'week_start', cur_week,
    'week_count', week_count,
    'target', target,
    'week_done', week_count >= target,
    'paused', week_paused,
    'broken', last_closed is not null and not last_closed_met and best > 0,
    'can_repair', can_repair,
    'repair_week', case when can_repair then last_closed end,
    'repair_period', repair_label
  );
end;
$$;

create function public.streak_status()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  return private.streak_state(auth.uid(), now());
end;
$$;

-- Uses the period's repair on the last missed week, if allowed. Returns {ok, error?}.
create function public.use_streak_repair()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  st jsonb;
  wk date;
  per record;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  st := private.streak_state(uid, now());
  if not (st ->> 'can_repair')::boolean then
    return jsonb_build_object('ok', false, 'error', 'not_available');
  end if;
  wk := (st ->> 'repair_week')::date;
  select * into per from private.week_period(uid, wk);
  insert into public.streak_repairs (student_id, week_start, period_key) values (uid, wk, per.period_key)
  on conflict do nothing;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_available');
  end if;
  insert into public.events (actor_id, name, props)
  values (uid, 'streak_repaired', jsonb_build_object('week', wk));
  return jsonb_build_object('ok', true, 'status', private.streak_state(uid, now()));
end;
$$;

-- For the teacher panel: aggregates only, never one student's streak next to a name.
create function public.section_streak_summary(p_section uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  st jsonb;
  m record;
  n integer := 0;
  met integer := 0;
  with_streak integer := 0;
  longest integer := 0;
begin
  if not private.owns_section(p_section) then
    raise exception 'not your section' using errcode = '42501';
  end if;
  for m in select student_id from public.section_members where section_id = p_section loop
    st := private.streak_state(m.student_id, now());
    n := n + 1;
    if (st ->> 'week_done')::boolean then met := met + 1; end if;
    if (st ->> 'current')::integer > 0 then with_streak := with_streak + 1; end if;
    longest := greatest(longest, (st ->> 'current')::integer);
  end loop;
  return jsonb_build_object(
    'students', n, 'met_this_week', met, 'with_streak', with_streak, 'longest', longest,
    'target', coalesce((select weekly_target from public.section_settings where section_id = p_section), 5),
    'enabled', coalesce((select streak_enabled from public.section_settings where section_id = p_section), true),
    'paused', private.week_paused_for_section(p_section, private.week_start_cr(now()))
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Week completed event (no personal data: week and target only).
-- ---------------------------------------------------------------------------
create function private.attempts_week_event()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  wk date := private.week_start_cr(new.created_at);
  target integer;
  n_before integer;
  seen boolean;
begin
  if new.is_correct is not true then
    return null;
  end if;
  -- Distinct items answered right this week BEFORE this attempt (by time, then id, so a
  -- multi-row insert is ordered too). Only a new item can complete the week.
  select count(distinct a.item_id), coalesce(bool_or(a.item_id = new.item_id), false) into n_before, seen
  from public.attempts a
  where a.student_id = new.student_id and a.is_correct
    and a.created_at >= private.week_start_instant(wk)
    and (a.created_at < new.created_at or (a.created_at = new.created_at and a.id < new.id));
  if seen then
    return null;
  end if;
  target := private.student_weekly_target(new.student_id);
  if n_before + 1 = target then
    insert into public.events (actor_id, name, props)
    values (new.student_id, 'streak_week_completed', jsonb_build_object('week', wk, 'target', target));
  end if;
  return null;
end;
$$;

create trigger attempts_week_event
  after insert on public.attempts
  for each row execute function private.attempts_week_event();

-- ---------------------------------------------------------------------------
-- Institutions and calendars: who can do what
-- ---------------------------------------------------------------------------
create function private.institution_role(p_institution uuid)
returns public.institution_role
language sql stable security definer set search_path = ''
as $$
  select role from public.institution_members
  where institution_id = p_institution and profile_id = (select auth.uid())
$$;

create function private.is_institution_admin(p_institution uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(private.institution_role(p_institution) = 'admin', false) or private.is_admin() $$;

-- Whether a section's week is a vacation week, by the section's own calendar.
create function private.week_paused_for_section(p_section uuid, p_week date)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select private.class_days(coalesce(
             (select ic.id from public.school_calendars ic where ic.id = i.calendar_id and ic.school_year = extract(year from p_week + 3)),
             (select ic.id from public.school_calendars ic where ic.institution_id = i.id and ic.school_year = extract(year from p_week + 3)),
             (select c.id from public.school_calendars c where c.institution_id is null and c.school_year = extract(year from p_week + 3))
           ), p_week) = 0
    from public.sections s left join public.institutions i on i.id = s.institution_id
    where s.id = p_section
  ), false)
$$;

-- A teacher may only attach a section to an institution they belong to.
create function private.sections_institution_check()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.institution_id is not null
     and (tg_op = 'INSERT' or new.institution_id is distinct from old.institution_id)
     and private.institution_role(new.institution_id) is null
     and not private.is_admin()
     and (select auth.uid()) is not null then
    raise exception 'not a member of that institution' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger sections_institution_check
  before insert or update of institution_id on public.sections
  for each row execute function private.sections_institution_check();

-- Creates or replaces the calendar of an institution for a year, with its breaks and periods, and
-- makes it the institution's current calendar. Institution admins (and platform admins) only.
create function public.save_institution_calendar(
  p_institution uuid,
  p_year smallint,
  p_classes_start date,
  p_classes_end date,
  p_breaks jsonb,        -- [{"starts_on": "2027-07-02", "ends_on": "2027-07-16", "label": "Vacaciones"}]
  p_periods jsonb        -- [{"starts_on": ..., "ends_on": ..., "label": "Primer trimestre"}], 1 to 4
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  cal uuid;
  b jsonb;
  p jsonb;
  k integer := 0;
  prev_end date;
begin
  if not private.is_institution_admin(p_institution) then
    raise exception 'not an admin of this institution' using errcode = '42501';
  end if;
  if p_classes_start is null or p_classes_end is null or p_classes_end <= p_classes_start
     or extract(year from p_classes_start) <> p_year then
    raise exception 'invalid school year dates' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_periods, '[]')) <> 'array' or jsonb_array_length(coalesce(p_periods, '[]')) not between 1 and 4 then
    raise exception 'between 1 and 4 periods' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_breaks, '[]')) <> 'array' or jsonb_array_length(coalesce(p_breaks, '[]')) > 8 then
    raise exception 'at most 8 breaks' using errcode = '22023';
  end if;

  select id into cal from public.school_calendars where institution_id = p_institution and school_year = p_year;
  if cal is null then
    insert into public.school_calendars (name, school_year, classes_start, classes_end, institution_id)
    values (left((select name from public.institutions where id = p_institution), 70) || ' ' || p_year, p_year, p_classes_start, p_classes_end, p_institution)
    returning id into cal;
  else
    update public.school_calendars set classes_start = p_classes_start, classes_end = p_classes_end where id = cal;
    delete from public.school_calendar_breaks where calendar_id = cal;
    delete from public.school_calendar_periods where calendar_id = cal;
  end if;

  for b in select * from jsonb_array_elements(coalesce(p_breaks, '[]')) loop
    if (b ->> 'starts_on')::date < p_classes_start or (b ->> 'ends_on')::date > p_classes_end then
      raise exception 'breaks must be inside the school year' using errcode = '22023';
    end if;
    insert into public.school_calendar_breaks (calendar_id, starts_on, ends_on, label)
    values (cal, (b ->> 'starts_on')::date, (b ->> 'ends_on')::date, coalesce(nullif(btrim(b ->> 'label'), ''), 'Vacaciones'));
  end loop;

  for p in select value from jsonb_array_elements(p_periods) with ordinality as t(value, ord) order by (value ->> 'starts_on')::date loop
    k := k + 1;
    if (p ->> 'starts_on')::date < p_classes_start or (p ->> 'ends_on')::date > p_classes_end
       or (p ->> 'ends_on')::date < (p ->> 'starts_on')::date
       or (prev_end is not null and (p ->> 'starts_on')::date <= prev_end) then
      raise exception 'periods must be inside the school year and must not overlap' using errcode = '22023';
    end if;
    prev_end := (p ->> 'ends_on')::date;
    insert into public.school_calendar_periods (calendar_id, starts_on, ends_on, label, sort_order)
    values (cal, (p ->> 'starts_on')::date, prev_end, coalesce(nullif(btrim(p ->> 'label'), ''), 'Periodo ' || k), k);
  end loop;

  update public.institutions set calendar_id = cal where id = p_institution;
  return cal;
end;
$$;

-- Adds a teacher to an institution by the email they sign in with. Institution admins only.
create function public.add_institution_member(p_institution uuid, p_email text, p_role public.institution_role default 'teacher')
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  pid uuid;
begin
  if not private.is_institution_admin(p_institution) then
    raise exception 'not an admin of this institution' using errcode = '42501';
  end if;
  select p.id into pid from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = lower(btrim(p_email));
  if pid is null then
    return false;          -- the person has to sign in to Eduka once first
  end if;
  insert into public.institution_members (institution_id, profile_id, role) values (p_institution, pid, p_role)
  on conflict (institution_id, profile_id) do update set role = excluded.role;
  return true;
end;
$$;

-- Members of an institution, for its admins: display name and role (no emails).
create function public.institution_member_list(p_institution uuid)
returns table (profile_id uuid, display_name text, role public.institution_role)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_institution_admin(p_institution) then
    raise exception 'not an admin of this institution' using errcode = '42501';
  end if;
  return query
  select m.profile_id, coalesce(nullif(p.display_name, ''), 'Docente'), m.role
  from public.institution_members m join public.profiles p on p.id = m.profile_id
  where m.institution_id = p_institution
  order by m.role, p.display_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Recovery codes must also move streak repairs (fase 0 test: every students(id) foreign key).
-- ---------------------------------------------------------------------------
create or replace function public.redeem_recovery_code(p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  old_id uuid;
  moved jsonb;
  n_attempts integer;
  n_diagnostics integer;
  n_mastery integer;
  n_sessions integer;
  n_writing integer;
  n_sections integer;
  n_repairs integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if private.is_staff() then
    raise exception 'staff accounts do not use recovery codes' using errcode = '42501';
  end if;
  if not public.consume_quota('recovery_redeem:' || uid, 5, 900) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  if char_length(private.normalize_recovery_code(p_code)) <> 12 then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select r.student_id into old_id
  from public.student_recovery_codes r
  where r.code_hash = private.recovery_code_hash(p_code);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  if old_id = uid then
    return jsonb_build_object('ok', true, 'already_here', true);
  end if;

  insert into public.students (id) values (uid) on conflict (id) do nothing;
  update public.students s
  set declared_grade_id = coalesce(o.declared_grade_id, s.declared_grade_id)
  from public.students o
  where s.id = uid and o.id = old_id;

  update public.attempts set student_id = uid where student_id = old_id;
  get diagnostics n_attempts = row_count;
  update public.diagnostics set student_id = uid where student_id = old_id;
  get diagnostics n_diagnostics = row_count;

  delete from public.mastery m
  using public.mastery o
  where m.student_id = uid and o.student_id = old_id and o.skill_id = m.skill_id and o.attempts >= m.attempts;
  delete from public.mastery o
  using public.mastery m
  where o.student_id = old_id and m.student_id = uid and m.skill_id = o.skill_id;
  update public.mastery set student_id = uid where student_id = old_id;
  get diagnostics n_mastery = row_count;

  update public.tutor_sessions set student_id = uid where student_id = old_id;
  get diagnostics n_sessions = row_count;
  update public.writing_feedback set student_id = uid where student_id = old_id;
  get diagnostics n_writing = row_count;

  delete from public.section_members m
  using public.section_members o
  where m.student_id = uid and o.student_id = old_id and o.section_id = m.section_id;
  update public.section_members set student_id = uid where student_id = old_id;
  get diagnostics n_sections = row_count;

  -- Streak repairs: the old device's win for the same week or period.
  delete from public.streak_repairs n
  using public.streak_repairs o
  where n.student_id = uid and o.student_id = old_id and (o.week_start = n.week_start or o.period_key = n.period_key);
  update public.streak_repairs set student_id = uid where student_id = old_id;
  get diagnostics n_repairs = row_count;

  delete from public.student_recovery_codes where student_id = uid;
  update public.student_recovery_codes set student_id = uid, last_used_at = now() where student_id = old_id;

  delete from public.students where id = old_id;

  moved := jsonb_build_object(
    'attempts', n_attempts, 'diagnostics', n_diagnostics, 'mastery', n_mastery,
    'tutor_sessions', n_sessions, 'writing_feedback', n_writing, 'sections', n_sections,
    'streak_repairs', n_repairs
  );
  insert into public.events (actor_id, name, props)
  values (uid, 'recovery_code_redeemed', jsonb_build_object('moved', moved));
  return jsonb_build_object('ok', true, 'already_here', false, 'moved', moved);
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.institutions enable row level security;
alter table public.institution_members enable row level security;
alter table public.school_calendars enable row level security;
alter table public.school_calendar_breaks enable row level security;
alter table public.school_calendar_periods enable row level security;
alter table public.section_settings enable row level security;
alter table public.streak_repairs enable row level security;

-- Institutions: members see theirs; platform admins create them; institution admins rename them.
create policy institutions_select on public.institutions for select to authenticated
  using (private.institution_role(id) is not null or private.is_admin());
create policy institutions_insert on public.institutions for insert to authenticated
  with check (private.is_admin());
create policy institutions_update on public.institutions for update to authenticated
  using (private.is_institution_admin(id)) with check (private.is_institution_admin(id));
revoke update on public.institutions from anon, authenticated;
grant update (name, slug) on public.institutions to authenticated;

-- Members: each person sees their own memberships; changes go through add_institution_member().
create policy institution_members_select_own on public.institution_members for select to authenticated
  using (profile_id = (select auth.uid()) or private.is_admin());
create policy institution_members_admin_write on public.institution_members for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Calendars are school dates, not personal data: anyone may read them. Writes go through
-- save_institution_calendar(); the official one only by migration.
create policy school_calendars_read on public.school_calendars for select to anon, authenticated using (true);
create policy school_calendar_breaks_read on public.school_calendar_breaks for select to anon, authenticated using (true);
create policy school_calendar_periods_read on public.school_calendar_periods for select to anon, authenticated using (true);
revoke insert, update, delete on public.school_calendars, public.school_calendar_breaks, public.school_calendar_periods from anon, authenticated;

-- Section settings: only the section's teacher.
create policy section_settings_owner on public.section_settings for all to authenticated
  using (private.owns_section(section_id)) with check (private.owns_section(section_id));
revoke all on public.section_settings from anon;

-- Streak repairs: the student reads their own; writes go through use_streak_repair().
create policy streak_repairs_select_own on public.streak_repairs for select to authenticated
  using (student_id = (select auth.uid()) or private.teaches_student(student_id));
revoke insert, update, delete on public.streak_repairs from anon, authenticated;

revoke all on function public.streak_status() from public, anon;
revoke all on function public.use_streak_repair() from public, anon;
revoke all on function public.section_streak_summary(uuid) from public, anon;
revoke all on function public.save_institution_calendar(uuid, smallint, date, date, jsonb, jsonb) from public, anon;
revoke all on function public.add_institution_member(uuid, text, public.institution_role) from public, anon;
revoke all on function public.institution_member_list(uuid) from public, anon;
grant execute on function public.streak_status() to authenticated;
grant execute on function public.use_streak_repair() to authenticated;
grant execute on function public.section_streak_summary(uuid) to authenticated;
grant execute on function public.save_institution_calendar(uuid, smallint, date, date, jsonb, jsonb) to authenticated;
grant execute on function public.add_institution_member(uuid, text, public.institution_role) to authenticated;
grant execute on function public.institution_member_list(uuid) to authenticated;
