-- Fase 2 (docs/producto/gamificacion.md §2.3, §5): weekly mastery changes, the section's weekly
-- goal and the nickname table. Everything a section "covers" goes through private.section_scope_skills()
-- so that a section with its own subject (proposal in §12) only changes that one function.

-- ---------------------------------------------------------------------------
-- Weekly mastery changes: what a skill was worth at the start and at the end of each week.
-- ---------------------------------------------------------------------------
create table public.mastery_weekly (
  student_id uuid not null references public.students (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  week_start date not null,               -- Monday, Costa Rica time
  score_start numeric not null,           -- before the first attempt of the week (0.5 when there was none)
  score_end numeric not null,             -- after the last attempt of the week
  attempts integer not null default 1,
  primary key (student_id, skill_id, week_start)
);
create index mastery_weekly_week_idx on public.mastery_weekly (week_start, skill_id);

create function private.mastery_weekly_track()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.mastery_weekly as w (student_id, skill_id, week_start, score_start, score_end, attempts)
  values (new.student_id, new.skill_id, private.week_start_cr(now()),
          case when tg_op = 'INSERT' then 0.5 else old.score end, new.score, 1)
  on conflict (student_id, skill_id, week_start)
  do update set score_end = excluded.score_end, attempts = w.attempts + 1;
  return null;
end;
$$;

create trigger mastery_weekly_insert
  after insert on public.mastery
  for each row execute function private.mastery_weekly_track();
-- Only real learning changes; moving rows between students (recovery codes) is not one.
create trigger mastery_weekly_update
  after update of score, attempts on public.mastery
  for each row when (old.student_id = new.student_id and (old.score is distinct from new.score or old.attempts is distinct from new.attempts))
  execute function private.mastery_weekly_track();

alter table public.mastery_weekly enable row level security;
create policy mastery_weekly_select on public.mastery_weekly for select to authenticated
  using (student_id = (select auth.uid()) or private.teaches_student(student_id));
revoke insert, update, delete on public.mastery_weekly from anon, authenticated;

-- Fix (fase 1): with no calendar loaded for the year, class_days(NULL) returned 0 and every week
-- looked like a vacation week for the section (the teacher panel said "vacaciones" in 2026).
-- No calendar = no pause, the same rule as private.week_paused() for students.
create or replace function private.week_paused_for_section(p_section uuid, p_week date)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select private.class_days(cal, p_week) = 0
    from (
      select coalesce(
               (select ic.id from public.school_calendars ic where ic.id = i.calendar_id and ic.school_year = extract(year from p_week + 3)),
               (select ic.id from public.school_calendars ic where ic.institution_id = i.id and ic.school_year = extract(year from p_week + 3)),
               (select c.id from public.school_calendars c where c.institution_id is null and c.school_year = extract(year from p_week + 3))
             ) as cal
      from public.sections s left join public.institutions i on i.id = s.institution_id
      where s.id = p_section
    ) x
    where cal is not null
  ), false)
$$;

-- ---------------------------------------------------------------------------
-- What a section covers. Today: every skill of the section's grade.
-- ---------------------------------------------------------------------------
create function private.section_scope_skills(p_section uuid)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select k.id from public.skills k join public.sections s on s.grade_id = k.grade_id where s.id = p_section
$$;

-- Skills mastered in a week by the section's students (one per student and skill).
create function private.section_week_mastered(p_section uuid, p_week date)
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer
  from public.mastery_weekly w
  join public.section_members m on m.student_id = w.student_id and m.section_id = p_section
  where w.week_start = p_week and w.score_start < 0.7 and w.score_end >= 0.7
    and w.skill_id in (select private.section_scope_skills(p_section))
$$;

-- Students with at least one attempt in the last 4 weeks.
create function private.section_active_students(p_section uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(distinct m.student_id)::integer
  from public.section_members m
  where m.section_id = p_section
    and exists (select 1 from public.attempts a where a.student_id = m.student_id and a.created_at >= now() - interval '28 days')
$$;

-- ---------------------------------------------------------------------------
-- Settings and the weekly goal
-- ---------------------------------------------------------------------------
alter table public.section_settings
  add column goal_enabled boolean not null default true,
  add column leaderboard_enabled boolean not null default true;

create table public.section_goals (
  section_id uuid not null references public.sections (id) on delete cascade,
  week_start date not null,
  target integer not null check (target > 0),
  active_students integer not null,
  history integer[] not null default '{}',    -- the weeks used to compute it, for "Cómo se calculó"
  created_at timestamptz not null default now(),
  primary key (section_id, week_start)
);
alter table public.section_goals enable row level security;
create policy section_goals_select on public.section_goals for select to authenticated
  using (private.owns_section(section_id) or private.is_section_member(section_id));
revoke insert, update, delete on public.section_goals from anon, authenticated;

-- Same rule as goalTarget() in @edukemonos/curriculum.
create function private.goal_target(p_active integer, p_history integer[])
returns integer
language sql immutable set search_path = ''
as $$
  select case
    when coalesce((select bool_or(h > 0) from unnest(p_history) h), false)
      then greatest(3, ceil(1.1 * (select percentile_cont(0.5) within group (order by h) from unnest(p_history) h))::integer)
    else greatest(3, ceil(0.5 * greatest(1, p_active))::integer)
  end
$$;

-- The section's goal for this week: computed once on Monday (the first time anyone asks) and fixed
-- for the week. For the section's students and its teacher.
create function public.section_goal(p_section uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  wk date := private.week_start_cr(now());
  g public.section_goals;
  hist integer[] := '{}';
  w date;
  looked integer := 0;
  enabled boolean;
begin
  if not (private.owns_section(p_section) or private.is_section_member(p_section)) then
    raise exception 'not your section' using errcode = '42501';
  end if;
  select coalesce(ss.goal_enabled, true) into enabled
  from public.sections s left join public.section_settings ss on ss.section_id = s.id where s.id = p_section;
  if not enabled then
    return jsonb_build_object('enabled', false);
  end if;

  select * into g from public.section_goals where section_id = p_section and week_start = wk;
  if not found then
    -- The 4 most recent school weeks before this one (looking back at most 12 weeks).
    w := wk - 7;
    while array_length(hist, 1) is distinct from 4 and looked < 12 loop
      if not private.week_paused_for_section(p_section, w) then
        hist := hist || private.section_week_mastered(p_section, w);
      end if;
      w := w - 7;
      looked := looked + 1;
    end loop;
    insert into public.section_goals (section_id, week_start, target, active_students, history)
    values (p_section, wk, private.goal_target(private.section_active_students(p_section), hist),
            private.section_active_students(p_section), hist)
    on conflict (section_id, week_start) do nothing;
    select * into g from public.section_goals where section_id = p_section and week_start = wk;
  end if;

  return jsonb_build_object(
    'enabled', true,
    'week_start', wk,
    'target', g.target,
    'progress', private.section_week_mastered(p_section, wk),
    'paused', private.week_paused_for_section(p_section, wk),
    'active_students', g.active_students,
    'history', to_jsonb(g.history)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Nicknames: one per student, from a fixed safe list, unique across Eduka.
-- The lists are the same as NICKNAME_NOUNS / NICKNAME_ADJECTIVES in @edukemonos/curriculum.
-- ---------------------------------------------------------------------------
alter table public.students
  add column nickname text unique,
  add column leaderboard_hidden boolean not null default false;

-- A student creates their own row, but only with these columns; the nickname goes through choose_nickname().
revoke insert on public.students from anon, authenticated;
grant insert (id, declared_grade_id) on public.students to authenticated;

create function private.nickname_nouns()
returns text[]
language sql immutable set search_path = ''
as $$ select array[
  'Tucán', 'Colibrí', 'Jaguar', 'Quetzal', 'Lapa', 'Tortuga', 'Delfín', 'Manatí', 'Danta', 'Rana',
  'Mariposa', 'Ballena', 'Garza', 'Pelícano', 'Armadillo', 'Ocelote', 'Puma', 'Iguana', 'Oropéndola', 'Momoto',
  'Guacamaya', 'Coral', 'Ceiba', 'Guanacaste', 'Orquídea', 'Helecho', 'Cacao', 'Volcán', 'Arrecife', 'Bromelia',
  'Almendro', 'Roble', 'Cedro', 'Yigüirro', 'Tapir', 'Venado', 'Cocodrilo', 'Mantarraya', 'Luciérnaga', 'Halcón'
] $$;

create function private.nickname_adjectives()
returns text[]
language sql immutable set search_path = ''
as $$ select array[
  'Azul', 'Verde', 'Veloz', 'Feliz', 'Audaz', 'Valiente', 'Brillante', 'Alegre', 'Amable', 'Constante',
  'Gentil', 'Fuerte', 'Ágil', 'Libre', 'Leal', 'Tenaz', 'Radiante', 'Paciente'
] $$;

create function private.is_safe_nickname(p_nickname text)
returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(
    split_part(p_nickname, ' ', 1) = any (private.nickname_nouns())
    and split_part(p_nickname, ' ', 2) = any (private.nickname_adjectives())
    and split_part(p_nickname, ' ', 3) ~ '^[1-9][0-9]$'
    and split_part(p_nickname, ' ', 4) = '',
    false)
$$;

alter table public.students add constraint students_nickname_safe check (nickname is null or private.is_safe_nickname(nickname));

-- Six free nicknames at random to choose from.
create function public.nickname_options()
returns setof text
language sql volatile security definer set search_path = ''
as $$
  select n from (
    select distinct (private.nickname_nouns())[1 + floor(random() * cardinality(private.nickname_nouns()))::integer] || ' ' ||
           (private.nickname_adjectives())[1 + floor(random() * cardinality(private.nickname_adjectives()))::integer] || ' ' ||
           (10 + floor(random() * 90)::integer)::text as n
    from generate_series(1, 30)
  ) c
  where not exists (select 1 from public.students s where s.nickname = c.n)
  limit 6
$$;

create function public.choose_nickname(p_nickname text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if private.is_staff() then
    raise exception 'staff accounts do not use nicknames' using errcode = '42501';
  end if;
  if not private.is_safe_nickname(p_nickname) then
    return jsonb_build_object('ok', false, 'error', 'not_in_list');
  end if;
  insert into public.students (id) values (uid) on conflict (id) do nothing;
  begin
    update public.students set nickname = p_nickname where id = uid;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end;
  insert into public.events (actor_id, name, props) values (uid, 'nickname_chosen', '{}');
  return jsonb_build_object('ok', true);
end;
$$;

create function public.set_leaderboard_hidden(p_hidden boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.students (id) values (uid) on conflict (id) do nothing;
  update public.students set leaderboard_hidden = coalesce(p_hidden, false) where id = uid;
  insert into public.events (actor_id, name, props) values (uid, 'leaderboard_hidden', jsonb_build_object('hidden', coalesce(p_hidden, false)));
end;
$$;

-- ---------------------------------------------------------------------------
-- The week's table for one student: their row and up to 2 above and 2 below, by improvement of
-- the week. Never names or ids, never the full list, never the last place. Same rules as
-- leaderboardWindow() in @edukemonos/curriculum.
-- ---------------------------------------------------------------------------
create function public.section_leaderboard(p_section uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  wk date := private.week_start_cr(now());
  enabled boolean;
  out jsonb;
begin
  if not private.is_section_member(p_section) then
    raise exception 'not your section' using errcode = '42501';
  end if;
  select coalesce(ss.leaderboard_enabled, true) into enabled
  from public.sections s left join public.section_settings ss on ss.section_id = s.id where s.id = p_section;
  if not enabled then
    return jsonb_build_object('enabled', false);
  end if;

  with base as (
    select m.student_id, st.nickname, st.leaderboard_hidden as hidden,
           coalesce((select sum(w.score_end - w.score_start) from public.mastery_weekly w
                     where w.student_id = m.student_id and w.week_start = wk
                       and w.skill_id in (select private.section_scope_skills(p_section))), 0) as improvement
    from public.section_members m join public.students st on st.id = m.student_id
    where m.section_id = p_section
  ),
  ranked as (
    select b.*, row_number() over (order by b.improvement desc, b.student_id::text) as pos
    from base b where b.nickname is not null and not b.hidden and b.improvement > 0
  ),
  n as (select count(*)::integer as c from ranked),
  -- Leave out the last place unless it is the student.
  pool as (
    select r.*, row_number() over (order by r.pos) as p
    from ranked r where r.pos < (select c from n) or r.student_id = uid
  ),
  mine as (select p from pool where student_id = uid)
  select jsonb_build_object(
    'enabled', true,
    'enough', (select c from n) >= 4,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object('nickname', pool.nickname, 'points', round(pool.improvement * 100)::integer, 'me', pool.student_id = uid) order by pool.p)
      from pool, mine
      where (select c from n) >= 4 and pool.p between mine.p - 2 and mine.p + 2
    ), '[]'::jsonb),
    'me', (select jsonb_build_object('nickname', b.nickname, 'hidden', b.hidden, 'points', round(b.improvement * 100)::integer)
           from base b where b.student_id = uid)
  ) into out;
  return out;
end;
$$;

-- For the teacher: how many students take part in the table (no ranking, no nicknames).
create function public.section_leaderboard_summary(p_section uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when not private.owns_section(p_section) then null else jsonb_build_object(
    'with_nickname', count(*) filter (where st.nickname is not null),
    'hidden', count(*) filter (where st.leaderboard_hidden),
    'members', count(*)
  ) end
  from public.section_members m join public.students st on st.id = m.student_id
  where m.section_id = p_section
$$;

-- ---------------------------------------------------------------------------
-- Recovery codes also move mastery_weekly, the nickname and the hide setting.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_recovery_code(p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  old_id uuid;
  old_nick text;
  old_hidden boolean;
  moved jsonb;
  n_attempts integer;
  n_diagnostics integer;
  n_mastery integer;
  n_weekly integer;
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
  select nickname, leaderboard_hidden into old_nick, old_hidden from public.students where id = old_id;
  update public.students set nickname = null where id = old_id;   -- frees it (unique)
  update public.students s
  set declared_grade_id = coalesce(o.declared_grade_id, s.declared_grade_id),
      nickname = coalesce(old_nick, s.nickname),
      leaderboard_hidden = coalesce(old_hidden, s.leaderboard_hidden)
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

  -- Weekly changes: the old device's record wins for the same skill and week.
  delete from public.mastery_weekly n
  using public.mastery_weekly o
  where n.student_id = uid and o.student_id = old_id and o.skill_id = n.skill_id and o.week_start = n.week_start;
  update public.mastery_weekly set student_id = uid where student_id = old_id;
  get diagnostics n_weekly = row_count;

  update public.tutor_sessions set student_id = uid where student_id = old_id;
  get diagnostics n_sessions = row_count;
  update public.writing_feedback set student_id = uid where student_id = old_id;
  get diagnostics n_writing = row_count;

  delete from public.section_members m
  using public.section_members o
  where m.student_id = uid and o.student_id = old_id and o.section_id = m.section_id;
  update public.section_members set student_id = uid where student_id = old_id;
  get diagnostics n_sections = row_count;

  delete from public.streak_repairs n
  using public.streak_repairs o
  where n.student_id = uid and o.student_id = old_id and (o.week_start = n.week_start or o.period_key = n.period_key);
  update public.streak_repairs set student_id = uid where student_id = old_id;
  get diagnostics n_repairs = row_count;

  delete from public.student_recovery_codes where student_id = uid;
  update public.student_recovery_codes set student_id = uid, last_used_at = now() where student_id = old_id;

  delete from public.students where id = old_id;

  moved := jsonb_build_object(
    'attempts', n_attempts, 'diagnostics', n_diagnostics, 'mastery', n_mastery, 'mastery_weekly', n_weekly,
    'tutor_sessions', n_sessions, 'writing_feedback', n_writing, 'sections', n_sections,
    'streak_repairs', n_repairs
  );
  insert into public.events (actor_id, name, props)
  values (uid, 'recovery_code_redeemed', jsonb_build_object('moved', moved));
  return jsonb_build_object('ok', true, 'already_here', false, 'moved', moved);
end;
$$;

revoke all on function public.section_goal(uuid) from public, anon;
revoke all on function public.nickname_options() from public, anon;
revoke all on function public.choose_nickname(text) from public, anon;
revoke all on function public.set_leaderboard_hidden(boolean) from public, anon;
revoke all on function public.section_leaderboard(uuid) from public, anon;
revoke all on function public.section_leaderboard_summary(uuid) from public, anon;
grant execute on function public.section_goal(uuid) to authenticated;
grant execute on function public.nickname_options() to authenticated;
grant execute on function public.choose_nickname(text) to authenticated;
grant execute on function public.set_leaderboard_hidden(boolean) to authenticated;
grant execute on function public.section_leaderboard(uuid) to authenticated;
grant execute on function public.section_leaderboard_summary(uuid) to authenticated;
